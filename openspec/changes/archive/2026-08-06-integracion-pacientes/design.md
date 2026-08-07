## Context

**Estado actual.** `frontend/src/features/pacientes/PacientesRoute.tsx` inyecta
`mockPacienteRepository` (localStorage + latencia simulada) en `PacienteRepositoryProvider`. Toda la
feature consume la interfaz `PacienteRepository` (`list`/`getById`/`create`/`update`) vía context —
ningún componente conoce Supabase. El hook `usePacientes` maneja `loading`/`error` capturando lo que
el repository lance y leyendo `err.message`.

**Backend.** `supabase/migrations/20260724100004_schema_pacientes.sql` está aplicado: schema
`pacientes` con `paciente`, `cud`, `clinicos`, `accesorios`, `accesorios_pacientes`,
`personas_a_cargo`, `direcciones`, `recorridos`, `historial_recorridos`, `documentos`, más
`obra_social.coberturas_paciente`. RLS habilitado en todas, con policies
`FOR SELECT USING (modulos.tiene_permiso('pacientes','read'))` y
`FOR ALL USING (modulos.tiene_permiso('pacientes','write'))`. `20260730140000_split_modulos_permisos.sql`
movió `recorridos` e `historial_recorridos` al módulo `hojas_de_ruta`. Triggers de auditoría
(`auditoria.log_action()`) en todas las tablas.

**Referencias de patrón.** Las dos únicas implementaciones reales existentes:
`frontend/src/shared/lib/auth/SupabaseAuthRepository.ts` y
`frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.ts`. Ambas: `supabase.schema(x).from(y)`,
narrowing con type guards explícitos sobre `unknown` (nunca `any`, nunca `as`), errores traducidos a
`Error` con `.message` en castellano apto para UI, y tests con `vi.mock('../supabaseClient')` +
fakes tipados a mano.

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any`; solo utilidades Tailwind v4;
`anon key` únicamente (jamás `service_role` en frontend); RLS obligatorio; `npx tsc -b --noEmit`
como único type-check válido; Conventional Commits; toda discrepancia docx↔KB se documenta en los
dos lugares (`knowledge-base/04_modelo_de_datos.md` §Discrepancias + `CHANGES.md`) **y** con
`AvisoModeloDatos` en la UI, nunca se resuelve adivinando.

**Governance**: MEDIO para el adaptador de datos (esquema y UI ya aprobados) y **ALTO para la
migración nueva de D4** (toca el esquema de un dominio con datos de salud). Implementación con
checkpoints; las decisiones D3 y D6 se ponen a revisión de la usuaria antes de escribir código.
**D4 ya fue revisada y confirmada por la usuaria el 2026-07-30**, con aval de backend para escribir y
aplicar una migración nueva — ver el bloque de revisión en D4.

---

## Goals / Non-Goals

**Goals:**
- Que la pantalla de Pacientes lea y escriba datos reales de Postgres vía RLS, con la sesión del
  usuario.
- Cumplir `PacienteRepository` **byte por byte**: mismas firmas, misma semántica de `null`, misma
  forma de error. `usePacientes`, el context y los componentes no se tocan.
- Aislar todo el mapeo en funciones **puras**, testeables sin red — el repository queda como una
  cáscara delgada de I/O.
- Dejar cada hueco del esquema real señalizado (KB + `CHANGES.md` + `AvisoModeloDatos`), no
  silenciado.
- Fijar el patrón que van a copiar los 8 changes de integración siguientes.

**Goal agregado en la revisión de D4 (2026-07-30):**
- Que el alta de un paciente sea **atómica de verdad**: o queda la ficha completa, o no queda nada.
  Se logra con una migración nueva que agrega una única función `SECURITY INVOKER`
  (`pacientes.crear_paciente_completo`), sin tocar tablas, columnas ni policies existentes.

**Non-Goals:**
- No se crean ni se alteran tablas, columnas, tipos ni policies. La **única** migración nueva del
  change es la función atómica de D4 (`20260730180000_crear_paciente_completo.sql`), que es aditiva y
  reversible con un `DROP FUNCTION`. Cero Edge Functions nuevas.
- No se integra ningún otro módulo (obras sociales, vehículos, documentos siguen en mock; la
  pantalla de Pacientes sigue recibiendo `mockObraSocialRepository` y `mockDocumentoRepository`).
- No se introduce TanStack Query / SWR ni se reescribe `usePacientes`.
- No se resuelve IN-01 (formato del identificador de afiliado) ni ninguna otra pregunta abierta.
- No se migran los datos del `localStorage` del mock a Postgres — son fixtures de desarrollo.
- No se toca `recorridos` / `historial_recorridos` (son de `hojas_de_ruta`) ni
  `pacientes.documentos` (es de `gestion-documental-core`, `DocumentoRepository`).

---

## Decisions

### D1 — Mapeo puro separado del I/O: `pacienteMapping.ts` + `SupabasePacienteRepository.ts`

Toda la traducción fila↔dominio vive en `pacienteMapping.ts` como funciones puras y exportadas:
`parsePacienteRow`, `parseCudRow`, `parseDireccionRow`, `parsePersonaACargoRow`,
`parseCoberturaRow`, `toPacienteRow`, `toCudRow`, `toDireccionRows`, `toPersonaACargoRows`,
`ensamblarPaciente(...)`. El repository solo hace `await`, chequea `error` y llama a esas funciones.

*Por qué:* Strict TDD funciona mejor sobre funciones puras (RED sin montar fakes de red);
triangular un mapeo con 11 discrepancias es barato en una función pura y caro a través de un fake de
query builder. Además evita que el repository pase de 200 líneas.
*Alternativa descartada:* mapear inline dentro de cada método, como hace `SupabaseCuentaRepository`
(que sí lo hace, pero mapea 2 tablas planas — acá son 6 tablas con anidamiento y N:N).

### D2 — Lectura con embeds de PostgREST en una sola consulta por método

`list()` y `getById()` usan un único `select` con embeds anidados sobre el schema `pacientes`:

```
supabase.schema('pacientes').from('paciente').select(`
  id, nombre_a, nombre_b, apellido_a, apellido_b, fecha_nacimiento, dni, cuil_titular,
  domicilio, obra_social_id, amparo_judicial,
  cud ( numero_cud, emision, vencimiento ),
  clinicos ( diagnostico, condicion ),
  personas_a_cargo ( id, nombre, apellido, dni, telefono, telefono_alternativo ),
  direcciones ( id, calle, numero, tipo_lugar ),
  accesorios_pacientes ( accesorios ( tipo ) )
`)
```

`getById` agrega `.eq('id', id).maybeSingle()`. La cobertura (`num_afiliado`) va en una **segunda**
consulta porque vive en otro schema (ver D3) — PostgREST no embebe cross-schema.

*Por qué:* una consulta por pantalla en vez de 1+5N (evita N+1, `performance-optimization`), y RLS
se aplica a cada tabla embebida igual que si se consultara sola.
*Alternativa descartada:* una vista SQL `pacientes.paciente_completo`. La decisión no cambia con la
revisión de D4 (que sí habilita una migración nueva), pero el motivo se ajusta: los embeds de
PostgREST ya resuelven la lectura en una consulta, así que la vista no aportaría nada y sí agregaría
superficie —requeriría `security_invoker = true` para no bypassear RLS, y **eso sí exige PG15+**,
versión que no se puede confirmar desde el repo. La función de D4 no tiene ese problema (ver D4,
§Compatibilidad de versión).

**Flujo de `getById` (secuencia):**

```
UI (PacienteDetail)
  └─> usePacientes / repository.getById(id)
        ├─> supabase.schema('pacientes').from('paciente').select(embeds).eq(id).maybeSingle()
        │     └─> RLS: modulos.tiene_permiso('pacientes','read') en cada tabla del embed
        │           ├── permitido      -> row | null
        │           └── denegado       -> row = null  (RLS filtra, NO devuelve error)
        ├─> si row === null  -> return null            (contrato: no lanza)
        ├─> supabase.schema('obra_social').from('coberturas_paciente')...  (D3)
        │     └── error/0 filas -> numeroAfiliado.valor = '' (degradación, no lanza)
        └─> ensamblarPaciente(row, coberturaRow) -> Paciente
