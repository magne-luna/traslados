# Spec: Vista previa del archivo de la autorización

## ADDED Requirements

### Requirement: URL firmada con modo explícito inline o descarga

El sistema SHALL exponer `AutorizacionRepository.getUrlArchivo(id, modo)` con
`modo: 'inline' | 'descarga'`, resuelto contra el bucket privado `documentos-autorizaciones` mediante
una URL firmada de expiración corta. En modo `'inline'` la firma MUST omitir la opción `download`,
para que Storage sirva el objeto con su `Content-Type` y el navegador lo renderice. En modo
`'descarga'` MUST pasarla, para forzar `Content-Disposition: attachment`. El método MUST devolver
`null` cuando la autorización no tiene archivo, sin lanzar.

#### Scenario: Abrir en otra pestaña no descarga

- **GIVEN** una autorización con un PDF cargado
- **WHEN** se abre el archivo en una pestaña nueva usando la URL en modo `'inline'`
- **THEN** el PDF se muestra en el navegador
- **AND** no se dispara una descarga

#### Scenario: Descargar sigue descargando

- **WHEN** se solicita la URL en modo `'descarga'`
- **THEN** la firma incluye la opción `download` con el nombre original del archivo

#### Scenario: Autorización sin archivo

- **WHEN** se invoca `getUrlArchivo` sobre una autorización sin adjunto
- **THEN** resuelve `null` en vez de lanzar
- **AND** no se pide ninguna firma a Storage

#### Scenario: Error real de Storage se traduce

- **GIVEN** que Storage responde 403 o 404 sobre una clave existente
- **WHEN** falla la firma
- **THEN** el error se propaga con un mensaje comprensible en castellano
- **AND** nunca se muestra el mensaje crudo del error

### Requirement: Tipo MIME persistido, no inferido

El sistema SHALL persistir el tipo MIME del adjunto en
`facturacion.autorizacion.archivo_tipo_mime`, poblado desde `File.type` en el momento de la subida, y
exponerlo como `ArchivoAdjunto.tipoMime?`. La inferencia por extensión del nombre MUST usarse
únicamente como compatibilidad con filas subidas antes de que existiera la columna.

#### Scenario: Un archivo recién subido guarda su tipo

- **WHEN** se sube un PDF a una autorización
- **THEN** `archivo_tipo_mime` queda en `'application/pdf'`
- **AND** la vista previa elige el visor de PDF sin mirar la extensión

#### Scenario: Fila histórica sin tipo MIME

- **GIVEN** una autorización con archivo cargado antes de este cambio y `archivo_tipo_mime` nulo
- **WHEN** se abre su vista previa
- **THEN** el tipo se infiere de la extensión del nombre, por compatibilidad
- **AND** si no se puede inferir, se muestra la rama de "no se puede previsualizar acá" con la opción
  de descargar

### Requirement: Vista previa reutilizando el componente del checklist documental

El sistema SHALL mostrar la vista previa del adjunto dentro de la aplicación, reutilizando un
componente compartido extraído del checklist documental (`VistaPreviaArchivo`), que renderiza
imágenes con `<img>`, PDF con `PdfPreview` sobre `<canvas>` y una alerta para tipos no soportados. El
sistema MUST NOT reimplementar la previsualización ni renderizar PDF dentro de un `<iframe>`
sandboxeado, porque el visor nativo del navegador no funciona en ese contexto.

#### Scenario: Vista previa de una imagen

- **WHEN** el adjunto es `image/jpeg`
- **THEN** se renderiza con `<img>` dentro del diálogo, con el nombre del archivo como texto
  alternativo

#### Scenario: Vista previa de un PDF

- **WHEN** el adjunto es `application/pdf`
- **THEN** se renderiza con `PdfPreview` sobre `<canvas>`, con sus controles de página y zoom
- **AND** no se monta ningún `<iframe>` para mostrarlo

#### Scenario: El checklist documental no cambia de comportamiento

- **GIVEN** que `ContenidoPreview` se extrae de `DocumentChecklist` a un componente compartido
- **WHEN** se corre la batería de tests existente de `DocumentChecklist`
- **THEN** pasa igual que antes de la extracción

#### Scenario: Permisos de lectura gobiernan la vista previa

- **GIVEN** una cuenta sin el módulo `presupuestos`
- **WHEN** intenta obtener la URL firmada del adjunto
- **THEN** la RLS del bucket lo impide
- **AND** la UI muestra el error traducido, sin exponer la clave del objeto
