## Context

**Estado actual del frontend.** `frontend/src/features/presupuestos/PresupuestosRoute.tsx` inyecta
**cuatro** mocks: `mockPresupuestoRepository` y `mockAutorizacionRepository` en sus dos providers, más
`mockPacienteRepository` y `mockObraSocialRepository` como props de `PresupuestosPage` (alimentan los
selectores del formulario, de solo lectura). Toda la feature (10 componentes + 2 hooks + 2 contexts +
2 validaciones puras) consume las interfaces `PresupuestoRepository` / `AutorizacionRepository` vía
context — ningún componente conoce Supabase. `usePresupuestos` y `useAutorizaciones` manejan
`loading`/`error` capturando lo que el repository lance y leyendo `err.message`, igual que
`usePacientes` y `useObrasSociales`.

**Estado real del backend — verificado el 2026-08-02 contra `pkryfoljypuzfifofdwp`, no asumido.**

```sql
facturacion.presupuesto (
  id               uuid    NOT NULL DEFAULT gen_random_uuid(),
  obra_social_id   uuid    NOT NULL REFERENCES obra_social.obra_social(id),
  paciente_id      uuid    NOT NULL REFERENCES pacientes.paciente(id),
  monto            numeric NULL,            -- (10,2)
  fecha_emision    date    NULL,
  archivo_url      text    NULL
)

facturacion.autorizacion (
  id                uuid    NOT NULL DEFAULT gen_random_uuid(),
  presupuesto_id    uuid    NOT NULL REFERENCES facturacion.presupuesto(id) ON DELETE CASCADE,
  estado            facturacion.estado_autorizacion NULL DEFAULT 'pendiente',
  fecha_respuesta   date    NULL,
  cupo_mensual_dias integer NULL,
  cupo_mensual_km   integer NULL,
  archivo_url       text    NULL,
  monto_autorizado  numeric NULL,           -- C-06, RN-PA-01
  vigencia_desde    date    NULL            -- C-06, RN-PA-02
)
```

Cuatro hechos verificados que mandan sobre el resto del diseño:

1. **Las columnas de `C-06` existen.** `monto_autorizado` y `vigencia_desde` están aplicadas, y el
   trigger `facturacion.validar_autorizacion_monto` (`BEFORE INSERT OR UPDATE`, `SECURITY DEFINER`,
   `search_path = ''`) rechaza con `RAISE EXCEPTION` cualquier fila donde
   `monto_autorizado > presupuesto.monto`. **RN-PA-01 está aplicada por el servidor.**
2. **`archivo_url` es la única columna de adjunto.** `archivo_nombre` y `archivo_cargado_en` **no
   existen**: las dropeó a propósito `20260730120000_revert_presupuesto_archivo_meta.sql`.
3. **Las policies de RLS gatean por el módulo `presupuestos`**, no `facturacion`:
   `modulos.tiene_permiso('presupuestos', 'read'|'write')` en las cuatro policies
   (`Read/Write presupuesto`, `Read/Write autorizacion`), aplicadas por
   `20260730140000_split_modulos_permisos.sql`. **Confirmado leyendo `pg_policies`, no la migración.**
   Es exactamente la trampa que `integracion-facturacion` D9 anotó y dejó *"como bloqueante a
   resolver en `integracion-presupuestos`"*.
4. **El schema `facturacion` no tiene un solo índice fuera de sus 7 primary keys** (`pg_indexes`,
   2026-08-02). `autorizacion.presupuesto_id` —la columna que filtra cada apertura de detalle— no está
   indexada. `integracion-facturacion` D10 lo reportó y lo dejó fuera de alcance diciendo *"son de
   `C-06`"*.

Y dos hechos de volumen, igual de importantes para no confundir "vacío" con "roto":
`facturacion.presupuesto` **0 filas**, `facturacion.autorizacion` **0 filas**,
`pacientes.paciente` **1 fila**, `obra_social.obra_social` **3 filas**.

**Estado real del backend — la parte que cambia el enfoque: las Edge Functions.**
`supabase/functions/presupuestos/index.ts` y `supabase/functions/autorizaciones/index.ts` están
deployadas y `ACTIVE` (versión 2). Las dos siguen el mismo molde
(`supabase/functions/_shared/auth.ts`):

```
requirePermiso(req, 'presupuestos', req.method === 'GET' ? 'read' : 'write')
  ├─ sin Authorization  -> 401 { error: 'falta el header Authorization' }
  ├─ JWT inválido       -> 401 { error: 'token invalido' }
  ├─ tiene_permiso()==false -> 403 { error: "no tenes permiso de '<nivel>' sobre el modulo 'presupuestos'" }
  └─ ok -> { userId, admin: createClient(URL, SERVICE_ROLE_KEY) }
```

