# Obra Social Repository Supabase

## Purpose
Defines the real `SupabaseObraSocialRepository` implementation backed directly by the `obra_social` Postgres schema (PostgREST + RLS, plus two atomic `SECURITY INVOKER` RPC functions for create/update), including its error-translation, checklist persistence, and security contract.

## Requirements

### Requirement: Implementación real SupabaseObraSocialRepository

El sistema SHALL proveer una implementación de `ObraSocialRepository` en
`frontend/src/shared/lib/obrasSociales/SupabaseObraSocialRepository.ts` que lea y escriba contra el
schema `obra_social` de Supabase usando el cliente compartido
`frontend/src/shared/lib/supabaseClient.ts` (`anon key` + sesión del usuario). La implementación MUST
cumplir las cuatro firmas de la interfaz (`list`, `getById`, `create`, `update`) sin modificarlas,
sin agregar métodos y sin cambiar la forma de `ObraSocialRepository.ts`. La implementación MUST NOT
usar `any`, `as` sobre datos externos, ni la `SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian

- **GIVEN** la interfaz `ObraSocialRepository` existente
- **WHEN** se compila con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `ObraSocialRepository` sin casts ni `any`
- **AND** `ObraSocialRepository.ts` no fue modificado

#### Scenario: Nunca se usa una clave privilegiada en el frontend

- **GIVEN** el código fuente de `SupabaseObraSocialRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `service_role` ni ninguna creación de cliente propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

### Requirement: Lectura de la obra social completa en una sola consulta

El sistema SHALL resolver `list()` y `getById()` con una única consulta a `obra_social.obra_social`
que embeba `requisitos_os → tipos_documento` y `campos_plantilla_factura`. El sistema MUST NOT emitir
una consulta por obra social ni por colección hija (patrón N+1). Dado que todas las tablas viven en
el mismo schema, el sistema MUST NOT necesitar una segunda consulta ni degradar parcialmente la
lectura.

#### Scenario: Un listado de N obras sociales no dispara N consultas

- **GIVEN** un usuario con permiso `obra_social: read` y 3 obras sociales en la base
- **WHEN** se invoca `list()`
- **THEN** se emite una sola consulta a `obra_social.obra_social` con embeds
- **AND** las 3 vuelven con su checklist y su plantilla de factura resueltos

#### Scenario: getById de un id inexistente resuelve a null

- **GIVEN** un id que no corresponde a ninguna obra social
- **WHEN** se invoca `getById(id)`
- **THEN** la promesa resuelve a `null`
- **AND** NO se lanza ninguna excepción (contrato idéntico al del mock)

#### Scenario: RLS que filtra la fila se comporta como "no existe"

- **GIVEN** un usuario sin permiso `obra_social: read`
- **WHEN** se invoca `getById(id)` sobre una obra social que sí existe en la base
- **THEN** la consulta devuelve 0 filas porque la policy de RLS la filtra
- **AND** `getById` resuelve a `null` en lugar de lanzar un error de permisos

### Requirement: Mapeo en funciones puras y aisladas

El sistema SHALL implementar toda la traducción entre filas de Postgres y el tipo `ObraSocial` en
funciones puras exportadas desde `frontend/src/shared/lib/obrasSociales/obraSocialMapping.ts`, sin
efectos, sin lectura de reloj global y sin acceso a red. Las funciones de parseo MUST angostar
`unknown` con type guards explícitos y MUST descartar (no propagar) las filas que no cumplen la forma
esperada, en lugar de romper la operación completa.

#### Scenario: El mapeo se testea sin mockear la red

- **GIVEN** una fila cruda de `obra_social.obra_social` con sus embeds, como objeto literal
- **WHEN** se invoca la función de parseo directamente en un test
- **THEN** devuelve una `ObraSocial` válida sin haber montado ningún fake del cliente Supabase

#### Scenario: Los renombres de columna se resuelven en el mapeo

- **GIVEN** una fila con `razon_social` y `tipo_factura`
- **WHEN** se mapea a `ObraSocial`
- **THEN** se exponen como `nombre` y `tipoComprobante` respectivamente
- **AND** los nombres del tipo del dominio no cambian para acomodar los de la base

