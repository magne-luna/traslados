# Paciente Repository Supabase

## Purpose
Defines the real `SupabasePacienteRepository` implementation backed directly by the `pacientes` Postgres schema (PostgREST + RLS, plus one atomic `SECURITY INVOKER` RPC function for multi-table create), including its error-translation, partial-update-as-diff semantics, and security contract.

## Requirements

### Requirement: Implementación real SupabasePacienteRepository

El sistema SHALL proveer una implementación de `PacienteRepository` en
`frontend/src/shared/lib/pacientes/SupabasePacienteRepository.ts` que lea y escriba contra el schema
`pacientes` de Supabase usando el cliente compartido `frontend/src/shared/lib/supabaseClient.ts`
(`anon key` + sesión del usuario). La implementación MUST cumplir las cuatro firmas de la interfaz
(`list`, `getById`, `create`, `update`) sin modificarlas, sin agregar métodos y sin cambiar los
tipos del dominio de `shared/types/paciente.ts`. La implementación MUST NOT usar `any` ni la
`SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian

- **GIVEN** la interfaz `PacienteRepository` existente
- **WHEN** se compila `SupabasePacienteRepository` con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `PacienteRepository` sin casts ni `any`
- **AND** ni `PacienteRepository.ts` ni `shared/types/paciente.ts` fueron modificados

#### Scenario: Nunca se usa una clave privilegiada en el frontend

- **GIVEN** el código fuente de `SupabasePacienteRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `service_role` ni ninguna creación de cliente propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

### Requirement: Lectura del paciente completo en una sola consulta

El sistema SHALL resolver `list()` y `getById()` con una única consulta a
`pacientes.paciente` que embeba `cud`, `clinicos`, `personas_a_cargo`, `direcciones` y
`accesorios_pacientes → accesorios`. El sistema MUST NOT emitir una consulta por paciente ni por
colección hija (patrón N+1).

#### Scenario: Un listado de N pacientes no dispara N consultas

- **GIVEN** un usuario con permiso `pacientes: read` y 3 pacientes en la base
- **WHEN** se invoca `list()`
- **THEN** se emite una sola consulta a `pacientes.paciente` con embeds
- **AND** los 3 pacientes vuelven con sus direcciones, personas a cargo, CUD y accesorios resueltos

#### Scenario: getById de un id inexistente resuelve a null

- **GIVEN** un id que no corresponde a ningún paciente
- **WHEN** se invoca `getById(id)`
- **THEN** la promesa resuelve a `null`
- **AND** NO se lanza ninguna excepción (contrato idéntico al del mock)

#### Scenario: RLS que filtra la fila se comporta como "no existe"

- **GIVEN** un usuario sin permiso `pacientes: read`
- **WHEN** se invoca `getById(id)` sobre un paciente que sí existe en la base
- **THEN** la consulta devuelve 0 filas porque la policy de RLS la filtra
- **AND** `getById` resuelve a `null` en lugar de lanzar un error de permisos

### Requirement: Mapeo en funciones puras y aisladas

El sistema SHALL implementar toda la traducción entre filas de Postgres y el tipo `Paciente` en
funciones puras exportadas desde `frontend/src/shared/lib/pacientes/pacienteMapping.ts`, sin efectos,
sin lectura de reloj global y sin acceso a red. Las funciones de parseo MUST angostar `unknown` con
type guards explícitos y MUST descartar (no propagar) las filas que no cumplen la forma esperada,
en lugar de romper la operación completa.

#### Scenario: El mapeo se testea sin mockear la red

- **GIVEN** una fila cruda de `pacientes.paciente` con sus embeds, como objeto literal
- **WHEN** se invoca la función de parseo directamente en un test
- **THEN** devuelve un `Paciente` válido sin haber montado ningún fake del cliente Supabase

#### Scenario: Una fila hija malformada no rompe el listado