```

### D3 — El número de afiliado se lee de `obra_social.coberturas_paciente` con degradación explícita ⚠️ CHECKPOINT

El frontend modela `numeroAfiliado: { formato, valor }` en el `Paciente`. En la BD real:
`num_afiliado` está en `obra_social.coberturas_paciente` (schema `obra_social`, policy
`modulos.tiene_permiso('obra_social', …)`) y **`formato` no tiene columna en ningún lado**.

Decisión:
- **`valor`**: se lee de la fila de `coberturas_paciente` del paciente cuyo `obra_social_id` coincide
  con `paciente.obra_social_id`, tomando la de `fecha_desde` más reciente (el docx modela cobertura
  como histórico N; el frontend solo tiene "la actual" — discrepancia ya señalizada en
  `PacienteDetail.tsx`).
- Si esa consulta falla o devuelve 0 filas (típicamente: la cuenta no tiene `obra_social: read`),
  `valor` queda `''` y el repository **no lanza**. La ficha se muestra completa salvo ese campo.
- **`formato`**: sin columna, se resuelve client-side con `DEFAULT_FORMATO_AFILIADO`
  (`'numero-documento'`, ya definido en `formatoAfiliadoOptions.ts`) y sigue siendo editable en el
  formulario. **No se persiste** hasta que IN-01 se cierre con el cliente y el backend agregue la
  columna. Se señaliza con `AvisoModeloDatos`.
- **Escritura**: solo se hace `upsert` sobre `coberturas_paciente` cuando `numeroAfiliado.valor`
  cambió respecto de lo leído. Si RLS lo deniega, el error se traduce a un mensaje accionable
  ("No tenés permiso sobre Obras Sociales para editar el número de afiliado") — nunca se pierde en
  silencio ni se reporta como fallo genérico del guardado del paciente.

*Por qué la degradación en vez de lanzar:* romper toda la ficha de un paciente porque falta un
permiso de **otro** módulo es un fallo desproporcionado; el usuario tiene `pacientes: read`, tiene
derecho a ver la ficha.
*Alternativa descartada:* exigir `obra_social: read` para entrar a Pacientes — cambia el modelo de
permisos que `permisos-modulos-granulares` acaba de cerrar, y no es un pedido de la usuaria.
*Alternativa descartada:* guardar `formato` en un `localStorage` paralelo — inventa una segunda
fuente de verdad para un dato que el cliente todavía no confirmó.

### D4 — Alta multi-tabla atómica vía RPC `pacientes.crear_paciente_completo` (`SECURITY INVOKER`) ✅ RESUELTO

> **Revisión 2026-07-30.** Esta decisión fue reescrita. La versión original resolvía el problema con
> *insert del padre + borrado compensatorio* y dejaba la RPC atómica como follow-up "fuera de alcance
> porque exige migración nueva". La usuaria revisó el trade-off y **confirmó que tiene aval de
> backend para escribir y aplicar una migración nueva dentro de este change**. La compensación por
> borrado queda descartada; se adopta la función atómica. El contexto del problema no cambia.

**El problema (sin cambios).** `create()` escribe en hasta 7 tablas (`paciente`, `clinicos`, `cud`,
`direcciones`, `personas_a_cargo`, `accesorios_pacientes`, más `obra_social.coberturas_paciente`).
PostgREST **no da transacciones entre requests**: cada `insert()` de supabase-js es un request HTTP
independiente que commitea por su cuenta, así que una secuencia de inserts puede quedar cortada a
mitad y dejar una ficha parcial (un paciente sin direcciones, sin CUD, sin personas a cargo).

**La resolución.** `create()` hace **una sola llamada**:

```ts
const { data, error } = await supabase
  .schema('pacientes')
  .rpc('crear_paciente_completo', { p_paciente: toCrearPacientePayload(nuevo) });
