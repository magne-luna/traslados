## ADDED Requirements

### Requirement: Implementación real SupabaseVehiculoRepository

El sistema SHALL proveer una implementación de `VehiculoRepository` en
`frontend/src/shared/lib/vehiculos/SupabaseVehiculoRepository.ts` que lea y escriba contra el schema
`conductores` de Supabase (más `facturacion.gastos_vehiculos` y `pacientes.accesorios` como consultas
cruzadas) usando el cliente compartido `frontend/src/shared/lib/supabaseClient.ts` (`anon key` +
sesión del usuario). La implementación MUST cumplir las cuatro firmas de la interfaz (`list`,
`getById`, `create`, `update`) sin modificarlas, sin agregar métodos y sin cambiar los tipos del
dominio de `shared/types/vehiculo.ts`. La implementación MUST NOT usar `any` ni `as` sobre datos
externos, ni la `SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian
- **GIVEN** la interfaz `VehiculoRepository` existente
- **WHEN** se compila `SupabaseVehiculoRepository` con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `VehiculoRepository` sin casts ni `any`
- **AND** ni `VehiculoRepository.ts` ni `shared/types/vehiculo.ts` fueron modificados por este archivo

#### Scenario: getById de un id inexistente resuelve null sin lanzar
- **GIVEN** un id que no corresponde a ningún vehículo
- **WHEN** se invoca `getById(id)`
- **THEN** la promesa resuelve `null`
- **AND** NO se lanza ninguna excepción (contrato idéntico al del mock)

#### Scenario: Nunca se usa una clave privilegiada en el frontend
- **GIVEN** el código fuente de `SupabaseVehiculoRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `service_role` ni ninguna creación de cliente propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

### Requirement: Mapeo puro separado del I/O

El sistema SHALL implementar toda la traducción entre filas de Postgres y los tipos de
`shared/types/vehiculo.ts` en funciones puras exportadas desde
`frontend/src/shared/lib/vehiculos/vehiculoMapping.ts` (`parseVehiculoRow`, `parseMantenimientoRow`,
`parseGastoRow`, `parseAccesoriosRows`, `ensamblarVehiculo`,
`toCrearVehiculoPayload`, `toActualizarVehiculoPayload`), sin efectos, sin lectura de reloj global y
sin acceso a red. Las funciones de parseo MUST angostar `unknown` con type guards explícitos y MUST
descartar (no propagar) las filas que no cumplen la forma esperada, en lugar de romper la operación
completa. El repository SHALL limitarse a `await`, chequear `error` y delegar toda decisión de forma
a estas funciones.

#### Scenario: El mapeo se testea sin mockear la red
- **GIVEN** una fila cruda de `conductores.vehiculo` con sus embeds, como objeto literal
- **WHEN** se invoca `parseVehiculoRow` directamente en un test
- **THEN** devuelve un `Vehiculo` válido sin haber montado ningún fake del cliente Supabase

#### Scenario: Una fila hija malformada no rompe el vehículo
- **GIVEN** una respuesta donde uno de los `accesorios_vehiculo` embebidos no trae su fila de
  `accesorios` resuelta
- **WHEN** se mapea el vehículo
- **THEN** ese accesorio se descarta de `accesoriosCompatibles`
- **AND** el resto del vehículo se devuelve normalmente

