## Requirements

### Requirement: Listado de obras sociales
El sistema SHALL mostrar un listado de las obras sociales existentes obtenido a través de `ObraSocialRepository.list()`, con estados de carga y error visibles (US-300, RF-300). Cada fila MUST mostrar al menos nombre, CUIT del prestador y tipo de comprobante.

#### Scenario: Carga inicial del listado
- **WHEN** el usuario abre la pantalla de obras sociales
- **THEN** se muestra un indicador de carga mientras `list()` está pendiente y luego la lista de obras sociales

#### Scenario: Listado vacío
- **WHEN** no hay obras sociales cargadas
- **THEN** se muestra un estado vacío con la acción de crear la primera obra social

### Requirement: Alta de obra social
El sistema SHALL permitir crear una obra social capturando nombre, CUIT, plazo de cobro (días), tipo
de comprobante A/B/C, modalidad de facturación (por prestación vs. general) y si admite pagos
parciales/por lote (US-300, RF-300 a RF-306), **más los cuatro campos del modelo de datos real:
código, dirección, teléfono y condición frente al IVA**, los cuatro opcionales. La creación MUST usar
`ObraSocialRepository.create()` y, contra la implementación real, MUST completarse como una única
operación atómica del servidor: la obra social, su checklist y su plantilla de factura quedan todos, o
no queda ninguno.

#### Scenario: Alta exitosa
- **WHEN** el usuario completa los campos requeridos y confirma
- **THEN** la obra social se persiste vía `create()` y aparece en el listado

#### Scenario: Validación de campos requeridos
- **WHEN** el usuario intenta guardar sin nombre o sin CUIT
- **THEN** el formulario bloquea el guardado y señala los campos faltantes

#### Scenario: Los campos del modelo real son opcionales
- **WHEN** el usuario guarda una obra social sin código, dirección, teléfono ni condición frente al
  IVA
- **THEN** el alta se completa con normalidad
- **AND** esos campos quedan vacíos y editables después

#### Scenario: El alta no puede quedar a medias
- **GIVEN** un alta con checklist y plantilla de factura cargados
- **WHEN** cualquier parte de la escritura falla
- **THEN** no queda ninguna obra social creada, ni un checklist huérfano, ni una plantilla parcial
- **AND** el usuario recibe un mensaje de error en castellano

#### Scenario: Un CUIT ya usado se rechaza con un mensaje claro
- **WHEN** el usuario intenta dar de alta una obra social con un CUIT que ya existe
- **THEN** el guardado se rechaza con un mensaje que nombra el CUIT duplicado
- **AND** el formulario permanece con los datos cargados, sin perderlos

### Requirement: Edición de obra social
El sistema SHALL permitir editar una obra social existente, incluyendo sus condiciones por prestador,
su checklist y su plantilla de factura, vía `ObraSocialRepository.update()`. La actualización SHALL
ser **parcial**: los campos y las colecciones que el usuario no tocó MUST quedar intactos. Contra la
implementación real, la edición MUST completarse como una única operación atómica del servidor y MUST
devolver el estado realmente persistido, no un merge optimista.

#### Scenario: Edición exitosa
- **WHEN** el usuario modifica un campo de una obra social existente y confirma
- **THEN** el cambio se persiste vía `update()` y se refleja en el listado

#### Scenario: Manejo de error del repository
- **WHEN** una operación de create/update falla en el repository
- **THEN** la UI muestra un mensaje de error y no deja la pantalla en un estado de carga infinito

#### Scenario: Editar solo los datos básicos no toca el checklist
- **GIVEN** una obra social con checklist configurado
- **WHEN** el usuario edita únicamente el nombre y guarda
- **THEN** el checklist queda exactamente como estaba
- **AND** su orden y su obligatoriedad no cambian

#### Scenario: La edición devuelve lo que quedó en la base
- **WHEN** una edición se completa con éxito
- **THEN** la obra social devuelta proviene de una relectura
- **AND** refleja los defaults y normalizaciones aplicados por el servidor
