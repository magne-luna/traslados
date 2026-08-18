# Delta for Autorización Gestión

## MODIFIED Requirements

### Requirement: Archivo único adjunto de la autorización

El sistema SHALL modelar la documentación de la autorización como un `archivo?: ArchivoAdjunto` único
(input de un solo archivo), no como colección multi-documento. Contra la implementación real, el
sistema SHALL subir y persistir el archivo elegido contra el bucket `documentos-autorizaciones`
(capability `autorizacion-archivo-storage`), y MUST NOT perder una referencia de archivo ya persistida
al editar otros campos.

(Previously: el sistema MUST señalizar que el archivo elegido todavía no se sube al servidor. Este
pendiente se cierra en este change.)

#### Scenario: Un solo archivo por autorización

- **WHEN** se adjunta documentación a la autorización
- **THEN** el formulario ofrece un input de un único archivo, coherente con el "Archivo" único del
  docx, con `AvisoModeloDatos` señalando la discrepancia con el patrón multi-doc que asumía
  `CHANGES.md`

#### Scenario: El archivo adjunto se guarda en el servidor

- **GIVEN** la pantalla cableada contra la implementación real
- **WHEN** el usuario selecciona un archivo en el formulario de autorización y guarda
- **THEN** el archivo se sube al bucket `documentos-autorizaciones` y la fila se actualiza con su
  referencia, su nombre y su fecha de carga reales
- **AND** el guardado reporta como persistido un archivo que efectivamente lo está
- **AND** ya no aparece ningún `AvisoModeloDatos` de "todavía no se guarda en el servidor"

#### Scenario: Reemplazar el archivo adjunto deja solo el nuevo

- **GIVEN** una autorización con un archivo ya guardado
- **WHEN** el usuario sube un archivo distinto en su lugar
- **THEN** al terminar la autorización referencia únicamente el archivo nuevo, con su propio nombre y
  fecha de carga

#### Scenario: Editar la autorización no borra una referencia de archivo existente

- **GIVEN** una autorización cuyo archivo ya está referenciado en el servidor
- **WHEN** el usuario cambia el estado y guarda sin tocar el archivo
- **THEN** la referencia al archivo queda intacta
