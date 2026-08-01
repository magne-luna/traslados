## MODIFIED Requirements

### Requirement: Categoría de intervención de mantenimiento en dos niveles

El sistema SHALL clasificar cada registro de mantenimiento de un vehículo con la categoría de **dos niveles** del modelo de datos real (`docs/core/Traslados-Modelo-Datos.docx`, entidad Mantenimiento, campo Categoría — "Tipo de intervención: gasto, mantenimiento preventivo o mantenimiento correctivo") combinada con el sub-tipo de intervención de US-500 (`knowledge-base/06_funcionalidades.md`).

El **nivel 1 (tipo de intervención)** MUST ser un conjunto cerrado con los tres valores que nombra el docx: gasto, preventivo y correctivo. El sistema MUST NOT introducir valores de nivel 1 que el docx no nombre.

El **nivel 2 (sub-tipo)** MUST existir únicamente dentro de las dos categorías de mantenimiento (preventivo y correctivo); un registro de nivel 1 "gasto" MUST NOT tener sub-tipo.

El nivel 2 de **preventivo** MUST ser un conjunto cerrado: cambio de aceite/filtros, VTV y RTO — los tres que enumera US-500 sin apertura, y los tres que tienen una regla de negocio asociada (RN-VE-03 para el cambio de aceite, RN-VE-04 para VTV y RTO).

El nivel 2 de **correctivo** MUST admitir sub-tipos fuera del catálogo conocido, porque US-500 lo deja abierto ("alternador, batería, frenos, embrague, cubiertas, **etc.**"). Esa apertura MUST implementarse como un valor explícito de escape del catálogo que exige un detalle en texto libre, y MUST NOT implementarse como un sub-tipo de tipo `string` libre.

Con la implementación real, los dos niveles MUST persistirse en columnas propias de `conductores.mantenimiento`: `categoria` (el enum de Postgres ya existente, que coincide exactamente con el nivel 1), más `subtipo TEXT`, `detalle TEXT` y `descripcion TEXT`, aditivas. El sistema SHALL escribir en `subtipo` y `detalle` exactamente los valores de las uniones del frontend — el mismo literal que usa el tipo `MantenimientoRegistro`, sin traducirlos ni abreviarlos — y MUST NOT inventar ningún valor que esas uniones no contemplen. La coherencia entre `categoria`, `subtipo` y `detalle` MUST estar reforzada en la base con el constraint `chk_categoria_subtipo`, declarado `NOT VALID` en la migración que lo crea (patrón expand/contract: se valida en un paso posterior y separado, después de confirmar que no hay filas existentes que lo violen).

> ⚠️ **Gap abierto (2026-08-01) — ver `design.md` §Reconciliación, `#### Gap abierto`.** `descripcion`
> ya fue agregada por el backend real (`C-08-vehiculos-mantenimiento`, `20260730110000_schema_vehiculo_gaps.sql`),
> compartida con el uso de `vehiculo-gastos`. **`subtipo` y `detalle` todavía no existen** en la base
> real, y la Edge Function `vehiculos/index.ts` no expone ningún array de intervenciones
> preventivas/correctivas para leerlas o escribirlas. El párrafo de arriba sigue siendo la
> especificación normativa de la forma deseada; su implementación real está bloqueada hasta
> coordinar con Enzo cuál de los dos caminos del gap abierto se toma — no se resuelve
> unilateralmente en este documento.

#### Scenario: Sub-tipos ofrecidos para una intervención preventiva
- **WHEN** se registra una intervención de tipo preventivo
- **THEN** los sub-tipos disponibles son exactamente cambio de aceite/filtros, VTV y RTO

#### Scenario: Sub-tipos ofrecidos para una intervención correctiva
- **WHEN** se registra una intervención de tipo correctivo
- **THEN** los sub-tipos disponibles incluyen alternador, batería, frenos, embrague y cubiertas, más un sub-tipo de escape para las intervenciones que no están en el catálogo