- **GIVEN** una respuesta donde una de las direcciones embebidas no tiene la forma esperada
- **WHEN** se mapea el paciente
- **THEN** esa dirección se descarta
- **AND** el resto del paciente (y del listado) se devuelve normalmente

#### Scenario: Nullabilidad invertida se normaliza al leer

- **GIVEN** una fila con `fecha_nacimiento`, `cuil_titular` o `personas_a_cargo.dni` en `NULL`
- **WHEN** se mapea a `Paciente`
- **THEN** esos campos, que el tipo del dominio declara requeridos, se representan como cadena vacía
- **AND** NO se lanza error ni se descarta el paciente

#### Scenario: El diagnóstico JSONB se normaliza a texto

- **GIVEN** `clinicos.diagnostico` con un valor JSONB (cadena JSON, objeto o `NULL`)
- **WHEN** se mapea a `Paciente.diagnostico`
- **THEN** el resultado es siempre un `string` (cadena vacía si el valor era `NULL`)
- **AND** al escribir, `diagnostico` se serializa a JSON válido para la columna

#### Scenario: Accesorios desconocidos en el maestro se descartan

- **GIVEN** una fila de `pacientes.accesorios` cuyo `tipo` no pertenece a la unión cerrada
  `AccesorioMovilidad`
- **WHEN** se mapea el paciente
- **THEN** ese accesorio se omite de `accesorioMovilidad`
- **AND** los accesorios reconocidos del mismo paciente se conservan

### Requirement: Alta multi-tabla atómica mediante una función de Postgres

El sistema SHALL resolver `create()` con una **única** llamada
`supabase.schema('pacientes').rpc('crear_paciente_completo', { p_paciente })`, donde
`pacientes.crear_paciente_completo(jsonb) RETURNS uuid` inserta la fila de `pacientes.paciente` y
todas sus hijas (`clinicos`, `cud`, `direcciones`, `personas_a_cargo`, `accesorios_pacientes`, y
`obra_social.coberturas_paciente` cuando corresponde) dentro de una sola transacción. El sistema
MUST NOT emitir inserciones secuenciales por tabla ni borrados compensatorios: ante cualquier fallo,
la transacción hace rollback completo y no puede quedar una ficha parcial. El sistema SHALL releer el
paciente con `getById()` usando el `uuid` devuelto y resolver con ese resultado.

#### Scenario: El alta es una sola llamada, no una secuencia de inserciones

- **GIVEN** un `NuevoPaciente` con direcciones, personas a cargo, CUD y accesorios
- **WHEN** se invoca `create(data)`
- **THEN** se emite exactamente una llamada `rpc('crear_paciente_completo', …)`
- **AND** NO se emite ninguna inserción directa sobre `pacientes.paciente` ni sobre sus tablas hijas
- **AND** NO se emite ningún borrado compensatorio

#### Scenario: Alta exitosa devuelve el paciente con el id generado por la base

- **GIVEN** un usuario con permiso `pacientes: write` y un `NuevoPaciente` válido
- **WHEN** se invoca `create(data)`
- **THEN** la función devuelve el UUID asignado por Postgres
- **AND** la promesa resuelve a un `Paciente` releído con `getById(uuid)`
- **AND** las direcciones, personas a cargo, CUD y accesorios quedan persistidos

#### Scenario: Un fallo a mitad del alta no deja ninguna fila escrita

- **GIVEN** un alta donde la inserción de `personas_a_cargo` falla dentro de la función
- **WHEN** se invoca `create(data)`
- **THEN** la transacción hace rollback y NO queda ninguna fila en `pacientes.paciente` ni en
  ninguna de sus tablas hijas
- **AND** la promesa rechaza con el error original de la inserción fallida

#### Scenario: DNI duplicado produce un mensaje accionable

- **GIVEN** un alta con un DNI que ya existe (constraint `UNIQUE` de `pacientes.paciente.dni`)
- **WHEN** se invoca `create(data)`
- **THEN** la promesa rechaza con un `Error` cuyo `message` nombra el DNI duplicado en castellano
- **AND** el mensaje NO expone nombres de tablas, columnas ni texto crudo de Postgres

