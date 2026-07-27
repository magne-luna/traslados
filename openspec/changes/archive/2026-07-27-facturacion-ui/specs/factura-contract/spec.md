## ADDED Requirements

### Requirement: Tipos del dominio de Facturación
El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/factura.ts`, en modo strict y sin usar `any`. MUST incluir `Factura`, `AsistenciaPrestacion`, `Cobro`, `EstadoFactura` e `IdentificadorFactura`, cruzando `knowledge-base/04_modelo_de_datos.md §Factura` (+ US-400, RN-FA-01 a RN-FA-08) con `docs/core/Traslados-Modelo-Datos.docx §5 Facturación` (entidades **Facturas** y **Cobros**). Los tipos ya definidos por otros dominios MUST importarse, nunca redefinirse.

#### Scenario: Campos de Factura provenientes del docx
- **WHEN** se declara `Factura`
- **THEN** contiene los campos que el docx modela (`id`, `pacienteId`, `descripcion`, `dias`, `valorKm`, `monto`, `estado`, `fechaInicial`, `fechaTope`, `tipoComprobante`), referenciando el paciente por id y sin embeber el `Paciente`

#### Scenario: Campos agregados sobre el docx para soportar las reglas de negocio
- **WHEN** se declara `Factura`
- **THEN** contiene además `cantidadKm: number` (necesario para el cupo de km, RN-FA-02) y `fechaEstimadaCobro?: string` (RN-FA-04), ambos comentados como campos **agregados sobre el docx** (design.md Discrepancias 3 y 4), más los campos estructurados de la descripción (`prestacion`, `mesFacturado`, `anioFacturado`, `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`) y `fechaFactura?`

#### Scenario: Período estructurado, no texto libre
- **WHEN** se declara el período que cubre la factura
- **THEN** se modela como `mesFacturado: number` (1-12) y `anioFacturado: number`, no como un string libre, para poder validar el cupo mensual (RN-FA-02) y agregar por año (`C-11`)

#### Scenario: Identificador del paciente congelado en la factura
- **WHEN** se declara `IdentificadorFactura`
- **THEN** contiene `{ origen: IdentificadorOrigenFactura; valor: string }`, importando `IdentificadorOrigenFactura` de `obraSocial.ts`, de modo que la factura conserve el identificador resuelto al emitirla (IN-01, RN-FA-06)

#### Scenario: Estado como unión cerrada de literales
- **WHEN** se declara `EstadoFactura`
- **THEN** es la unión cerrada `'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` (nunca `string` libre), tomando la enumeración de la KB/US-400 y tratando el `pendiente` del docx como sinónimo de `a-facturar` (design.md Discrepancia 5)

#### Scenario: AsistenciaPrestacion sin ninguna referencia al recorrido (RN-FA-01)
- **WHEN** se declara `AsistenciaPrestacion` (`id`, `fecha`, `prestacion`, `dependencia`, `retorno`, `facturaSabados`)
- **THEN** no contiene ningún campo que referencie `Recorrido`, `HojaDeRuta` o `ParadaRecorrido`, y `factura.ts` no importa nada de `hojaDeRuta.ts`, garantizando estructuralmente que lo facturado no se deriva ni valida contra el recorrido efectivo

#### Scenario: Cobro con id propio
- **WHEN** se declara `Cobro`
- **THEN** contiene `id: string`, `facturaId: string`, `fecha: string` (ISO) y `montoPagado: number`; el `id` es un campo agregado sobre el docx (design.md Discrepancia 7) requerido para keys estables

#### Scenario: Reutilización de tipos de otros dominios, no redefinición
- **WHEN** se declaran los tipos de `factura.ts`
- **THEN** `TipoComprobante`, `PlantillaFactura`, `PlantillaCampo`, `OrigenCampoPlantilla` e `IdentificadorOrigenFactura` se importan de `obraSocial.ts`, `CupoAutorizado` de `presupuesto.ts`, y `ChecklistItem`/`DocumentoAdjunto`/`EntidadDocumental` de `documento.ts`, sin redefinirlos localmente

#### Scenario: Tipos de entrada sin id
- **WHEN** se declaran los payloads de creación y edición (`NuevaFactura`, `ActualizacionFactura`, `NuevoCobro`, `ActualizacionCobro`)
- **THEN** ninguno incluye `id`; el `id` lo asigna la implementación del repository