#### Scenario: Los sub-tipos de un nivel 1 no se ofrecen en el otro
- **WHEN** se cambia el tipo de intervención de preventivo a correctivo
- **THEN** los sub-tipos ofrecidos se reemplazan por los del nuevo tipo, y ningún sub-tipo de preventivo queda seleccionable como correctivo

#### Scenario: Sub-tipo de escape con detalle obligatorio
- **WHEN** se elige el sub-tipo de escape del catálogo correctivo y no se ingresa detalle
- **THEN** el registro se bloquea y se señala que el detalle es obligatorio

#### Scenario: Registro de nivel 1 "gasto" sin sub-tipo
- **WHEN** existe un registro de mantenimiento con tipo de intervención "gasto"
- **THEN** el registro no tiene ni exige sub-tipo, y el historial lo muestra identificando su tipo de intervención

#### Scenario: Persistencia con los valores exactos de la unión discriminada
- **GIVEN** un registro correctivo con sub-tipo `'alternador'`
- **WHEN** se persiste vía `VehiculoRepository.update()`
- **THEN** la columna `conductores.mantenimiento.subtipo` guarda exactamente el literal `'alternador'`, sin traducción ni normalización

#### Scenario: El CHECK garantiza la coherencia en la base, no solo en el frontend
- **GIVEN** la migración `20260801120000_conductores_vehiculos_campos.sql` aplicada
- **WHEN** se intenta insertar directamente en `conductores.mantenimiento` una fila con `categoria = 'gasto'` y `subtipo` no nulo, salteando el frontend
- **THEN** el `INSERT` es rechazado por `chk_categoria_subtipo` una vez que el constraint esté validado (`VALIDATE CONSTRAINT`, tarea separada y posterior a esta migración)

### Requirement: Registro de una intervención de mantenimiento

El sistema SHALL permitir registrar una intervención de mantenimiento de un vehículo (RF-507, US-500) con: el tipo de intervención (nivel 1), el sub-tipo (nivel 2, cuando corresponde), la fecha, el kilometraje del vehículo al momento de la intervención y, opcionalmente, el próximo vencimiento por fecha y el próximo vencimiento por kilometraje — los campos de la entidad Mantenimiento del docx.

Un registro de mantenimiento MUST NOT tener monto: el importe de un gasto se registra contra la capability `vehiculo-gastos`, que es la entidad separada del docx.

Cada registro MUST persistirse asociado a su vehículo vía `VehiculoRepository.update()`.

El alta desde la pantalla MUST ofrecer solo los tipos de intervención de mantenimiento (preventivo y correctivo); MUST NOT permitir dar de alta un registro de tipo "gasto", porque eso duplicaría la entidad Gastos de Vehículo del mismo modelo de datos.

Con la implementación real, el alta MUST resolverse dentro de la escritura multi-tabla atómica de `SupabaseVehiculoRepository` (capability `vehiculo-repository-supabase`): `subtipo`, `detalle` y `descripcion` viajan hasta sus columnas reales en `conductores.mantenimiento`, y una intervención que viole `chk_categoria_subtipo` MUST rechazarse con un mensaje que indique revisar la categoría de la intervención, sin exponer el nombre del constraint.

#### Scenario: Alta de una intervención preventiva
- **WHEN** el usuario elige tipo preventivo y sub-tipo cambio de aceite/filtros, ingresa fecha y kilometraje, y confirma
- **THEN** la intervención se agrega al historial del vehículo y se persiste

#### Scenario: Alta de una intervención correctiva fuera del catálogo
- **WHEN** el usuario elige tipo correctivo, el sub-tipo de escape, escribe el detalle de la intervención, ingresa fecha y kilometraje, y confirma
- **THEN** la intervención se agrega al historial conservando el detalle ingresado y se persiste

#### Scenario: Próximo vencimiento opcional
- **WHEN** el usuario registra una intervención sin indicar próximo vencimiento por fecha ni por kilometraje
- **THEN** el registro se acepta igual, porque ambos campos son opcionales

