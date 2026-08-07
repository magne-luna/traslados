## ADDED Requirements

> **⚠️ GOVERNANCE ALTO, con un punto CRÍTICO.** Este spec depende de los cinco checkpoints de
> `design.md`, ninguno resuelto todavía y cuyo veredicto toma la usuaria/Enzo en `tasks.md` §0.1:
> **CP0** (alcance del swap), **CP1** (`itemId` heterogéneo), **CP2** (columnas faltantes),
> **🔴 CP3** (módulo del bucket `documentos-vehiculos`, requiere aprobación humana explícita) y
> **CP4** (precondición de datos). Donde la forma dependa de un checkpoint, el requisito lo declara
> como opción.

### Requirement: Implementación real SupabaseDocumentoRepository

El sistema SHALL proveer una implementación de `DocumentoRepository` en
`frontend/src/shared/lib/documentos/SupabaseDocumentoRepository.ts` que lea y escriba contra Supabase
Storage (los 4 buckets privados de `C-01`/`C-03`) y las 4 tablas de persistencia
(`pacientes.documentos`, `conductores.documentacion_vehiculo`,
`conductores.documentacion_conductores`, `facturacion.documento_factura`), usando el singleton
compartido `frontend/src/shared/lib/supabaseClient.ts` (`anon key` + sesión).

La implementación MUST cumplir las tres firmas de la interfaz (`listByEntity`, `upload`, `remove`)
**sin modificarlas**, sin agregar métodos y sin cambiar `shared/types/documento.ts`. MUST NOT usar
`any` ni `as` sobre datos externos. MUST NOT usar la `SUPABASE_SERVICE_ROLE_KEY` ni construir un
cliente de Supabase propio.

#### Scenario: Las firmas de la interfaz no cambian
- **GIVEN** la interfaz `DocumentoRepository` existente
- **WHEN** se compila con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `DocumentoRepository` sin casts ni `any`
- **AND** `DocumentoRepository.ts`, `useDocumentChecklist.ts`, `DocumentChecklist.tsx` y
  `shared/types/documento.ts` NO fueron modificados

#### Scenario: Nunca se usa la service role key
- **GIVEN** el texto de `SupabaseDocumentoRepository.ts` y `documentoMapping.ts`
- **WHEN** se inspeccionan con `node:fs` en un test
- **THEN** ninguno menciona `SUPABASE_SERVICE_ROLE_KEY`
- **AND** ninguno llama a `createClient` — los dos usan el singleton compartido

### Requirement: Configuración declarativa por entidad documental

El sistema SHALL declarar la correspondencia entidad→persistencia en un único objeto congelado
`CONFIG_ENTIDAD: Record<EntidadDocumental, ConfiguracionEntidad>` dentro de `documentoMapping.ts`,
con `schema`, `tabla`, `columnaEntidad`, `columnaItem`, `bucket` y `modulo`. El repository MUST leer
esa configuración y MUST NOT ramificar por entidad con condicionales propios.

El campo `modulo` SHALL usarse **exclusivamente** para redactar mensajes de error en castellano y
MUST NOT usarse para decidir si una operación procede — la autorización vive íntegramente en la RLS
del servidor.

#### Scenario: El tipo obliga a cablear toda entidad nueva
- **GIVEN** `CONFIG_ENTIDAD` tipado como `Record<EntidadDocumental, ConfiguracionEntidad>`
- **WHEN** se agrega un quinto valor a la unión `EntidadDocumental` sin agregar su entrada
- **THEN** `npx tsc -b --noEmit` falla

#### Scenario: La configuración coincide con el schema real
- **GIVEN** las 4 entradas de `CONFIG_ENTIDAD`
- **WHEN** se comparan con el schema verificado en vivo (`tasks.md` 1.2/1.3)
- **THEN** `schema`, `tabla`, `columnaEntidad`, `columnaItem` y `bucket` coinciden exactamente para
  las 4 entidades
- **AND** el test no necesita red para verificarlo

### Requirement: Mapeo puro separado del I/O

