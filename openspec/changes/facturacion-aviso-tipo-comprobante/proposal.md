## Why

Probando la emisión real en homologación (2026-08-31), ARCA rechazó todos los comprobantes (`422`,
`ARCA_RECHAZO`). Probando el miniserver directo con payloads variados se aislaron **dos bugs de
`_shared/arca.ts`** además de dos huecos de UX/observabilidad:

- **Fechas de servicio en formato equivocado.** `construirPayloadArca` mandaba
  `servicio.{desde,hasta,vtoPago}` en ISO (`2026-08-31`). WSFE las exige en `aaaammdd`
  (`20260831`) y con guiones responde la observación **10049** ("FchServDesde… formato válido
  aaaammdd"). Con el formato corregido, una Factura B a consumidor final se aprobó y devolvió CAE.
- **`observaciones` nunca llegaban a la UI ni a los logs.** El miniserver reenvía las observaciones
  de WSFE como **arreglo** `[{ code, msg }]`, y `parseRespuestaMiniserver` sólo aceptaba un string
  (`texto(cuerpo.observaciones)`) → siempre `undefined`. Por eso el `console.error` del rechazo
  mostraba `observaciones: undefined` y el mensaje en pantalla nunca decía el motivo.
- (**Ambiente, no bug:** el CUIT real de OSDE da observación **10015** en homologación —
  "no se encuentra registrado en los padrones de AFIP". Homologación tiene su propio padrón; los
  CUIT reales sólo validan en producción. Para verificar E2E en homologación hay que emitir a
  consumidor final, o esperar a producción. Se documenta, no se "arregla".)

Y los dos huecos originales:

1. **La Edge Function `facturar` no loguea nada en un rechazo.** El camino `!resArca.ok` (líneas
   ~234-241 de `supabase/functions/facturar/index.ts`) devuelve el `422`/`502` al frontend y
   listo — ninguna traza. Las `observaciones` de ARCA (el motivo real del rechazo) solo llegaban a
   la UI si el miniserver las mandaba, y aun así no quedaban registradas en ningún lado. Para
   diagnosticar un rechazo hoy hay que mirar los logs del miniserver de Enzo por afuera.

2. **El formulario deja armar una Factura A contra una obra social exenta.** La causa del rechazo
   de hoy: la factura era tipo A y la obra social (OSDE) tiene `condicion_iva = IVA_SUJETO_EXENTO`.
   ARCA solo acepta Factura A cuando el receptor es *Responsable Inscripto* (RG 5616) — cualquier
   otra condición hace que WSFE la rechace. El campo "Tipo de comprobante" se retiró del form
   (`facturacion-cambios-ui` WU2): hoy sale del default (`TIPO_COMPROBANTE_DEFAULT = 'A'`) o de
   `obra_social.tipo_comprobante` si está configurado. OSDE lo tiene en `null`, así que quedó en A
   y no hay ninguna señal en pantalla de que esa combinación va a ser rechazada.

## What Changes

### 0. `_shared/arca.ts` — dos bugs del payload/respuesta de ARCA

- **`construirPayloadArca`**: `servicio.{desde,hasta,vtoPago}` pasan por un helper `aaaammdd()`
  que saca los guiones del ISO. Verificado contra el miniserver: con `20260831` aprueba, con
  `2026-08-31` da observación 10049.
- **`parseRespuestaMiniserver`**: `observaciones` / `detalles` se normalizan con
  `formatObservaciones()` — acepta string plano (contrato viejo), arreglo de `{ code, msg }`
  (lo que manda WSFE hoy) y `{ Code, Msg }`; produce `"[10015] … · [10049] …"`. Así el motivo
  llega al `console.error` del rechazo y al mensaje `ARCA rechazó el comprobante: …` de la UI.

### 0b. `facturar/facturaPdf.ts` — el PDF fallaba por un carácter no-WinAnsi

Con la primera emisión aprobada (CAE real), el PDF **no se generó**: `WinAnsi cannot encode "→"`
(0x2192). `facturaPdf.ts` dibujaba `dependencia → retorno` con una flecha Unicode, y las fuentes
estándar de pdf-lib usan encoding WinAnsi (CP1252). Cualquier flecha, comilla tipográfica o emoji
en el texto libre del operador (descripción, dependencia/retorno) rompía **todo** el PDF.

- **`facturaPdf.ts`**: helper `winAnsi()` aplicado en el chokepoint `texto()` — mapea flechas →
  `->`, comillas → `"`/`'`, `…` → `...`, `\u00a0` → espacio, y cualquier otro carácter no
  representable a `?`. Conserva Latin-1 y los extras de CP1252 que pdf-lib sí soporta (€ – — • ™).
  Los dos literales `→` del código pasan a `->`.
- Nuevo `facturaPdf.test.ts` (deno): `winAnsi()` + smoke test de `construirFacturaPdf` con flechas
  en la descripción y en las asistencias → devuelve un PDF (`%PDF-`), no lanza.

### 1. Edge Function `facturar` — log del rechazo/error de ARCA

- **`supabase/functions/facturar/index.ts`**: antes del `return jsonResponse(resArca.status, …)` del
  camino `!resArca.ok`, un `console.error('facturar: ARCA no aprobó el comprobante', { facturaId,
  tipoComprobante, miniserverStatus, codigo, detalle, observaciones, cbteNro })`. Cubre los tres
  códigos (`ARCA_IDENTIDAD` 502, `ARCA_RECHAZO` 422, `ARCA_ERROR` 502). No cambia la respuesta ni
  el comportamiento — solo deja la traza en los logs de la función. Nunca loguea cert/key ni el
  payload fiscal.

### 2. Frontend — aviso en el form cuando Factura A + receptor no inscripto

- **`frontend/src/shared/lib/facturacion/advertenciaTipoComprobante.ts`** (nuevo, función pura):
  `advertenciaTipoComprobante({ tipoComprobante, condicionIvaObraSocial }) -> { condicion } | null`.
  Devuelve la condición problemática solo cuando `tipoComprobante === 'A'` y la obra social tiene
  una `condicionIva` cargada distinta de `IVA_RESPONSABLE_INSCRIPTO`. Con condición ausente
  devuelve `null` (ese caso ya lo cubre el `422 EMISION_SIN_CONDICION_IVA`); con B/C, `null`.
- **`frontend/src/features/facturacion/AlertaTipoComprobante.tsx`** (nuevo): `Alert tone="warning"`
  con el texto — "la obra social figura como «X», ARCA solo acepta Factura A con Responsable
  Inscripto; cambiá el comprobante de la obra social a B o corregí su condición frente al IVA".
  Reusa `etiquetaCondicionIva` de `features/obras-sociales/condicionIvaOptions`.
- **`frontend/src/features/facturacion/FacturaForm.tsx`**: en la columna derecha del Paso 3 / modo
  edición, junto a `AlertaCupo`, renderiza `AlertaTipoComprobante` cuando la función pura devuelve
  algo. No bloquea el guardado ni la emisión (mismo criterio no-bloqueante que `AlertaCupo`,
  design.md Decisión 6) — es un aviso.

### 5. Frontend — una factura emitida no se edita (RN-FA-06)

Detectado en el mismo testing: `FacturaDetail` mostraba el botón "Editar" para cualquier factura,
incluida una ya emitida con CAE, y `actualizar()` persistía los cambios sobre un documento fiscal
(la descripción y los importes ya estaban congelados por la EF).

- **`frontend/src/features/facturacion/FacturaDetail.tsx`**: `puedeEditar = factura.estado ===
  'a-facturar'`. Con `!puedeEditar` el botón "Editar" se reemplaza por una línea "esta factura ya
  fue emitida: es un documento fiscal y no se puede modificar". `handleSubmitForm` corta antes de
  `actualizar()` si la factura no es editable (defensa en profundidad). El resumen de solo lectura
  y los controles de cobros / corrección de estado no cambian.

### Lo que este change NO hace

- NO vuelve a poner el selector de "Tipo de comprobante" en el form.
- NO bloquea la emisión de Factura A a un receptor exento (sigue siendo decisión de la operadora;
  el aviso explica la consecuencia).
- NO cambia `construirPayloadArca` ni la validación server-side de la EF.
- NO toca `obra_social.tipo_comprobante` de ningún registro (eso lo hace la usuaria desde la ficha
  de la obra social).

## Capabilities

### Modified Capabilities

- `factura-emision-electronica`: la Edge Function `facturar` deja traza en los logs del motivo por
  el que ARCA no aprobó un comprobante (identidad, rechazo con observaciones, error), y el
  formulario de factura advierte —sin bloquear— cuando la combinación tipo de comprobante /
  condición frente al IVA del receptor va a ser rechazada por ARCA.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/facturacion/advertenciaTipoComprobante.ts` + `.test.ts`
- `frontend/src/features/facturacion/AlertaTipoComprobante.tsx` + `.test.tsx`

**Código modificado**
- `supabase/functions/_shared/arca.ts` (+ `.test.ts`) — `aaaammdd()` en `servicio` + `formatObservaciones()`
- `supabase/functions/facturar/index.ts` — un `console.error` en el camino de rechazo
- `frontend/src/features/facturacion/FacturaForm.tsx` (+ test) — renderiza el aviso

**Verificado en vivo (homologación, 2026-08-31)**
- Miniserver `/facturar` con `servicio` en `aaaammdd` + sin receptor → `aprobada: true`, CAE real.
- Con receptor CUIT real → observación 10015 (padrón de homologación) — límite de ambiente.

**Sin impacto**
- Backend: ninguna migración, ningún deploy de datos. El redeploy de `facturar` lo hace Enzo.
- `construirPayloadArca`, `parseRespuestaMiniserver`, `emisionErrores.ts` — sin cambios.
- La emisión sigue funcionando igual; el aviso es informativo.

**Riesgo y rollback**
- Riesgo mínimo: un `console.error` y un `Alert` no bloqueante.
- Rollback: quitar el `console.error` (+ redeploy) y el render del aviso + los dos archivos nuevos.