#### Scenario: Validación de fecha y kilometraje
- **WHEN** el usuario intenta registrar una intervención sin fecha, o con un kilometraje vacío o negativo
- **THEN** el formulario bloquea el registro y señala los campos inválidos

#### Scenario: El alta no ofrece el tipo "gasto"
- **WHEN** el usuario abre el formulario de alta de intervención
- **THEN** el selector de tipo de intervención ofrece preventivo y correctivo, y no ofrece "gasto"

#### Scenario: El registro de mantenimiento no pide importe
- **WHEN** el usuario recorre el formulario de alta de intervención
- **THEN** no hay ningún campo de monto, y el importe de la intervención se carga como gasto del vehículo por separado

#### Scenario: Persistencia real de la intervención vía el repository de Supabase
- **GIVEN** un usuario con `vehiculos: write`
- **WHEN** registra una intervención correctiva con el sub-tipo de escape y un detalle
- **THEN** la fila queda en `conductores.mantenimiento` con `categoria = 'correctivo'`, `subtipo = 'otro'` y el `detalle` ingresado
- **AND** la relectura posterior del vehículo devuelve el mismo registro, reconstruido por el mapeo puro

### Requirement: Historial de intervenciones del vehículo

El sistema SHALL mostrar el historial de intervenciones de mantenimiento del vehículo, con tipo de intervención, sub-tipo, fecha, kilometraje y próximo vencimiento de cada registro.

El tipo de intervención y el sub-tipo MUST comunicarse con **texto**, no solo con color (WCAG AA), reutilizando los componentes del design system del proyecto.

El historial MUST ser legible con nivel de acceso `read` sobre el módulo `vehiculos`; solo el alta MUST requerir nivel `write`.

> ⚠️ **Gap abierto (2026-08-01) — ver `design.md` §Reconciliación, `#### Gap abierto`.** El párrafo
> de abajo asume que el historial completo (`mantenimiento`) viaja embebido en la respuesta del
> vehículo. La Edge Function real `vehiculos/index.ts` **no expone ningún array `mantenimientos`**:
> solo deriva `kilometrajeUltimoService`/`fechaUltimoService` del último registro `preventivo` y
> filtra `gastos` de `categoria = 'gasto'`, pero no devuelve las intervenciones preventivas/
> correctivas en sí. Este requisito queda **bloqueado** hasta que se resuelva el gap (extender la
> Edge Function o construir `mantenimiento/index.ts`) — no se implementa una solución unilateral.

Con la implementación real, el historial se lee embebido en la misma consulta que el resto del vehículo (`conductores.vehiculo` → `mantenimiento`). Una fila cuya combinación de `categoria`/`subtipo`/`detalle` sea incoherente con la unión discriminada del frontend (posible mientras `chk_categoria_subtipo` es `NOT VALID`) MUST descartarse en el mapeo puro sin romper la lectura del resto del historial ni del vehículo.

#### Scenario: Historial poblado
- **WHEN** el vehículo tiene intervenciones registradas
- **THEN** se muestran en una tabla con tipo de intervención, sub-tipo, fecha, kilometraje y próximo vencimiento por fila

#### Scenario: Sin intervenciones registradas
- **WHEN** el vehículo no tiene ninguna intervención registrada
- **THEN** se muestra un estado vacío indicando que aún no hay intervenciones de mantenimiento registradas

#### Scenario: Sub-tipo de escape mostrado con su detalle
- **WHEN** una intervención correctiva usa el sub-tipo de escape del catálogo
- **THEN** la fila muestra el detalle en texto libre que se ingresó, no solo la etiqueta genérica del sub-tipo

#### Scenario: Categoría comunicada con texto además de color
- **WHEN** se muestra el tipo de intervención de un registro
- **THEN** su etiqueta se lee como texto, y el color es refuerzo y no el único canal de información

#### Scenario: Historial legible en modo solo lectura
- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta abre el historial de mantenimiento de un vehículo
- **THEN** el historial se lee completo y la acción de registrar una intervención está visible y no se puede activar

