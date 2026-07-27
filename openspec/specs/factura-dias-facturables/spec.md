## ADDED Requirements

### Requirement: Cálculo de días facturables con exclusión de feriados
El sistema SHALL calcular los días facturables de un período mediante una **función pura** `diasFacturables({ mes, anio, feriados, facturaSabados })` que excluya los feriados del catálogo recibido, excluya los domingos, e incluya los sábados únicamente cuando la prestación así lo indique (RN-FA-03: "los feriados no se facturan; ciertos sábados sí se facturan, según la prestación — regla configurable, no uniforme"). El catálogo de feriados MUST recibirse por parámetro y MUST NOT estar hardcodeado dentro de la función ni de ningún componente.

#### Scenario: Los feriados quedan fuera
- **WHEN** se calculan los días facturables de un mes que contiene un feriado del catálogo
- **THEN** ese día no aparece entre los días facturables

#### Scenario: Sábados según la prestación
- **WHEN** se calcula con `facturaSabados: true`
- **THEN** los sábados del período aparecen entre los días facturables; y **WHEN** se calcula con `facturaSabados: false`, no aparecen

#### Scenario: Un feriado que cae sábado con prestación que factura sábados
- **WHEN** un sábado del período es feriado y la prestación factura sábados
- **THEN** ese día queda excluido, porque la exclusión de feriados prevalece (RN-FA-03: los feriados no se facturan)

#### Scenario: Catálogo de feriados inyectado
- **WHEN** se invoca la función con un catálogo de feriados vacío
- **THEN** no se excluye ningún día por feriado, demostrando que el calendario es un dato de entrada y no una constante interna

### Requirement: Selector visual de días facturables con cantidad editable
El sistema SHALL mostrar, en el formulario de factura, un selector de los días del período con los feriados y los días no facturables marcados visualmente como excluidos. La selección propuesta MUST ser editable por el usuario y la cantidad de días de la factura MUST ser el conteo final que el usuario confirme, porque US-400 establece que la cantidad de días se carga manualmente.

#### Scenario: Pre-selección sugerida al elegir el período
- **WHEN** el usuario selecciona mes y año en el formulario
- **THEN** el selector pre-selecciona los días facturables calculados y marca visualmente los feriados como excluidos

#### Scenario: El usuario puede corregir la selección
- **WHEN** el usuario marca o desmarca un día en el selector
- **THEN** la cantidad de días de la factura se actualiza al nuevo conteo, sin que el sistema la revierta al valor calculado

#### Scenario: Los feriados quedan identificables en la interfaz
- **WHEN** el período contiene feriados
- **THEN** cada uno se muestra señalizado como feriado, para que el usuario entienda por qué no está pre-seleccionado

### Requirement: Catálogo de feriados como fixture reemplazable
El sistema SHALL proveer el catálogo de feriados como un fixture en `frontend/src/shared/lib/mocks/feriadosFixture.ts` (feriados nacionales del año del fixture), consumido por la pantalla e inyectado en la función pura, de modo que el backend pueda reemplazarlo por una tabla o un servicio sin modificar la función ni los componentes.

#### Scenario: El fixture cubre el período de las facturas sembradas
- **WHEN** se siembran los fixtures de facturación
- **THEN** el catálogo de feriados incluye al menos un feriado dentro del período de alguna factura del fixture, para que la regla sea observable en la interfaz sin cargar datos a mano