El sistema SHALL implementar toda la traducción fila↔dominio y la construcción de la clave de Storage
en funciones puras de `frontend/src/shared/lib/documentos/documentoMapping.ts`
(`nombreArchivoSeguro`, `construirClaveStorage`, `parseDocumentoRow`, `ensamblarDocumentos`,
`toInsertPayload`), sin efectos, sin reloj global, sin red y **sin generar el UUID internamente** —
el UUID SHALL entrar por parámetro. Las funciones de parseo MUST angostar `unknown` con type guards
explícitos y MUST descartar —no propagar— una fila malformada sin romper la colección.

#### Scenario: El mapeo se testea sin mockear la red
- **GIVEN** filas crudas de cualquiera de las 4 tablas como objetos literales
- **WHEN** se invocan las funciones de parseo directamente en un test
- **THEN** devuelven los tipos del dominio sin montar ningún fake del cliente Supabase

#### Scenario: Una fila malformada no rompe el listado
- **GIVEN** una respuesta con una fila donde la columna del `itemId` viene `null`
- **WHEN** se ensambla la colección
- **THEN** esa fila se descarta
- **AND** el resto de los documentos se devuelve normalmente

#### Scenario: Un documento sin nombre_archivo degrada en vez de romper
- **GIVEN** una fila con `nombre_archivo` en `null` (fila insertada por otra vía)
- **WHEN** se parsea
- **THEN** `nombreArchivo` toma el último segmento de `archivo_url`
- **AND** NO se lanza ninguna excepción

#### Scenario: La clave de Storage es determinista
- **GIVEN** un `entidadId`, un `itemId`, un nombre de archivo y un UUID fijos
- **WHEN** se invoca `construirClaveStorage` dos veces
- **THEN** devuelve exactamente la misma clave `{entidadId}/{itemId}/{uuid}-{nombreSeguro}`

#### Scenario: El saneado del nombre preserva la extensión
- **GIVEN** un nombre de archivo con acentos, espacios y más de 100 caracteres
- **WHEN** se invoca `nombreArchivoSeguro`
- **THEN** el resultado contiene solo `[a-z0-9.-]`
- **AND** conserva la extensión original al final

### Requirement: Orden de operaciones y compensación entre Storage y Postgres

Dado que Supabase Storage y PostgreSQL **no comparten transacción**, el sistema SHALL ordenar toda
escritura de modo que el único residuo posible ante un fallo parcial sea un **objeto huérfano**
(archivo sin fila) y **nunca** un puntero roto (fila sin archivo).

`upload` SHALL ejecutar, en este orden: (1) leer la fila previa del par `(entidadId, itemId)`;
(2) subir el archivo nuevo a una clave nueva con `upsert: false`; (3) borrar la fila previa si
existía; (4) insertar la fila nueva; (5) borrar el objeto previo si existía. Si (3) o (4) fallan, el
sistema MUST borrar el objeto recién subido en (2) antes de propagar el error. Si (5) falla, el
sistema MUST NOT propagar el error — el estado del dominio ya es correcto.

`remove` SHALL borrar primero la fila y después el objeto, MUST NOT propagar un fallo del borrado del
objeto, y SHALL resolver sin error cuando no existe fila para ese `itemId` (idempotente, misma
semántica que el mock).

#### Scenario: Reemplazo de un documento existente
- **GIVEN** un ítem del checklist que ya tiene un documento cargado
- **WHEN** se invoca `upload` con un archivo nuevo
- **THEN** las operaciones ocurren en el orden SELECT → UPLOAD → DELETE fila → INSERT fila → REMOVE objeto
- **AND** al terminar existe exactamente una fila para ese `(entidadId, itemId)`
- **AND** el objeto anterior ya no existe en el bucket

#### Scenario: Compensación cuando la escritura en la tabla falla
- **GIVEN** un `upload` cuyo archivo se subió correctamente
- **WHEN** el `INSERT` de la fila falla
- **THEN** el sistema borra el objeto recién subido
- **AND** propaga un error con mensaje en castellano
- **AND** NO queda ninguna fila apuntando a un archivo inexistente

