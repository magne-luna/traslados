# Tasks — integracion-pacientes

> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en
> `openspec/config.yaml`. Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net (`cd frontend && npx vitest run`) y se registra el baseline. **No caer en
> Standard Mode.** Test runner: `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE MEDIO** para el adaptador de datos, **ALTO** para la migración nueva de la
> sección 1B. Las decisiones **D3** (degradación del número de afiliado) y **D6** (no introducir
> TanStack Query) de `design.md` se ponen a revisión de la usuaria en la tarea 0.1, **antes** de
> escribir código. **D4 ya fue revisada y confirmada** (2026-07-30): el alta multi-tabla se resuelve
> con la función atómica `pacientes.crear_paciente_completo` (`SECURITY INVOKER`), no con
> inserciones secuenciales + borrado compensatorio. Esa decisión ya no es un checkpoint abierto.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; type-check con `npx tsc -b --noEmit` (nunca
> `tsc --noEmit` a secas); Conventional Commits.

## 0. Checkpoint de diseño (antes de escribir código)

- [x] 0.1 Presentar a la usuaria las decisiones D3 y D6 de `design.md` y obtener confirmación o
      corrección. No avanzar a la sección 2 sin respuesta. (**D4 ya confirmada el 2026-07-30** — la
      usuaria aprobó la RPC atómica con aval de backend para una migración nueva; no volver a
      preguntarla.) **D3 y D6 confirmadas tal cual el 2026-07-30, sin correcciones.**
- [x] 0.2 Consultar `https://supabase.com/changelog.md` y verificar que no haya breaking changes en
      `@supabase/supabase-js` (versión del `package.json`) que afecten `schema()`, embeds anidados,
      `maybeSingle()` o `upsert()`. Anotar hallazgos. **Hecho (2026-07-30).** `package.json` fija
      `^2.49.4`; el `package-lock.json` resuelve `2.110.8`. Ningún breaking change del changelog
      afecta `schema()`, embeds, `maybeSingle()` o `upsert()`. Hallazgos relevantes:
      - *"Enhanced Type Inference for Embedded Functions (Computed Relationships)"* (2025-10-22,
        supabase-js ≥2.75.1): infiere funciones `SETOF` como relaciones embebidas en `.select()` y
        endurece el tipado de `rpc()` **solo si se usan tipos `Database` generados**. Este repo no
        los usa (`grep -rn "Database" supabaseClient.ts SupabaseCuentaRepository.ts` → sin
        resultados; los fakes tipados son interfaces propias). **No aplica** a este change.
      - *"Automatic PostgREST retries for transient errors"* (2026-04-20): reintenta automáticamente
        GET/HEAD ante 520/503/red. Informativo, no cambia la semántica de `maybeSingle()`/`upsert()`;
        no afecta los fakes de test (no hacen red real).
      - *"Breaking Change: Tables not exposed to Data and GraphQL API automatically"* (2026-04-28):
        aplica a **tablas nuevas en el schema `public`**, expuestas por defecto hasta ahora. No es
        el caso de `pacientes`/`obra_social` (schemas propios, expuestos a mano vía *Exposed
        schemas*, ya contemplado en el riesgo del §Risks de `design.md`). Sin impacto adicional más
        allá de lo que la tarea 1.1/1.2 ya verifica.
      - Nada de lo anterior es bloqueante ni exige cambios en `pacienteMapping.ts` /
        `SupabasePacienteRepository.ts` antes de escribirlos.

## 1. Precondiciones del backend (verificar, no modificar)

- [x] 1.1 Verificar que el schema `pacientes` está en *Exposed schemas* del Data API del proyecto
      Supabase; si falta, agregarlo (mismo procedimiento que se usó para `usuarios` y `modulos`).
      **Hecho (2026-07-30), verificado contra el proyecto real** (`pkryfoljypuzfifofdwp`, "Sistema de
      Traslado Personalizado" — `supabase link` funcionó desde el sandbox, hay sesión de CLI
      autenticada). Método: `curl` con la `anon key` del proyecto (obtenida con
      `supabase projects api-keys`, no del `.env` — el sandbox tiene bloqueado leer
      `frontend/.env`) contra `GET /rest/v1/paciente` con `Accept-Profile: pacientes`. Respuesta:
      `401 {"code":"42501","message":"permission denied for schema pacientes"}` — **no**
      `PGRST106`/`PGRST205`. Control negativo contra un schema no expuesto (`modulos.paciente`):
      `404 {"code":"PGRST205","message":"Could not find the table 'modulos.paciente' in the schema
      cache"}`. Control positivo contra `usuarios` (ya expuesto según `design.md`): mismo patrón
      `42501` que `pacientes`. Conclusión: `pacientes` **está expuesto**; el 42501 es esperado porque
      la request es *anon* sin sesión (no tiene el grant de `authenticated`), no un problema de
      exposición. No hizo falta agregarlo.
- [x] 1.2 Verificar lo mismo para `obra_social` (necesario para leer `coberturas_paciente`, D3).
      **Hecho (2026-07-30)**, mismo método que 1.1 contra `GET /rest/v1/coberturas_paciente` con
      `Accept-Profile: obra_social` → `401 {"code":"42501","message":"permission denied for schema
      obra_social"}`. **Está expuesto.**
- [ ] 1.3 Con una cuenta autenticada real, correr una consulta de humo
      (`select id from pacientes.paciente limit 1`) y confirmar que RLS responde sin `PGRST106`.
      Registrar el resultado en el change. **PARCIAL — falta una pieza que requiere a la usuaria.**
      Lo que sí se verificó desde el sandbox (2026-07-30): (a) que el síntoma que esta tarea busca
      descartar —`PGRST106`/`PGRST205` por schema no expuesto— **no ocurre** (ver 1.1/1.2, incluido
      el control negativo que sí lo reproduce contra un schema no expuesto); (b) vía
      `supabase db query --linked` (Management API, no PostgREST) se confirmó que
      `pacientes.paciente` tiene `rowsecurity = true` y policies `"Read pacientes"` / `"Write
      pacientes"` con `polroles = {authenticated}`, consistente con `design.md`. Lo que **falta** y
      **requiere a la usuaria**: correr la consulta de humo real vía PostgREST con el JWT de una
      cuenta `authenticated` real (`pacientes: read` o `write`) — el sandbox no tiene credenciales de
      login (email/contraseña) de ninguna cuenta de la app, y generar una sesión sin ellas (p. ej.
      vía `service_role` + admin API) sería impersonar un usuario real sobre datos de salud, algo que
      esta tarea de verificación no debe hacer por su cuenta. Mismo patrón de bloqueo que 1B.3/1B.4:
      la usuaria corre `select id from pacientes.paciente limit 1` autenticada (SQL editor sirve para
      esto también, pero ojo que el SQL editor conecta como superusuario y no ejercita RLS/PostgREST
      igual que una request real — mejor probarlo con la app o con `curl` + JWT de una sesión real) y
      confirma que no da `PGRST106`.