```

`pacientes.crear_paciente_completo(p_paciente jsonb) RETURNS uuid` es una función `plpgsql` que hace
los 7 inserts en su cuerpo. PostgREST ejecuta cada `POST /rpc/…` **dentro de una transacción**, así
que el cuerpo entero commitea o hace rollback completo: **no existe estado parcial posible**, ni
siquiera si el proceso muere a mitad. Devuelve el `uuid` generado; el repository hace `getById(id)`
después y devuelve eso — simétrico con `update()` (D5), de modo que lo devuelto siempre es lo que
quedó realmente en la base (defaults, triggers, normalizaciones). Migración:
`supabase/migrations/20260730180000_crear_paciente_completo.sql`.

*Por qué un único argumento `jsonb` y no 12 parámetros:* no acopla la firma PostgREST a la cantidad
de campos (agregar uno más adelante no crea una sobrecarga nueva de función), y deja el armado del
payload como una **función pura** `toCrearPacientePayload(nuevo: NuevoPaciente)` — testeable sin red,
igual que el resto del mapeo (D1).

#### ⚠️ `SECURITY INVOKER`, no `SECURITY DEFINER` — requisito de seguridad duro

La función se declara **`SECURITY INVOKER`**. Es además el default de PostgreSQL para funciones, pero
se escribe explícito para que sea una afirmación revisable en el diff y no un default silencioso.

**Por qué `SECURITY DEFINER` sería una regresión de seguridad inaceptable.** El owner de una función
creada por una migración de Supabase es `postgres`, que es superusuario y **bypassea RLS por
completo**. Con `SECURITY DEFINER`, cualquier usuario autenticado —incluso uno sin ninguna fila en
`modulos.permisos`— podría dar de alta pacientes llamando a `/rpc/crear_paciente_completo`,
saltándose por completo `modulos.tiene_permiso('pacientes','write')`. Es exactamente el vector
"broken access control" que `security-review` marca como crítico, y acá sobre datos de salud de
menores. La función **no debe** convertirse a `DEFINER` bajo ninguna circunstancia; el comentario de
cabecera de la migración y el `COMMENT ON FUNCTION` lo dicen para quien la lea sin este documento.

**Cómo se hace cumplir el permiso, verificado contra `20260724100004_schema_pacientes.sql`.** Con
`INVOKER`, cada `INSERT` del cuerpo pasa por la policy de su propia tabla exactamente igual que si lo
hubiera emitido el cliente:

| Tabla escrita por la función | Policy vigente | Efecto sin permiso |
|---|---|---|
| `pacientes.paciente` | `"Write pacientes" FOR ALL … USING (modulos.tiene_permiso('pacientes','write'))` | `42501` en el primer INSERT → rollback total |
| `pacientes.clinicos`, `.cud`, `.direcciones`, `.personas_a_cargo`, `.accesorios_pacientes` | `"Write …" FOR ALL … USING (modulos.tiene_permiso('pacientes','write'))` | ídem |
| `obra_social.coberturas_paciente` | `"Write coberturas_paciente" FOR ALL … USING (modulos.tiene_permiso('obra_social','write'))` | `42501` → rollback total (ver más abajo) |

Detalle que hace que esto funcione y conviene dejar escrito: las policies son `FOR ALL` **con
`USING` y sin `WITH CHECK`**. PostgreSQL, en ese caso, usa la expresión de `USING` también como check
de `INSERT` — de modo que el gateo de escritura aplica al alta, no solo a lectura/borrado. Si alguien
agregara en el futuro un `WITH CHECK` distinto a esas policies, hay que revisar esta función.

`modulos.tiene_permiso()` sí es `SECURITY DEFINER` (definida en `20260724100001`), y **debe** serlo:
necesita leer `modulos.permisos` de todos los usuarios. Eso no debilita nada acá — sigue resolviendo
contra quien llama, porque filtra por `auth.uid()`, que lee el claim del JWT de la request y no tiene
relación con el owner de ninguna función.

**Compatibilidad de versión de PostgreSQL.** `SECURITY INVOKER` en funciones está soportado en
**todas** las versiones de PostgreSQL en uso (es el default histórico de `CREATE FUNCTION`): no hay
versión mínima que verificar ni riesgo de tener que "bajar" a `DEFINER`, así que **esto no es un
bloqueante**. El requisito de **PG15+** que se suele citar corresponde a `security_invoker = true`
**en vistas**, que es otra cosa y que este change no usa (la alternativa "vista
`pacientes.paciente_completo`" ya había sido descartada en D2). Si alguna vez se implementa esa
vista, ahí sí hay que confirmar antes la versión del Postgres del proyecto —desde el repo no se puede
(no hay `supabase/config.toml` ni credenciales), se lee en el dashboard.

#### Alcance de la atomicidad y la cobertura (`obra_social`)

El INSERT en `obra_social.coberturas_paciente` es **condicional**: solo se ejecuta si el payload trae
un `num_afiliado` no vacío **y** un `obra_social_id`. Consecuencia deliberada:

- Un usuario con `pacientes:write` y **sin** `obra_social:write` da de alta pacientes con total
  normalidad mientras deje el número de afiliado vacío — el módulo `obra_social` ni se toca.
- Si ese mismo usuario completa el número de afiliado, la transacción **entera** hace rollback con
  `42501` y el repository traduce eso al mensaje que nombra Obras Sociales (D3/D7). No queda un
  paciente creado a medias, que es exactamente lo que la compensación por borrado intentaba lograr
  con dos requests y ahora se obtiene sin ventana de inconsistencia.

Esto conserva la semántica que ya tenía D4 en su versión original (fallo de la cobertura ⇒ el
paciente no se crea), pero sin estado intermedio observable.

#### Errores propios de la función

La función define códigos en la **clase `45`** (libre en PostgreSQL, no colisiona con ninguna clase
del catálogo), que `mapearErrorPaciente` traduce (D7):

| Código | Cuándo | Mensaje de UI |
|---|---|---|
| `45001` | un `AccesorioMovilidad` del payload no existe en el maestro `pacientes.accesorios` | `El accesorio de movilidad «…» no está cargado en el sistema. Pedí que lo agreguen al catálogo.` |
| `45002` | payload malformado (no es un objeto JSON) | `No se pudo guardar el paciente.` (genérico — es un bug del cliente, no del usuario) |

*Nota:* el `SELECT` sobre `pacientes.accesorios` que resuelve `tipo → accesorio_id` también pasa por
RLS, pero `tiene_permiso(_, 'read')` es verdadero para cualquier nivel `read|write|admin`, así que
quien llegó a ejecutar la función (tiene `write`) siempre puede leer el maestro. No hay forma de que
un accesorio existente se reporte como faltante por falta de permiso.

#### Lo que la función NO escribe (coherente con D9)

`paciente.domicilio` (discrepancia #6), `direcciones.numero` (siempre `NULL`, #5),
`direcciones.localidad`/`dias`/`horario` (sin columna, #3 y #4), `cud.vigente` (queda en su default,
#9) y el `formato` del identificador de afiliado (sin columna, #1). La función **no resuelve ninguna
discrepancia**: replica en SQL exactamente lo que el mapeo puro decidió, para que no haya dos
criterios distintos según la capa.

#### Auditoría y rollback

Los triggers `auditoria.log_action()` de cada tabla siguen disparando fila por fila **dentro de la
misma transacción** (RN-GL-02): un alta deja su rastro completo en `auditoria.logs`, o no deja
ninguno. Rollback de la migración:
`DROP FUNCTION IF EXISTS pacientes.crear_paciente_completo(jsonb);` — no crea ni altera tablas,
columnas, policies ni datos, así que revertirla no puede perder información; el frontend queda sin
alta hasta que se revierta también el commit de `create()` (o se reinyecte `mockPacienteRepository`).

*Alternativa descartada (era la decisión original):* insert del padre + `delete().eq('id', …)`
compensatorio apoyado en `ON DELETE CASCADE`. Mantenía el change 100% frontend, pero deja una ventana
real de inconsistencia: si el proceso muere entre el fallo de la hija y el DELETE, o si el propio
DELETE es rechazado, queda una ficha huérfana en la base y lo único que se puede hacer es lanzar un
error que nombre el `id`. Descartada ahora que hay aval para migrar.
*Alternativa descartada:* Edge Function como en `SupabaseCuentaRepository` — ahí el motivo era
privilegio (`service_role` para crear usuarios en `auth`), que acá no existe; meter una Edge Function
sin necesidad de privilegio agrega superficie de ataque y latencia gratis, y encima obligaría a
reimplementar el gateo de permisos a mano en vez de heredarlo de RLS.

### D5 — `update()` es un diff parcial, tabla por tabla, y relee al final

`ActualizacionPaciente` es `Partial<Omit<Paciente,'id'>>`. Decisión: **solo se escribe la tabla cuya
clave está presente en `data`**. `data.cud === undefined` ⇒ no se toca `pacientes.cud`;
`data.cud === null` ⇒ se borran las filas de CUD del paciente. Para las colecciones
(`direcciones`, `personasACargo`, `accesorioMovilidad`) la semántica es **reemplazo del conjunto**:
se calcula el diff contra lo leído (insert de nuevas, update de existentes por `id`, delete de las
que ya no están), preservando los `id` de las que sobreviven — porque `paciente-direcciones` exige
keys estables y `hojas-de-ruta` referencia direcciones por `id` con `ON DELETE RESTRICT`.

Tras escribir, `update()` hace `getById(id)` y devuelve ese resultado; si vuelve `null`, lanza. Así
lo devuelto es siempre lo que quedó realmente en la BD (defaults, triggers, normalizaciones), no un
merge optimista como hace el mock.

*Por qué el diff y no "borrar todo e insertar de nuevo":* `pacientes.recorridos` referencia
`direcciones.id` con `ON DELETE RESTRICT` — borrar en masa reventaría cualquier paciente con
recorridos cargados, y además rompería los ids estables.

### D6 — Se conserva `usePacientes` tal cual: sin TanStack Query ⚠️ CHECKPOINT

`react-best-practices` desaconseja `useEffect` para fetching, y `usePacientes` hace exactamente eso.
Aun así: **no se cambia en este change**. La convención vigente del repo es hook artesanal
(`usePacientes`, `useObrasSociales`, `useVehiculos`, …, todos con el mismo molde) y no hay ninguna
librería de data-fetching en `package.json`. Introducirla acá significaría tocar 9 hooks y ~40
componentes en un change cuyo objetivo declarado es "solo cambia el composition root".

*Registrado como follow-up separado*: si se adopta TanStack Query, que sea un change transversal
propio, después de que los 9 módulos estén integrados y se sepa qué patrones de invalidación hacen
falta. Este change deja `usePacientes` intacto justamente para que ese refactor sea posible sin
deshacer nada.

### D7 — Traducción de errores: PostgREST → `Error` con mensaje de UI

`usePacientes` hace `err instanceof Error ? err.message : 'Ocurrió un error inesperado.'` y lo
pinta. Entonces el repository **siempre** lanza `Error` con `.message` en castellano, listo para
mostrar. Mapeo (misma forma que `mapearErrorEdgeFunction` de `SupabaseCuentaRepository`):

| Señal de PostgREST | Mensaje |
|---|---|
| `code === '23505'` sobre `dni` | `Ya existe un paciente con el DNI «…».` |
| `code === '23503'` (FK, ej. obra social borrada) | `La obra social seleccionada ya no existe.` |
| `code === '23503'` en delete de dirección (RESTRICT) | `No se puede eliminar la dirección: hay recorridos que la usan.` |
| `code === '42501'` / `PGRST301` (RLS deniega write) | `No tenés permiso para modificar pacientes.` |
| `code === '42501'` en la RPC de alta **con** número de afiliado cargado (D4) | `No tenés permiso sobre Obras Sociales para guardar el número de afiliado. El paciente no se creó.` |
| `code === '45001'` (accesorio ausente del maestro, RPC de D4) | `El accesorio de movilidad «…» no está cargado en el sistema. Pedí que lo agreguen al catálogo.` |
| `code === '45002'` (payload de la RPC malformado, D4) | `No se pudo guardar el paciente.` (genérico: es un bug del cliente) |
| `PGRST202` (la función RPC no existe → migración no aplicada) | `El alta de pacientes no está habilitada en el servidor todavía.` |
| `PGRST106` (schema no expuesto) | `El módulo de Pacientes no está habilitado en el servidor.` |
| cualquier otro `error` | `No se pudo cargar/guardar el paciente.` según la operación |
| `getById` sin fila | **no lanza** → `null` (contrato explícito de la interfaz) |
| `update` de un id inexistente | lanza `No existe un paciente con id "…".` (idéntico al mock) |

*Por qué mensajes fijos y no el `error.message` crudo de Postgres:* filtra nombres de tablas y
columnas hacia la UI (información innecesaria para el usuario) y evita textos en inglés.

**Nota de seguridad (`security-review`, broken access control).** El gateo de escritura de la UI
(`usePuedeEscribir` / `<CamposSoloLectura>`) es client-side y **bypassable**. La defensa real es la
policy `FOR ALL USING (modulos.tiene_permiso('pacientes','write'))`. Este change **no la duplica ni
la reimplementa**: se limita a traducir su rechazo a un mensaje legible, y los tests verifican que
un rechazo de RLS produce un error visible en vez de un "guardado" fantasma.

### D8 — Tests: mapeo puro exhaustivo + repository contra un fake tipado del cliente

Dos capas, siguiendo el precedente de `SupabaseCuentaRepository.test.ts`:
1. `pacienteMapping.test.ts` — funciones puras, sin mocks. Cubre cada discrepancia (nulls, JSONB,
   N:N vacía, cobertura ausente, `numero` de dirección, etc.).
2. `SupabasePacienteRepository.test.ts` — `vi.mock('../supabaseClient')` con un fake tipado a mano
   (interfaces propias, cero `any`) del subconjunto usado: `schema().from().select().eq()
   .maybeSingle()/.order()`, `.schema().rpc()`, `.update().eq()`, `.delete().eq()`, `.upsert()`.
   Cubre: happy path, `getById` → `null`, cada rama del mapeo de errores de D7 (incluidos `45001`,
   `45002` y `PGRST202` de la RPC), la degradación de D3, y el diff parcial de D5. Para `create()`
   se verifica además que se emite **una sola** llamada `.rpc('crear_paciente_completo', …)` y
   **ningún** `.insert()` sobre las tablas hijas — el fake falla el test si alguien reintroduce la
   secuencia de inserts.

**Tercera capa — la función SQL en sí (nueva con D4).** El repo **no tiene** ningún harness para
testear funciones de Postgres: no hay pgTAP, no hay `supabase/config.toml`, no hay CI con Docker, y
el precedente explícito de `C-02` (`design.md` §Testing, "no pgTAP or automated DB integration
harness exists in this repo yet … introducing one is out of scope") es **verificación manual contra
el proyecto real**. Este change sigue ese precedente: la atomicidad y el gateo por RLS de
`crear_paciente_completo` se verifican con un checklist manual en el SQL editor con tres cuentas
reales (ver §Migration Plan), no con tests automatizados. **Decisión pendiente, no de este change:**
si montar pgTAP + `supabase start` antes del segundo change de integración, para no repetir esta
verificación manual nueve veces (ya estaba en §Open Questions y ahora tiene un caso concreto).

Se agrega además una aserción de código fuente vía `import … from './SupabasePacienteRepository.ts?raw'`
(patrón ya usado en `SupabaseCuentaRepository.test.ts`) que verifica que el archivo **no** contiene
`service_role` ni `any`.

*Alternativa descartada:* tests de integración contra un Supabase local (`supabase start`). El repo
no tiene `supabase/config.toml` ni CI con Docker; sería infraestructura nueva para este change. Se
deja anotado como pregunta abierta.

### D9 — Las 11 discrepancias se documentan, no se resuelven

Inventario `Paciente` (frontend) ↔ `20260724100004_schema_pacientes.sql`:

| # | Campo frontend | Columna real | Discrepancia | Resolución en este change |
|---|---|---|---|---|
| 1 | `numeroAfiliado.formato` | — | sin columna (IN-01 abierta) | default client-side editable, no se persiste; cartel |
| 2 | `numeroAfiliado.valor` | `obra_social.coberturas_paciente.num_afiliado` | otro schema, gateado por el módulo `obra_social` | lectura degradable (D3); cartel |
| 3 | `Direccion.localidad` | — | sin columna | no se persiste; cartel |
| 4 | `Direccion.dias` / `.horario` | `pacientes.recorridos.dia_semana` / `.hora` | otra tabla, gateada por `hojas_de_ruta` | no se persisten desde Pacientes; cartel |
| 5 | — | `pacientes.direcciones.numero` | columna sin campo frontend | se concatena a `calle` al leer; al escribir va `null` (no se inventa un parseo de altura); cartel |
| 6 | — | `pacientes.paciente.domicilio` | columna suelta que duplica `direcciones` | se lee para no perderla, no se escribe; cartel |
| 7 | `diagnostico: string` | `clinicos.diagnostico JSONB` | tipo distinto | se lee `string`/`{ texto }`/`null` y se normaliza a `string`; se escribe como JSON string; cartel |
| 8 | `amparoJudicialAclaracion` | — | sin columna | no se persiste; cartel |
| 9 | `cud: Cud \| null` | `pacientes.cud` 1:N + `vigente` | cardinalidad + derivado-vs-persistido | se usa la fila de `vencimiento` más reciente; `vigente` se ignora (ya hay cartel sobre esto) |
| 10 | `fechaNacimiento`, `cuilTitular`, `PersonaACargo.dni` requeridos | columnas NULLables | nullabilidad invertida | `null` → `''` al leer; cartel agrupado |
| 11 | `accesorioMovilidad: AccesorioMovilidad[]` (unión cerrada) | `pacientes.accesorios.tipo TEXT` libre + N:N | tipo abierto vs. cerrado, y la tabla maestra puede estar vacía | se mapean los `tipo` conocidos, los desconocidos se descartan con cartel; escribir un accesorio inexistente en el maestro lanza error accionable |

Cada una va a `knowledge-base/04_modelo_de_datos.md` §Discrepancias (bloque nuevo "Pacientes vs.
esquema real de `C-05`"), a `CHANGES.md` §`C-05` como bullet ⚠️, y a un `AvisoModeloDatos` en la
pantalla donde se nota (agrupados en `PacienteDetail.tsx`; el de direcciones en
`DireccionesEditor.tsx`). Ninguna se resuelve unilateralmente — quedan para confirmar con el cliente
o con quien mantiene el docx.

**Addendum (2026-07-31, posterior al cierre de esta fase del change — actualizado dos veces el mismo
día).** La discrepancia #1 (`numeroAfiliado.formato`, sin columna, editable a mano) dejó de ser una
pregunta abierta, con una vuelta intermedia:

1. Primero se decidió (propose de `integracion-obra-social`) derivar el formato de la obra social,
   vía una columna nueva `obra_social.formato_identificador_afiliado` (D12).
2. Al aplicar ese change se encontró que backend **ya había resuelto esto antes, y al revés**:
   `obra_social.coberturas_paciente.formato_afiliado` (enum, `NOT NULL`, sin default) **ya existe**
   — el formato vive por cobertura (paciente↔obra social), no por obra social en general. D12 quedó
   revertida (ver `integracion-obra-social/design.md`, bloque "❌ D12 REVERTIDA"); la usuaria confirmó
   dejar la realidad ya construida.

**Lo que esto significa para este change.** No hace falta esperar ninguna columna nueva — ya existe.
El trabajo real, en `tasks.md` §8 (reescrita), es: (a) un **bug encontrado durante el apply de
`integracion-obra-social`**, ajeno a ese change pero que vive acá: `crear_paciente_completo` no
completa `formato_afiliado` en su INSERT (columna `NOT NULL` sin default) — **cualquier alta de
paciente con número de afiliado falla hoy con `23502`**; y (b) cablear el frontend para leer/escribir
esa columna en vez de mantener el formato solo client-side. No se reabre el resto de esta fase (ya
implementada y pendiente de review de Enzo) para este cambio puntual — pero el bug de `23502` es
más urgente que una task de seguimiento común: bloquea el alta real de pacientes con obra social.

---

## Risks / Trade-offs

- **[El schema `pacientes` no está expuesto en el Data API]** → sin `supabase/config.toml` en el repo,
  *Exposed schemas* se configura a mano en el dashboard (así se hizo con `usuarios` y `modulos`).
  Mitigación: es la **primera tarea** del change, se verifica con una consulta real antes de escribir
  el repository, y `PGRST106` tiene su propio mensaje de error (D7) para que el síntoma sea legible
  en vez de un error críptico.
- **[Alta parcial por falta de transacción]** → **eliminado como riesgo** por D4: el alta es un único
  `POST /rpc/crear_paciente_completo`, que PostgREST corre dentro de una transacción. No hay estado
  parcial posible. Riesgo residual nuevo, distinto: ver los dos ítems siguientes.
- **[La migración de D4 no se aplica y el alta queda rota]** → el frontend pasa a depender de una
  función que solo existe si la usuaria corrió `supabase db push`. Si no está, PostgREST responde
  `PGRST202`. Mitigación: la tarea de aplicar la migración es **bloqueante** de la de cablear
  `PacientesRoute.tsx` (orden explícito en `tasks.md`), y `PGRST202` tiene su propio mensaje en D7
  para que el síntoma sea legible en vez de un error críptico.
- **[Alguien convierte la función a `SECURITY DEFINER`]** → sería un bypass total del gateo por
  módulo (cualquier autenticado podría crear pacientes). Es el riesgo de seguridad más serio que
  introduce este change. Mitigación en tres capas: la decisión escrita en D4, el bloque `⚠️⚠️` en la
  cabecera de la migración, y el `COMMENT ON FUNCTION` que queda en la base y se ve desde el
  dashboard. Verificación manual explícita en el §Migration Plan (cuenta sin `pacientes:write` que
  llama la RPC directamente y debe recibir `42501`).
- **[Un usuario sin `obra_social: read` cree que el paciente no tiene afiliado]** → el campo se
  muestra vacío **con cartel**, no en blanco silencioso (D3).
- **[Pérdida de datos al guardar campos sin columna]** → `localidad`, `dias`, `horario`,
  `amparoJudicialAclaracion` y `formato` se ven en pantalla pero no sobreviven a un reload. Es el
  riesgo más engañoso del change. Mitigación: `AvisoModeloDatos` explícito en cada sección afectada
  diciendo *qué no se guarda*, y bullets en KB/`CHANGES.md` para que el backend agregue las columnas.
- **[Regresión en los ~1272 tests existentes]** → safety net obligatorio: correr
  `cd frontend && npx vitest run` **antes** de tocar cualquier archivo existente y registrar el
  baseline; los tests de la feature que hoy asumen el mock inyectado deben seguir pasando con el
  doble, no con Supabase.
- **[El fake del query builder se desincroniza de supabase-js]** → tests verdes contra una API que
  cambió. Mitigación: consultar `https://supabase.com/changelog.md` antes de implementar (regla de
  la skill `supabase`) y mantener el fake al mínimo subconjunto usado.
