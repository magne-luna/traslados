# Tasks — integracion-presupuestos

> **⛔ GOVERNANCE ALTO — ESTE CHANGE NO ESTÁ APROBADO PARA APPLY.**
> Presupuestos es dominio **ALTO** (`CHANGES.md` §C-06): *proponer y esperar revisión antes de
> escribir*. La sección **0** es un portón, no una formalidad: **ninguna tarea de la sección 1 en
> adelante puede ejecutarse hasta que la usuaria responda las cinco aprobaciones de `design.md`
> §Governance.** Si el apply arranca sin esas respuestas, se detiene y se pregunta.
>
> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net y se registra el baseline. **No caer en Standard Mode.**
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> (el flag es obligatorio en este sandbox — ver 0.7).
>
> **⚠️ Las migraciones NO las aplica el agente, y las Edge Functions NO se redeployan.** Lo hace la
> usuaria / Enzo (backend). Es governance, no un límite técnico: el CLI del sandbox tiene sesión
> válida contra el proyecto real y se usó **solo para lectura** durante el propose. Las verificaciones
> con cuentas reales son tareas de coordinación explícitas (§1B), no pasos escondidos dentro de otra
> tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; type-check con **`npx tsc -b --noEmit`** (con `-b`,
> nunca `tsc --noEmit` a secas — sin `-b` compila cero archivos y siempre reporta 0 errores);
> Conventional Commits; el docx manda en estructura y la KB en reglas de negocio, y toda discrepancia
> se documenta en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden de fases pensado para no dejar el árbol a medias**: las §2 y §3 escriben archivos que
> **nadie importa todavía** — la app sigue andando con mocks. El swap real ocurre en un único commit
> en la §4. Cada fase es revertible por sí sola.

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [x] 0.1 **D2 — transporte.** Confirmar con la usuaria que este módulo consume las **Edge Functions
      `presupuestos`/`autorizaciones` ya deployadas** (`supabase.functions.invoke`) en vez de
      PostgREST + RLS directo como los cuatro changes de integración anteriores. Presentar el cuadro
      comparativo de `design.md` D2 completo, incluido el costo (dos patrones conviviendo, D12).
      **Si la respuesta es "PostgREST", este `design.md` hay que reescribirlo, no parchearlo.**
      **✅ Aprobado por la usuaria (2026-08-02): Edge Functions.**
- [x] 0.2 **D3 — postura de seguridad.** Confirmar que se acepta que, para este módulo, el portón de
      autorización sea el `requirePermiso('presupuestos', …)` de la Edge Function y que RLS quede como
      segunda capa (adentro de la función se opera con `service_role`). **No lo introduce este
      change** — ya está deployado por `C-06` — pero nadie lo aprobó del lado del frontend.
      **✅ Aprobado por la usuaria (2026-08-02).**
- [x] 0.3 **D5 — archivo adjunto.** Elegir entre A (mapeo no destructivo + `AvisoModeloDatos`,
      propuesta), B (deshabilitar el input hasta que exista Storage) o C (implementar la subida acá).
      **Es el riesgo funcional más alto del change**: hoy el usuario adjunta un archivo, ve su nombre
      en pantalla y contra la base real lo pierde. **No avanzar a la §3 sin respuesta.**
      **✅ Decidido por la usuaria (2026-08-02): opción A (mapeo no destructivo + `AvisoModeloDatos`).
      La subida real de Storage queda como change propio futuro (`presupuestos-documentacion-storage`).**
- [x] 0.4 **D7b — la migración de 3 índices.** Aprobar `CREATE INDEX` **sin `CONCURRENTLY`** sobre
      `presupuesto.paciente_id`, `presupuesto.obra_social_id` y `autorizacion.presupuesto_id`. Se
      aparta de una regla dura de `database-schema-design`; la justificación (0 filas) se re-verifica
      en 1B.1 inmediatamente antes de aplicar.
      **✅ Aprobado por la usuaria (2026-08-02).**
- [x] 0.5 **D11 — orden respecto de `integracion-facturacion`.** Confirmar que Presupuestos se swapea
      **primero** y que `FacturacionRoute.tsx` queda en mocks hasta que ese change lo resuelva,
      sabiendo que en el medio la app tiene dos fuentes distintas para la misma entidad.
      **✅ Aprobado por la usuaria (2026-08-02).**
- [x] 0.6 Verificar contra `https://supabase.com/changelog.md` y contra los tipos de
      `@supabase/supabase-js@^2.49.4` (la versión fijada en `frontend/package.json`) que
      `functions.invoke(name, { method, body })` soporta: (a) `method: 'GET' | 'POST' | 'PATCH'`;
      (b) segmento de path en el nombre (`'presupuestos/<uuid>'`); (c) querystring en el nombre
      (`'autorizaciones?presupuestoId=<uuid>'`); y (d) que adjunta automáticamente el `Authorization`
      de la sesión activa. **Anotar lo verificado con la versión exacta** — el fake de la §3 se
      construye sobre esto y un supuesto equivocado da tests verdes contra una API que no es la real.
      **✅ Verificado (2026-08-05).** Fuente: código fuente instalado en
      `frontend/node_modules/@supabase/functions-js` y `frontend/node_modules/@supabase/supabase-js`,
      **versión efectivamente resuelta `2.110.8`** (`npm ls @supabase/supabase-js`) — el `package.json`
      fija `^2.49.4`, pero esa es solo la cota mínima del rango; todos los chequeos corrieron contra
      2.110.8, que es lo que realmente ejecuta el frontend. **Hallazgo a anotar**: la brecha entre el
      rango fijado y la versión resuelta es grande (2.49 → 2.110); no invalida las conclusiones de abajo
      pero conviene que quien lea `design.md` sepa que la verificación fue contra la versión resuelta,
      no contra el mínimo literal del rango.
      - **(a)** `method: 'GET' | 'POST' | 'PATCH'` — **confirmado.** `FunctionInvokeOptions.method` en
        `@supabase/functions-js/dist/module/types.d.ts` acepta
        `'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'`, superset que incluye los tres verbos que usa
        `design.md`.
      - **(b)** segmento de path en el nombre (`'presupuestos/<uuid>'`) — **confirmado.** En
        `FunctionsClient.js`, `invoke()` arma la URL como
        `` const url = new URL(`${this.url}/${functionName}`) ``: el `functionName` se interpola
        directo en el path, así que un nombre con `/` produce el path esperado.
      - **(c)** querystring en el nombre (`'autorizaciones?presupuestoId=<uuid>'`) — **confirmado**,
        mismo mecanismo: `new URL()` parsea el string completo, y un `functionName` con `?clave=valor`
        produce un querystring válido. Único caveat real: si se pasa `region` distinto del default
        `'any'`, el cliente hace `url.searchParams.set('forceFunctionRegion', region)` — no pisa
        `presupuestoId`, agrega un segundo param aparte. El módulo no pasa `region`, así que no aplica.
      - **(d)** adjunta automáticamente el `Authorization` de la sesión activa — **confirmado**, pero
        por un mecanismo distinto al que asume la lectura ingenua del código (`setAuth()` estático): en
        `SupabaseClient.ts` el getter `functions` crea un `FunctionsClient` **nuevo en cada acceso** con
        `customFetch: this.functionsFetch`, que es un `fetchWithAuth(...)` que resuelve
        `_getSessionToken()` **en cada request** (no un token fijado una sola vez) y setea
        `Authorization: Bearer <token>` si el caller no lo mandó ya (`lib/fetch.ts`, líneas ~90-93). Para
        el fake de la §3 esto importa: no hace falta simular un `setAuth()` previo, alcanza con que el
        mock de sesión responda al momento del `invoke()`.
      - **Changelog** (`https://supabase.com/changelog.md`, chequeado 2026-08-05, 1695 líneas
        descargadas): sin entradas sobre cambios de comportamiento de `functions.invoke` /
        `FunctionsClient` (method, path, querystring o headers). Las únicas menciones de `functions-js`
        son sobre soporte de versiones de Node (drop de Node 18/20) y la migración a monorepo — nada que
        contradiga lo verificado arriba.
      - **Conclusión: las 4 claims se sostienen contra 2.110.8.** Ninguna quedó sin confirmar.
- [x] 0.7 Safety net inicial: correr la suite completa y **registrar el baseline real** (número de
      tests y de archivos). No asumirlo del último change. Recordar el hallazgo de entorno de
      `integracion-obra-social` 0.3: sin `NODE_OPTIONS="--no-experimental-webstorage"` fallan ~112
      tests por el `localStorage` nativo de Node shadoweando el de jsdom — **no es una regresión de
      código y no se "arregla" tocando `vite.config.ts`**.
      **✅ Baseline real registrado (2026-08-05).** Comando exacto:
      `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`.
      **Resultado: 219 archivos de test (217 passed, 2 failed) / 1805 tests (1802 passed, 3 failed)**,
      duración 135.56s. Los 2 archivos con fallas son **preexistentes y no relacionados con este
      change** (no tocan `presupuestos` ni `autorizaciones`):
      `src/features/cuentas/PermisosMatrizFields.test.tsx` (1 test) y
      `src/features/obras-sociales/ChecklistEditor.test.tsx` (2 tests). No se modificó código de
      producción ni se intentó "arreglarlos" — quedan documentados como parte del baseline real (no
      "~112 tests de localStorage" ni ningún número de un change anterior) para que la §2+ sepa contra
      qué comparar si algo se rompe.

