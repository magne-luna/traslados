## ADDED Requirements

### Requirement: Checklist documental por factura configurable por obra social
El sistema SHALL permitir adjuntar la documentación de respaldo de cada factura (comprobante de ARCA, asistencia, CODEM y demás) reutilizando el patrón documental transversal del proyecto: el componente `DocumentChecklist` con `DocumentoRepository` usando `entidad = 'factura'` y `entidadId = factura.id`. Los ítems del checklist MUST provenir del checklist configurable de la obra social del paciente, y su orden MUST respetarse tal como lo exige cada obra social (RN-FA-08).

#### Scenario: Los ítems salen de la obra social del paciente
- **WHEN** se abre la documentación de una factura
- **THEN** los ítems del checklist son los configurados en la obra social del paciente, no una lista fija propia de facturación

#### Scenario: El orden de los ítems se respeta
- **WHEN** la obra social define sus ítems en un orden determinado
- **THEN** el checklist los presenta en ese mismo orden (RN-FA-08)

#### Scenario: Obras sociales distintas, checklists distintos
- **WHEN** se abren las facturas de dos pacientes con obras sociales diferentes
- **THEN** cada una muestra el checklist de su propia obra social

#### Scenario: Adjuntar y quitar un documento
- **WHEN** el usuario adjunta un archivo a un ítem del checklist
- **THEN** el documento se registra vía `DocumentoRepository.upload()` con `entidad = 'factura'`, aparece marcado como cargado, y puede quitarse vía `remove()`

#### Scenario: Estado de completitud visible
- **WHEN** faltan ítems requeridos por cargar
- **THEN** el checklist muestra qué falta, sin bloquear la emisión de la factura

### Requirement: Comprobante de ARCA como adjunto manual, sin integración automática
El sistema SHALL tratar el comprobante de ARCA como un ítem más del checklist documental de la factura, cargado manualmente por el usuario (mínimo viable según `08_arquitectura_propuesta.md §ARCA`). El sistema MUST NOT realizar ninguna llamada a la API de ARCA, ni definir campos, componentes o variables de entorno específicos de ARCA, dado que el nivel de automatización sigue sin confirmarse con el cliente (pregunta abierta de prioridad Alta).

#### Scenario: Carga manual del comprobante
- **WHEN** el usuario adjunta el comprobante de ARCA
- **THEN** se registra como un documento más del checklist de la factura, con el mismo mecanismo que cualquier otro adjunto

#### Scenario: Sin acoplamiento a ARCA
- **WHEN** se revisa el código de la feature de facturación
- **THEN** no existe ningún cliente HTTP, campo de modelo ni variable de entorno dedicados a ARCA

#### Scenario: Arquitectura abierta a la automatización futura
- **WHEN** en el futuro se implemente una integración automática con ARCA
- **THEN** deberá producir el mismo `DocumentoAdjunto` a través de otra implementación de `DocumentoRepository`, sin requerir cambios en las pantallas de facturación

### Requirement: Señalización de la ausencia de documentos por factura en el modelo real
El sistema SHALL señalizar, mediante `AvisoModeloDatos`, que el modelo de datos real no contempla documentos adjuntos por factura, y que la tabla correspondiente debe crearse en el backend antes de cerrar el esquema.

#### Scenario: Aviso visible junto a la documentación de la factura
- **WHEN** se abre la sección de documentación de una factura
- **THEN** el aviso de modelo de datos indica que el docx no tiene tabla de documentos por factura (a diferencia de Presupuesto y Autorización, que tienen un campo "Archivo" único) y que este checklist multi-documento es un agregado pendiente de confirmar