- **[Sobre-ingeniería del diff de colecciones (D5)]** → es la parte más compleja del change.
  Trade-off aceptado conscientemente: la alternativa simple (borrar e insertar) rompe
  `ON DELETE RESTRICT` de `recorridos` y los ids estables que la UI necesita como keys.

---

## Migration Plan

1. Verificar/exponer el schema `pacientes` en el Data API del proyecto Supabase (y `obra_social`,
   necesario para D3). Confirmar con una consulta real autenticada.
2. Confirmar que la tabla maestra `pacientes.accesorios` tiene las 5 filas de la unión
   `AccesorioMovilidad`; si está vacía, es un dato semilla que debe cargar backend (no se agrega
   migración desde este change — se reporta).
3. **Aplicar la migración de D4** (`20260730180000_crear_paciente_completo.sql`) con
   `supabase db push` contra el proyecto real. **La corre la usuaria, no el agente**: el sandbox no
   tiene Docker ni credenciales del proyecto (mismo bloqueo que la tarea 2.7 de
   `permisos-modulos-granulares`). Antes de commitearla, correr `supabase db advisors`. Este paso
   **bloquea** el paso 5.
4. Verificación manual de la función en el SQL editor / vía PostgREST, con tres cuentas reales:
   1. **`pacientes: write`** → la RPC crea el paciente y todas sus hijas; `select` posterior las ve.
   2. **`pacientes: read` (sin `write`)** → la RPC falla con `42501` y **cero filas** quedan en
      `pacientes.paciente`. Esta es la prueba de que `SECURITY INVOKER` está haciendo su trabajo: si
      alguna vez pasa a `DEFINER`, este caso empieza a crear el paciente y el test manual lo detecta.
   3. **`pacientes: write` sin `obra_social: write`, con `num_afiliado` cargado** → `42501` y
      **ningún** paciente creado (rollback total, D4).
   4. Forzar un fallo a mitad (ej. un accesorio inexistente en el maestro) → `45001` y **ninguna**
      fila escrita en ninguna de las 7 tablas.
   5. `select prosecdef from pg_proc where proname = 'crear_paciente_completo'` → debe devolver
      `false`.
