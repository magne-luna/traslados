## ADDED Requirements

### Requirement: Cálculo de la fecha estimada de cobro con plazos configurables
El sistema SHALL calcular la fecha estimada de cobro de una factura mediante una **función pura** `calcularFechaEstimadaCobro({ fechaFactura, amparoJudicial, plazoObraSocial })`, contando los días **desde la fecha de factura** (no desde la prestación ni desde la autorización, RN-FA-04). Los plazos MUST provenir de constantes configurables o de parámetros, y MUST NOT estar hardcodeados en la lógica ni en los componentes.

#### Scenario: Plazo general por defecto
- **WHEN** el paciente no tiene amparo judicial y su obra social no define un plazo propio
- **THEN** la fecha estimada de cobro es la fecha de factura más el plazo general por defecto (90 días, RN-FA-04)

#### Scenario: Plazo de la obra social
- **WHEN** el paciente no tiene amparo judicial y su obra social define su propio plazo de cobro en días
- **THEN** se usa el plazo de la obra social en lugar del plazo general por defecto

#### Scenario: Amparo judicial
- **WHEN** el paciente tiene amparo judicial
- **THEN** se usa el plazo de amparo (45 días por defecto, RN-FA-04), que **prevalece** sobre el plazo de la obra social y sobre el plazo general

#### Scenario: El cómputo parte de la fecha de factura
- **WHEN** se calcula la fecha estimada de cobro
- **THEN** el día cero es la fecha de factura, y ninguna otra fecha (de prestación, de autorización o de carga) interviene en el cálculo

### Requirement: La fecha estimada de cobro se calcula al pasar a facturado y se persiste
El sistema SHALL calcular y persistir `Factura.fechaEstimadaCobro` en el momento en que la factura pasa al estado `facturado` (US-400), y SHALL mostrarla en el detalle de la factura. Este campo es un **agregado sobre el modelo de datos real**, que no tiene fecha ni plazo de cobro, y MUST quedar señalizado como tal.

#### Scenario: Cálculo disparado por la emisión
- **WHEN** una factura en estado `a-facturar` pasa a `facturado`
- **THEN** se calcula la fecha estimada de cobro y se guarda en la factura junto con la fecha de factura

#### Scenario: Facturas no emitidas no tienen fecha estimada
- **WHEN** una factura está en estado `a-facturar`
- **THEN** no tiene fecha estimada de cobro persistida, y el detalle lo indica en vez de mostrar una fecha inventada

#### Scenario: Visibilidad de la fecha estimada
- **WHEN** se abre el detalle de una factura emitida
- **THEN** se muestra la fecha estimada de cobro junto con el plazo aplicado y el motivo (plazo general, plazo de la obra social o amparo judicial), para que la usuaria entienda de dónde salió

### Requirement: Alerta de factura vencida sin cobro
El sistema SHALL señalar como vencida sin cobro toda factura que supere el plazo de alerta configurable (60 días por defecto, RF-406) desde su fecha de factura y siga sin estar saldada, mediante una **función pura** `estadoVencimientoFactura({ fechaFactura, hoy, estado })`, para habilitar el seguimiento ante la Superintendencia.

#### Scenario: Factura emitida que supera el plazo de alerta
- **WHEN** una factura en estado `facturado` supera el plazo de alerta desde su fecha de factura
- **THEN** la función la marca como vencida y el listado y el detalle la muestran señalizada

#### Scenario: Factura con cobros parciales que supera el plazo
- **WHEN** una factura en estado `pagado-parcialmente` supera el plazo de alerta
- **THEN** también se marca como vencida, porque sigue con saldo pendiente

#### Scenario: Factura saldada
- **WHEN** una factura está en estado `cobrado`
- **THEN** nunca se marca como vencida, sin importar cuánto tiempo pasó desde su emisión

#### Scenario: Dentro del plazo
- **WHEN** una factura emitida todavía no alcanzó el plazo de alerta
- **THEN** no se marca como vencida

#### Scenario: El plazo de alerta es configurable
- **WHEN** se cambia el valor de la constante del plazo de alerta
- **THEN** el comportamiento cambia sin modificar componentes, porque el valor no está escrito literalmente en ninguno
