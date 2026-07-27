## ADDED Requirements

### Requirement: Listado de obras sociales
El sistema SHALL mostrar un listado de las obras sociales existentes obtenido a través de `ObraSocialRepository.list()`, con estados de carga y error visibles (US-300, RF-300). Cada fila MUST mostrar al menos nombre, CUIT del prestador y tipo de comprobante.

#### Scenario: Carga inicial del listado
- **WHEN** el usuario abre la pantalla de obras sociales
- **THEN** se muestra un indicador de carga mientras `list()` está pendiente y luego la lista de obras sociales

#### Scenario: Listado vacío
- **WHEN** no hay obras sociales cargadas
- **THEN** se muestra un estado vacío con la acción de crear la primera obra social

### Requirement: Alta de obra social
El sistema SHALL permitir crear una obra social capturando nombre, CUIT del prestador, plazo de cobro (días), tipo de comprobante A/B/C, modalidad de facturación (por prestación vs. general) y si admite pagos parciales/por lote (US-300, RF-300 a RF-306). La creación MUST usar `ObraSocialRepository.create()`.

#### Scenario: Alta exitosa
- **WHEN** el usuario completa los campos requeridos y confirma
- **THEN** la obra social se persiste vía `create()` y aparece en el listado

#### Scenario: Validación de campos requeridos
- **WHEN** el usuario intenta guardar sin nombre o sin CUIT
- **THEN** el formulario bloquea el guardado y señala los campos faltantes

### Requirement: Edición de obra social
El sistema SHALL permitir editar una obra social existente, incluyendo sus condiciones por prestador, vía `ObraSocialRepository.update()`.

#### Scenario: Edición exitosa
- **WHEN** el usuario modifica un campo de una obra social existente y confirma
- **THEN** el cambio se persiste vía `update()` y se refleja en el listado

#### Scenario: Manejo de error del repository
- **WHEN** una operación de create/update falla en el repository
- **THEN** la UI muestra un mensaje de error y no deja la pantalla en un estado de carga infinito
