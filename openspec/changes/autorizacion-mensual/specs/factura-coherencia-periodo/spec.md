# Spec: Coherencia entre el mes de la autorización elegida y el mes facturado

## ADDED Requirements

### Requirement: Preselección de la autorización cuyo período coincide con el facturado

El sistema SHALL preseleccionar, en el Paso 2 de `FacturaForm`, la autorización pendiente cuyo
`periodoMes` coincide con `(values.mesFacturado, values.anioFacturado)`, únicamente cuando existe
**exactamente una** coincidencia. El operador SHALL poder cambiar esa selección libremente después
(preselección ≠ resolución automática). La preselección MUST NOT correr en modo edición ni pisar una
elección manual ya hecha por el operador.

#### Scenario: Preselección con exactamente una coincidencia

- **GIVEN** un paciente con una única autorización pendiente cuyo `periodoMes` coincide con
  `(mesFacturado, anioFacturado)` del paso 1
- **WHEN** se llega al paso 2
- **THEN** esa autorización queda preseleccionada

#### Scenario: Sin preselección ante ambigüedad

- **GIVEN** un paciente con dos autorizaciones pendientes cuyo `periodoMes` coincide con el mismo
  `(mesFacturado, anioFacturado)`
- **WHEN** se llega al paso 2
- **THEN** ninguna queda preseleccionada — el operador elige explícitamente

#### Scenario: Reelección manual después de la preselección

- **GIVEN** una autorización preseleccionada por coincidencia de período
- **WHEN** el operador elige otra autorización distinta en el `<Select>`
- **THEN** el sistema respeta la elección manual, sin revertirla a la preselección

#### Scenario: La preselección no vuelve a correr en modo edición

- **GIVEN** una factura existente con una `autorizacionId` ya persistida
- **WHEN** se abre en modo edición
- **THEN** la preselección automática no se ejecuta — la autorización mostrada es la que ya estaba
  guardada

### Requirement: Aviso no bloqueante cuando el mes elegido no coincide con el facturado

El sistema SHALL mostrar, mediante un componente `AlertaCoherenciaPeriodo` con el mismo tono visual
que `AlertaCupo`/`AlertaMontoAutorizado`, un aviso cuando la autorización elegida tenga un
`periodoMes` que no coincide con `(mesFacturado, anioFacturado)`, distinguiendo el caso "no
coincide" del caso "legacy sin período" (autorización sin `periodoMes`). El aviso MUST NOT bloquear
el envío del formulario — RN-PA-02 permite facturación retroactiva, y esta advertencia se suma a la
misma familia de "confirmación explícita, sin bloqueo" que ya usa `AlertaCupo`.

#### Scenario: Aviso visible cuando el mes no coincide

- **GIVEN** una autorización de marzo elegida para una factura con `mesFacturado = mayo`
- **WHEN** se completa el paso 2
- **THEN** se muestra un aviso visible de que el mes no coincide
- **AND** el botón Guardar sigue habilitado

#### Scenario: Aviso distinto para autorización legacy sin período

- **GIVEN** una autorización sin `periodoMes` elegida para facturar
- **WHEN** se completa el paso 2
- **THEN** el aviso muestra el tono/mensaje de "legacy sin período", distinto del de "no coincide"

#### Scenario: Sin aviso cuando el mes coincide

- **GIVEN** una autorización cuyo `periodoMes` coincide con `(mesFacturado, anioFacturado)`
- **WHEN** se completa el paso 2
- **THEN** el aviso muestra el tono de "coincide", sin advertencia de discrepancia

#### Scenario: El aviso nunca bloquea el envío

- **GIVEN** cualquiera de los tres resultados de coherencia (coincide, no coincide,
  legacy-sin-periodo)
- **WHEN** el operador completa el resto del formulario y guarda
- **THEN** el guardado se ejecuta con normalidad — `validateFacturaForm`/`handleSubmit` no dependen
  del resultado de coherencia

### Requirement: Aviso de convivencia de modelos mientras existan filas legacy y mensuales

El sistema SHALL mostrar `AvisoModeloDatos` en el Paso 2 de `FacturaForm` cuando las autorizaciones
pendientes del paciente elegido incluyan al menos una fila legacy (sin `periodoMes`) y al menos una
fila mensual (con `periodoMes`) simultáneamente.

#### Scenario: Aviso visible con convivencia real

- **GIVEN** las autorizaciones pendientes del paciente elegido tienen al menos una fila legacy y al
  menos una fila mensual
- **WHEN** se muestra el paso 2
- **THEN** aparece el `AvisoModeloDatos` de convivencia de modelos

#### Scenario: Sin aviso cuando todas las autorizaciones pendientes son del mismo modelo

- **GIVEN** todas las autorizaciones pendientes del paciente elegido son legacy (o todas son
  mensuales)
- **WHEN** se muestra el paso 2
- **THEN** el aviso de convivencia de modelos no aparece
