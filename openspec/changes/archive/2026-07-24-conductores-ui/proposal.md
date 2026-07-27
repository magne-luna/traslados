## Why

Los conductores son un maestro operativo del que dependen las Hojas de Ruta (FE-5): cada recorrido se arma sobre un vehículo y su conductor asignado esa semana (`04_modelo_de_datos.md §HojaDeRuta/Recorrido`, `Vehiculo 1---N Conductor (asignación semanal)`). La administradora necesita registrar a los conductores con sus datos y restricciones de perfil, asignarles un vehículo por semana, y adjuntar su documentación (licencia de conducir), todo **sin darles acceso al sistema** (US-600, RN-GL-03). Este change entrega la fase **FE-3 (rama Conductores)** del `ROADMAP-FRONTEND.md` — el lado UI de `C-09 conductores` — construida como **frontend + mock**, siguiendo el contrato "tipos primero, mock después, Supabase al final" ya establecido y archivado en `vehiculos-ui` y `obras-sociales-ui`, para no reescribir componentes cuando el backend real (`C-09`) se archive.

## What Changes

- Se definen los **tipos TypeScript** del dominio de conductores en `frontend/src/shared/types/conductor.ts`: `Conductor` (datos personales — apellido, nombre, documento/DNI, teléfono, fecha de nacimiento opcional; perfil/restricciones; asignaciones semanales), `RestriccionConductor` (unión de literales para las restricciones de perfil conocidas — RN de perfil, US-600) y `AsignacionSemanal` (conductor ↔ vehículo por semana). Sin `any`.
- Se define la interfaz **`ConductorRepository`** (`list`, `getById`, `create`, `update`) — la UI nunca habla con Supabase directamente, mismo contrato que `VehiculoRepository`.
- Se agrega una **implementación mock** de `ConductorRepository` en `frontend/src/shared/lib/mocks/` con fixtures persistidos en `localStorage` (con `schemaVersion`) y latencia simulada, para ejercitar loading/error states reales — mismo patrón que `mockVehiculoRepository`.
- Se construye la **pantalla CRUD** de conductores (alta / edición / listado) con datos personales y **selector tipado de restricciones de perfil** (multi-selección sobre el conjunto cerrado `RestriccionConductor`, ej. "no traslada pacientes con carga física"), siguiendo el patrón de **fila de listado clickeable + detalle** ya usado en Vehículos / Obras Sociales (`08_arquitectura_propuesta.md`).
- **IMPORTANTE — sin cuenta de usuario:** los conductores son solo datos administrativos; la pantalla NO tiene login, NO crea usuario de auth y NO toca el sistema de autenticación (RN-GL-03). El alta es puramente un formulario de datos.
- Se construye la **asignación semanal a vehículo**: una tabla de asignaciones por semana (semana identificada por su etiqueta ISO `YYYY-Www`) donde se elige el vehículo desde la **lista provista por `VehiculoRepository`** (el mock de `vehiculos-ui`, ya archivado), con **validación client-side de colisión**: un conductor no puede quedar asignado a dos vehículos distintos la misma semana salvo que se permita explícitamente (test de `C-09`, portado al frontend como función pura).
- Se construyen los **documentos del conductor** (licencia de conducir, etc.) **reutilizando el componente de checklist documental de FE-1** (`DocumentChecklist`), con `EntidadDocumental = 'conductor'` (ya contemplada en `documento.ts`) — mismo patrón que `vehiculos-ui` aplicó a sus documentos.
- **Fuera de alcance (NO se toca):** cliente Supabase real, migraciones SQL (`conductor`, `asignacion_semanal`), RLS, buckets de storage. Eso corresponde al change backend `C-09` real, en otra sesión. No se define ni modifica el `VehiculoRepository` (se **consume** el existente para el selector). El consumo del conductor por las Hojas de Ruta (agrupar pasajeros por vehículo/conductor) se **aplica** en FE-5 (C-10); acá solo se deja el dato listo y consultable.

## Capabilities

### New Capabilities
- `conductor-contract`: contrato de datos del maestro Conductores — tipos TypeScript de `Conductor` y sus sub-estructuras (`RestriccionConductor`, `AsignacionSemanal`), tipos de entrada `NuevoConductor` / `ActualizacionConductor`, interfaz `ConductorRepository` e implementación mock con persistencia en `localStorage` y latencia simulada.
- `conductor-crud`: pantalla de alta / edición / listado de conductores con datos personales y selector tipado de restricciones de perfil, patrón fila clickeable + detalle, y estados de carga/vacío/error contra el repository. Sin login ni cuenta de usuario (RN-GL-03).
- `conductor-asignacion-semanal`: asignación semanal de un conductor a un vehículo, con selector de vehículo alimentado por `VehiculoRepository`, tabla de asignaciones por semana, y validación pura de colisión (un conductor no queda en dos vehículos la misma semana salvo override explícito).
- `conductor-documentos`: checklist documental del conductor (licencia de conducir, etc.) reutilizando el renderer `DocumentChecklist` de FE-1 y `EntidadDocumental = 'conductor'`, sin duplicar el modelo documental.

### Modified Capabilities
<!-- Ninguna: no existen specs previas de conductores en openspec/specs/. Es un maestro nuevo. El VehiculoRepository existente se consume sin modificarlo. -->

## Impact

- **Código nuevo (frontend):**
  - `frontend/src/shared/types/conductor.ts` (tipos del dominio de conductores).
  - `frontend/src/shared/lib/conductores/ConductorRepository.ts` (interfaz).
  - `frontend/src/shared/lib/mocks/mockConductorRepository.ts` (mock localStorage + fixture) y `frontend/src/shared/lib/mocks/conductoresFixture.ts`.
  - `frontend/src/features/conductores/*` (pantallas CRUD, selector de restricciones, tabla de asignación semanal, documentos, hook, context de inyección, validaciones puras).
- **Reutiliza:** `ChecklistItem` y `DocumentChecklist` (`frontend/src/shared/{types,components}`), `EntidadDocumental = 'conductor'` (`documento.ts`), el `DocumentoRepository` mock existente (`shared/lib/documentos/`), `generateId` (`shared/lib/id.ts`), primitivos del design-system (`Section`, `Chip`, `Button`), y el patrón repository → mock → hook → context establecido en `vehiculos-ui` y `obras-sociales-ui`.
- **Consume (sin modificar):** `VehiculoRepository` + `mockVehiculoRepository` (de `vehiculos-ui`, archivado en `openspec/changes/archive/2026-07-24-vehiculos-ui/`) para poblar el selector de vehículo de la asignación semanal.
- **Monta la feature** reemplazando el `element` de la ruta `/conductores` en `frontend/src/app/router.tsx` (hoy `PlaceholderPage`); la lista declarativa `routes.ts` no cambia.
- **Habilita (aguas abajo):** FE-5 Hojas de Ruta (C-10) consume la lista de conductores, sus restricciones de perfil y su asignación semanal a vehículo para agrupar pasajeros por vehículo/conductor (US-700).
- **Sin impacto backend ni auth:** no crea tablas, RLS, buckets, ni usuario en `auth.users` (RN-GL-03). Cuando `C-09` backend se archive, se escribe `SupabaseConductorRepository` cumpliendo la misma interfaz y se inyecta en el punto de composición sin tocar componentes (FE-8).
- **Governance BAJO (CHANGES.md C-09):** dominio de baja criticidad (maestro administrativo, sin datos clínicos ni fiscales ni auth). Aun así este paso produce solo los artefactos (proposal, design, specs, tasks); la implementación arranca en el `apply`.