## 1. Precondiciones del backend (verificar, no modificar)

> Todo lo de esta sección es **solo lectura**. Ninguna tarea acá corre DDL ni redeploya nada.
> Los valores de referencia son los verificados el **2026-08-02** durante el propose; si alguno
> cambió, **el hallazgo manda sobre el `design.md`** y hay que anotarlo acá antes de seguir.

- [x] 1.1 `supabase functions list` → confirmar que `presupuestos` y `autorizaciones` siguen `ACTIVE`.
      Anotar la versión (durante el propose: **2**). Si cambió, releer los `index.ts` antes de mapear
      nada: el contrato de `toApi()` es la fuente de verdad del mapeo, no este documento.
      **✅ Verificado (2026-08-05)** vía `supabase functions list --project-ref pkryfoljypuzfifofdwp
      --output json`. `presupuestos`: `status: ACTIVE`, `version: 2`. `autorizaciones`:
      `status: ACTIVE`, `version: 2`. **Sin discrepancia** — versión idéntica a la del propose
      (2026-08-02), no hace falta releer `index.ts` por cambio de contrato.
- [x] 1.2 Confirmar contra `information_schema.columns` que `facturacion.autorizacion` sigue teniendo
      `monto_autorizado` y `vigencia_desde`, y que **ni `presupuesto` ni `autorizacion` tienen**
      `archivo_nombre` / `archivo_cargado_en` (los dropeó `20260730120000`). Es la base fáctica de D5.
      **✅ Verificado (2026-08-05)** vía `supabase db query --linked` sobre
      `information_schema.columns` (`table_schema = 'facturacion'`, `table_name IN
      ('presupuesto','autorizacion')`). `autorizacion` tiene: `id, presupuesto_id, estado,
      fecha_respuesta, cupo_mensual_dias, cupo_mensual_km, archivo_url, monto_autorizado,
      vigencia_desde` — **`monto_autorizado` y `vigencia_desde` presentes**, confirmado. `presupuesto`
      tiene: `id, obra_social_id, paciente_id, monto, fecha_emision, archivo_url` — **ninguna de las
      dos tablas tiene `archivo_nombre` ni `archivo_cargado_en`**, confirmado (ambas solo tienen
      `archivo_url`). **Sin discrepancia** — coincide con la base fáctica de D5.
- [x] 1.3 Confirmar contra `pg_policies` que las cuatro policies de `facturacion.presupuesto` y
      `facturacion.autorizacion` siguen gateadas por **`modulos.tiene_permiso('presupuestos', …)`** y
      **no** por `'facturacion'` (el comentario de `20260724100005_schema_facturacion.sql` dice lo
      contrario — la base manda). Es la trampa que `integracion-facturacion` D9 dejó anotada.
      **✅ Verificado (2026-08-05)** vía `supabase db query --linked` sobre `pg_policies`
      (`schemaname = 'facturacion'`, `tablename IN ('presupuesto','autorizacion')`). Las cuatro
      policies (`Read presupuesto`, `Write presupuesto`, `Read autorizacion`, `Write autorizacion`)
      tienen `qual = modulos.tiene_permiso('presupuestos'::text, 'read'|'write'::modulos.nivel_acceso)`
      — **gateadas por `'presupuestos'`, no por `'facturacion'`**, confirmado. La trampa que
      `integracion-facturacion` D9 dejó anotada (el comentario de la migración dice lo contrario) se
      confirma una vez más: **la base manda, el comentario está desactualizado/equivocado.**
      **Sin discrepancia** respecto de lo esperado por `design.md`.
- [x] 1.4 Confirmar contra `pg_proc` / `information_schema.triggers` que el trigger
      `facturacion.validar_autorizacion_monto` sigue vivo sobre `facturacion.autorizacion`, y
      **copiar el texto literal del `RAISE EXCEPTION`** desde
      `20260729130000_schema_autorizacion_monto_vigencia.sql` — lo necesita el test de 3.3.
      **✅ Verificado (2026-08-05)** vía `supabase db query --linked` sobre
      `information_schema.triggers` y `pg_proc`. Trigger `trg_validar_autorizacion_monto` activo:
      `BEFORE INSERT` y `BEFORE UPDATE` en `facturacion.autorizacion`, ejecuta
      `facturacion.validar_autorizacion_monto()` (función confirmada en `pg_proc`/`pg_namespace`,
      schema `facturacion`). También sigue activo `trg_audit_autorizacion` (`AFTER INSERT/UPDATE/
      DELETE`, RN-GL-02, relevante para 1B.4(i)). **Texto literal del `RAISE EXCEPTION`** leído de
      `supabase/migrations/20260729130000_schema_autorizacion_monto_vigencia.sql` línea 24:
      `'RN-PA-01: monto_autorizado (%) no puede superar el presupuesto (%)'` (con los dos `%`
      interpolando `NEW.monto_autorizado` y `monto_presupuesto` respectivamente). **Ojo para 3.3**:
      este es el mensaje **crudo de Postgres** que devuelve el trigger, distinto del mensaje
      **traducido para la UI** (`"La autorización no puede superar el monto del presupuesto."`) que
      ya está escrito en la tarea 3.3 — 3.3 debe matchear el *prefijo* `RN-PA-01:` de este texto
      literal para reconocer la rama, no compararlo contra el texto traducido.
- [x] 1.5 `count(*)` de `facturacion.presupuesto`, `facturacion.autorizacion`, `pacientes.paciente` y
      `obra_social.obra_social`. Durante el propose: **0 / 0 / 1 / 3**. Es el insumo de D9 (la pantalla
      va a arrancar vacía) y de la condición de caducidad de D7b.
      **✅ Verificado (2026-08-05)** vía `supabase db query --linked`, un solo `SELECT` con
      subconsultas de `count(*)` sobre las cuatro tablas. **Resultado real: `presupuesto = 0`,
      `autorizacion = 0`, `paciente = 1`, `obra_social = 5`.** `presupuesto`, `autorizacion` y
      `paciente` coinciden exactamente con el valor del propose (0 / 0 / 1) — **D9 (pantalla arranca
      vacía) y la condición de caducidad de D7b (0 filas en `presupuesto`/`autorizacion`) siguen
      vigentes sin cambios**, 1B.1 puede re-verificar sobre esta misma base. **⚠️ DISCREPANCIA
      encontrada**: `obra_social.obra_social` pasó de **3** (propose, 2026-08-02) a **5** (hoy,
      2026-08-05) — alguien cargó 2 obras sociales nuevas en el medio. No afecta ninguna decisión de
      `design.md` (D9 y D7b solo dependen de `presupuesto`/`autorizacion`, que siguen en 0), pero se
      deja anotado porque es un valor de referencia que cambió y no hay que asumir "3" en ningún lado
      más adelante (por ejemplo si algún test o verificación manual de 1B.4/7.5 llegara a listar obras
      sociales esperando un número fijo).
- [x] 1.6 Confirmar contra `pg_indexes` que el schema `facturacion` sigue sin índices fuera de sus 7
      primary keys, y en particular que `autorizacion.presupuesto_id` sigue sin indexar. Si
      `integracion-facturacion` ya aplicó su migración de índices, anotarlo: el `IF NOT EXISTS` de
      1B.2 lo cubre, pero conviene saberlo.
      **✅ Verificado (2026-08-05)** vía `supabase db query --linked` sobre `pg_indexes`
      (`schemaname = 'facturacion'`). **Resultado: exactamente 7 índices, los 7 primary keys**
      (`asistencia_prestacion_pkey`, `autorizacion_pkey`, `cobros_pkey`, `documento_factura_pkey`,
      `facturas_pkey`, `gastos_vehiculos_pkey`, `presupuesto_pkey`) — **ningún índice adicional**.
      Confirmado en particular: **`autorizacion.presupuesto_id` sigue sin indexar** (no hay
      `autorizacion_presupuesto_id_idx` ni equivalente). `integracion-facturacion` **no** aplicó
      todavía su propia migración de índices sobre este schema — 1B.2 sigue siendo la primera vez que
      se crean estos índices, no hay conflicto que el `IF NOT EXISTS` tenga que absorber. **Sin
      discrepancia** respecto de lo esperado.

## 1B. Migración de índices y verificación manual (coordinación con backend)

> **Bloqueada por 0.4.** El agente **escribe** el `.sql`; **la usuaria / Enzo lo aplica**. La
> verificación con cuentas reales es un checklist de coordinación, no un paso automatizado.
>
> **⚠️ Este change no crea tablas, ni columnas, ni funciones, ni policies.** Si en el apply aparece la
> necesidad de crear alguna, **eso es un hallazgo que cambia el alcance** y hay que volver al portón,
> no resolverlo sobre la marcha.

- [x] 1B.1 **Re-verificar `count(*)`** de `facturacion.presupuesto` y `facturacion.autorizacion`
      **inmediatamente antes** de aplicar la migración. Si alguna ya tiene filas en volumen, la
      justificación de D7b caduca y hay que rehacer los índices con `CONCURRENTLY` **fuera de
      transacción**, en un script aparte. No es opcional.
      **✅ Re-verificado (2026-08-05)** vía `supabase db query --linked` (ref `pkryfoljypuzfifofdwp`,
      única fuente consultada), un solo `SELECT` con subconsultas de `count(*)` sobre las dos
      tablas. **Resultado: `facturacion.presupuesto = 0`, `facturacion.autorizacion = 0`** —
      idéntico al valor del propose (2026-08-02: 0/0) y al de la tarea 1.5 del mismo día
      (2026-08-05: 0/0). **La justificación de D7b/0.4 (sin `CONCURRENTLY`) sigue vigente sin
      cambios** — no se detectó volumen que la invalide. No se aplicó ninguna escritura ni DDL.