y exponen un contrato **ya en camelCase**:

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/presupuestos` | `200` array, ordenado por `fecha_emision` desc |
| `GET` | `/presupuestos/:id` | `200` \| `404 { error: 'presupuesto no encontrado' }` |
| `POST` | `/presupuestos` | `201` \| `400` si falta `pacienteId`/`obraSocialId`/`monto`/`fechaEmision` |
| `PATCH` | `/presupuestos/:id` | `200` \| `404` |
| `DELETE` | `/presupuestos/:id` | `204` |
| `GET` | `/autorizaciones` | `200` array (sin orden explícito) |
| `GET` | `/autorizaciones/:id` | `200` \| `404 { error: 'autorizacion no encontrada' }` |
| `GET` | `/autorizaciones?presupuestoId=…` | `200` \| `404 { error: 'este presupuesto todavia no tiene autorizacion asociada' }` |
| `POST` | `/autorizaciones` | `201` \| `400` si falta `presupuestoId` |
| `PATCH` | `/autorizaciones/:id` | `200` \| `404` |
| `DELETE` | `/autorizaciones/:id` | `204` |

Campos del `toApi()` de `presupuestos`: `id`, `pacienteId`, `obraSocialId`, `monto` (ya `Number`),
`fechaEmision`, `archivoUrl?`. Del de `autorizaciones`: `id`, `presupuestoId`, `estado`,
`fechaRespuesta?`, `montoAutorizado?` (ya `Number`), `vigenciaDesde?`, `cupoMensualDias?`,
`cupoMensualKm?`, `archivoUrl?`. Cualquier error de Postgres se devuelve como
`400 { error: error.message }` — **texto crudo del motor, en inglés o con la jerga del trigger**.

**Referencia de patrón.** Los cuatro changes de integración anteriores (`integracion-pacientes`,
`integracion-obra-social`, `prestadores-crud`, `integracion-facturacion`) fijaron: mapeo puro separado
del I/O, una sola consulta sin N+1, escritura multi-tabla atómica vía RPC `SECURITY INVOKER`,
traducción de errores a castellano, fake tipado del cliente en los tests, verificación con cuentas
reales como tarea manual, y discrepancias documentadas por triplicado (KB + `CHANGES.md` +
`AvisoModeloDatos`). **Este change conserva todo eso menos el transporte** (D2). El precedente exacto
del transporte que sí adopta es `SupabaseCuentaRepository.ts` (`supabase.functions.invoke` +
`mapearErrorEdgeFunction` sobre `error.context` como `Response`).

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4, nunca `style={{}}`; reusar `design-system/components.tsx`; `anon key`
únicamente, **nunca `SUPABASE_SERVICE_ROLE_KEY` en el frontend**; toda tabla nueva define su RLS en el
mismo change (acá no hay tablas nuevas); `npx tsc -b --noEmit` como único type-check válido;
Conventional Commits; el docx manda en estructura y la KB en reglas de negocio, y toda discrepancia se
documenta en los dos lugares **y** con `AvisoModeloDatos`, nunca se resuelve adivinando.

---

## ⚠️ Governance: ALTO — Aprobaciones requeridas antes del apply

Presupuestos es dominio **ALTO** (`CHANGES.md` §C-06). La regla del proyecto para ese nivel es
*"proponer y esperar revisión antes de escribir"*. Este `design.md` es análisis. **No autoriza el
apply.** Las siguientes decisiones requieren respuesta explícita de la usuaria antes de escribir una
sola línea de código, y están replicadas como tareas bloqueantes en `tasks.md` §0:

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D2** | Consumir las Edge Functions deployadas en vez de PostgREST + RLS directo | Aparta a este módulo del patrón que fijaron los cuatro changes anteriores. Es una decisión de arquitectura del proyecto, no de este change |
| **D3** | Aceptar que, para este módulo, el portón de autorización es el `requirePermiso` de la Edge Function y RLS queda como segunda capa | Es una postura de seguridad. Está ya deployada por `C-06`, pero nadie la aprobó explícitamente del lado del frontend |
| **D5** | Cómo se mapea `archivo`↔`archivo_url` sin subida a Storage | Puede hacer que el usuario crea que adjuntó un archivo que no se guardó. Es el riesgo funcional más alto del change |
| **D7b** | Migración de 3 índices sin `CONCURRENTLY` | Se aparta de una regla dura de `database-schema-design`. La justificación (0 filas) es sólida hoy y caduca |
| **D11** | Dejar `FacturacionRoute.tsx` en mocks mientras Presupuestos pasa a real | Después de este change, la misma app tendrá dos fuentes distintas para la misma entidad. Hay que decidirlo, no que pase solo |

Además, **el agente no aplica migraciones ni redeploya funciones**. Lo hace la usuaria / Enzo. Es
governance, no un límite técnico: el CLI del sandbox tiene sesión válida contra el proyecto real y se
usó **solo para lectura** durante este propose.

---

## Goals / Non-Goals

**Goals**

- Que la pantalla de Presupuestos y Autorizaciones lea y escriba datos reales de Postgres, con la
  sesión del usuario y su permiso del módulo `presupuestos`.
- Cumplir `PresupuestoRepository` y `AutorizacionRepository` **byte por byte**: mismas firmas, misma
  semántica de `null`, misma forma de error. Los hooks, los contexts y los 10 componentes no se tocan
  por el swap.
- Que RN-PA-01 (autorización nunca mayor al presupuesto) deje de ser solo una validación de UI y pase
  a estar **realmente aplicada**, con su rechazo traducido a un mensaje entendible.
- Que RN-PA-02 (carga retroactiva) persista de verdad en `vigencia_desde`, en vez de vivir solo en
  `localStorage`.
- Documentar honestamente lo que **no** persiste (el adjunto) en vez de dejar que la pantalla mienta.
- Aislar todo el mapeo en funciones **puras**, testeables sin red; los repositories quedan como
  cáscaras delgadas de I/O.
- Dejar cerrada, con evidencia, la trampa de RLS que `integracion-facturacion` D9 dejó anotada.

**Non-Goals**

- **No se construye la pantalla de Presupuestos** — ya existe (`presupuestos-ui`, archivada).
- **No se implementa la subida de archivos a Storage** (D5). No hay bucket, no hay policies, no hay
  UI de subida. Es un change propio.
- **No se agregan columnas ni tablas.** El schema de `C-06` alcanza.
- **No se modifican ni redeployan las Edge Functions.** Se consumen tal como están.
- **No se agrega `delete()`** a las interfaces, aunque las funciones lo expongan.
- **No se toca `features/facturacion/`** (D11).
- No se introduce TanStack Query (mismo criterio que `integracion-pacientes` D6).
- No se monta pgTAP ni Supabase local. Acá el costo es menor que en los changes anteriores porque
  este change **no escribe SQL de lógica**, solo tres índices.

---

## Decisions

### D1 — Mapeo puro separado del I/O, un par de archivos por entidad

Toda la traducción API↔dominio vive en funciones puras exportadas:

- `presupuestoMapping.ts`: `parsePresupuestoApi(unknown): Presupuesto | null`,
  `toCrearPresupuestoPayload(NuevoPresupuesto)`, `toActualizarPresupuestoPayload(ActualizacionPresupuesto)`.
- `autorizacionMapping.ts`: `parseAutorizacionApi(unknown): Autorizacion | null`,
  `toCrearAutorizacionPayload(NuevaAutorizacion)`, `toActualizarAutorizacionPayload(ActualizacionAutorizacion)`.

Los repositories solo hacen `await supabase.functions.invoke(...)`, chequean `error` y llaman a esas
funciones.

*Por qué:* Strict TDD funciona mejor sobre funciones puras (RED sin montar fakes de red), y el mapeo
—aunque el contrato ya venga en camelCase— **no es la identidad**: hay que narrowear `unknown`,
resolver `archivo`↔`archivoUrl` (D5), poner el default de `estado` (D6), y respetar la semántica
parcial de `Partial<…>` en los `PATCH` (D6b).
*Alternativa descartada:* mapear inline en cada método. Con dos entidades y cinco métodos en una de
ellas, el mapeo inline se duplicaría cuatro veces.

**Un tercer archivo compartido: `edgeFunctionErrors.ts`.** La traducción de la respuesta de
`functions.invoke` a `Error` es idéntica para las dos entidades salvo los textos de dominio, así que
vive en un módulo propio con una función `mapearErrorEdgeFunction(error, contexto)` parametrizada.
No se copia dos veces, y queda listo para que `integracion-facturacion` lo reuse si adopta las Edge
Functions `facturas`/`cobros` (D12).

### D2 — El transporte son las Edge Functions ya deployadas, no PostgREST directo ⚠️ REQUIERE APROBACIÓN

**El problema.** Este proyecto tiene, hoy, **dos backends en paralelo sobre las mismas tablas**:

| Camino | Quién lo construyó | Cómo autoriza | Quién lo usa hoy |
|---|---|---|---|
| **PostgREST + RLS** (+ RPC `SECURITY INVOKER` cuando hace falta atomicidad) | los changes de integración | RLS con la sesión del usuario | Pacientes, Obras Sociales, Prestadores, Cuentas (lecturas) |
| **Edge Functions** (`pacientes`, `obra-social`, `prestadores`, `presupuestos`, `autorizaciones`, `facturas`, `cobros`, `vehiculos`, …) | backend (`C-04`…`C-07`) | `requirePermiso()` a nivel app + cliente `service_role` | Cuentas (escrituras: `create-user`, `update-permisos`) |

Los cuatro changes de integración anteriores eligieron el primer camino. Ninguno lo declaró como
decisión: `integracion-facturacion` **ni siquiera menciona** que las Edge Functions `facturas` y
`cobros` existen y están deployadas — propone crear dos RPC nuevas para lo mismo. Eso no es un
descuido de este change que haya que replicar; es un hallazgo que este change pone sobre la mesa.

**La decisión: acá se usan las Edge Functions.** Cuatro razones, en orden de peso:

1. **El contrato ya coincide con el dominio.** `toApi()` de las dos funciones devuelve exactamente los
   nombres de `shared/types/presupuesto.ts` (`pacienteId`, `obraSocialId`, `fechaEmision`,
   `montoAutorizado`, `vigenciaDesde`, `cupoMensualDias`, `cupoMensualKm`). El mapeo se reduce a
   narrowing + dos casos especiales. Con PostgREST habría que remapear snake_case en las dos
   direcciones **para llegar al mismo resultado**.
2. **Cero SQL nuevo.** Con Edge Functions este change no escribe ni una función, ni una policy, ni
   una columna. Con PostgREST habría que verificar/pedir que el schema `facturacion` esté en *Exposed
   schemas* del Data API — dato que **no se puede confirmar desde SQL** y que, si hoy está apagado,
   encenderlo expondría también `facturas`, `cobros`, `asistencia_prestacion` y `gastos_vehiculos` a
   acceso directo, que es una decisión de otro dominio.
3. **La regla de autorización no se duplica.** `requirePermiso()` llama a la **misma**
   `modulos.tiene_permiso()` que usan las policies. No hay una segunda implementación de la regla.
4. **Un rechazo de permiso se ve.** Con PostgREST, un usuario sin `presupuestos: read` recibe **0
   filas en silencio** (RLS filtra, no falla) — es la trampa que `integracion-facturacion` D9
   describe. Con la Edge Function recibe un **403 explícito** que el repository traduce a *"No tenés
   permiso para ver presupuestos."* Es estrictamente mejor para el modo de falla que más caro sale.

**El costo, escrito para que no sorprenda.** Ver D3: adentro de la función se opera con
`service_role`, o sea que **RLS deja de ser el portón** para este módulo. Y el proyecto queda con dos
patrones de integración conviviendo, lo que es un costo de mantenimiento real (D12).

**Alternativa descartada: PostgREST + RLS, "por coherencia con la serie".** Se descarta porque la
coherencia se pagaría construyendo un tercer camino sobre tablas que ya tienen dos, sin ninguna
capacidad nueva a cambio. Si la usuaria prefiere unificar, la decisión correcta es al revés:
**unificar hacia un solo camino en un change transversal**, no seguir sumando caminos de a uno.

**No avanzar a la sección 2 de `tasks.md` sin respuesta.**

### D3 — Para este módulo, el portón es la Edge Function; RLS queda como segunda capa ⚠️ REQUIERE APROBACIÓN

**El hecho.** `_shared/auth.ts` devuelve `admin: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
y las dos funciones operan con ese cliente. El comentario del propio archivo lo dice con todas las
letras: *"Cliente service-role — bypasea RLS. La autorización ya se verificó vía `tiene_permiso()`;
RLS queda como segunda capa de defensa sobre las tablas, no como el único gate."*

