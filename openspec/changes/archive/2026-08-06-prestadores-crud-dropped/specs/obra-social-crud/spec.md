## MODIFIED Requirements

### Requirement: Listado de obras sociales

El sistema SHALL mostrar un listado de las obras sociales existentes obtenido a través de
`ObraSocialRepository.list()`, con estados de carga y error visibles (US-300, RF-300). Cada fila MUST
mostrar al menos nombre y CUIT del prestador. `tipoComprobante` YA NO se muestra en esta fila — pasó
a ser un campo de `Prestador` (ver `prestador-crud`).
(Previously: cada fila también mostraba `tipoComprobante`.)

#### Scenario: Carga inicial del listado

- **WHEN** el usuario abre la pantalla de obras sociales
- **THEN** se muestra un indicador de carga mientras `list()` está pendiente y luego la lista de
  obras sociales

#### Scenario: Listado vacío

- **WHEN** no hay obras sociales cargadas
- **THEN** se muestra un estado vacío con la acción de crear la primera obra social

### Requirement: Alta de obra social

El sistema SHALL permitir crear una obra social capturando nombre, CUIT del prestador, modalidad de
facturación (por prestación vs. general), si admite pagos parciales/por lote (US-300, RF-300 a
RF-306), y los Prestadores vinculados mediante un selector múltiple sobre la relación N:N (ver
`obra-social-prestador-vinculo`). La creación MUST usar `ObraSocialRepository.create()`.
`plazoCobroDias` y `tipoComprobante` YA NO se capturan en este formulario — pasaron a `Prestador`
(ver `prestador-crud`), como parte del mismo supuesto provisorio **SIN confirmar con Andrea**.
(Previously: también capturaba plazo de cobro (días) y tipo de comprobante A/B/C como campos propios
de la obra social.)

#### Scenario: Alta exitosa

- **WHEN** el usuario completa los campos requeridos y confirma
- **THEN** la obra social se persiste vía `create()` y aparece en el listado

#### Scenario: Validación de campos requeridos

- **WHEN** el usuario intenta guardar sin nombre o sin CUIT
- **THEN** el formulario bloquea el guardado y señala los campos faltantes

#### Scenario: Selector de Prestadores vinculados al dar de alta (N:N, provisorio)

- **GIVEN** que la relación entre ObraSocial y Prestador es N:N (supuesto #1, confirmado con Enzo
  pero **SIN confirmar con Andrea**)
- **WHEN** el usuario da de alta una ObraSocial
- **THEN** puede asociar cero o más Prestadores existentes mediante un selector múltiple
- **AND** el vínculo se persiste a través de la capacidad `obra-social-prestador-vinculo`, no como un
  campo embebido en `ObraSocial`

### Requirement: Edición de obra social

El sistema SHALL permitir editar una obra social existente, incluyendo su modalidad de facturación,
si admite pagos parciales, y los Prestadores vinculados, vía `ObraSocialRepository.update()`.
`plazoCobroDias`/`tipoComprobante` YA NO se editan desde este formulario — se editan desde
`Prestador` (ver `prestador-crud`).
(Previously: "incluyendo sus condiciones por prestador" — frase que en la práctica cubría editar
`plazoCobroDias`/`tipoComprobante` como campos propios de `ObraSocial`.)

#### Scenario: Edición exitosa

- **WHEN** el usuario modifica un campo de una obra social existente y confirma
- **THEN** el cambio se persiste vía `update()` y se refleja en el listado

#### Scenario: Manejo de error del repository

- **WHEN** una operación de create/update falla en el repository
- **THEN** la UI muestra un mensaje de error y no deja la pantalla en un estado de carga infinito

#### Scenario: Editar los Prestadores vinculados

- **WHEN** el usuario agrega o quita un Prestador del selector de vínculos y confirma
- **THEN** el cambio se persiste vía la capacidad `obra-social-prestador-vinculo`, sin afectar los
  demás campos de la ObraSocial