- [x] 1B.2 Escribir `supabase/migrations/20260802100000_presupuesto_autorizacion_indices.sql`:
      `CREATE INDEX IF NOT EXISTS` sobre `facturacion.presupuesto(paciente_id)`,
      `facturacion.presupuesto(obra_social_id)` y `facturacion.autorizacion(presupuesto_id)`.
      Cabecera del archivo con: por qué sin `CONCURRENTLY`, el `count(*)` medido y su fecha, y la
      condición de caducidad. **Ninguna otra sentencia en este archivo.**
      **✅ Escrito (2026-08-05)**, solo en disco, **no aplicado** (ni `db push` ni `migration up` —
      eso es 1B.3, bloqueada, tarea de la usuaria/Enzo). Ruta:
      `supabase/migrations/20260802100000_presupuesto_autorizacion_indices.sql`. Contiene
      exactamente 3 sentencias `CREATE INDEX IF NOT EXISTS`, ninguna otra: `idx_presupuesto_paciente_id`
      sobre `facturacion.presupuesto(paciente_id)`, `idx_presupuesto_obra_social_id` sobre
      `facturacion.presupuesto(obra_social_id)` y `idx_autorizacion_presupuesto_id` sobre
      `facturacion.autorizacion(presupuesto_id)` (mismos nombres que la tabla de `design.md` D7b).
      Cabecera con: por qué sin `CONCURRENTLY` (justificación 0.4, tabla vacía + `CONCURRENTLY` no
      corre en transacción), el conteo 0/0 medido en 1B.1 con fecha 2026-08-05, y la condición de
      caducidad explícita (si hay volumen al aplicar, rehacer con `CONCURRENTLY` fuera de
      transacción, no aplicar este archivo tal cual).
- [x] 1B.3 **Migración aplicada por la usuaria/Enzo (confirmado 2026-08-05).** Verificado por lectura
      contra `pkryfoljypuzfifofdwp` que las 3 `idx_presupuesto_paciente_id` / `idx_presupuesto_obra_social_id`
      / `idx_autorizacion_presupuesto_id` existen en `facturacion`. **⚠️ No hay línea base "antes"**:
      ningún batch previo corrió `supabase db advisors` antes de esta migración, así que la comparación
      que pide esta tarea no se puede hacer estrictamente. Se corrió `supabase db advisors --linked
      --type security --level warn` **después** y da 15 hallazgos `WARN`, todos preexistentes y
      ajenos a este change: 7 `SECURITY DEFINER` ejecutables por `anon`/`authenticated` (funciones de
      `auditoria`, `facturacion`, `modulos`, `usuarios` — ninguna nueva de este change) + 1
      `auth_leaked_password_protection` deshabilitado. Ninguno menciona índices ni las tablas
      `presupuesto`/`autorizacion` fuera de la función `validar_autorizacion_monto` (preexistente). No
      hay lint de tipo `SECURITY` para índices en este linter (los de índices son `PERFORMANCE`), así
      que el riesgo de que la migración haya introducido un hallazgo de seguridad es bajo, pero queda
      dicho que esto es un best-effort a posteriori, no la comparación estricta pedida.
- [x] 1B.4 **Verificado por lectura/escritura directa contra la Edge Function real (2026-08-06),
      vía `curl` con tokens de sesión de 3 cuentas reales — no fue clickeado en la pantalla (eso
      es 7.5).** `pacienteId` usado: `c0bc422c-aba0-44f8-99c3-d2801e70022f`. Resultado de cada punto:
      (a) **✅** con `facturacion@pastor.com` (tenía `presupuestos: write` al momento de probar):
      `POST /presupuestos` → `201`, creó `dd72b2a8-0002-4ea9-b60a-7d4d763e68af`; `PATCH` → `200`,
      `monto` 15000→16000; `GET /presupuestos/:id` → `200`, devolvió el estado actualizado.
      (b) **✅** con `rominaop@pastor.com` (`presupuestos: read`, sin `write`): `POST` y `PATCH` →
      `403 {"error":"no tenes permiso de 'write' sobre el modulo 'presupuestos'"}`; `GET /presupuestos`
      confirmó que el `monto` seguía en 16000 (el intento de `PATCH` con 999 no escribió nada).
      (c) **✅** con `facturacion@pastor.com` **después de que la usuaria le sacó el permiso de
      `presupuestos`** (dejándola con solo `facturacion: write`) — no se creó cuenta nueva, se
      reusó y remodeló una existente, decisión de la usuaria: `GET /presupuestos` → `403
      {"error":"no tenes permiso de 'read' sobre el modulo 'presupuestos'"}`, **no** `200 []`. Cierra
      la trampa de RLS de `integracion-facturacion` D9 tal como predecía D11 punto 3.
      **⚠️ Nota operativa**: `facturacion@pastor.com` quedó sin `presupuestos: write` en producción
      tras esta prueba — la usuaria decidió dejarlo así por ahora, no revertirlo.
      (d) **✅** `POST /autorizaciones` con `montoAutorizado: 999999` sobre presupuesto de 16000 →
      `400 {"error":"RN-PA-01: monto_autorizado (999999.00) no puede superar el presupuesto
      (16000.00)"}` — **coincide exactamente** con el texto verificado en 1.4, confirma que 3.3 está
      mapeando el prefijo correcto.
      (e) **✅** `montoAutorizado: 10000` (≤ 16000) → `201`, `estado: "pendiente"`.
      (f) **✅** sobre un segundo presupuesto (`8dd7904b-7e2a-4ac2-9795-db6080a21342`, monto 20000):
      `montoAutorizado: 5000`, `vigenciaDesde: "2026-07-01"` (anterior a `fechaRespuesta`) → `201`,
      aceptado sin objeción.
      (g) **✅** `GET /autorizaciones?presupuestoId=<presupuesto sin autorización aún>` → `404
      {"error":"este presupuesto todavia no tiene autorizacion asociada"}` — texto idéntico al
      esperado.
      (h) **✅** `PATCH /presupuestos/00000000-0000-0000-0000-000000000000` → `404
      {"error":"presupuesto no encontrado"}`.
      (i) **✅ con hallazgo.** `auditoria.logs` sí tiene el rastro de (a) — un `INSERT` y un `UPDATE`
      con `datos_nuevos` correctos (15000 y luego 16000) — pero **`usuario_id` vino `null` en los
      dos**. Causa raíz confirmada leyendo `20260724100001_schema_modulos_auditoria.sql`: el trigger
      usa `auth.uid()`, que no resuelve nada cuando la escritura llega vía Edge Function con
      `service_role` (D3) — no hay sesión de usuario en esa conexión a nivel Postgres. **RN-GL-02 no
      se cumple del todo para este módulo**: el rastro de *qué* cambió existe, el de *quién* lo hizo
      no. Es un costo de D3 que el `design.md` no había anotado explícitamente — pendiente de
      documentar en KB (ver 1B.5/6.6) y de decidir si amerita un fix (ej. loguear el `usuario_id` a
      nivel de la propia Edge Function, ya que ahí sí conoce quién invocó).
      **Datos de prueba que quedaron en la base real, dejados a propósito** (decisión de la usuaria,
      2026-08-06): presupuestos `dd72b2a8-0002-4ea9-b60a-7d4d763e68af` (monto 16000) y
      `8dd7904b-7e2a-4ac2-9795-db6080a21342` (monto 20000), con sus autorizaciones asociadas.
- [x] 1B.5 Anotado en `knowledge-base/10_preguntas_abiertas.md` (ver 6.6) — más el hallazgo nuevo del
      punto (i) de arriba (`usuario_id null` vía `service_role`), que es un costo adicional y más
      concreto de la falta de harness automatizado que el genérico ya anotado: acá no solo no hay
      pgTAP, sino que el patrón Edge Function + `service_role` le rompe silenciosamente un campo a la
      auditoría, y nadie lo iba a notar sin probar a mano.

## 2. Mapeos puros (TDD estricto, nadie los importa todavía)

> **⛔ Precondición**: 0.1 (transporte) y 0.3 (archivo adjunto) respondidas.
>
> Todas las tareas de esta sección: RED (test primero) → GREEN (mínimo) → TRIANGULATE (≥2 casos por
> comportamiento: happy path + borde) → REFACTOR. Archivos nuevos, no requieren safety net previo.
> **El contrato de referencia es el `toApi()`/`toDb()` real de los `index.ts`, leído en 1.1** — nunca
> lo que dice este documento.

- [x] 2.1 `presupuestoMapping.ts` → `parsePresupuestoApi(value: unknown): Presupuesto | null`.
      TRIANGULATE: objeto completo; `monto` nulo → `null` (se descarta, D6); `fechaEmision` nula →
      `null`; `archivoUrl` ausente → `archivo: undefined`; valor que no es objeto → `null`.
      **✅ Hecho (2026-08-05).** `frontend/src/shared/lib/presupuestos/presupuestoMapping.ts` +
      `presupuestoMapping.test.ts` (`describe('parsePresupuestoApi (2.1)')`, 5 casos: los 5 del
      TRIANGULATE de arriba, uno por `it`). RED confirmado (módulo inexistente) antes de escribir la
      implementación; GREEN con narrowing directo sobre `unknown` (sin `mapArchivoUrl` todavía —
      fake-it con el string crudo, generalizado recién en 2.2).