**Lo que eso implica, sin adornos:**

- La verificación de permiso ocurre **una sola vez, al principio de la request**, y es a nivel de
  módulo (`presupuestos: read|write`). No hay filtrado por fila —tampoco lo había con RLS: las
  policies de estas dos tablas son de módulo, no de propiedad de fila—, así que **no se pierde
  granularidad**.
- Un bug en `requirePermiso` o en el ruteo de una de las funciones sería un bypass total. Con RLS
  directo, un bug equivalente en el cliente no lo sería.
- La `SERVICE_ROLE_KEY` vive **solo en el entorno de la función**, nunca en el frontend. La regla
  dura del proyecto sigue intacta y hay un test de código fuente que lo verifica.

**La decisión: se acepta, porque ya está deployada y este change no la introduce.** Lo que sí hace
este change es **dejarla escrita** en `04_modelo_de_datos.md` y someterla a confirmación acá, en vez
de consumirla en silencio.

**Lo que se pide verificar con cuentas reales antes del cableado** (tasks §1B): que una cuenta con
`presupuestos: read` y sin `write` reciba **403** en `POST`/`PATCH` y **no escriba ninguna fila**, y
que una cuenta con `facturacion: read/write` **sin** `presupuestos: read` reciba **403** —no un 200
con lista vacía— al listar presupuestos. Ese segundo caso es la confirmación empírica de que la
trampa de `integracion-facturacion` D9 queda cerrada del lado de esta pantalla.

### D4 — Lectura: una llamada por colección, `null` donde el contrato lo exige

`list()` de cada repository es **una** invocación (`GET /presupuestos`, `GET /autorizaciones`). La
pantalla llama las dos al montar (listado + chip de estado por tarjeta) y `getByPresupuestoId` una vez
al abrir un detalle. **No hay N+1**: ninguna colección se resuelve iterando.

`PresupuestoRepository.getById` y `AutorizacionRepository.getById`/`getByPresupuestoId` declaran
*"resuelve `null` si no existe, no lanza"*. La Edge Function responde **404**, que `functions.invoke`
entrega como **error**. Los tres métodos deben **absorber el 404 y devolver `null`**:

