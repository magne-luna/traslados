## MODIFIED Requirements

### Requirement: Formulario de autorización ligado a un presupuesto
El sistema SHALL proveer un formulario de autorización asociado a un presupuesto existente (por `presupuestoId`), con selector de estado, monto autorizado, cupo mensual de días y de km editables, fecha de respuesta, fecha de vigencia y archivo único adjunto. Contra la implementación real, la resolución de la autorización de un presupuesto MUST tratar la ausencia como un estado normal —no como un error— y el estado inicial MUST provenir del default del servidor.

#### Scenario: La autorización se crea sobre un presupuesto existente
- **WHEN** se crea una autorización
- **THEN** referencia un `presupuestoId` de un presupuesto que existe, y el detalle del presupuesto muestra su autorización resuelta vía `AutorizacionRepository.getByPresupuestoId`

#### Scenario: Un presupuesto sin autorización muestra el alta, no un error
- **GIVEN** un presupuesto recién creado, todavía sin autorización
- **WHEN** se abre su detalle contra la implementación real
- **THEN** `getByPresupuestoId` resuelve `null`
- **AND** la pantalla ofrece cargar la autorización, sin mostrar ningún mensaje de error

#### Scenario: Selector de estado con los cuatro valores
- **WHEN** se edita el estado de una autorización
- **THEN** el selector ofrece exactamente `pendiente`, `autorizada`, `judicializada` y `rechazada` (unión cerrada `EstadoAutorizacion`), y el flujo esperado `pendiente → autorizada → judicializada → rechazada` está documentado

#### Scenario: El estado inicial lo define el servidor
- **GIVEN** una autorización recién creada sin estado explícito
- **WHEN** se lee desde el servidor
- **THEN** su estado es `pendiente`, por el valor por defecto declarado en la columna
- **AND** el frontend NO define ese default por su cuenta

#### Scenario: Cambiar el estado no toca los cupos ya cargados
- **GIVEN** una autorización con cupo mensual de días y de km cargados
- **WHEN** el usuario cambia únicamente el estado y guarda
- **THEN** los cupos quedan exactamente como estaban
- **AND** la actualización enviada al servidor no incluye esos campos

#### Scenario: Cupo mensual de días/km visible y editable
- **WHEN** se carga o edita una autorización
- **THEN** los campos `cupoMensualDias` y `cupoMensualKm` son visibles y editables (RN-PA-03), y quedan persistidos en la autorización

### Requirement: Carga retroactiva con fecha de vigencia independiente
El sistema SHALL permitir fijar una `vigenciaDesde` anterior a la fecha de carga/respuesta de la autorización, para soportar la carga retroactiva (RN-PA-02), tratando `vigenciaDesde` como un campo distinto de `fechaRespuesta`. Contra la implementación real, `vigenciaDesde` MUST persistirse en su propia columna del servidor y MUST sobrevivir al viaje de ida y vuelta.

#### Scenario: Vigencia anterior a la fecha de respuesta
- **WHEN** se carga una autorización en abril con `vigenciaDesde` en enero
- **THEN** el formulario acepta la vigencia retroactiva sin bloquear, y persiste `vigenciaDesde` distinto de `fechaRespuesta`

#### Scenario: La vigencia retroactiva persiste en el servidor
- **GIVEN** una autorización guardada con `vigenciaDesde` anterior a `fechaRespuesta`
- **WHEN** se vuelve a leer desde el servidor en otra sesión
- **THEN** los dos valores vuelven con sus fechas originales y siguen siendo distintos

#### Scenario: El cartel de discrepancia refleja lo que sigue siendo cierto
- **WHEN** se muestra el campo de fecha de vigencia
- **THEN** un `AvisoModeloDatos` indica que `vigenciaDesde` y `montoAutorizado` no existen en el modelo del docx
- **AND** el cartel ya NO los describe como pendientes de confirmar con backend, porque son columnas reales del servidor
- **AND** el cartel no se elimina por completo: la discrepancia con el docx sigue vigente

### Requirement: Archivo único adjunto de la autorización
El sistema SHALL modelar la documentación de la autorización como un `archivo?: ArchivoAdjunto` único (input de un solo archivo), no como colección multi-documento. Contra la implementación real, el sistema MUST señalizar que el archivo elegido todavía no se sube al servidor, y MUST NOT perder una referencia de archivo ya persistida al editar otros campos.

#### Scenario: Un solo archivo por autorización
- **WHEN** se adjunta documentación a la autorización
- **THEN** el formulario ofrece un input de un único archivo, coherente con el "Archivo" único del docx, con `AvisoModeloDatos` señalando la discrepancia con el patrón multi-doc que asumía `CHANGES.md`

#### Scenario: El archivo adjunto todavía no se guarda en el servidor
- **GIVEN** la pantalla cableada contra la implementación real
- **WHEN** el usuario selecciona un archivo en el formulario de autorización
- **THEN** un `AvisoModeloDatos` indica que el archivo todavía no se sube al servidor
- **AND** el guardado no reporta como persistido un archivo que no lo está

#### Scenario: Editar la autorización no borra una referencia de archivo existente
- **GIVEN** una autorización cuyo archivo ya está referenciado en el servidor
- **WHEN** el usuario cambia el estado y guarda sin tocar el archivo
- **THEN** la referencia al archivo queda intacta
