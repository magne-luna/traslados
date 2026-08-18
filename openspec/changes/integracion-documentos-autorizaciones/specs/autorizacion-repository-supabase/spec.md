# Delta for Autorización Repository Supabase

## MODIFIED Requirements

### Requirement: El adjunto se mapea desde columnas reales de metadata

El sistema SHALL mapear el archivo adjunto de la autorización leyendo `archivo_url`, `archivo_nombre`
y `archivo_cargado_en` como columnas reales e independientes de `facturacion.autorizacion`. El sistema
MUST NOT derivar `nombre` del último segmento de la URL ni `cargadoEn` de `fechaRespuesta`. El sistema
SHALL enviar `archivoUrl` (la clave del objeto subido a `documentos-autorizaciones`),
`archivoNombre` y `archivoCargadoEn` en el body de `create`/`update` cuando el usuario sube o
reemplaza un archivo.

(Previously: el adjunto se derivaba de la URL y de `fechaRespuesta`, y el sistema MUST NOT enviaba un
`archivoUrl` para un archivo recién elegido, porque la subida a Storage todavía no existía. Se
invierte con `autorizacion-archivo-storage`.)

#### Scenario: Un adjunto existente sobrevive el viaje de ida y vuelta

- **GIVEN** una autorización en la base con `archivo_url` informado
- **WHEN** se lee, se cambia el estado y se vuelve a guardar
- **THEN** el `archivo_url` original se conserva

#### Scenario: Un archivo recién subido se persiste con su metadata real

- **GIVEN** un formulario de autorización donde el usuario subió un archivo a
  `documentos-autorizaciones`
- **WHEN** se guarda
- **THEN** el body de la invocación SÍ contiene `archivoUrl` con la clave del objeto subido
- **AND** también contiene `archivoNombre` y `archivoCargadoEn` con los valores reales
- **AND** la pantalla ya no muestra ningún `AvisoModeloDatos` de "todavía no se guarda"

#### Scenario: Nombre y fecha se leen tal cual, sin derivarlos

- **GIVEN** una fila con `archivo_nombre = "informe.pdf"` y `archivo_cargado_en = "2026-03-01"`
- **WHEN** se mapea
- **THEN** `archivo.nombre` es exactamente `"informe.pdf"` y `archivo.cargadoEn` es exactamente
  `"2026-03-01"`, sin derivarlos de la URL ni de `fechaRespuesta`