```
UI (PresupuestoDetail)
  └─> autorizacionRepository.getByPresupuestoId(presupuestoId)
        ├─> supabase.functions.invoke('autorizaciones?presupuestoId=…', { method: 'GET' })
        │     ├─ 200 -> data -> parseAutorizacionApi(data) -> Autorizacion
        │     ├─ 404 -> FunctionsHttpError(context.status = 404)  -> return null   ← NO lanza
        │     ├─ 403 -> "No tenés permiso para ver autorizaciones."                 → lanza
        │     └─ 401 -> "Tu sesión expiró. Volvé a iniciar sesión."                 → lanza
        └─> parseAutorizacionApi devuelve null si la forma no es la esperada -> return null
```

**El 404 se absorbe en `getById`/`getByPresupuestoId` y NO en `update()`.** Un `PATCH` sobre un id
inexistente debe lanzar el **mismo** mensaje que el mock (`No existe un presupuesto con id "…".` /
`No existe una autorización con id "…".`), porque `usePresupuestos`/`useAutorizaciones` lo pintan tal
cual y los tests de la feature lo esperan. Es la asimetría más fácil de romper del change y tiene test
dedicado en las dos entidades.

*Nota de implementación, no de diseño:* `supabase.functions.invoke(name, { method, body })` construye
la URL como `${SUPABASE_URL}/functions/v1/${name}`, así que el `:id` de path viaja como
`invoke('presupuestos/' + id, …)` y el filtro como
`invoke('autorizaciones?presupuestoId=' + encodeURIComponent(id), …)`. Que la versión fijada de
supabase-js (`^2.49.4`) soporte `method` y estas dos formas es una **precondición a verificar**
(tasks 0.6), no un supuesto.

### D5 — La documentación adjunta: `archivo` no tiene contraparte completa en la base ⚠️ CHECKPOINT

**El problema, y es el riesgo funcional más alto del change.** El dominio modela
`archivo?: ArchivoAdjunto { nombre, cargadoEn }`. La base tiene **una sola columna**, `archivo_url
TEXT`. `20260730120000_revert_presupuesto_archivo_meta.sql` dropeó `archivo_nombre` y
`archivo_cargado_en` **a propósito**, con su razón escrita: *"el nombre ya viaja en la URL, la fecha ya
es `fecha_emision`/`fecha_respuesta`"*.

Y hay algo peor que la asimetría de columnas: **hoy no se sube nada**. `PresupuestoForm.tsx` y
`AutorizacionForm.tsx` toman un `File` del input y guardan `{ nombre: file.name, cargadoEn: hoy }` —
el archivo nunca sale del navegador. No hay bucket (`20260727000001_create_buckets.sql` crea
`documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`, `documentos-facturas`;
**ninguno para presupuestos**), no hay policies de Storage, no hay código de subida.

Contra el mock eso no se notaba: el nombre quedaba en `localStorage` y la pantalla lo mostraba. Contra
la base real, **el usuario va a adjuntar un archivo, ver su nombre en pantalla, guardar, y perderlo**.

**La decisión propuesta (default): mapeo no destructivo + cartel, sin inventar subida.**

```
LECTURA
  archivo_url = 'https://…/presupuesto-facundo-abril.pdf'
    -> archivo = { nombre: 'presupuesto-facundo-abril.pdf',   (último segmento, decodeURIComponent)
                   cargadoEn: fechaEmision | fechaRespuesta } (la fecha de la propia entidad)
  archivo_url = null  ->  archivo = undefined

ESCRITURA
  el payload NO incluye archivoUrl salvo que el `archivo` del dominio provenga de una lectura
  previa (round-trip); un archivo elegido en el input NO produce archivoUrl, porque no existe.
```

Round-trip **sin pérdida** para lo que ya está en la base; **cero invención** para lo que no. Y un
`AvisoModeloDatos` en los dos formularios que dice, en castellano y sin jerga, que el archivo todavía
no se guarda en el servidor.

**Por qué `cargadoEn` se deriva de la fecha de la entidad y no se inventa.** Es literalmente la
justificación escrita en la migración que dropeó la columna. Poner `new Date()` al leer haría que la
misma fila mostrara una fecha distinta en cada recarga.

**Las tres opciones sobre la mesa para la usuaria:**

| Opción | Qué implica | Riesgo | Costo |
|---|---|---|---|
| **A. Mapeo no destructivo + cartel** (propuesta) | el input sigue existiendo, el adjunto no se persiste, y el cartel lo dice | el usuario puede ignorar el cartel | bajo |
| B. Deshabilitar el input de archivo hasta que haya Storage | imposible confundirse | se pierde una parte visible de la pantalla ya entregada | medio |
| C. Implementar la subida a Storage en este change | queda resuelto de una | bucket nuevo + policies + UI de subida + tests: es otro change, y arrastra `C-03` | alto |

**Propuesta concreta: A**, con `presupuestos-documentacion-storage` registrado como change propio.
**No avanzar a la sección 3 de `tasks.md` sin respuesta.**

### D6 — Nullability y defaults: la base es permisiva, el tipo es estricto; se resuelve en el mapeo

`Presupuesto` exige `monto: number` y `fechaEmision: string`; las columnas son **nullable**.
`Autorizacion` exige `estado: EstadoAutorizacion`; la columna es **nullable con `DEFAULT 'pendiente'`**.
Hoy no hay filas, así que ninguna de estas ramas se va a ejercitar en el primer día — razón de más
para que estén decididas por escrito y testeadas antes de que aparezca la primera fila rara.

| Campo | Base | Dominio | Resolución |
|---|---|---|---|
| `presupuesto.monto` | `numeric NULL` | `number` | fila con `monto` nulo/no numérico → **se descarta la fila** del listado (no se inventa `0`, que se leería como "presupuesto de cero pesos") |
| `presupuesto.fecha_emision` | `date NULL` | `string` | ídem: fila sin fecha → se descarta |
| `autorizacion.estado` | `NULL DEFAULT 'pendiente'` | `EstadoAutorizacion` | nulo o fuera de la unión → **`'pendiente'`** (es el default de la columna, no una invención del frontend) |
| `autorizacion.monto_autorizado` | `numeric NULL` | `number?` | nulo → `undefined`. Directo |
| `autorizacion.vigencia_desde` | `date NULL` | `string?` | nulo → `undefined`. Directo |
| `presupuesto.paciente_id` / `obra_social_id` | `uuid NOT NULL` | `string` | fila sin uno de los dos → se descarta (no debería pasar: son `NOT NULL`) |

**Por qué descartar y no romper.** Mismo criterio que `parsePermisoRow` de `SupabaseCuentaRepository`
y que el mapeo de Obras Sociales: una fila rara no puede tumbar el listado entero. Cada descarte tiene
su propio test.