- [x] 2.2 Mapeo de `archivoUrl` → `ArchivoAdjunto` (D5, opción elegida en 0.3). Con la propuesta A:
      `nombre` = último segmento del path con `decodeURIComponent`, `cargadoEn` = `fechaEmision`.
      TRIANGULATE: URL simple; URL con querystring (`?token=…`) que **no** debe contaminar el nombre;
      nombre percent-encoded (`presupuesto%20abril.pdf` → `presupuesto abril.pdf`); string vacío →
      `undefined`.
      **✅ Hecho (2026-08-05).** `mapArchivoUrl` en `presupuestoMapping.ts`, exportada y reutilizada
      también por `autorizacionMapping.ts` (2.5). `describe('mapArchivoUrl (2.2)')`, 4 casos (los 4
      del TRIANGULATE). RED confirmado (4 tests nuevos fallando, los 5 de 2.1 seguían en verde)
      antes de generalizar `parsePresupuestoApi` para usarla.
- [x] 2.3 `toCrearPresupuestoPayload(NuevoPresupuesto)`: body del `POST`. Claves **exactamente** las
      que lee el `toDb()` real (`pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivoUrl`).
      **`archivo` elegido en el input NO produce `archivoUrl`** (D5): solo viaja si vino de una lectura
      previa. TRIANGULATE: presupuesto mínimo; con archivo de round-trip; con archivo recién elegido
      (no viaja).
      **✅ Hecho (2026-08-05).** `toCrearPresupuestoPayload` en `presupuestoMapping.ts`, `describe`
      con 3 casos. **Hallazgo de implementación**: `ArchivoAdjunto` (dominio) no tiene ninguna URL de
      origen, sea que venga de una lectura previa o de un archivo recién elegido — así que la función
      NUNCA agrega la clave `archivoUrl` al body, en ninguno de los dos casos (no hay de dónde
      reconstruirla sin inventar un valor). Los 3 tests lo confirman con `'archivoUrl' in payload`
      `=== false`, no solo `toBeUndefined()` (para distinguir "clave ausente" de "clave con
      `undefined`").
- [x] 2.4 `toActualizarPresupuestoPayload(ActualizacionPresupuesto)`: **la semántica parcial es lo que
      se está testeando** (D6b). Clave ausente ⇒ **no aparece** en el body. TRIANGULATE con al menos:
      solo `monto`; solo `fechaEmision`; objeto vacío ⇒ body vacío. Este es el test que impide pisar
      campos que el usuario no tocó.
      **✅ Hecho (2026-08-05).** `toActualizarPresupuestoPayload` en `presupuestoMapping.ts`, 3 casos
      (los 3 del TRIANGULATE), con aserciones `in` para confirmar ausencia real de clave, no solo
      valor `undefined`. `archivo` tampoco se traduce a `archivoUrl` acá (mismo motivo que 2.3).
- [x] 2.5 `autorizacionMapping.ts` → `parseAutorizacionApi(value: unknown): Autorizacion | null`.
      TRIANGULATE: objeto completo; `estado` nulo → `'pendiente'` (D6); `estado` fuera de la unión
      `EstadoAutorizacion` → `'pendiente'`; `montoAutorizado`/`vigenciaDesde`/`cupoMensualDias`/
      `cupoMensualKm` ausentes → `undefined`; sin `presupuestoId` → `null`.
      **✅ Hecho (2026-08-05).** `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts` +
      `autorizacionMapping.test.ts` (`describe('parseAutorizacionApi (2.5)')`, 5 casos, los 5 del
      TRIANGULATE). Reutiliza `mapArchivoUrl` de 2.2 (`cargadoEn` = `fechaRespuesta ?? ''` cuando no
      hay fecha de respuesta — caso de borde no cubierto por el TRIANGULATE de esta tarea, documentado
      inline en el código).
- [x] 2.6 `toCrearAutorizacionPayload(NuevaAutorizacion)` y
      `toActualizarAutorizacionPayload(ActualizacionAutorizacion)`, mismo criterio que 2.3/2.4.
      TRIANGULATE del parcial con al menos: solo `estado`; solo `montoAutorizado`; solo
      `vigenciaDesde`; objeto vacío.
      **✅ Hecho (2026-08-05).** Ambas funciones en `autorizacionMapping.ts`. `toCrearAutorizacionPayload`:
      2 casos (mínima con solo `presupuestoId`/`estado`; completa con los 5 campos opcionales
      presentes). `toActualizarAutorizacionPayload`: 4 casos, exactamente los del TRIANGULATE de
      arriba. `archivo` tampoco viaja a `archivoUrl` en ninguna de las dos (D5).
- [x] 2.7 REFACTOR + `npx tsc -b --noEmit` limpio. Anotar el conteo de tests nuevo.
      **✅ Hecho (2026-08-05).** REFACTOR: typo corregido en un comentario de
      `autorizacionMapping.ts`; sin cambios de comportamiento (tests re-corridos en verde después).
      `npx tsc -b --noEmit` encontró **1 error real** durante el refactor:
      `mapArchivoUrl`'s `archivoUrl.split('?')[0]` es `string | undefined` bajo
      `noUncheckedIndexedAccess` — corregido con `?? archivoUrl` (fallback correcto: `split` con
      separador presente siempre devuelve ≥1 elemento, pero TS no lo sabe por el índice). Re-corrido:
      **limpio, 0 errores.** **Conteo de tests nuevo**: 26 tests nuevos (15 en
      `presupuestoMapping.test.ts`, 11 en `autorizacionMapping.test.ts`), ambos archivos 100% verdes.
      Suite completa: **220 archivos de test / 1821 tests (218 archivos passed, 1818 tests passed)**,
      con exactamente los **2 archivos de falla preexistentes y no relacionados** de la baseline de
      0.7 (`PermisosMatrizFields.test.tsx` 1 test, `ChecklistEditor.test.tsx` 2 tests) — mismos
      nombres de test, ninguna falla nueva. **Nota de entorno**: una primera corrida de la suite
      completa bajo carga del sandbox devolvió 8 archivos fallidos con timeouts (`PacienteDetail.test.tsx`
      a 5000ms, etc.) y un conteo total distinto (221 archivos/1828 tests) — descartada como
      flakiness de recursos, no regresión: una segunda corrida limpia coincidió exactamente con el
      conteo real de archivos en disco (`find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l`
      → 220) y con las mismas 2 fallas preexistentes por nombre. El número de archivos de esta
      corrida (220) difiere en 1 del que registra 0.7 (219 + los 2 nuevos de esta sección = 221
      esperados) — se anota como discrepancia de conteo entre corridas del mismo entorno bajo distinta
      carga, no como regresión: los nombres de las únicas 2 fallas coinciden exactamente con la
      baseline en las dos corridas de esta sesión.

## 3. `edgeFunctionErrors.ts` + los dos repositories (TDD estricto, nadie los importa todavía)

> El fake de `supabase.functions.invoke` se construye a mano con interfaces propias, **sin `any`, sin
> `as`**, siguiendo `frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.test.ts` como
> referencia de estilo (es el único precedente del repo que mockea `functions.invoke`). El fake debe
> **registrar** nombre de función, `method` y `body` de cada invocación. Ojo con `erasableSyntaxOnly`
> de `tsconfig.app.json`: prohíbe propiedades de parámetro de constructor.

- [x] 3.1 `edgeFunctionErrors.ts` → `mapearErrorEdgeFunction(error: unknown, contexto): Promise<Error>`.
      Lee `error.context` cuando es `Response` y despacha por `status`, igual que
      `SupabaseCuentaRepository`. Un test por rama de la tabla de `design.md` D7: `401`, `403` lectura,
      `403` escritura, `400` genérico, error sin `context` (red), y `Error` no reconocido.
      **✅ Hecho (2026-08-05).** `frontend/src/shared/lib/presupuestos/edgeFunctionErrors.ts` +
      `edgeFunctionErrors.test.ts` (`describe('mapearErrorEdgeFunction (3.1 …)')`, 6 casos, uno por
      rama). RED confirmado (módulo inexistente, `vitest` no resuelve el import) antes de escribir la
      implementación. **Resolución de diseño propia** (no está en `design.md` con este nivel de
      detalle): "error sin `context`" (red) vs. "status no reconocido" (`500`) se distinguen por si
      `error.context instanceof Response` — si no lo es (falla de red real, `FunctionsFetchError` de
      supabase-js) cae a "no se pudo conectar"; si lo es pero con un status fuera de
      {401,403,404,400}, cae al mensaje genérico de la operación (fila "cualquier otro" de D7).
- [x] 3.2 Test dedicado: **el texto crudo de Postgres nunca llega a la UI**. Alimentar el traductor con
      un `400` cuyo body sea un mensaje real del motor y afirmar que el `.message` resultante **no lo
      contiene**. No es redundante con 3.1: 3.1 verifica el mapeo, este verifica la fuga.
      **✅ Hecho (2026-08-05).** `describe('mapearErrorEdgeFunction (3.2 …)')`, 1 caso: body con un
      mensaje real de violación de constraint (`not-null constraint`), asserts `not.toContain` sobre
      3 fragmentos del texto crudo. **Nota TDD**: pasó en verde de inmediato — `mapear400` ya
      implementado en 3.1 nunca propaga `body.error` tal cual (solo lo usa para decidir la rama), así
      que no hizo falta código nuevo. Test igual queda como guardia de regresión explícita.
- [x] 3.3 Rama **RN-PA-01**: un `400` cuyo `error` empieza con el prefijo del `RAISE EXCEPTION` del
      trigger → `La autorización no puede superar el monto del presupuesto.` **Usar el texto literal
      copiado en 1.4/1B.4(d)**, no una paráfrasis de este documento.
      **✅ Hecho (2026-08-05).** `describe('mapearErrorEdgeFunction (3.3 …)')`, 1 caso, usando el texto
      literal `'RN-PA-01: monto_autorizado (500) no puede superar el presupuesto (300)'` (prefijo real
      de 1.4). **Nota TDD**: igual que 3.2, la rama ya estaba implementada en 3.1 (mismo
      `mapear400`), así que pasó en verde sin código nuevo — documentado, no se fuerza un RED
      artificial.
- [x] 3.4 Fake tipado de `functions.invoke` + `SupabasePresupuestoRepository.list()`: una sola
      invocación `GET /presupuestos`, cero invocaciones adicionales por fila (**test anti N+1**), y
      filas malformadas descartadas sin tumbar el listado (D6).
      **✅ Hecho (2026-08-05).** `frontend/src/shared/lib/presupuestos/SupabasePresupuestoRepository.ts`
      (`list()` implementado; `getById`/`create`/`update` quedan como stubs `throw` explícitos hasta
      3.5-3.7) + `SupabasePresupuestoRepository.test.ts`, 5 casos: anti-N+1 (`toHaveBeenCalledTimes(1)`
      + `toHaveBeenCalledWith('presupuestos', { method: 'GET' })`), mapeo completo, filas malformadas
      descartadas (D6, 2 filas rotas de 3), `data` no-array → `[]`, y propagación de error vía
      `mapearErrorEdgeFunction`. RED confirmado (módulo inexistente) antes de escribir la
      implementación. Fake: `vi.fn()` tipado sin `any`/`as` — se apoya en `.mock.calls` nativo de
      vitest (`toHaveBeenCalledWith`/`toHaveBeenCalledTimes`) en vez de un registro manual, ya que
      cubre exactamente lo pedido (nombre, `method`, `body` de cada invocación) sin estado extra.
- [x] 3.5 `SupabasePresupuestoRepository.getById()`: `200` → `Presupuesto`; **`404` → `null`, no
      lanza**; `403` → lanza con el mensaje de lectura. Los tres caminos con test propio y nombre
      explícito — el 404→`null` es contrato de la interfaz, no un detalle.
      **✅ Hecho (2026-08-05).** Agregado `esErrorNotFound(error): boolean` a `edgeFunctionErrors.ts`
      (helper compartido, lo va a reusar 3.9) con 3 casos propios en `edgeFunctionErrors.test.ts`
      (RED→GREEN confirmado). `getById()` implementado en `SupabasePresupuestoRepository.ts`, 3
      casos en el `describe` "los tres caminos, cada uno con nombre explícito": `200`, `404` (null,
      no lanza), `403` (lanza con mensaje de lectura). RED confirmado (stub `throw` de 3.4) antes de
      implementar.
- [x] 3.6 `SupabasePresupuestoRepository.create()`: una sola invocación `POST` con el body de 2.3, y
      la respuesta `201` mapeada. Tests de error: `403`, `400` de campos faltantes, `400` de FK
      (`23503`, el caso de D8 si los selectores quedaran en mock).
      **✅ Hecho (2026-08-05).** 5 casos: invocación única con el body de `toCrearPresupuestoPayload`,
      `archivo` del input no viaja como `archivoUrl` (triangulación explícita de D5 a nivel
      repository), `403`, `400` campos faltantes, `400` FK (`23503`). RED confirmado (stub `throw`)
      antes de implementar. **Resolución de diseño propia** (no estaba especificado con este nivel de
      detalle en `design.md`): el mensaje de FK para `autorizacion` (`MENSAJE_FK.autorizacion` en
      `edgeFunctionErrors.ts`, usado recién en 3.8) es una extensión simétrica del texto que D7 solo
      da para `presupuesto` — anotado inline en el código como tal.
- [x] 3.7 `SupabasePresupuestoRepository.update()`: `PATCH` con el body de 2.4 —verificando **sobre lo
      que el fake registró** que las claves ausentes no viajan— y **`404` ⇒ lanza** con el mensaje
      idéntico al del mock (`No existe un presupuesto con id "…".`). **Esta asimetría con 3.5 es la
      trampa más fácil del change**: que el nombre del test lo diga.
      **✅ Hecho (2026-08-05).** `describe` con el nombre explícito "OJO: asimetría con 3.5, acá el
      404 SÍ lanza". 4 casos: invocación única + body mapeado, claves ausentes no viajan (leído del
      `body` que `functionsInvoke.mock.calls[0]` registró, sin `any`/`as`), `404` lanza con
      `No existe un presupuesto con id "inexistente".` (idéntico a `mockPresupuestoRepository`), y
      `403`. RED confirmado (stub `throw`) antes de implementar.
