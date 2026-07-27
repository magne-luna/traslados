## Context

Fase **FE-3 (rama Conductores)** del `ROADMAP-FRONTEND.md`, lado UI de `C-09 conductores`. Los conductores son un maestro operativo que consume FE-5 (Hojas de Ruta): agrupación de pasajeros por vehículo/conductor (US-700), y que se relaciona con la flota vía `Vehiculo 1---N Conductor (asignación semanal)`. Se construye frontend + mock: el backend real (`C-09`: tablas `conductor`/`asignacion_semanal`, RLS, sin usuario en `auth.users`) es otra sesión.

Estado actual del frontend (ya existe, se reutiliza como patrón):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite) + React Router. Vitest + React Testing Library para tests.
- FE-1 estableció el patrón **contrato → mock → hook → componente presentacional**. `vehiculos-ui` y `obras-sociales-ui` lo consolidaron con persistencia en `localStorage`: `XRepository` (interfaz) + `mockXRepository` (localStorage + `schemaVersion` + fixture) + `useX` (hook de wiring) + `XRepositoryContext` (inyección) + componentes presentacionales. El mock de `VehiculoRepository` ya existe (`frontend/src/shared/lib/mocks/mockVehiculoRepository.ts`) con su fixture de 2-3 vehículos.
- El tipo `ChecklistItem` (`{ id, nombre, requerido }`) vive en `frontend/src/shared/types/documento.ts`; `EntidadDocumental` ya incluye `'conductor'`. El renderer `DocumentChecklist` (`frontend/src/shared/components/DocumentChecklist.tsx`) es reutilizable, y hay un `DocumentoRepository` mock en `shared/lib/documentos/`.
- Utilitarios compartidos: `generateId(prefix)` (`shared/lib/id.ts`). Design system: primitivos en `frontend/src/design-system/` (`Section`, `Chip`, `Button`).
- La ruta `/conductores` existe hoy como `PlaceholderPage` en `frontend/src/app/router.tsx`; la lista declarativa `frontend/src/app/routes.ts` no se toca (cada FE-N solo reemplaza su `element`).
- Convención de UI (`08_arquitectura_propuesta.md`): en pantallas listado+detalle, fila de listado clickeable completa (onClick en `<li>`, botón "Editar" con `stopPropagation`), detalle expandido — mismo patrón que Vehículos / Obras Sociales.

Restricciones duras del proyecto (CLAUDE.md): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); estilar SOLO con clases utilitarias de Tailwind v4, prohibido `style={{}}` inline (tokens en el bloque `@theme` de `frontend/src/index.css`); prohibido crear cliente Supabase real / RLS / migraciones en este change; Conventional Commits. Governance de este dominio: **BAJO** (maestro administrativo, sin datos clínicos/fiscales/auth).

## Goals / Non-Goals

**Goals:**
- Contrato de datos `Conductor` + `ConductorRepository` que no haya que reescribir cuando llegue `C-09` backend (los campos salen de `04_modelo_de_datos.md §Conductor`).
- Mock con `localStorage` + latencia para loading/error states reales, con 2-3 conductores de fixture (uno con restricción de perfil, uno con asignación semanal a un vehículo del fixture de flota).
- CRUD con datos personales y selector tipado de restricciones de perfil, **sin generar cuenta de acceso** (RN-GL-03).
- Asignación semanal a vehículo con selector alimentado por `VehiculoRepository` y **validación pura de colisión** (fácilmente testeable en TDD): un conductor no en dos vehículos la misma semana salvo override explícito.
- Documentación del conductor (licencia, etc.) reutilizando `DocumentChecklist` de FE-1.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL, RLS, buckets, cualquier fila en `auth.users` (es `C-09` backend, FE-8). Los conductores NUNCA tienen login (RN-GL-03).
- Modificar `VehiculoRepository` o su mock: se **consumen** de solo lectura para el selector de asignación.
- Consumo del conductor por Hojas de Ruta: la agrupación de pasajeros por vehículo/conductor (US-700) se **aplica** en FE-5 (C-10); acá solo se deja el dato consultable.
- Validación de compatibilidad restricción-de-perfil ↔ paciente (ej. "no carga física" vs. paciente que la requiere): se **consume** en FE-5; acá solo se registra la restricción tipada.
- Integración con ARCA, geolocalización, notificaciones o cualquier API externa.