#### D6b — Semántica parcial de `update()`

`ActualizacionPresupuesto` y `ActualizacionAutorizacion` son `Partial<…>`: **clave ausente significa
"no tocar"**. El `toDb()` de las dos Edge Functions ya respeta eso (`if (input.x !== undefined)`), así
que el mapeo del frontend solo tiene que **no rellenar claves que el llamador no pasó**. Es directo,
pero es exactamente el mismo agujero que en `integracion-obra-social` D6 borró checklists enteros, así
que tiene test dedicado en las dos entidades: `update(id, { monto })` no debe llevar `fechaEmision` ni
`archivoUrl` en el body.

### D7 — Traducción de errores: HTTP → `Error` con mensaje de UI

`usePresupuestos`/`useAutorizaciones` pintan `err.message` directamente, así que los repositories
**siempre** lanzan `Error` con `.message` en castellano listo para mostrar. La forma de la traducción
copia `SupabaseCuentaRepository.mapearErrorEdgeFunction`: leer `error.context` cuando es un `Response`
y despachar por `status`.

| Señal | Mensaje |
|---|---|
| `401` | `Tu sesión expiró. Volvé a iniciar sesión.` |
| `403` (`tiene_permiso` false) — lectura | `No tenés permiso para ver presupuestos.` / `…autorizaciones.` |
| `403` — escritura | `No tenés permiso para modificar presupuestos.` / `…autorizaciones.` |
| `404` en `getById` / `getByPresupuestoId` | **no lanza** → `null` (contrato explícito de la interfaz) |
| `404` en `update` | `No existe un presupuesto con id "…".` / `No existe una autorización con id "…".` (**idéntico al mock**) |
| `400` cuyo `error` empieza con `RN-PA-01` | `La autorización no puede superar el monto del presupuesto.` |
| `400` cuyo `error` menciona violación de FK (`23503` / `foreign key`) | `El paciente o la obra social del presupuesto ya no existen.` |
| `400 { error: 'faltan campos requeridos: …' }` | `Faltan datos obligatorios del presupuesto.` (es un bug del cliente: la validación de UI debería haberlo frenado) |
| `400` cualquier otro | genérico según operación |
| error de red / sin `context` | `No se pudo conectar con el servidor.` |
| cualquier otro | `No se pudo cargar/guardar el presupuesto.` según la operación |

**El caso RN-PA-01 es el que justifica esta tabla entera.** El trigger hace
`RAISE EXCEPTION 'RN-PA-01: monto_autorizado (%) no puede superar el presupuesto (%)'`, y la Edge
Function lo devuelve como `400 { error: <ese texto crudo> }`. Sin traducción, el usuario ve un mensaje
con nombres de columnas y un código de regla interno. Con traducción, ve una frase.

*Por qué mensajes fijos y no el `error` del body crudo:* filtra nombres de tablas y columnas hacia la
UI. **Excepción deliberada**: no la hay — a diferencia de `SupabaseCuentaRepository` (que propaga el
`error` del body en los 400 porque `create-user` devuelve mensajes de validación ya redactados para
humanos), acá los 400 vienen del motor. Se traduce todo.

**Nota de seguridad (`security-review`, broken access control).** El gateo de escritura de la UI
(`AvisoSoloLectura` en `PresupuestosPage`) es client-side y **bypassable**. La defensa real es el
`requirePermiso('presupuestos', 'write')` de la Edge Function (D3). Este change **no la duplica ni la
reimplementa**: solo traduce su rechazo, y hay un test de código fuente que verifica que los
repositories no consultan `modulos.permisos`.

### D7b — Tres índices sobre FK: el único SQL del change ⚠️ REQUIERE APROBACIÓN

**El hecho, verificado contra `pg_indexes` el 2026-08-02.** El schema `facturacion` sigue teniendo
**exactamente 7 índices: sus 7 primary keys**. `integracion-facturacion` D10 propone crear 6 y deja
explícitamente fuera *"`presupuesto.obra_social_id`, `presupuesto.paciente_id`,
`autorizacion.presupuesto_id` (son de `C-06`)"*. Este es el change de `C-06`. Se recogen.

| Índice | Columna | Quién lo usa |
|---|---|---|
| `idx_presupuesto_paciente_id` | `presupuesto.paciente_id` | integridad + consultas por paciente (ficha, y `C-07`) |
| `idx_presupuesto_obra_social_id` | `presupuesto.obra_social_id` | integridad + consultas por obra social |
| `idx_autorizacion_presupuesto_id` | `autorizacion.presupuesto_id` | **cada `getByPresupuestoId()`**, o sea cada apertura de detalle |

**El apartamiento de la regla: `CREATE INDEX` sin `CONCURRENTLY`.** Mismas dos razones que
`integracion-facturacion` D10, re-verificadas hoy: (1) **las dos tablas tienen 0 filas**
(`count(*)`, 2026-08-02), así que el lock dura microsegundos; (2) `CREATE INDEX CONCURRENTLY` no puede
correr dentro de un bloque de transacción y las migraciones de Supabase van envueltas en una.

**Condición de caducidad, escrita para que no se pierda:** si al momento de aplicar la migración
alguna de las dos tablas ya tiene filas en volumen, **hay que rehacerlo con `CONCURRENTLY` fuera de
transacción**. La verificación del `count(*)` es una tarea explícita e inmediatamente anterior al
`db push`, no un supuesto. Se usa `IF NOT EXISTS` por si `integracion-facturacion` los agrega antes.

**Rollback**: `DROP INDEX` × 3. Los índices no cambian ninguna semántica.

### D8 — Los selectores del formulario también se swapean, en el mismo commit ✅ DECIDIDO

`PresupuestosRoute.tsx` pasa `mockPacienteRepository` y `mockObraSocialRepository` a
`PresupuestosPage`, que los usa para poblar los selectores del formulario y para resolver nombres en
el listado.

`facturacion.presupuesto.paciente_id` y `.obra_social_id` son **`NOT NULL` con FK**. Si los selectores
siguen ofreciendo ids de fixture, **toda alta real falla con `23503`** y el listado real muestra
"Paciente desconocido / Obra social desconocida" en cada fila. No es un riesgo: es determinístico.

Los dos repositories reales ya existen y ya están cableados en otras rutas
(`PacientesRoute.tsx`, `ObraSocialesRoute.tsx`). Se swapean acá también. **No es ampliación de
alcance: es la condición para que el swap funcione**, y no toca ningún archivo fuera del composition
root de esta feature.

