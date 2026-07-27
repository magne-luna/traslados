## Why

Facturación necesita registrar, por paciente, el **presupuesto** enviado a la obra social y la **autorización** que ésta responde, para poder controlar cuánto y por cuánto tiempo se puede facturar (US-200, RF-200 a RF-205). Este es el insumo que aguas abajo consume la facturación (FE-6 / `C-07`): el **cupo mensual autorizado** (días/km) es la base del control de facturación (RN-PA-03, RN-FA-02). Este change entrega la fase **FE-4** del `ROADMAP-FRONTEND.md` — el lado UI de `C-06 presupuestos-autorizaciones` — construido como **frontend + mock**, siguiendo el contrato "tipos primero, mock después, Supabase al final" ya establecido y archivado en `vehiculos-ui`, `obras-sociales-ui` y `conductores-ui`, para no reescribir componentes cuando el backend real (`C-06`: tablas `presupuesto`/`autorizacion`, RLS, validación dura) se archive.

Governance del dominio: **ALTO** (afecta dinero y plazos de cobro). En la fase de propose esto se traduce en ser explícito en `design.md` sobre cada decisión tomada; la aprobación humana previa a escribir código aplica en el `apply`.

Además, por pedido del usuario, este propose cruzó la KB (`04_modelo_de_datos.md §Presupuesto/Autorizacion`) contra el modelo de datos real entregado por el cliente (`docs/core/Traslados-Modelo-Datos.docx §Facturación`). Las discrepancias encontradas se documentan en `design.md` (sección "⚠️ Discrepancias con Traslados-Modelo-Datos.docx") y se marcan como cartel visible en la UI (`AvisoModeloDatos`), mismo criterio ya aplicado en Conductores/Obras Sociales/Vehículos.

## What Changes