## Decisions

### Decisión 1 — Persistencia del mock en `localStorage`, no in-memory
Se reutiliza el patrón de `mockVehiculoRepository`: `localStorage` con clave `conductores`, envoltorio `StoredPayload { schemaVersion, conductores }`, `withLatency` para simular red, y re-seed desde fixture ante payload corrupto o `schemaVersion` mismatch. Motivo: el maestro de conductores se configura una vez y se espera reencontrar entre recargas mientras se prueban las asignaciones semanales y los documentos, que son datos acumulados. La (de)serialización queda encapsulada en el mock; el resto de la app solo ve `ConductorRepository`.
- **Alternativa descartada:** in-memory como FE-1 — se perderían asignaciones/documentos en cada reload, empobreciendo la prueba de la tabla semanal.

### Decisión 2 — Sin cuenta de acceso: `Conductor` es solo datos, jamás toca auth (RN-GL-03)
El alta de conductor es un formulario de datos administrativos puro. NO se importa nada de `shared/auth`, NO se crea sesión, NO se agrega el conductor al mock de usuarios. Motivo: RN-GL-03 y US-600 son explícitos — "planificar la operación sin darles acceso al sistema". El backend `C-09` lo refuerza (no crea fila en `auth.users`); el frontend no debe abrir siquiera la puerta a un login de conductor.
- **Alternativa descartada:** reutilizar el flujo de alta de usuario/auth — violaría RN-GL-03 y confundiría el modelo de permisos.

### Decisión 3 — Restricciones de perfil como unión de literales + observación libre
`RestriccionConductor` es una unión de literales para los casos conocidos (parte de `'no-carga-fisica'` — el único documentado explícitamente en `04_modelo_de_datos.md §Conductor` y US-600) y `Conductor.restricciones: RestriccionConductor[]`; además un campo libre `observaciones?: string` para matices no tipados. Motivo: mantener strict y habilitar un selector cerrado que FE-5 pueda consumir para validar compatibilidad conductor↔paciente sin comparar strings arbitrarios, sin cerrar la puerta a notas cualitativas. El catálogo cerrado exacto se confirma con el cliente (Open Question).
- **Alternativa descartada:** `string[]` libre — se pierde el chequeo tipado que FE-5 necesita y se abre a typos. Solo-texto-libre — no permite validación aguas abajo.

### Decisión 4 — Asignación semanal identificada por etiqueta ISO de semana `YYYY-Www`
`AsignacionSemanal = { id, vehiculoId, semana }` donde `semana` es la etiqueta ISO-8601 de semana (ej. `'2026-W30'`, lunes como inicio de semana). Motivo: una etiqueta de semana es estable, comparable por igualdad de string, ordenable, y no ambigua respecto de zonas horarias (a diferencia de un `Date`). Una función pura `semanaActualIso(ahora)` deriva la semana por defecto para el alta rápida.
- **Alternativa descartada:** guardar un rango `{ desde, hasta }` de fechas — redundante y propenso a solapamientos mal formados; la semana ISO ya es el identificador natural del requisito "por semana".

### Decisión 5 — Asignaciones embebidas en `Conductor`, no repository aparte
`Conductor` embebe `asignaciones: AsignacionSemanal[]`, y las mutaciones de asignación pasan por `ConductorRepository.update()`. Motivo: en el mock no hay joins y la relación semanal se lee siempre junto con el conductor; el día del backend real la tabla `asignacion_semanal` puede ser separada y `SupabaseConductorRepository` la ensambla, sin cambiar el tipo que ve la UI (mismo criterio que los gastos embebidos en `vehiculos-ui` Decisión 6). La regla de colisión "un vehículo por conductor por semana" queda naturalmente acotada al array del propio conductor, lo que la hace trivial de validar.
- **Alternativa descartada:** un `AsignacionSemanalRepository` separado — sobre-ingeniería para un mock; se puede separar en FE-8 sin tocar componentes.