#### Scenario: Una fila hija malformada no rompe la obra social

- **GIVEN** una respuesta donde uno de los `requisitos_os` embebidos no trae su `tipos_documento`
- **WHEN** se mapea la obra social
- **THEN** ese ítem se descarta del checklist
- **AND** el resto del checklist y de la obra social se devuelven normalmente

#### Scenario: Un origen de campo fuera de la unión cerrada se descarta

- **GIVEN** una fila de `campos_plantilla_factura` cuyo `origen` no pertenece a
  `OrigenCampoPlantilla`
- **WHEN** se mapea la plantilla
- **THEN** ese campo se omite
- **AND** los campos con origen reconocido se conservan en su orden

### Requirement: Checklist persistido de forma relacional contra el catálogo compartido

El sistema SHALL persistir el checklist documental como filas de `obra_social.requisitos_os`
vinculadas al catálogo compartido `obra_social.tipos_documento`, y NOT como un array embebido. El
sistema SHALL mapear `ChecklistItem.id` a `tipos_documento.id` (no a `requisitos_os.id`), porque
`pacientes.documentos.id_tipo_documento` referencia ese mismo catálogo y `DocumentoAdjunto.itemId`
debe poder resolverse contra él. El sistema MUST NOT cambiar la forma del tipo `ChecklistItem` ni la
del campo `ObraSocial.checklist`.

#### Scenario: El id del ítem es el del tipo de documento

- **GIVEN** una obra social cuyo checklist exige "CBU"
- **WHEN** se lee vía `getById()`
- **THEN** el `ChecklistItem.id` correspondiente es el `id` de la fila de `tipos_documento` con
  `tipo = 'CBU'`
- **AND** NO es el `id` de la fila de vínculo `requisitos_os`

#### Scenario: Dos obras sociales que exigen el mismo documento comparten el id del ítem

- **GIVEN** dos obras sociales que exigen "CBU"
- **WHEN** se leen ambas
- **THEN** el `ChecklistItem` de "CBU" tiene el mismo `id` en las dos
- **AND** cada una conserva su propio `orden` y su propio `requerido` para ese ítem

#### Scenario: Un ítem nuevo se resuelve contra el catálogo antes de vincularse

- **GIVEN** un checklist donde el usuario agregó un ítem con un nombre que ya existe en
  `tipos_documento`
- **WHEN** se guarda la obra social
- **THEN** se reutiliza la fila existente del catálogo
- **AND** NO se inserta un tipo de documento duplicado

#### Scenario: Un ítem con nombre nuevo crea la fila del catálogo en la misma transacción

- **GIVEN** un checklist con un ítem cuyo nombre no existe en `tipos_documento`
- **WHEN** se guarda la obra social
- **THEN** se inserta la fila en el catálogo y se vincula, dentro de la misma transacción
- **AND** si cualquier parte del guardado falla, tampoco queda el tipo de documento nuevo

#### Scenario: Un ítem sin nombre aborta el guardado

- **GIVEN** un checklist con un ítem cuyo nombre es vacío o solo espacios
- **WHEN** se guarda la obra social
- **THEN** la función aborta con el código `45101` y no escribe ninguna fila
- **AND** la promesa rechaza con un `Error` que indica que todos los ítems necesitan un nombre

### Requirement: El orden del checklist es una columna, no una posición de array

El sistema SHALL persistir el orden de los ítems del checklist en la columna
`obra_social.requisitos_os.orden` y SHALL leerlos ordenados por `orden` ascendente, usando el `id`
como desempate determinista. El orden MUST sobrevivir al viaje de ida y vuelta a Postgres, tal como
exige RN-FA-08. El sistema MUST NOT depender del orden físico de las filas devueltas por Postgres.

#### Scenario: El orden persiste tras releer del servidor

- **GIVEN** un checklist reordenado por drag-and-drop y guardado
- **WHEN** se vuelve a leer la obra social desde la base
- **THEN** los ítems vuelven en el mismo orden en que se guardaron