#### Scenario: Un fallo al limpiar el objeto viejo no rompe la operación
- **GIVEN** un `upload` de reemplazo cuya fila nueva ya se insertó
- **WHEN** el borrado del objeto anterior falla
- **THEN** la promesa resuelve correctamente con el `DocumentoAdjunto` nuevo
- **AND** NO se lanza ninguna excepción

#### Scenario: Quitar un documento que no existe es idempotente
- **GIVEN** un `itemId` sin documento cargado
- **WHEN** se invoca `remove`
- **THEN** la promesa resuelve sin error (misma semántica que `mockDocumentoRepository`)

### Requirement: listByEntity no consulta Storage

`listByEntity` SHALL resolverse con una única consulta a la tabla configurada, filtrando por
`columnaEntidad`, y MUST NOT invocar la API de Storage: los tres campos que la UI necesita
(`itemId`, `nombreArchivo`, `subidoEn`) viven en la fila.

#### Scenario: Un listado es una sola consulta
- **GIVEN** una entidad con 3 documentos cargados
- **WHEN** se invoca `listByEntity`
- **THEN** se emite exactamente una consulta a la tabla
- **AND** no se invoca `storage.from(...).list()` ni ninguna otra operación de Storage

### Requirement: Traducción de errores de PostgREST y de Storage a castellano

El sistema SHALL traducir los errores de **ambas** fuentes a `Error` con mensaje en castellano listo
para la UI, angostando `PostgrestError` (`{ code, message }`) y `StorageError` (`{ name, message }`,
sin código numérico) con type guards explícitos. MUST NOT propagar `error.message` crudo hacia la UI.

Los mensajes de rechazo por permiso de la **tabla** y del **bucket** SHALL ser distintos entre sí,
para que un reporte de la usuaria permita identificar cuál de las dos capas rechazó.

#### Scenario: Cada código tiene su mensaje propio
- **GIVEN** los códigos `42501`, `PGRST301`, `23503`, `PGRST204`, `PGRST106`, `PGRST205` y los errores
  de Storage 403, 404, 413 y 409
- **WHEN** cada uno llega desde el cliente fake
- **THEN** el repository lanza un `Error` con el mensaje en castellano definido en `design.md` D5
- **AND** ninguno contiene el texto crudo del error original

#### Scenario: Los dos rechazos por permiso se distinguen
- **GIVEN** un rechazo `42501` de la tabla y un rechazo 403 del bucket
- **WHEN** se traducen
- **THEN** los dos mensajes son distintos entre sí

#### Scenario: Un entidadId inexistente produce un mensaje entendible
- **GIVEN** un `entidadId` que no corresponde a ninguna fila de la entidad dueña (el caso de un id de
  fixture, `design.md` Checkpoint 0)
- **WHEN** se invoca `upload`
- **THEN** el `23503` se traduce a un mensaje que dice que no se encontró la entidad
- **AND** el objeto recién subido se borra por compensación

### Requirement: Swap parcial en el composition root

El sistema SHALL inyectar `supabaseDocumentoRepository` **únicamente** en
`frontend/src/features/pacientes/PacientesRoute.tsx` (Checkpoint 0, opción A).
`VehiculosRoute.tsx`, `ConductoresRoute.tsx`, `FacturacionRoute.tsx` y `design-system/DesignSystem.tsx`
MUST seguir inyectando `mockDocumentoRepository`, cada uno con el motivo escrito en su propio
comentario. `mockDocumentoRepository` MUST NOT eliminarse.

#### Scenario: Solo Pacientes habla con Supabase
- **GIVEN** los cinco composition roots
- **WHEN** se inspeccionan sus imports
- **THEN** solo `PacientesRoute.tsx` importa `supabaseDocumentoRepository`
- **AND** los otros cuatro siguen importando `mockDocumentoRepository`
- **AND** cada uno documenta en su comentario por qué

#### Scenario: El catálogo del design system nunca escribe en la base
- **GIVEN** `DesignSystem.tsx`, que monta el checklist con un `entidadId` inventado (`'p1'`)
- **WHEN** alguien abre `/design-system` y sube un archivo en la demo
- **THEN** la operación va al mock en memoria
- **AND** no se emite ninguna llamada a Supabase
