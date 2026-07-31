## ADDED Requirements

### Requirement: Implementación real SupabaseConductorRepository
El sistema SHALL proveer una implementación de `ConductorRepository` en
`frontend/src/shared/lib/conductores/SupabaseConductorRepository.ts` que lea y escriba contra el
schema `conductores` de Supabase usando el cliente compartido
`frontend/src/shared/lib/supabaseClient.ts` (`anon key` + sesión del usuario). La implementación MUST
cumplir las cuatro firmas de la interfaz (`list`, `getById`, `create`, `update`) sin modificarlas, sin
agregar métodos y sin que **este archivo** obligue a cambiar `ConductorRepository.ts` ni
`shared/types/conductor.ts` (los cambios de `conductor.ts` que sí tiene este change vienen de la
decisión de modelo D6, no del repository). La
implementación MUST NOT usar `any` ni `as` sobre datos externos, y MUST NOT usar la
`SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian
- **WHEN** se compila `SupabaseConductorRepository` con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `ConductorRepository` sin casts ni `any`
- **AND** ni `ConductorRepository.ts` ni `shared/types/conductor.ts` fueron modificados **por este
  archivo**

#### Scenario: getById de un id inexistente resuelve a null sin lanzar
- **WHEN** se invoca `getById(id)` con un id que no corresponde a ningún conductor
- **THEN** la promesa resuelve a `null`
- **AND** NO se lanza ninguna excepción (contrato idéntico al del mock)

#### Scenario: RLS que filtra la fila se comporta como "no existe"
- **WHEN** un usuario sin permiso `conductores: read` invoca `getById(id)` sobre un conductor que sí
  existe en la base
- **THEN** la consulta devuelve 0 filas porque la policy de RLS la filtra
- **AND** `getById` resuelve a `null` en lugar de lanzar un error de permisos

#### Scenario: Nunca se usa una clave privilegiada en el frontend
- **WHEN** se inspecciona el texto fuente de `SupabaseConductorRepository.ts`
- **THEN** no contiene `service_role` ni ninguna creación de cliente Supabase propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

### Requirement: Mapeo en funciones puras y aisladas
El sistema SHALL implementar toda la traducción entre filas de Postgres y el tipo `Conductor` en
funciones puras exportadas desde `frontend/src/shared/lib/conductores/conductorMapping.ts`, sin
efectos, sin lectura de reloj global y sin acceso a red. Las funciones de parseo MUST angostar
`unknown` con type guards explícitos y MUST descartar (no propagar) las asignaciones que no cumplen
la forma esperada, en lugar de romper la operación completa.

#### Scenario: El mapeo se testea sin mockear la red
- **WHEN** se invoca `parseConductorRow` directamente en un test con una fila cruda de
  `conductores.conductores` y su embed de `conductores_vehiculos`, como objeto literal
- **THEN** devuelve un `Conductor` válido sin haber montado ningún fake del cliente Supabase

#### Scenario: Una asignación semanal malformada no rompe el conductor
- **WHEN** una de las filas embebidas de `conductores_vehiculos` no trae `vehiculo_id`, `fecha_init`
  o `fecha_fin_semana` con la forma esperada
- **THEN** esa asignación se descarta
- **AND** el resto del conductor (y del listado) se devuelve normalmente

#### Scenario: El orden de las asignaciones es determinista
- **WHEN** se mapean las `conductores_vehiculos` embebidas de un conductor
- **THEN** el arreglo `asignaciones` queda ordenado por `fecha_init` ascendente, usando `id` como
  desempate cuando dos filas comparten `fecha_init`
- **AND** dos lecturas consecutivas de los mismos datos devuelven el mismo orden

### Requirement: Lectura del conductor completo en una sola consulta
El sistema SHALL resolver `list()` y `getById()` con una única consulta a
`conductores.conductores` que embeba `conductores_vehiculos`, sobre el schema `conductores`. El
sistema MUST NOT emitir una consulta por conductor ni por la colección de asignaciones (patrón N+1).

#### Scenario: Un listado de N conductores no dispara N consultas
- **WHEN** se invoca `list()` con 3 conductores en la base, cada uno con asignaciones semanales
- **THEN** se emite una sola consulta a `conductores.conductores` con el embed de
  `conductores_vehiculos`
- **AND** los 3 conductores vuelven con sus asignaciones resueltas

#### Scenario: getById agrega el filtro por id sobre la misma consulta
- **WHEN** se invoca `getById(id)`
- **THEN** se reutiliza la misma forma de consulta que `list()`, filtrada con `.eq('id', id)` y
  `.maybeSingle()`
- **AND** no se emite ninguna consulta adicional para resolver las asignaciones

### Requirement: Conversión pura de semana ISO a par de fechas y viceversa
El sistema SHALL proveer un módulo puro `frontend/src/shared/lib/conductores/semanaIso.ts` con las
funciones `semanaIsoADesdeHasta(semana: string)` (devuelve el lunes y el domingo de esa semana ISO) y
`desdeHastaASemanaIso(init: string, fin: string)` (devuelve la etiqueta ISO de la semana que contiene
`init`), sin efectos, sin lectura de reloj global y sin acceso a red. El sistema MUST parsear
cualquier `DATE` de Postgres como fecha local componiendo año/mes/día, y MUST NOT construir la fecha
con `new Date(stringISO)` sobre un string sin hora, porque esa forma se interpreta como UTC y en
Argentina (UTC−3) desplaza el día un día hacia atrás.

#### Scenario: La semana 1 ISO es la que contiene el primer jueves del año
- **WHEN** se invoca `semanaIsoADesdeHasta('2027-W01')` (2027-01-01 es viernes, así que la semana 1
  ISO no arranca el 1 de enero)
- **THEN** el lunes devuelto es el que corresponde a la semana que contiene el primer jueves de enero
  de 2027, no el 1 de enero

#### Scenario: Un año de 53 semanas se resuelve correctamente
- **WHEN** se invoca `semanaIsoADesdeHasta('2026-W53')` sobre un año ISO con 53 semanas
- **THEN** la función devuelve el par de fechas correspondiente sin error ni desbordar a la semana 1
  del año siguiente

#### Scenario: Una semana que cruza el cambio de año se resuelve en ambos sentidos
- **WHEN** una semana ISO empieza en diciembre de un año y termina en enero del siguiente
- **THEN** `semanaIsoADesdeHasta` devuelve un lunes en diciembre y un domingo en enero del año
  siguiente
- **AND** `desdeHastaASemanaIso` aplicado a ese mismo par de fechas devuelve la etiqueta ISO original

#### Scenario: Un DATE de Postgres se parsea como fecha local, sin corrimiento de zona horaria
- **WHEN** se invoca `desdeHastaASemanaIso('2026-07-27', '2026-08-02')` (2026-07-27 es lunes)
- **THEN** la semana ISO devuelta es la que contiene el 27 de julio de 2026, calculada sin pasar por
  `new Date('2026-07-27')` interpretado como UTC
- **AND** el resultado no depende de la zona horaria del entorno donde corre el código

#### Scenario: Una fila incoherente se degrada derivando la semana que contiene fecha_init
- **WHEN** una fila de `conductores_vehiculos` tiene `fecha_init` que no cae en lunes (dato cargado a
  mano, incoherente con `fecha_fin_semana`)
- **THEN** el mapeo NO descarta la fila ni "corrige" las fechas
- **AND** deriva la semana ISO que contiene `fecha_init` y la usa como `AsignacionSemanal.semana`

### Requirement: Renombre de columnas entre la base y el tipo del dominio
El sistema SHALL mapear `conductores.conductores.dni` a `Conductor.documento` y
`conductores.conductores.notas` a `Conductor.observaciones` en ambos sentidos (lectura y escritura),
sin que los nombres del tipo del dominio cambien para acomodar los de la base.

#### Scenario: dni se lee como documento
- **WHEN** se mapea una fila con `dni: '30123456'`
- **THEN** el `Conductor` resultante tiene `documento: '30123456'`

#### Scenario: notas se lee como observaciones
- **WHEN** se mapea una fila con `notas: 'Prefiere turno mañana'`
- **THEN** el `Conductor` resultante tiene `observaciones: 'Prefiere turno mañana'`

#### Scenario: El payload de escritura usa los nombres de columna de la base
- **WHEN** se invoca `toCrearConductorPayload` o `toActualizarConductorPayload` sobre un
  `NuevoConductor` / `ActualizacionConductor`
- **THEN** el objeto resultante usa las claves `dni` y `notas`, no `documento` ni `observaciones`

### Requirement: Mapeo de enums con degradación a valor por defecto
El sistema SHALL traducir `conductores.conductores.estado` (`'operando'` / `'fuera de servicio'`,
enum de Postgres con espacio) a `EstadoConductor` (`'operando'` / `'fuera-de-servicio'`, unión de TS
con guion) y viceversa, mediante funciones puras y totales (`parseEstadoConductor` /
`toEstadoConductorRow`), no con un `.replace(' ', '-')`. Un valor de `estado` que llegue de la base y
no coincida con ninguno de los dos valores conocidos MUST degradar a `'operando'` sin romper la
lectura del conductor ni del listado.

#### Scenario: fuera de servicio se traduce a fuera-de-servicio
- **WHEN** se mapea una fila con `estado: 'fuera de servicio'`
- **THEN** el `Conductor` resultante tiene `estado: 'fuera-de-servicio'`

#### Scenario: fuera-de-servicio se traduce a fuera de servicio al escribir
- **WHEN** se invoca `toEstadoConductorRow('fuera-de-servicio')`
- **THEN** el valor devuelto es `'fuera de servicio'`, con espacio, tal como lo exige el enum de la
  base

#### Scenario: Un valor desconocido degrada a operando sin romper la lectura
- **WHEN** se mapea una fila cuyo `estado` no es `'operando'` ni `'fuera de servicio'`
- **THEN** el `Conductor` resultante tiene `estado: 'operando'`
- **AND** el resto del listado se sigue devolviendo con normalidad

### Requirement: domicilio y cuil nullable en la base se degradan a cadena vacía
El sistema SHALL leer `conductores.conductores.domicilio` y `conductores.conductores.cuil`, que son
columnas nullable, y MUST degradar un valor `NULL` a cadena vacía (`''`) al mapear a `Conductor`,
dado que el tipo del dominio los declara requeridos (`domicilio: string`, `cuil: string`). El sistema
MUST NOT lanzar ni descartar el conductor por esta causa. La obligatoriedad real de estos campos en el
alta es una pregunta abierta del change (pendiente #3 de `C-09`) que este requirement NO resuelve.

#### Scenario: domicilio NULL se lee como cadena vacía
- **WHEN** se mapea una fila con `domicilio: null`
- **THEN** el `Conductor` resultante tiene `domicilio: ''`
- **AND** el conductor se devuelve completo, sin descartarse

#### Scenario: cuil NULL se lee como cadena vacía
- **WHEN** se mapea una fila con `cuil: null`
- **THEN** el `Conductor` resultante tiene `cuil: ''`

#### Scenario: La obligatoriedad del alta queda sin resolver por este mapeo
- **WHEN** se revisa este requirement
- **THEN** no impone ni relaja ninguna validación de obligatoriedad en el formulario de alta
- **AND** la pregunta de si `domicilio`/`cuil` deberían ser `NOT NULL` en la base queda documentada
  como pendiente, no decidida en código

### Requirement: Las restricciones de perfil viven en notas, sin columna estructurada
> ✅ **Checkpoint D6 resuelto por la opción B (2026-07-31).** El docx manda en estructura y no tiene
> un campo de restricciones: todo va al único campo `Notas`.

El sistema MUST NOT agregar ninguna columna `restricciones` a `conductores.conductores` ni mapear
ningún campo `restricciones` del dominio, porque ese campo **deja de existir** (ver
`conductor-contract`). La única contraparte del texto libre del perfil SHALL ser el mapeo ya
especificado `conductores.conductores.notas` ↔ `Conductor.observaciones`, en ambos sentidos.

El sistema MUST NOT emitir la clave `restricciones` en `toCrearConductorPayload` ni en
`toActualizarConductorPayload`. Una fila de la base que trajera una columna con ese nombre —por
ejemplo si backend la agregara por su cuenta— MUST ignorarse sin romper la lectura, en vez de
intentar mapearla a un campo que el dominio no tiene.

#### Scenario: El payload de escritura no contiene restricciones
- **WHEN** se construye el payload con `toCrearConductorPayload` o `toActualizarConductorPayload`
- **THEN** el `jsonb` resultante no contiene ninguna clave `restricciones`
- **AND** las restricciones de perfil que el usuario haya escrito viajan dentro de `notas`

#### Scenario: Una columna inesperada en la base no rompe la lectura
- **WHEN** una fila de `conductores.conductores` trae una columna `restricciones` que el dominio no
  modela
- **THEN** el mapeo la ignora
- **AND** el `Conductor` se devuelve completo, sin lanzar

#### Scenario: La restricción de carga física se lee del texto libre
- **WHEN** un conductor tiene "no traslada pacientes con carga física" escrito en `notas`
- **THEN** ese texto llega a `Conductor.observaciones` tal cual, sin interpretarse ni parsearse
- **AND** el sistema NO intenta inferir un valor estructurado a partir del texto

### Requirement: Escritura multi-tabla atómica mediante funciones SECURITY INVOKER
El sistema SHALL resolver `create()` con una única llamada
`supabase.schema('conductores').rpc('crear_conductor_completo', { p_conductor })` y `update()` con
una única llamada `rpc('actualizar_conductor_completo', { p_id, p_cambios })`. Ambas funciones SHALL
declararse `SECURITY INVOKER` y MUST NOT declararse `SECURITY DEFINER`, de modo que las policies de
RLS de `conductores.conductores` y `conductores.conductores_vehiculos` sigan evaluándose contra el
usuario autenticado que hace la llamada. Ambas funciones SHALL escribir la fila de
`conductores.conductores` y, cuando la clave `asignaciones` está presente en el payload, reemplazar
por completo las filas de `conductores.conductores_vehiculos` del conductor dentro de la misma
transacción. La ausencia de la clave `asignaciones` en `p_cambios` MUST significar "no tocar" y
MUST NOT borrar las asignaciones existentes. Ambos métodos SHALL releer con `getById()` y resolver
con ese resultado.

#### Scenario: El alta es una sola llamada, no una secuencia de inserciones
- **WHEN** se invoca `create(data)` con un `NuevoConductor` que incluye asignaciones
- **THEN** se emite exactamente una llamada `rpc('crear_conductor_completo', …)`
- **AND** NO se emite ninguna inserción directa sobre `conductores.conductores` ni sobre
  `conductores.conductores_vehiculos`

#### Scenario: Una clave ausente en la actualización no toca las asignaciones
- **WHEN** se invoca `update(id, { telefono: '11...' })` sin la clave `asignaciones`
- **THEN** las filas de `conductores.conductores_vehiculos` de ese conductor quedan intactas
- **AND** las asignaciones devueltas por la relectura son las mismas que antes de la actualización

#### Scenario: Una clave presente reemplaza la colección completa de asignaciones
- **WHEN** se invoca `update(id, { asignaciones: [...] })` con un arreglo nuevo de asignaciones
- **THEN** las filas de `conductores_vehiculos` de ese conductor se reemplazan por el conjunto
  entrante, dentro de la misma transacción
- **AND** un fallo a mitad de esa escritura hace rollback completo, sin dejar asignaciones a medias

#### Scenario: update devuelve el estado real releído, no un merge optimista
- **WHEN** `update` resuelve tras una actualización exitosa
- **THEN** el `Conductor` devuelto proviene de una relectura con `getById(id)`
- **AND** refleja defaults, triggers y normalizaciones aplicados por Postgres

#### Scenario: La declaración de seguridad de las funciones es verificable
- **WHEN** se consulta `prosecdef` en `pg_proc` para `crear_conductor_completo` y
  `actualizar_conductor_completo`
- **THEN** el valor es `false` en las dos (es decir, `SECURITY INVOKER`)
- **AND** el rol `anon` no tiene privilegio `EXECUTE` sobre ninguna de las dos

#### Scenario: La prohibición de SECURITY DEFINER está verificada por un test automatizado
- **WHEN** se inspecciona el texto de `supabase/migrations/20260801120001_conductores_vehiculos_rpc.sql`
  con `node:fs`, ignorando comentarios y literales de cadena
- **THEN** contiene `SECURITY INVOKER` en las cláusulas activas de las funciones de conductores
- **AND** NO contiene `SECURITY DEFINER` fuera de comentarios de advertencia

### Requirement: La colisión de asignación semanal la garantiza la base, no el repository

> ✅ **Pendiente #2 de `C-09` resuelto (2026-07-31)**: la colisión **se bloquea siempre, sin
> excepción y sin override**. Se resuelve con un constraint de base de datos, no con lógica de
> aplicación.

El constraint `uq_conductor_semana UNIQUE (conductor_id, fecha_init)` sobre
`conductores.conductores_vehiculos` SHALL ser la única barrera contra la colisión de asignación
semanal. En consecuencia:

- `conductores.crear_conductor_completo` y `conductores.actualizar_conductor_completo` MUST NOT
  contener ninguna comprobación de colisión de asignaciones, y MUST NOT definir un código de error
  propio para ella. **No existe el código `45205`**; los códigos propios de las funciones van de
  `45201` a `45204`.
- El payload `jsonb` MUST NOT aceptar ninguna clave `permitirMultiple` ni ninguna otra instrucción
  de escritura que relaje la regla. Los tipos `NuevoConductor` y `ActualizacionConductor` MUST NOT
  declarar ese campo, y el repository MUST NOT propagar nada equivalente.
- Cuando la escritura produce una colisión, el error que llega al repository es un `23505` común,
  producido por el constraint dentro de la transacción, con rollback completo.

`toActualizarConductorPayload` mantiene una semántica parcial **uniforme**: la ausencia de una clave
significa siempre "no tocar", sin excepciones, precisamente porque ninguna clave del payload es una
instrucción sobre la escritura.

#### Scenario: Colisión rechazada por la base, sin ninguna forma de habilitarla
- **WHEN** se invoca `update(id, { asignaciones: [...] })` con dos vehículos distintos en la misma
  semana
- **THEN** el `INSERT` viola `uq_conductor_semana`, la transacción hace rollback y ninguna fila de
  `conductores_vehiculos` queda modificada
- **AND** la promesa rechaza con `Error('Ese conductor ya tiene otro vehículo asignado en esa
  semana.')`
- **AND** no existe ningún parámetro, clave de payload ni configuración que permita completar esa
  escritura

#### Scenario: Reasignar el mismo vehículo no es colisión
- **WHEN** se guarda una asignación del mismo vehículo en una semana en la que el conductor ya lo
  tenía
- **THEN** la escritura se completa como edición idempotente (la colección se persiste por reemplazo
  completo, así que no se duplica ninguna fila)

#### Scenario: El payload no lleva ninguna instrucción de escritura
- **WHEN** se inspecciona el `jsonb` que el repository envía a `crear_conductor_completo` /
  `actualizar_conductor_completo`
- **THEN** contiene únicamente datos del conductor y sus asignaciones
- **AND** no contiene ninguna clave `permitirMultiple`

#### Scenario: Las funciones no reimplementan la validación de colisión
- **WHEN** se inspecciona el texto de las funciones de conductores en
  `supabase/migrations/20260801120001_conductores_vehiculos_rpc.sql`
- **THEN** no contienen ninguna consulta de colisión sobre `conductores_vehiculos` previa al insert
- **AND** no levantan ningún `45205`

### Requirement: Degradación explícita cuando falta el permiso cruzado de vehículos
`conductores.conductores_vehiculos` está gateada por el módulo **`vehiculos`**, no por
`conductores`, aunque se edita desde la pantalla de Conductores. El sistema SHALL degradar, nunca
fallar, cuando RLS oculta esa tabla por falta de permiso: sin `vehiculos: read`, `getById()` y
`list()` SHALL devolver el conductor completo con `asignaciones: []` y una señal de degradación
consumible por la UI para mostrar por qué está vacío, nunca "este conductor no tiene asignaciones".
Sin `vehiculos: write`, un intento de guardar una asignación semanal MUST rechazar con un mensaje
propio que distinga esta causa de un fallo genérico de guardado.

#### Scenario: Sin permiso de lectura de vehículos, el conductor se lee igual con asignaciones vacías
- **WHEN** un usuario con `conductores: read` y sin `vehiculos: read` invoca `getById(id)` sobre un
  conductor que sí tiene asignaciones en la base
- **THEN** la promesa resuelve el conductor completo (datos personales y observaciones)
- **AND** `asignaciones` es `[]`, no un error ni una lectura fallida

#### Scenario: La degradación se distingue de "no tiene asignaciones"
- **WHEN** la UI recibe un conductor con `asignaciones: []` porque RLS filtró la tabla por falta de
  `vehiculos: read`
- **THEN** el repository expone una señal que permite a `ConductorDetail` mostrar un cartel explicando
  que la asignación semanal requiere el permiso del módulo Vehículos
- **AND** ese cartel es distinguible de un conductor que genuinamente no tiene ninguna asignación

#### Scenario: Guardar una asignación sin permiso de escritura de vehículos falla con mensaje propio
- **WHEN** un usuario con `conductores: write` y sin `vehiculos: write` invoca `update(id, {
  asignaciones: [...] })`
- **THEN** la escritura sobre `conductores_vehiculos` es rechazada por RLS con `42501`
- **AND** la promesa rechaza con un `Error` cuyo mensaje indica que falta permiso para modificar
  asignaciones de vehículos, distinto del mensaje genérico de guardado

#### Scenario: Editar datos personales sin permiso de vehículos sí funciona
- **WHEN** un usuario con `conductores: write` y sin `vehiculos: write` invoca `update(id, { telefono:
  '11...' })` sin la clave `asignaciones`
- **THEN** la actualización se completa con normalidad
- **AND** no se intenta ninguna escritura sobre `conductores_vehiculos`

### Requirement: Traducción de errores de PostgREST a mensajes en castellano
El sistema SHALL lanzar siempre instancias de `Error` con un `message` en castellano apto para
mostrarse tal cual al usuario, porque `useConductores` pinta `err.message` directamente. El sistema
SHALL implementar `mapearErrorConductor`, que traduce los códigos de PostgREST/Postgres a mensajes de
dominio, y MUST NOT propagar el texto crudo del motor ni nombres de tablas o columnas.

#### Scenario: DNI duplicado produce un mensaje accionable
- **WHEN** `create()` falla por el constraint `UNIQUE` de `conductores.conductores.dni` (`23505`)
- **THEN** la promesa rechaza con un `Error` cuyo `message` es
  `Ya existe un conductor con el documento «…».`

#### Scenario: El mismo par repetido produce mensaje propio
- **WHEN** una escritura sobre `conductores_vehiculos` viola el constraint
  `conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key` (`23505`)
- **THEN** la promesa rechaza con un `Error` cuyo `message` es `Ese conductor ya tiene ese vehículo
  asignado en esa semana.`

#### Scenario: Colisión de vehículos distintos en la misma semana produce su propio mensaje
- **WHEN** una escritura sobre `conductores_vehiculos` viola el constraint `uq_conductor_semana`
  (`23505`)
- **THEN** la promesa rechaza con un `Error` cuyo `message` es `Ese conductor ya tiene otro vehículo
  asignado en esa semana.`
- **AND** ese mensaje es distinto del del constraint viejo, que habla de **ese** vehículo ya asignado

#### Scenario: Los dos 23505 se discriminan por el nombre del constraint
- **WHEN** `mapearErrorConductor` recibe un `23505` sobre `conductores_vehiculos`
- **THEN** elige el mensaje según el nombre de constraint que Postgres reporta en `message` /
  `details`, no según la operación ni el orden de las claves del payload
- **AND** si el nombre del constraint no viniera en el error, cae a un mensaje genérico de asignación
  duplicada en vez de afirmar cuál de los dos casos ocurrió

#### Scenario: Vehículo inexistente al asignar produce mensaje propio
- **WHEN** una escritura sobre `conductores_vehiculos` viola la FK hacia `conductores.vehiculo`
  (`23503`)
- **THEN** la promesa rechaza con un `Error` cuyo `message` es `El vehículo seleccionado ya no
  existe.`

#### Scenario: Falta de permiso sobre conductores se traduce
- **WHEN** una escritura sobre `conductores.conductores` es rechazada por RLS con `42501` o
  `PGRST301`
- **THEN** la promesa rechaza con un `Error` cuyo `message` es `No tenés permiso para modificar
  conductores.`

#### Scenario: RPC sin aplicar se explica en castellano
- **WHEN** PostgREST responde `PGRST202` porque
  `20260801120001_conductores_vehiculos_rpc.sql` no fue aplicada
- **THEN** la promesa rechaza con un `Error` cuyo `message` indica que el alta de conductores no está
  habilitada en el servidor
- **AND** el mensaje no contiene el código crudo de PostgREST

#### Scenario: Columna sin aplicar se explica en castellano
- **WHEN** PostgREST responde `PGRST204` por una columna inexistente porque
  `20260801120000_conductores_vehiculos_campos.sql` no fue aplicada
- **THEN** la promesa rechaza con un `Error` cuyo `message` indica que esa pantalla necesita una
  actualización del servidor todavía no aplicada

#### Scenario: Schema no expuesto se explica en castellano
- **WHEN** PostgREST responde `PGRST106` porque el schema `conductores` no está en *Exposed schemas*
- **THEN** la promesa rechaza con un `Error` cuyo `message` indica que el módulo de Flota no está
  habilitado en el servidor

#### Scenario: getById sin fila nunca lanza
- **WHEN** `getById(id)` no encuentra ninguna fila (id inexistente o filtrada por RLS)
- **THEN** la promesa resuelve `null`, nunca rechaza (contrato explícito de la interfaz, no cubierto
  por `mapearErrorConductor`)

### Requirement: RLS existente como única autorización, sin duplicarla ni bypassearla
El sistema SHALL apoyarse exclusivamente en las policies de RLS ya definidas
(`modulos.tiene_permiso('conductores', …)` y `modulos.tiene_permiso('vehiculos', …)`) para autorizar
lecturas y escrituras. El sistema MUST NOT reimplementar, replicar ni anticipar esa lógica de
permisos en el repository, y MUST NOT tratar el gateo de escritura de la UI (`usePuedeEscribir`,
cableado por `gateo-conductores`) como control de acceso, dado que es client-side y evitable.

#### Scenario: El repository no consulta la tabla de permisos
- **WHEN** se inspeccionan las consultas de `SupabaseConductorRepository.ts`
- **THEN** no lee `modulos.permisos` ni `modulos.modulos` para decidir si operar
- **AND** delega la decisión a la policy de RLS del servidor

#### Scenario: Un intento de escritura sin permiso falla en el servidor, no antes
- **WHEN** un usuario sin `conductores: write` evita el gateo de UI e invoca `create()` o `update()`
- **THEN** la escritura es rechazada por la base
- **AND** el repository traduce ese rechazo a un error visible, sin haberla permitido localmente

### Requirement: El alta de un conductor no crea acceso al sistema
El sistema MUST NOT crear ninguna fila en `auth.users` ni en `usuarios` como parte de `create()` ni de
`update()` de un conductor, porque los conductores no acceden al sistema: son únicamente datos
administrativos y operativos (RN-GL-03).

#### Scenario: Dar de alta un conductor no toca auth.users
- **WHEN** se invoca `create(data)` con un `NuevoConductor` completo
- **THEN** la función `crear_conductor_completo` no inserta ninguna fila en `auth.users` ni en
  `usuarios`
- **AND** el conductor creado no tiene ninguna referencia a un id de usuario de auth

### Requirement: Inyección en el composition root de Conductores
El sistema SHALL inyectar `SupabaseConductorRepository` desde
`frontend/src/features/conductores/ConductoresRoute.tsx`, que además monta el
`VehiculoRepositoryProvider` para el selector de vehículo de la asignación semanal. El swap de
Conductores MUST reemplazar ambas inyecciones (`ConductorRepositoryProvider` y
`VehiculoRepositoryProvider`) por sus implementaciones reales en el mismo cambio, dado que la pantalla
depende de las dos. Ningún componente, hook ni context de `features/conductores/` MUST importar
`SupabaseConductorRepository`, `SupabaseVehiculoRepository` ni el cliente `supabase` directamente.

#### Scenario: Solo el composition root conoce las implementaciones reales
- **WHEN** se buscan importaciones de `SupabaseConductorRepository`, `SupabaseVehiculoRepository` o
  `supabaseClient` en `frontend/src/features/conductores/`
- **THEN** la única coincidencia de producción es `ConductoresRoute.tsx`

#### Scenario: El swap de Conductores toca los dos providers en el mismo cambio
- **WHEN** se revisa el diff que cambia la implementación inyectada en `ConductoresRoute.tsx`
- **THEN** tanto `ConductorRepositoryProvider` como `VehiculoRepositoryProvider` pasan a recibir sus
  implementaciones reales
- **AND** no queda un estado intermedio donde uno de los dos siga inyectando el mock, salvo la fase
  transitoria documentada en D2 del design (corte 1, antes del corte 2)

#### Scenario: El mock sobrevive como doble de test
- **WHEN** se completa este change
- **THEN** `mockConductorRepository` sigue existiendo y sus tests siguen pasando
- **AND** ya no es la implementación inyectada por `ConductoresRoute.tsx`