### Decisión 6 — Validación de colisión como función pura, con override explícito
`validarAsignacionSemanal({ asignaciones, semana, vehiculoId, permitirMultiple })` → resultado con error si el conductor ya tiene una asignación a **otro** vehículo esa misma semana y `permitirMultiple` es `false`. Motivo: es exactamente el test que `C-09` backend define ("un conductor no queda asignado a dos vehículos la misma semana salvo que se permita explícitamente"), portado al frontend como función pura trivialmente testeable en TDD (input → error/ok). Reasignar al **mismo** vehículo esa semana no es colisión (es idempotente / edición). El `permitirMultiple` deja documentada la excepción "salvo que se permita explícitamente".
- **Alternativa descartada:** bloquear siempre sin override — contradice el requisito que admite la excepción explícita.

### Decisión 7 — El selector de vehículo consume `VehiculoRepository` inyectado, sin acoplar tipos
La tabla de asignación lee la lista de vehículos vía el `VehiculoRepository` existente, inyectado por su propio context (`VehiculoRepositoryContext`), y guarda solo el `vehiculoId` (string) en la asignación — NO embebe el objeto `Vehiculo`. Motivo: mantener el contrato de conductores desacoplado del de flota (solo un id), evitar datos duplicados/obsoletos, y que el swap de cualquiera de los dos repositories a Supabase (FE-8) sea independiente. La feature de conductores monta ambos providers (Conductor + Vehiculo mock) en su punto de composición.
- **Alternativa descartada:** embeber el `Vehiculo` completo en la asignación — duplica datos y se desincroniza si el vehículo cambia de patente/estado.

### Decisión 8 — Documentos del conductor reutilizan `DocumentChecklist` + `EntidadDocumental = 'conductor'`
La sección de documentos (licencia de conducir, DNI, apto médico) reutiliza el renderer `DocumentChecklist` de FE-1 con `entidad = 'conductor'` (ya contemplado en `documento.ts`) y un checklist fijo de documentos de conductor, sin duplicar el modelo documental. La (des)carga real de archivos es del `DocumentoRepository` mock existente; acá solo se define la lista de ítems de conductor.
- **Alternativa descartada:** un modelo documental propio de conductores — duplicaría `ChecklistItem`/`DocumentoAdjunto` y rompería la reutilización que FE-1 diseñó para Pacientes, Vehículos, Conductores y Facturas.

### Decisión 9 — Inyección del repository por context + estructura `features/conductores/`
Las pantallas reciben `ConductorRepository` vía un `ConductorRepositoryContext` (mismo patrón que `VehiculoRepositoryContext`), nunca importan el mock directamente. Siguiendo `08_arquitectura_propuesta.md`: contrato + mock en `shared/` (reusables), pantallas y hooks específicos en `features/conductores/`. La feature se monta reemplazando el `element` de `/conductores` en `router.tsx`. El patrón de UI listado+detalle (fila clickeable, botón "Editar" con `stopPropagation`) calca el de Vehículos.

### Decisión 10 — Open questions con impacto de UI se muestran como cartel visible, no solo en design.md
Las 4 open questions que afectan una decisión visible para quien usa la pantalla (catálogo de restricciones, excepción de doble asignación semanal, campos mínimos del alta, documentos a precargar) se marcan en el componente correspondiente con un cartel corto tipo `⚠️ Pendiente de confirmar: ...`, reutilizando el estilo `warning` ya establecido (`Chip kind="warning"` / clases ámbar del design system, mismo criterio que `VehiculoMantenimiento`). Motivo: que quien implemente `C-09` backend (u otra persona del equipo) vea la ambigüedad en el momento de usar la pantalla, no solo leyendo este documento — mismo criterio ya aplicado en `obras-sociales-ui`/`vehiculos-ui` (discrepancias documentadas también donde se ven, no solo en la KB). La 5ª open question (nombres de campo con backend) es puramente interna y no lleva cartel en UI.
- **Alternativa descartada:** dejarlas solo documentadas en `design.md` — se pierden de vista una vez archivado el change, y quien lee la pantalla (incluida Andrea, la usuaria) no tiene forma de saber que ese comportamiento es provisorio.

