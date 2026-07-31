## MODIFIED Requirements

### Requirement: Implementación mock con persistencia en localStorage
El sistema SHALL proveer una implementación mock de `VehiculoRepository` en `frontend/src/shared/lib/mocks/mockVehiculoRepository.ts` que cumpla la interfaz al pie de la letra, persista en `localStorage` con un `schemaVersion` y devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales.

El `schemaVersion` MUST subir cada vez que la forma de `Vehiculo` o de sus sub-estructuras cambie de manera incompatible con el payload ya guardado, y el mismatch MUST resolverse re-sembrando el fixture, nunca migrando el payload viejo: es un mock, no hay dato de producción que preservar. El motivo de cada bump MUST quedar documentado junto a la constante.

El mock SHALL seguir existiendo como doble de test y como implementación de respaldo para desarrollo sin backend, pero a partir de este cambio MUST NOT ser la implementación inyectada por el punto de composición de la aplicación (`VehiculosRoute.tsx`). El mock MUST mantener la misma semántica de error que `SupabaseVehiculoRepository` — `getById` resuelve `null` en vez de lanzar, `update` de un id inexistente rechaza con `Error` — porque a partir de acá las dos implementaciones conviven, y cualquier divergencia de comportamiento entre ellas se vuelve invisible hasta el día en que alguien cambie de una a la otra.

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
- **WHEN** el `localStorage` contiene gastos con el campo de categoría que un cambio anterior eliminó
- **THEN** el `schemaVersion` guardado no coincide con el esperado y el mock re-siembra el fixture, sin intentar migrar los gastos viejos

#### Scenario: SCHEMA_VERSION sube de 3 a 4 por el campo notas
- **WHEN** se agrega `Vehiculo.notas?: string` al tipo del dominio
- **THEN** `SCHEMA_VERSION` del mock pasa de `3` a `4`
- **AND** el motivo del bump queda documentado junto a la constante

#### Scenario: El mock ya no es la implementación de la aplicación
- **WHEN** se inspecciona el punto de composición de la feature (`VehiculosRoute.tsx`)
- **THEN** inyecta `SupabaseVehiculoRepository`
- **AND** el mock solo aparece en tests y en configuraciones explícitas de desarrollo sin backend

#### Scenario: Misma semántica de error que la implementación real
- **GIVEN** `mockVehiculoRepository` y `SupabaseVehiculoRepository` conviviendo en el repo
- **WHEN** cualquiera de las dos ejecuta `getById` con un id inexistente o `update` con un id inexistente
- **THEN** ambas resuelven `null` en el primer caso y rechazan con `Error` en el segundo, con el mismo comportamiento observable desde `useVehiculos`

### Requirement: Interfaz VehiculoRepository
El sistema SHALL definir la interfaz `VehiculoRepository` en `frontend/src/shared/lib/vehiculos/VehiculoRepository.ts` con las operaciones `list()`, `getById(id)`, `create(data)` y `update(id, data)`, de modo que ninguna pantalla hable con la fuente de datos directamente.

El contrato de error SHALL ser normativo y común a toda implementación: los métodos rechazan con una instancia de `Error` cuyo `message` es texto en castellano apto para mostrarse al usuario tal cual, porque `useVehiculos` lo renderiza sin transformarlo (`toErrorMessage`). Ninguna implementación MUST introducir un tipo de error propio, un objeto de resultado `{ ok, error }` ni un cambio de firma. A partir de este cambio, con dos implementaciones activas (mock y real) que conviven en el mismo repo, este contrato es lo único que garantiza que se puedan intercambiar sin tocar los hooks ni los componentes.

#### Scenario: getById de un vehículo inexistente
- **WHEN** se invoca `getById(id)` con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Tipos de entrada sin id
- **WHEN** se invoca `create(data)`
- **THEN** el tipo del payload (`NuevoVehiculo`) no incluye `id`, y el `id` lo asigna la implementación del repository

