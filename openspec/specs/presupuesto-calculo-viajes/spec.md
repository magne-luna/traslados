# Spec: Cálculo de viajes y kilómetros mensuales

## ADDED Requirements

### Requirement: Viajes mensuales cuentan ida y vuelta

El sistema SHALL calcular los viajes mensuales como
`viajesMensuales = diasMensuales × (tieneVuelta ? 2 : 1)`, donde `tieneVuelta` se deriva de que el
bloque de datos de traslado tenga cargados los campos de vuelta. El cálculo MUST vivir en una función
pura en `frontend/src/shared/lib/presupuestos/calculoViajes.ts`, sin dependencias de React ni de red.

#### Scenario: 23 días hábiles con vuelta son 46 viajes

- **WHEN** se calcula con `diasMensuales = 23` y vuelta cargada
- **THEN** el resultado es `46`

#### Scenario: Regresión del valor incorrecto del documento de referencia

- **GIVEN** que el documento de referencia que el equipo usaba contaba 23 días hábiles como 24 viajes
- **WHEN** se calcula con `diasMensuales = 23` y vuelta cargada
- **THEN** el resultado NO es `24`
- **AND** existe un test nombrado explícitamente como regresión de ese valor

#### Scenario: Sin vuelta se cuenta un viaje por día

- **WHEN** se calcula con `diasMensuales = 23` y sin datos de vuelta
- **THEN** el resultado es `23`

#### Scenario: Cero días

- **WHEN** se calcula con `diasMensuales = 0`
- **THEN** el resultado es `0`, con o sin vuelta

### Requirement: Kilómetros mensuales derivados de ida y vuelta

El sistema SHALL calcular los kilómetros mensuales como
`kmMensuales = diasMensuales × (kmIda + (tieneVuelta ? kmVuelta : 0))`, en la misma función pura.

#### Scenario: Km con ida y vuelta distintos

- **WHEN** se calcula con `diasMensuales = 20`, `kmIda = 12.5`, `kmVuelta = 14`
- **THEN** el resultado es `530`

#### Scenario: Km solo de ida

- **WHEN** se calcula con `diasMensuales = 20`, `kmIda = 12.5` y sin datos de vuelta
- **THEN** el resultado es `250`

### Requirement: Los viajes mensuales no se persisten

El sistema MUST NOT persistir `viajesMensuales` ni `kmMensuales` como columnas de base de datos ni
como campos del tipo `Presupuesto`. Ambos MUST derivarse en el momento de mostrarlos, para no crear
una segunda fuente de verdad respecto de `diasMensuales`, `kmIda` y `kmVuelta`.

#### Scenario: No hay columna de viajes en el esquema

- **WHEN** se revisan las migraciones de este cambio
- **THEN** ninguna agrega una columna `viajes_mensuales` ni `km_mensuales`

#### Scenario: El total se recalcula al editar

- **GIVEN** un formulario de presupuesto con `diasMensuales = 20` y viajes mostrando `40`
- **WHEN** se cambia `diasMensuales` a `23`
- **THEN** el valor mostrado pasa a `46` sin guardar ni recargar
- **AND** el valor mostrado es de solo lectura, no un campo editable
