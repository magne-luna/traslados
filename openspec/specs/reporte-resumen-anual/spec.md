## ADDED Requirements

### Requirement: Resumen anual de facturación y cobros
El sistema SHALL calcular, mediante la función pura `resumenAnual({ facturas, cobros, anio })`, un resumen del año calendario indicado con el total facturado, el total cobrado, la diferencia entre ambos, la cantidad de facturas emitidas y la cantidad de facturas saldadas, pensado para el cierre y la preparación de balances (US-800, RF-803).

#### Scenario: Totales del año
- **WHEN** se solicita el resumen de un año con facturas y cobros cargados
- **THEN** devuelve el total facturado del año, el total cobrado del año y la diferencia, aplicando las mismas reglas de atribución que la serie por período (facturado por `mesFacturado`/`anioFacturado` y solo de facturas emitidas; cobrado por `Cobro.fecha`)

#### Scenario: Conteo de facturas emitidas y saldadas
- **WHEN** se calcula el resumen de un año
- **THEN** informa cuántas facturas del año fueron emitidas (estado `facturado`, `cobrado` o `pagado-parcialmente`) y cuántas de ellas quedaron saldadas (estado `cobrado`)

#### Scenario: Año sin datos
- **WHEN** se solicita el resumen de un año en el que no hay ninguna factura ni cobro
- **THEN** devuelve un resumen con todos los totales y conteos en cero y los doce meses del desglose en cero, sin lanzar error

#### Scenario: Aislamiento entre años
- **WHEN** hay facturas y cobros de varios años
- **THEN** el resumen de un año solo incluye lo atribuible a ese año, y una factura de diciembre cobrada en enero del año siguiente suma facturado en el primer año y cobrado en el segundo

### Requirement: Desglose mensual del año
El sistema SHALL incluir en el resumen anual el desglose de los doce meses del año, con facturado, cobrado y diferencia por mes, para poder leer el año completo sin cambiar de reporte.

#### Scenario: Doce meses siempre presentes
- **WHEN** se calcula el resumen de cualquier año
- **THEN** el desglose tiene exactamente doce entradas, de enero a diciembre, incluidas las de los meses sin movimiento en cero

#### Scenario: Coherencia entre desglose y totales
- **WHEN** se comparan los totales anuales con el desglose
- **THEN** la suma de los doce meses de facturado es igual al total facturado del año, y lo mismo para el cobrado

### Requirement: Selector de año acotado a los años con datos
El sistema SHALL ofrecer un selector de año cuyas opciones se derivan de los datos disponibles (los años presentes en el período de las facturas y en la fecha de los cobros), incluyendo siempre el año de la fecha de referencia.

#### Scenario: Opciones derivadas de los datos
- **WHEN** las facturas y cobros cargados abarcan 2025 y 2026 y la fecha de referencia está en 2026
- **THEN** el selector ofrece 2025 y 2026, sin años vacíos intermedios inventados ni años futuros sin datos

#### Scenario: Sin datos cargados
- **WHEN** no hay ninguna factura ni cobro
- **THEN** el selector ofrece al menos el año de la fecha de referencia y el panel muestra el estado vacío, no un selector sin opciones

#### Scenario: Cambio de año
- **WHEN** la usuaria cambia el año seleccionado
- **THEN** el resumen y su desglose se recalculan sobre los datos ya cargados en memoria, sin volver a leer los repositorios

### Requirement: Presentación del resumen anual
El sistema SHALL presentar el resumen anual con los totales destacados y el desglose mensual como tabla accesible, con montos formateados en moneda argentina y estados de carga, error y vacío explícitos.

#### Scenario: Totales destacados
- **WHEN** se renderiza el resumen
- **THEN** el facturado, el cobrado y la diferencia del año se muestran destacados por encima del desglose mensual, identificados con texto y no solo por color

#### Scenario: Estados de carga, error y vacío
- **WHEN** los datos están cargando, la lectura falla, o el año seleccionado no tiene movimiento
- **THEN** el panel muestra el estado correspondiente de forma explícito, nunca un área en blanco