#### Scenario: Un accesorio ausente del maestro aborta el alta con un mensaje accionable

- **GIVEN** un alta con un `AccesorioMovilidad` que no tiene fila en `pacientes.accesorios`
- **WHEN** se invoca `create(data)`
- **THEN** la función aborta con el código `45001` y no escribe ninguna fila
- **AND** la promesa rechaza con un `Error` que nombra el accesorio y pide que se lo agregue al
  catálogo

#### Scenario: Una dirección con tipo_lugar se persiste sin romper el alta

- **GIVEN** un alta con al menos una dirección cuyo `tipo_lugar` está cargado
- **WHEN** se invoca `create(data)`
- **THEN** la función castea explícitamente al enum `pacientes.tipo_direccion` antes de insertar
- **AND** no aborta con `42804` (bug encontrado y corregido en
  `20260807000000_crear_paciente_completo_tipo_lugar_cast.sql`, heredado sin cambios desde la
  primera versión de la función a través de 5 reescrituras posteriores)

#### Scenario: La función de alta ausente en el servidor se explica en castellano

- **GIVEN** que la migración `20260730180000_crear_paciente_completo.sql` no fue aplicada y PostgREST
  responde `PGRST202`
- **WHEN** se invoca `create(data)`
- **THEN** la promesa rechaza con un `Error` que indica que el alta de pacientes no está habilitada
  en el servidor
- **AND** el mensaje no contiene el código crudo de PostgREST

### Requirement: La función de alta corre con los privilegios de quien la llama

La migración que crea `pacientes.crear_paciente_completo` SHALL declarar la función como
`SECURITY INVOKER`, de modo que las policies de RLS de cada tabla escrita sigan evaluándose contra el
usuario autenticado que hace la llamada. La función MUST NOT declararse `SECURITY DEFINER`: su owner
es un superusuario y bypassearía RLS por completo, permitiendo que cualquier usuario autenticado dé
de alta pacientes sin `modulos.tiene_permiso('pacientes','write')`. La función MUST NOT reimplementar
ni consultar la lógica de permisos por su cuenta —el gateo lo hacen las policies existentes— y
MUST NOT ser ejecutable por el rol `anon`. Esta invariante SHALL sostenerse a través de todas las
reescrituras posteriores de la función (persistencia de `formato_afiliado`, `localidad`,
`parentesco`, `descripcion`, `lat`/`lng`, cast de `tipo_lugar`): cada `CREATE OR REPLACE` MUST
reafirmar `SECURITY INVOKER` explícitamente, nunca heredarlo implícitamente.

#### Scenario: Un usuario sin permiso de escritura no puede crear un paciente vía RPC

- **GIVEN** un usuario autenticado con `pacientes: read` y sin `pacientes: write`
- **WHEN** invoca `crear_paciente_completo` directamente, salteándose el gateo de la UI
- **THEN** la policy `"Write pacientes"` rechaza la inserción con `42501`
- **AND** la transacción completa hace rollback: no queda ninguna fila creada
- **AND** el repository traduce el rechazo a un error visible de falta de permiso

#### Scenario: La declaración de seguridad de la función es verificable

- **GIVEN** la función aplicada en la base
- **WHEN** se consulta `prosecdef` en `pg_proc` para `crear_paciente_completo`
- **THEN** el valor es `false` (es decir, `SECURITY INVOKER`)
- **AND** el rol `anon` no tiene privilegio `EXECUTE` sobre la función

#### Scenario: El número de afiliado sin permiso sobre Obras Sociales aborta el alta entera

- **GIVEN** un usuario con `pacientes: write` y sin `obra_social: write` que carga un número de
  afiliado en el alta
- **WHEN** se invoca `create(data)`
- **THEN** la inserción en `obra_social.coberturas_paciente` es rechazada con `42501`
- **AND** el paciente NO queda creado (rollback completo), en lugar de quedar a medias
- **AND** la promesa rechaza con un `Error` que menciona el permiso sobre Obras Sociales

