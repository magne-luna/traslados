## ADDED Requirements

### Requirement: Tipos del dominio de conductores
El sistema SHALL definir los tipos TypeScript del dominio de conductores en `frontend/src/shared/types/conductor.ts`, en modo strict y sin usar `any`. MUST incluir la interfaz `Conductor` (id, apellido, nombre, documento, teléfono opcional, fecha de nacimiento opcional, `restricciones`, `observaciones` opcional, `asignaciones`) y las sub-estructuras `RestriccionConductor` (unión de literales) y `AsignacionSemanal` (`04_modelo_de_datos.md §Conductor`, US-600, RN-GL-03).

#### Scenario: Restricciones de perfil como conjunto cerrado tipado
- **WHEN** se declara el campo `restricciones` de un conductor
- **THEN** su tipo es `RestriccionConductor[]`, donde `RestriccionConductor` es una unión de literales (incluye al menos `'no-carga-fisica'`, documentado en `04_modelo_de_datos.md §Conductor`) y no `string` libre

#### Scenario: El conductor no modela credenciales de acceso
- **WHEN** se define la interfaz `Conductor`
- **THEN** no incluye ningún campo de credencial, sesión, rol de acceso ni referencia a usuario de auth (RN-GL-03): es solo un registro de datos administrativos

#### Scenario: Asignación semanal referencia al vehículo por id
- **WHEN** se declara una `AsignacionSemanal`
- **THEN** contiene `vehiculoId: string` y `semana: string` (etiqueta ISO de semana), y NO embebe el objeto `Vehiculo` completo

### Requirement: Interfaz ConductorRepository
El sistema SHALL definir la interfaz `ConductorRepository` en `frontend/src/shared/lib/conductores/ConductorRepository.ts` con las operaciones `list()`, `getById(id)`, `create(data)` y `update(id, data)`, de modo que ninguna pantalla hable con la fuente de datos directamente.

#### Scenario: getById de un conductor inexistente
- **WHEN** se invoca `getById(id)` con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Tipos de entrada sin id
- **WHEN** se invoca `create(data)`
- **THEN** el tipo del payload (`NuevoConductor`) no incluye `id`, y el `id` lo asigna la implementación del repository

### Requirement: Implementación mock con persistencia en localStorage
El sistema SHALL proveer una implementación mock de `ConductorRepository` en `frontend/src/shared/lib/mocks/mockConductorRepository.ts` que cumpla la interfaz al pie de la letra, persista en `localStorage` con un `schemaVersion` y devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales.

#### Scenario: Siembra del fixture inicial
- **WHEN** no hay datos de conductores en `localStorage`
- **THEN** el mock siembra un fixture con 2-3 conductores de ejemplo (al menos uno con una restricción de perfil y uno con una asignación semanal a un vehículo del fixture de flota) y lo persiste

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza un conductor y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización
