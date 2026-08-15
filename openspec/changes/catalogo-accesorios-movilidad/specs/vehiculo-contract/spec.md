# Delta for Vehiculo Contract

## MODIFIED Requirements

### Requirement: Tipos del dominio de flota

El sistema SHALL definir los tipos TypeScript del dominio de flota en `frontend/src/shared/types/vehiculo.ts`, en modo strict y sin usar `any`. MUST incluir la interfaz `Vehiculo` (id, patente, modelo, tipo, capacidad, `accesoriosCompatibles`, estado, kilometraje, kilometrajeUltimoService, fechaUltimoService, habilitaciones, gastos, **mantenimientos**) y las sub-estructuras `AccesorioMovilidad`, `GastoVehiculo`, `RegistroHabilitacion` y **`MantenimientoRegistro`** (`04_modelo_de_datos.md §Vehiculo`, `docs/core/Traslados-Modelo-Datos.docx` §Gastos de Vehículo y §Mantenimiento, RN-VE-01 a RN-VE-04).

`AccesorioMovilidad` MUST dejar de ser una unión cerrada de literales: pasa a ser `TipoAccesorio`, un `string` que toma sus valores del catálogo dinámico `shared/types/catalogoAccesorios.ts` (maestro `pacientes.accesorios`). El sistema MUST NOT exigir recompilar ni editar código para que un accesorio nuevo llegue al selector del vehículo.

`GastoVehiculo` MUST modelar el gasto como el docx lo define —fecha y monto, más una descripción opcional en texto libre— y MUST NOT tener ningún campo de categoría o clasificación estructurada. Los valores `'mantenimiento' | 'reparacion' | 'service'` del tipo `CategoriaGasto` no existían en ninguna fuente del proyecto y quedan eliminados.

`MantenimientoRegistro` MUST modelar la entidad Mantenimiento del docx: tipo de intervención (nivel 1), sub-tipo (nivel 2, solo dentro de las categorías de mantenimiento), fecha, kilometraje del vehículo al momento de la intervención y próximo vencimiento opcional por fecha y por kilometraje. MUST NOT tener monto — el importe pertenece a `GastoVehiculo`.

La clasificación de dos niveles MUST estar tipada sin `string` libre: el nivel 1 como unión cerrada de los tres valores del docx, el nivel 2 de preventivo como unión cerrada, y el nivel 2 de correctivo como catálogo extensible mediante un valor de escape que exige un detalle en texto libre. La invariante "el valor de escape exige detalle" y la invariante "un registro de nivel 1 `gasto` no tiene sub-tipo" MUST quedar garantizadas por el sistema de tipos (unión discriminada), no solo por una validación en tiempo de ejecución.
(Previously: `AccesorioMovilidad` era una unión cerrada de 5 literales fija en el código y el escenario de accesorios exigía "conjunto cerrado tipado".)

#### Scenario: Accesorios de movilidad como valores del catálogo dinámico

- WHEN se declara el campo `accesoriosCompatibles` de un vehículo
- THEN su tipo es `TipoAccesorio[]` (`string` del catálogo dinámico)
- AND no es una unión de literales fija en TS: un valor nuevo del maestro es válido sin tocar tipos

#### Scenario: Capacidad acotada del vehículo

- WHEN se modela la capacidad de un vehículo
- THEN el tipo representa una capacidad de hasta 6 pasajeros (RF-500) y no admite valores negativos

#### Scenario: Gasto sin categoría estructurada

- WHEN se declara el tipo `GastoVehiculo`
- THEN sus campos son id, fecha, monto y descripción opcional, y no existe ningún campo de categoría ni el tipo `CategoriaGasto`

#### Scenario: Historial de mantenimiento embebido en el vehículo

- WHEN se declara la interfaz `Vehiculo`
- THEN incluye `mantenimientos: MantenimientoRegistro[]`, leído y mutado junto con el vehículo vía `VehiculoRepository.update()`, sin un repository propio

#### Scenario: Detalle obligatorio del sub-tipo de escape verificado por el compilador

- WHEN se intenta construir en código un registro correctivo con el sub-tipo de escape y sin detalle
- THEN el chequeo de tipos falla, sin necesidad de ejecutar ninguna validación

#### Scenario: Un registro de tipo "gasto" no admite sub-tipo

- WHEN se intenta construir en código un registro con tipo de intervención "gasto" y un sub-tipo cualquiera
- THEN el chequeo de tipos falla

#### Scenario: Registro de mantenimiento sin monto

- WHEN se declara el tipo `MantenimientoRegistro`
- THEN no tiene ningún campo de monto o importe