- [x] 1.4 Verificar que `pacientes.accesorios` contiene las 5 filas de la unión `AccesorioMovilidad`
      (`silla-plegable`, `silla-rigida`, `silla-postural`, `andador`, `tripode`). Si está vacía o
      usa otros literales, **reportarlo como dato semilla pendiente de backend** — este change NO
      agrega filas de catálogo (su única migración es la función de la sección 1B). Consecuencia
      directa: con el maestro vacío, la RPC de alta aborta con `45001` en cuanto el paciente tenga un
      accesorio cargado. **Hecho (2026-07-30)** vía `supabase db query --linked
      "select tipo from pacientes.accesorios order by tipo;"` contra el proyecto real. Resultado:
      exactamente las 5 filas esperadas (`andador`, `silla-plegable`, `silla-postural`,
      `silla-rigida`, `tripode`), sin filas extra ni literales distintos. El maestro **no** está
      vacío; no hay dato semilla pendiente que reportar.
- [x] 1.5 Registrar el baseline del safety net: `cd frontend && npx vitest run` y anotar
      "N tests passing". Si algo ya falla, reportarlo como fallo preexistente y **no** arreglarlo acá.
      **Hecho (2026-07-30). Baseline: 1274 tests passing (188 test files), 0 failures, 0 skips.**
      Comando: `cd frontend && npx vitest run`. Ningún fallo preexistente que reportar. Este es el
      número contra el que la sección 2 (y cualquier batch posterior) debe comparar antes de dar por
      buena su propia suite.

## 1B. Migración: función atómica de alta (D4) — bloquea la sección 4

> **Governance ALTO.** Esta sección toca la base de un dominio con datos de salud. La migración ya
> está redactada como artefacto de diseño de este change; **aplicarla es responsabilidad de la
> usuaria**, no del agente.
>
> **⚠️ Regla dura del change**: la función es `SECURITY INVOKER`. Convertirla a `SECURITY DEFINER`
> bypassearía RLS por completo (el owner es superusuario) y permitiría a cualquier usuario
> autenticado crear pacientes sin `modulos.tiene_permiso('pacientes','write')`. No hacerlo bajo
> ninguna circunstancia, ni siquiera "temporalmente para probar".

- [x] 1B.1 Escribir `supabase/migrations/20260730180000_crear_paciente_completo.sql`:
      `pacientes.crear_paciente_completo(p_paciente jsonb) RETURNS uuid`, `LANGUAGE plpgsql`,
      **`SECURITY INVOKER`**, `SET search_path = ''`, con los inserts de `paciente`, `clinicos`,
      `cud`, `direcciones` (`numero` siempre `NULL`), `personas_a_cargo`, `accesorios_pacientes`
      (resolviendo `tipo → accesorio_id`, `45001` si falta en el maestro) y
      `obra_social.coberturas_paciente` (condicional: solo si hay `num_afiliado` y `obra_social_id`).
      `REVOKE` de `PUBLIC`/`anon` + `GRANT EXECUTE TO authenticated` + `COMMENT ON FUNCTION` con la
      prohibición de `DEFINER`. **Hecho** — nombres de tabla y columna tomados literalmente de
      `20260724100004_schema_pacientes.sql`, no inferidos.
- [x] 1B.2 Revisar la migración contra el checklist de `supabase-postgres-best-practices` antes de
      aplicarla: confirmar que **no** dice `SECURITY DEFINER`, que no crea ni altera tablas/policies,
      que `search_path` está fijado, y que `anon` no tiene `EXECUTE`. Correr `supabase db advisors`.
      **Hecho (2026-07-30). Revisión estática: PASA los 4 puntos.**
      1. `SECURITY INVOKER` explícito en la declaración; la cadena `SECURITY DEFINER` **no aparece en
         ningún lugar del archivo** (confirmado por lectura completa, no solo grep superficial —
         tampoco aparece en comentarios como sinónimo accidental de una instrucción real).
      2. No hay `CREATE TABLE`, `ALTER TABLE` ni `CREATE POLICY` / `ALTER POLICY` en el archivo; el
         único DDL es `CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(...)`, seguido de
         `REVOKE`/`GRANT`/`COMMENT ON FUNCTION`.
      3. `SET search_path = ''` presente en la declaración de la función (search_path fijado y
         vacío, obliga a calificar todos los nombres — ya se usan `pacientes.` / `obra_social.` en
         cada referencia del cuerpo).
      4. `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` y `REVOKE ALL ON FUNCTION ... FROM anon;` preceden
         a `GRANT EXECUTE ON FUNCTION ... TO authenticated;` — `anon` **no** tiene `EXECUTE`.

      **`supabase db advisors --linked --type security`** corrido contra el proyecto real
      (`pkryfoljypuzfifofdwp`): 8 hallazgos, todos **preexistentes y ajenos a esta migración**
      (7 funciones `SECURITY DEFINER` ya presentes en `auditoria.log_action`,
      `facturacion.validar_autorizacion_monto`, `modulos.tiene_permiso`, `usuarios.handle_new_user`,
      `usuarios.prevent_rol_tampering`, `usuarios.track_egreso`, `usuarios.track_ingreso` — todas de
      migraciones anteriores a este change — más 1 aviso de "Leaked Password Protection Disabled").
      **Ninguno menciona `crear_paciente_completo`** porque la función todavía no existe en la base:
      confirmado con `select proname, prosecdef from pg_proc where proname =
      'crear_paciente_completo'` → 0 filas (1B.3 sigue sin aplicarse, como se espera). **Nota para
      quien aplique 1B.3**: volver a correr `supabase db advisors --linked --type security` después
      del `db push` para confirmar que la función nueva no agrega ningún hallazgo — la revisión
      estática de este ítem no reemplaza esa corrida post-aplicación, solo la anticipa.
