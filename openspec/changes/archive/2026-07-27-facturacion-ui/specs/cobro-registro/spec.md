## ADDED Requirements

### Requirement: Registro de cobros y pagos parciales por factura
El sistema SHALL permitir registrar N cobros por factura, cada uno con fecha y monto pagado (docx §Cobros, US-400: "se registran cobros y pagos parciales asociados a una o varias facturas"), persistidos vía `CobroRepository` y listados en el detalle de la factura ordenados por fecha.

#### Scenario: Alta de un cobro
- **WHEN** el usuario registra un cobro con fecha y monto para una factura emitida
- **THEN** el cobro se persiste vía `CobroRepository.create()` y aparece en la lista de cobros de esa factura

#### Scenario: Varios cobros parciales sobre la misma factura
- **WHEN** se registran dos o más cobros parciales sobre una misma factura
- **THEN** todos quedan listados de forma independiente, sin reemplazarse entre sí

#### Scenario: Baja de un cobro
- **WHEN** el usuario elimina un cobro registrado por error
- **THEN** el cobro desaparece de la lista y el saldo y el estado de la factura se recalculan

#### Scenario: No se registran cobros sobre facturas no emitidas
- **WHEN** la factura está en estado `a-facturar`
- **THEN** la interfaz no ofrece registrar cobros, porque todavía no hay comprobante emitido que cobrar

### Requirement: Saldo pendiente calculado
El sistema SHALL calcular el saldo pendiente de una factura mediante una **función pura** `saldoFactura(factura, cobros)` que reste al monto total la suma de los montos pagados, y SHALL mostrar ese saldo en el detalle de la factura junto con el total cobrado.

#### Scenario: Saldo con cobros parciales
- **WHEN** una factura tiene cobros por menos del total
- **THEN** el saldo es la diferencia entre el monto de la factura y la suma de los cobros

#### Scenario: Saldo cero
- **WHEN** la suma de los cobros iguala el monto de la factura
- **THEN** el saldo es cero

#### Scenario: Factura sin cobros
- **WHEN** una factura emitida no tiene cobros
- **THEN** el saldo es igual al monto total de la factura

### Requirement: Validación del monto cobrado
El sistema SHALL validar que un cobro tenga un monto positivo y SHALL alertar cuando la suma de los cobros supere el monto total de la factura, para evitar registros incoherentes en un dominio de dinero.

#### Scenario: Monto no positivo
- **WHEN** el usuario intenta registrar un cobro con monto cero o negativo
- **THEN** el formulario muestra el error y no invoca al repository

#### Scenario: Cobro que excede el saldo pendiente
- **WHEN** el monto del cobro haría que la suma cobrada supere el monto total de la factura
- **THEN** se muestra una alerta visible indicando el exceso antes de confirmar el registro

#### Scenario: Fecha de cobro obligatoria
- **WHEN** el usuario intenta registrar un cobro sin fecha
- **THEN** el formulario muestra el error y no invoca al repository