- Se definen los **tipos TypeScript** del dominio en `frontend/src/shared/types/presupuesto.ts`: `Presupuesto` (id, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivo?`), `Autorizacion` (id, `presupuestoId`, `estado`, `fechaRespuesta?`, `montoAutorizado?`, `vigenciaDesde?`, `cupoMensualDias?`, `cupoMensualKm?`, `archivo?`), `EstadoAutorizacion` (unión de literales `'pendiente' | 'autorizada' | 'judicializada' | 'rechazada'`), `CupoAutorizado` (proyección consumible por FE-6) y `ArchivoAdjunto` (referencia a un archivo único). Sin `any`.
- Se define la interfaz **`PresupuestoRepository`** y **`AutorizacionRepository`** (`list`, `getById`, `create`, `update`; más `getByPresupuestoId` en el de autorizaciones) — la UI nunca habla con Supabase directamente, mismo contrato que `VehiculoRepository`.
- Se agregan **implementaciones mock** de ambos repositories en `frontend/src/shared/lib/mocks/` con fixtures persistidos en `localStorage` (con `schemaVersion`) y latencia simulada, para ejercitar loading/error states reales — mismo patrón que `mockVehiculoRepository`/`mockConductorRepository`.
- Se construye la **pantalla de presupuestos** (alta / edición / listado por paciente), con selector de paciente alimentado por `PacienteRepository` (mock de `pacientes-ui`) y de obra social por `ObraSocialRepository` (mock de `obras-sociales-ui`), guardando solo los ids. Patrón fila clickeable + detalle (`08_arquitectura_propuesta.md`).
- Se construye el **formulario de autorización** ligado a un presupuesto, con **selector de estado** (`pendiente → autorizada → judicializada → rechazada`), `montoAutorizado`, cupo mensual de días/km editable y **fecha de vigencia** independiente de la fecha de carga (soporte de carga retroactiva, RN-PA-02).
- Se implementa una **función pura de validación RN-PA-01** (`validarAutorizacion`) que rechaza/alerta si `montoAutorizado > presupuesto.monto` ("igual o menor, nunca mayor"). Es un **espejo en UI** de la regla; el backend `C-06` la re-valida. Trivialmente testeable (input → ok/error), calcando el patrón de funciones puras de `conductores-ui`.
- El **cupo mensual autorizado** queda expuesto como dato consumible por FE-6 (`CupoAutorizado`, RN-PA-03) — solo se deja el dato listo, no se implementa el control de facturación acá.
- **Documentación adjunta**: un **único campo `archivo`** por Presupuesto y otro por Autorización (input de un solo archivo cada uno) — **NO** el componente multi-documento `DocumentChecklist`. Ver discrepancia con el docx en `design.md` (Decisión 3): el scope de `C-06` en `CHANGES.md` asumía el patrón multi-doc de `C-03`, pero el docx modela un solo "Archivo" por entidad.
- **Fuera de alcance (NO se toca):** cliente Supabase real, migraciones SQL (`presupuesto`, `autorizacion`), RLS, buckets de storage — eso es el change backend `C-06`, en otra sesión. No se define ni modifica `PacienteRepository`/`ObraSocialRepository` (se **consumen** de solo lectura para los selectores). El control de facturación contra el cupo (RN-FA-02) se **aplica** en FE-6 (`C-07`); acá solo se deja el cupo consultable.

## Capabilities

### New Capabilities
- `presupuesto-contract`: contrato de datos del dominio Presupuestos/Autorizaciones — tipos TypeScript (`Presupuesto`, `Autorizacion`, `EstadoAutorizacion`, `CupoAutorizado`, `ArchivoAdjunto`), tipos de entrada `Nuevo*`/`Actualizacion*`, interfaces `PresupuestoRepository` y `AutorizacionRepository`, e implementaciones mock con persistencia en `localStorage` y latencia simulada.
- `presupuesto-crud`: pantalla de alta / edición / listado de presupuestos por paciente, con selectores de paciente y obra social (ids), monto, fecha de emisión y archivo único adjunto, patrón fila clickeable + detalle, y estados de carga/vacío/error contra el repository.
- `autorizacion-gestion`: formulario de autorización ligado a un presupuesto, con máquina de estados (`pendiente/autorizada/judicializada/rechazada`), monto autorizado, cupo mensual de días/km editable, fecha de vigencia retroactiva (RN-PA-02) y archivo único adjunto.
- `autorizacion-validacion-monto`: función pura que valida RN-PA-01 (`montoAutorizado ≤ presupuesto.monto`, nunca mayor) como espejo en UI de la regla de negocio, con bloqueo/alerta visible al guardar.
- `presupuesto-cupo-consumible`: proyección `CupoAutorizado` (paciente, cupo mensual de días/km, vigencia) expuesta como dato consultable para el control de facturación de FE-6 (`C-07`, RN-PA-03), sin implementar el control acá.

### Modified Capabilities
<!-- Ninguna: no existen specs previas de presupuestos/autorizaciones en openspec/specs/. Es un dominio nuevo. PacienteRepository y ObraSocialRepository se consumen sin modificarlos. -->

## Impact

- **Código nuevo (frontend):**
  - `frontend/src/shared/types/presupuesto.ts` (tipos del dominio).
  - `frontend/src/shared/lib/presupuestos/PresupuestoRepository.ts` y `.../AutorizacionRepository.ts` (interfaces).
  - `frontend/src/shared/lib/mocks/mockPresupuestoRepository.ts`, `.../mockAutorizacionRepository.ts` y sus fixtures (`presupuestosFixture.ts`, `autorizacionesFixture.ts`).
  - `frontend/src/features/presupuestos/*` (pantallas de presupuesto y autorización, selectores, validaciones puras, hooks, contexts de inyección).
- **Reutiliza:** `generateId` (`shared/lib/id.ts`), `AvisoModeloDatos` y primitivos del design-system (`Section`, `Chip`, `Button` — `frontend/src/design-system/`), y el patrón repository → mock → hook → context establecido en `vehiculos-ui`/`obras-sociales-ui`/`conductores-ui`.
- **Consume (sin modificar):** `PacienteRepository` + `mockPacienteRepository` (de `pacientes-ui`) para el selector de paciente, y `ObraSocialRepository` + `mockObraSocialRepository` (de `obras-sociales-ui`, archivado) para el selector de obra social.
- **Monta la feature** reemplazando el `element` de la ruta `/presupuestos` en `frontend/src/app/router.tsx` (hoy `PlaceholderPage` si existe; si no, se agrega el element sin tocar `routes.ts`).
- **Habilita (aguas abajo):** FE-6 Facturación (`C-07`) consume `CupoAutorizado` para alertar cuando los días/km facturados superan el cupo autorizado (RN-FA-02, RN-PA-03).
- **Sin impacto backend ni auth:** no crea tablas, RLS ni buckets. Cuando `C-06` backend se archive, se escriben `SupabasePresupuestoRepository`/`SupabaseAutorizacionRepository` cumpliendo las mismas interfaces y se inyectan en el punto de composición sin tocar componentes (FE-8).
- **Governance ALTO (CHANGES.md C-06):** dominio de alta criticidad (dinero, plazos). Este paso produce solo los artefactos (proposal, design, specs, tasks); la implementación (apply) requiere revisión humana antes de escribir código, y debe ser explícita sobre las decisiones aquí tomadas — en particular las que agregan campos no presentes en el docx (ver `design.md`).
