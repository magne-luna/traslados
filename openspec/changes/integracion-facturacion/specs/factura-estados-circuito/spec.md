## MODIFIED Requirements

### Requirement: Circuito de estados de la factura
El sistema SHALL manejar los cuatro estados del circuito de facturación — `a-facturar`, `facturado`, `cobrado` y `pagado-parcialmente` (US-400) — como una unión cerrada de literales, mostrando el estado de cada factura en el listado y en el detalle con una señalización visual diferenciada.

El estado persistido en el almacenamiento real es un enum de cinco literales con otro formato de escritura. El sistema SHALL traducir entre ambos con funciones puras y **totales**: la lectura MUST resolver cualquier literal —incluidos los que la aplicación no modela— a uno de los cuatro estados, sin lanzar y sin romper el listado; la escritura MUST emitir únicamente literales que correspondan a los cuatro estados de la aplicación. El sistema MUST NOT ampliar la unión cerrada del dominio para acomodar literales del almacenamiento, y MUST NOT modificar el enum del almacenamiento para acomodar el formato de la aplicación.

#### Scenario: Estado visible en listado y detalle
- **WHEN** se muestra una factura en el listado o en el detalle
- **THEN** su estado actual se muestra de forma diferenciada visualmente respecto de los demás estados

#### Scenario: Alta en estado inicial
- **WHEN** se crea una factura nueva
- **THEN** nace en estado `a-facturar`

#### Scenario: El estado "pendiente" del modelo real se trata como "a facturar"
- **WHEN** se interpreta el estado de una factura proveniente del modelo de datos real, que enumera "pendiente" además de los estados de la aplicación
- **THEN** "pendiente" se trata como sinónimo de `a-facturar`, y la divergencia de enumeración queda señalizada como discrepancia con el docx

#### Scenario: Un literal desconocido no rompe la pantalla
- **GIVEN** una factura cuyo estado persistido no corresponde a ninguno de los cuatro del dominio
- **WHEN** se lee y se lista esa factura
- **THEN** se muestra como `a-facturar`
- **AND** el listado se renderiza completo, sin errores

#### Scenario: La aplicación nunca escribe el literal que no modela
- **WHEN** se persiste el estado de una factura desde la aplicación
- **THEN** el valor escrito corresponde a uno de los cuatro estados del dominio
- **AND** nunca es el literal "pendiente"

### Requirement: Emisión como acción explícita que dispara el cálculo de cobro
El sistema SHALL requerir una acción explícita del usuario para pasar una factura de `a-facturar` a `facturado`, y esa transición MUST fijar la fecha de factura, congelar la descripción renderizada y el identificador del paciente, y calcular la fecha estimada de cobro (US-400).

La **fecha de factura** (fecha de emisión, distinta del período facturado) SHALL persistirse en una columna propia del almacenamiento real, de modo que sobreviva a la relectura desde el servidor. El sistema MUST NOT derivarla de `fechaInicial` ni de `fechaTope`, y MUST NOT dejarla solo en memoria: sin ella, la alerta de factura vencida sin cobro (RF-406) y el reporte de facturas en mora quedan sin fecha de referencia. Mientras la factura no fue emitida, la fecha de emisión MUST estar ausente, no rellenada con un valor por defecto.

El cálculo de la fecha estimada de cobro SHALL seguir siendo responsabilidad de la función pura del dominio. El sistema MUST NOT reimplementarlo en el almacenamiento (por ejemplo como trigger, columna calculada o función del servidor), para no crear dos fuentes de verdad de la misma regla de negocio.

#### Scenario: Emitir una factura
- **WHEN** el usuario ejecuta la acción de emitir sobre una factura en estado `a-facturar`
- **THEN** la factura pasa a `facturado`, se le fija la fecha de factura, se congelan la descripción y el identificador, y se calcula y persiste la fecha estimada de cobro

#### Scenario: La fecha de emisión sobrevive a la relectura
- **GIVEN** una factura emitida y persistida
- **WHEN** se vuelve a leer desde el servidor
- **THEN** conserva su fecha de emisión
- **AND** la alerta de vencimiento puede calcularse a partir de ella

#### Scenario: Una factura no emitida no tiene fecha de emisión
- **GIVEN** una factura en estado `a-facturar`
- **WHEN** se lee desde el servidor
- **THEN** su fecha de emisión está ausente
- **AND** NO se rellena con la fecha de creación ni con el inicio del período facturado

#### Scenario: El cálculo del plazo de cobro no se duplica en el servidor
- **WHEN** se revisa el almacenamiento real
- **THEN** la fecha estimada de cobro es una columna que la aplicación escribe, no un valor que el servidor calcule
- **AND** la precedencia de plazos (amparo judicial sobre plazo de la obra social sobre plazo general) existe en un solo lugar

#### Scenario: La emisión pasa por la validación de cupo
- **WHEN** el usuario emite una factura que excede el cupo autorizado
- **THEN** se muestra la alerta de cupo y se pide confirmación explícita antes de completar la transición

#### Scenario: Editar el estado no altera las asistencias declaradas
- **GIVEN** una factura persistida con sus asistencias
- **WHEN** el usuario ejecuta una transición de estado sin tocar las asistencias
- **THEN** las asistencias permanecen intactas tras la escritura
- **AND** el detalle y la vista imprimible siguen mostrando el mismo detalle de prestaciones
