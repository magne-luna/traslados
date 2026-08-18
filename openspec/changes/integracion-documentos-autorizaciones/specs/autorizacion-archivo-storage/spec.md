# Autorización Archivo Storage

## Purpose

Define la subida, el reemplazo y la quita del archivo único adjunto a una autorización contra el
bucket privado `documentos-autorizaciones`, con orden de operaciones compensado entre Storage y la
Edge Function `autorizaciones`. Cierra el pendiente declarado en `AutorizacionForm.tsx` y en
`autorizacion-repository-supabase`.

## Requirements

### Requirement: Subida real del archivo con metadata verdadera

El sistema SHALL subir el archivo elegido directamente desde el navegador al bucket
`documentos-autorizaciones`, y SHALL persistir la referencia (`archivo_url`), el nombre real
(`archivo_nombre`) y la fecha real de carga (`archivo_cargado_en`) vía la Edge Function
`autorizaciones`. El sistema MUST NOT reportar un guardado exitoso si el objeto no llegó al bucket o
si la fila no se actualizó.

#### Scenario: La subida sobrevive a recargar la página y a reabrir la autorización

- GIVEN una autorización sin archivo adjunto
- WHEN el usuario sube un archivo y guarda
- THEN al recargar la página o reabrir la autorización se ve el mismo nombre y la misma fecha de carga

#### Scenario: El nombre y la fecha mostrados son reales, no derivados

- GIVEN un archivo subido llamado `informe final.pdf`
- WHEN se lee la autorización guardada
- THEN `archivo.nombre` es `informe final.pdf`, leído de `archivo_nombre`
- AND `archivo.cargadoEn` es la fecha real de la subida, leída de `archivo_cargado_en`, distinta de
  `fechaRespuesta`

### Requirement: Clave de objeto determinista y saneada

El sistema SHALL construir la clave del objeto como `{autorizacionId}/{uuid}-{nombreSeguro}`, con el
mismo saneado de nombre que usa `documentoMapping.ts`.

#### Scenario: Un nombre con espacios y acentos se sanea

- GIVEN un archivo llamado `informe médico final.pdf`
- WHEN se sube
- THEN la clave del objeto no contiene espacios ni caracteres fuera de ASCII seguro

#### Scenario: Dos subidas para la misma autorización no colisionan

- GIVEN dos archivos subidos en momentos distintos para la misma autorización
- WHEN se comparan sus claves de objeto
- THEN difieren por el segmento `uuid`, incluso si el nombre original es idéntico

### Requirement: Validación de tipo y tamaño antes de subir

El sistema SHALL validar en la capa de aplicación, antes de invocar Storage, que el archivo sea PDF,
JPG o PNG y que no supere 10 MB, coherente con `storage-buckets`.

#### Scenario: Un tipo no soportado se rechaza sin llegar a Storage

- GIVEN un archivo `.docx` o `.zip`
- WHEN el usuario intenta adjuntarlo
- THEN el sistema lo rechaza con un error en castellano antes de invocar `supabase.storage`

#### Scenario: Un archivo de más de 10 MB se rechaza sin llegar a Storage

- GIVEN un archivo de 15 MB
- WHEN el usuario intenta adjuntarlo
- THEN el sistema lo rechaza con un error de tamaño excedido antes de invocar `supabase.storage`

### Requirement: Reemplazo compensado del archivo existente

El sistema SHALL soportar reemplazar el archivo ya cargado por uno nuevo, en este orden: subir el
objeto nuevo → `PATCH` de la fila → borrar el objeto viejo. Si el `PATCH` falla, el sistema SHALL
borrar el objeto recién subido y MUST dejar intacta la referencia anterior.

#### Scenario: Un reemplazo exitoso deja un solo archivo vigente

- GIVEN una autorización con un archivo ya cargado
- WHEN el usuario sube un archivo nuevo en su lugar
- THEN al terminar existe exactamente un archivo referenciado, el nuevo
- AND el objeto viejo ya no existe en el bucket

#### Scenario: Un fallo del PATCH no deja una fila apuntando a un archivo inexistente

- GIVEN una autorización con un archivo ya cargado
- WHEN el usuario sube un archivo nuevo y el `PATCH` de la fila falla
- THEN el objeto recién subido se borra del bucket
- AND la fila sigue apuntando al archivo original, sin cambios

### Requirement: Quita del archivo adjunto

El sistema SHALL permitir quitar el archivo adjunto, borrando el objeto del bucket y limpiando
`archivo_url`, `archivo_nombre` y `archivo_cargado_en` en la misma operación.

#### Scenario: Quitar un archivo borra el objeto y limpia la referencia

- GIVEN una autorización con un archivo cargado
- WHEN el usuario lo quita
- THEN el objeto deja de existir en el bucket
- AND la autorización queda sin `archivo`, con los tres campos de metadata en `null`

#### Scenario: Quitar cuando no hay archivo no falla

- GIVEN una autorización sin archivo adjunto
- WHEN se invoca la operación de quitar
- THEN la operación resuelve sin error

### Requirement: Persistencia de metadata depende de columnas ya migradas

La Edge Function `autorizaciones` SHALL persistir `archivoNombre`/`archivoCargadoEn` solo si las
columnas `archivo_nombre`/`archivo_cargado_en` de `facturacion.autorizacion` existen. Si la migración
`20260729160000` no está aplicada en el entorno, el sistema MUST fallar con un error de base de datos
explícito y MUST NOT reportar un guardado exitoso descartando esos campos en silencio.

#### Scenario: Sin la migración aplicada, la escritura falla explícitamente

- GIVEN un entorno donde `20260729160000` no está aplicada
- WHEN se intenta persistir `archivoNombre`/`archivoCargadoEn` vía `PATCH`
- THEN la escritura falla con un error de base de datos
- AND el sistema no informa la subida como exitosa

#### Scenario: Con la migración aplicada, ambos campos persisten

- GIVEN la migración aplicada
- WHEN se sube un archivo
- THEN `archivo_nombre` y `archivo_cargado_en` quedan persistidos con sus valores reales

### Requirement: Acceso al bucket gateado por el módulo `presupuestos`

El sistema SHALL gatear las cuatro operaciones sobre `storage.objects` del bucket
`documentos-autorizaciones` con `modulos.tiene_permiso('presupuestos', 'read'|'write')`, igual que los
otros 4 buckets de documentos.

#### Scenario: Una cuenta con solo lectura ve el nombre pero no puede subir ni quitar

- GIVEN una cuenta con `presupuestos: read` y sin `write`
- WHEN abre una autorización con archivo cargado
- THEN ve el nombre y la fecha del adjunto
- AND las acciones de subir, reemplazar y quitar están deshabilitadas o son rechazadas por RLS

#### Scenario: Una cuenta sin el módulo no accede a ningún objeto

- GIVEN una cuenta sin permiso sobre `presupuestos`
- WHEN intenta leer o escribir un objeto del bucket `documentos-autorizaciones`
- THEN la operación es rechazada por RLS
