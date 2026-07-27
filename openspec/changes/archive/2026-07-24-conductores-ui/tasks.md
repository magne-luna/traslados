## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/conductor.ts` con `RestriccionConductor` (unión de literales, incluyendo al menos `'no-carga-fisica'`, documentado en `04_modelo_de_datos.md §Conductor`). Sin `any`.
- [x] 1.2 Definir `AsignacionSemanal` (`{ id: string; vehiculoId: string; semana: string /* ISO 'YYYY-Www' */ }`), referenciando el vehículo por id (no embeber el objeto `Vehiculo`).
- [x] 1.3 Definir la interfaz `Conductor` (id, apellido, nombre, documento, `telefono?`, `fechaNacimiento?`, `restricciones: RestriccionConductor[]`, `observaciones?`, `asignaciones: AsignacionSemanal[]`), sin ningún campo de credencial/sesión/rol de acceso (RN-GL-03), reutilizando conceptos del ERD (`04_modelo_de_datos.md §Conductor`).
- [x] 1.4 Definir tipos de entrada `NuevoConductor` / `ActualizacionConductor` (payloads de create/update sin `id`).

## 2. Funciones puras de asignación semanal

- [x] 2.1 Implementar función pura `semanaActualIso(ahora: Date)` → etiqueta ISO `YYYY-Www` (ISO-8601, lunes inicio de semana), recibiendo la fecha de referencia como parámetro (testeable con valores fijos).
- [x] 2.2 Implementar función pura `validarAsignacionSemanal({ asignaciones, semana, vehiculoId, permitirMultiple })` → ok / error de colisión: error si ya existe una asignación a **otro** vehículo en la misma semana y `permitirMultiple` es `false`; reasignar el **mismo** vehículo no es colisión; `permitirMultiple` habilita la excepción (test de `C-09`).

## 3. Repository e implementación mock

- [x] 3.1 Crear `frontend/src/shared/lib/conductores/ConductorRepository.ts` con la interfaz: `list()`, `getById(id)` (resuelve `null` si no existe), `create(data)`, `update(id, data)`.
- [x] 3.2 Crear el fixture inicial (`frontend/src/shared/lib/mocks/conductoresFixture.ts`) con 2-3 conductores: al menos uno con una restricción de perfil y uno con una `AsignacionSemanal` a un `vehiculoId` que exista en `vehiculosFixture` (o sin asignación), según `04_modelo_de_datos.md §Conductor`.
- [x] 3.3 Crear `frontend/src/shared/lib/mocks/mockConductorRepository.ts` que cumpla la interfaz, persista en `localStorage` (clave `conductores`, con `schemaVersion`), siembre el fixture cuando no hay datos y devuelva promesas con latencia simulada (patrón `mockVehiculoRepository`).
- [x] 3.4 Manejar mismatch de `schemaVersion` / payload corrupto: re-sembrar desde fixture en vez de romper la deserialización.

## 4. Hook y punto de inyección

- [x] 4.1 Crear un hook `useConductores(repository)` que exponga `conductores`, `loading`, `error`, `crear()`, `actualizar()` y recargue tras cada mutación (patrón `useVehiculos`).
- [x] 4.2 Crear `ConductorRepositoryContext` (provider + hook de consumo) para inyectar el repository, de modo que ninguna pantalla importe el mock directamente (patrón `VehiculoRepositoryContext`).

## 5. Pantalla CRUD

- [x] 5.1 Crear `frontend/src/features/conductores/ConductoresList.tsx`: listado con estados de carga/vacío/error, fila clickeable que abre el detalle y botón "Editar" con `stopPropagation` (patrón Vehículos, `08_arquitectura_propuesta.md`).
- [x] 5.2 Crear el formulario de alta/edición (`ConductorForm.tsx`) con apellido, nombre, documento, teléfono y fecha de nacimiento opcionales. Sin ningún campo de acceso/credencial (RN-GL-03).
- [x] 5.3 Crear la función pura de validación (`validateConductorForm`) que exija apellido, nombre y documento, y conectarla al form bloqueando el guardado y señalando faltantes.
- [x] 5.4 Implementar el selector de restricciones de perfil (multi-selección sobre el conjunto cerrado `RestriccionConductor`) más el campo libre `observaciones`, integrados al form.
- [x] 5.5 Conectar create/update al hook y manejar el error del repository (mensaje visible, sin loading infinito).
- [x] 5.6 Crear `ConductorDetail.tsx` que muestre datos personales, restricciones y observaciones del conductor seleccionado.

