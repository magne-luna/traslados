## ADDED Requirements

> **⚠️ GOVERNANCE ALTO — checkpoints pendientes.** Este spec depende de los tres checkpoints de
> `design.md`, ninguno resuelto todavía y cuyo veredicto final lo toma la usuaria/Enzo en `tasks.md`
> §0.1: **CP0** (swap parcial vs. bloquear), **CP1** (esquema: repropuesta de `historial_recorridos`
> + 2 tablas nuevas vs. 3 tablas 100% nuevas; y confirmación de `conductor_id`), **CP2** (aceptar
> `RecorridoMapa` sin coordenadas vs. geocoding real). Donde la forma dependa de un checkpoint, el
> requisito lo declara como opción.

### Requirement: Implementación real SupabaseHojaDeRutaRepository

El sistema SHALL proveer una implementación de `HojaDeRutaRepository` en
`frontend/src/shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository.ts` que lea y escriba contra el
schema `pacientes` de Supabase usando el singleton compartido `frontend/src/shared/lib/supabaseClient.ts`
(`anon key` + sesión). La implementación MUST cumplir las cinco firmas de la interfaz (`list`,
`getById`, `getByFecha`, `create`, `update`) **sin modificarlas**, sin agregar métodos y sin cambiar
los tipos de `shared/types/hojaDeRuta.ts`. MUST NOT usar `any` ni `as` sobre datos externos, ni la
`SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian
- **GIVEN** la interfaz `HojaDeRutaRepository` existente
- **WHEN** se compila `SupabaseHojaDeRutaRepository` con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `HojaDeRutaRepository` sin casts ni `any`
- **AND** ni `HojaDeRutaRepository.ts` ni `shared/types/hojaDeRuta.ts` fueron modificados

#### Scenario: getByFecha sin hoja para la fecha resuelve null (no lanza)
- **GIVEN** una fecha sin hoja de ruta persistida
- **WHEN** se invoca `getByFecha(fecha)`
- **THEN** la promesa resuelve `null`
- **AND** NO se lanza ninguna excepción (semántica ya fijada por la interfaz, no se cambia)

### Requirement: Mapeo puro separado del I/O

El sistema SHALL implementar toda la traducción fila↔dominio en funciones puras de
`frontend/src/shared/lib/hojas-de-ruta/hojaDeRutaMapping.ts` (`parseHojaDeRutaRow`,
`parseRecorridoRow`, `parseParadaRow`, `ensamblarHojaDeRuta`, `toCrearHojaDeRutaPayload`,
`toActualizarHojaDeRutaPayload`), sin efectos, sin reloj global y sin red. Las funciones de parseo MUST
angostar `unknown` con type guards explícitos (nunca `any`, nunca `as`) y MUST descartar —no
propagar— una fila hija malformada sin romper el agregado completo. El repository SHALL limitarse a
`await`, chequear `error` y delegar toda decisión de forma a este módulo.

#### Scenario: El mapeo se testea sin mockear la red
- **GIVEN** filas crudas de `pacientes.hoja_de_ruta` / `recorrido` / `historial_recorridos` como objetos literales
- **WHEN** se invocan las funciones de parseo directamente en un test
- **THEN** devuelven los tipos del dominio sin montar ningún fake del cliente Supabase

#### Scenario: Una parada malformada no rompe el agregado
- **GIVEN** una respuesta con una parada embed donde un campo no nullable viene `null`
- **WHEN** se ensambla el agregado
- **THEN** esa parada se descarta
- **AND** el resto del agregado (hoja y demás recorridos/paradas) se devuelve normalmente

#### Scenario: Angostamiento explícito sin `any` ni `as`
- **GIVEN** el texto de `hojaDeRutaMapping.ts`
- **WHEN** se inspecciona
- **THEN** no contiene `any` ni `as` sobre valores de Supabase
- **AND** toda narrow de `unknown` pasa por un type guard con nombre propio

### Requirement: Ensamblado del agregado de tres niveles en una consulta

El sistema SHALL resolver `list`/`getById`/`getByFecha` leyendo `pacientes.hoja_de_ruta` con un único
embed de PostgREST que reconstruye `HojaDeRuta → Recorrido[] → ParadaRecorrido[]`, agrupando por
`hoja_de_ruta_id` y `recorrido_id` dentro de `ensamblarHojaDeRuta`. El sistema MUST NOT depender del
orden físico del embed: `tramo`/`orden` de cada parada vienen de columnas mapeadas, y el orden de las
colecciones SHALL aplicarse en el mapeo puro con `id` como desempate determinista. La forma exacta de
las tablas depende del CP1: opción A (repropuesta de `historial_recorridos` como paradas + tablas
nuevas agrupadoras) o B (tres tablas 100% nuevas); el mapeo MUST ajustarse al veredicto de la
usuaria/Enzo sin cambiar la forma del agregado que consume la UI.

#### Scenario: Un solo select devuelve los tres niveles
- **GIVEN** una hoja de ruta con dos recorridos y paradas de ida y vuelta
- **WHEN** se invoca `getById(id)`
- **THEN** la hoja vuelve con sus recorridos ordenados y cada recorrido con sus paradas, desde una única consulta con embed

#### Scenario: Sin acceso de lectura no se filtra por cliente
- **GIVEN** un usuario sin `hojas_de_ruta: read`
- **WHEN** se invoca `list()` o `getById(id)`
- **THEN** RLS oculta la fila y la operación se comporta como "cambios no visibles", sin que el repository reimplemente permisos

### Requirement: Escritura multi-tabla atómica vía funciones SECURITY INVOKER

El sistema SHALL resolver `create`/`update` con llamadas a las funciones
`pacientes.crear_hoja_de_ruta_completa(p_hoja jsonb)` y `pacientes.actualizar_hoja_de_ruta_completa(p_id, p_cambios)`,
que escriben hasta 3 tablas dentro de una sola transacción (CP1 opción A: `hoja_de_ruta`, `recorrido`,
`historial_recorridos`). Dichas funciones SHALL declararse **`SECURITY INVOKER`**, con `SECURITY
DEFINER` prohibido. Semántica de colecciones: reemplazo completo (DELETE+INSERT) dentro de la
transacción; una clave ausente (`recorridos`) MUST significar "no tocar", jamás "vaciar" — distinción
con el operador `?` de `jsonb`, no con `->>`. `create`/`update` SHALL releer con `getById` después de
escribir y resolver con el estado real. El mapeo SHALL mantener `historial_recorridos.id_vehiculo`
sincronizado con `recorrido.vehiculo_id` en cada escritura (CP1 opción A).

#### Scenario: El alta es una única llamada RPC
- **GIVEN** un `NuevaHojaDeRuta` con recorridos y paradas
- **WHEN** se invoca `create(data)`
- **THEN** se emite exactamente una llamada `rpc('crear_hoja_de_ruta_completa', ...)`
- **AND** NO se emiten inserciones directas por tabla ni borrados compensatorios
- **AND** la promesa resuelve a la hoja releída con `getById`

#### Scenario: Una clave ausente en la actualización no toca los recorridos
- **GIVEN** un `update(id, { notas: '...' })` sin la clave `recorridos`
- **WHEN** se ejecuta
- **THEN** NO se emite ningún DELETE/INSERT sobre recorridos ni paradas
- **AND** los recorridos existentes permanecen intactos tras la relectura

#### Scenario: La prohibición de SECURITY DEFINER es verificable
- **GIVEN** las dos funciones aplicadas
- **WHEN** se consulta `prosecdef` en `pg_proc`
- **THEN** es `false` en las dos
- **AND** `anon` no tiene `EXECUTE` sobre ninguna

### Requirement: Traducción de errores de PostgREST a mensajes en castellano

El sistema SHALL lanzar siempre instancias de `Error` con `message` en castellano apto para mostrarse
tal cual (porque `useHojasDeRuta` pinta `err.message`), traduciendo los códigos propios de clase `45`
y los genéricos. El sistema MUST NOT propagar texto crudo del motor ni nombres de tablas a la UI.

| Código | Señal | Mensaje |
|---|---|---|
| `45301` | `p_hoja` no es JSON | `No se pudo guardar la hoja de ruta.` |
| `45302` | id inexistente u oculto por RLS en `actualizar_...` | `No existe una hoja de ruta con id "…".` |
| `45303` | `fecha` duplicada en `crear_...` | `Ya existe una hoja de ruta para esa fecha.` |
| `45304` | `recorrido` sin vehículo/conductor resoluble | `Revisá el vehículo y el conductor del recorrido.` |
| `PGRST204` | columna no aplicada | mensaje propio en castellano |
| `PGRST202` | RPC no aplicada | mensaje propio en castellano |
| `42501` | falta de permiso | mensaje propio en castellano |

#### Scenario: Fecha duplicada produce un mensaje accionable
- **GIVEN** un alta para una fecha que ya tiene hoja (viola `UNIQUE`)
- **WHEN** la función responde `45303`
- **THEN** la promesa rechaza con `Error('Ya existe una hoja de ruta para esa fecha.')`

#### Scenario: RLS oculta un recorrido en la actualización
- **GIVEN** un `update(id, ...)` sobre una hoja que la policy de RLS ya no muestra
- **WHEN** la función responde `45302`
- **THEN** la promesa rechaza con un `Error` cuyo mensaje coincide con el del mock

#### Scenario: Cada código genérico tiene su propio test
- **GIVEN** respuestas de error con `PGRST204`, `PGRST202` y `42501`
- **WHEN** el repository las traduce
- **THEN** cada una produce un mensaje en castellano propio, sin el código crudo ni nombres de tabla

### Requirement: El repository no reimplementa permisos

El sistema SHALL apoyarse exclusivamente en las policies de RLS ya definidas sobre las tablas
(`tiene_permiso('hojas_de_ruta', 'read'|'write')`) para autorizar lecturas y escrituras. El repository
MUST NOT leer `modulos.permisos` ni `modulos.modulos` para decidir si operar, ni tratar el gateo
client-side de la UI (`usePuedeEscribir`) como control de acceso.

#### Scenario: El repository nunca consulta la tabla de permisos
- **GIVEN** el código de `SupabaseHojaDeRutaRepository.ts`
- **WHEN** se inspeccionan sus consultas
- **THEN** no lee `modulos.permisos` ni `modulos.modulos`
- **AND** delega la decisión a las policies de RLS que evalúa el servidor