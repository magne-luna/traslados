## MODIFIED Requirements

### Requirement: Interfaces FacturaRepository y CobroRepository
El sistema SHALL definir las interfaces `FacturaRepository` (`list()`, `getById(id)`, `listByPaciente(pacienteId)`, `create(data)`, `update(id, data)`) y `CobroRepository` (`list()`, `listByFactura(facturaId)`, `create(data)`, `remove(id)`) en `frontend/src/shared/lib/facturacion/`, de modo que ninguna pantalla hable con la fuente de datos directamente. Las `AsistenciaPrestacion` viven embebidas en la `Factura` (agregado); los `Cobro` son entidad propia con repository propio.

`CobroRepository.list()` MUST devolver todos los cobros del sistema en una sola lectura, para que las agregaciones por período (`C-11`) se calculen sin hacer una llamada por factura. La adición MUST ser puramente aditiva: `listByFactura`, `create` y `remove` conservan su firma y su comportamiento, y ninguna pantalla existente de facturación cambia.

#### Scenario: getById de un registro inexistente
- **WHEN** se invoca `getById(id)` con un valor que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Edición de asistencias como mutación del agregado
- **WHEN** se agrega, quita o edita una `AsistenciaPrestacion`
- **THEN** el cambio se persiste vía `FacturaRepository.update(id, data)` sobre la `Factura` completa, sin requerir un repository de asistencias aparte

#### Scenario: Cobros consultables por factura
- **WHEN** se invoca `CobroRepository.listByFactura(facturaId)`
- **THEN** devuelve solo los cobros de esa factura, sin requerir listar todos los cobros del sistema

#### Scenario: Lectura de todos los cobros para agregación por período
- **WHEN** se invoca `CobroRepository.list()`
- **THEN** devuelve todos los cobros persistidos, de todas las facturas, en una sola llamada, de modo que un reporte por período no necesite invocar `listByFactura` una vez por factura

#### Scenario: Sin cobros registrados
- **WHEN** se invoca `CobroRepository.list()` y no hay ningún cobro persistido
- **THEN** resuelve un array vacío, nunca `null` ni un error

#### Scenario: Coherencia entre list y listByFactura
- **WHEN** se comparan los resultados de `list()` y de `listByFactura(facturaId)` para una factura existente
- **THEN** los cobros que `listByFactura` devuelve son exactamente los elementos de `list()` cuyo `facturaId` coincide, sin diferencias de contenido ni de cantidad
