# Delta for Presupuesto Contract

## MODIFIED Requirements

### Requirement: Tipos del dominio de Presupuestos y Autorizaciones

El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/presupuesto.ts`, en modo strict y sin usar `any`. MUST incluir `Presupuesto` (id, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivo?`, `prestacionId?`), `Autorizacion` (id, `presupuestoId`, `estado`, `fechaRespuesta?`, `montoAutorizado?`, `vigenciaDesde?`, `cupoMensualDias?`, `cupoMensualKm?`, `archivo?`), la unión `EstadoAutorizacion`, la proyección `CupoAutorizado` y la referencia `ArchivoAdjunto` (cruce de `04_modelo_de_datos.md §Presupuesto/Autorizacion` con `docs/core/Traslados-Modelo-Datos.docx §Facturación`). La forma de los tipos MUST NOT cambiar para acomodar los nombres de la base ni los de la API: toda traducción vive en el mapeo. `prestacionId` MUST ser opcional (`string | undefined`), `undefined` en modalidad `general` y poblado únicamente en modalidad `por-prestacion`. `monto` MUST NOT cambiar de tipo ni de semántica al agregar `prestacionId` (KB discrepancia #13, no reabierta).
(Previously: `Presupuesto` no tenía ningún campo de vínculo con prestaciones.)

#### Scenario: Estado de autorización como conjunto cerrado tipado

- **WHEN** se declara el campo `estado` de una autorización
- **THEN** su tipo es `EstadoAutorizacion`, una unión de literales `'pendiente' | 'autorizada' | 'judicializada' | 'rechazada'`, y no `string` libre

#### Scenario: Presupuesto y Autorización referencian entidades por id

- **WHEN** se declara `Presupuesto` y `Autorizacion`
- **THEN** `Presupuesto` contiene `pacienteId: string` y `obraSocialId: string` (no embebe `Paciente` ni `ObraSocial`), y `Autorizacion` contiene `presupuestoId: string` (no embebe el `Presupuesto`)

#### Scenario: Documentación adjunta como archivo único, no colección

- **WHEN** se declara la documentación adjunta de un presupuesto o de una autorización
- **THEN** es un `archivo?: ArchivoAdjunto` único por entidad (referencia a un solo archivo), y NO una colección multi-documento ni una entrada nueva en `EntidadDocumental` (`documento.ts`), por coincidir con el modelo real del docx (un solo "Archivo" por entidad)

#### Scenario: Campos agregados sobre el docx quedan marcados como opcionales

- **WHEN** se declaran `montoAutorizado` y `vigenciaDesde` en `Autorizacion`
- **THEN** ambos son opcionales (`?`), por ser campos que el contrato del frontend agrega sobre el modelo del docx para soportar RN-PA-01 y RN-PA-02

#### Scenario: Los campos agregados dejaron de estar pendientes de confirmar

- **GIVEN** que `montoAutorizado` y `vigenciaDesde` ya existen como columnas reales (`facturacion.autorizacion.monto_autorizado` y `.vigencia_desde`, backend `C-06`)
- **WHEN** se documentan en el tipo
- **THEN** el comentario NO los describe como "pendientes de confirmar con backend"
- **AND** deja constancia de que el docx sigue sin tenerlos, que es lo que sí sigue siendo cierto

#### Scenario: El adjunto no tiene contraparte completa en la persistencia real

- **GIVEN** que la base modela el adjunto como una sola columna `archivo_url`
- **WHEN** se documenta `ArchivoAdjunto` (`nombre`, `cargadoEn`)
- **THEN** el tipo deja constancia de que `cargadoEn` se deriva de la fecha de la propia entidad y no se persiste por separado
- **AND** deja constancia de que la subida del archivo al servidor todavía no está implementada

#### Scenario: `prestacionId` opcional y coherente con la modalidad de la obra social

- **GIVEN** que la obra social del presupuesto tiene `modalidadFacturacion = 'por-prestacion'`
- **WHEN** se declara `prestacionId` en `Presupuesto`
- **THEN** el campo es `string | undefined`, nunca requerido
- **AND** en un presupuesto de una obra social `general` su valor es `undefined`, nunca una cadena vacía

### Requirement: Interfaces PresupuestoRepository y AutorizacionRepository

El sistema SHALL definir las interfaces `PresupuestoRepository` (`list()`, `getById(id)`, `create(data)`, `createLote(datas)`, `update(id, data)`) y `AutorizacionRepository` (`list()`, `getById(id)`, `getByPresupuestoId(presupuestoId)`, `create(data)`, `update(id, data)`) en `frontend/src/shared/lib/presupuestos/`, de modo que ninguna pantalla hable con la fuente de datos directamente. Las interfaces MUST NOT crecer para exponer capacidades del servidor que ninguna pantalla usa. `createLote(nuevos: NuevoPresupuesto[]): Promise<Presupuesto[]>` MUST crear todos los presupuestos del lote de forma atómica: o resuelve con todos, o rechaza sin persistir ninguno. `create(data)` MUST NOT cambiar de firma para acomodar el alta en lote.
(Previously: `PresupuestoRepository` solo tenía `create(data)` para alta de un único presupuesto; no existía operación de lote.)

#### Scenario: getById de un registro inexistente

- **WHEN** se invoca `getById(id)` (o `getByPresupuestoId(id)`) con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Tipos de entrada sin id

- **WHEN** se invoca `create(data)` en cualquiera de los dos repositories
- **THEN** el tipo del payload (`NuevoPresupuesto` / `NuevaAutorizacion`) no incluye `id`, y el `id` lo asigna la implementación del repository

#### Scenario: Actualización parcial en las dos implementaciones

- **GIVEN** un `update(id, cambios)` donde `cambios` omite varias claves
- **WHEN** lo resuelve cualquiera de las dos implementaciones
- **THEN** las claves omitidas quedan exactamente como estaban
- **AND** las dos implementaciones se comportan igual en este punto

#### Scenario: Las interfaces no exponen borrado

- **GIVEN** que el backend real soporta borrar presupuestos y autorizaciones
- **WHEN** se revisan las interfaces
- **THEN** ninguna declara un método de borrado
- **AND** agregarlo requeriría una decisión de negocio, no solo de implementación

#### Scenario: `createLote` con un ítem inválido no crea ningún presupuesto

- **GIVEN** un arreglo de 3 `NuevoPresupuesto` donde el tercero es inválido
- **WHEN** se invoca `createLote(nuevos)`
- **THEN** la promesa rechaza
- **AND** ningún presupuesto del lote queda persistido, incluidos los dos primeros válidos

### Requirement: Implementaciones mock con persistencia en localStorage

El sistema SHALL proveer implementaciones mock de ambos repositories en `frontend/src/shared/lib/mocks/` que cumplan las interfaces al pie de la letra, persistan en `localStorage` con un `schemaVersion` y devuelvan promesas con latencia simulada, para ejercitar estados de carga y error reales. Los mocks SHALL conservarse como **dobles de test y modo de desarrollo sin backend**, y MUST NOT seguir siendo lo que la aplicación inyecta en la pantalla de Presupuestos. El mock de `PresupuestoRepository` MUST implementar `createLote` con la misma semántica atómica que la implementación real.
(Previously: no exigía `createLote` en el mock porque la operación no existía.)

#### Scenario: Siembra del fixture inicial

- **WHEN** no hay datos de presupuestos/autorizaciones en `localStorage`
- **THEN** los mocks siembran fixtures coherentes: presupuestos ligados a `pacienteId`/`obraSocialId` que existen en los fixtures de pacientes/obras sociales, y al menos una autorización por cada estado relevante (incluyendo una con `vigenciaDesde` anterior a su `fechaRespuesta`)

#### Scenario: Persistencia entre recargas

- **WHEN** se crea o actualiza un presupuesto o autorización y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion

- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

#### Scenario: Los mocks no se borran ni se siembran en la base real

- **WHEN** la pantalla pasa a usar la implementación real
- **THEN** los mocks siguen existiendo como dobles de test
- **AND** sus fixtures NO se convierten en datos sembrados en la base real

## ADDED Requirements

### Requirement: Payload de alta con dos formas legítimas según modalidad

El sistema SHALL aceptar dos formas de payload de alta según `ObraSocial.modalidadFacturacion`:
en `por-prestacion`, un arreglo de `NuevoPresupuesto` (uno por prestación, cada uno con
`prestacionId` poblado) enviado a `createLote`; en `general`, un único `NuevoPresupuesto` con
`prestacionId` ausente/`undefined` y `monto` igual a la suma de las líneas del formulario, enviado
a `create`. El sistema MUST NOT aceptar un payload de alta que mezcle ambas formas en la misma
llamada.

#### Scenario: Payload de lote válido en `por-prestacion`

- GIVEN una obra social `por-prestacion` con 2 prestaciones seleccionadas y monto cada una
- WHEN se arma el payload de alta
- THEN es un arreglo de 2 `NuevoPresupuesto`, cada uno con su propio `prestacionId` y `monto`

#### Scenario: Payload simple válido en `general`

- GIVEN una obra social `general` con líneas sumando 500
- WHEN se arma el payload de alta
- THEN es un único `NuevoPresupuesto` con `monto = 500` y sin `prestacionId`