5. Implementar `pacienteMapping.ts` (incluida `toCrearPacientePayload`) y
   `SupabasePacienteRepository.ts` por TDD estricto (nada toca producción hasta acá).
6. Cambiar `PacientesRoute.tsx` — el corte real. A partir de este commit la pantalla usa datos
   reales.
7. Documentar las discrepancias (KB + `CHANGES.md`) y sumar los `AvisoModeloDatos`.
8. Verificación manual en navegador con una cuenta `pacientes: read` y otra `pacientes: write`, más
   una tercera sin `obra_social: read` para ejercitar D3.
9. Actualizar `ROADMAP-FRONTEND.md` §FE-8.

**Rollback**: revertir el commit del paso 6 (un import y una prop en `PacientesRoute.tsx`). La app
vuelve al mock al instante y los archivos de los pasos 5 y 7 quedan inertes. La migración del paso 3
**no hace falta revertirla** para volver atrás: una función que nadie llama es inerte. Si aun así se
quiere limpiar, `DROP FUNCTION IF EXISTS pacientes.crear_paciente_completo(jsonb);` — no crea ni
altera tablas, columnas, policies ni datos, así que no hay nada que perder. Ningún dato de producción
se transforma en este change.

---

## Open Questions

- **IN-01 (identificador de afiliado)** sigue abierta, y ahora con un hueco de esquema concreto:
  `coberturas_paciente` tiene `num_afiliado TEXT` y **ninguna** columna de formato. Hasta que el
  cliente confirme el formato por obra social, el `formato` no se persiste. **¿El backend agrega
  `coberturas_paciente.formato_afiliado`, o el formato se deriva de la obra social
  (`obra_social.identificadorOrigen`)?** No se decide acá.