*Consecuencia que hay que anticipar (D9):* los selectores van a ofrecer **1 paciente y 3 obras
sociales**, que es lo que hay en la base real.

### D9 — La pantalla va a quedar vacía, y eso no es un bug ✅ DECIDIDO

Verificado el 2026-08-02: `facturacion.presupuesto` **0 filas**, `facturacion.autorizacion` **0
filas**, `pacientes.paciente` **1 fila**, `obra_social.obra_social` **3 filas**.

Con el mock, la pantalla arranca con el fixture de OSECAC y presupuestos de ejemplo. Después del swap
arranca **vacía**, con el estado vacío que `PresupuestosList` ya implementa. Es correcto y es el mismo
salto que dieron Pacientes y Obras Sociales al integrarse.

**Lo que este change hace al respecto:**

- Lo anticipa acá y en `tasks.md`, para que la verificación manual no lo reporte como regresión.
- **No siembra datos.** Convertir `presupuestosFixture`/`autorizacionesFixture` en un seed escribiría
  filas de prueba en una base real, referenciando un paciente y unas obras sociales que existen de
  verdad. Es una decisión de datos, no de código (§Open Questions).
- `PresupuestosRoute.test.tsx` deja de afirmar *"aparece el fixture precargado"* y pasa a afirmar
  *"el composition root monta y muestra el encabezado sin colgarse en 'cargando'"* — verifica
  cableado, no contenido de un fixture que ya no está en ese camino. Patrón ya resuelto en
  `ObraSocialesRoute.test.tsx` y `PacientesRoute.test.tsx`.

### D10 — Tests: mapeo puro exhaustivo + repositories contra un fake tipado de `functions.invoke`

Dos capas, siguiendo el precedente de `SupabaseCuentaRepository.test.ts` (que es el único que ya
mockea `functions.invoke`):

1. **`presupuestoMapping.test.ts` / `autorizacionMapping.test.ts`** — funciones puras, sin mocks.
   Cubren: parseo completo, cada rama de descarte de D6, el default de `estado`, el mapeo de `archivo`
   de D5 (con URL con querystring y con nombre percent-encoded), y la semántica parcial de D6b (clave
   ausente ⇒ no aparece en el body).
2. **`SupabasePresupuestoRepository.test.ts` / `SupabaseAutorizacionRepository.test.ts`** —
   `vi.mock('../supabaseClient')` con un fake tipado a mano (interfaces propias, cero `any`, cero
   `as`) que **registra** cada invocación: nombre de función, `method` y `body`. Eso permite afirmar
   cosas que un mock que solo devuelve datos no puede: que `list()` emite **una sola** invocación, que
   `update()` no manda claves que no se pidieron, y que `getById` de un 404 **no vuelve a llamar** a
   nada.
3. **`edgeFunctionErrors.test.ts`** — un test por rama de la tabla de D7, más uno dedicado a que **no
   se filtra el texto crudo de Postgres** hacia la UI (el caso RN-PA-01 es el testigo).

Más una aserción de código fuente (`?raw`) de que los dos repositories no contienen `service_role`, no
contienen `any` **ni siquiera en los comentarios en castellano** (el regex `/\bany\b/` no distingue
código de prosa — a `integracion-pacientes` 3.12 le pasó), y no consultan `modulos.permisos` ni
`modulos.modulos`.

**Lo que no se puede testear automatizado:** el comportamiento real de las Edge Functions y del
trigger RN-PA-01. Se verifica **a mano con cuentas reales**, como tareas explícitas y separadas en
`tasks.md` §1B. A diferencia de los tres changes anteriores, acá el costo de no tener pgTAP es
**menor**, porque este change no escribe lógica de servidor: lo que hay que verificar es un backend
que ya está deployado y que backend ya debería haber probado.

### D11 — `FacturacionRoute.tsx` queda en mocks; la fuente mixta cambia de forma ⚠️ REQUIERE APROBACIÓN

**El hecho.** `frontend/src/features/facturacion/FacturacionRoute.tsx` importa
`mockPresupuestoRepository` y `mockAutorizacionRepository` y se los pasa a `FacturacionPage` de solo
lectura, para la validación de cupo autorizado (RN-FA-02 / RN-PA-03). **Este change no lo toca** — es
alcance de `integracion-facturacion`, y meterlo acá arrastraría un change de governance CRÍTICO
adentro de uno ALTO.

**Lo que cambia igual, aunque no toquemos el archivo.** Después de este change, la misma aplicación
tendrá **dos fuentes distintas para la misma entidad**: la pantalla de Presupuestos mostrará las
autorizaciones reales, y la pantalla de Facturación seguirá validando cupo contra el fixture de
`localStorage`. Un usuario puede cargar una autorización real con cupo 20 y ver que Facturación sigue
alertando contra un cupo de fixture. **Antes del change las dos pantallas mentían igual; después,
mienten distinto** — y eso es más confuso, no menos.

**Lo que sí mejora, y hay que decirlo con la misma honestidad:** la mitad "las autorizaciones son
fixtures" del problema D9 de `integracion-facturacion` deja de ser estructural. Una vez cableado esto,
ese change puede resolver su D9 cambiando **dos líneas** de `FacturacionRoute.tsx` (los mismos
`supabasePresupuestoRepository`/`supabaseAutorizacionRepository` que este change deja escritos), en
vez de tener que elegir entre sus opciones A/B/C.

**Lo que este change hace al respecto:**

1. Deja los dos repositories reales **exportados y listos** para que `integracion-facturacion` los
   inyecte sin escribir código nuevo.
2. Actualiza el `AvisoModeloDatos` de fuente mixta que `integracion-facturacion` §6 planea poner en
   `AlertaCupo.tsx`: pasa de *"las autorizaciones son datos de prueba"* a *"esta pantalla todavía lee
   las autorizaciones de datos de prueba, aunque el módulo de Presupuestos ya usa datos reales"*.
   **Esa tarea vive en `integracion-facturacion`, no acá** — este change solo la registra como
   requisito de coordinación en `CHANGES.md` §C-07.
3. **Cierra la trampa de RLS** que D9 de ese change anotó: verificado hoy contra `pg_policies`, las
   cuatro policies gatean por `presupuestos`, no por `facturacion`. Con el transporte de D2, un
   usuario con `facturacion: read/write` y sin `presupuestos: read` recibe un **403 explícito**, no 0
   filas en silencio. Queda documentado en la KB y verificable con cuenta real (§1B).

