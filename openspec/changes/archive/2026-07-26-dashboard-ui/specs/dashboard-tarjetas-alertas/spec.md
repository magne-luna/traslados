## ADDED Requirements

### Requirement: Tarjeta de facturas en mora
El sistema SHALL mostrar una tarjeta de resumen con las facturas en mora, calculada por la función pura `facturasEnMora({ facturas, cobros, hoy })` (US-800, RF-801, RF-406). Una factura está en mora cuando `estadoVencimientoFactura` la marca como vencida y además conserva saldo pendiente. La regla y su umbral MUST tomarse de `shared/lib/facturacion/`, sin reimplementarse.

#### Scenario: Factura emitida, vencida y con saldo
- **WHEN** una factura está en estado `facturado`, su `fechaFactura` supera el plazo de alerta configurado y no registra cobros que la salden
- **THEN** aparece en la tarjeta de mora, con su paciente, su monto pendiente y los días de atraso

#### Scenario: Factura vencida pero ya saldada
- **WHEN** una factura superó el plazo de alerta pero sus cobros cubren el monto total (estado `cobrado`)
- **THEN** no aparece en la tarjeta de mora

#### Scenario: Factura vencida con cobro parcial
- **WHEN** una factura superó el plazo, tiene estado `pagado-parcialmente` y conserva saldo
- **THEN** aparece en la tarjeta de mora informando el saldo pendiente, no el monto total de la factura

#### Scenario: Factura nunca emitida
- **WHEN** una factura está en estado `a-facturar` y por lo tanto no tiene `fechaFactura`
- **THEN** no aparece en la tarjeta de mora, y el cálculo no falla por la ausencia del campo

#### Scenario: Umbral heredado del módulo de facturación
- **WHEN** cambia el valor de `PLAZO_ALERTA_VENCIDA_DIAS` en `shared/lib/facturacion/constantes.ts`
- **THEN** el conjunto de facturas de la tarjeta cambia en consecuencia, sin modificar ningún archivo del dashboard

### Requirement: Tarjeta de CUD por vencer
El sistema SHALL mostrar una tarjeta de resumen con los pacientes cuyo CUD está por vencer o vencido, calculada por la función pura `cudPorVencer({ pacientes, hoy, umbralDias })` reutilizando `estadoCud` de `shared/lib/pacientes/` (US-800, RF-801, RF-104).

#### Scenario: CUD dentro de la ventana de aviso
- **WHEN** el CUD de un paciente vence dentro del umbral de días configurado
- **THEN** el paciente aparece en la tarjeta con su fecha de vencimiento y el estado `por-vencer`

#### Scenario: CUD ya vencido
- **WHEN** la fecha de vencimiento del CUD de un paciente es anterior a la fecha de referencia
- **THEN** el paciente aparece en la tarjeta con el estado `vencido`, diferenciado de los que están por vencer

#### Scenario: CUD vigente
- **WHEN** el CUD de un paciente vence después de la ventana de aviso
- **THEN** el paciente no aparece en la tarjeta

#### Scenario: Paciente sin CUD cargado
- **WHEN** un paciente tiene `cud: null`
- **THEN** se omite del cálculo sin generar error ni contarse como vencido

### Requirement: Tarjeta de alertas de mantenimiento de flota
El sistema SHALL mostrar una tarjeta de resumen con los vehículos que requieren atención, calculada por la función pura `alertasMantenimiento({ vehiculos, ahora })` reutilizando `estadoServicePreventivo` y `estadoHabilitacion` de `shared/lib/mantenimiento/` (US-800, RF-801, RN-VE-03, RN-VE-04). La proyección MUST indicar qué señal disparó la alerta.

#### Scenario: Service preventivo vencido
- **WHEN** un vehículo superó los kilómetros o los meses desde su último service
- **THEN** aparece en la tarjeta indicando que el motivo es el service preventivo

#### Scenario: Alerta intermedia de service
- **WHEN** un vehículo alcanzó el umbral de alerta intermedia desde su último service pero todavía no el de vencimiento
- **THEN** aparece en la tarjeta diferenciado del vencido, sin mezclarse con las alertas críticas

#### Scenario: Habilitación VTV o RTO vencida o por vencer
- **WHEN** un vehículo tiene una habilitación VTV o RTO vencida o dentro de la ventana de aviso
- **THEN** aparece en la tarjeta indicando cuál de las dos habilitaciones y con qué estado, evaluando cada habilitación de forma independiente

#### Scenario: Vehículo con más de un motivo
- **WHEN** un vehículo tiene simultáneamente el service vencido y una habilitación por vencer
- **THEN** aparece una sola vez en la tarjeta, enumerando todos sus motivos, sin duplicarse

#### Scenario: Vehículo sin alertas
- **WHEN** un vehículo tiene el service al día y todas sus habilitaciones vigentes
- **THEN** no aparece en la tarjeta

### Requirement: Presentación uniforme de las tarjetas
El sistema SHALL presentar las tres tarjetas con la misma estructura: un conteo total destacado, una lista acotada de los primeros ítems y un enlace al módulo de origen para ver el resto. El límite de ítems visibles MUST venir de una constante única.

#### Scenario: Conteo total siempre visible
- **WHEN** una tarjeta tiene más ítems que el máximo visible
- **THEN** muestra el conteo total real, la lista acotada al máximo, y un enlace al módulo de origen

#### Scenario: Navegación al módulo de origen
- **WHEN** la usuaria activa el enlace de una tarjeta
- **THEN** navega a la pantalla del módulo correspondiente (facturación, pacientes o vehículos) mediante el router, sin recargar la página

#### Scenario: Tarjeta sin alertas
- **WHEN** una tarjeta no tiene ningún ítem
- **THEN** muestra un estado vacío explícito y afirmativo (por ejemplo, que no hay facturas en mora), en vez de una tarjeta en blanco o ausente

#### Scenario: Estados de carga y error por tarjeta
- **WHEN** los datos de una tarjeta están cargando o su lectura falla
- **THEN** esa tarjeta muestra su propio estado de carga o de error acotado, y las demás tarjetas siguen mostrando su contenido

#### Scenario: Severidad comunicada más allá del color
- **WHEN** una tarjeta distingue ítems críticos de ítems en alerta preventiva
- **THEN** la diferencia se comunica con texto o etiqueta además del color, y los contrastes cumplen WCAG 2.1 AA