#### Scenario: Una fila incoherente con el CHECK se descarta sin romper el historial completo
- **GIVEN** una fila de `conductores.mantenimiento` cuya combinación de `categoria`/`subtipo`/`detalle` no corresponde a ningún miembro de `MantenimientoRegistro`
- **WHEN** se lee el vehículo que la contiene
- **THEN** esa fila se omite del historial mostrado
- **AND** el resto de las intervenciones y el resto del vehículo se muestran con normalidad, sin error de carga

### Requirement: El historial no es la fuente de verdad de los vencimientos

> ✅ **Resuelto por el checkpoint D3 del `design.md` de `integracion-conductores-vehiculos` (opción B, 2026-07-31).** Este requisito, que antes valía por igual para el service preventivo y para las habilitaciones VTV/RTO, **se parte en dos**: sigue valiendo tal cual para el service preventivo y **se invierte** para VTV/RTO, que pasan a derivarse del historial. La duplicación que este requisito señalizaba como pendiente **deja de existir**, y el aviso en pantalla cambia de contenido en consecuencia.
>
> ⚠️ **SUPERSEDED (2026-08-01) — ver `design.md` §Reconciliación con C-08-vehiculos-mantenimiento,
> D3.** La resolución de la usuaria fue la opción B (derivar de `mantenimiento`), descripta abajo.
> El backend real, ya mergeado (Enzo, `C-08-vehiculos-mantenimiento`), implementó la **opción A**
> que D3 había descartado: una tabla propia `conductores.habilitaciones_vehiculo(id, vehiculo_id,
> tipo, fecha_emision, fecha_vencimiento)`, con RLS gateada por `vehiculos`. **Las habilitaciones
> VTV/RTO NO se derivan del historial en la implementación real** — se leen y se escriben
> directamente en esa tabla, vía la Edge Function `vehiculos/index.ts`. La duplicación de
> vencimiento que este requisito daba por eliminada **sigue existiendo** en la base real: un
> vencimiento de VTV puede estar cargado como intervención preventiva en `mantenimiento` **y**
> como fila de `habilitaciones_vehiculo`, sin nada que las mantenga sincronizadas. Se documenta como
> discrepancia con el docx (que no distingue una tabla propia) — no se resuelve acá. El párrafo
> original se conserva abajo como registro de la decisión que la usuaria tomó, todavía válida para
> el **mock** (`derivarHabilitaciones()`, tasks.md 2B.1), pero no para el repository real.

El sistema SHALL seguir calculando el estado del **service preventivo** (capability `vehiculo-mantenimiento`, RN-VE-03) a partir del kilometraje y las fechas del propio vehículo (`kilometraje`, `kilometrajeUltimoService`, `fechaUltimoService`), y MUST NOT derivarlo de los registros del historial. Los campos de próximo vencimiento **por kilometraje** de un registro de mantenimiento siguen siendo informativos: registrar una intervención MUST NOT alterar por sí solo el estado de alerta del service.

Con la decisión original de este documento (vigente para el **mock**, superada para el repository real — ver nota de arriba), las **habilitaciones VTV y RTO** (RN-VE-04) SHALL derivarse del historial: `Vehiculo.habilitaciones` se calcula de las intervenciones preventivas de sub-tipo `'vtv'` / `'rto'` con próximo vencimiento por fecha informado, según la regla fijada en `vehiculo-contract` y en la capability `vehiculo-repository-supabase`. El historial SHALL ser, para esos dos sub-tipos, **la única fuente de verdad**; el sistema MUST NOT mantener ninguna colección de habilitaciones persistida aparte, ni ofrecer un alta de habilitación separada del alta de intervención de mantenimiento.

**Con la implementación real (vigente para `SupabaseVehiculoRepository`):** las habilitaciones VTV/RTO SHALL leerse y escribirse directamente en la tabla `conductores.habilitaciones_vehiculo` a través de la Edge Function `vehiculos` (reemplazo completo por `DELETE`+`INSERT`, igual semántica de colección que el resto de las tablas hijas). El repository real MUST NOT llamar a `derivarHabilitaciones()` — esa función queda vigente únicamente para `mockVehiculoRepository`.