**La decisión que se pide:** confirmar que el orden es este (Presupuestos primero, Facturación
después) y no al revés. La alternativa —esperar a `integracion-facturacion` y swapear las dos
pantallas juntas— es defendible, pero ese change está **bloqueado en cinco decisiones de Enzo/backend**
desde el 2026-07-31, así que esperar significa no hacer ninguna de las dos.

### D12 — Dos patrones de integración conviviendo: se declara, no se resuelve acá ✅ DECIDIDO

**El hallazgo.** Al elegir el transporte (D2) quedó a la vista que el proyecto tiene dos backends
sobre las mismas tablas, y que **ningún change lo declaró como decisión**. En particular:
`integracion-facturacion` propone crear `crear_factura_completa` / `actualizar_factura_completa` como
RPC nuevas **sin mencionar que las Edge Functions `facturas` y `cobros` ya están deployadas y hacen
eso mismo**. Verificado: la cadena `Edge Function` no aparece ni una vez en su `proposal.md` ni en su
`design.md`.

**La decisión: se documenta, no se resuelve.** Unificar los dos caminos es un change transversal que
toca cinco módulos y dos equipos; hacerlo de rebote adentro de un change de swap sería exactamente lo
que la serie evita. Lo que este change deja:

- El hallazgo escrito en `knowledge-base/04_modelo_de_datos.md` y en `CHANGES.md` §C-06 y §C-07.
- Una pregunta abierta con decisor nombrado (§Open Questions).
- `edgeFunctionErrors.ts` escrito de forma reutilizable, para que **si** la decisión es "unificar hacia
  Edge Functions", el próximo change no reescriba la traducción.

### D13 — Inventario de discrepancias: qué se resuelve y qué solo se documenta

| # | Frontend | Base / Edge Function real | Discrepancia | Resolución en este change |
|---|---|---|---|---|
| 1 | `Presupuesto.archivo: ArchivoAdjunto` | `presupuesto.archivo_url TEXT` | dos campos vs. uno, y **sin subida a Storage** | **parcialmente**: mapeo no destructivo + cartel (D5). La subida va a change propio |
| 2 | `Autorizacion.archivo: ArchivoAdjunto` | `autorizacion.archivo_url TEXT` | ídem | ídem |
| 3 | `Presupuesto.monto: number` | `numeric NULL` | tipo estricto vs. columna permisiva | **se resuelve**: fila sin monto se descarta (D6) |
| 4 | `Presupuesto.fechaEmision: string` | `date NULL` | ídem | **se resuelve**: fila sin fecha se descarta (D6) |
| 5 | `Autorizacion.estado` (requerido) | `NULL DEFAULT 'pendiente'` | ídem | **se resuelve**: default `'pendiente'` (D6) |
| 6 | `montoAutorizado?` / `vigenciaDesde?` documentados como *"campos que el frontend agrega sobre el docx, pendientes de confirmar con backend"* | columnas reales desde `C-06` | el comentario del tipo quedó viejo | **se resuelve**: se actualiza el comentario y se retira el cartel de "pendiente de confirmar" de `AutorizacionForm` |
| 7 | RN-PA-01 solo en UI (`validarAutorizacion`) | trigger `validar_autorizacion_monto` | la regla ahora se aplica de verdad | **se resuelve**: se traduce el rechazo (D7); la función pura queda como espejo |
| 8 | — | policies gateadas por módulo `presupuestos`, no `facturacion` | el comentario de `20260724100005` dice lo contrario | **se resuelve** (documentación): verificado contra `pg_policies`, escrito en KB y `CHANGES.md` |
| 9 | — | 3 FK sin índice | rendimiento | **se resuelve**: 3 índices (D7b) |
| 10 | repositories vía RLS (los 4 changes previos) | Edge Functions deployadas | dos patrones de integración | **NO se resuelve**: se declara y se abre pregunta (D12) |
| 11 | `FacturacionRoute` en mocks | — | dos fuentes para la misma entidad en la misma app | **NO se resuelve**: coordinación con `integracion-facturacion` (D11) |
| 12 | interfaces sin `delete()` | Edge Functions con `DELETE` | capacidad del servidor sin contraparte | **NO se resuelve**: agregar borrado es funcionalidad nueva |
| 13 | `Presupuesto` = monto único | docx: ídem; la KB decía "estimación anual por prestación" | ya resuelta en `presupuestos-ui` a favor del docx | **NO se reabre** |

Las que dicen "NO se resuelve" van a `knowledge-base/04_modelo_de_datos.md` §Discrepancias, a
`CHANGES.md` y —cuando tienen efecto visible— a un `AvisoModeloDatos`. Ninguna se resuelve
unilateralmente.

---

## Risks / Trade-offs

- **[El usuario cree que adjuntó un archivo y no se guardó]** → riesgo #1 del change (D5). Mitigación:
  es un ⚠️ CHECKPOINT, no una decisión del agente; `AvisoModeloDatos` en los dos formularios; y el
  change de Storage queda propuesto por nombre para que no se pierda.
- **[Se acepta `service_role` adentro de la Edge Function como portón]** → un bug en `requirePermiso`
  o en el ruteo sería bypass total (D3). Mitigación: no lo introduce este change (ya está deployado);
  se somete a aprobación; y se verifica empíricamente con tres cuentas reales antes del cableado.
- **[La UI muestra el texto crudo del trigger RN-PA-01]** → pasa si la traducción de D7 no cubre el
  prefijo. Mitigación: test dedicado con el texto literal del `RAISE EXCEPTION`, copiado del `.sql`
  real y no del design.
- **[El 404 se absorbe donde no debe]** → si `update()` devolviera `null` en vez de lanzar, la UI
  reportaría un guardado exitoso que no ocurrió. Mitigación: tests separados y explícitos para las dos
  asimetrías (D4), en las dos entidades.
- **[Los selectores siguen en mock y toda alta falla con `23503`]** → determinístico si D8 no se
  aplica. Mitigación: D8 está dentro del mismo commit del swap y hay un test de que el composition
  root no importa ningún mock de paciente/obra social.
- **[La pantalla vacía se lee como regresión]** → 0 filas en las dos tablas (D9). Mitigación:
  anticipado en `tasks.md` y en el guion de verificación manual.
- **[`functions.invoke` no soporta `method`/querystring en la versión fijada]** → tests verdes contra
  una API que no es la real. Mitigación: tarea 0.6 explícita de verificar contra
  `https://supabase.com/changelog.md` y contra los tipos de `@supabase/supabase-js@^2.49.4` **antes**
  de escribir el fake, no después.
- **[El fake de `functions.invoke` se desincroniza de supabase-js]** → mismo riesgo que en los changes
  anteriores con el query builder. Mitigación: mantener el fake en el subconjunto mínimo usado.
