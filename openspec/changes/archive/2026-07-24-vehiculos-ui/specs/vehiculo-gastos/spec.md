## ADDED Requirements

### Requirement: Registro de gastos del vehículo
El sistema SHALL permitir registrar gastos de un vehículo como eventos con fecha y monto, sin frecuencia fija (US-500, RF-508). Cada gasto MUST persistirse asociado a su vehículo vía `VehiculoRepository.update()`.

#### Scenario: Alta de un gasto
- **WHEN** el usuario ingresa la fecha y el monto de un gasto y confirma
- **THEN** el gasto se agrega a la lista de gastos del vehículo y se persiste

#### Scenario: Validación de monto
- **WHEN** el usuario intenta registrar un gasto con monto vacío o no positivo
- **THEN** el formulario bloquea el registro y señala el campo inválido

### Requirement: Listado de gastos por vehículo
El sistema SHALL mostrar la tabla de gastos de un vehículo con fecha y monto de cada evento, obtenida del vehículo cargado.

#### Scenario: Tabla de gastos poblada
- **WHEN** el vehículo tiene gastos registrados
- **THEN** se muestran en una tabla con fecha y monto por fila

#### Scenario: Sin gastos registrados
- **WHEN** el vehículo no tiene gastos
- **THEN** se muestra un estado vacío indicando que aún no hay gastos registrados