Esta asimetría —service preventivo calculado del vehículo, habilitaciones derivadas del historial (mock) / leídas de tabla propia (real)— MUST quedar señalizada en la pantalla con el componente de aviso de modelo de datos del proyecto. El `AvisoModeloDatos` MUST decir que, en la implementación real, el vencimiento de VTV/RTO se registra en una tabla propia (`habilitaciones_vehiculo`) y no vía el historial de mantenimiento como describe el docx (*"el vencimiento se rastrea vía mantenimiento"*) — divergencia que sigue abierta — y que el kilometraje y el último service son campos propios de Vehículo, derivados del historial por la Edge Function.

#### Scenario: Alta de intervención sin efecto sobre la alerta de service preventivo
- **WHEN** se registra una intervención preventiva de cambio de aceite con un próximo vencimiento por kilometraje
- **THEN** el estado de alerta del service preventivo del vehículo sigue siendo el que calculan las funciones puras a partir del kilometraje y la fecha del último service del vehículo, sin cambiar por el registro nuevo

#### Scenario: Alta de una VTV sí actualiza la habilitación mostrada — vigente solo en el mock
> Con `mockVehiculoRepository` (que sigue usando `derivarHabilitaciones()`), este escenario se
> cumple igual. Con `SupabaseVehiculoRepository` real, el alta de habilitación **no** pasa por una
> intervención de mantenimiento: es una fila propia en `habilitaciones_vehiculo` (ver nota
> SUPERSEDED arriba) — el escenario equivalente para la implementación real se agrega abajo.
- **WHEN** se registra una intervención preventiva de sub-tipo VTV con próximo vencimiento por fecha
- **THEN** tras la relectura del vehículo, la habilitación VTV mostrada pasa a ser la derivada de ese registro
- **AND** no hace falta ninguna carga adicional en otra sección de la pantalla

#### Scenario: Alta de una VTV/RTO en la tabla propia (implementación real, vigente)
- **GIVEN** un usuario con `vehiculos: write`
- **WHEN** guarda un vehículo con una entrada de `habilitaciones` de tipo VTV con fecha de emisión y de vencimiento
- **THEN** la Edge Function reemplaza por completo las filas de `conductores.habilitaciones_vehiculo` de ese vehículo (`DELETE` + `INSERT`)
- **AND** la relectura posterior del vehículo devuelve esa habilitación

#### Scenario: No existe un alta de habilitación separada del historial — ⚠️ SUPERSEDED para el repository real
> Vigente solo para el mock. En la implementación real, el alta de habilitación **es** un flujo
> separado del alta de intervención de mantenimiento (ambos viajan en el mismo payload de
> `update()`/`create()`, pero como colecciones distintas — `habilitaciones` y `mantenimientos`/
> `gastos` — no como una derivación de la otra). Se conserva como registro de la decisión superada.
- **WHEN** el usuario busca dónde cargar el vencimiento de una VTV o una RTO
- **THEN** el único lugar es el alta de intervención de mantenimiento, eligiendo tipo preventivo y el sub-tipo correspondiente
- **AND** la sección que muestra las habilitaciones indica de dónde salen cuando está vacía, en vez de sugerir que faltan datos por cargar en otro lado

#### Scenario: Aviso de modelo de datos actualizado — contenido ajustado a la realidad
- **WHEN** el usuario abre la sección de mantenimiento de un vehículo
- **THEN** el aviso explica que VTV/RTO se registran en una tabla propia (`habilitaciones_vehiculo`), divergente del docx (*"se rastrea vía mantenimiento"*)
- **AND** el aviso señala que esa divergencia con el docx sigue abierta, pendiente de confirmar con Enzo/backend
- **AND** el aviso sigue señalando que el kilometraje y el último service son campos propios del vehículo, derivados del historial por la Edge Function y no del lado del frontend