#### Scenario: Dos ítems con el mismo orden se resuelven de forma determinista

- **GIVEN** dos filas de `requisitos_os` con el mismo valor de `orden`
- **WHEN** se mapea el checklist
- **THEN** se ordenan entre sí por `id`
- **AND** dos lecturas consecutivas devuelven el mismo orden

#### Scenario: La obligatoriedad de cada ítem persiste

- **GIVEN** un checklist con un ítem marcado como opcional
- **WHEN** se guarda y se vuelve a leer
- **THEN** ese ítem sigue con `requerido: false`
- **AND** el resto conserva su propio valor

### Requirement: Alta y edición atómicas mediante funciones de Postgres

El sistema SHALL resolver `create()` con una **única** llamada
`supabase.schema('obra_social').rpc('crear_obra_social_completa', { p_os })` y `update()` con una
única llamada `rpc('actualizar_obra_social_completa', { p_id, p_cambios })`. Ambas funciones SHALL
escribir la fila de `obra_social.obra_social` y todas sus hijas (`tipos_documento`, `requisitos_os`,
`campos_plantilla_factura`) dentro de una sola transacción. El sistema MUST NOT emitir inserciones
secuenciales por tabla ni borrados compensatorios: ante cualquier fallo, la transacción hace rollback
completo y no puede quedar una obra social con medio checklist. Ambos métodos SHALL releer con
`getById()` y resolver con ese resultado.

#### Scenario: El alta es una sola llamada, no una secuencia de inserciones

- **GIVEN** una `NuevaObraSocial` con checklist y plantilla de factura
- **WHEN** se invoca `create(data)`
- **THEN** se emite exactamente una llamada `rpc('crear_obra_social_completa', …)`
- **AND** NO se emite ninguna inserción directa sobre `obra_social`, `tipos_documento`,
  `requisitos_os` ni `campos_plantilla_factura`
- **AND** NO se emite ningún borrado compensatorio

#### Scenario: Un fallo a mitad del alta no deja ninguna fila escrita

- **GIVEN** un alta donde la inserción de un requisito falla dentro de la función
- **WHEN** se invoca `create(data)`
- **THEN** la transacción hace rollback y NO queda ninguna fila en ninguna de las cuatro tablas
- **AND** la promesa rechaza con un error traducido a castellano

#### Scenario: Un CUIT duplicado produce un mensaje accionable

- **GIVEN** un alta con un CUIT que ya existe (constraint `UNIQUE` de `obra_social.cuit`)
- **WHEN** se invoca `create(data)`
- **THEN** la promesa rechaza con un `Error` cuyo `message` nombra el CUIT duplicado en castellano
- **AND** el mensaje NO expone nombres de tablas, columnas ni texto crudo de Postgres

#### Scenario: Una clave ausente en la actualización no toca su tabla

- **GIVEN** un `update(id, { nombre: 'Nuevo' })` sin la clave `checklist`
- **WHEN** se ejecuta la actualización
- **THEN** las filas de `requisitos_os` de esa obra social quedan intactas
- **AND** el checklist devuelto por la relectura es el mismo que antes

#### Scenario: Una clave presente reemplaza la colección completa

- **GIVEN** un `update(id, { checklist: [...] })` con el checklist reordenado
- **WHEN** se ejecuta la actualización
- **THEN** las filas de `requisitos_os` de esa obra social se reemplazan por el conjunto entrante,
  con sus `orden` recalculados
- **AND** todo ocurre dentro de la misma transacción

#### Scenario: update de un id inexistente lanza el mismo error que el mock

- **GIVEN** un id que no corresponde a ninguna obra social accesible
- **WHEN** se invoca `update(id, data)`
- **THEN** la función aborta con el código `45103`
- **AND** la promesa rechaza con un `Error` cuyo `message` indica que no existe una obra social con
  ese id

#### Scenario: update devuelve el estado real releído, no un merge optimista

- **GIVEN** una actualización exitosa
- **WHEN** `update` resuelve
- **THEN** la `ObraSocial` devuelta proviene de una relectura de la base
- **AND** refleja defaults, triggers y normalizaciones aplicados por Postgres

### Requirement: Las funciones de escritura corren con los privilegios de quien las llama

Las funciones `obra_social.crear_obra_social_completa` y
`obra_social.actualizar_obra_social_completa` SHALL declararse `SECURITY INVOKER`, de modo que las
policies de RLS de cada tabla escrita sigan evaluándose contra el usuario autenticado que hace la
llamada. Las funciones MUST NOT declararse `SECURITY DEFINER`: su owner es un superusuario y
bypassearía RLS por completo, permitiendo que cualquier usuario autenticado edite obras sociales
**y escriba en `tipos_documento`, que es un catálogo compartido con Pacientes**. Las funciones MUST
fijar `search_path` a vacío, MUST NOT ser ejecutables por el rol `anon`, y MUST NOT reimplementar ni
consultar la lógica de permisos por su cuenta.

#### Scenario: Un usuario sin permiso de escritura no puede crear una obra social vía RPC

- **GIVEN** un usuario autenticado con `obra_social: read` y sin `obra_social: write`
- **WHEN** invoca `crear_obra_social_completa` directamente, salteándose el gateo de la UI
- **THEN** la policy `"Write obra_social"` rechaza la inserción con `42501`
- **AND** la transacción completa hace rollback: no queda ninguna fila creada, tampoco en
  `tipos_documento`
- **AND** el repository traduce el rechazo a un error visible de falta de permiso

#### Scenario: La declaración de seguridad de las funciones es verificable

- **GIVEN** las dos funciones aplicadas en la base
- **WHEN** se consulta `prosecdef` en `pg_proc` para ambas
- **THEN** el valor es `false` en las dos (es decir, `SECURITY INVOKER`)
- **AND** el rol `anon` no tiene privilegio `EXECUTE` sobre ninguna de las dos

#### Scenario: La prohibición está verificada por un test automatizado

- **GIVEN** el texto de `supabase/migrations/20260731120001_obra_social_rpc.sql`
- **WHEN** se lo inspecciona ignorando comentarios y literales de cadena
- **THEN** contiene `SECURITY INVOKER` en las cláusulas activas
- **AND** NO contiene `SECURITY DEFINER` fuera de comentarios de advertencia

### Requirement: Tabla nueva con RLS definida en la misma migración

La migración que crea `obra_social.campos_plantilla_factura` SHALL habilitar Row Level Security sobre
esa tabla y definir sus policies en el **mismo** archivo, gateadas por
`modulos.tiene_permiso('obra_social', 'read' | 'write')`, siguiendo el patrón de las cuatro tablas ya
existentes del schema. La migración SHALL definir además el trigger de auditoría
(`auditoria.log_action()`) y un índice sobre la FK `obra_social_id`. Las policies de escritura MUST
declarar `USING` **y** `WITH CHECK` explícitos.

#### Scenario: La tabla nueva no queda sin RLS

- **GIVEN** la migración que crea `campos_plantilla_factura`
- **WHEN** se la revisa
- **THEN** contiene `ENABLE ROW LEVEL SECURITY` sobre esa tabla
- **AND** contiene una policy de `SELECT` y una de escritura, ambas con predicado de permiso por
  módulo
- **AND** ninguna policy usa `auth.role() = 'authenticated'` a secas

#### Scenario: Toda escritura queda auditada

- **GIVEN** un alta o una edición de la plantilla de factura de una obra social
- **WHEN** la transacción commitea
- **THEN** `auditoria.logs` tiene el rastro de las filas escritas en `campos_plantilla_factura`
- **AND** si la transacción hace rollback, no queda ningún rastro parcial

### Requirement: Contrato de errores compatible con la UI existente

El sistema SHALL lanzar siempre instancias de `Error` con un `message` en castellano apto para
mostrarse tal cual al usuario, porque `useObrasSociales` pinta `err.message` directamente. El sistema
MUST traducir los códigos de PostgREST/Postgres a mensajes de dominio y MUST NOT propagar el texto
crudo del motor. El sistema MUST NOT cambiar la forma en que los errores llegan a la UI (rechazo de
la promesa), de modo que los estados de carga y error ya implementados sigan funcionando sin
modificarse.

#### Scenario: Rechazo de RLS en escritura se muestra como falta de permiso

- **GIVEN** un usuario con `obra_social: read` pero sin `obra_social: write`
- **WHEN** intenta guardar una obra social y la policy de RLS rechaza la escritura
- **THEN** la promesa rechaza con un `Error` que indica falta de permiso para modificar obras
  sociales
- **AND** la UI muestra ese mensaje sin quedar en estado de carga infinito
- **AND** NO se reporta un guardado exitoso

#### Scenario: Las migraciones sin aplicar se explican en castellano

- **GIVEN** que `20260731120001_obra_social_rpc.sql` no fue aplicada y PostgREST responde `PGRST202`
- **WHEN** se invoca `create()`
- **THEN** la promesa rechaza con un `Error` que indica que el alta no está habilitada en el servidor
- **AND** el mensaje no contiene el código crudo de PostgREST

#### Scenario: Una columna de configuración ausente se explica en castellano

- **GIVEN** que `20260731120000_obra_social_config_facturacion.sql` no fue aplicada y PostgREST
  responde `PGRST204` por una columna inexistente
- **WHEN** se invoca `list()` o `create()`
- **THEN** la promesa rechaza con un `Error` que indica que la configuración de facturación no está
  habilitada en el servidor

#### Scenario: Quitar un ítem del checklist usado por un documento da un mensaje claro

- **GIVEN** un tipo de documento referenciado por `pacientes.documentos` (FK `ON DELETE RESTRICT`)
- **WHEN** una operación intenta borrarlo y Postgres responde `23503`
- **THEN** la promesa rechaza con un `Error` que explica que hay documentos de pacientes que lo usan
- **AND** el mensaje no menciona nombres de tablas ni códigos de Postgres

#### Scenario: Los estados de carga y error de la pantalla no se modifican

- **GIVEN** la pantalla de Obras Sociales con el repository real inyectado
- **WHEN** una operación falla
- **THEN** `useObrasSociales` expone `error` con el mensaje y `loading` en `false`
- **AND** ni `useObrasSociales.ts` ni `ObraSocialRepositoryContext.tsx` fueron modificados

### Requirement: RLS existente como única autorización, sin duplicarla ni bypassearla

El sistema SHALL apoyarse exclusivamente en las policies de RLS ya definidas
(`modulos.tiene_permiso('obra_social', 'read' | 'write')`) para autorizar lecturas y escrituras. El
sistema MUST NOT reimplementar, replicar ni anticipar esa lógica de permisos en el repository, y MUST
NOT tratar el gateo de escritura de la UI (`usePuedeEscribir`, `<CamposSoloLectura>`, cableado por
`gateo-obrasocial`) como control de acceso, dado que es client-side y evitable.

#### Scenario: El repository no consulta la tabla de permisos

- **GIVEN** el código de `SupabaseObraSocialRepository.ts`
- **WHEN** se inspeccionan sus consultas
- **THEN** no lee `modulos.permisos` ni `modulos.modulos` para decidir si operar
- **AND** delega la decisión a la policy de RLS del servidor

#### Scenario: Un intento de escritura sin permiso falla en el servidor

- **GIVEN** un usuario sin `obra_social: write` que evita el gateo de UI
- **WHEN** se invoca `create()` o `update()`
- **THEN** la escritura es rechazada por la base
- **AND** el repository traduce ese rechazo a un error visible, sin haberla permitido localmente

### Requirement: Defaults de negocio configurables en columna, nunca hardcodeados

El sistema SHALL persistir el plazo de cobro, la modalidad de facturación, el flag de pagos parciales
y el origen del identificador de factura como columnas de `obra_social.obra_social` con un `DEFAULT`
documentado (`90`, `'por-prestacion'`, `false`, `'paciente.numeroAfiliado'` respectivamente), de modo
que cada obra social pueda tener su propio valor editable. El sistema MUST NOT introducir constantes
en el frontend que fijen esos valores, ni bloquear el change esperando la confirmación del cliente
sobre las preguntas abiertas de prioridad Alta que los originan.

#### Scenario: Cada obra social conserva su propio plazo de cobro

- **GIVEN** dos obras sociales, una con plazo de cobro de 90 días y otra de 60
- **WHEN** se leen ambas
- **THEN** cada una devuelve su propio valor
- **AND** ninguno proviene de una constante del frontend

#### Scenario: Una obra social nueva nace con el default documentado

- **GIVEN** un alta que no especifica plazo de cobro
- **WHEN** se persiste
- **THEN** la fila queda con el `DEFAULT` de la columna (90 días)
- **AND** el valor queda editable desde la pantalla

#### Scenario: El identificador de factura es configurable por obra social

- **GIVEN** que IN-01 sigue abierta con el cliente
- **WHEN** se lee o se guarda una obra social
- **THEN** `plantillaFactura.identificadorOrigen` viaja desde y hacia
  `obra_social.identificador_origen`
- **AND** el default de la columna es el mismo que ya usaba el fixture, no un valor nuevo inventado

### Requirement: Inyección en el único punto de composición

El sistema SHALL inyectar la implementación real desde
`frontend/src/features/obras-sociales/ObraSocialesRoute.tsx`, que es el único archivo de la feature
que cambia por el swap. Ningún componente, hook ni context de `features/obras-sociales/` MUST
importar `SupabaseObraSocialRepository` ni el cliente `supabase` directamente.

#### Scenario: Solo el composition root conoce la implementación

- **GIVEN** los archivos de `frontend/src/features/obras-sociales/`
- **WHEN** se buscan importaciones de `SupabaseObraSocialRepository` o de `supabaseClient`
- **THEN** la única coincidencia de producción es `ObraSocialesRoute.tsx`

#### Scenario: El mock sobrevive como doble de test

- **GIVEN** `mockObraSocialRepository`
- **WHEN** se completa este change
- **THEN** el archivo sigue existiendo y sus tests siguen pasando
- **AND** ya no es la implementación inyectada por `ObraSocialesRoute.tsx`

### Requirement: Discrepancias del esquema documentadas y señalizadas

El sistema SHALL documentar cada discrepancia entre `shared/types/obraSocial.ts` y el schema
`obra_social` real en los dos lugares que exige la convención del proyecto —
`knowledge-base/04_modelo_de_datos.md` §Discrepancias y un bullet ⚠️ en `CHANGES.md` §C-04— y SHALL
señalizar en la UI, con el componente `AvisoModeloDatos`, toda ambigüedad que el usuario no pueda
inferir de la pantalla. El sistema MUST NOT resolver ninguna discrepancia unilateralmente en el
código.

#### Scenario: La ambigüedad del CUIT queda señalizada

- **GIVEN** que `obra_social.cuit` y `obra_social.prestadores.cuit` son columnas distintas y el tipo
  del frontend documenta su `cuit` como "del prestador"
- **WHEN** el usuario abre la ficha de una obra social
- **THEN** hay un `AvisoModeloDatos` visible que dice que no está confirmado cuál de los dos CUIT
  representa ese campo

#### Scenario: La escritura sobre el catálogo compartido queda señalizada

- **GIVEN** el editor de checklist
- **WHEN** el usuario agrega o renombra un ítem
- **THEN** hay un `AvisoModeloDatos` que explica que el nombre se guarda en un catálogo de tipos de
  documento compartido con Pacientes

#### Scenario: Los carteles usan el componente del design system

- **GIVEN** los avisos agregados por este change
- **WHEN** se revisa su implementación
- **THEN** usan `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`
- **AND** no contienen estilos inline (`style={{}}`) ni markup de alerta propio

#### Scenario: La decisión sobre Prestadores queda registrada, no ignorada

- **GIVEN** que `obra_social.prestadores` existe en la base sin ninguna contraparte en la app
- **WHEN** se completa este change
- **THEN** `CHANGES.md` §C-04 y `knowledge-base/04_modelo_de_datos.md` registran que la entidad queda
  fuera de este change y por qué
- **AND** queda propuesta como change propio con su pregunta abierta sobre la relación
  Prestador↔ObraSocial