#### Scenario: Sin número de afiliado no se toca el módulo Obras Sociales

- **GIVEN** un usuario con `pacientes: write` y sin ningún permiso sobre `obra_social`
- **WHEN** crea un paciente dejando el número de afiliado vacío
- **THEN** la función no inserta en `obra_social.coberturas_paciente`
- **AND** el alta se completa con normalidad

### Requirement: Actualización parcial por tabla y reemplazo de colecciones con ids estables

El sistema SHALL tratar `ActualizacionPaciente` como un diff: MUST escribir únicamente las tablas
cuyas claves están presentes en el payload, y MUST dejar intactas las tablas cuyas claves están
ausentes (`undefined`). Para las colecciones (`direcciones`, `personasACargo`, `accesorioMovilidad`)
el sistema SHALL calcular el diff contra el estado leído —insertando las nuevas, actualizando las
existentes por `id` y eliminando las ausentes— preservando el `id` de las que sobreviven. El sistema
MUST NOT borrar e insertar la colección completa. Al terminar, `update()` SHALL releer el paciente y
devolver el estado real persistido.

#### Scenario: Una clave ausente no toca su tabla

- **GIVEN** un `update(id, { apellido: 'Nuevo' })` sin la clave `cud`
- **WHEN** se ejecuta la actualización
- **THEN** no se emite ninguna escritura sobre `pacientes.cud`
- **AND** el CUD del paciente permanece sin cambios

#### Scenario: cud en null borra el certificado

- **GIVEN** un `update(id, { cud: null })`
- **WHEN** se ejecuta la actualización
- **THEN** las filas de `pacientes.cud` del paciente se eliminan

#### Scenario: Editar una dirección preserva su id

- **GIVEN** un paciente con dos direcciones y una edición sobre la calle de la primera
- **WHEN** se ejecuta `update`
- **THEN** la primera dirección se actualiza por `id` (no se borra ni se reinserta)
- **AND** ambos `id` de dirección siguen siendo los mismos después de releer

#### Scenario: Eliminar una dirección referenciada por un recorrido falla con mensaje claro

- **GIVEN** una dirección referenciada por `pacientes.recorridos` (FK `ON DELETE RESTRICT`)
- **WHEN** el usuario la quita de la lista y se ejecuta `update`
- **THEN** la promesa rechaza con un `Error` que explica que hay recorridos que la usan
- **AND** ninguna otra dirección del paciente queda modificada a medias

#### Scenario: update devuelve el estado real releído, no un merge optimista

- **GIVEN** una actualización exitosa
- **WHEN** `update` resuelve
- **THEN** el `Paciente` devuelto proviene de una relectura de la base
- **AND** refleja defaults, triggers y normalizaciones aplicados por Postgres

#### Scenario: update de un id inexistente lanza el mismo error que el mock

- **GIVEN** un id que no corresponde a ningún paciente accesible
- **WHEN** se invoca `update(id, data)`
- **THEN** la promesa rechaza con un `Error` cuyo `message` indica que no existe un paciente con ese id

### Requirement: Contrato de errores compatible con la UI existente

El sistema SHALL lanzar siempre instancias de `Error` con un `message` en castellano apto para
mostrarse tal cual al usuario, porque `usePacientes` pinta `err.message` directamente. El sistema
MUST traducir los códigos de PostgREST/Postgres a mensajes de dominio y MUST NOT propagar el texto
crudo del motor. El sistema MUST NOT cambiar la forma en que los errores llegan a la UI (rechazo de
la promesa), de modo que los estados de carga y error ya implementados sigan funcionando sin
modificarse.

#### Scenario: Rechazo de RLS en escritura se muestra como falta de permiso