#### Scenario: Toda implementación rechaza con Error y mensaje mostrable
- **WHEN** cualquier implementación de `VehiculoRepository` falla en `list`, `create` o `update`
- **THEN** la promesa rechaza con una instancia de `Error`
- **AND** su `message` está en castellano y puede mostrarse al usuario sin post-procesamiento

#### Scenario: Agregar una implementación no cambia la interfaz
- **WHEN** se suma una implementación nueva (por ejemplo, contra Supabase)
- **THEN** `VehiculoRepository.ts` y `shared/types/vehiculo.ts` quedan sin modificar por esa implementación
- **AND** solo cambia el archivo que elige qué implementación inyectar

### Requirement: Tipos del dominio de flota
El sistema SHALL definir los tipos TypeScript del dominio de flota en `frontend/src/shared/types/vehiculo.ts`, en modo strict y sin usar `any`. MUST incluir la interfaz `Vehiculo` (id, patente, modelo, tipo, capacidad, `accesoriosCompatibles`, estado, kilometraje, kilometrajeUltimoService, fechaUltimoService, habilitaciones, gastos, mantenimientos, **notas**) y las sub-estructuras `AccesorioMovilidad` (unión de literales), `GastoVehiculo`, `RegistroHabilitacion` y `MantenimientoRegistro` (`04_modelo_de_datos.md §Vehiculo`, `docs/core/Traslados-Modelo-Datos.docx` §Gastos de Vehículo y §Mantenimiento, RN-VE-01 a RN-VE-04).

`Vehiculo.notas` MUST ser un campo `string` opcional (`notas?: string`), porque la columna real `conductores.vehiculo.notas` existe en la base desde antes de este change y hoy nace `NULL` para siempre al no tener contraparte en el frontend (discrepancia ya registrada en `CHANGES.md` §C-08, que este change resuelve sumando el campo).

`Vehiculo.habilitaciones` MUST conservar su tipo `RegistroHabilitacion[]`, pero a partir de este cambio SHALL ser un **campo derivado**: se calcula a partir del historial de mantenimiento del propio vehículo y MUST NOT persistirse como colección propia en ninguna implementación del repository (decisión D3, opción B: el docx rastrea el vencimiento *vía mantenimiento*, y una colección persistida aparte duplicaría el mismo vencimiento en dos lugares sin nada que los sincronice). La derivación MUST vivir en una función pura compartida por todas las implementaciones —mock y real—, para que las dos muestren lo mismo en la misma pantalla. Toda implementación MUST ignorar la clave `habilitaciones` en los payloads de escritura (`NuevoVehiculo` / `ActualizacionVehiculo`) en vez de fallar: es un campo de salida.

La regla de derivación MUST ser: para cada tipo (`'vtv'` y `'rto'`, evaluados de forma independiente entre sí por RN-VE-04), se considera únicamente el registro de mantenimiento preventivo de ese sub-tipo **con próximo vencimiento por fecha informado** y de fecha más reciente, con desempate determinista por `id`; su fecha pasa a `fechaEmision` y su próximo vencimiento a `fechaVencimiento`. Un tipo sin ningún registro que cumpla esas condiciones MUST NOT producir una `RegistroHabilitacion` con fechas inventadas: simplemente no se emite.

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

#### Scenario: Vehiculo.notas es opcional y viaja con el resto de la ficha
- **WHEN** se declara la interfaz `Vehiculo`
- **THEN** incluye `notas?: string`
- **AND** el campo se lee y se escribe junto con el resto del vehículo vía `VehiculoRepository`, sin un repository ni un método propio

#### Scenario: Las habilitaciones se derivan del historial, no se persisten
- **GIVEN** un vehículo cuyo historial tiene una intervención preventiva de sub-tipo VTV con próximo vencimiento por fecha
- **WHEN** se lee el vehículo con cualquier implementación de `VehiculoRepository`
- **THEN** `habilitaciones` incluye una `RegistroHabilitacion` de tipo VTV cuya `fechaEmision` es la fecha de esa intervención y cuya `fechaVencimiento` es su próximo vencimiento
- **AND** no existe ninguna colección de habilitaciones almacenada aparte del historial

