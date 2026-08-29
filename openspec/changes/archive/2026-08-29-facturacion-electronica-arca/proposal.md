## Why

El circuito de Facturación está integrado con backend real (`integracion-facturacion` archivado:
`SupabaseFacturaRepository` / `SupabaseCobroRepository`, RPC `crear_factura_completa` /
`actualizar_factura_completa`, columna `fecha_factura`) pero **"Emitir factura" no factura de
verdad**. `frontend/src/features/facturacion/useEmisionFactura.ts` hace exactamente esto al emitir:

1. congela `identificadorFactura` (`resolverIdentificadorFactura`),
2. fija `fechaFactura = hoy`,
3. calcula y congela `fechaEstimadaCobro` (`calcularFechaEstimadaCobro`),
4. congela `descripcion` (`renderDescripcionFactura`),
5. `actualizar(id, { estado: 'facturado', … })`.

**No hay CAE, ni número de comprobante, ni punto de venta, ni llamada a ARCA/AFIP, ni PDF, ni
archivo guardado.** El comprobante de ARCA es hoy un ítem manual del checklist documental
(`FacturaDocumentos.tsx` + `checklistDocumentosFactura.ts`): la operadora emite la factura en el
portal de ARCA por afuera y sube el PDF a mano.

Esto cierra la pregunta abierta de **prioridad Alta** *"Integración con ARCA: ¿es viable
descargar/consultar comprobantes de forma automática, o se trabaja con carga manual del PDF?"*
(`knowledge-base/10_preguntas_abiertas.md`) y el default heredado por `facturacion-ui` / D13 de
`integracion-facturacion` (*"cero integración automática; carga manual"*).

**Existe un miniserver que resuelve la parte fiscal.** `facturas/README.md` documenta `arca-miniserver`:
proxy Node.js de facturación electrónica que habla WSAA + WSFE (firma CMS con `node-forge`, que Deno
no puede hacer bien). Es **multi-titular** — cada request transporta CUIT + certificado + clave del
emisor, autenticado con `X-Api-Key`. Endpoint `POST /facturar` → `{ aprobada, cae, caeVencimiento,
cbteNro, importes }`.

**Requisito explícito de la usuaria (Enzo):** dejar **todo genérico y configurable**. Lo único que
debe faltar para producción es:

- la **URL** del miniserver desplegado,
- los **documentos de ARCA**: certificado X.509, clave privada, CUIT del emisor y punto de venta.

Nada hardcodeado. Nada de identidad fiscal en el repo ni en la base leída por RLS.

**Además** (pedido de la usuaria en el propose): la factura emitida se **materializa como PDF** con
un modelo/plantilla propio y se **guarda en Storage** — no depende de que la operadora imprima o
descargue nada a mano.

**⚠️ GOVERNANCE CRÍTICO.** Facturación es el equivalente a *Billing* en la tabla de gobernanza del
proyecto: **cero código de aplicación sin aprobación humana explícita**. Este propose es análisis y
documentación. Ninguna decisión de este documento habilita el apply — ver `design.md` §Aprobaciones
requeridas. Las migraciones y los secrets los aplica la usuaria / Enzo, no el agente.

## What Changes

### 0. Discrepancias que este change cierra (decisión de la usuaria 2026-08-28)

- **`obra_social.condicion_iva` `TEXT` libre → enum tipado** (`CondicionIvaArca`): migración
  `ALTER TABLE obra_social.obra_social ADD CONSTRAINT … CHECK (condicion_iva IN (8 códigos ARCA))`,
  tipo TS, y `<select>` en `ObraSocialForm.tsx` (era `<input>` de texto). Backfill de valores
  actuales coordinado con Enzo. Cierra discrepancia #14.
- **`obra_social.cuit` = CUIT de la obra social pagadora**: se retira el `AvisoModeloDatos` de
  ambigüedad de `ObraSocialDetail.tsx`. Cierra discrepancia #12.

### 1. Backend — Edge Function nueva `facturar` + migración aditiva

- **`supabase/functions/facturar/index.ts`** (nueva). `requirePermiso(req, 'facturacion', 'write')`,
  carga la factura + su paciente + la obra social, arma el payload del miniserver desde config,
  hace `fetch(ARCA_MINISERVER_URL + '/facturar', { headers: { 'X-Api-Key': … } })`, y **al recibir
  `aprobada: true`** persiste `cae`, `cae_vencimiento`, `cbte_nro`, `pto_vta`, `arca_ambiente`,
  `estado = 'facturado'` y `fecha_factura`. Si ARCA rechaza (`422`) o falla la identidad (`401`), la
  factura **queda en `a-facturar`** y la EF devuelve el detalle del rechazo. Idempotente: una factura
  que ya tiene `cae` no se re-emite (devuelve `409`).