## Risks / Trade-offs

- **Divergencia de campos con el backend real (`C-09`)** → El nombre/tipo de campos de `Conductor` / `AsignacionSemanal` podría no calzar con las tablas reales. Mitigación: los campos salen directo de `04_modelo_de_datos.md §Conductor` y del scope de `C-09` en `CHANGES.md`; coordinar nombres con quien implemente `C-09` antes de cerrar la interfaz. Como la UI habla con la interfaz, un ajuste queda contenido en el adaptador.
- **Semana ISO dependiente de la fecha "ahora"** → un helper `semanaActualIso()` con `new Date()` real haría tests no deterministas. Mitigación: las funciones puras reciben la fecha de referencia (`ahora: Date`) como parámetro; los tests inyectan valores fijos.
- **Acoplamiento con el fixture de flota** → la asignación referencia `vehiculoId` de vehículos que deben existir en el mock de flota. Mitigación: el fixture de conductores usa ids de vehículo que existen en `vehiculosFixture`, o deja el conductor sin asignación; el selector solo ofrece vehículos que el `VehiculoRepository` devuelve.
- **Catálogo de restricciones incompleto** → solo `'no-carga-fisica'` está documentado; el resto es especulativo. Mitigación: se arranca con el/los valor(es) documentado(s) + `observaciones` libre, y se deja Open Question para cerrar el catálogo con el cliente; extender la unión no rompe datos existentes.
- **`localStorage` sin versionado robusto** → si cambia la forma de `Conductor`, los datos viejos podrían romper la deserialización. Mitigación: `schemaVersion` en el payload y re-seed desde fixture ante mismatch (es solo un mock, no hay dato de producción que preservar).

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend). Camino de reemplazo futuro (FE-8, cuando `C-09` backend se archive): escribir `SupabaseConductorRepository` que cumpla `ConductorRepository`, inyectarlo en `ConductorRepositoryContext` en lugar del mock. Las funciones puras (`validarAsignacionSemanal`, `semanaActualIso`) pueden quedar como espejo client-side o delegarse al backend; componentes, hooks y tipos no cambian.

Governance BAJO: dominio de baja criticidad. Este change entrega proposal/design/specs/tasks; la implementación (apply) puede proceder con autonomía una vez aprobados los artefactos, reportando lo hecho.

## Open Questions

- Coordinar con backend (`C-09`) los nombres exactos de campos de `Conductor` y `AsignacionSemanal` (y si la semana se guarda como etiqueta ISO `YYYY-Www` o como fecha de inicio de semana) antes de cerrar la interfaz, para minimizar el trabajo del adaptador en FE-8.
- Confirmar con el cliente el **catálogo cerrado de restricciones de perfil**: la KB solo documenta explícitamente "no traslada pacientes que requieren carga física" (por edad); ¿hay otras restricciones tipables (horarias, tipo de vehículo, zona) o alcanza con esa + `observaciones` libre?
- ¿La excepción "salvo que se permita explícitamente" (un conductor en dos vehículos la misma semana) es un caso real que la administradora necesita, o la colisión debe bloquearse siempre? Se implementa con un override explícito (`permitirMultiple`) apagado por defecto, confirmable con el cliente.
- ¿Qué datos personales mínimos exige el alta (DNI obligatorio, teléfono, fecha de nacimiento para las restricciones por edad)? Se toma apellido + nombre + documento como obligatorios y el resto opcional, confirmable con el cliente.
- ¿Cuáles documentos precargar en el checklist del conductor? Se sembrará licencia de conducir (requerido), DNI y apto médico, confirmables con el cliente.
