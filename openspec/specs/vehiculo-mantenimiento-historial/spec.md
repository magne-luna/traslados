## ADDED Requirements

### Requirement: Categoría de intervención de mantenimiento en dos niveles

El sistema SHALL clasificar cada registro de mantenimiento de un vehículo con la categoría de **dos niveles** del modelo de datos real (`docs/core/Traslados-Modelo-Datos.docx`, entidad Mantenimiento, campo Categoría — "Tipo de intervención: gasto, mantenimiento preventivo o mantenimiento correctivo") combinada con el sub-tipo de intervención de US-500 (`knowledge-base/06_funcionalidades.md`).

El **nivel 1 (tipo de intervención)** MUST ser un conjunto cerrado con los tres valores que nombra el docx: gasto, preventivo y correctivo. El sistema MUST NOT introducir valores de nivel 1 que el docx no nombre.

El **nivel 2 (sub-tipo)** MUST existir únicamente dentro de las dos categorías de mantenimiento (preventivo y correctivo); un registro de nivel 1 "gasto" MUST NOT tener sub-tipo.

El nivel 2 de **preventivo** MUST ser un conjunto cerrado: cambio de aceite/filtros, VTV y RTO — los tres que enumera US-500 sin apertura, y los tres que tienen una regla de negocio asociada (RN-VE-03 para el cambio de aceite, RN-VE-04 para VTV y RTO).

El nivel 2 de **correctivo** MUST admitir sub-tipos fuera del catálogo conocido, porque US-500 lo deja abierto ("alternador, batería, frenos, embrague, cubiertas, **etc.**"). Esa apertura MUST implementarse como un valor explícito de escape del catálogo que exige un detalle en texto libre, y MUST NOT implementarse como un sub-tipo de tipo `string` libre.

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

### Requirement: Registro de una intervención de mantenimiento

El sistema SHALL permitir registrar una intervención de mantenimiento de un vehículo (RF-507, US-500) con: el tipo de intervención (nivel 1), el sub-tipo (nivel 2, cuando corresponde), la fecha, el kilometraje del vehículo al momento de la intervención y, opcionalmente, el próximo vencimiento por fecha y el próximo vencimiento por kilometraje — los campos de la entidad Mantenimiento del docx.

Un registro de mantenimiento MUST NOT tener monto: el importe de un gasto se registra contra la capability `vehiculo-gastos`, que es la entidad separada del docx.

Cada registro MUST persistirse asociado a su vehículo vía `VehiculoRepository.update()`.

El alta desde la pantalla MUST ofrecer solo los tipos de intervención de mantenimiento (preventivo y correctivo); MUST NOT permitir dar de alta un registro de tipo "gasto", porque eso duplicaría la entidad Gastos de Vehículo del mismo modelo de datos.

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

### Requirement: Historial de intervenciones del vehículo

El sistema SHALL mostrar el historial de intervenciones de mantenimiento del vehículo, con tipo de intervención, sub-tipo, fecha, kilometraje y próximo vencimiento de cada registro.

El tipo de intervención y el sub-tipo MUST comunicarse con **texto**, no solo con color (WCAG AA), reutilizando los componentes del design system del proyecto.

El historial MUST ser legible con nivel de acceso `read` sobre el módulo `vehiculos`; solo el alta MUST requerir nivel `write`.

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

### Requirement: El historial no es la fuente de verdad de los vencimientos

El sistema SHALL seguir calculando el estado del service preventivo y de las habilitaciones VTV/RTO (capability `vehiculo-mantenimiento`, RN-VE-03/04) a partir del kilometraje y las fechas del propio vehículo, y MUST NOT derivarlo de los registros del historial en este cambio.

Los campos de próximo vencimiento de un registro de mantenimiento son informativos: registrar una intervención MUST NOT alterar por sí solo el estado de alerta calculado del vehículo.

Esta separación entre el registro histórico y el estado vigente MUST quedar señalizada en la pantalla con el componente de aviso de modelo de datos del proyecto, porque contradice al docx, que ubica el kilometraje actual y los próximos vencimientos en la entidad Mantenimiento.

#### Scenario: Alta de intervención sin efecto sobre las alertas
- **WHEN** se registra una intervención preventiva de cambio de aceite con un próximo vencimiento por kilometraje
- **THEN** el estado de alerta del service preventivo del vehículo sigue siendo el que calculan las funciones puras a partir del kilometraje y la fecha del último service del vehículo, sin cambiar por el registro nuevo

#### Scenario: Aviso de discrepancia visible en la pantalla
- **WHEN** el usuario abre la sección de mantenimiento de un vehículo
- **THEN** la pantalla muestra el aviso de modelo de datos explicando que el vencimiento de VTV/RTO se sigue rastreando en las habilitaciones del vehículo y no en el historial, pendiente de resolver contra el modelo real