- **GIVEN** un usuario con `pacientes: read` pero sin `pacientes: write`
- **WHEN** intenta guardar un paciente y la policy de RLS rechaza la escritura
- **THEN** la promesa rechaza con un `Error` que indica falta de permiso para modificar pacientes
- **AND** la UI muestra ese mensaje sin quedar en estado de carga infinito
- **AND** NO se reporta un guardado exitoso

#### Scenario: El schema no expuesto en el Data API se explica en castellano

- **GIVEN** que el schema `pacientes` no está en los *Exposed schemas* del proyecto y PostgREST
  responde `PGRST106`
- **WHEN** se invoca `list()`
- **THEN** la promesa rechaza con un `Error` que indica que el módulo no está habilitado en el
  servidor
- **AND** el mensaje no contiene el código crudo de PostgREST

#### Scenario: Los estados de carga y error de la pantalla no se modifican

- **GIVEN** la pantalla de Pacientes con el repository real inyectado
- **WHEN** una operación falla
- **THEN** `usePacientes` expone `error` con el mensaje y `loading` en `false`
- **AND** ni `usePacientes.ts` ni `PacienteRepositoryContext.tsx` fueron modificados

### Requirement: RLS existente como única autorización, sin duplicarla ni bypassearla

El sistema SHALL apoyarse exclusivamente en las policies de RLS ya definidas
(`modulos.tiene_permiso('pacientes', 'read' | 'write')`) para autorizar lecturas y escrituras. El
sistema MUST NOT reimplementar, replicar ni anticipar esa lógica de permisos en el repository, y
MUST NOT tratar el gateo de escritura de la UI (`usePuedeEscribir`, `<CamposSoloLectura>`) como
control de acceso, dado que es client-side y evitable.

#### Scenario: El repository no consulta la tabla de permisos

- **GIVEN** el código de `SupabasePacienteRepository.ts`
- **WHEN** se inspeccionan sus consultas
- **THEN** no lee `modulos.permisos` ni `modulos.modulos` para decidir si operar
- **AND** delega la decisión a la policy de RLS del servidor

#### Scenario: Un intento de escritura sin permiso falla en el servidor

- **GIVEN** un usuario sin `pacientes: write` que evita el gateo de UI
- **WHEN** se invoca `create()` o `update()`
- **THEN** la escritura es rechazada por la base
- **AND** el repository traduce ese rechazo a un error visible, sin haberla permitido localmente

### Requirement: Número de afiliado y su formato desde la cobertura

El sistema SHALL leer `Paciente.numeroAfiliado.valor` y `Paciente.numeroAfiliado.formato` desde
`obra_social.coberturas_paciente.num_afiliado` y `.formato_afiliado` respectivamente, tomando la
cobertura del paciente cuyo `obra_social_id` coincide con el del paciente y cuya `fecha_desde` es la
más reciente. `formato_afiliado` tiene columna propia con `DEFAULT 'numero-documento'`
(`20260731140000_schema_obra_social_formato_afiliado.sql`) y `crear_paciente_completo` la persiste
desde `20260731130000_crear_paciente_completo_formato_afiliado.sql` — **ya no es un dato que se
pierda al guardar** (superó la discrepancia original de IN-01 sobre este punto puntual; ver
`knowledge-base/10_preguntas_abiertas.md`). Dado que `coberturas_paciente` pertenece al schema
`obra_social` y está gateada por el permiso de ese módulo, el sistema MUST degradar a valor vacío
—sin lanzar— cuando la consulta falle o no devuelva filas, y MUST NOT impedir que se muestre el
resto de la ficha. El sistema SHALL escribir sobre `coberturas_paciente` únicamente cuando
`numeroAfiliado.valor` cambió, y SHALL traducir un rechazo de RLS de esa escritura a un mensaje que
nombre el módulo Obras Sociales.

#### Scenario: Sin permiso sobre Obras Sociales la ficha igual se muestra

- **GIVEN** un usuario con `pacientes: read` y sin `obra_social: read`
- **WHEN** abre la ficha de un paciente
- **THEN** `numeroAfiliado.valor` es cadena vacía
- **AND** el resto de los datos del paciente se muestran normalmente
- **AND** no se muestra un error de carga de la ficha