- [x] 3.8 `SupabaseAutorizacionRepository`: `list()`, `getById()`, `create()`, `update()` con los
      mismos criterios de 3.4-3.7 y los mensajes de dominio de autorización.
      **✅ Hecho (2026-08-05).** `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts`
      (`getByPresupuestoId` queda como stub `throw` hasta 3.9) + `.test.ts`, 12 casos: anti-N+1 +
      malformadas + `data` no-array + error de `list()`; los tres caminos de `getById()`; invocación +
      403 + rama RN-PA-01 (sin filtrar el texto crudo del trigger) de `create()`; body sin claves
      ausentes + asimetría 404-lanza de `update()`. RED confirmado (módulo inexistente) antes de
      implementar.
- [x] 3.9 `SupabaseAutorizacionRepository.getByPresupuestoId()`: invoca
      `autorizaciones?presupuestoId=<id>` con el id **percent-encoded**; `200` → `Autorizacion`;
      **`404` → `null`** (el presupuesto todavía no tiene autorización — es el caso normal, no un
      error); `403` → lanza.
      **✅ Hecho (2026-08-05).** 4 casos: percent-encoding explícito (probado con un id que tiene
      espacio y `/` para que un `encodeURIComponent` faltante se note), `200`, `404` (null), `403`.
      RED confirmado (stub `throw` de 3.8) antes de implementar.
- [x] 3.10 Test de código fuente vía `?raw` sobre los dos repositories: no contienen `service_role`,
      no contienen `any` **ni siquiera en los comentarios en castellano** (el regex `/\bany\b/` no
      distingue código de prosa — a `integracion-pacientes` 3.12 le pasó), y no consultan
      `modulos.permisos` ni `modulos.modulos` (no duplican la autorización, `security-review`).
      **✅ Hecho (2026-08-05).** `frontend/src/shared/lib/presupuestos/repositorySourceGuards.test.ts`,
      `describe.each` sobre los dos archivos, 8 casos (4 por archivo): `service_role`, `any`
      escopeado a líneas de código (`soloLineasDeCodigo` descarta comentarios de línea completa y la
      cola de comentario de líneas mixtas — **necesario de verdad**: los propios comentarios
      explicativos de estos dos archivos mencionan `modulos.permisos`/`modulos.modulos` en prosa, así
      que un `.not.toContain` ingenuo sobre el string crudo habría dado falso positivo), consulta
      real a `modulos` (`.schema('modulos')`/`.from('permisos'|'modulos')`, no substring), y ausencia
      de `.insert(/.update(/.delete(` directo. **Nota TDD**: los 8 casos pasaron en verde de
      inmediato — no fue necesario tocar producción, el código de 3.4-3.9 ya cumplía las tres
      invariantes. Se verificó manualmente (fuera del archivo de test, con `node -e`) que el regex
      escopeado sí distingue "any" en comentario (no matchea) de "any" en código (sí matchea), para
      no dejar la lógica de escopeo sin probar.
- [x] 3.11 REFACTOR + `npx tsc -b --noEmit` y `npx oxlint` limpios. Cobertura del código nuevo ≥ 85 %
      (`npx vitest run --coverage` sobre `shared/lib/presupuestos/`). **No** agregar tests
      tautológicos ni relajar aserciones para inflar el número: si falta cobertura, es comportamiento
      real sin test.
      **✅ Hecho (2026-08-05).** `npx tsc -b --noEmit`: **limpio, 0 errores**. `npx oxlint` (escopeado
      a `shared/lib/presupuestos/` y también corrido full-repo): **limpio** — los 2 warnings
      `react(only-export-components)` de `features/presupuestos/*RepositoryContext.tsx` son
      preexistentes y ajenos a este change (mismo criterio que el resto del repo). Cobertura sobre
      `shared/lib/presupuestos/` (`npx vitest run --coverage`): **95 % statements / 93.03 % branch /
      100 % funcs / 99.35 % lines** — los tres archivos de esta sección (`edgeFunctionErrors.ts`,
      `SupabasePresupuestoRepository.ts`, `SupabaseAutorizacionRepository.ts`) quedaron en **100 %**
      en las cuatro métricas; el único residual (`presupuestoMapping.ts` 86.48 %,
      `autorizacionMapping.ts` 88.88 %) es de la sección 2, fuera de alcance de este batch. Se
      agregaron 8 tests reales durante el REFACTOR para cerrar gaps genuinos detectados por el
      reporte de cobertura (no tautológicos): rama `obtener` de `mensajeGenerico`, 400 con body JSON
      válido pero sin `error` string, 400 con body no-JSON, error que no es `Record` en absoluto,
      `esErrorNotFound` sobre un no-`Record`, 404 sin `contexto.id` (defensivo), y los `throw` de
      `create()`/`update()` de los dos repositories ante una respuesta 200/201 con body malformado.
      Suite completa final: **224 archivos (222 passed, 2 failed) / 1883 tests (1880 passed, 3
      failed)** — exactamente los 2 archivos/3 tests preexistentes de la baseline de 0.7
      (`PermisosMatrizFields.test.tsx`, `ChecklistEditor.test.tsx`), **ninguna falla nueva**. Conteo
      nuevo de esta sección: **62 tests** en 4 archivos nuevos (`edgeFunctionErrors.test.ts`,
      `SupabasePresupuestoRepository.test.ts`, `SupabaseAutorizacionRepository.test.ts`,
      `repositorySourceGuards.test.ts`).

