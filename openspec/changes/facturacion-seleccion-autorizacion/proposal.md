## Why

El wizard de alta de factura (`FacturaForm.tsx`) tiene hoy un paso 2 ("Obra social / Prestador") que,
cuando la obra social factura `por-prestacion`, pide **tipear a mano** `prestadorNombre` y
`prestadorDomicilio`: dos strings libres, sin entidad detrás, sin selector y sin columna real en la
base. Es un remanente del change revertido `sacar-prestadores`, no un requisito del negocio.

El flujo real es otro: se elige un **paciente**, después una **autorización pendiente de facturar**
de ese paciente (del módulo Presupuestos/Autorizaciones, ya integrado contra Supabase), y recién ahí
se completa el resto de la factura (valor de km, días, importes). Hoy nada vincula una factura con la
autorización que la habilitó, y `useEmisionFactura.ts` (`resolverCupoAutorizado`) **adivina** la
autorización: devuelve la primera con cupo cargado. Con `modalidadFacturacion === 'por-prestacion'`
un paciente puede tener **varias autorizaciones simultáneas** (una por prestación, confirmado en
`openspec/changes/presupuesto-prestaciones/design.md` L434), así que esa heurística puede alertar de
cupo contra la autorización equivocada.

Este change se apoya directamente en `integracion-facturacion` (mismo branch
`feature/integracion-facturacion`): repositories reales, RPC `crear_factura_completa` /
`actualizar_factura_completa` ya aplicadas.

**⚠️ GOVERNANCE CRÍTICO.** Mismo dominio que `integracion-facturacion` (Facturación = *Billing*):
**cero SQL ni código de aplicación sin aprobación humana explícita**. Este change agrega **una
columna** a `facturacion.facturas` y **reemplaza** (`CREATE OR REPLACE FUNCTION`) las dos RPC ya
existentes. Requiere el mismo portón de aprobación que D3 de `integracion-facturacion/design.md`
antes de escribir el `.sql`. Este propose es análisis, no habilita el apply.

## Decisiones ya confirmadas con la usuaria (no se reabren)

- `prestadorNombre`/`prestadorDomicilio` **desaparecen del alta de factura**. No tienen columna real
  en producción → **no hace falta migración para sacarlos**, es cambio de frontend puro.
- Se agrega `facturas.autorizacion_id UUID REFERENCES facturacion.autorizacion(id)`, **nullable y
  SIN `UNIQUE`**: la relación es N:1 — una autorización genera una factura por mes, coherente con que
  `cupoMensualDias`/`cupoMensualKm` son un cupo **mensual recurrente**.
- "Pendiente de facturar" = `estado === 'autorizada'` (vigente). **No se filtra por mes ya
  facturado**: se confía en que la usuaria no elige la misma autorización dos veces para el mismo
  período. El picker no lleva lógica de período.
- El listado se deriva **client-side** reusando `PresupuestoRepository.list()` +
  `AutorizacionRepository.getByPresupuestoId()` — **sin endpoint nuevo, sin métodos nuevos** en los
  repositories. Es el mismo patrón que ya usa `resolverCupoAutorizado` hoy.

## What Changes

### 1. Frontend — el paso 2 del wizard

- Paso 2 pasa de "Obra social / Prestador" a **"Autorización"**: sigue mostrando la obra social de
  solo lectura y reemplaza los dos `Input` de prestador por un **selector de autorizaciones
  pendientes** del paciente elegido.
- En `por-prestacion` el selector MUST distinguir cada autorización por su **prestación**
  (`Presupuesto.prestacionId`), porque puede haber varias simultáneas.
- **Estado vacío** (0 autorizaciones pendientes): bloquea "Siguiente", con mensaje + link a
  Presupuestos — mismo patrón que `PresupuestoForm.tsx` usa para "sin prestaciones activas".
- **Modo edición**: la autorización elegida se muestra de solo lectura (la edición no bifurca, mismo
  criterio ya usado en Presupuestos).
- Nueva función pura/derivación (ej. `shared/lib/facturacion/autorizacionesPendientes.ts`).
- `useEmisionFactura.ts`: `resolverCupoAutorizado` **deja de adivinar** — el `CupoAutorizado` que
  alimenta `AlertaCupo` se deriva de la autorización **elegida** (`derivarCupoAutorizado`, ya existe).
- Tipos y mapeo: `Factura`/`FacturaFormValues` ganan `autorizacionId?`, pierden los dos campos de
  prestador; `facturaMapping.ts` mapea `autorizacion_id ↔ autorizacionId` y sus payloads;
  `validateFacturaForm` valida la autorización en vez del prestador.

### 2. Backend — una columna + una migración de reemplazo de RPC

- **`2026XXXXXXXXXX_factura_autorizacion_id.sql`** (aditivo): `facturas.autorizacion_id UUID
  REFERENCES facturacion.autorizacion(id)` (nullable, sin `UNIQUE`) + índice
  `idx_facturas_autorizacion_id` (regla de `database-schema-design`: índice en toda FK).
- **`2026XXXXXXXXXX_factura_rpc_autorizacion.sql`**: `CREATE OR REPLACE FUNCTION` sobre
  `facturacion.crear_factura_completa` y `facturacion.actualizar_factura_completa` para leer/escribir
  `autorizacion_id` desde el `jsonb`, manteniendo **`SECURITY INVOKER` explícito**. Las RPC **no se
  tocan a mano en producción**: se versionan.
- **Las aplica la usuaria / backend (Enzo)**, no el agente.

### 3. Lo que este change NO hace