- **¿La cobertura es histórica o actual?** El docx/migración modelan N coberturas con
  `fecha_desde`/`fecha_hasta`; el frontend modela una sola, actual. Este change toma la más reciente.
  ¿Se construye la UI de historial de coberturas (change propio) o se colapsa el modelo?
- **¿`pacientes.direcciones` va a recibir `localidad`?** Sin ella, la dirección no es geocodificable
  de forma confiable para el mapa de Hojas de Ruta (FE-5).
- **¿`paciente.domicilio` es legacy o canónico?** Coexiste con la tabla `direcciones`. Si es legacy,
  debería marcarse como deprecada; si es canónico, `direcciones` debería derivar de él.
- **¿Se monta un Supabase local (o pgTAP) para tests de integración?** Hoy no hay `config.toml`, ni
  pgTAP, ni CI con Docker, y `C-02` ya sentó el precedente de verificar la base a mano. Con la
  función de D4 el costo de no tenerlo se vuelve concreto: la atomicidad y el gateo por RLS de
  `crear_paciente_completo` **solo** se pueden verificar manualmente. Decidirlo antes del segundo
  change de integración, para no repetir el fake —y ahora también el checklist SQL— nueve veces.
- **¿Se indexan las FK `paciente_id` de las tablas hijas?** `20260724100004_schema_pacientes.sql` no
  crea índices sobre `cud.paciente_id`, `clinicos.paciente_id`, `direcciones.paciente_id`,
  `personas_a_cargo.paciente_id` ni `accesorios_pacientes.paciente_id`, y los embeds de D2 los usan
  en cada listado. No se agregan acá (este change solo suma una función, no toca tablas), pero queda
  reportado para backend.
- **Drift preexistente detectado (no se corrige acá):** `openspec/specs/paciente-direcciones/spec.md`
  dice que cada dirección lleva su `tramo` (`ida | vuelta`), pero `shared/types/paciente.ts` movió el
  tramo a `ParadaRecorrido` en `hojas-de-ruta-ui`. El spec principal quedó desactualizado respecto
  del código. Reportado para un change de sincronización de specs.