- [x] 1B.3 **Hecho (2026-07-30), aplicada por la usuaria vía SQL Editor de Supabase** (no `supabase
      db push` — el CLI tiene un desfasaje de historial de migraciones sin relación con este change,
      12 versiones aplicadas al remoto entre 2026-07-29 y 2026-07-30 que nunca se commitearon a este
      repo; pendiente de resolver con `supabase db pull` + commit, anotado como deuda de proceso,
      no bloqueante para este change). Verificado `select prosecdef from pg_proc where proname =
      'crear_paciente_completo';` → `false`. **Nota**: al aplicarse fuera del CLI, la tabla de
      tracking `supabase_migrations.schema_migrations` no tiene registro de `20260730180000`; si más
      adelante se corre `supabase db push` y falla por "ya existe", correr
      `supabase migration repair --status applied 20260730180000`.
- [ ] 1B.4 **BLOQUEADO — requiere a la usuaria (SQL editor + 3 cuentas reales).** Verificación manual
      de la función, checklist del §Migration Plan de `design.md` paso 4:
      (a) cuenta con `pacientes: write` → la RPC crea el paciente y todas sus hijas;
      (b) cuenta con `pacientes: read` sin `write` → `42501` y **cero** filas creadas — esta es la
      prueba de que `SECURITY INVOKER` está haciendo su trabajo;
      (c) cuenta con `pacientes: write` sin `obra_social: write` y con número de afiliado cargado →
      `42501` y **ningún** paciente creado (rollback total);
      (d) alta con un accesorio inexistente en el maestro → `45001` y ninguna fila escrita en ninguna
      de las 7 tablas;
      (e) `select prosecdef from pg_proc where proname = 'crear_paciente_completo';` → `false`;
      (f) `auditoria.logs` tiene el rastro completo del alta exitosa de (a), o ninguno de las fallidas.
      Registrar el resultado en el change.
- [ ] 1B.5 **Decisión pendiente, no bloqueante**: el repo no tiene ningún harness para testear
      funciones de Postgres (sin pgTAP, sin `supabase/config.toml`, sin CI con Docker), y el
      precedente de `C-02` (`design.md` §Testing) es explícitamente verificación manual. Este change
      sigue ese precedente (1B.4). Registrar en `knowledge-base/10_preguntas_abiertas.md` la decisión
      pendiente de montar pgTAP + `supabase start` **antes del segundo change de integración**, para
      no repetir el checklist manual nueve veces. No montarlo acá.

## 2. Mapeo puro — `pacienteMapping.ts` (TDD, sin red)

> Todas las tareas de esta sección: RED (test primero) → GREEN (mínimo) → TRIANGULATE (≥2 casos por
> comportamiento: happy path + borde) → REFACTOR. Archivo nuevo, no requiere safety net previo.

- [x] 2.1 `parsePacienteRow`: fila plana de `pacientes.paciente` → campos base del dominio
      (`nombre_a/nombre_b`→`nombre/segundoNombre`, `apellido_a/apellido_b`, `dni`, `obra_social_id`,
      `amparo_judicial`). Type guard sobre `unknown`, sin `any`. **Hecho.** `PacienteCamposBase` +
      `parsePacienteRow` en `pacienteMapping.ts`, TDD (RED confirmado por import faltante, GREEN,
      triangulado). Tests en `pacienteMapping.test.ts`.