## 6. Asignación semanal a vehículo

- [x] 6.1 Crear `AsignacionSemanalTabla.tsx`: tabla de asignaciones del conductor por semana (semana + vehículo), con estado vacío cuando no hay asignaciones.
- [x] 6.2 Implementar el selector de vehículo poblado desde `VehiculoRepository.list()` (inyectado por `VehiculoRepositoryContext`), guardando solo `vehiculoId`; mostrar patente/modelo del vehículo resolviéndolo contra la lista de flota.
- [x] 6.3 Conectar el alta de asignación a `validarAsignacionSemanal` (sección 2): bloquear el guardado ante colisión mostrando el mensaje, permitir la excepción explícita, y persistir la asignación vía `ConductorRepository.update`.

## 7. Documentos del conductor

- [x] 7.1 Definir la lista fija de ítems documentales del conductor (licencia de conducir —requerido—, DNI, apto médico) como `ChecklistItem[]`, reutilizando el tipo de `shared/types/documento.ts` (sin modelo paralelo).
- [x] 7.2 Crear `ConductorDocumentos.tsx` reutilizando el renderer `DocumentChecklist` de FE-1 con `EntidadDocumental = 'conductor'` y el `DocumentoRepository` mock existente.

## 8. Integración y verificación

- [x] 8.1 Montar la feature de conductores reemplazando el `element` de la ruta `/conductores` en `frontend/src/app/router.tsx`, inyectando `mockConductorRepository` y `mockVehiculoRepository` vía sus contexts (sin tocar `routes.ts`).
- [x] 8.2 Verificar `tsc --noEmit` sin errores y `oxlint` limpio (sin `any`, imports usados, sin `style={{}}` inline — solo clases utilitarias de Tailwind v4).
- [ ] 8.3 Verificar manualmente el flujo en `npm run dev`: crear conductor → marcar restricción de perfil → asignar un vehículo a una semana → intentar colisión (otro vehículo misma semana) y ver el bloqueo → ver checklist documental → recargar y confirmar persistencia en localStorage.

## 9. Cartelitos de "pendiente de confirmar" (Decisión 10 de `design.md`)

- [x] 9.1 En el selector de restricciones de perfil (`ConductorForm.tsx`): cartel `⚠️ Pendiente de confirmar con el cliente: catálogo cerrado de restricciones` junto al selector, reutilizando `Chip kind="warning"` / clases ámbar del design system.
- [x] 9.2 En `AsignacionSemanalTabla.tsx`, cerca de la opción/override `permitirMultiple`: cartel `⚠️ Pendiente de confirmar con el cliente: si un conductor puede tener dos vehículos la misma semana (excepción explícita)`.
- [x] 9.3 En `ConductorForm.tsx`, cerca de los campos opcionales del alta: cartel `⚠️ Pendiente de confirmar con el cliente: datos personales mínimos obligatorios del alta`.
- [x] 9.4 En `ConductorDocumentos.tsx`, sobre el checklist: cartel `⚠️ Pendiente de confirmar con el cliente: documentos a precargar (licencia/DNI/apto médico)`.
- [x] 9.5 Agregar en `CHANGES.md`, dentro del scope de `C-09 conductores`, una línea `⚠️ Discrepancia/pendiente de UI` resumiendo las 4 open questions de arriba + la de nombres de campo (interna, sin cartel en UI), para que quien implemente el backend las vea al leer su scope (mismo criterio ya aplicado en C-02/04/07/08/10).
