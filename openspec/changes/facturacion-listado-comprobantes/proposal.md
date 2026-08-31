## Why

El change `facturacion-electronica-arca` (archivado 2026-08-29) dejó todo el circuito de emisión
real: la Edge Function `facturar` obtiene el CAE, genera el PDF del comprobante con `pdf-lib` y lo
guarda en el bucket privado `facturas-emitidas`; la clave del objeto queda en
`facturacion.facturas.comprobante_pdf_url` y `EmisionRepository.verComprobante(clave)` la resuelve a
una signed URL de 5 minutos.

**Pero ese PDF solo se puede abrir desde el detalle de la factura que lo emitió** (bloque
`ComprobanteElectronico` en `FacturaResumen.tsx`, botón "Ver comprobante (PDF)"). No hay ninguna
pantalla que muestre *todos* los comprobantes ya emitidos juntos. Para encontrar un comprobante hay
que acordarse de qué paciente / período era, entrar a esa factura y recién ahí ver el PDF.

Pedido de la usuaria (Enzo, 2026-08-31): **un apartado para ver los comprobantes emitidos** — el
listado de las facturas que ya tienen CAE, con acceso directo a su PDF.

> **⚠️ GOVERNANCE.** Facturación es el dominio equivalente a *Billing* (cero código sin aprobación
> humana explícita). Este change es **solo frontend, solo lectura, aditivo**: una pantalla nueva que
> lista datos ya existentes y reusa `EmisionRepository.verComprobante` tal cual. No toca la emisión,
> ni el tipo `Factura`, ni el backend, ni ninguna migración, ni ninguna función de reglas de
> negocio. La usuaria lo pidió explícitamente.

## What Changes

### Frontend — pantalla nueva "Comprobantes emitidos"

- **`frontend/src/features/facturacion/ComprobantesEmitidosList.tsx`** (nuevo, presentacional puro):
  tabla de las facturas con `cae` presente, ordenadas por `fechaFactura` descendente. Columnas:
  paciente, período (`mes/año`), comprobante (`{tipo} {ptoVta}-{cbteNro}`), CAE, fecha de factura,
  y acción "Ver PDF" (solo si `comprobantePdfUrl` está presente). Chip "PRUEBA — sin valor fiscal"
  cuando `arcaAmbiente === 'homologacion'`. Fila clickeable → detalle de esa factura (mismo patrón
  que `FacturasList`). `EmptyState` cuando todavía no hay ningún comprobante emitido.
- **`frontend/src/features/facturacion/FacturacionPage.tsx`**: la unión `View` gana
  `{ kind: 'comprobantes' }`; nuevo handler `verComprobante(factura)` (try/catch + `window.open`,
  idéntico al de `FacturaDetail.tsx`) con su estado de error local; branch de render para la
  pantalla nueva.
- **`frontend/src/features/facturacion/FacturasList.tsx`**: prop opcional `onVerComprobantes?`;
  botón "Comprobantes emitidos" (`variant="secondary"`, no requiere escritura) en la cabecera, al
  lado de "+ Nueva factura".

### Lo que este change NO hace

- NO cambia cómo se emite una factura ni cómo se genera el PDF.
- NO agrega campos a `Factura` ni toca `facturaMapping.ts` / `SupabaseFacturaRepository`.
- NO toca el backend (Edge Function, migraciones, RLS, bucket).
- NO agrega un método al `EmisionRepository` — usa `verComprobante` tal como está.
- NO exporta ni descarga en lote — abre un PDF por vez, con la signed URL efímera de siempre.

## Capabilities

### Modified Capabilities

- `factura-comprobante-pdf`: se agrega el requisito de un listado de todos los comprobantes emitidos
  con acceso a su PDF archivado (hasta ahora el PDF solo era alcanzable desde el detalle de su
  factura).

## Impact

**Código nuevo**
- `frontend/src/features/facturacion/ComprobantesEmitidosList.tsx` + `.test.tsx`

**Código modificado**
- `frontend/src/features/facturacion/FacturacionPage.tsx` (+ test) — view nueva + handler
- `frontend/src/features/facturacion/FacturasList.tsx` (+ test) — botón de navegación

**Sin impacto**
- `shared/types/factura.ts`, `facturaMapping.ts`, `SupabaseFacturaRepository`,
  `EmisionRepository` / `SupabaseEmisionRepository` (se consumen sin cambios).
- Backend: nada. Ninguna migración, ningún deploy, ningún secret.
- Las funciones puras de reglas de negocio y sus tests.

**Dependencias**
- Requiere (ya cumplido): `facturacion-electronica-arca` archivado (`comprobante_pdf_url`,
  `EmisionRepository.verComprobante`, bucket `facturas-emitidas`).
- El listado arranca **vacío** hasta que haya emisiones reales contra ARCA que produzcan un PDF.

**Riesgo y rollback**
- Riesgo bajo: pantalla de solo lectura. La signed URL sigue gateada por
  `modulos.tiene_permiso('facturacion', 'read')` en la policy del bucket — sin permiso, el botón
  "Ver PDF" falla con el mismo mensaje que hoy en el detalle.
- Rollback: quitar el branch de `View`, el botón de `FacturasList` y el archivo nuevo. Nada que
  revertir en datos ni en backend.