#### Scenario: Entre varias habilitaciones del mismo tipo gana la más reciente
- **GIVEN** un vehículo con tres intervenciones preventivas de sub-tipo VTV, de fechas distintas, todas con próximo vencimiento
- **WHEN** se lee el vehículo
- **THEN** `habilitaciones` contiene una sola entrada de tipo VTV, la derivada de la intervención de fecha más reciente
- **AND** dos lecturas consecutivas de los mismos datos eligen la misma, incluso si dos intervenciones comparten fecha (desempate por `id`)

#### Scenario: Una intervención VTV sin próximo vencimiento no produce habilitación
- **GIVEN** un vehículo cuya única intervención de sub-tipo VTV no tiene próximo vencimiento por fecha
- **WHEN** se lee el vehículo
- **THEN** `habilitaciones` no incluye ninguna entrada de tipo VTV
- **AND** NO se inventa ninguna fecha de vencimiento para poder mostrarla

#### Scenario: VTV y RTO se derivan de forma independiente
- **GIVEN** un vehículo con una intervención de sub-tipo VTV con vencimiento y ninguna de sub-tipo RTO
- **WHEN** se lee el vehículo
- **THEN** `habilitaciones` incluye la VTV y no incluye la RTO, sin que la ausencia de una afecte a la otra (RN-VE-04)

#### Scenario: El payload de escritura ignora habilitaciones
- **WHEN** se invoca `create(data)` o `update(id, data)` con una clave `habilitaciones` en el payload
- **THEN** la implementación la ignora y no intenta persistirla
- **AND** la operación no falla por ese motivo, porque es un campo de salida y no de entrada

#### Scenario: El fixture del mock es coherente con la derivación
- **GIVEN** el fixture del mock con un vehículo que muestra una habilitación VTV
- **WHEN** se inspecciona su historial de mantenimiento
- **THEN** contiene la intervención preventiva de sub-tipo VTV con el próximo vencimiento del que esa habilitación se deriva
- **AND** el mock y la implementación real muestran la misma habilitación para los mismos datos

## ADDED Requirements

### Requirement: Una única implementación activa elegida en el punto de composición
El sistema SHALL concentrar en un solo archivo por feature (`VehiculosRoute.tsx`) la decisión de qué implementación de `VehiculoRepository` usa la aplicación. Ese archivo MUST ser el único de `features/vehiculos/` que importa una implementación concreta; el resto de la feature MUST conocer únicamente la interfaz. Cambiar de implementación (mock ↔ Supabase) MUST ser posible modificando solo ese archivo, sin tocar componentes, hooks ni contexts.

#### Scenario: Cambiar de implementación es un cambio de una línea
- **WHEN** se reemplaza la implementación inyectada
- **THEN** el diff se limita al composition root
- **AND** ningún componente ni test de comportamiento de la feature necesita reescribirse

#### Scenario: Rollback inmediato al mock
- **WHEN** la implementación real presenta un problema en producción
- **THEN** revertir el composition root al mock restaura la aplicación
- **AND** los archivos de la implementación real quedan inertes porque nadie más los importa

#### Scenario: El selector de vehículo de Conductores sigue leyendo de la misma interfaz
- **WHEN** `ConductoresRoute.tsx` monta el provider de `VehiculoRepository` de solo lectura para el selector de la asignación semanal
- **THEN** consume la misma interfaz `VehiculoRepository`, sin conocer si la implementación activa es el mock o `SupabaseVehiculoRepository`
- **AND** un cambio de implementación en `VehiculosRoute.tsx` se refleja automáticamente en el selector de Conductores sin tocar `ConductoresRoute.tsx`
