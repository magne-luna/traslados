## ADDED Requirements

### Requirement: Tipos del dominio de flota
El sistema SHALL definir los tipos TypeScript del dominio de flota en `frontend/src/shared/types/vehiculo.ts`, en modo strict y sin usar `any`. MUST incluir la interfaz `Vehiculo` (id, patente, modelo, tipo, capacidad, `accesoriosCompatibles`, estado, kilometraje, kilometrajeUltimoService, fechaUltimoService, habilitaciones, gastos) y las sub-estructuras `AccesorioMovilidad` (unión de literales), `GastoVehiculo` y `RegistroHabilitacion` (`04_modelo_de_datos.md §Vehiculo`, RN-VE-01 a RN-VE-04).

#### Scenario: Accesorios de movilidad como conjunto cerrado tipado
- **WHEN** se declara el campo `accesoriosCompatibles` de un vehículo
- **THEN** su tipo es `AccesorioMovilidad[]`, donde `AccesorioMovilidad` es una unión de literales (silla plegable, silla rígida, silla postural, andador, trípode) y no `string` libre

#### Scenario: Capacidad acotada del vehículo
- **WHEN** se modela la capacidad de un vehículo
- **THEN** el tipo representa una capacidad de hasta 6 pasajeros (RF-500) y no admite valores negativos

### Requirement: Interfaz VehiculoRepository
El sistema SHALL definir la interfaz `VehiculoRepository` en `frontend/src/shared/lib/vehiculos/VehiculoRepository.ts` con las operaciones `list()`, `getById(id)`, `create(data)` y `update(id, data)`, de modo que ninguna pantalla hable con la fuente de datos directamente.

#### Scenario: getById de un vehículo inexistente
- **WHEN** se invoca `getById(id)` con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Tipos de entrada sin id
- **WHEN** se invoca `create(data)`
- **THEN** el tipo del payload (`NuevoVehiculo`) no incluye `id`, y el `id` lo asigna la implementación del repository

### Requirement: Implementación mock con persistencia en localStorage
El sistema SHALL proveer una implementación mock de `VehiculoRepository` en `frontend/src/shared/lib/mocks/mockVehiculoRepository.ts` que cumpla la interfaz al pie de la letra, persista en `localStorage` con un `schemaVersion` y devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales.

#### Scenario: Siembra del fixture inicial
- **WHEN** no hay datos de vehículos en `localStorage`
- **THEN** el mock siembra un fixture con 2-3 vehículos de ejemplo (con accesorios, kilometraje y habilitaciones que cubran casos de alerta) y lo persiste

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza un vehículo y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización
