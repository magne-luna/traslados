# Presupuesto Repository Supabase

## Purpose
Defines the real `PresupuestoRepository` implementation backed by the `presupuestos` Edge Function (Supabase Edge Functions, not direct PostgREST + RLS), including its error-translation and index requirements.

## Requirements

### Requirement: Implementación real SupabasePresupuestoRepository

El sistema SHALL proveer una implementación de `PresupuestoRepository` en
`frontend/src/shared/lib/presupuestos/SupabasePresupuestoRepository.ts` que lea y escriba contra la
Edge Function `presupuestos` usando el cliente compartido
`frontend/src/shared/lib/supabaseClient.ts` (`anon key` + sesión del usuario) vía
`supabase.functions.invoke`. La implementación MUST cumplir las cuatro firmas de la interfaz (`list`,
`getById`, `create`, `update`) sin modificarlas, sin agregar métodos y sin cambiar la forma de
`PresupuestoRepository.ts`. La implementación MUST NOT usar `any`, `as` sobre datos externos, ni la
`SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian

- **GIVEN** la interfaz `PresupuestoRepository` existente
- **WHEN** se compila con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `PresupuestoRepository` sin casts ni `any`
- **AND** `PresupuestoRepository.ts` no fue modificado

#### Scenario: Nunca se usa una clave privilegiada en el frontend

- **GIVEN** el código fuente de `SupabasePresupuestoRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `service_role` ni ninguna creación de cliente propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

#### Scenario: El repository no agrega capacidades que la interfaz no declara

- **GIVEN** que la Edge Function `presupuestos` soporta `DELETE /presupuestos/:id`
- **WHEN** se revisa la implementación
- **THEN** NO expone ningún método de borrado
- **AND** la interfaz `PresupuestoRepository` no gana métodos nuevos

### Requirement: Lectura del listado en una sola invocación

El sistema SHALL resolver `list()` con una **única** invocación `GET` a la Edge Function
`presupuestos`. El sistema MUST NOT emitir una invocación por presupuesto ni por campo derivado
(patrón N+1). Las filas que no cumplen la forma esperada MUST descartarse individualmente, sin
impedir que el resto del listado se devuelva.

#### Scenario: Un listado de N presupuestos no dispara N invocaciones

- **GIVEN** un usuario con permiso `presupuestos: read` y 3 presupuestos en la base
- **WHEN** se invoca `list()`
- **THEN** se emite una sola invocación a la función `presupuestos`
- **AND** los 3 vuelven mapeados al tipo `Presupuesto`

#### Scenario: Una fila malformada no rompe el listado

- **GIVEN** una respuesta donde uno de los presupuestos llega sin `monto` o sin `fechaEmision`
- **WHEN** se mapea el listado
- **THEN** ese presupuesto se descarta
- **AND** el resto del listado se devuelve normalmente
- **AND** NO se inventa un monto `0` ni una fecha por defecto

### Requirement: getById resuelve null ante 404 y nunca lanza por ausencia

El sistema SHALL resolver `getById(id)` a `null` cuando la Edge Function responde `404`, cumpliendo el
contrato explícito de la interfaz (*"resuelve `null` si no existe, no lanza excepción"*). El sistema
MUST distinguir ese caso de un `403` por falta de permiso, que SHALL lanzar.

#### Scenario: getById de un id inexistente resuelve a null

- **GIVEN** un id que no corresponde a ningún presupuesto
- **WHEN** se invoca `getById(id)`
- **THEN** la Edge Function responde `404`
- **AND** la promesa resuelve a `null` sin lanzar ninguna excepción

#### Scenario: Falta de permiso no se confunde con inexistencia

- **GIVEN** un usuario sin permiso `presupuestos: read`
- **WHEN** se invoca `getById(id)` sobre un presupuesto que sí existe
- **THEN** la Edge Function responde `403`
- **AND** la promesa rechaza con un `Error` que indica falta de permiso
- **AND** NO resuelve a `null`

### Requirement: update propaga el 404 en lugar de absorberlo

El sistema SHALL lanzar un `Error` cuando `update(id, data)` recibe un `404`, con el **mismo** mensaje
que la implementación mock (`No existe un presupuesto con id "…".`), porque
`usePresupuestos` lo muestra tal cual. El sistema MUST NOT resolver `update()` a `null` ni reportar un
guardado exitoso ante un `404`.

#### Scenario: Editar un presupuesto inexistente lanza el mismo error que el mock

- **GIVEN** un id que no corresponde a ningún presupuesto accesible
- **WHEN** se invoca `update(id, data)`
- **THEN** la promesa rechaza con un `Error` cuyo `message` nombra el id inexistente
- **AND** el mensaje es idéntico al que lanza la implementación mock