#### Scenario: Angostamiento explícito sin `any` ni `as`
- **GIVEN** el código fuente de `vehiculoMapping.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `any` ni el operador `as` sobre valores provenientes de Supabase
- **AND** toda narrow de `unknown` pasa por un type guard con nombre propio

#### Scenario: El repository es una cáscara delgada de I/O
- **GIVEN** el código fuente de `SupabaseVehiculoRepository.ts`
- **WHEN** se inspecciona su cuerpo
- **THEN** ninguna función arma la forma del dominio a mano dentro del repository
- **AND** toda transformación fila↔dominio se delega a `vehiculoMapping.ts`

### Requirement: Lectura del vehículo en una consulta con embeds y una segunda consulta batcheada de gastos

> ⚠️ **SUPERSEDED en el mecanismo de acceso (2026-08-01) — ver `design.md` §Reconciliación con
> C-08-vehiculos-mantenimiento, D11.** Este requisito asume que `SupabaseVehiculoRepository` habla
> PostgREST directo contra `conductores.vehiculo`. La implementación real llama en cambio a la Edge
> Function `vehiculos` (GET `/vehiculos` para `list()`, GET `/vehiculos/:id` para `getById()`) vía
> `supabase.functions.invoke()`, con el mismo patrón que `SupabaseCuentaRepository.ts` — ver el
> requisito "Lectura vía la Edge Function `vehiculos`" más abajo, que es la especificación vigente.
> Se conserva el texto original como registro de lo planeado antes de conocer el backend real.

Con la decisión original de este documento (superada), el sistema SHALL resolver `list()` y `getById()` con una única consulta a `conductores.vehiculo` que
embeba `accesorios_vehiculo → accesorios` y `mantenimiento`:

```sql
supabase.schema('conductores').from('vehiculo').select(`
  id, patente, modelo, tipo, capacidad, año, estado, notas,
  kilometraje, kilometraje_ultimo_service, fecha_ultimo_service,
  accesorios_vehiculo ( accesorio_id, accesorios:accesorio_id ( id, tipo ) ),
  mantenimiento ( id, categoria, subtipo, detalle, descripcion, fecha,
                  fecha_proximo_vencimiento, km_actual, km_proximo_vencimiento )
`)
```

Dado que `facturacion.gastos_vehiculos` vive en otro schema y bajo otro módulo de permisos, el
sistema SHALL resolver los gastos con una **segunda** consulta, filtrada por `vehiculo_id IN (…)` para
`list()` y agrupada client-side por vehículo. El sistema MUST NOT emitir una consulta de gastos por
vehículo (patrón N+1): para N vehículos, `list()` SHALL emitir exactamente 2 consultas en total (1 a
`vehiculo`, 1 a `gastos_vehiculos`), nunca N+1.

#### Scenario: Un listado de N vehículos no dispara N consultas de gastos
- **GIVEN** un usuario con `vehiculos: read` y `facturacion: read`, y 5 vehículos en la base
- **WHEN** se invoca `list()`
- **THEN** se emite una sola consulta a `conductores.vehiculo` con embeds
- **AND** se emite una sola consulta a `facturacion.gastos_vehiculos` filtrada por los 5 ids
- **AND** cada vehículo vuelve con sus accesorios, mantenimientos y gastos resueltos

#### Scenario: getById hace una consulta de vehículo con embeds y una de gastos
- **GIVEN** un id de vehículo existente
- **WHEN** se invoca `getById(id)`
- **THEN** se emite una consulta a `conductores.vehiculo` con `.eq('id', id).maybeSingle()`
- **AND** se emite una consulta a `facturacion.gastos_vehiculos` filtrada por ese `vehiculo_id`

#### Scenario: getById de un id inexistente resuelve a null
- **GIVEN** un id que no corresponde a ningún vehículo
- **WHEN** se invoca `getById(id)`
- **THEN** la promesa resuelve a `null`
- **AND** NO se emite ninguna consulta de gastos, porque no hay vehículo al cual asociarlos

#### Scenario: RLS que filtra la fila se comporta como "no existe" — ⚠️ SUPERSEDED
> No aplica tal cual con la implementación real: la Edge Function usa un cliente `service-role`
> que no está sujeto a RLS. Un vehículo inexistente sigue resolviendo `null` (la función devuelve
> `404`), pero por ausencia de fila, no por filtrado de RLS. Se conserva como registro.
- **GIVEN** un usuario sin permiso `vehiculos: read`
- **WHEN** se invoca `getById(id)` sobre un vehículo que sí existe en la base
- **THEN** la consulta a `conductores.vehiculo` devuelve 0 filas porque la policy de RLS la filtra
- **AND** `getById` resuelve a `null` en lugar de lanzar un error de permisos

### Requirement: Lectura y escritura vía la Edge Function `vehiculos` (implementación real, vigente)

El sistema SHALL resolver las cuatro operaciones de `VehiculoRepository` llamando a la Edge Function
`vehiculos` (`supabase/functions/vehiculos/index.ts`) por HTTP, con el mismo patrón que ya usa
`frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.ts`: `supabase.functions.invoke(nombre,
{ body, method })`, que adjunta automáticamente el JWT de la sesión activa como header
`Authorization`. `list()` SHALL invocar GET sobre `'vehiculos'`; `getById(id)` SHALL invocar GET
sobre `` `vehiculos/${id}` ``; `create(data)` SHALL invocar POST sobre `'vehiculos'`; `update(id,
data)` SHALL invocar PATCH sobre `` `vehiculos/${id}` ``. El sistema MUST NOT construir consultas
PostgREST directas (`supabase.schema('conductores').from('vehiculo')`) para estas operaciones: la
Edge Function ya resuelve internamente los embeds, la resolución de accesorios contra
`pacientes.accesorios` y la agregación de gastos y habilitaciones.

El sistema SHALL traducir el error de `supabase.functions.invoke()` inspeccionando
`error.context` (una `Response`) por su `status`, siguiendo el mismo mapeo de
`mapearErrorEdgeFunction` que ya usa `SupabaseCuentaRepository.ts`, y MUST NOT propagar el cuerpo
crudo de la respuesta.

#### Scenario: list() invoca GET sobre la Edge Function
- **WHEN** se invoca `list()`
- **THEN** se emite `supabase.functions.invoke('vehiculos', { method: 'GET' })`
- **AND** NO se emite ninguna consulta directa a `conductores.vehiculo` vía PostgREST

#### Scenario: getById(id) invoca GET con el id en el path
- **GIVEN** un id de vehículo existente
- **WHEN** se invoca `getById(id)`
- **THEN** se emite `supabase.functions.invoke(`vehiculos/${id}`, { method: 'GET' })`

#### Scenario: getById de un vehículo inexistente resuelve null sin lanzar
- **GIVEN** un id que no corresponde a ningún vehículo
- **WHEN** la Edge Function responde `404`
- **THEN** `getById` resuelve `null`, no rechaza

#### Scenario: create() invoca POST y update() invoca PATCH
- **GIVEN** un `NuevoVehiculo` válido
- **WHEN** se invoca `create(data)`
- **THEN** se emite `supabase.functions.invoke('vehiculos', { method: 'POST', body })`
- **AND** un `update(id, cambios)` posterior emite `supabase.functions.invoke(`vehiculos/${id}`, { method: 'PATCH', body: cambios })`

#### Scenario: El error de la Edge Function se traduce sin propagar el cuerpo crudo
- **GIVEN** una respuesta de error de la Edge Function con status `403`
- **WHEN** `supabase.functions.invoke()` rechaza con ese error
- **THEN** el repository lo traduce a un `Error` con mensaje en castellano, sin exponer el JSON crudo de la respuesta

### Requirement: Reconstrucción de la unión discriminada MantenimientoRegistro desde categoría, subtipo y detalle

El sistema SHALL reconstruir cada `MantenimientoRegistro` (unión discriminada de 4 miembros) a partir
de las columnas `categoria`, `subtipo`, `detalle` y `descripcion` de `conductores.mantenimiento`,
respetando exactamente la forma que exige `vehiculo-contract`: `gasto` sin sub-tipo; `preventivo` con
sub-tipo en `{'cambio-aceite-filtros', 'vtv', 'rto'}`; `correctivo` con sub-tipo en
`{'alternador','bateria','frenos','embrague','cubiertas'}`; `correctivo` con el sub-tipo de escape
`'otro'` y `detalle` no vacío. Una fila cuya combinación de `categoria`/`subtipo`/`detalle` no
corresponde a ninguno de los 4 miembros MUST descartarse del historial mapeado sin romper el resto
del vehículo — misma política que una fila hija malformada.

#### Scenario: Reconstrucción de un registro preventivo con sub-tipo cerrado
- **GIVEN** una fila con `categoria = 'preventivo'` y `subtipo = 'vtv'`
- **WHEN** se mapea con `parseMantenimientoRow`
- **THEN** el resultado es un `MantenimientoRegistro` con `tipoIntervencion: 'preventivo'` y
  `subtipo: 'vtv'`, sin campo `detalle`

#### Scenario: Reconstrucción de un registro correctivo con el sub-tipo de escape
- **GIVEN** una fila con `categoria = 'correctivo'`, `subtipo = 'otro'` y `detalle = 'Rótula suspensión'`
- **WHEN** se mapea con `parseMantenimientoRow`
- **THEN** el resultado tiene `tipoIntervencion: 'correctivo'`, `subtipo: 'otro'` y
  `detalle: 'Rótula suspensión'`

#### Scenario: Reconstrucción de un registro de tipo "gasto" sin sub-tipo
- **GIVEN** una fila con `categoria = 'gasto'`, `subtipo = null` y `detalle = null`
- **WHEN** se mapea con `parseMantenimientoRow`
- **THEN** el resultado tiene `tipoIntervencion: 'gasto'` y no tiene la clave `subtipo`

#### Scenario: Una fila incoherente con el CHECK se descarta sin romper el vehículo
- **GIVEN** una fila con `categoria = 'correctivo'`, `subtipo = 'otro'` y `detalle = null` (violación
  de `chk_categoria_subtipo`, posible mientras el constraint es `NOT VALID`)
- **WHEN** se mapea el vehículo que la contiene
- **THEN** ese registro de mantenimiento se descarta del historial
- **AND** el resto del historial y el resto del vehículo se devuelven normalmente

#### Scenario: El mapeo no inventa un miembro de la unión que la fila no sostiene
- **GIVEN** una fila con `categoria = 'preventivo'` y `subtipo = 'alternador'` (valor del catálogo
  correctivo, no del preventivo)
- **WHEN** se mapea con `parseMantenimientoRow`
- **THEN** el registro se descarta, en vez de forzarlo a un sub-tipo preventivo que no corresponde

### Requirement: Habilitaciones VTV/RTO derivadas del historial de mantenimiento

> ⚠️ **SUPERSEDED para `SupabaseVehiculoRepository` (2026-08-01) — ver `design.md` §Reconciliación
> con C-08-vehiculos-mantenimiento, D3.** El backend real (Enzo, `C-08-vehiculos-mantenimiento`,
> ya mergeado) creó `conductores.habilitaciones_vehiculo(id, vehiculo_id, tipo, fecha_emision,
> fecha_vencimiento)` — la tabla que este requisito decía que "no existe en la base y este change
> MUST NOT crearla". La implementación real de `SupabaseVehiculoRepository` MUST leer y escribir esa
> tabla directamente a través de la Edge Function (que ya expone `habilitaciones` en su respuesta
> JSON, sin `id`, resuelto contra esa tabla), y MUST NOT llamar a `derivarHabilitaciones()`. Ese
> texto y esos escenarios siguen siendo la especificación vigente para `mockVehiculoRepository`
> únicamente. Se conservan sin editar como registro de la decisión original.

Con la decisión original de este documento (vigente para el mock, superada para el repository real), no existe ninguna tabla de habilitaciones en la base y este change MUST NOT crearla (decisión D3,
opción B). El sistema SHALL derivar `Vehiculo.habilitaciones` de las filas de
`conductores.mantenimiento` con `categoria = 'preventivo'` y `subtipo IN ('vtv','rto')`, mediante una
función pura `derivarHabilitaciones(mantenimientos)` ubicada junto al resto de las funciones puras de
mantenimiento (`frontend/src/shared/lib/mantenimiento/`) y **compartida con el mock**, de modo que
las dos implementaciones muestren lo mismo para los mismos datos. La derivación SHALL aplicarse en
`ensamblarVehiculo`, **después** de mapear el historial, y MUST operar sobre los registros ya
mapeados —nunca sobre filas crudas—, de modo que un registro descartado por incoherente con
`chk_categoria_subtipo` no pueda producir una habilitación fantasma.

Para cada tipo (`'vtv'`, `'rto'`), evaluados de forma independiente entre sí (RN-VE-04), el sistema
SHALL tomar el registro con `fecha` más reciente entre los que tienen próximo vencimiento por fecha
informado, con desempate determinista por `id`, y mapear `fecha → fechaEmision` y
`proximoVencimientoFecha → fechaVencimiento`. Un tipo sin registros que cumplan esas condiciones MUST
NOT emitir ninguna `RegistroHabilitacion`; el sistema MUST NOT inventar una fecha de vencimiento para
poder mostrar la habilitación.

El sistema MUST NOT emitir la clave `habilitaciones` en `toCrearVehiculoPayload` ni en
`toActualizarVehiculoPayload`, y las funciones RPC MUST NOT tener ninguna tabla donde escribirla. Un
payload de entrada que la traiga MUST descartarse silenciosamente en el mapeo, sin fallar la
operación: es un campo de salida.

#### Scenario: La habilitación VTV sale de la intervención preventiva correspondiente
- **GIVEN** una fila de `conductores.mantenimiento` con `categoria = 'preventivo'`, `subtipo = 'vtv'`,
  `fecha = '2026-03-10'` y `fecha_proximo_vencimiento = '2026-09-10'`
- **WHEN** se mapea el vehículo que la contiene
- **THEN** `habilitaciones` incluye una entrada de tipo VTV con `fechaEmision = '2026-03-10'` y
  `fechaVencimiento = '2026-09-10'`
- **AND** NO se emite ninguna consulta a ninguna tabla de habilitaciones, porque no existe

#### Scenario: Entre varias intervenciones del mismo tipo gana la más reciente
- **GIVEN** tres filas `preventivo` + `vtv` con próximo vencimiento y fechas distintas
- **WHEN** se mapea el vehículo
- **THEN** `habilitaciones` tiene exactamente una entrada de tipo VTV, la de `fecha` más reciente
- **AND** si dos comparten la fecha más reciente, el desempate por `id` hace que dos mapeos
  consecutivos de los mismos datos elijan la misma

#### Scenario: Una intervención sin próximo vencimiento no genera habilitación
- **GIVEN** una fila `preventivo` + `rto` con `fecha_proximo_vencimiento = null`
- **WHEN** se mapea el vehículo
- **THEN** `habilitaciones` no incluye ninguna entrada de tipo RTO
- **AND** el resto del vehículo, incluido ese registro en el historial de mantenimiento, se mapea con
  normalidad

#### Scenario: Un registro descartado por incoherente no produce una habilitación fantasma
- **GIVEN** una fila con `categoria = 'preventivo'` y `subtipo = 'vtv'` que el mapeo descarta por no
  corresponder a ningún miembro de `MantenimientoRegistro`
- **WHEN** se mapea el vehículo
- **THEN** esa fila no aparece en el historial ni produce ninguna entrada en `habilitaciones`

#### Scenario: La escritura nunca emite la clave habilitaciones
- **GIVEN** un `NuevoVehiculo` o un `ActualizacionVehiculo` que incluye `habilitaciones`
- **WHEN** se construye el payload con `toCrearVehiculoPayload` / `toActualizarVehiculoPayload`
- **THEN** el `jsonb` enviado a la RPC no contiene ninguna clave `habilitaciones`
- **AND** la operación se completa con normalidad, sin error por esa clave

### Requirement: Mapeo total de los enums con valores distintos entre la base y el frontend

El sistema SHALL traducir `estado` de vehículo entre la forma con espacio de la base
(`'habilitado' | 'fuera de servicio'`) y la forma con guion del frontend
(`'habilitado' | 'fuera-de-servicio'`) con dos funciones puras y totales (`parseEstadoVehiculo` /
`toEstadoVehiculoRow`). El sistema MUST NOT implementar la traducción con un `.replace(' ', '-')` u
operación equivalente de reemplazo de caracteres. Un valor de `estado` que la base devuelva y no
pertenezca al dominio esperado MUST degradarse al valor por defecto (`'habilitado'`) sin romper la
lectura del vehículo ni del listado.

#### Scenario: Traducción de estado guion↔espacio en la lectura
- **GIVEN** una fila con `estado = 'fuera de servicio'`
- **WHEN** se mapea a `Vehiculo`
- **THEN** `Vehiculo.estado` es `'fuera-de-servicio'`

#### Scenario: Traducción de estado guion↔espacio en la escritura
- **GIVEN** un payload de escritura con `estado: 'fuera-de-servicio'`
- **WHEN** se construye el payload hacia la RPC con `toEstadoVehiculoRow`
- **THEN** el valor enviado es `'fuera de servicio'`, con el espacio del enum de Postgres

#### Scenario: Un valor de estado desconocido degrada al default sin romper la lectura
- **GIVEN** una fila con `estado = 'en reparación'` (valor fuera del enum documentado)
- **WHEN** se mapea el vehículo
- **THEN** `Vehiculo.estado` se resuelve como `'habilitado'`
- **AND** el resto del vehículo se lee con normalidad, sin lanzar

#### Scenario: La traducción es total, no una tabla parcial
- **GIVEN** las funciones `parseEstadoVehiculo` y `toEstadoVehiculoRow`
- **WHEN** se les pasa cualquier entrada del tipo correspondiente
- **THEN** ambas devuelven siempre un valor del dominio de salida, sin `undefined` intermedio

### Requirement: Escritura multi-tabla atómica mediante funciones de Postgres SECURITY INVOKER

> ⚠️ **SUPERSEDED en el mecanismo (2026-08-01) — ver `design.md` §Reconciliación con
> C-08-vehiculos-mantenimiento, D9/D11.** Las cuatro funciones `SECURITY INVOKER` que describe este
> requisito **no existen y no se van a escribir**: el backend real (Enzo) resolvió la escritura
> multi-tabla dentro de la Edge Function `vehiculos/index.ts`, que corre con un cliente
> `service-role` tras un único chequeo grueso `tiene_permiso('vehiculos', nivel)` (ver el requisito
> de "Degradación explícita..." más abajo, también SUPERSEDED). El texto y los escenarios de abajo
> quedan como registro de la decisión original — ninguno de los dos `rpc()` que describen existe en
> el repo. La forma vigente de `create()`/`update()` es la del requisito "Lectura y escritura vía la
> Edge Function `vehiculos`" de arriba (POST/PATCH sobre el mismo endpoint).

Con la decisión original de este documento (superada), el sistema SHALL resolver `create()` con una **única** llamada
`supabase.schema('conductores').rpc('crear_vehiculo_completo', { p_vehiculo })` y `update()` con una
única llamada `rpc('actualizar_vehiculo_completo', { p_id, p_cambios })`. Ambas funciones SHALL
escribir `conductores.vehiculo` y, según las claves presentes en el payload, `accesorios_vehiculo`,
`mantenimiento` y `facturacion.gastos_vehiculos`, todo dentro de una sola transacción. El sistema MUST
NOT emitir inserciones secuenciales por tabla ni borrados compensatorios. Las dos funciones SHALL
declararse **`SECURITY INVOKER`** explícitamente; `SECURITY DEFINER` está **prohibido** para estas
funciones porque su owner es un superusuario que bypassea RLS y abriría la posibilidad de escribir en
`facturacion.gastos_vehiculos` —de otro módulo— sin el permiso correspondiente. `create()` y
`update()` SHALL releer con `getById()` usando el id devuelto/recibido y resolver con ese resultado.

Para `update()`, la ausencia de una clave en `p_cambios` MUST significar "no tocar" esa colección —
nunca vaciarla. La distinción MUST hacerse con el operador `?` de `jsonb` (`p_cambios ?
'mantenimientos'`), no con `->>`, porque `->>` no distingue una clave ausente de una clave presente
con valor `null`. Cuando una clave sí está presente, la función SHALL reemplazar la colección completa
(`DELETE` + `INSERT` dentro de la misma transacción), porque ninguna otra tabla referencia los `id` de
`accesorios_vehiculo`, `mantenimiento` ni `gastos_vehiculos`.

#### Scenario: El alta es una sola llamada, no una secuencia de inserciones
- **GIVEN** un `NuevoVehiculo` con accesorios, mantenimientos y un gasto inicial
- **WHEN** se invoca `create(data)`
- **THEN** se emite exactamente una llamada `rpc('crear_vehiculo_completo', …)`
- **AND** NO se emite ninguna inserción directa sobre `conductores.vehiculo` ni sobre sus tablas hijas
- **AND** NO se emite ningún borrado compensatorio

#### Scenario: Alta exitosa devuelve el vehículo con el id generado por la base
- **GIVEN** un usuario con `vehiculos: write` y un `NuevoVehiculo` válido
- **WHEN** se invoca `create(data)`
- **THEN** la función devuelve el UUID asignado por Postgres
- **AND** la promesa resuelve a un `Vehiculo` releído con `getById(uuid)`

#### Scenario: Una clave ausente en la actualización no toca su colección
- **GIVEN** un `update(id, { patente: 'AB123CD' })` sin la clave `mantenimientos`
- **WHEN** se ejecuta la actualización
- **THEN** NO se emite ningún `DELETE` ni `INSERT` sobre `conductores.mantenimiento`
- **AND** el historial de mantenimiento del vehículo permanece intacto tras la relectura

#### Scenario: Una clave presente reemplaza la colección completa
- **GIVEN** un `update(id, { mantenimientos: [...] })` con el historial reordenado
- **WHEN** se ejecuta la actualización
- **THEN** las filas de `conductores.mantenimiento` de ese vehículo se reemplazan por el conjunto
  entrante, dentro de la misma transacción
- **AND** la relectura devuelve exactamente ese conjunto

#### Scenario: SECURITY DEFINER está prohibido y es verificable
- **GIVEN** las dos funciones aplicadas en la base
- **WHEN** se consulta `prosecdef` en `pg_proc` para `crear_vehiculo_completo` y
  `actualizar_vehiculo_completo`
- **THEN** el valor es `false` en las dos (es decir, `SECURITY INVOKER`)
- **AND** el rol `anon` no tiene privilegio `EXECUTE` sobre ninguna de las dos

#### Scenario: La prohibición está verificada por un test automatizado
- **GIVEN** el texto de `supabase/migrations/20260801120001_conductores_vehiculos_rpc.sql`
- **WHEN** se lo inspecciona con `node:fs` ignorando comentarios y literales de cadena
- **THEN** contiene `SECURITY INVOKER` en las cláusulas activas de las dos funciones de vehículo
- **AND** NO contiene `SECURITY DEFINER` fuera de comentarios de advertencia

#### Scenario: update devuelve el estado real releído, no un merge optimista
- **GIVEN** una actualización exitosa
- **WHEN** `update` resuelve
- **THEN** el `Vehiculo` devuelto proviene de una relectura de la base
- **AND** refleja defaults, triggers y normalizaciones aplicados por Postgres

### Requirement: Degradación explícita, nunca dato inventado, cuando falta un permiso cruzado

> ⚠️ **SUPERSEDED (2026-08-01) — ver `design.md` §Reconciliación con C-08-vehiculos-mantenimiento,
> D10.** La Edge Function real hace **un solo** chequeo grueso `tiene_permiso('vehiculos', nivel)` y
> usa un cliente `service-role` para todo lo demás (accesorios, gastos, habilitaciones incluidos):
> no hay ningún punto donde RLS por tabla filtre nada, porque el cliente admin la bypassea. **No
> existe ninguna degradación cruzada que implementar**: un usuario con `vehiculos: write` ve y
> escribe accesorios y gastos siempre, sin necesitar `pacientes: read` ni `facturacion: read`/
> `write`. Los escenarios de abajo describen un comportamiento que no ocurre en la implementación
> real — se conservan como registro de la decisión original, no como comportamiento a testear
> contra `SupabaseVehiculoRepository`.

Con la decisión original de este documento (superada), el sistema SHALL degradar explícitamente, en vez de fallar, cuando RLS oculta una colección
perteneciente a otro módulo de permisos. Sin `pacientes: read`, el embed
`accesorios_vehiculo → accesorios` vuelve vacío y el sistema SHALL resolver
`accesoriosCompatibles: []` señalizado en la UI, MUST NOT interpretarlo como "este vehículo no admite
accesorios". Sin `facturacion: read`, `gastos_vehiculos` vuelve vacío y el sistema SHALL resolver
`gastos: []` señalizado, MUST NOT mostrarlo como "$0" ni como "sin gastos". Sin `facturacion: write`,
un intento de guardar un vehículo que incluye la clave `gastos` MUST fallar con mensaje propio sin
haber tocado ninguna otra tabla; si el payload de la misma escritura no incluye la clave `gastos`, el
resto del vehículo SHALL guardarse con normalidad.

#### Scenario: Sin pacientes:read, los accesorios se degradan señalizados
- **GIVEN** un usuario con `vehiculos: read` y sin `pacientes: read`
- **WHEN** se invoca `getById(id)` sobre un vehículo con accesorios cargados
- **THEN** `accesoriosCompatibles` resuelve `[]`
- **AND** el vehículo se lee completo, sin lanzar por la colección oculta

#### Scenario: Sin facturacion:read, los gastos se degradan señalizados
- **GIVEN** un usuario con `vehiculos: read` y sin `facturacion: read`
- **WHEN** se invoca `getById(id)` sobre un vehículo con gastos registrados
- **THEN** `gastos` resuelve `[]`
- **AND** el vehículo se lee completo, sin lanzar por la colección oculta

#### Scenario: Sin facturacion:write, cargar un gasto falla sin romper el resto del vehículo
- **GIVEN** un usuario con `vehiculos: write` y sin `facturacion: write`
- **WHEN** invoca `update(id, { patente: 'AB123CD', gastos: [...] })`
- **THEN** la escritura sobre `facturacion.gastos_vehiculos` es rechazada con `42501`
- **AND** la promesa rechaza con un mensaje propio de falta de permiso de facturación
- **AND** NO se persiste el cambio de patente, porque la transacción completa de esa llamada hace
  rollback

#### Scenario: Editar el vehículo sin tocar gastos funciona sin facturacion:write
- **GIVEN** un usuario con `vehiculos: write` y sin `facturacion: write`
- **WHEN** invoca `update(id, { patente: 'AB123CD' })` sin la clave `gastos`
- **THEN** la actualización se completa con normalidad
- **AND** la función no intenta tocar `facturacion.gastos_vehiculos`

### Requirement: Traducción de errores de PostgREST a mensajes de dominio en castellano

> ⚠️ **Parcialmente SUPERSEDED (2026-08-01) — ver `design.md` §Reconciliación con
> C-08-vehiculos-mantenimiento.** La Edge Function real propaga la mayoría de los errores como
> `jsonResponse(400, { error: error.message })` — el texto crudo del motor, sin traducir códigos
> como `23505`/`23503`/`23514` a una forma reconocible por separado; y los casos `401`/`403`/`404`
> sí tienen status HTTP propio (ver el requisito "Lectura y escritura vía la Edge Function..." de
> arriba, con `mapearErrorEdgeFunction`). La tabla de códigos de abajo (`PGRST202`, `PGRST204`,
> `45201`–`45204`, etc.) **no aplica tal cual**, porque no hay RPC ni códigos propios `45xxx` en la
> implementación real. Queda como **gap a resolver junto con el próximo batch de `sdd-apply`**: el
> repository real va a necesitar su propia estrategia para no propagar mensajes crudos en inglés/
> con nombres de tabla, dado que la Edge Function no se los evita. No se resuelve unilateralmente
> acá — se conserva la tabla original como referencia de qué señales conviene distinguir si Enzo
> extiende la Edge Function para emitirlas con status/código propio.

Con la decisión original de este documento (parcialmente superada), el sistema SHALL lanzar siempre instancias de `Error` con un `message` en castellano apto para
mostrarse tal cual al usuario, porque `useVehiculos` pinta `err.message` directamente. El sistema
SHALL implementar `mapearErrorVehiculo` traduciendo, como mínimo, `23505` sobre `vehiculo.patente`,
`23503` (FK a un vehículo inexistente), `23514` (violación de `chk_categoria_subtipo`), `22P02`
(estado fuera del enum), `42501`/`PGRST301` sobre `vehiculos` o `facturacion`, los códigos propios
`45201`–`45204` de las funciones RPC, `PGRST202` (RPC no aplicada), `PGRST204` (columna no aplicada) y
`PGRST106` (schema no expuesto). El sistema MUST NOT propagar el texto crudo del motor ni nombres de
tablas o columnas hacia la UI.

#### Scenario: Patente duplicada produce un mensaje accionable
- **GIVEN** un alta con una patente que ya existe (`UNIQUE` de `conductores.vehiculo.patente`)
- **WHEN** se invoca `create(data)`
- **THEN** la promesa rechaza con un `Error` cuyo `message` nombra la patente duplicada en castellano

#### Scenario: Categoría de mantenimiento incoherente produce un mensaje accionable
- **GIVEN** una escritura que viola `chk_categoria_subtipo`
- **WHEN** Postgres responde `23514`
- **THEN** la promesa rechaza con `Error('Revisá la categoría de la intervención de mantenimiento.')`

#### Scenario: Un accesorio ausente del catálogo aborta con mensaje propio
- **GIVEN** un payload con un `AccesorioMovilidad` que no tiene fila en `pacientes.accesorios`
- **WHEN** la función responde con el código `45203`
- **THEN** la promesa rechaza con un `Error` que nombra el accesorio y explica que no está en el
  catálogo

#### Scenario: La RPC ausente en el servidor se explica en castellano
- **GIVEN** que `20260801120001_conductores_vehiculos_rpc.sql` no fue aplicada y PostgREST responde
  `PGRST202`
- **WHEN** se invoca `create(data)`
- **THEN** la promesa rechaza con un `Error` que indica que el alta de vehículos no está habilitada en
  el servidor todavía
- **AND** el mensaje no contiene el código crudo de PostgREST

#### Scenario: El schema no expuesto en el Data API se explica en castellano
- **GIVEN** que el schema `conductores` no está en los *Exposed schemas* del proyecto y PostgREST
  responde `PGRST106`
- **WHEN** se invoca `list()`
- **THEN** la promesa rechaza con un `Error` que indica que el módulo de Flota no está habilitado en el
  servidor

#### Scenario: getById sin fila nunca lanza
- **GIVEN** cualquiera de los códigos anteriores producidos por una consulta de lectura sin filas
- **WHEN** `getById` no encuentra el vehículo
- **THEN** la promesa resuelve `null`, no rechaza — es el único caso que MUST NOT traducirse a `Error`

### Requirement: Autorización delegada a la Edge Function, sin duplicarla ni bypassearla del lado del frontend

> ⚠️ **Mecanismo SUPERSEDED (2026-08-01) — ver `design.md` §Reconciliación con
> C-08-vehiculos-mantenimiento, D10/D11.** La autorización real no pasa por RLS evaluada por el
> cliente del frontend (`anon key`), sino por el chequeo `requirePermiso(req, 'vehiculos', nivel)`
> que corre **dentro** de la Edge Function, antes de usar un cliente `service-role`. RLS sigue
> definida sobre las tablas (segunda capa de defensa contra un acceso directo que se saltee la Edge
> Function), pero **no** es el punto de enforcement que ve el frontend. El requisito original
> (RLS como única autorización desde PostgREST directo) se conserva abajo; la forma vigente es la
> que sigue a continuación.

Con la decisión original de este documento (superada en el mecanismo, vigente en el espíritu — nunca reimplementar la autorización del lado del cliente), el sistema SHALL apoyarse exclusivamente en las policies de RLS ya definidas
(`tiene_permiso('vehiculos', 'read' | 'write')`, `tiene_permiso('pacientes', 'read')`,
`tiene_permiso('facturacion', 'read' | 'write')`) para autorizar lecturas y escrituras. El sistema
MUST NOT reimplementar, replicar ni anticipar esa lógica de permisos en el repository, y MUST NOT
tratar el gateo de escritura de la UI (`usePuedeEscribir`) como control de acceso, dado que es
client-side y evitable.

**Con la implementación real (vigente):** el sistema SHALL delegar toda la autorización al chequeo
`tiene_permiso('vehiculos', nivel)` que corre dentro de la Edge Function `vehiculos`, y MUST NOT
reimplementar ni anticipar esa verificación en `SupabaseVehiculoRepository.ts` ni en ningún otro
punto del frontend. El repository SHALL tratar cualquier respuesta `403` de la Edge Function como
un rechazo de autorización, traducido a mensaje visible, sin haber permitido la operación
localmente.

#### Scenario: El repository no consulta la tabla de permisos
- **GIVEN** el código de `SupabaseVehiculoRepository.ts`
- **WHEN** se inspeccionan sus consultas
- **THEN** no lee `modulos.permisos` ni `modulos.modulos` para decidir si operar
- **AND** delega la decisión a la Edge Function, que a su vez llama a `tiene_permiso()` del lado del servidor

#### Scenario: Un intento de escritura sin permiso falla en el servidor
- **GIVEN** un usuario sin `vehiculos: write` que evita el gateo de UI
- **WHEN** se invoca `create()` o `update()`
- **THEN** la Edge Function responde `403` antes de tocar ninguna tabla
- **AND** el repository traduce ese rechazo a un error visible, sin haberla permitido localmente

### Requirement: Catálogo de accesorios de movilidad sembrado y validado contra la unión cerrada

El sistema SHALL apoyarse en el catálogo `pacientes.accesorios` sembrado con exactamente los 5 valores
de `AccesorioMovilidad` (`silla-plegable`, `silla-rigida`, `silla-postural`, `andador`, `tripode`). El
sistema MUST resolver cada accesorio del payload de escritura contra ese catálogo por `tipo` antes de
vincularlo a `accesorios_vehiculo`, y un accesorio que no exista en el catálogo MUST abortar la
escritura completa con un error propio (código `45203`) en vez de omitirse en silencio.

#### Scenario: Los 5 accesorios de la unión cerrada están disponibles
- **GIVEN** el catálogo `pacientes.accesorios` sembrado por la migración de este change
- **WHEN** se listan sus `tipo`
- **THEN** contiene exactamente `silla-plegable`, `silla-rigida`, `silla-postural`, `andador` y
  `tripode`, sin duplicados

#### Scenario: Un accesorio del payload ausente del catálogo produce error propio, no silencio
- **GIVEN** un payload de escritura con un accesorio cuyo `tipo` no existe en `pacientes.accesorios`
- **WHEN** se invoca `create()` o `update()`
- **THEN** la escritura aborta entera con el código `45203`
- **AND** NO se guarda el vehículo parcialmente sin ese accesorio

#### Scenario: Un accesorio reconocido se resuelve a su id del catálogo compartido
- **GIVEN** un payload con `accesoriosCompatibles: ['silla-plegable']`
- **WHEN** se construye el payload de escritura con `toCrearVehiculoPayload`
- **THEN** el `accesorio_id` enviado es el `id` de la fila de `pacientes.accesorios` con
  `tipo = 'silla-plegable'`, no un valor inventado

### Requirement: Inyección en el único punto de composición

El sistema SHALL inyectar la implementación real desde
`frontend/src/features/vehiculos/VehiculosRoute.tsx`, que es el único archivo de la feature que
cambia por el swap. Ningún componente, hook ni context de `features/vehiculos/` MUST importar
`SupabaseVehiculoRepository` ni el cliente `supabase` directamente.

#### Scenario: Solo el composition root conoce la implementación
- **GIVEN** los archivos de `frontend/src/features/vehiculos/`
- **WHEN** se buscan importaciones de `SupabaseVehiculoRepository` o de `supabaseClient`
- **THEN** la única coincidencia de producción es `VehiculosRoute.tsx`

#### Scenario: El mock sobrevive como doble de test
- **GIVEN** `mockVehiculoRepository`
- **WHEN** se completa este change
- **THEN** el archivo sigue existiendo y sus tests siguen pasando
- **AND** ya no es la implementación inyectada por `VehiculosRoute.tsx`

### Requirement: Orden determinista de las colecciones aplicado en el mapeo puro

El sistema SHALL ordenar `mantenimientos` y `gastos` por `fecha` descendente en el mapeo puro, usando
`id` como desempate determinista cuando dos filas comparten la misma fecha. El sistema MUST NOT
depender de `.order()` sobre el embed de PostgREST ni del orden físico devuelto por la consulta.

#### Scenario: Mantenimientos ordenados por fecha descendente con id como desempate
- **GIVEN** tres registros de mantenimiento con fechas distintas y dos de ellos con la misma fecha
- **WHEN** se mapea el vehículo
- **THEN** `mantenimientos` queda ordenado de la fecha más reciente a la más antigua
- **AND** los dos registros de igual fecha se ordenan entre sí por `id`, de forma estable

#### Scenario: Gastos ordenados por fecha descendente con id como desempate
- **GIVEN** varios gastos del vehículo, algunos con la misma fecha
- **WHEN** se mapea el vehículo
- **THEN** `gastos` queda ordenado de la fecha más reciente a la más antigua
- **AND** el desempate entre gastos de igual fecha es por `id`

#### Scenario: El orden persiste tras releer del servidor
- **GIVEN** un vehículo guardado con un historial de mantenimiento
- **WHEN** se vuelve a leer el vehículo desde la base
- **THEN** dos lecturas consecutivas devuelven el mismo orden para `mantenimientos` y `gastos`