### Requirement: Interfaces FacturaRepository y CobroRepository
El sistema SHALL definir las interfaces `FacturaRepository` (`list()`, `getById(id)`, `listByPaciente(pacienteId)`, `create(data)`, `update(id, data)`) y `CobroRepository` (`listByFactura(facturaId)`, `create(data)`, `remove(id)`) en `frontend/src/shared/lib/facturacion/`, de modo que ninguna pantalla hable con la fuente de datos directamente. Las `AsistenciaPrestacion` viven embebidas en la `Factura` (agregado); los `Cobro` son entidad propia con repository propio.

#### Scenario: getById de un registro inexistente
- **WHEN** se invoca `getById(id)` con un valor que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Edición de asistencias como mutación del agregado
- **WHEN** se agrega, quita o edita una `AsistenciaPrestacion`
- **THEN** el cambio se persiste vía `FacturaRepository.update(id, data)` sobre la `Factura` completa, sin requerir un repository de asistencias aparte

#### Scenario: Cobros consultables por factura
- **WHEN** se invoca `CobroRepository.listByFactura(facturaId)`
- **THEN** devuelve solo los cobros de esa factura, sin requerir listar todos los cobros del sistema

### Requirement: Implementaciones mock con persistencia en localStorage
El sistema SHALL proveer implementaciones mock de `FacturaRepository` y `CobroRepository` en `frontend/src/shared/lib/mocks/` que cumplan las interfaces al pie de la letra, persistan en `localStorage` con un `schemaVersion` y devuelvan promesas con latencia simulada, para ejercitar estados de carga y error reales.

#### Scenario: Siembra de fixtures coherentes
- **WHEN** no hay datos de facturas o cobros en `localStorage`
- **THEN** los mocks siembran fixtures cuyos `pacienteId` existen en `pacientesFixture` y cuya obra social existe en el fixture de obras sociales, incluyendo al menos: un paciente con `amparoJudicial: true`, una autorización con cupos de días y km cargados, una factura por cada estado del circuito, y una factura con cobros parciales

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza una factura o un cobro y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion o payload corrupto
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o no se puede deserializar
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

### Requirement: Constantes de facturación configurables en un único módulo
El sistema SHALL declarar los plazos sin confirmar con el cliente como constantes exportadas y documentadas en `frontend/src/shared/lib/facturacion/constantes.ts` (`PLAZO_COBRO_DEFAULT_DIAS = 90`, `PLAZO_COBRO_AMPARO_DIAS = 45`, `PLAZO_ALERTA_VENCIDA_DIAS = 60`), siguiendo el patrón ya establecido en `shared/lib/mantenimiento/constantes.ts`. Estos valores MUST NOT aparecer como números literales dentro de componentes ni de funciones de dominio.

#### Scenario: Los plazos no se hardcodean en componentes
- **WHEN** un componente o una función de dominio necesita un plazo de cobro o de alerta
- **THEN** lo importa de `constantes.ts` o lo recibe por parámetro, y no contiene el literal `90`, `45` ni `60` en su cuerpo

#### Scenario: Cada constante documenta su regla de origen y su estado de confirmación
- **WHEN** se lee `constantes.ts`
- **THEN** cada constante cita la regla que la origina (RN-FA-04, RF-406) y deja explícito que el valor está **pendiente de confirmar con el cliente** (`10_preguntas_abiertas.md`, prioridad Alta)

### Requirement: Señalización de las discrepancias con el docx
El sistema SHALL mostrar el componente `AvisoModeloDatos` en la pantalla de facturación, agrupando en un único cartel las cinco discrepancias de impacto backend entre `docs/core/Traslados-Modelo-Datos.docx §5 Facturación` y las reglas de negocio de la KB.

#### Scenario: Cartel visible en la pantalla de facturación
- **WHEN** se abre la pantalla de facturación
- **THEN** se muestra un único `AvisoModeloDatos` indicando que el modelo real no tiene entidad de asistencias/prestaciones, no tiene documentos adjuntos por factura, no tiene fecha estimada de cobro, no tiene cantidad de km, y enumera estados distintos a los de la KB — coherente con `knowledge-base/04_modelo_de_datos.md §Discrepancias`, `CHANGES.md §C-07` y `design.md §Discrepancias`