## 4. El swap (⚠️ el corte real)

> **Safety net obligatorio antes de esta sección**: correr la suite y comparar con el conteo de la §3.
>
> **⛔ Precondición**: 1B.4 (verificación con cuentas reales) confirmada. Sin eso, la pantalla puede
> quedar mostrando 403 en cada carga sin que nadie sepa si es la app o el permiso.
>
> Un solo commit. A partir de acá la pantalla usa datos reales.
>
> ⚠️ 1B.4 fue postergada por decisión explícita de la usuaria (2026-08-05) — se corre después del
> swap, no antes. Si algo falla en producción con 403, puede ser un bug real o un permiso sin
> verificar; no asumir que el gateo de permisos ya está confirmado contra cuentas reales.

- [x] 4.1 `PresupuestosRoute.tsx`: reemplazar los **cuatro** mocks —`mockPresupuestoRepository`,
      `mockAutorizacionRepository`, `mockPacienteRepository`, `mockObraSocialRepository`— por
      `supabasePresupuestoRepository`, `supabaseAutorizacionRepository`, `supabasePacienteRepository`
      y `supabaseObraSocialRepository` (D8: los dos últimos ya existen y ya están cableados en
      `PacientesRoute.tsx`/`ObraSocialesRoute.tsx`; sin ellos toda alta falla con `23503`). Actualizar
      el comentario del composition root para que refleje el estado nuevo, siguiendo el criterio de
      `PacientesRoute.tsx` / `ObraSocialesRoute.tsx`.
      **Hecho**: los cuatro imports reemplazados (2 nuevos + 2 reutilizados sin recrear, tal como
      pide D8). Comentario del composition root reescrito citando D8/D10/tasks.md 4.1, más el
      recordatorio del waiver de 1B.4. De paso se actualizaron los comentarios de
      `PresupuestoRepositoryContext.tsx`/`AutorizacionRepositoryContext.tsx` que todavía nombraban
      el mock por nombre propio (quedaban desactualizados tras el swap, no eran parte formal de
      4.1 pero es el mismo commit y el mismo criterio).
- [x] 4.2 `PresupuestosRoute.test.tsx`: ajustar el doble inyectado. Los tests de comportamiento de la
      feature siguen corriendo contra dobles, **nunca** contra Supabase real. La aserción pasa de
      *"aparece el fixture precargado (`Gómez, Martina` / `OSECAC`)"* a *"el composition root monta y
      muestra el encabezado sin colgarse en 'cargando'"* — verifica cableado, no contenido de un
      fixture que ya no está en este camino (D9). Patrón ya resuelto en `ObraSocialesRoute.test.tsx`.
      **Hecho**: mismo patrón que `ObraSocialesRoute.test.tsx`, extendido porque acá hay dos vías de
      I/O distintas en el mismo composition root — `vi.mock('../../shared/lib/supabaseClient')`
      resuelve tanto `functions.invoke()` (presupuesto/autorizacion, Edge Functions) como
      `schema().from().select()` (paciente/obraSocial, PostgREST) a `{ data: [], error: null }`.
      1 test, verde.
- [x] 4.3 Grep dirigido: ningún archivo de `features/presupuestos/` importa `supabaseClient`,
      `SupabasePresupuestoRepository` ni `SupabaseAutorizacionRepository` salvo el composition root.
      Y **ningún** archivo de `features/presupuestos/` importa ya un mock (los cuatro salieron).
      **Hecho**: verificado con grep real (no de memoria). Primer check: solo
      `PresupuestosRoute.tsx` (import real) y `PresupuestosRoute.test.tsx` (string de `vi.mock`, no
      import real del mock repository) mencionan esos tres nombres. Segundo check: cero coincidencias
      de los cuatro mocks en todo `features/presupuestos/` tras limpiar los comentarios de 4.1.
- [x] 4.4 Verificar que **`FacturacionRoute.tsx` sigue exactamente igual** (D11): sigue importando
      `mockPresupuestoRepository`/`mockAutorizacionRepository`. Es una tarea de **no hacer**, y está
      acá justamente para que quede constancia de que no se tocó por descuido.
      **Hecho**: `git diff -- frontend/src/features/facturacion/FacturacionRoute.tsx` sin salida
      (idéntico al último commit); confirmado además que sigue importando
      `mockPresupuestoRepository`/`mockAutorizacionRepository` de `shared/lib/mocks/`.
- [x] 4.5 Suite completa verde sin regresiones contra el baseline de la §3 + `npx tsc -b --noEmit` +
      `npx oxlint` limpios.
      **Hecho**: baseline re-medido al arrancar este batch: 224 archivos (222 passed, 2 failed) /
      1888 tests (1885 passed, 3 failed) — mismas 3 fallas preexistentes de siempre
      (`PermisosMatrizFields.test.tsx`, `ChecklistEditor.test.tsx`), nada relacionado con
      presupuestos. Suite final tras el swap: **exactamente el mismo conteo**, cero regresiones.
      `npx tsc -b --noEmit` limpio (0 errores). `npx oxlint` limpio (0 errores, exit 0; los únicos
      warnings son el patrón repo-wide preexistente `react(only-export-components)` en los
      `*RepositoryContext.tsx` — incluidos los dos de esta feature, ya documentados como
      preexistentes desde la §3 — más 3 warnings preexistentes de `no-unsafe-optional-chaining` en
      `hojas-de-ruta`, no relacionados con este batch).

## 5. Señalización de discrepancias en la UI

> Solo `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`. Nunca `style={{}}`, nunca
> markup de alerta propio. Revisar el catálogo del design system antes de escribir markup. Criterio de
> agrupación: **un cartel por grupo temático**, no uno por campo.

- [x] 5.1 `PresupuestoForm.tsx`: cartel del **archivo adjunto** (D5) — el archivo elegido todavía no se
      guarda en el servidor; el modelo real tiene una sola referencia (`archivo_url`) y la subida a
      Storage está pendiente de un change propio. **Es el cartel más importante del change.**
      *(Depende de la opción elegida en 0.3: con B, en vez de cartel va la deshabilitación del input.)*
      — **Hecho**: se fusionó con el `AvisoModeloDatos` preexistente de "archivo único" (mismo campo,
      mismo grupo temático) en vez de agregar un segundo cartel. Sigue habiendo un único `<div
      role="note">` en el formulario. Tests en `PresupuestoForm.test.tsx` (RED→GREEN→TRIANGULATE, +2).
- [x] 5.2 `AutorizacionForm.tsx`: mismo cartel del archivo adjunto. — **Hecho**, ver nota de 5.3 sobre
      la migración del bloque hand-rolled preexistente. Tests en `AutorizacionForm.test.tsx`.