#### Scenario: La asimetría con getById es deliberada

- **GIVEN** la misma respuesta `404` de la Edge Function
- **WHEN** llega por `getById` y cuando llega por `update`
- **THEN** `getById` resuelve `null` y `update` rechaza
- **AND** ambas ramas tienen cobertura de test propia

### Requirement: Actualización parcial que no pisa campos no tocados

El sistema SHALL construir el body del `PATCH` incluyendo **únicamente** las claves presentes en el
`ActualizacionPresupuesto` recibido. Una clave ausente MUST significar "no tocar" y MUST NOT viajar en
el body con valor nulo, indefinido ni con el valor anterior.

#### Scenario: Editar solo el monto no manda la fecha

- **GIVEN** un `update(id, { monto: 5000 })`
- **WHEN** se construye el body de la invocación
- **THEN** el body contiene `monto` y ninguna otra clave
- **AND** `fechaEmision`, `pacienteId`, `obraSocialId` y `archivoUrl` no aparecen

#### Scenario: Una actualización vacía no manda campos

- **GIVEN** un `update(id, {})`
- **WHEN** se construye el body
- **THEN** el body no contiene ninguna clave de dominio

### Requirement: El adjunto se mapea sin inventar datos ni perder los existentes

El sistema SHALL mapear la columna `archivo_url` —expuesta por la Edge Function como `archivoUrl`— al
`archivo?: ArchivoAdjunto` del dominio derivando `nombre` del último segmento de la URL y `cargadoEn`
de la fecha propia de la entidad (`fechaEmision`). El sistema MUST NOT inventar una fecha de carga
tomada del reloj, y MUST NOT enviar un `archivoUrl` para un archivo que el usuario acaba de elegir en
el formulario, porque **este change no implementa la subida a Storage**.

#### Scenario: Un adjunto existente sobrevive el viaje de ida y vuelta

- **GIVEN** un presupuesto en la base con `archivo_url` informado
- **WHEN** se lee, se edita otro campo y se vuelve a guardar
- **THEN** el `archivo_url` original se conserva
- **AND** el `nombre` mostrado sale de la URL, no de un valor inventado

#### Scenario: La fecha de carga no cambia entre lecturas

- **GIVEN** el mismo presupuesto leído dos veces
- **WHEN** se mapea su adjunto
- **THEN** `cargadoEn` es el mismo valor en las dos lecturas
- **AND** NO depende del reloj del navegador

#### Scenario: Un archivo recién elegido no produce una URL falsa

- **GIVEN** un formulario donde el usuario seleccionó un archivo local
- **WHEN** se guarda el presupuesto
- **THEN** el body de la invocación NO contiene `archivoUrl`
- **AND** la pantalla muestra un `AvisoModeloDatos` indicando que el archivo todavía no se guarda en
  el servidor

#### Scenario: Sin adjunto en la base, el dominio queda sin adjunto

- **GIVEN** un presupuesto cuyo `archivoUrl` es nulo o vacío
- **WHEN** se mapea
- **THEN** `archivo` es `undefined`
- **AND** NO se construye un `ArchivoAdjunto` con nombre vacío

### Requirement: Mapeo en funciones puras y aisladas

El sistema SHALL implementar toda la traducción entre la respuesta de la Edge Function y el tipo
`Presupuesto` en funciones puras exportadas desde
`frontend/src/shared/lib/presupuestos/presupuestoMapping.ts`, sin efectos, sin lectura de reloj global
y sin acceso a red. Las funciones de parseo MUST angostar `unknown` con type guards explícitos.

#### Scenario: El mapeo se testea sin mockear la red

- **GIVEN** una respuesta cruda de la Edge Function como objeto literal
- **WHEN** se invoca la función de parseo directamente en un test
- **THEN** devuelve un `Presupuesto` válido sin haber montado ningún fake del cliente Supabase

#### Scenario: Un valor que no es un objeto no rompe el mapeo

- **GIVEN** una respuesta que no tiene la forma esperada (string, `null`, array anidado)
- **WHEN** se invoca la función de parseo
- **THEN** devuelve `null`
- **AND** NO lanza

### Requirement: Contrato de errores compatible con la UI existente

El sistema SHALL lanzar siempre instancias de `Error` con un `message` en castellano apto para
mostrarse tal cual al usuario, porque `usePresupuestos` pinta `err.message` directamente. El sistema
MUST traducir los códigos HTTP de la Edge Function y los mensajes crudos de Postgres que ésta propaga,
y MUST NOT dejar que el texto del motor llegue a la interfaz. El sistema MUST NOT cambiar la forma en
que los errores llegan a la UI (rechazo de la promesa), de modo que los estados de carga y error ya
implementados sigan funcionando sin modificarse.

