## MODIFIED Requirements

### Requirement: Interfaces FacturaRepository y CobroRepository
El sistema SHALL definir las interfaces `FacturaRepository` (`list()`, `getById(id)`, `listByPaciente(pacienteId)`, `create(data)`, `update(id, data)`) y `CobroRepository` (`list()`, `listByFactura(facturaId)`, `create(data)`, `remove(id)`) en `frontend/src/shared/lib/facturacion/`, de modo que ninguna pantalla hable con la fuente de datos directamente. Las `AsistenciaPrestacion` viven embebidas en la `Factura` (agregado); los `Cobro` son entidad propia con repository propio.

`CobroRepository.list()` MUST devolver todos los cobros del sistema en una sola lectura, para que las agregaciones por período (`C-11`) se calculen sin hacer una llamada por factura. La adición MUST ser puramente aditiva: `listByFactura`, `create` y `remove` conservan su firma y su comportamiento, y ninguna pantalla existente de facturación cambia.

**Ambas interfaces pasan a tener dos implementaciones** —una mock y una real contra Supabase— que MUST ser intercambiables sin que ningún componente, hook, context ni función pura de la feature cambie. En consecuencia, **el contrato de errores deja de ser una convención del mock y pasa a ser normativo**: toda implementación MUST lanzar `Error` (nunca un objeto de error del proveedor, nunca un string) con un `message` en castellano apto para mostrarse directamente al usuario, y MUST NOT propagar texto crudo del servidor. `getById` MUST resolver `null` —nunca lanzar— tanto cuando el registro no existe como cuando el control de acceso lo oculta.

> Nota de archivo: esta versión del requerimiento incorpora la extensión aditiva de `CobroRepository.list()` introducida por `C-11` (dashboard-ui) sobre la definición original de `facturacion-ui`, más la promoción del contrato de errores a normativo introducida por `integracion-facturacion`.

#### Scenario: getById de un registro inexistente
- **WHEN** se invoca `getById(id)` con un valor que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: getById de un registro que el control de acceso oculta
- **GIVEN** un usuario sin permiso de lectura sobre facturación
- **WHEN** se invoca `getById(id)` sobre una factura que sí existe
- **THEN** la promesa resuelve `null`, con el mismo comportamiento que si no existiera
- **AND** NO se lanza un error de permisos

#### Scenario: Las dos implementaciones lanzan la misma forma de error
- **WHEN** una operación de escritura falla en el mock y falla en la implementación real
- **THEN** ambas lanzan una instancia de `Error`
- **AND** el `message` está en castellano y no contiene nombres de tablas, columnas ni códigos del proveedor

#### Scenario: Edición de asistencias como mutación del agregado
- **WHEN** se agrega, quita o edita una `AsistenciaPrestacion`
- **THEN** el cambio se persiste vía `FacturaRepository.update(id, data)` sobre la `Factura` completa, sin requerir un repository de asistencias aparte

#### Scenario: Cobros consultables por factura
- **WHEN** se invoca `CobroRepository.listByFactura(facturaId)`
- **THEN** devuelve solo los cobros de esa factura, sin requerir listar todos los cobros del sistema

#### Scenario: Lectura de todos los cobros para agregación por período
- **WHEN** se invoca `CobroRepository.list()`
- **THEN** devuelve todos los cobros persistidos, de todas las facturas, en una sola llamada, de modo que un reporte por período no necesite invocar `listByFactura` una vez por factura

#### Scenario: Sin cobros registrados
- **WHEN** se invoca `CobroRepository.list()` y no hay ningún cobro persistido
- **THEN** resuelve un array vacío, nunca `null` ni un error

#### Scenario: Coherencia entre list y listByFactura
- **WHEN** se comparan los resultados de `list()` y de `listByFactura(facturaId)` para una factura existente
- **THEN** los cobros que `listByFactura` devuelve son exactamente los elementos de `list()` cuyo `facturaId` coincide, sin diferencias de contenido ni de cantidad

### Requirement: Implementaciones mock con persistencia en localStorage
El sistema SHALL proveer implementaciones mock de `FacturaRepository` y `CobroRepository` en `frontend/src/shared/lib/mocks/` que cumplan las interfaces al pie de la letra, persistan en `localStorage` con un `schemaVersion` y devuelvan promesas con latencia simulada, para ejercitar estados de carga y error reales.

Las implementaciones mock **dejan de ser las implementaciones inyectadas en la aplicación** y pasan a existir como **dobles de test y modo de desarrollo sin backend**. El sistema MUST conservarlas y MUST NOT borrarlas. La aplicación MUST inyectar las implementaciones reales contra Supabase.

#### Scenario: Los mocks se conservan como dobles de test
- **WHEN** se ejecutan los tests de la feature de facturación
- **THEN** los repositories mock siguen exportándose y siendo inyectables
- **AND** ningún test de la feature depende de la red

#### Scenario: La aplicación no inyecta los mocks
- **WHEN** se inspecciona el punto de composición de la feature de facturación
- **THEN** los repositories inyectados son los reales contra Supabase
- **AND** los mocks no se importan desde código de producto

#### Scenario: Siembra de fixtures coherentes
- **WHEN** no hay datos de facturas o cobros en `localStorage`
- **THEN** los mocks siembran fixtures cuyos `pacienteId` existen en `pacientesFixture` y cuya obra social existe en el fixture de obras sociales, incluyendo al menos: un paciente con `amparoJudicial: true`, una autorización con cupos de días y km cargados, una factura por cada estado del circuito, y una factura con cobros parciales

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza una factura o un cobro y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion o payload corrupto
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o no se puede deserializar
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

### Requirement: Señalización de las discrepancias con el docx
El sistema SHALL mostrar el componente `AvisoModeloDatos` en la pantalla de facturación, agrupando en un único cartel las discrepancias vigentes entre `docs/core/Traslados-Modelo-Datos.docx §5 Facturación`, las reglas de negocio de la KB y **el esquema real verificado en el proyecto de Supabase**.

El cartel MUST reflejar el estado **verificado** del esquema, no el estado asumido. Cuatro de las cinco discrepancias originales fueron absorbidas por el esquema real (existen la tabla de asistencias/prestaciones, la de documentos por factura, la fecha estimada de cobro y la cantidad de km) y por lo tanto MUST retirarse del cartel. El sistema MUST enumerar en su lugar las discrepancias que siguen vigentes, y MUST NOT declarar como discrepancia algo que el esquema real ya resolvió.

#### Scenario: El cartel refleja el esquema verificado, no el asumido
- **WHEN** se abre la pantalla de facturación
- **THEN** el cartel NO menciona la ausencia de asistencias/prestaciones, de documentos por factura, de fecha estimada de cobro ni de cantidad de km
- **AND** sí menciona que el enum de estados del modelo real incluye un estado que la aplicación no modela, que la fecha de emisión de la factura es un agregado sobre el docx, y que la factura no congela la obra social con la que se emitió

#### Scenario: La documentación acompaña al cartel
- **WHEN** se retira o se agrega una discrepancia del cartel
- **THEN** el mismo cambio queda reflejado en `knowledge-base/04_modelo_de_datos.md §Discrepancias` y en `CHANGES.md`
- **AND** ninguna discrepancia se cierra sin dejar registro de por qué

#### Scenario: Los documentos de la factura conviven con dos fuentes
- **GIVEN** que la factura se persiste contra el servidor pero sus documentos adjuntos todavía no
- **WHEN** se abre el checklist documental de una factura
- **THEN** se señaliza que los adjuntos aún no se persisten junto con la factura
- **AND** la señalización remite al change de integración de documentos y almacenamiento
