# Spec: Vigencia de la prestación en presupuestos y autorizaciones

## ADDED Requirements

### Requirement: Vigencia del presupuesto, independiente de la fecha de emisión

El sistema SHALL permitir registrar en un `Presupuesto` el período que cubre la prestación mediante
`vigenciaDesde` y `vigenciaHasta` (ambos opcionales, ISO date), persistidos en
`facturacion.presupuesto.vigencia_desde` / `.vigencia_hasta`. Estos campos MUST ser independientes de
`fechaEmision`: cambiar uno MUST NOT alterar el otro, y el sistema MUST NOT derivar la vigencia de la
fecha de emisión ni asumir una duración de 12 meses. La vigencia MUST vivir a nivel de `Presupuesto` y
MUST NOT persistirse en `facturacion.presupuesto_linea`.

#### Scenario: Presupuesto emitido en diciembre para un período que arranca en febrero

- **GIVEN** un presupuesto con `fechaEmision = 2025-12-30`
- **WHEN** se carga `vigenciaDesde = 2026-02-01` y `vigenciaHasta = 2027-01-31`
- **THEN** los tres valores se persisten tal cual y sobreviven a recargar la página
- **AND** `fechaEmision` sigue siendo `2025-12-30`, sin ajustarse al inicio de la vigencia

#### Scenario: Período más corto que 12 meses por vencimiento de CUD o RNP

- **GIVEN** un presupuesto con `vigenciaDesde = 2026-02-01`
- **WHEN** se carga `vigenciaHasta = 2026-07-14` porque vence el CUD del paciente
- **THEN** el sistema lo acepta sin reclamar que el período sea de 12 meses
- **AND** no genera ni sugiere una fecha de fin distinta a la cargada

#### Scenario: Vigencia invertida rechazada

- **WHEN** se intenta guardar un presupuesto con `vigenciaHasta` anterior a `vigenciaDesde`
- **THEN** el guardado falla con un mensaje en castellano
- **AND** la base rechaza la fila igualmente por su `CHECK`, aunque la validación de UI se saltee

#### Scenario: Presupuestos anteriores a este cambio

- **GIVEN** un presupuesto creado antes de que existieran las columnas de vigencia
- **WHEN** se lo consulta o se lo muestra
- **THEN** su vigencia es `undefined` en el tipo y se muestra como "Sin vigencia cargada"
- **AND** el sistema MUST NOT inventar un rango a partir de `fechaEmision`

#### Scenario: La vigencia no es un atributo de línea

- **WHEN** se revisa el esquema de `facturacion.presupuesto_linea`
- **THEN** no tiene ninguna columna de vigencia
- **AND** dos prestaciones con períodos distintos se expresan como dos presupuestos distintos, que es
  lo que la modalidad `por-prestacion` ya produce

### Requirement: La autorización puede recortar el período pedido

El sistema SHALL permitir que una `Autorizacion` registre `vigenciaHasta` (opcional, ISO date,
persistido en `facturacion.autorizacion.vigencia_hasta`), completando el par con la `vigenciaDesde`
que ya existía. El período autorizado MUST estar contenido en el pedido cuando ambos lados estén
cargados: `autorizacion.vigenciaDesde >= presupuesto.vigenciaDesde` y
`autorizacion.vigenciaHasta <= presupuesto.vigenciaHasta`. Esta validación cruzada MUST resolverse en
la capa de aplicación y MUST NOT agregarse como trigger nuevo en la base.

#### Scenario: La obra social autoriza menos período del pedido

- **GIVEN** un presupuesto con vigencia `2026-02-01` → `2027-01-31`
- **WHEN** la autorización se carga con vigencia `2026-02-01` → `2026-08-31`
- **THEN** se guarda sin error
- **AND** el detalle muestra los dos períodos por separado: lo pedido y lo autorizado

#### Scenario: La autorización no puede exceder el pedido

- **GIVEN** un presupuesto con vigencia hasta `2027-01-31`
- **WHEN** se intenta autorizar hasta `2027-06-30`
- **THEN** el guardado falla con un mensaje que nombra ambos períodos
- **AND** el mensaje distingue este caso del de RN-PA-01 (monto), que es una regla distinta

#### Scenario: Carga retroactiva sigue funcionando

- **GIVEN** el requisito ya existente de permitir `vigenciaDesde` anterior a `fechaRespuesta` (RN-PA-02)
- **WHEN** se agrega `vigenciaHasta`
- **THEN** ese comportamiento no cambia
- **AND** `vigenciaHasta` tampoco queda atado a `fechaRespuesta`