- **[Dos patrones de integración conviviendo]** → deuda de arquitectura real (D12). Mitigación: se
  declara con decisor nombrado en vez de dejarla implícita por quinta vez.
- **[Regresión en la suite existente]** → safety net obligatorio: correr la suite **antes** de tocar
  cualquier archivo existente y registrar el baseline. **El baseline se mide, no se asume** — y ojo con
  el hallazgo de entorno de `integracion-obra-social` 0.3: en este sandbox hace falta
  `NODE_OPTIONS="--no-experimental-webstorage"` o ~112 tests fallan por el `localStorage` nativo de
  Node shadoweando el de jsdom.
- **[Colisión con `integracion-facturacion`]** → los dos changes tocan el mismo dominio conceptual.
  Este no toca **ningún** archivo de `features/facturacion/` ni de `shared/lib/facturacion/`; los
  únicos puntos de contacto son la migración de índices (resuelto con `IF NOT EXISTS`) y la nota de
  coordinación de D11.

---

## Migration Plan

1. **Portón de governance** con la usuaria: **D2** (Edge Functions vs. PostgREST), **D3** (postura de
   seguridad), **D5** (archivo adjunto), **D7b** (los 3 índices sin `CONCURRENTLY`) y **D11** (orden
   respecto de `integracion-facturacion`). No se escribe código hasta tener respuesta.
2. Verificar el estado real (**solo lectura**): las dos funciones siguen `ACTIVE`
   (`supabase functions list`), las columnas de `C-06` siguen aplicadas, las policies siguen gateadas
   por `presupuestos`, y `count(*)` de las dos tablas sigue en 0.
3. Verificar que la versión fijada de supabase-js soporta `method` y path/querystring en
   `functions.invoke`.
4. Escribir `20260802100000_presupuesto_autorizacion_indices.sql` (3 índices, `IF NOT EXISTS`).
5. **Aplicar la migración** al proyecto real, **inmediatamente después** de re-verificar el `count(*)`
   (condición de caducidad de D7b). **La corre la usuaria / Enzo, no el agente.** Este paso no bloquea
   el paso 8 (sin índice todo funciona, solo más lento), pero sí bloquea el archivado.
6. Verificación manual de las dos Edge Functions con **tres cuentas reales** (checklist completo en
   `tasks.md` §1B): `presupuestos: write` → alta y edición completas; `presupuestos: read` sin `write`
   → **403** y cero filas escritas; `facturacion: read/write` **sin** `presupuestos: read` → **403** al
   listar, no 200 con lista vacía (la prueba de que la trampa de D9 de `integracion-facturacion` queda
   cerrada); y una autorización con `montoAutorizado` mayor al presupuesto → rechazo del trigger.
7. Implementar los mapeos puros y los dos repositories por TDD estricto (nada de esto toca producción
   todavía: nadie los importa).
8. Cambiar `PresupuestosRoute.tsx` — **el corte real**, los cuatro repositories en un solo commit.
9. Sumar los `AvisoModeloDatos` (archivo, fuente real) y ajustar los carteles que quedan viejos.
10. Documentar las discrepancias (KB + `CHANGES.md` + `10_preguntas_abiertas.md`).
11. Verificación manual en navegador con las tres cuentas del paso 6.
12. Actualizar `ROADMAP-FRONTEND.md` §FE-8 y la fila 5 del §Plan de integración de `CHANGES.md`.

**Rollback**: revertir el commit del paso 8 (cuatro imports y cuatro props en `PresupuestosRoute.tsx`).
La app vuelve al mock al instante y los archivos del paso 7 quedan inertes. Los índices **no hace falta
revertirlos**: no cambian ninguna semántica. Si aun así se quiere limpiar: `DROP INDEX` × 3. **Ningún
dato existente se transforma ni se borra en ningún paso del plan.**

---

## Open Questions

- **¿El proyecto unifica hacia Edge Functions o hacia PostgREST + RLS?** Hoy conviven los dos caminos
  sobre las mismas tablas y ningún change lo declaró (D12). `integracion-facturacion` propone RPC
  nuevas sin mencionar que las Edge Functions `facturas`/`cobros` ya existen. Cada change que pase sin
  decidirlo suma una superficie más que mantener. **Decisor**: equipo técnico (Enzo + la usuaria). No
  se resuelve acá.
- **¿Se implementa la subida de archivos de presupuesto/autorización a Storage?** Hoy el input existe y
  no guarda nada (D5). Requiere bucket nuevo + policies + UI. **Decisor**: usuaria / cliente. Propuesto
  como change propio `presupuestos-documentacion-storage`.
- **¿Se siembran datos de prueba en la base real?** Las dos tablas tienen 0 filas y la pantalla va a
  arrancar vacía (D9). Sembrar los fixtures escribiría filas de prueba referenciando el paciente y las
  obras sociales reales. **Decisor**: usuaria / cliente. Este change **no** lo hace.
- **¿Los repositories deben exponer `delete()`?** Las dos Edge Functions lo soportan; las interfaces
  no lo tienen y ninguna pantalla lo ofrece. ¿Se puede borrar un presupuesto cargado por error, o solo
  editarlo? Ninguna fuente (docx, KB, US-200) lo dice. **Decisor**: cliente.
- **¿El listado de autorizaciones necesita orden?** `GET /presupuestos` ordena por `fecha_emision`
  desc; `GET /autorizaciones` **no ordena**, así que devuelve las filas en el orden físico de Postgres.
  Hoy no importa (la pantalla solo las usa para resolver el chip de estado por presupuesto), pero es
  exactamente el modo de falla que RN-FA-08 obligó a resolver en Obras Sociales. Si alguna vez se
  lista autorizaciones directamente, hay que agregar `order` en la Edge Function. **Decisor**: backend.
- **¿Quién es el dueño del contrato de las Edge Functions?** Este change lo consume como está. Si
  backend cambia un nombre de campo de `toApi()`, el frontend se rompe **en runtime**, sin que ningún
  test ni el type-check lo detecten (no hay tipos compartidos entre `supabase/functions/` y
  `frontend/`). ¿Se genera un tipo compartido, se versiona el contrato, o se acepta el riesgo?
  **Decisor**: equipo técnico.
- **¿Se monta pgTAP (o `supabase start`)?** Cuarta vez consecutiva que un change de esta serie
  verifica comportamiento de servidor a mano. Acá el costo es **menor** que en los anteriores (este
  change no escribe lógica de servidor), pero el trigger RN-PA-01 y las dos Edge Functions siguen sin
  ninguna verificación automatizada. **Decisor**: equipo técnico. No se monta acá.