- **NO agrega una entidad `Prestador`** ni la reintroduce por la ventana (`sacar-prestadores` sigue
  siendo la decisión vigente).
- **NO crea endpoint, RPC de lectura ni método de repository** para listar autorizaciones por
  paciente. Se deriva client-side.
- **NO filtra autorizaciones por período ya facturado** ni impide facturar dos veces el mismo mes.
- **NO agrega `UNIQUE` sobre `autorizacion_id`** ni convierte la columna en `NOT NULL`.
- **NO migra facturas existentes** para completar `autorizacion_id` retroactivamente.
- **NO toca** Presupuestos/Autorizaciones (ni sus specs de CRUD), documentos de factura, cobros,
  ARCA ni el circuito de estados.
- **NO cierra ninguna pregunta abierta** de prioridad Alta.

## Capabilities

### New Capabilities

- `factura-autorizacion-seleccion`: derivación y selección de las autorizaciones pendientes de
  facturar de un paciente dentro del alta de factura — derivación client-side vía
  `PresupuestoRepository.list()` + `AutorizacionRepository.getByPresupuestoId()`, filtro por
  `estado === 'autorizada'`, distinción por prestación en `por-prestacion`, estado vacío bloqueante,
  y persistencia del vínculo en `facturas.autorizacion_id` (N:1, sin unicidad).

### Modified Capabilities

- `factura-crud`: el paso "Obra social / Prestador" pasa a ser "Autorización"; los escenarios de
  nombre/domicilio de prestador y de avance bloqueado por prestador **se retiran** y se reemplazan
  por selección obligatoria de autorización + estado vacío.
- `factura-contract`: `Factura` pierde `prestadorNombre`/`prestadorDomicilio` y gana
  `autorizacionId?: string`; el escenario que declara los campos de prestador como texto libre se
  elimina.
- `factura-cupo-validacion`: el cupo deja de resolverse por heurística ("la primera autorización con
  cupo") y pasa a derivarse de la autorización **explícitamente elegida**; se cubre el caso de varias
  autorizaciones simultáneas en `por-prestacion`.
- `factura-repository-supabase`: el mapeo y las dos RPC transportan `autorizacion_id` (nullable) en
  alta y edición.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/facturacion/autorizacionesPendientes.ts` + `.test.ts`

**Código modificado**
- `frontend/src/features/facturacion/FacturaForm.tsx` (**el paso 2**) + sus tests
- `frontend/src/features/facturacion/useEmisionFactura.ts` (`resolverCupoAutorizado`) + tests
- `frontend/src/shared/types/factura.ts`
- `frontend/src/shared/lib/facturacion/facturaMapping.ts` (+ `toCrearFacturaPayload` /
  `toActualizarFacturaPayload`) + tests
- `validateFacturaForm`, `ResumenPasoWizard` y cualquier render de los campos de prestador

**Base de datos**
- `2026XXXXXXXXXX_factura_autorizacion_id.sql` (**nuevo**: 1 columna + 1 índice)
- `2026XXXXXXXXXX_factura_rpc_autorizacion.sql` (**nuevo**: `CREATE OR REPLACE` de las 2 RPC)
- Ninguna migración existente se edita. Ninguna columna existente se altera ni se borra.

**Documentación**
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias — nueva discrepancia:
  `facturas.autorizacion_id` es un agregado sobre el docx (el docx no lo prevé).
- `AvisoModeloDatos` en la pantalla donde aplica (paso 2 del wizard o detalle de factura).
- `CHANGES.md` §C-07.

**Sin impacto**
- `PresupuestoRepository` / `AutorizacionRepository` (se reusan `list()` y `getByPresupuestoId()`,
  **sin métodos nuevos**), `FacturaRepository`/`CobroRepository` (interfaces),
  `SupabaseFacturaRepository` fuera del mapeo, `FacturaDetail`, `CobrosPanel`, `FacturaImprimible`,
  `FacturaDocumentos`, `DiasFacturablesSelector`, y las funciones puras de reglas de negocio.

**Dependencias**
- Requiere (ya cumplido): `integracion-facturacion` (repositories reales + las dos RPC que acá se
  reemplazan) e `integracion-presupuestos` (autorizaciones reales para poblar el selector).
- Habilita: trazabilidad factura↔autorización, base para un futuro control de "ya facturado este
  período" si el negocio lo pide.

**Riesgo y rollback**
- Riesgo #1: **no hay control de doble facturación del mismo período**. Decisión explícita de la
  usuaria, no un descuido — pero es la que más duele si el supuesto ("no la elige dos veces") falla.
  Mitigación: queda documentada como asunción del change, no como garantía del sistema.
- Riesgo #2: **la derivación client-side es O(N presupuestos) requests** por paciente. Aceptable al
  volumen actual (mismo costo que `resolverCupoAutorizado` ya paga hoy), pero se degrada si un
  paciente acumula muchos presupuestos.
- Riesgo #3: **`CREATE OR REPLACE` sobre RPC vivas**. Si la nueva versión se aplica mal, el alta de
  factura se rompe en producción. Mitigado: la firma no cambia, `autorizacion_id` es opcional en el
  `jsonb`, y `SECURITY INVOKER` se re-verifica con el test del texto del `.sql` ya existente.
- Riesgo #4: **facturas viejas quedan con `autorizacion_id NULL`**. La UI debe leerlas sin romper.
- **Rollback**: revertir el frontend (el paso 2 vuelve a los dos `Input`) y re-aplicar la versión
  anterior de las dos RPC. La columna queda nullable y sin lectores: es inerte. **Ningún dato
  existente se transforma ni se borra en ningún paso.**
