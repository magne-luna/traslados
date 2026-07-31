## MODIFIED Requirements

### Requirement: Registro de gastos del vehículo
El sistema SHALL permitir registrar gastos de un vehículo como eventos con fecha y monto, sin frecuencia fija (US-500, RF-508). Cada gasto MUST persistirse asociado a su vehículo vía `VehiculoRepository.update()`.

El gasto MUST registrarse **sin categoría estructurada**: la entidad Gastos de Vehículo del modelo de datos real (`docs/core/Traslados-Modelo-Datos.docx`) tiene exactamente Vehículo, Monto y Fecha. La enumeración informal del docx ("combustible, peajes, reparaciones menores, entre otros") MUST tratarse como texto libre en la descripción opcional del gasto, y MUST NOT convertirse en un campo de opciones. El formulario de alta MUST NOT ofrecer ningún selector de categoría o clasificación del gasto.

La clasificación de una intervención por tipo (gasto / preventivo / correctivo) y por sub-tipo pertenece a la capability `vehiculo-mantenimiento-historial`, que modela la entidad Mantenimiento — una entidad distinta del docx. Registrar el importe de una intervención de mantenimiento MUST hacerse como un gasto acá, y la intervención en sí como un registro de mantenimiento allá.

#### Scenario: Alta de un gasto
- **WHEN** el usuario ingresa la fecha y el monto de un gasto y confirma
- **THEN** el gasto se agrega a la lista de gastos del vehículo y se persiste

#### Scenario: Validación de monto
- **WHEN** el usuario intenta registrar un gasto con monto vacío o no positivo
- **THEN** el formulario bloquea el registro y señala el campo inválido

#### Scenario: El formulario de gasto no pide categoría
- **WHEN** el usuario abre el formulario de alta de gasto
- **THEN** los campos son fecha, monto y descripción opcional, y no hay ningún selector de categoría del gasto

#### Scenario: Gasto de combustible o peaje descripto en texto libre
- **WHEN** el usuario registra un gasto de combustible o de peaje
- **THEN** puede describirlo en el campo de descripción, sin tener que elegir una categoría de una lista

### Requirement: Listado de gastos por vehículo
El sistema SHALL mostrar la tabla de gastos de un vehículo con fecha y monto de cada evento, obtenida del vehículo cargado.

La tabla MUST NOT tener columna de categoría del gasto. Los totales del registro de gastos (total gastado, total del mes en curso, fecha del último gasto) MUST seguir calculándose sobre todos los gastos del vehículo, sin agrupar ni filtrar por ninguna clasificación.

#### Scenario: Tabla de gastos poblada
- **WHEN** el vehículo tiene gastos registrados
- **THEN** se muestran en una tabla con fecha y monto por fila, sin columna de categoría

#### Scenario: Sin gastos registrados
- **WHEN** el vehículo no tiene gastos
- **THEN** se muestra un estado vacío indicando que aún no hay gastos registrados

#### Scenario: Totales sin agrupación por categoría
- **WHEN** el vehículo tiene varios gastos registrados
- **THEN** el resumen muestra el total gastado, el total del mes en curso y la fecha del último gasto, calculados sobre el conjunto completo de gastos
