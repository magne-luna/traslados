## ADDED Requirements

### Requirement: Circuito de estados de la factura
El sistema SHALL manejar los cuatro estados del circuito de facturación — `a-facturar`, `facturado`, `cobrado` y `pagado-parcialmente` (US-400) — como una unión cerrada de literales, mostrando el estado de cada factura en el listado y en el detalle con una señalización visual diferenciada.

#### Scenario: Estado visible en listado y detalle
- **WHEN** se muestra una factura en el listado o en el detalle
- **THEN** su estado actual se muestra de forma diferenciada visualmente respecto de los demás estados

#### Scenario: Alta en estado inicial
- **WHEN** se crea una factura nueva
- **THEN** nace en estado `a-facturar`

#### Scenario: El estado "pendiente" del modelo real se trata como "a facturar"
- **WHEN** se interpreta el estado de una factura proveniente del modelo de datos real, que enumera "pendiente" en vez de "facturado"
- **THEN** "pendiente" se trata como sinónimo de `a-facturar`, y la divergencia de enumeración queda señalizada como discrepancia con el docx

### Requirement: Emisión como acción explícita que dispara el cálculo de cobro
El sistema SHALL requerir una acción explícita del usuario para pasar una factura de `a-facturar` a `facturado`, y esa transición MUST fijar la fecha de factura, congelar la descripción renderizada y el identificador del paciente, y calcular la fecha estimada de cobro (US-400).

#### Scenario: Emitir una factura
- **WHEN** el usuario ejecuta la acción de emitir sobre una factura en estado `a-facturar`
- **THEN** la factura pasa a `facturado`, se le fija la fecha de factura, se congelan la descripción y el identificador, y se calcula y persiste la fecha estimada de cobro

#### Scenario: La emisión pasa por la validación de cupo
- **WHEN** el usuario emite una factura que excede el cupo autorizado
- **THEN** se muestra la alerta de cupo y se pide confirmación explícita antes de completar la transición

### Requirement: Estado derivado de los cobros registrados
El sistema SHALL derivar el estado de cobro de una factura emitida a partir de sus cobros, mediante una **función pura** `estadoDerivadoFactura(factura, cobros)`: sin cobros permanece `facturado`; con cobros y saldo pendiente mayor a cero pasa a `pagado-parcialmente`; con saldo cero pasa a `cobrado`. Esto evita que el estado y los cobros se desincronicen.

#### Scenario: Primer cobro parcial
- **WHEN** se registra un cobro por un monto menor al total de una factura en estado `facturado`
- **THEN** el estado derivado pasa a `pagado-parcialmente`

#### Scenario: Cobros que saldan la factura
- **WHEN** la suma de los cobros iguala el monto total de la factura
- **THEN** el estado derivado pasa a `cobrado`

#### Scenario: Baja de un cobro
- **WHEN** se elimina un cobro y la factura vuelve a tener saldo pendiente
- **THEN** el estado derivado vuelve a `pagado-parcialmente`, o a `facturado` si no quedan cobros

#### Scenario: Corrección manual del estado con aviso de inconsistencia
- **WHEN** el usuario fija manualmente un estado que no coincide con el derivado de los cobros
- **THEN** el sistema respeta la decisión del usuario pero muestra la inconsistencia de forma visible, en vez de sobrescribirla en silencio
