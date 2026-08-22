# Spec: Con/sin dependencia (CD/SD) — pedido y concedido

## ADDED Requirements

### Requirement: Dependencia como par pedido/concedido

El sistema SHALL registrar `conDependencia` (booleano opcional) tanto en `Presupuesto` (lo que se le
pide a la obra social) como en `Autorizacion` (lo que la obra social concede), persistidos en
`facturacion.presupuesto.con_dependencia` y `facturacion.autorizacion.con_dependencia`. Ambos MUST ser
nullable: `null` significa "no se cargó" y `false` significa "sin dependencia, decisión tomada". El
sistema MUST NOT usar `NOT NULL DEFAULT false`, porque haría que todos los registros históricos
afirmaran una decisión que nunca se tomó.

#### Scenario: Se pide con dependencia y la obra social lo deniega

- **GIVEN** un presupuesto con `conDependencia = true`
- **WHEN** se carga su autorización con `conDependencia = false`
- **THEN** ambos valores se persisten por separado
- **AND** el detalle muestra que se pidió CD y se concedió SD, sin sobrescribir el pedido

#### Scenario: El checkbox de la autorización es desmarcable

- **GIVEN** una autorización cuyo presupuesto tiene `conDependencia = true`
- **WHEN** se abre el formulario de la autorización
- **THEN** su checkbox de dependencia se puede desmarcar
- **AND** el valor desmarcado persiste tras guardar y reabrir

#### Scenario: Sin cargar no es lo mismo que sin dependencia

- **GIVEN** un presupuesto creado antes de que existiera el campo
- **WHEN** se lo consulta
- **THEN** `conDependencia` es `undefined`, no `false`
- **AND** la UI lo muestra como "no cargado", no como "SD"

#### Scenario: El valor del km sigue siendo carga manual

- **GIVEN** que todavía no está definido qué le hace CD/SD al valor del km (pregunta abierta a la
  clienta)
- **WHEN** se marca o desmarca `conDependencia`
- **THEN** el sistema MUST NOT modificar automáticamente ningún valor ni cálculo de km
- **AND** el valor del km sigue siendo un dato de carga manual, como ya establece la base de
  conocimiento
