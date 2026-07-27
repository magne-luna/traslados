## ADDED Requirements

### Requirement: Serie mensual de facturado, cobrado y diferencia
El sistema SHALL calcular, mediante la función pura `facturadoVsCobrado({ facturas, cobros, hoy, meses })`, una serie con un punto por mes del rango solicitado, donde cada punto contiene el total facturado, el total cobrado y la diferencia entre ambos (US-800, RF-802). La serie MUST incluir además los totales del rango completo.

#### Scenario: Un punto por cada mes del rango
- **WHEN** se solicita la serie con `meses = 6` y una fecha de referencia
- **THEN** devuelve exactamente 6 puntos, ordenados del mes más antiguo al más reciente, terminando en el mes de la fecha de referencia

#### Scenario: Meses sin movimiento se emiten en cero
- **WHEN** un mes del rango no tiene ninguna factura emitida ni ningún cobro
- **THEN** el punto de ese mes aparece igual en la serie con facturado 0, cobrado 0 y diferencia 0, en vez de omitirse

#### Scenario: Diferencia calculada como facturado menos cobrado
- **WHEN** un mes tiene 100.000 facturados y 30.000 cobrados
- **THEN** la diferencia de ese mes es 70.000, y una diferencia negativa (se cobró más de lo facturado ese mes, por cobros de facturas anteriores) se representa como número negativo, no como cero

#### Scenario: Totales del rango
- **WHEN** se calcula la serie
- **THEN** expone el total facturado, el total cobrado y la diferencia del rango completo, y cada total coincide con la suma de los puntos de la serie

### Requirement: Atribución del facturado por período estructurado de la factura
El sistema SHALL atribuir el monto de una factura al mes y año de su período estructurado (`mesFacturado` / `anioFacturado`), no a su fecha de emisión ni a `fechaInicial` / `fechaTope`.

#### Scenario: Factura de marzo emitida en abril
- **WHEN** una factura tiene `mesFacturado = 3`, `anioFacturado = 2026` y `fechaFactura` en abril de 2026
- **THEN** su monto suma en el punto de marzo de 2026 de la serie, no en el de abril

#### Scenario: Factura fuera del rango
- **WHEN** una factura tiene un período anterior al primer mes del rango o posterior al último
- **THEN** no suma en ningún punto de la serie ni en los totales del rango

### Requirement: Solo las facturas emitidas cuentan como facturado
El sistema SHALL incluir en el total facturado únicamente las facturas cuyo estado es `facturado`, `cobrado` o `pagado-parcialmente`. Las facturas en estado `a-facturar` MUST quedar excluidas: son borradores y todavía no representan facturación.

#### Scenario: Factura en a-facturar excluida
- **WHEN** una factura del rango tiene estado `a-facturar`
- **THEN** su monto no suma en el facturado de ningún mes ni en el total del rango

#### Scenario: Facturas emitidas en cualquiera de sus estados posteriores
- **WHEN** en un mismo mes hay facturas en estado `facturado`, `cobrado` y `pagado-parcialmente`
- **THEN** las tres suman su monto completo en el facturado de ese mes

### Requirement: Atribución del cobrado por fecha de cobro
El sistema SHALL atribuir cada `Cobro` al mes de su propia `fecha` (cuándo entró la plata), con independencia del período de la factura que salda.

#### Scenario: Cobro de una factura vieja
- **WHEN** un cobro con fecha de abril de 2026 corresponde a una factura de `mesFacturado = 1`, `anioFacturado = 2026`
- **THEN** su monto suma en el cobrado de abril de 2026, no en el de enero

#### Scenario: Cobros parciales en meses distintos
- **WHEN** una misma factura recibe dos cobros parciales en meses distintos del rango
- **THEN** cada cobro suma en el mes de su propia fecha, y ninguno se duplica

#### Scenario: Atribución estable en los bordes del mes
- **WHEN** un cobro tiene fecha en el primer día o en el último día de un mes
- **THEN** se atribuye a ese mes, sin desplazarse al mes vecino por conversión de zona horaria

### Requirement: Selector de período de 3, 6 o 12 meses
El sistema SHALL ofrecer en la pantalla un selector con las opciones de 3, 6 y 12 meses (US-800, RF-802), tomadas de una constante única, y recalcular la serie al cambiarlo sin volver a leer los repositorios.

#### Scenario: Cambio de período
- **WHEN** la usuaria cambia el selector de 3 a 12 meses
- **THEN** la serie se recalcula sobre los datos ya cargados en memoria y muestra 12 puntos, sin disparar una nueva lectura de facturas ni de cobros

#### Scenario: Período por defecto
- **WHEN** la pantalla se carga por primera vez
- **THEN** el selector arranca en una de las opciones disponibles y la serie mostrada corresponde a esa opción

#### Scenario: Regla de atribución visible para quien lee el número
- **WHEN** se muestra el reporte
- **THEN** la pantalla indica de forma legible que lo facturado se atribuye al período de la factura y lo cobrado a la fecha del cobro, para que el número no se malinterprete

### Requirement: Presentación accesible de la serie sin librería de gráficos
El sistema SHALL presentar la serie como una tabla accesible acompañada de barras proporcionales construidas con utilidades de Tailwind v4, sin incorporar ninguna librería de gráficos y sin usar `style={{}}` inline.

#### Scenario: Serie legible por lector de pantalla
- **WHEN** se renderiza la serie
- **THEN** es una tabla con encabezados de columna asociados y los valores numéricos disponibles como texto, no solo como representación visual

#### Scenario: Montos formateados en moneda local
- **WHEN** se muestran los montos
- **THEN** se formatean como moneda argentina mediante un helper único, y las columnas numéricas quedan alineadas

#### Scenario: Estados de carga, error y vacío
- **WHEN** los datos están cargando, la lectura falla, o no hay ninguna factura ni cobro en el rango
- **THEN** el panel muestra el estado correspondiente de forma explícita, nunca un área en blanco