- [x] 5.3 `AutorizacionForm.tsx`: revisar el `AvisoModeloDatos` **preexistente** sobre `vigenciaDesde`
      (lo puso `presupuestos-ui` diciendo que es *"un campo que el frontend agrega sobre el docx,
      pendiente de confirmar con backend"*). **Ya no es cierto**: `vigencia_desde` y `monto_autorizado`
      son columnas reales desde `C-06` (D13 #6). Actualizar el texto para que diga qué quedó resuelto
      — **no borrar el cartel entero sin leerlo**: la parte de "el docx no los tiene" sigue vigente.
      — **Hecho, con una decisión adicional documentada explícitamente**: el bloque preexistente NO
      era un `AvisoModeloDatos`, sino un `<div role="note">` hand-rolled con lista propia (3 items:
      Monto autorizado, Fecha de vigencia, Archivo) que además viola la regla dura de esta sección
      ("nunca markup de alerta propio"). Se migró el bloque completo a dos `AvisoModeloDatos`
      agrupados por tema (archivo por un lado — cubre 5.2 —, montoAutorizado+vigenciaDesde por el
      otro), en vez de solo tocar el texto in situ, porque dejar el hand-rolled block sin migrar
      mientras 5.2 agregaba un segundo cartel de archivo habría producido dos carteles distintos
      sobre el mismo campo. El texto de "pendiente de confirmar" se retiró; "el docx no los tiene"
      se conservó, reformulada como "no existen en el docx original". Tests en
      `AutorizacionForm.test.tsx` (RED→GREEN→TRIANGULATE, 2 carteles exactos, sin duplicados).
- [x] 5.4 `PresupuestoDetail.tsx`: cartel de que la pantalla ya lee datos reales del servidor mientras
      la validación de cupo de **Facturación** sigue leyendo datos de prueba (D11), para que nadie
      concluya de una pantalla lo que pasa en la otra. — **Hecho**: cartel nuevo arriba de las dos
      secciones (Presupuesto/Autorización), visible en alta y en edición. Tests en
      `PresupuestoDetail.test.tsx` (RED→GREEN→TRIANGULATE).
- [x] 5.5 Tests de los carteles siguiendo el patrón de `PacienteDetail.test.tsx`: escopear con
      `getAllByRole('note').find(...)` + `toHaveTextContent` (**no** `getByText` con regex — el texto
      usa `<strong>` y `getNodeText` de testing-library solo concatena los text nodes *directos*, así
      que un regex que cruza un límite `<strong>` no matchea), más un conteo `toHaveLength` para
      confirmar que ningún cartel se duplica. — **Hecho** como parte de 5.1-5.4 (mismo commit): cada
      cartel tiene su test de contenido con el patrón `find`+`toHaveTextContent` y su conteo
      `toHaveLength` (1 en `PresupuestoForm`, 2 en `AutorizacionForm`, 1 filtrado en
      `PresupuestoDetail`). +5 tests netos nuevos en total (2 en PresupuestoForm, +1 neto en
      AutorizacionForm tras reemplazar 3 tests del bloque hand-rolled por 4, 2 en PresupuestoDetail),
      0 regresiones (ver apply-progress).

## 6. Documentación (obligatoria, no opcional)

- [x] 6.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: bloque nuevo **"Presupuestos /
      Autorizaciones vs. esquema real de `C-06`"** con las 13 discrepancias de la tabla D13 de
      `design.md`, marcando cuáles quedan **resueltas** (#3 a #9) y cuáles siguen **abiertas** (#1/#2
      archivo, #10 dos patrones, #11 fuente mixta, #12 borrado). Mismo formato numerado que los
      bloques de `integracion-pacientes` / `integracion-obra-social`.
      **✅ Hecho (2026-08-05).** Bloque agregado en `knowledge-base/04_modelo_de_datos.md`
      §Discrepancias, entre el bloque de Hoja de Ruta/`C-10` y la sección "Función de alta"
      (~línea 611), mismo formato numerado 1-13 que los bloques de `integracion-pacientes`/
      `integracion-obra-social`. Incluye nota de estado explícita: 1B.4 (verificación con cuentas
      reales) no corrida todavía, así que la resolución de #8 está verificada por lectura de
      `pg_policies`, no por comportamiento observado en producción.
      **✅ Actualizado (2026-08-06, cierre del change)**: agregado el ítem **#14** (RN-GL-02,
      `usuario_id null` en `auditoria.logs`) y actualizada la nota de estado — 1B.4 ya se corrió y
      confirmó el punto (c) por comportamiento observado, no solo por lectura de `pg_policies`.
- [x] 6.2 `knowledge-base/04_modelo_de_datos.md`: sección nueva con el **contrato de las dos Edge
      Functions** (rutas, códigos, forma de `toApi()`), dejando escrito que el portón de autorización
      es `requirePermiso('presupuestos', …)` y que adentro se opera con `service_role` (D3).
      **Confirmar leyendo los `index.ts` reales antes de escribirlo**, no asumirlo del `design.md`.
      **✅ Hecho (2026-08-05).** Sección "### Edge Functions: `presupuestos` / `autorizaciones`
      (contrato del módulo Presupuestos)" agregada, leída directamente de
      `supabase/functions/presupuestos/index.ts` y `supabase/functions/autorizaciones/index.ts` (no
      del `design.md`). Confirma que el contrato real coincide con lo que `design.md` asumía (rutas,
      status codes, campos de `toApi()`, `MODULO = 'presupuestos'`, `service_role` interno). **Un
      hallazgo que `design.md` no tenía**: el docstring de cabecera de los dos `index.ts` dice "el
      módulo de permisos es 'facturacion'" — contradice su propia constante `MODULO = 'presupuestos'`
      dos líneas más abajo, y contradice el código realmente ejecutado. Documentado en la sección de
      arriba (§Presupuesto/Autorizacion), no solo acá.
- [x] 6.3 `knowledge-base/04_modelo_de_datos.md` §Presupuesto/Autorizacion: dejar escrito que las
      policies gatean por el módulo **`presupuestos`**, no `facturacion` como dice el comentario de
      `20260724100005_schema_facturacion.sql` — con la consecuencia práctica para perfiles que solo
      tienen `facturacion` (D11 punto 3).
      **✅ Hecho (2026-08-05).** Sección "### Presupuesto / Autorizacion — policies gateadas por
      `presupuestos`, no `facturacion`" agregada, con la consecuencia práctica (403 explícito, no
      `200 []`) y la nota de que todavía falta la confirmación empírica con cuenta real (1B.4).
      **✅ Actualizado (2026-08-06)**: la confirmación empírica con cuenta real (1B.4(c)) ya se corrió
      — actualizado el texto para reflejarlo.
- [x] 6.4 `CHANGES.md` §`C-06`: bullet nuevo con el estado de `integracion-presupuestos` (mismo estilo
      que el bullet `🔶 Propose completo del swap de backend` de §C-07), más un bullet
      `⏳ Pendiente de decisión` con las cinco aprobaciones de la §0. Actualizar también la **fila 5**
      del §Plan de integración Backend↔Frontend, que hoy dice `🔴 bloqueado`.
      **✅ Hecho (2026-08-05), con una desviación deliberada respecto del enunciado literal**: las
      cinco aprobaciones de §0 ya están **todas** resueltas (aprobadas 2026-08-02) — un bullet
      `⏳ Pendiente de decisión` listándolas habría sido stale. En su lugar se agregaron dos bullets
      nuevos en `CHANGES.md` §C-06: uno `🔶 Swap de backend en vivo, verificación manual pendiente`
      (estado real de las secciones 0-5, ya completas y en producción) y uno `⏳ Pendiente` con lo que
      genuinamente falta (`1B.4`, postergada por decisión explícita de la usuaria; secciones 6-7 de
      `tasks.md`). La fila 5 del §Plan de integración se actualizó de `🟢 listo para /opsx:apply` (ya
      no decía `🔴 bloqueado` al llegar acá — quedó actualizada por un batch anterior tras el portón de
      governance) a `🔶 swap en vivo, verificación manual pendiente`.
      **✅ Actualizado (2026-08-06, cierre del change)**: reemplazados ambos bullets por un único
      bullet `✅ Completo y archivado`, con las dos desviaciones deliberadas (verificación por `curl`
      en vez de navegador, RN-GL-02 parcial) documentadas explícitamente, más los datos de prueba y
      el permiso modificado en producción. Fila 5 del §Plan de integración actualizada a `✅ completo
      y archivado`.
- [x] 6.5 `CHANGES.md` §`C-07`: anotar en el bullet de `integracion-facturacion` que su **D9 cambia de
      forma** cuando este change se cablee (las autorizaciones dejan de ser fixture del lado de
      Presupuestos; la trampa de RLS queda verificada y cerrada; y su remedio pasa a ser cambiar dos
      líneas de `FacturacionRoute.tsx`). **No editar `integracion-facturacion/` en sí** — es un change
      abierto de otro dominio, con su propio portón de governance.
      **✅ Hecho (2026-08-05).** Nota de coordinación agregada como sub-bullet del bullet D9 existente
      en §C-07, con los tres puntos pedidos (fuente mixta cambia de forma, trampa de RLS cerrada,
      remedio reducido a 2 líneas) y la advertencia de que 1B.4 todavía no se corrió.
      **Confirmado: `openspec/changes/integracion-facturacion/` no se tocó** (ningún archivo de ese
      directorio fue leído ni editado en este batch, solo `CHANGES.md`).
- [x] 6.6 `knowledge-base/10_preguntas_abiertas.md`: agregar las preguntas nuevas de §Open Questions
      —unificación Edge Functions vs. PostgREST (D12), subida a Storage (D5), siembra de datos (D9),
      `delete()` en las interfaces, orden del listado de autorizaciones, y dueño del contrato de las
      Edge Functions— con su decisor nombrado. **Ninguna se cierra acá.**
      **✅ Hecho (2026-08-05).** Sección nueva "## Preguntas nuevas — `integracion-presupuestos`
      (2026-08-05)" agregada antes de "## Insumos pendientes del cliente", con las 6 preguntas de
      `design.md` §Open Questions, cada una con decisor nombrado, ninguna cerrada.
      **✅ Actualizado (2026-08-06, cierre del change)**: agregada una 7ª pregunta —RN-GL-02,
      `usuario_id` null en auditoría, decisor Enzo/backend— surgida de la verificación con cuentas
      reales de 1B.4.
- [x] 6.7 `ROADMAP-FRONTEND.md` §FASE FE-8: actualizar la fila de `C-06`. **Marcarla `✅` solo si las
      §4 y §7 están realmente completas**; si 1B.3/1B.4 siguen bloqueadas por backend, usar
      `🔶 En progreso` con el detalle de qué está hecho y qué falta — mismo criterio (y misma
      desviación deliberada) que la tarea 7.7 de `integracion-obra-social`: no afirmar en un documento
      que otros agentes usan como fuente de verdad algo que no es cierto.
      **✅ Hecho (2026-08-05).** Fila de `C-06` actualizada de `⏳ Pendiente` a `🔶 En progreso`, con
      el detalle de qué está hecho (secciones 0-5, migración de índices aplicada, suite/tsc/oxlint
      limpios) y qué falta (1B.4 postergada explícitamente por la usuaria, sección 7). **No marcada
      `✅`** porque ni la §4 (el swap) tiene su precondición de `tasks.md` (1B.4) cumplida, ni la §7
      (verificación) empezó.
      **✅ Actualizado (2026-08-06, cierre del change)**: fila marcada `✅ Completado y archivado`,
      con las dos desviaciones deliberadas documentadas en el mismo footnote, ahora que §4 y §7 están
      genuinamente completas.

## 7. Verificación

- [x] 7.1 `cd frontend && npx tsc -b --noEmit` sin errores (**nunca** `tsc --noEmit` a secas: el
      `tsconfig.json` raíz es de project references y sin `-b` compila cero archivos).
      **✅ Hecho (2026-08-05).** `npx tsc -b --noEmit` (con `-b`, confirmado): **limpio, 0 errores.**
- [x] 7.2 `cd frontend && npx oxlint` limpio (los warnings preexistentes de
      `react(only-export-components)` en los `*RepositoryContext.tsx` son ajenos a este change).
      **✅ Hecho (2026-08-05).** `npx oxlint`: **exit code 0, sin errores.** 18 warnings totales, los
      mismos ya documentados como preexistentes/ajenos en 3.11/4.5: `react(only-export-components)`
      en 13 archivos (incluidos `PresupuestoRepositoryContext.tsx` y
      `AutorizacionRepositoryContext.tsx` de esta feature, patrón repo-wide) +
      `no-unsafe-optional-chaining` (3 ocurrencias) en `SupabaseHojaDeRutaRepository.test.ts`
      (`hojas-de-ruta`, otro módulo). **Ninguna advertencia nueva.**
- [x] 7.3 Suite completa verde, sin regresiones contra el baseline de 0.7.
      **✅ Hecho (2026-08-05).** `NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`:
      **224 archivos (222 passed, 2 failed) / 1893 tests (1890 passed, 3 failed)**. Fallas idénticas
      por nombre a las de siempre — `PermisosMatrizFields.test.tsx` (1 test) y
      `ChecklistEditor.test.tsx` (2 tests), preexistentes, ajenas a `presupuestos`/`autorizaciones`.
      **Cero regresiones** contra el baseline real de 0.7 (219/1805, +26 de la §2, +62 de la §3, +5
      netos de la §5 = 224/1893, aritmética consistente batch a batch). Confirmado además dentro del
      ensayo de 7.7: una corrida bajo la sandbox reportó una falla adicional transitoria
      (3 archivos/4 tests) que **no se reprodujo** en una segunda corrida inmediata (volvió a
      224/2 · 1893/3, mismos nombres) — descartada como flakiness de recursos bajo carga, mismo
      patrón ya documentado en 2.7, no una regresión real.
- [x] 7.4 Cobertura final sobre `shared/lib/presupuestos/` ≥ 85 %, con los gaps residuales
      justificados uno por uno (no inflar con tests tautológicos).
      **✅ Hecho (2026-08-05).** `npx vitest run --coverage src/shared/lib/presupuestos`: **8 archivos
      de test, 96 tests, todos verdes.** Cobertura agregada: **95 % statements (190/200) / 93.03 %
      branch (147/158) / 100 % funcs (34/34) / 99.35 % lines (153/154)** — las cuatro métricas por
      encima del piso de 85 %. Los tres archivos de la §3 (`edgeFunctionErrors.ts`,
      `SupabasePresupuestoRepository.ts`, `SupabaseAutorizacionRepository.ts`) siguen en 100 % en las
      cuatro métricas (sin cambios desde 3.11). Quedan dos residuales, ambos de la §2, **justificados
      individualmente en vez de tapados con tests tautológicos**:
      - `presupuestoMapping.ts` (86.48 % stmts / 83.33 % branch, línea 40 sin cubrir): rama `catch` de
        `mapArchivoUrl` cuando `decodeURIComponent` tira `URIError` por un `%` mal formado en la URL.
        Es manejo defensivo de un caso que no puede ocurrir con URLs bien formadas emitidas por el
        propio backend (`archivo_url` sale de Storage/Postgres, no de input arbitrario de usuario) —
        comportamiento real pero de un camino de error que ningún dato observado hasta ahora ejercita
        (1.5/1B.1: `presupuesto`/`autorizacion` en 0 filas). No se agrega un test solo para tocar la
        línea porque forzar un `%` mal formado sintéticamente no prueba nada que el propio código no
        documente ya inline (comentario en la línea 38).
      - `autorizacionMapping.ts` (88.88 % stmts / 86.36 % branch, líneas 120/122/125-126 sin cubrir):
        4 de las 7 ramas `if (cambios.X !== undefined)` de `toActualizarAutorizacionPayload`
        (`presupuestoId`, `fechaRespuesta`, `cupoMensualDias`, `cupoMensualKm`) no tienen un caso
        propio — el TRIANGULATE de 2.6 cubrió explícitamente solo `estado`/`montoAutorizado`/
        `vigenciaDesde`/objeto vacío, dejando afuera las otras 4 claves del mismo patrón de guard
        clause repetido 7 veces. Es la misma línea de código repetida con distinto nombre de campo,
        ya probada correcta 3 de 7 veces con el mismo mecanismo — un test más por cada campo
        restante sería exactamente el mismo assert con otro string, sin agregar cobertura de
        comportamiento nuevo (razón por la que 2.7/3.11 ya habían dejado este residual fuera de
        alcance en sus batches). Se documenta el gap en vez de agregar 4 tests tautológicos.
- [x] 7.5 **⚠️ Verificado a nivel Edge Function (2026-08-06), NO literalmente en el navegador.** Los
      mismos 9 puntos de esta tarea se probaron por `curl` directo con tokens de sesión reales de las
      3 cuentas — ver el detalle completo en **1B.4**, que cubre exactamente este contrato (write
      crea/edita/lee; read no puede escribir y no hay guardado fantasma; facturación-sin-presupuestos
      da 403 explícito, no lista vacía; el mensaje de RN-PA-01 llega traducido). **Lo que esta
      verificación NO prueba, por no haber sido clickeada en la UI real**: que la pantalla de
      Presupuestos efectivamente desaparezca del menú para la cuenta sin permiso, que el botón de
      guardar de la cuenta read no dé una falsa sensación de éxito en la interfaz, y cualquier otro
      comportamiento que viva en el componente React y no en la Edge Function. Decisión de la usuaria
      (2026-08-06): dar esto por suficiente y no hacer la pasada adicional por el navegador. La
      pantalla arranca con los 2 presupuestos de prueba de 1B.4 (no 0) — no es la condición D9 original
      pero tampoco es una regresión, son datos reales dejados a propósito.
- [x] 7.6 **Confirmado (2026-08-06)** contra `auditoria.logs`: el alta y la edición de 1B.4(a) dejaron
      rastro (`INSERT`/`UPDATE` con `datos_nuevos` correctos). **Con el hallazgo de 1B.4(i)**:
      `usuario_id` queda `null` en ambas filas — el trigger no es compatible con escrituras vía
      `service_role`. RN-GL-02 se cumple parcialmente (registra el *qué*, no el *quién*) — ver la nota
      completa en 1B.4(i) y el nuevo ítem en `10_preguntas_abiertas.md` (6.6/1B.5).
- [x] 7.7 Ensayo de rollback: revertir `PresupuestosRoute.tsx` a los cuatro mocks, correr
      `npx tsc -b --noEmit` y la suite, confirmar que todo queda verde, y volver a aplicar el
      cableado real confirmando que queda idéntico al estado previo. Los índices no hace falta
      revertirlos.
      **✅ Hecho (2026-08-05).** Backup del archivo real guardado fuera del repo; reemplazado por
      `git show HEAD:.../PresupuestosRoute.tsx` (el scaffold original de los cuatro mocks —
      `mockPresupuestoRepository`/`mockAutorizacionRepository`/`mockPacienteRepository`/
      `mockObraSocialRepository` —, dado que el swap de 4.1 todavía no tiene commit propio, sigue en
      el working tree). Con mocks: `npx tsc -b --noEmit` **limpio, 0 errores**; suite completa
      **224 archivos (222 passed, 2 failed) / 1893 tests (1890 passed, 3 failed)** — **idéntico** al
      baseline de 7.3, mismas 2 fallas preexistentes por nombre, ninguna regresión inducida por el
      rollback. Restaurado el cableado real desde el backup (`cp`, no reescritura a mano, para
      eliminar cualquier riesgo de diferencia invisible); **`md5` del archivo restaurado idéntico al
      del archivo antes de empezar el ensayo** (`dc7fc1013dcabca7451b475096bbf676`), y
      `git diff -- frontend/src/features/presupuestos/PresupuestosRoute.tsx` da exactamente el mismo
      diff (mismos hashes `25e40ca..d3fdf62`) que existía antes de arrancar este ensayo — **swap
      cleanly reversible en ambos sentidos, estado final = cableado real, no mocks.** `npx tsc -b
      --noEmit` re-confirmado limpio después de restaurar. No se tocó ningún otro archivo del repo
      durante el ensayo (verificado con `git status --short` antes/después).

## 8. Cierre y archivo (2026-08-06)

- [x] 8.1 Todas las secciones 0-7 confirmadas completas (81/81 tareas). Delta specs de las 6
      capabilities fusionados en `openspec/specs/{presupuesto,autorizacion}-*/spec.md` (4 existentes
      mergeadas, 2 nuevas creadas). Change movido a
      `openspec/changes/archive/2026-08-06-integracion-presupuestos/`.
