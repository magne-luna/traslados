## MODIFIED Requirements

### Requirement: Emisión como acción explícita que dispara la facturación electrónica

El sistema SHALL requerir una acción explícita del usuario para emitir una factura en estado
`a-facturar`. La emisión SHALL delegarse en la Edge Function `facturar`, que obtiene un CAE real de
ARCA a través del miniserver y, **sólo si ARCA aprueba el comprobante**, mueve la factura a
`facturado`. En esa misma operación, y del lado del servidor, el sistema SHALL fijar la fecha de
factura, congelar la descripción renderizada y el identificador del paciente, calcular y persistir
la fecha estimada de cobro, y persistir el CAE, su vencimiento, el número de comprobante y el punto
de venta.

La transición `a-facturar → facturado` MUST NOT ocurrir cuando ARCA rechaza el comprobante, la
identidad fiscal es inválida, o el miniserver no responde: en esos casos la factura permanece en
`a-facturar`, editable, y no se persiste ningún campo fiscal. El sistema MUST tratar la emisión como
**idempotente**: una factura que ya tiene CAE no se re-emite.

La **fecha de factura** SHALL persistirse en una columna propia del almacenamiento real, de modo que
sobreviva a la relectura. El sistema MUST NOT derivarla de `fechaInicial` ni de `fechaTope`, y MUST
NOT dejarla solo en memoria. Mientras la factura no fue emitida, la fecha de emisión MUST estar
ausente, no rellenada con un valor por defecto.

El cálculo de la fecha estimada de cobro y de la descripción SHALL seguir la misma lógica que las
funciones puras del dominio (`calcularFechaEstimadaCobro`, `renderDescripcionFactura`). El sistema
MUST NOT reimplementar esas reglas en el almacenamiento (trigger, columna calculada, función del
servidor) para no crear dos fuentes de verdad; si se ejecutan dentro de la Edge Function, MUST
producir el mismo resultado que las funciones del frontend para las mismas entradas.

#### Scenario: Emitir una factura aprobada por ARCA

- **WHEN** el usuario ejecuta la acción de emitir sobre una factura en estado `a-facturar` y ARCA
  aprueba el comprobante
- **THEN** la factura pasa a `facturado`, se le fija la fecha de factura, se congelan la descripción
  y el identificador, se calcula y persiste la fecha estimada de cobro, y se persisten el CAE, su
  vencimiento, el número de comprobante y el punto de venta

#### Scenario: ARCA rechaza el comprobante

- **GIVEN** una factura en estado `a-facturar`
- **WHEN** el usuario la emite y ARCA rechaza el comprobante
- **THEN** la factura permanece en `a-facturar` y editable
- **AND** ningún campo fiscal se persiste
- **AND** el usuario ve el motivo del rechazo

#### Scenario: Reintento de una factura ya emitida

- **GIVEN** una factura que ya tiene CAE
- **WHEN** el usuario intenta emitirla de nuevo
- **THEN** la operación se rechaza sin llamar al miniserver
- **AND** no se genera un segundo CAE
- **AND** la acción "Emitir" no se ofrece en la interfaz para esa factura

#### Scenario: La fecha de emisión sobrevive a la relectura

- **GIVEN** una factura emitida y persistida
- **WHEN** se vuelve a leer desde el servidor
- **THEN** conserva su fecha de emisión y su CAE
- **AND** la alerta de vencimiento puede calcularse a partir de la fecha de emisión

#### Scenario: Una factura no emitida no tiene fecha de emisión ni datos fiscales

- **GIVEN** una factura en estado `a-facturar`
- **WHEN** se lee desde el servidor
- **THEN** su fecha de emisión, su CAE, su número de comprobante y su punto de venta están ausentes
- **AND** NO se rellenan con valores por defecto

#### Scenario: El cálculo del plazo de cobro no se duplica como fuente de verdad

- **WHEN** se revisa el almacenamiento real
- **THEN** la fecha estimada de cobro es una columna que la aplicación (o su Edge Function) escribe,
  no un valor que el servidor calcule mediante trigger o columna calculada
- **AND** la precedencia de plazos (amparo judicial sobre plazo de la obra social sobre plazo
  general) tiene una sola implementación

#### Scenario: La emisión pasa por la validación de cupo

- **WHEN** el usuario emite una factura que excede el cupo autorizado
- **THEN** se muestra la alerta de cupo y se pide confirmación explícita antes de invocar la emisión
  electrónica

#### Scenario: Editar el estado no altera las asistencias declaradas

- **GIVEN** una factura persistida con sus asistencias
- **WHEN** el usuario ejecuta una transición de estado sin tocar las asistencias
- **THEN** las asistencias permanecen intactas tras la escritura