#### Scenario: El formato del identificador se persiste con su default

- **GIVEN** un alta que no especifica `numeroAfiliado.formato`
- **WHEN** se invoca `create(data)` con un número de afiliado cargado
- **THEN** `coberturas_paciente.formato_afiliado` queda con el default `'numero-documento'`
- **AND** al releer, `Paciente.numeroAfiliado.formato` refleja ese valor persistido, no una
  constante del frontend

#### Scenario: Cambiar el número de afiliado sin permiso da un mensaje accionable

- **GIVEN** un usuario con `pacientes: write` y sin `obra_social: write`
- **WHEN** modifica el número de afiliado y guarda
- **THEN** la promesa rechaza con un `Error` que menciona que falta permiso sobre Obras Sociales
- **AND** el mensaje distingue ese caso de un fallo genérico al guardar el paciente

#### Scenario: Sin cambio en el número de afiliado no se escribe la cobertura

- **GIVEN** una edición que no toca `numeroAfiliado.valor`
- **WHEN** se ejecuta `update`
- **THEN** no se emite ninguna escritura sobre `obra_social.coberturas_paciente`

### Requirement: Inyección en el único punto de composición

El sistema SHALL inyectar la implementación real desde
`frontend/src/features/pacientes/PacientesRoute.tsx`, que es el único archivo de la feature que
cambia. Ningún componente, hook ni context de `features/pacientes/` MUST importar
`SupabasePacienteRepository` ni el cliente `supabase` directamente.

#### Scenario: Solo el composition root conoce la implementación

- **GIVEN** los archivos de `frontend/src/features/pacientes/`
- **WHEN** se buscan importaciones de `SupabasePacienteRepository` o de `supabaseClient`
- **THEN** la única coincidencia de producción es `PacientesRoute.tsx`

#### Scenario: El mock sobrevive como doble de test

- **GIVEN** `mockPacienteRepository`
- **WHEN** se completa este change
- **THEN** el archivo sigue existiendo y sus tests siguen pasando
- **AND** ya no es la implementación inyectada por `PacientesRoute.tsx`

### Requirement: Discrepancias del esquema documentadas y señalizadas

El sistema SHALL documentar cada discrepancia entre `shared/types/paciente.ts` y
`supabase/migrations/20260724100004_schema_pacientes.sql` en los dos lugares que exige la convención
del proyecto —`knowledge-base/04_modelo_de_datos.md` §Discrepancias y un bullet ⚠️ en `CHANGES.md`—
y SHALL señalizar en la UI, con el componente `AvisoModeloDatos`, todo campo que el usuario puede
editar pero que la base no persiste. El sistema MUST NOT resolver ninguna discrepancia
unilateralmente en el código.

#### Scenario: Un campo editable que no se persiste tiene cartel

- **GIVEN** los campos `Direccion.dias`, `Direccion.horario` (columnas nullable existentes, pero
  que el frontend deliberadamente no envía — discrepancia #4, abierta) y
  `Paciente.amparoJudicialAclaracion` (sin columna)
- **WHEN** el usuario edita la sección correspondiente
- **THEN** hay un `AvisoModeloDatos` visible que dice explícitamente cuál de esos datos no se guarda

#### Scenario: Los carteles usan el componente del design system

- **GIVEN** los avisos agregados por este change
- **WHEN** se revisa su implementación
- **THEN** usan `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`
- **AND** no contienen estilos inline (`style={{}}`) ni markup de alerta propio

#### Scenario: La discrepancia queda registrada fuera del código

- **GIVEN** el inventario de discrepancias del change
- **WHEN** se completa la implementación
- **THEN** existe un bloque "Pacientes vs. esquema real" en `knowledge-base/04_modelo_de_datos.md`
  §Discrepancias
- **AND** existe un bullet ⚠️ en el `C-05` de `CHANGES.md`
