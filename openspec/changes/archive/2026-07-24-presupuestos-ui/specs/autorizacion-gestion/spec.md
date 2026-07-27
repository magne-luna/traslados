## ADDED Requirements

### Requirement: Formulario de autorización ligado a un presupuesto
El sistema SHALL proveer un formulario de autorización asociado a un presupuesto existente (por `presupuestoId`), con selector de estado, monto autorizado, cupo mensual de días y de km editables, fecha de respuesta, fecha de vigencia y archivo único adjunto.

#### Scenario: La autorización se crea sobre un presupuesto existente
- **WHEN** se crea una autorización
- **THEN** referencia un `presupuestoId` de un presupuesto que existe, y el detalle del presupuesto muestra su autorización resuelta vía `AutorizacionRepository.getByPresupuestoId`

#### Scenario: Selector de estado con los cuatro valores
- **WHEN** se edita el estado de una autorización
- **THEN** el selector ofrece exactamente `pendiente`, `autorizada`, `judicializada` y `rechazada` (unión cerrada `EstadoAutorizacion`), y el flujo esperado `pendiente → autorizada → judicializada → rechazada` está documentado

#### Scenario: Cupo mensual de días/km visible y editable
- **WHEN** se carga o edita una autorización
- **THEN** los campos `cupoMensualDias` y `cupoMensualKm` son visibles y editables (RN-PA-03), y quedan persistidos en la autorización

### Requirement: Carga retroactiva con fecha de vigencia independiente
El sistema SHALL permitir fijar una `vigenciaDesde` anterior a la fecha de carga/respuesta de la autorización, para soportar la carga retroactiva (RN-PA-02), tratando `vigenciaDesde` como un campo distinto de `fechaRespuesta`.

#### Scenario: Vigencia anterior a la fecha de respuesta
- **WHEN** se carga una autorización en abril con `vigenciaDesde` en enero
- **THEN** el formulario acepta la vigencia retroactiva sin bloquear, y persiste `vigenciaDesde` distinto de `fechaRespuesta`

#### Scenario: Cartel de discrepancia por campo agregado
- **WHEN** se muestra el campo de fecha de vigencia
- **THEN** un `AvisoModeloDatos` indica que `vigenciaDesde` es un campo que el frontend agrega sobre el modelo del docx (que solo tiene "Fecha de respuesta"), pendiente de confirmar con backend (design.md Discrepancia 3)

### Requirement: Archivo único adjunto de la autorización
El sistema SHALL modelar la documentación de la autorización como un `archivo?: ArchivoAdjunto` único (input de un solo archivo), no como colección multi-documento.

#### Scenario: Un solo archivo por autorización
- **WHEN** se adjunta documentación a la autorización
- **THEN** el formulario ofrece un input de un único archivo, coherente con el "Archivo" único del docx, con `AvisoModeloDatos` señalando la discrepancia con el patrón multi-doc que asumía `CHANGES.md` (design.md Discrepancia 1)