- **`supabase/migrations/2026XXXXXXXXXX_factura_arca.sql`** (expand, aditivo, ninguna columna
  existente se altera ni se borra): `facturacion.facturas` gana `cae TEXT`, `cae_vencimiento DATE`,
  `cbte_nro INTEGER`, `pto_vta INTEGER`, `arca_ambiente TEXT` (`CHECK IN ('production',
  'homologacion')`), `comprobante_pdf_url TEXT`, `arca_respuesta JSONB` (snapshot de auditoría de la
  respuesta del miniserver). Todas nullable — una factura en `a-facturar` no tiene ninguna.
- **`supabase/migrations/2026XXXXXXXXXX_bucket_facturas_emitidas.sql`**: bucket privado
  `facturas-emitidas`, RLS sobre `storage.objects` gateado por el módulo `facturacion` (mismo patrón
  exacto que `bucket_documentos_autorizaciones`).

### 2. Config — 100% por secrets de Edge Function (lo único que falta para producción)

| Secret | Contenido | Quién lo carga |
|---|---|---|
| `ARCA_MINISERVER_URL` | URL HTTPS del miniserver desplegado | Enzo (cuando lo despliegue) |
| `ARCA_MINISERVER_API_KEY` | valor de `X-Api-Key` | Enzo |
| `ARCA_CUIT` | CUIT del emisor (11 dígitos) | Andrea Pastor / contador |
| `ARCA_CERT_B64` | certificado X.509 en PEM → base64 | Andrea Pastor / contador |
| `ARCA_KEY_B64` | clave privada en PEM → base64 | Andrea Pastor / contador |
| `ARCA_PTO_VTA` | punto de venta habilitado en ARCA | Andrea Pastor / contador |
| `ARCA_AMBIENTE` | `production` o `homologacion` (default `homologacion`) | Enzo |

El código se escribe **completo** contra estos nombres. Sin ellos la EF responde
`503 { error: 'La emisión electrónica no está configurada.' }` y el botón "Emitir" muestra ese
mensaje — nunca un crash. **Ese es el estado en el que queda el repo al terminar este change.**

### 3. PDF del comprobante — modelo propio + guardado en Storage

- **Modelo de factura PDF** (`design.md` D6): layout tipo comprobante AFIP/ARCA — encabezado con
  datos del emisor (razón social, CUIT, ingresos brutos, inicio de actividades), tipo y letra del
  comprobante, punto de venta + número, datos del receptor (obra social: razón social, CUIT,
  condición IVA), detalle de ítems, período de servicio, totales (neto / IVA / total), **CAE +
  vencimiento del CAE + código de barras**, y el detalle de asistencias del período como anexo.
- Se genera **en la Edge Function `facturar`** justo después de obtener el CAE (tiene todos los datos
  y el `service_role` para subir a Storage; el navegador no compone un documento fiscal), se sube a
  `facturas-emitidas/{facturaId}/{cbteTipo}-{ptoVta}-{cbteNro}.pdf`, y la URL se persiste en
  `facturas.comprobante_pdf_url`.
- `FacturaImprimible.tsx` (vista imprimible actual) **no se reemplaza**: sigue como vista rápida en
  pantalla. El PDF archivado es el documento fiscal.

### 4. Frontend — el cableado de "Emitir"

- **`useEmisionFactura.ts`**: `emitirFactura()` deja de hacer `actualizar(id, { estado: 'facturado',
  … })` y pasa a invocar la EF `facturar` (vía un repository delgado nuevo,
  `SupabaseEmisionRepository`, mismo patrón que `SupabasePresupuestoRepository` con
  `functions.invoke`). Los pasos 1-4 (congelar identificador / fecha / fechaEstimadaCobro /
  descripción) **se mueven a la EF** para que el documento fiscal y sus snapshots se calculen del
  lado del servidor, en una sola transacción con el CAE.
- **`shared/types/factura.ts`**: `Factura` gana `cae?`, `caeVencimiento?`, `cbteNro?`, `ptoVta?`,
  `arcaAmbiente?`, `comprobantePdfUrl?` — todos opcionales (ausentes mientras `a-facturar`).
- **`FacturaAccionesEmision.tsx` / `FacturaResumen.tsx` / `FacturaImprimible.tsx`**: muestran CAE,
  vencimiento del CAE, número de comprobante y un link al PDF cuando la factura está `facturado`.
  Si ARCA rechazó, se muestra el motivo y la factura sigue editable.