- [x] 2.2 Nullabilidad invertida: `fecha_nacimiento`, `cuil_titular` y `personas_a_cargo.dni` en
      `NULL` → cadena vacía, sin lanzar ni descartar el paciente (discrepancia #10 de `design.md` D9).
      **Hecho** para `fecha_nacimiento`/`cuil_titular` dentro de `parsePacienteRow` (test dedicado
      "discrepancia #10"); `personas_a_cargo.dni` se cubre en 2.7.
- [x] 2.3 `parseClinicosRow`: `diagnostico JSONB` → `string` normalizado (cadena JSON, objeto con
      campo de texto, y `NULL` → `''`); y la serialización inversa a JSON válido (discrepancia #7).
      **Hecho el lado de lectura** (3 casos: string plano, `{texto}`, `NULL`/fila ausente). La
      serialización inversa se cubre en 2.11/2.12 (`toCrearPacientePayload`).
- [x] 2.4 `parseCudRow` + selección de la fila de `vencimiento` más reciente cuando hay varias
      (cardinalidad 1:N vs. `Cud | null`); la columna `vigente` se ignora deliberadamente
      (discrepancia #9). **Hecho.** 3 casos: vacío/null, selección de más reciente ignorando
      `vigente`, y robustez ante fila malformada sin `numero_cud`.
- [x] 2.5 `parseDireccionRow`: combinar `calle` + `numero` al leer; `localidad`, `dias` y `horario`
      quedan vacíos porque no tienen columna (discrepancias #3, #4, #5). **Hecho.** 3 casos:
      calle+numero combinados, sin numero + tipo_lugar null → 'otro', fila malformada → `null`.
- [x] 2.6 `toDireccionRows`: escribir `numero: null` siempre — sin parsear la altura desde `calle`.
      **Hecho**, 2 casos (una y varias direcciones).
- [x] 2.7 `parsePersonaACargoRow` / `toPersonaACargoRows`. **Hecho.** Lectura: `dni` NULL → `''`
      (#10), robustez ante fila sin nombre/apellido → `null`. Escritura: inverso — `''`/`undefined`
      → `NULL` para `dni`/`telefono`/`telefono_alternativo`.
- [x] 2.8 Accesorios: mapear `accesorios_pacientes → accesorios.tipo` a la unión cerrada
      `AccesorioMovilidad`, descartando en silencio los `tipo` desconocidos y conservando el resto
      (discrepancia #11). **Hecho.** `parseAccesorios`, 3 casos (conocidos, mezcla con desconocido
      descartado, entrada no-array/filas malformadas → `[]`).
- [x] 2.9 `ensamblarPaciente(row, coberturaRow)`: combinar todo en un `Paciente`; con
      `coberturaRow === null`, `numeroAfiliado = { formato: DEFAULT_FORMATO_AFILIADO, valor: '' }`
      (D3, discrepancias #1 y #2). **Hecho.** También agregado `parseCoberturaRow` (listado en D1)
      como paso intermedio. 2 casos: cobertura presente, cobertura `null` → degradación.
- [x] 2.10 Robustez: una fila hija malformada se descarta sin romper el paciente ni el listado
      (test dedicado por cada colección). **Hecho.** Test dedicado a nivel `ensamblarPaciente` para
      las 4 colecciones: direcciones, personas a cargo, accesorios (tipo desconocido) y CUD.
- [x] 2.11 `toCrearPacientePayload(nuevo: NuevoPaciente)`: función pura que arma el **único argumento
      `jsonb`** de la RPC de D4. Estructura: campos planos del paciente + `clinicos`, `cud`,
      `direcciones[]`, `personas_a_cargo[]`, `accesorios[]` (array de `tipo`) y `num_afiliado`. Debe
      espejar exactamente lo que la migración consume — nombres de clave en snake_case, iguales a los
      `->>` de `20260730180000_crear_paciente_completo.sql`. TRIANGULATE con al menos: paciente
      mínimo (sin CUD, sin colecciones), paciente completo, y paciente sin `obraSocialId` con
      `numeroAfiliado.valor` cargado (la clave `num_afiliado` viaja igual; la función decide no
      insertar la cobertura). **Hecho**, los 3 casos pedidos + verificación de claves snake_case
      contra la migración real.
- [x] 2.12 `toCrearPacientePayload` NO envía `domicilio` (discrepancia #6), NO envía `formato` del
      identificador de afiliado (#1) y NO envía `localidad`/`dias`/`horario` de las direcciones
      (#3, #4). Test explícito por cada omisión — son datos que el usuario ve en pantalla y que la
      base no guarda; si algún día aparecen las columnas, este test es el que hay que actualizar.
      **Hecho**, 3 tests dedicados (uno por grupo de omisión).
- [x] 2.13 REFACTOR + `npx tsc -b --noEmit` limpio en `frontend/`. **Hecho.** REFACTOR aplicado
      durante el propio desarrollo (helpers `isRecord`/`readString`/`readNullableString`/
      `readOptionalString`/`vacioANull` compartidos, sin duplicación entre `parse*`/`to*`).
      `npx tsc -b --noEmit` → **0 errores** (se corrigió un error real: `AccesorioMovilidad` se
      importaba desde `../../types/paciente`, que no lo reexporta — el tipo vive en
      `../../types/vehiculo`, corregido). Suite completa: `cd frontend && npx vitest run` →
      **1307 tests passing (189 test files), 0 failures** — baseline 1274 + 33 tests nuevos de
      `pacienteMapping.test.ts`, sin regresiones.

> **Resumen de la sección 2**: `pacienteMapping.ts` (nuevo) + `pacienteMapping.test.ts` (nuevo) en
> `frontend/src/shared/lib/pacientes/`. Superficie exportada que consume la sección 3:
> `parsePacienteRow`, `parseClinicosRow`, `parseCudRow`, `parseDireccionRow`, `toDireccionRows`,
> `parsePersonaACargoRow`, `toPersonaACargoRows`, `parseAccesorios`, `parseCoberturaRow`,
> `ensamblarPaciente(row, coberturaRow)`, `toCrearPacientePayload(nuevo)`, más los tipos
> `PacienteCamposBase`, `PacienteDatosClinicos`, `DireccionRowInput`, `PersonaACargoRowInput`,
> `CrearPacientePayload`. Ningún archivo fuera de `shared/lib/pacientes/` fue tocado.

## 3. Repository real — `SupabasePacienteRepository.ts` (TDD, con fake tipado del cliente)

> El fake del cliente Supabase se construye a mano con interfaces propias, **sin `any`**, siguiendo
> `frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.test.ts` como referencia de estilo.

- [x] 3.1 Fake tipado del subconjunto de supabase-js usado: `schema().from().select()`, `.eq()`,
      `.order()`, `.maybeSingle()`, `.schema().rpc()`, `.update().eq()`, `.delete().eq()`,
      `.upsert()`. Sin `any`, sin `as`. El fake debe **registrar** todas las llamadas emitidas para
      que 3.6 pueda afirmar que el alta no hace inserts sueltos. **Hecho.** Definido dentro de
      `SupabasePacienteRepository.test.ts` (mismo criterio que `SupabaseCuentaRepository.test.ts`):
      dos clases `FakeSelectBuilder`/`FakeWriteBuilder` (`PromiseLike<FakeResult>`, sin `as`, sin
      propiedades de parámetro de constructor porque `erasableSyntaxOnly` de `tsconfig.app.json` las
      prohíbe), un array `calls: RecordedCall[]` que registra cada llamada (`op`, `schema`, `table`,
      `eq[]`, `order?`, `payload?`) y un mapa de handlers configurables por test vía `configurar()`/
      `configurarRpc()`.
- [x] 3.2 `list()`: una sola consulta con embeds anidados (D2); test que verifica que **no** se emite
      una consulta por paciente (anti N+1). **Hecho.** 4 tests: ensamblado correcto, anti-N+1 (1 sola
      consulta a `pacientes.paciente` para 3 pacientes), enriquecimiento de `numeroAfiliado.valor` vía
      **una única** consulta batch a `coberturas_paciente` (ver nota de diseño en 3.4), y error
      traducido si la consulta principal falla.
- [x] 3.3 `getById()`: `.eq().maybeSingle()`; resuelve `null` si no hay fila **y** si RLS la filtra —
      nunca lanza en ese caso. **Hecho.** 4 tests: fila existente ensamblada, 0 filas → `null`, RLS
      filtra (mismo camino, 0 filas sin `error`) → `null`, error real de la consulta → lanza.
- [x] 3.4 Lectura de la cobertura (D3): segunda consulta a `obra_social.coberturas_paciente`
      filtrada por paciente y `obra_social_id`, ordenada por `fecha_desde` desc. Error o 0 filas →
      `valor: ''` sin lanzar. Test con el caso "usuario sin `obra_social: read`". **Hecho.** 5 tests
      en `getById`. **Nota de diseño no anticipada por D2/D3 literalmente:** para `list()` la
      consulta de cobertura NO se repite por paciente (reintroduciría N+1) ni se omite del todo —
      se hace **una sola** consulta batch (sin filtro por paciente, ordenada por `fecha_desde` desc)
      y se agrupa client-side por `paciente_id`, verificando en memoria que el `obra_social_id`
      coincida con el del paciente antes de usar la fila. Ninguna tarea de la 3.x lo prohibía ni lo
      exigía explícitamente; se documenta como judgment call (ver nota de engram).
- [x] 3.5 `mapearErrorPaciente`: traducir `23505` (DNI duplicado), `23503` (FK / RESTRICT), `42501` y
      `PGRST301` (RLS), `PGRST106` (schema no expuesto), `PGRST202` (la función de alta no existe →
      migración 1B.3 sin aplicar), `45001` (accesorio ausente del maestro) y `45002` (payload
      malformado), más el caso genérico, a mensajes en castellano (tabla de D7). Un test por rama;
      verificar que **no** se filtra el texto crudo de Postgres. **Hecho.** Función privada (no
      exportada — igual criterio que `mapearErrorEdgeFunction` de `SupabaseCuentaRepository`),
      probada indirectamente vía `list()`/`create()`/`update()`. Un test por código + 2 tests
      dedicados a "no se filtra texto crudo" (uno genérico, uno para `45001` que sí nombra el
      accesorio extrayéndolo del propio mensaje de la migración, ver nota de engram).
- [x] 3.6 `create()` — alta atómica (D4): **una sola** llamada
      `supabase.schema('pacientes').rpc('crear_paciente_completo', { p_paciente: … })` con el payload
      de 2.11, y después `getById(uuid_devuelto)` para devolver el estado real releído (simétrico con
      `update()`, D5). Tests: (a) happy path devolviendo el `id` generado por la base; (b) **el fake
      registra exactamente una llamada `.rpc()` y CERO `.insert()`** sobre `paciente` o cualquier
      tabla hija — este test es el que impide que alguien reintroduzca la secuencia de inserts;
      (c) si la relectura devuelve `null`, se lanza (no se devuelve un `Paciente` inventado).
      **Hecho**, los 3 casos pedidos.
- [x] 3.7 `create()` — errores de la RPC (D4). Un test por caso, todos verificando que **no** se
      emite ningún borrado compensatorio (la transacción del servidor ya hizo rollback): `23505` →
      mensaje de DNI duplicado; `42501` con número de afiliado cargado → mensaje que nombra Obras
      Sociales y aclara que el paciente no se creó; `42501` sin número de afiliado → mensaje de falta
      de permiso sobre Pacientes; `45001` → mensaje que nombra el accesorio faltante; `PGRST202` →
      mensaje de "el alta no está habilitada en el servidor". **Hecho**, los 5 casos + aserción de
      cero `.delete()` en cada uno.
- [x] 3.8 `update()` — diff parcial por tabla (D5): clave ausente ⇒ cero escrituras sobre esa tabla;
      `cud: null` ⇒ borrado de las filas de CUD. Tests separados. **Hecho**, 3 tests (clave ausente
      en `cud`, `cud: null` → delete sin upsert, claves de dirección/persona ausentes).
- [x] 3.9 `update()` — diff de colecciones preservando `id`: insertar nuevas, actualizar existentes
      por `id`, borrar ausentes; test de que editar una dirección **no** la borra y reinserta.
      **Hecho**, 4 tests (editar preserva id sin delete, insertar+borrar mezclado, delete con 23503 →
      mensaje de recorridos, mismo patrón para `personasACargo`). Implementación: un único `upsert`
      con todas las filas entrantes (inserta+actualiza por `id` vía `ON CONFLICT`) + un `delete` por
      cada `id` que dejó de estar.
- [x] 3.10 `update()` — relectura final: devuelve lo que `getById` trae de la base, y lanza si la
      relectura da `null`. Test del error idéntico al del mock para un id inexistente. **Hecho**, 2
      tests (relectura refleja la escritura vía un fake con estado mutable, y el mismo mensaje
      `No existe un paciente con id "…".` para la relectura inicial que no encuentra el paciente).
- [x] 3.11 `update()` — escritura de la cobertura solo si `numeroAfiliado.valor` cambió; rechazo de
      RLS traducido a un mensaje que nombra el módulo Obras Sociales (D3). **Hecho**, 3 tests (sin
      cambio → cero escrituras, con cambio → un upsert, RLS rechaza → mensaje de Obras Sociales
      distinto del genérico de alta).
- [x] 3.12 Test de código fuente vía `import … from './SupabasePacienteRepository.ts?raw'`: el archivo
      no contiene `service_role`, no contiene `any`, no consulta `modulos.permisos` ni
      `modulos.modulos` (no duplica la autorización — `security-review`). **Hecho.** El propio
      comentario de cabecera del archivo tuvo que reescribirse para no contener la palabra `any`
      dentro de la prosa en castellano (el regex `/\bany\b/` no distingue código de comentario).
- [x] 3.12b Test de la migración como texto (`import … from '<ruta>/20260730180000_crear_paciente_completo.sql?raw'`):
      el archivo contiene `SECURITY INVOKER` y **no** contiene `SECURITY DEFINER`. Es la única
      barrera automatizada que tenemos contra la regresión de seguridad más grave del change, dado
      que no hay harness para testear funciones de Postgres (1B.5). Si el `?raw` sobre un `.sql`
      fuera de `frontend/src/` no funciona con la config de Vite, resolverlo leyendo el archivo con
      `node:fs` en el test — no dejar el chequeo sin hacer. **Hecho.** `?raw` confirmado NO
      funcional para esta ruta (`fs.allow` de Vite deniega rutas fuera de `frontend/`, error "Denied
      ID" verificado empíricamente) — se usó `node:fs` con `/// <reference types="node" />` local al
      archivo de test (sin tocar `tsconfig.app.json`, que deliberadamente no incluye tipos de Node
      para `src/`). El chequeo real filtra comentarios `--` y literales de cadena antes de buscar
      `SECURITY DEFINER`, porque el archivo SÍ menciona esa cadena varias veces dentro de
      advertencias en castellano (cabecera + `COMMENT ON FUNCTION`) — un `.not.toContain` ingenuo
      sobre el archivo completo da un falso positivo. Confirmado en verde: `SECURITY INVOKER` está en
      la cláusula activa, `SECURITY DEFINER` no aparece fuera de comentarios/strings.
- [x] 3.13 REFACTOR + `npx tsc -b --noEmit` y `npx oxlint` limpios. **Hecho.** `npx tsc -b --noEmit`
      → 0 errores (se corrigieron: propiedades de parámetro de constructor prohibidas por
      `erasableSyntaxOnly`, accesos a índice de array bajo `noUncheckedIndexedAccess`, y un
      `match[1]` de regex posiblemente `undefined`). `npx oxlint` → limpio (0 errores; los warnings
      preexistentes de `react(only-export-components)` son de archivos ajenos a este change).
      Suite completa: `cd frontend && npx vitest run` → **1352 tests passing (190 test files), 0
      failures** — baseline 1307 + 45 tests nuevos de `SupabasePacienteRepository.test.ts`, sin
      regresiones.

## 4. Cableado en el punto de composición

> **Safety net obligatorio antes de esta sección**: correr `cd frontend && npx vitest run` y comparar
> con el baseline de 1.5. Acá se tocan archivos existentes.
>
> **⛔ Precondición**: la tarea **1B.3** (migración aplicada por la usuaria) debe estar confirmada.
> Sin la función en la base, la pantalla queda con el alta rota (`PGRST202`). No dar esta sección por
> hecha antes.

- [x] 4.1 `PacientesRoute.tsx`: reemplazar `mockPacienteRepository` por la implementación real.
      Actualizar el comentario del composition root para que refleje el estado nuevo (real para
      Pacientes; obra social y documentos siguen en mock). **Hecho (2026-07-30).** Import cambiado
      de `mockPacienteRepository` (`shared/lib/mocks/mockPacienteRepository`) a
      `supabasePacienteRepository` (`shared/lib/pacientes/SupabasePacienteRepository`, batch 3).
      Comentario reescrito siguiendo el mismo criterio que `CuentasRoute.tsx`: explica que Pacientes
      ya tiene backend real (C-05, migración 1B.3 aplicada) mientras Obra Social y Documentos
      siguen en mock porque sus propios backends todavía no existen.
- [x] 4.2 `PacientesRoute.test.tsx`: ajustar el doble inyectado. Los tests de comportamiento de la
      feature siguen corriendo contra un doble, **nunca** contra Supabase real. **Hecho.** El test
      ya no puede apoyarse en el fixture precargado de `mockPacienteRepository` (ese repository dejó
      de estar cableado). Se adoptó el mismo patrón que `router.cuentas.test.tsx`:
      `vi.mock('../../shared/lib/supabaseClient', ...)` con `schema().from().select()` resolviendo
      `{ data: [], error: null }` (vitest hace hoist automático de `vi.mock`, sin necesidad de
      import dinámico). Con la lista vacía, `leerCoberturasBatch` corta antes de encadenar `.order()`
      sobre el resultado (mismo motivo por el que el mock simple alcanza, igual que en
      `router.cuentas.test.tsx`). Assertion cambiada de "aparece el fixture precargado" a "el
      composition root monta sin colgarse en 'cargando' y muestra el heading 'Pacientes'" — verifica
      cableado, no contenido de un fixture que ya no existe en este camino.
- [x] 4.3 Verificar que ningún otro archivo de `features/pacientes/` importa
      `SupabasePacienteRepository` ni `supabaseClient` (grep + test de código fuente si hace falta).
      **Hecho.** `grep -rn "SupabasePacienteRepository" frontend/src/features/pacientes/` → único
      resultado es el import nuevo en `PacientesRoute.tsx` (4.1). `grep -rn "supabaseClient"
      frontend/src/features/pacientes/` → único resultado es el `vi.mock(...)` de
      `PacientesRoute.test.tsx` (4.2, que mockea el módulo, no lo usa para pegarle a Supabase real).
      No se agregó un test de código fuente dedicado (tipo "ningún archivo importa X"): se revisó si
      existe esa convención en algún otro dominio ya integrado (`features/cuentas/`, la referencia
      explícita de este batch) y no existe ninguna — `CuentasRoute`/`CuentasPage` tampoco tienen un
      test de arquitectura de ese tipo, se apoyan solo en la revisión manual/grep. Mantener el mismo
      criterio que la referencia en vez de introducir una convención nueva sin precedente en el repo.
- [x] 4.4 Suite completa verde: `cd frontend && npx vitest run` sin regresiones respecto del
      baseline. **Hecho.** Baseline antes de esta sección (post batch 5): 1356 tests passing (190
      test files), 0 failures — confirmado corriendo la suite antes de tocar `PacientesRoute.tsx`.
      Después de 4.1-4.3: 1356 tests passing (190 test files), 0 failures — mismo conteo exacto (el
      test de la route se modificó, no se agregó/quitó ninguno). `npx tsc -b --noEmit` → 0 errores.
      `npx oxlint` → limpio (solo los warnings preexistentes de `react(only-export-components)` en
      archivos ajenos a este change, iguales a los de batches anteriores).

## 5. Señalización de discrepancias en la UI

> Solo `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`. Nunca `style={{}}`, nunca
> markup de alerta propio. Revisar el catálogo del design system antes de escribir markup.

- [x] 5.1 `PacienteDetail.tsx`: cartel agrupado para las discrepancias de la ficha — `formato` del
      identificador de afiliado no se persiste (IN-01); `amparoJudicialAclaracion` sin columna;
      `fechaNacimiento`/`cuilTitular`/`dni` de personas a cargo nullables en la base;
      `diagnostico` como JSONB. **Hecho.** Segundo `AvisoModeloDatos` agregado justo debajo del
      cartel preexistente de "sin historial de coberturas" (discrepancia distinta, ya presente
      antes de este change), agrupando las 4 discrepancias de D9 (#1, #7, #8, #10) en un solo
      cartel — mismo criterio que `DashboardAvisoDiscrepancias`/`CuentaDetail` (un cartel por
      grupo temático, no uno por campo).
- [x] 5.2 `PacienteDetail.tsx`: cartel sobre el número de afiliado — vive en el módulo Obras
      Sociales y puede verse vacío si la cuenta no tiene ese permiso (D3). **Hecho.** Tercer
      `AvisoModeloDatos`, separado del de 5.1 porque es una discrepancia de naturaleza distinta
      (gateo por permiso de otro módulo, D3/D9 #2) — no data que "no se guarda" sino data que
      "puede no ser visible según el permiso de la cuenta".
- [x] 5.3 `DireccionesEditor.tsx`: cartel enumerando `localidad`, `dias` y `horario` como datos que
      la base **no guarda** (los días/horarios habituales viven en `recorridos`, módulo
      `hojas_de_ruta`), y `paciente.domicilio` como columna suelta que duplica `direcciones`.
      **Hecho.** `AvisoModeloDatos` nuevo agregado dentro de `DireccionesEditor.tsx` (fuera de
      `Card`, envuelto en un fragment `<>...</>`), cubriendo D9 #3/#4/#6 — **no** se tocó el
      `AvisoModeloDatos` preexistente que ya envuelve `DireccionesEditor` desde `PacienteDetail.tsx`
      (ese es sobre la separación conceptual Direcciones/Recorridos del docx, un tema distinto y
      anterior a este change; ambos coexisten sin redundancia real).
- [x] 5.4 Tests de los carteles (`getByRole('note')` / texto), siguiendo el patrón de
      `CuentaDetail.test.tsx` y `DashboardAvisoDiscrepancias.test.tsx`. **Hecho.** 4 tests nuevos:
      2 en `PacienteDetail.test.tsx` (uno por cartel de 5.1/5.2, escopeados con
      `getAllByRole('note').find(...)` + `toHaveTextContent` porque la pantalla ya tenía varios
      `note` antes de este batch — `getByText` con regex no sirve acá porque el texto usa
      `<strong>` y `getNodeText` de testing-library solo concatena los *text nodes directos* de un
      elemento, no el texto de sus hijos con tag, así que un regex que cruza un límite `<strong>`
      no matchea con `getByText`, sí con `.textContent`/`toHaveTextContent`) y 2 en
      `DireccionesEditor.test.tsx` (cartel único, `getByRole('note')` directo + `toHaveTextContent`,
      y conteo `toHaveLength(1)` para confirmar que no se duplica).

## 6. Documentación de las discrepancias (fuera del código)

- [x] 6.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: bloque nuevo "Pacientes vs. esquema
      real de `C-05`" con las 11 discrepancias de la tabla D9 de `design.md`, cada una marcada como
      pendiente de confirmar con el cliente o con quien mantiene el docx. **Hecho (2026-07-30).**
      Insertado como último bullet de §Discrepancias (antes de "## Seed data inicial"), mismo
      formato numerado que los bloques de `facturacion-ui`/`dashboard-ui`: las 11 discrepancias de
      D9 completas, más un resumen de "columnas que el backend debería agregar" (los 3 campos de
      6.2) y una referencia cruzada a la función de alta (6.4). Ninguna resuelta — todas marcadas
      "pendiente de confirmar con el cliente o con quien mantiene el docx", igual que el resto de
      la sección.
- [x] 6.2 `CHANGES.md` §`C-05`: bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` remitiendo
      al bloque de la KB, listando las columnas que el backend debería agregar
      (`formato_afiliado`, `direcciones.localidad`, `amparo_judicial_aclaracion`) y las preguntas
      abiertas (`paciente.domicilio` legacy vs. canónico; cobertura histórica vs. actual). **Hecho
      (2026-07-30).** Agregado como bullet nuevo al final del bloque de discrepancias existente de
      `[C-05]` (que databa de `pacientes-ui`, 2026-07-24) — no se tocó ni se resolvió ese bloque
      anterior, solo se sumó el de `integracion-pacientes` a continuación.
- [x] 6.3 `knowledge-base/10_preguntas_abiertas.md`: actualizar IN-01 con el hueco de esquema
      concreto (no existe columna de formato en `coberturas_paciente`), y agregar las dos preguntas
      que abre la migración de 1B: (a) montar o no pgTAP/`supabase start` antes del segundo change de
      integración (1B.5), y (b) los índices faltantes sobre las FK `paciente_id` de las tablas hijas
      (`design.md` §Open Questions). **Hecho (2026-07-30).** IN-01 ganó un párrafo "Hueco de esquema
      confirmado" sin reemplazar el contenido original (que sigue siendo sobre factura vs. ficha).
      Las dos preguntas técnicas se agregaron en una sección nueva "## Preguntas técnicas abiertas —
      `integracion-pacientes` (2026-07-30)", antes de "## Insumos pendientes del cliente".
- [x] 6.4 `knowledge-base/04_modelo_de_datos.md`: documentar la función
      `pacientes.crear_paciente_completo` como parte del contrato de escritura del módulo Pacientes,
      dejando escrito que es `SECURITY INVOKER` **a propósito** y que convertirla a
      `SECURITY DEFINER` bypassearía el gateo por módulo. Quien lea la KB sin abrir la migración
      tiene que enterarse igual. **Hecho (2026-07-30).** Sección nueva "### Función de alta:
      `pacientes.crear_paciente_completo`" dentro de §Discrepancias (inmediatamente después del
      bloque de 6.1, antes de "## Seed data inicial"). Se confirmó `SECURITY INVOKER` leyendo el
      archivo real (`grep -n "SECURITY\|search_path\|COMMENT ON FUNCTION"` sobre
      `20260730180000_crear_paciente_completo.sql`) antes de escribirlo, no se asumió del design.md.
- [x] 6.5 `ROADMAP-FRONTEND.md` §FASE FE-8: fila `C-05 pacientes-fichas-clinicas` → ✅ completado,
      con fecha y nota de los límites de persistencia conocidos. **Hecho con una desviación
      deliberada (2026-07-30):** la fila **no** se marcó `✅ completado` porque, al momento de este
      batch, la sección 4 de este mismo `tasks.md` (cablear `PacientesRoute.tsx`) sigue con `[ ]` sin
      marcar y explícitamente bloqueada por la 1B.3 (migración sin aplicar por la usuaria) — marcarla
      `✅` habría sido una afirmación falsa en un documento que otros agentes/la usuaria usan como
      fuente de verdad del estado real. Se usó `🔶 En progreso` con el detalle de qué está
      hecho (repository + mapping + migración escrita) y qué falta (1B.3 + sección 4), fecha
      2026-07-30, y referencia al bloque de discrepancias de 6.1 para los límites de persistencia.
      Ver nota de "Governance/deviation" en el resumen de este batch. Se respetó el diff preexistente
      y no relacionado del archivo (archivado de `facturacion-ui`/`dashboard-ui`, columna `Estado`
      nueva de la tabla): la única línea tocada es la fila de `C-05`.

## 7. Verificación

- [x] 7.1 `cd frontend && npx tsc -b --noEmit` sin errores (nunca `tsc --noEmit` a secas). **Hecho
      (2026-07-31). 0 errores.**
- [x] 7.2 `cd frontend && npx oxlint` limpio. **Hecho (2026-07-31). 0 errores; 14 warnings
      preexistentes (`react(only-export-components)`) en archivos ajenos a este change, presentes en
      todos los `*RepositoryContext.tsx` del repo — no bloqueante.**
- [x] 7.3 `cd frontend && npx vitest run` verde, sin regresiones contra el baseline de 1.5. **Hecho
      (2026-07-31). 1356/1356 tests, 190/190 archivos, 0 fallos — igual al baseline post-sección 4.**
- [x] 7.4 Cobertura del código nuevo ≥ 85 % (`npx vitest run --coverage` sobre
      `shared/lib/pacientes/`). **Hecho (2026-07-31).** Se instaló la devDependency que faltaba
      (`@vitest/coverage-v8@^4.1.10`, misma major que `vitest@^4.1.10`) — el repo nunca había tenido
      un proveedor de cobertura instalado, gap preexistente ajeno a este change. Medición inicial
      contra `pacienteMapping.ts` + `SupabasePacienteRepository.ts`:
      `pacienteMapping.ts` ya cumplía (98.8 % stmts / 89.47 % branch / 100 % funcs / 98.55 % lines);
      `SupabasePacienteRepository.ts` **no** cumplía (68.05 % stmts / 60.55 % branch / 83.33 % funcs /
      76.78 % lines) — todo el diff de accesorios de movilidad en `update()`
      (`aplicarDiffAccesorios`/`resolverAccesorioIds`/`esFilaAccesorioMaestro`, D9 #11) estaba en
      0 % (comportamiento real sin ningún test, no código muerto), más varias ramas de error (D7),
      el reemplazo de CUD con datos (rama complementaria a `cud: null`), y algunas ramas defensivas
      de `list()`/`getById()`. Se agregaron 29 tests nuevos (83→112 en el módulo) cerrando esos huecos
      reales, siguiendo el patrón TDD/fake tipado ya establecido en el archivo — **no** se agregó
      ningún test tautológico ni se relajó ninguna aserción para inflar el número. Cobertura final:
      `SupabasePacienteRepository.ts` **99.07 % stmts / 96.66 % branch / 100 % funcs / 100 % lines**;
      `pacienteMapping.ts` sin cambios (ya cumplía). Ambos archivos ≥ 85 % en las 4 métricas.
      Gaps residuales documentados (no bloqueantes, ramas defensivas genuinamente inalcanzables desde
      la API pública actual — mismo criterio que un guard de exhaustividad de TypeScript): línea 65 de
      `pacienteMapping.ts` (`parsePacienteRow` con `row` no-objeto, nunca ocurre porque siempre viene
      de Supabase) y líneas 292/299/309/376/394-395 de `SupabasePacienteRepository.ts` (variantes
      defensivas: contexto `personas_a_cargo` del mensaje de FK en `aplicarDiffColeccion`, fila
      no-objeto en `esFilaAccesorioMaestro`, `resolverAccesorioIds` con lista vacía —inalcanzable
      porque `aplicarDiffAccesorios` solo la llama con al menos un tipo—, y los fallback `|| null` de
      fechas vacías al reemplazar CUD). Suite completa tras el batch: `cd frontend && npx vitest run`
      → **1385 tests passing (190 test files), 0 failures** — baseline 1356 + 29 nuevos, sin
      regresiones. `npx tsc -b --noEmit` → 0 errores. `npx oxlint` → limpio (mismos 14 warnings
      preexistentes de `react(only-export-components)`, ajenos a este change).
- [ ] 7.5 Verificación manual en navegador (`npm run dev`) con **tres** cuentas: `pacientes: write`
      (alta, edición, borrado de dirección), `pacientes: read` (solo lectura, sin guardado fantasma),
      y una con `pacientes: read` **sin** `obra_social: read` (el número de afiliado se ve vacío y
      con cartel, la ficha carga igual).
- [ ] 7.6 Verificar en `auditoria.logs` que un alta y una edición dejaron rastro (RN-GL-02), sin
      escribir código para ello — los triggers ya existen. En el alta, el rastro debe incluir **todas**
      las tablas hijas escritas por la RPC: los triggers disparan dentro de la misma transacción.
- [ ] 7.7 Confirmar que el rollback funciona: revertir `PacientesRoute.tsx` al mock, correr la suite,
      volver a aplicar. La migración de 1B **no** hace falta revertirla (una función que nadie llama
      es inerte); dejar registrado que el `DROP FUNCTION` está disponible si se la quiere limpiar.
- [ ] 7.8 **Chequeo final de seguridad** (`security-review`): confirmar en la base que
      `select prosecdef from pg_proc where proname = 'crear_paciente_completo';` sigue devolviendo
      `false` y que `anon` no tiene `EXECUTE`. Si en algún momento del apply alguien la cambió a
      `SECURITY DEFINER`, es un bloqueante: no se archiva el change hasta revertirlo.