#### Scenario: Falta de permiso de escritura se muestra como tal

- **GIVEN** un usuario con `presupuestos: read` pero sin `presupuestos: write`
- **WHEN** intenta guardar un presupuesto y la Edge Function responde `403`
- **THEN** la promesa rechaza con un `Error` que indica falta de permiso para modificar presupuestos
- **AND** la UI muestra ese mensaje sin quedar en estado de carga infinito
- **AND** NO se reporta un guardado exitoso

#### Scenario: Sesión vencida se explica en castellano

- **GIVEN** una sesión cuyo token ya no es válido y la Edge Function responde `401`
- **WHEN** se invoca cualquier método del repository
- **THEN** la promesa rechaza con un `Error` que indica que la sesión expiró

#### Scenario: El texto crudo de Postgres nunca llega a la interfaz

- **GIVEN** una respuesta `400` cuyo cuerpo contiene un mensaje del motor de base de datos
- **WHEN** el repository lo traduce
- **THEN** el `message` del `Error` resultante NO contiene el texto original
- **AND** NO menciona nombres de tablas, columnas ni códigos de Postgres

#### Scenario: Una referencia rota se explica en términos de dominio

- **GIVEN** un alta cuyo `pacienteId` u `obraSocialId` no existen en la base (violación de clave
  foránea)
- **WHEN** se invoca `create(data)`
- **THEN** la promesa rechaza con un `Error` que explica que el paciente o la obra social no existen
- **AND** el mensaje no menciona el nombre del constraint

#### Scenario: Los estados de carga y error de la pantalla no se modifican

- **GIVEN** la pantalla de Presupuestos con el repository real inyectado
- **WHEN** una operación falla
- **THEN** `usePresupuestos` expone `error` con el mensaje y `loading` en `false`
- **AND** ni `usePresupuestos.ts` ni `PresupuestoRepositoryContext.tsx` fueron modificados

### Requirement: La autorización vive en el servidor y no se duplica en el cliente

El sistema SHALL apoyarse exclusivamente en el control de acceso que la Edge Function `presupuestos`
ya aplica (`requirePermiso` → `modulos.tiene_permiso('presupuestos', 'read' | 'write')`, la misma
función que usan las policies de RLS de las tablas). El sistema MUST NOT reimplementar, replicar ni
anticipar esa lógica en el repository, y MUST NOT tratar el gateo de escritura de la UI como control
de acceso, dado que es client-side y evitable.

#### Scenario: El repository no consulta la tabla de permisos

- **GIVEN** el código de `SupabasePresupuestoRepository.ts`
- **WHEN** se inspeccionan sus llamadas
- **THEN** no lee `modulos.permisos` ni `modulos.modulos` para decidir si operar
- **AND** delega la decisión en la respuesta de la Edge Function

#### Scenario: Un perfil de otro módulo no ve presupuestos por accidente

- **GIVEN** un usuario con permiso `facturacion: read` y **sin** `presupuestos: read`
- **WHEN** invoca `list()`
- **THEN** la Edge Function responde `403` de forma explícita
- **AND** el repository lanza un error de falta de permiso
- **AND** NO devuelve una lista vacía que se pueda confundir con "no hay presupuestos cargados"

### Requirement: Índices sobre las claves foráneas del dominio

La migración de este change SHALL crear índices sobre `facturacion.presupuesto.paciente_id`,
`facturacion.presupuesto.obra_social_id` y `facturacion.autorizacion.presupuesto_id`, que hoy no
existen. La migración MUST usar `IF NOT EXISTS` y MUST NOT crear, alterar ni borrar ninguna tabla,
columna, función o policy.

#### Scenario: La migración es puramente aditiva

- **GIVEN** la migración de índices
- **WHEN** se la revisa
- **THEN** contiene únicamente sentencias `CREATE INDEX IF NOT EXISTS`
- **AND** no contiene `ALTER TABLE`, `CREATE TABLE`, `CREATE FUNCTION` ni `CREATE POLICY`

#### Scenario: La justificación de no usar CONCURRENTLY está escrita y es verificable

- **GIVEN** la cabecera de la migración
- **WHEN** se la lee
- **THEN** documenta el conteo de filas medido, su fecha, y la condición bajo la cual la decisión
  caduca
- **AND** la re-verificación del conteo es un paso previo explícito a aplicarla
