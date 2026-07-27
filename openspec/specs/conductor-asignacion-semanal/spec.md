## ADDED Requirements

### Requirement: Asignación semanal de conductor a vehículo
El sistema SHALL permitir asignar a un conductor un vehículo por semana, representando cada asignación como `AsignacionSemanal` (`vehiculoId` + `semana` como etiqueta ISO `YYYY-Www`) embebida en el conductor, y presentando las asignaciones como una tabla por semana. Las mutaciones se persisten vía `ConductorRepository.update`.

#### Scenario: Alta de una asignación semanal
- **WHEN** la administradora elige un vehículo y una semana para un conductor y confirma
- **THEN** se agrega una `AsignacionSemanal` al conductor y se persiste vía `update`, apareciendo en la tabla de asignaciones por semana

#### Scenario: Semana por defecto derivada del presente
- **WHEN** se abre el alta de asignación sin especificar semana
- **THEN** una función pura deriva la etiqueta ISO de la semana actual a partir de una fecha de referencia recibida como parámetro (no un `new Date()` incrustado que impida testear)

### Requirement: Selector de vehículo alimentado por VehiculoRepository
El sistema SHALL poblar el selector de vehículo de la asignación con la lista provista por `VehiculoRepository` (inyectado por su context), guardando únicamente el `vehiculoId`. El contrato de conductores MUST NOT modificar `VehiculoRepository` ni embeber el objeto `Vehiculo`.

#### Scenario: El selector ofrece los vehículos del repository de flota
- **WHEN** se abre el selector de vehículo de una asignación
- **THEN** las opciones provienen de `VehiculoRepository.list()`, y al elegir uno se guarda su `vehiculoId` (string), no el objeto completo

### Requirement: Validación de colisión de asignación semanal
El sistema SHALL validar, mediante una función pura, que un conductor no quede asignado a dos vehículos distintos en la misma semana, salvo que se permita explícitamente (test de `C-09`, RN de asignación semanal).

#### Scenario: Colisión bloqueada por defecto
- **WHEN** un conductor ya tiene una asignación a un vehículo en la semana `S` y se intenta asignarle un vehículo distinto en la misma semana `S` sin habilitar la excepción
- **THEN** la función pura devuelve un error de colisión y la UI bloquea el guardado

#### Scenario: Reasignación al mismo vehículo no es colisión
- **WHEN** se vuelve a asignar el mismo vehículo al conductor en una semana en la que ya lo tenía
- **THEN** no se reporta colisión (es idempotente / edición), no se duplica la asignación

#### Scenario: Excepción explícita permitida
- **WHEN** se habilita explícitamente la asignación múltiple (`permitirMultiple`) para un conductor en una semana
- **THEN** la función pura permite la segunda asignación en esa semana sin reportar colisión