- **`FacturaDocumentos.tsx`**: el ítem "Comprobante ARCA" del checklist deja de ser de carga manual
  obligatoria cuando la emisión electrónica está activa (queda como respaldo opcional).

### 5. Lo que este change NO hace

- **NO despliega el miniserver** ni administra su infraestructura (es de Enzo, repo `facturas/`).
- **NO guarda el certificado ni la clave en la base ni en el frontend** — solo como secrets de EF.
- **NO numera comprobantes localmente** — el número lo asigna ARCA (`cbteNro`).
- **NO implementa notas de crédito / débito**, consulta de padrón, ni anulación de comprobantes.
- **NO cachea el Ticket de Acceso (TA)** — lo hace el miniserver (`arca_ta_cache`).
- **NO toca la validación de cupo** (`validarCupoFacturacion`) ni ninguna de las 9 funciones puras
  de reglas de negocio.
- **NO soporta Factura C** — el miniserver solo acepta `FACTURA_A` / `FACTURA_B` (discrepancia, D4).

**Decisiones de la usuaria (2026-08-28) incorporadas a este propose:**
- **IVA 21 %** sobre las facturas de traslado, "por dentro" (`neto = monto / 1.21`, total del
  comprobante = `monto`), overrideable por secret (`ARCA_IVA_CODIGO` / `ARCA_IVA_MODO`). Falta solo
  confirmar por-dentro/por-fuera con el contador (cambio de secret, sin deploy).
