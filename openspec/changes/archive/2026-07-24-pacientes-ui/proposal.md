## Why

El paciente es la entidad central del sistema: de su ficha dependen Presupuestos (FE-4), Facturación (FE-6) y Hojas de Ruta (FE-5). Sin la ficha clínica configurable no se puede facturar (identificador de afiliado por obra social), ni armar recorridos (direcciones ida/vuelta), ni controlar cobertura (CUD, amparo judicial). Este change entrega la rama **Pacientes y fichas clínicas** de la fase **FE-3** del `ROADMAP-FRONTEND.md` — el lado UI de `C-05 pacientes-fichas-clinicas` — construido como **frontend + mock**, siguiendo el contrato "tipos primero, mock después, Supabase al final" ya establecido en FE-1/FE-2, para no reescribir nada cuando el backend real (`C-05`) se archive.

## What Changes

- Se definen los **tipos TypeScript** de `Paciente` en `frontend/src/shared/types/` calcados de `knowledge-base/04_modelo_de_datos.md §Paciente`: datos personales (apellido, nombre, fecha de nacimiento, DNI, CUIL del titular), datos clínicos (diagnóstico/condición), accesorio de movilidad (reutiliza `AccesorioMovilidad` de FE-2), obra social asignada (referencia por id, no embebida), teléfono alternativo del responsable y flag de amparo judicial.
- Se modela el **CUD** (Certificado Único de Discapacidad: número, fecha de emisión, fecha de vencimiento) con una función pura de **estado de vencimiento** (`vigente | por-vencer | vencido`) para la alerta de vencimiento próximo (RF-104), siguiendo el patrón de funciones puras de FE-2 (`estadoHabilitacion`, `estadoServicePreventivo`).
- Se modela el **identificador de afiliado como campo adaptable** (RN-ID-02, IN-01): estructura `{ formato, valor }` con `formato` de unión cerrada (`numero-documento | alfanumerico | cuil-con-sufijo`), nunca `string` libre ni un único formato hardcodeado. El fixture siembra 2-3 pacientes con formatos distintos; el default es documentado y editable.
- Se modelan las **direcciones múltiples con ida y vuelta como registros independientes** (RN-HR-02): cada `Direccion` lleva su `tramo` (`ida | vuelta`) y es un registro autónomo — la UI **NO** autocompleta la vuelta desde la ida. Es una regla de negocio explícita en el tipo y en el formulario.
- Se modelan las **personas a cargo** (nombre, apellido, DNI) como lista dinámica.
- Se define la interfaz **`PacienteRepository`** (`list`, `getById`, `create`, `update`) + una **implementación mock** en `frontend/src/shared/lib/mocks/` con persistencia en `localStorage` y latencia simulada (patrón de FE-2).
- Se construye la **ficha completa del paciente** (listado + detalle + alta/edición) siguiendo la convención de UI de FE-2 (fila de listado clickeable + botón "Editar" con `stopPropagation`, detalle con resumen/editar separados).
- Se construye el **editor de direcciones** (múltiples, ida/vuelta independientes) y el **editor de personas a cargo**.
- Se construye la **pestaña de documentos del paciente** reutilizando el componente `DocumentChecklist` de FE-1 (`DocumentoRepository` + `mockDocumentoRepository`), con los ítems del checklist **filtrados por la obra social asignada al paciente** (leídos vía `ObraSocialRepository` de FE-2).
- **Fuera de alcance (NO se toca):** cliente Supabase real, migraciones SQL, RLS. Eso corresponde al change backend `C-05`, en otra sesión. Tampoco: presupuestos/autorizaciones (FE-4), historial de traslados (FE-5), validación de compatibilidad de vehículo (FE-5).

## Capabilities

### New Capabilities
- `paciente-contract`: contrato de datos del dominio Paciente — tipos TypeScript de `Paciente` y sus sub-estructuras (CUD, identificador de afiliado adaptable, direcciones ida/vuelta independientes, personas a cargo), la función pura de estado de vencimiento del CUD, la interfaz `PacienteRepository` y su implementación mock con persistencia en `localStorage` y latencia simulada.
- `paciente-ficha`: ficha completa del paciente — listado, detalle y alta/edición de datos personales, datos clínicos, accesorio de movilidad, obra social asignada con identificador de afiliado adaptable, CUD con alerta de vencimiento, teléfono alternativo, personas a cargo y flag de amparo judicial.
- `paciente-direcciones`: gestión de direcciones múltiples del paciente, con ida y vuelta modeladas como registros independientes (sin autocompletar la vuelta desde la ida).
- `paciente-documentos`: pestaña de documentación del paciente, reutilizando `DocumentChecklist` de FE-1, con los ítems filtrados por el checklist configurado en la obra social del paciente (FE-2).

### Modified Capabilities
<!-- Ninguna. Los contratos de FE-1 (documento) y FE-2 (obra-social, vehiculo) se CONSUMEN sin cambiar sus requisitos; no se modifican specs existentes. -->

## Impact

- **Código nuevo (frontend):**
  - `frontend/src/shared/types/paciente.ts` (tipos del dominio).
  - `frontend/src/shared/lib/pacientes/PacienteRepository.ts` (interfaz).
  - `frontend/src/shared/lib/pacientes/estadoCud.ts` (función pura de vencimiento del CUD, con test).
  - `frontend/src/shared/lib/mocks/mockPacienteRepository.ts` + `pacientesFixture.ts` (mock localStorage + fixture con formatos de afiliado distintos, con test).
  - `frontend/src/features/pacientes/*` (listado, detalle, formulario, editor de direcciones, editor de personas a cargo, pestaña de documentos, hook `usePacientes`).
- **Reutiliza (no recrea):** `AccesorioMovilidad` (`shared/types/vehiculo.ts`), `ChecklistItem`/`DocumentoAdjunto` (`shared/types/documento.ts`), `DocumentChecklist` + `useDocumentChecklist` + `mockDocumentoRepository` (FE-1), `ObraSocialRepository`/`mockObraSocialRepository` (FE-2) para resolver el checklist del paciente, `generateId` (`shared/lib/id.ts`), primitivos del design-system (`Section`, `Chip`, `Button`), patrón contrato→mock→hook→componente presentacional.
- **Habilita (aguas abajo):** FE-4 Presupuestos (paciente + obra social), FE-5 Hojas de Ruta (direcciones ida/vuelta + accesorio de movilidad), FE-6 Facturación (identificador de afiliado + amparo judicial para el plazo de cobro).
- **Sin impacto backend:** no crea tablas, RLS ni cliente Supabase. Cuando `C-05` backend se archive, se escribe `SupabasePacienteRepository` cumpliendo la misma interfaz y se inyecta sin tocar componentes (FE-8). El diseño de la UI NO asume acceso sin restricciones a datos sensibles (CUD, personas a cargo menores de edad): el CUD y las personas a cargo se ubican en secciones que podrán quedar gateadas por RLS/permiso en FE-8.
- **Preguntas abiertas de prioridad Alta que quedan mockeadas y configurables** (no bloquean, ver `10_preguntas_abiertas.md`): IN-01 (identificador de afiliado / identificador de factura por obra social) y CUIL/CUIT como campos separados (RN-ID-01). Se implementa con el default documentado y campo configurable, nunca hardcodeado.
