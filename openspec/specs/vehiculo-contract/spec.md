## ADDED Requirements

### Requirement: Tipos del dominio de flota
El sistema SHALL definir los tipos TypeScript del dominio de flota en `frontend/src/shared/types/vehiculo.ts`, en modo strict y sin usar `any`. MUST incluir la interfaz `Vehiculo` (id, patente, modelo, tipo, capacidad, `accesoriosCompatibles`, estado, kilometraje, kilometrajeUltimoService, fechaUltimoService, habilitaciones, gastos, **mantenimientos**) y las sub-estructuras `AccesorioMovilidad` (unión de literales), `GastoVehiculo`, `RegistroHabilitacion` y **`MantenimientoRegistro`** (`04_modelo_de_datos.md §Vehiculo`, `docs/core/Traslados-Modelo-Datos.docx` §Gastos de Vehículo y §Mantenimiento, RN-VE-01 a RN-VE-04).

`GastoVehiculo` MUST modelar el gasto como el docx lo define —fecha y monto, más una descripción opcional en texto libre— y MUST NOT tener ningún campo de categoría o clasificación estructurada. Los valores `'mantenimiento' | 'reparacion' | 'service'` del tipo `CategoriaGasto` no existían en ninguna fuente del proyecto y quedan eliminados.

`MantenimientoRegistro` MUST modelar la entidad Mantenimiento del docx: tipo de intervención (nivel 1), sub-tipo (nivel 2, solo dentro de las categorías de mantenimiento), fecha, kilometraje del vehículo al momento de la intervención y próximo vencimiento opcional por fecha y por kilometraje. MUST NOT tener monto — el importe pertenece a `GastoVehiculo`.

La clasificación de dos niveles MUST estar tipada sin `string` libre: el nivel 1 como unión cerrada de los tres valores del docx, el nivel 2 de preventivo como unión cerrada, y el nivel 2 de correctivo como catálogo extensible mediante un valor de escape que exige un detalle en texto libre. La invariante "el valor de escape exige detalle" y la invariante "un registro de nivel 1 `gasto` no tiene sub-tipo" MUST quedar garantizadas por el sistema de tipos (unión discriminada), no solo por una validación en tiempo de ejecución.

#### Scenario: Accesorios de movilidad como conjunto cerrado tipado
- **WHEN** se declara el campo `accesoriosCompatibles` de un vehículo
- **THEN** su tipo es `AccesorioMovilidad[]`, donde `AccesorioMovilidad` es una unión de literales (silla plegable, silla rígida, silla postural, andador, trípode) y no `string` libre

#### Scenario: Capacidad acotada del vehículo
- **WHEN** se modela la capacidad de un vehículo
- **THEN** el tipo representa una capacidad de hasta 6 pasajeros (RF-500) y no admite valores negativos

#### Scenario: Gasto sin categoría estructurada
- **WHEN** se declara el tipo `GastoVehiculo`
- **THEN** sus campos son id, fecha, monto y descripción opcional, y no existe ningún campo de categoría ni el tipo `CategoriaGasto`

#### Scenario: Historial de mantenimiento embebido en el vehículo
- **WHEN** se declara la interfaz `Vehiculo`
- **THEN** incluye `mantenimientos: MantenimientoRegistro[]`, leído y mutado junto con el vehículo vía `VehiculoRepository.update()`, sin un repository propio

#### Scenario: Detalle obligatorio del sub-tipo de escape verificado por el compilador
- **WHEN** se intenta construir en código un registro correctivo con el sub-tipo de escape y sin detalle
- **THEN** el chequeo de tipos falla, sin necesidad de ejecutar ninguna validación

#### Scenario: Un registro de tipo "gasto" no admite sub-tipo
- **WHEN** se intenta construir en código un registro con tipo de intervención "gasto" y un sub-tipo cualquiera
- **THEN** el chequeo de tipos falla

#### Scenario: Registro de mantenimiento sin monto
- **WHEN** se declara el tipo `MantenimientoRegistro`
- **THEN** no tiene ningún campo de monto o importe

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

El `schemaVersion` MUST subir cada vez que la forma de `Vehiculo` o de sus sub-estructuras cambie de manera incompatible con el payload ya guardado, y el mismatch MUST resolverse re-sembrando el fixture, nunca migrando el payload viejo: es un mock, no hay dato de producción que preservar. El motivo de cada bump MUST quedar documentado junto a la constante.

#### Scenario: Siembra del fixture inicial
- **WHEN** no hay datos de vehículos en `localStorage`
- **THEN** el mock siembra un fixture con 2-3 vehículos de ejemplo (con accesorios, kilometraje, habilitaciones y registros de mantenimiento que cubran casos de alerta y los tres tipos de intervención) y lo persiste

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza un vehículo y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

#### Scenario: Payload con gastos del esquema anterior
- **WHEN** el `localStorage` contiene gastos con el campo de categoría que este cambio elimina
- **THEN** el `schemaVersion` guardado no coincide con el esperado y el mock re-siembra el fixture, sin intentar migrar los gastos viejos