- **`obra_social.cuit` = CUIT de la obra social** pagadora (cierra la discrepancia #12).
- **`obra_social.condicion_iva` pasa a ser un enum tipado** con los 8 códigos de ARCA — migración
  `CHECK` + tipo TS `CondicionIvaArca` + `<select>` en el form de obra social (D4-bis). Cierra la
  discrepancia #14.

## Capabilities

### New Capabilities

- `factura-emision-electronica`: emisión de comprobantes reales contra ARCA vía el miniserver,
  mediada por la Edge Function `facturar`. Config íntegra por secrets (identidad fiscal nunca en
  repo ni en base). Armado del payload desde los datos de la factura + obra social con defaults
  documentados y configurables. Persistencia de CAE, vencimiento del CAE, número de comprobante,
  punto de venta y ambiente. Manejo explícito del rechazo de ARCA (la factura no cambia de estado).
  Idempotencia (no re-emitir una factura con CAE).
- `factura-comprobante-pdf`: modelo/plantilla del PDF del comprobante emitido (layout tipo AFIP),
  generado del lado del servidor tras obtener el CAE y guardado en el bucket privado
  `facturas-emitidas`, con la URL persistida en la factura.

### Modified Capabilities

- `factura-estados-circuito`: la transición `a-facturar → facturado` deja de ser un cambio de estado
  local y pasa a ser una operación de servidor que **puede fallar** (rechazo de ARCA, identidad
  inválida, miniserver caído) sin dejar la factura en estado inconsistente; los snapshots que hoy
  congela el cliente (`identificadorFactura`, `fechaFactura`, `fechaEstimadaCobro`, `descripcion`)
  pasan a congelarse en el servidor junto con el CAE.
- `factura-contract`: el tipo `Factura` gana los campos fiscales del comprobante emitido (`cae`,
  `caeVencimiento`, `cbteNro`, `ptoVta`, `arcaAmbiente`, `comprobantePdfUrl`), todos opcionales, y
  su mapeo bidireccional en `facturaMapping.ts`.
- `obra-social-contract`: `ObraSocial.condicionIva` deja de ser `string` libre y pasa a
  `CondicionIvaArca` (unión cerrada de los 8 códigos de ARCA); el form usa un `<select>` y la
  columna gana un `CHECK`.

## Impact

**Código nuevo**
- `supabase/functions/facturar/index.ts` + helpers (`_shared/arca.ts` para el armado del payload y
  el parseo de la respuesta del miniserver, como funciones puras testeables).
- `supabase/functions/facturar/facturaPdf.ts` — el modelo del PDF (función pura: datos → bytes).
- `frontend/src/shared/lib/facturacion/SupabaseEmisionRepository.ts` + `.test.ts`
- `frontend/src/shared/lib/facturacion/emisionMapping.ts` + `.test.ts` (payload/respuesta ↔ dominio)

**Código modificado**
- `frontend/src/features/facturacion/useEmisionFactura.ts` (+ test) — invoca la EF en vez de
  `actualizar`
- `frontend/src/shared/types/factura.ts` — 6 campos opcionales nuevos
- `frontend/src/shared/lib/facturacion/facturaMapping.ts` (+ test) — mapeo de los campos nuevos
- `frontend/src/features/facturacion/FacturaAccionesEmision.tsx`, `FacturaResumen.tsx`,
  `FacturaImprimible.tsx`, `FacturaDocumentos.tsx` (+ tests) — mostrar CAE / nº / PDF / rechazo
- `frontend/src/shared/lib/facturacion/SupabaseFacturaRepository.ts` — `SELECT_FACTURA_COMPLETA`
  suma las 6 columnas nuevas

**Base de datos**
- `2026XXXXXXXXXX_factura_arca.sql` (**nuevo**, aditivo: 7 columnas)
- `2026XXXXXXXXXX_bucket_facturas_emitidas.sql` (**nuevo**: 1 bucket + 4 policies)
- **Las aplica la usuaria / Enzo**, no el agente — regla de governance.

**Config / infra**
- 7 secrets de Edge Function (§2) — los carga la usuaria / Enzo cuando tenga el miniserver y los
  documentos de ARCA.

**Documentación**
- `knowledge-base/10_preguntas_abiertas.md` — la pregunta de ARCA pasa de "abierta" a "resuelta:
  integración automática vía miniserver, config por secrets"; se abren/elevan las de `condicion_iva`,
  `obra_social.cuit`, alícuota de IVA por defecto y Factura C.
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias — Factura C no soportada; `monto` es total,
  no neto+IVA.
- `knowledge-base/05_reglas_de_negocio.md` — RN-FA nueva o nota sobre emisión electrónica.
- `CHANGES.md` §C-07, §Plan de integración; `ROADMAP-FRONTEND.md`.

**Sin impacto**
- `FacturaRepository.ts` / `CobroRepository.ts` (interfaces) — no cambian; la emisión va por un
  repository nuevo aparte.
- Las 9 funciones puras de reglas de negocio y sus tests.
- `validarCupoFacturacion`, `AlertaCupo`, `DiasFacturablesSelector`, `FacturaForm` (el alta/edición
  de facturas en `a-facturar` no cambia).
- Los mocks (`mockFacturaRepository`, `mockCobroRepository`) — se suma `mockEmisionRepository` para
  tests / desarrollo sin backend.

**Dependencias**
- Requiere (ya cumplido): `integracion-facturacion` archivado (repository real, RPC, `fecha_factura`),
  `integracion-obra-social` (`obra_social.cuit`, `condicion_iva`, `plantilla_factura`),
  `integracion-pacientes` (paciente + direcciones reales).
- Requiere (externo, fuera del repo): el miniserver `arca-miniserver` desplegado y accesible por
  HTTPS. **Este change entrega el código listo; el miniserver y sus credenciales son de Enzo.**
- Habilita: cerrar el checklist manual de "Comprobante ARCA" y el flujo E2E de facturación real.

**Riesgo y rollback**
- Riesgo #1: **identidad fiscal mal configurada** → ARCA rechaza todo. Mitigado: ambiente
  `homologacion` por default; la EF distingue error de identidad (`401`) de rechazo de comprobante
  (`422`) con mensajes propios; nada se persiste si no hay CAE.
- Riesgo #2: **el certificado/clave se filtran** → sólo viven como secrets de EF, nunca en repo,
  base ni frontend; el miniserver exige HTTPS.
- Riesgo #3: **doble emisión** (dos clicks, dos pestañas) → guard de idempotencia: una factura con
  `cae` no se re-emite (`409`), verificado en la EF antes del `fetch`.
- Riesgo #4: **el miniserver responde 200 pero la persistencia falla** → la factura tendría CAE en
  ARCA sin registro local. Mitigado: la EF persiste ANTES de generar/subir el PDF, y el `arca_respuesta`
  JSONB guarda la respuesta cruda para reconciliación manual; si aun así falla el `UPDATE`, se
  registra en logs con el `cbteNro` y se devuelve `500` con instrucción de reconciliar.
- Riesgo #5: **discrepancias de modelo** (Factura C, `monto` total vs neto, CUIT ambiguo) → se
  documentan por triplicado (KB + `CHANGES.md` + `AvisoModeloDatos`), no se resuelven adivinando.
- **Rollback**: revertir `useEmisionFactura.ts` (vuelve a `actualizar(id, { estado: 'facturado' })`)
  y quitar el import del repository de emisión. Las migraciones son aditivas (columnas nullables sin
  lector, bucket sin uso). La EF sin llamador es inerte. Ningún dato existente se transforma.
