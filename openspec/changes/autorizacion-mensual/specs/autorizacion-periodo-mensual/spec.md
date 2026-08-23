# Spec: Autorización por período mensual

## ADDED Requirements

### Requirement: La autorización pertenece a un mes calendario, con unicidad por presupuesto+mes

El sistema SHALL permitir que una `Autorizacion` declare un `periodoMes?: string` (ISO `YYYY-MM-01`,
primer día del mes calendario), persistido en `facturacion.autorizacion.periodo_mes` (`DATE`,
`CHECK (periodo_mes IS NULL OR EXTRACT(DAY FROM periodo_mes) = 1)`). Un mismo `presupuestoId` MUST
admitir múltiples filas de `Autorizacion`, una por mes, y el sistema MUST rechazar una segunda fila
para el mismo `(presupuestoId, periodoMes)` mediante el índice único parcial
`idx_autorizacion_presupuesto_periodo` (`WHERE periodo_mes IS NOT NULL`). El campo `periodoMes` MUST
normalizarse a día 1 antes de compararse o persistirse, mediante la función pura
`normalizarPeriodoMes`.

#### Scenario: Alta de un mes nuevo para un presupuesto que ya tiene otros meses cargados

- **GIVEN** un presupuesto con autorizaciones ya cargadas para marzo y abril de 2026
- **WHEN** se carga una autorización para mayo de 2026
- **THEN** se guarda como una fila independiente, sin reemplazar ni tocar las de marzo/abril

#### Scenario: Mes duplicado rechazado con mensaje de dominio

- **GIVEN** un presupuesto con una autorización ya cargada para abril de 2026
- **WHEN** se intenta cargar una segunda autorización para el mismo presupuesto y el mismo mes
- **THEN** el guardado falla con el mensaje "Ya existe una autorización para ese mes en este presupuesto."
- **AND** el mensaje no expone el código `23505` crudo de Postgres

#### Scenario: normalizarPeriodoMes acepta distintos formatos de entrada

- **WHEN** se normaliza `'2026-03'`, `'2026-03-15'` o `'2026-03-01'`
- **THEN** las tres entradas producen `'2026-03-01'`

#### Scenario: normalizarPeriodoMes rechaza una entrada inválida

- **WHEN** se normaliza un valor que no representa una fecha válida
- **THEN** la función lanza un error de dominio, sin inventar un string ni devolver `undefined`

#### Scenario: El día 1 es la única cerradura válida de la unicidad

- **GIVEN** un presupuesto con una autorización de `periodoMes = '2026-03-01'`
- **WHEN** se intenta insertar una fila con `periodo_mes = '2026-03-15'` para el mismo presupuesto
- **THEN** la base rechaza la fila por el `CHECK` de día 1 antes de que el índice único la evalúe

### Requirement: Filas legacy sin período conviven sin backfill

El sistema MUST NOT completar `periodoMes` para autorizaciones creadas antes de este cambio:
`periodoMes` ausente (`undefined`/`NULL`) significa "autorización del modelo anterior" y MUST NOT
inferirse de `fechaRespuesta` ni de `vigenciaDesde`. Una fila legacy MUST poder coexistir en el
mismo presupuesto con filas que sí tienen `periodoMes`.

#### Scenario: Una autorización creada antes de este change sigue funcionando

- **GIVEN** una autorización sin `periodoMes`, creada antes de este cambio
- **WHEN** se lee o se muestra
- **THEN** su `periodoMes` es `undefined`, nunca un mes inventado
- **AND** sigue siendo editable y facturable como antes

#### Scenario: Legacy y mensual conviven en el mismo presupuesto

- **GIVEN** un presupuesto con una autorización legacy sin `periodoMes`
- **WHEN** se agrega una autorización nueva con `periodoMes = '2026-04-01'`
- **THEN** ambas filas coexisten sin conflicto de unicidad (el índice es parcial, `WHERE periodo_mes
  IS NOT NULL`)

### Requirement: El ordinal "Mes N" y la etiqueta se derivan, nunca se persisten

El sistema SHALL derivar, mediante funciones puras en `periodoAutorizacion.ts`, el ordinal 1-based de
un `periodoMes` dentro de los períodos cargados de su presupuesto (`ordinalMes`) y su etiqueta en
español (`etiquetaPeriodoMes`). Ninguna columna ni tabla MUST persistir ese ordinal.

#### Scenario: El ordinal se calcula por orden cronológico, no por orden de carga

- **GIVEN** un presupuesto con autorizaciones para abril y marzo de 2026, cargadas en ese orden
  (abril primero)
- **WHEN** se deriva el ordinal de cada una
- **THEN** marzo resuelve a `1` y abril a `2`, sin importar cuál se cargó primero (RN-PA-02, carga
  fuera de orden)

#### Scenario: Un mes salteado no corrompe el ordinal de los siguientes

- **GIVEN** un presupuesto con autorizaciones para marzo y mayo de 2026 (abril nunca llegó)
- **WHEN** se derivan los ordinales
- **THEN** marzo es `1` y mayo es `2`, no `3`

#### Scenario: Las filas legacy no tienen ordinal ni corren la numeración

- **GIVEN** un presupuesto con una autorización legacy sin `periodoMes` y dos autorizaciones
  mensuales
- **WHEN** se derivan los ordinales
- **THEN** la fila legacy no recibe ningún ordinal
- **AND** las dos filas mensuales se numeran `1` y `2`, sin que la legacy corra la numeración

#### Scenario: Etiqueta en español, nunca un mes inventado

- **WHEN** se deriva la etiqueta de `periodoMes = '2026-03-01'`
- **THEN** el resultado es `'marzo 2026'`

#### Scenario: Etiqueta de una fila legacy

- **WHEN** se deriva la etiqueta de una autorización sin `periodoMes`
- **THEN** el resultado es `'Sin mes cargado'`, nunca un mes inventado

### Requirement: La RPC de alta de presupuesto auto-crea un único mes, derivado de la vigencia

El sistema SHALL derivar `periodo_mes` de la autorización auto-creada por
`crear_presupuesto_completo`/`crear_presupuestos_lote` a partir de `date_trunc('month',
vigencia_desde)`, sin agregar ninguna rama condicional nueva. Cuando el presupuesto no trae
`vigencia_desde`, el comportamiento MUST ser byte a byte el de antes de este change (autorización
`pendiente` con `periodo_mes NULL`). El sistema MUST NOT auto-crear más de una autorización por
alta.

#### Scenario: Alta con vigencia conocida

- **WHEN** se crea un presupuesto con `vigenciaDesde = '2026-03-15'`
- **THEN** la autorización auto-creada tiene `periodo_mes = '2026-03-01'`

#### Scenario: Alta sin vigencia se comporta igual que antes de este change

- **WHEN** se crea un presupuesto sin `vigenciaDesde`
- **THEN** la autorización auto-creada tiene `periodo_mes = NULL`, idéntico al comportamiento previo
  a este change

#### Scenario: Nunca se auto-crean los N meses del rango de vigencia

- **WHEN** se crea un presupuesto con una vigencia de 12 meses
- **THEN** se auto-crea exactamente **una** autorización (el primer mes), no doce
