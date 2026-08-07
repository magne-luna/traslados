# Tasks — integracion-obra-social

> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net (`cd frontend && npx vitest run`) y se registra el baseline. **No caer en
> Standard Mode.** Test runner: `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE MEDIO** (declarado para `C-04` en `CHANGES.md`). Las decisiones **D3**
> (get-or-create sobre el catálogo compartido con Pacientes) y **D8** (Prestadores fuera de scope) de
> `design.md` se ponen a revisión de la usuaria en la tarea **0.1**, **antes** de escribir código.
> No avanzar a la sección 3 sin respuesta.
>
> **⚠️ Las migraciones NO las aplica el agente.** Las corre la usuaria / Enzo (backend): el sandbox
> no tiene Docker ni credenciales del proyecto real. Las verificaciones de RLS con cuentas reales son
> tareas de coordinación explícitas (§1B.5 a §1B.8), no pasos escondidos dentro de otra tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo change;
> type-check con `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional Commits.
>
> **Orden de fases pensado para no dejar el árbol a medias**: la §2 (campos del docx) es
> **enteramente sobre el mock** y termina con la app funcionando igual que antes, con 4 campos más.
> El swap real ocurre recién en la §5. Cada fase es revertible por sí sola.

## 0. Checkpoint de diseño (antes de escribir código)

- [x] 0.1 **Confirmado por la usuaria antes de este batch de apply** (2026-07-31): D3 (get-or-create
      sobre `tipos_documento`, propuesta A + cartel) y D8 (Prestadores fuera de scope, change propio
      `prestadores-crud`). No se volvió a preguntar.
- [x] 0.2 **Hecho.** `package.json` fija `^2.49.4` (mismo que `integracion-pacientes`, sin cambios de
      versión desde el 2026-07-30). Los hallazgos de la tarea 0.2 de `integracion-pacientes` siguen
      vigentes (ninguno afecta `schema()`, embeds, `maybeSingle()` o `rpc()`; el aviso de "tablas no
      expuestas por defecto" ya estaba contemplado). Nada nuevo desde entonces.
- [x] 0.3 **Hecho.** Baseline medido con `NODE_OPTIONS="--no-experimental-webstorage" cd frontend &&
      npx vitest run` (ver hallazgo de entorno más abajo): **1430 tests passing / 198 test files, 0
      fallos preexistentes reales.** Sin el flag `NODE_OPTIONS`, ~112 tests fallan por un bug de
      infraestructura del sandbox (Node v26 + jsdom 29 + vitest 4: el `localStorage` experimental
      nativo de Node shadowea el de jsdom) — no es una regresión de código, está diagnosticado y
      documentado en `CHANGES.md`, no se "arregló" tocando `vite.config.ts` compartido con el
      trabajo en paralelo de `vehiculo-mantenimiento-registro`.

## 1. Precondiciones del backend (verificar, no modificar)

> **Hallazgo que cambia el resto de la sección 1B**: a diferencia de lo asumido, el CLI de Supabase
> del sandbox SÍ tiene sesión autenticada contra el proyecto real (`pkryfoljypuzfifofdwp`) vía
> `supabase db query --linked` (solo lectura — nunca se corrió DDL/`db push` desde el agente, por
> regla de governance explícita, no por límite técnico). Se usó para verificar de verdad, no asumir.

- [x] 1.1 **Hecho.** `curl` con la `anon key` (`supabase projects api-keys`) contra
      `GET /rest/v1/obra_social?select=id&limit=1` con `Accept-Profile: obra_social` →
      `401 {"code":"42501","message":"permission denied for schema obra_social"}` — **no**
      `PGRST106`/`PGRST205`. Control negativo contra `Accept-Profile: modulos` → `404 PGRST205`
      ("Could not find the table"). Conclusión: `obra_social` **está expuesto**.
- [x] 1.2 **Hecho**, vía `supabase migration list --linked`. El desfasaje conocido de
      `integracion-pacientes` 1B.3 sigue igual: 12 versiones con `local: ""` (aplicadas al remoto
      entre 2026-07-29 10:00 y 2026-07-30 15:00 sin commitear) más `20260730180000` con
      `remote: ""` (`crear_paciente_completo`, commiteada pero sin aplicar formalmente vía historial
      — igual la función SÍ existe en la base real, confirmado por 1.4). No se corrió
      `supabase migration repair` (es una decisión de backend, no de este change).
- [x] 1.3 **Hecho — y es el hallazgo más importante del apply.** `select count(*)` contra las 4
      tablas: `obra_social` 0 filas, `tipos_documento` **3 filas** (`asistencia`, `CODEM`,
      `comprobante ARCA` — semilla de backend, no del fixture de OSECAC), `requisitos_os` 0,
      `prestadores` 0. Verificando columnas reales (`information_schema.columns`,
      `pg_attribute`/`format_type`) se encontró que el schema real **ya tiene aplicadas** casi todas
      las columnas/tabla que `design.md` D4/D6 planeaba agregar, con nombres/tipos distintos de los
      asumidos, y una **contradicción directa con D12**. Detalle completo, con las consecuencias
      para 1B.1/1B.4 y para el frontend, en `knowledge-base/04_modelo_de_datos.md` §Discrepancias
      (bloque "Obras Sociales vs. esquema real de `C-04`", discrepancias nuevas #16/#17) y en
      `CHANGES.md` §C-04. Resumen: `tipo_factura`→`tipo_comprobante` (enum
      `facturacion.tipo_factura`, ya retipada); `plazo_cobro_dias`/`modalidad_facturacion`
      (enum)/`admite_pagos_parciales`/`identificador_origen` (enum) ya existen con los defaults de
      D4; `requisitos_os.orden`/`.requerido` ya existen; la tabla nueva es `plantilla_campo` (no
      `campos_plantilla_factura`); y `obra_social.formato_identificador_afiliado` (D12) **no
      existe** — en cambio `coberturas_paciente.formato_afiliado` (NOT NULL, sin default) ya existe,
      resolviendo RN-ID-02 al revés de D12. No se insertó ni modificó nada.
- [x] 1.4 **Hecho**, vía `select tablename, policyname, cmd, roles from pg_policies where
      schemaname = 'obra_social'`. Las policies vigentes de las 4 tablas del `20260724100003`
      siguen iguales (`Read`/`Write ... FOR ALL/SELECT TO authenticated USING
      (tiene_permiso('obra_social', ...))`), y la tabla nueva `plantilla_campo` **ya tiene** sus
      propias policies `Read plantilla_campo`/`Write plantilla_campo` con el mismo predicado — no
      forman parte de esta migración, ya estaban aplicadas. `permisos-modulos-granulares` no tocó
      el módulo `obra_social`, confirmado.

## 1B. Migraciones (governance MEDIO, pero toca RLS y un catálogo compartido)

> **⚠️ Regla dura del change**: las dos funciones son `SECURITY INVOKER`. Convertirlas a
> `SECURITY DEFINER` bypassearía RLS por completo (el owner es superusuario) y permitiría a
> cualquier usuario autenticado editar obras sociales **y escribir en `tipos_documento`, que es
> compartido con Pacientes**. No hacerlo bajo ninguna circunstancia, ni "temporalmente para probar".
>
> **⚠️ Toda tabla nueva define su RLS en el mismo archivo que la crea** (regla dura del proyecto).

- [x] 1B.1 **Adaptado tras el hallazgo de la tarea 1.3.** El schema real ya tenía aplicadas casi
      todas las columnas/tabla que este ítem pedía crear (ver detalle en 1.3 y en
      `knowledge-base/04_modelo_de_datos.md`). `20260731120000_obra_social_config_facturacion.sql`
      pasó a ser una migración de **reconciliación**: documenta exhaustivamente qué ya existía (con
      qué nombre/tipo real) y agrega únicamente lo genuinamente faltante (los 2 índices de 1B.3).
      **No se agregó** `formato_identificador_afiliado` (D12) — bloqueado por la contradicción con
      `coberturas_paciente.formato_afiliado` ya aplicada, documentado como discrepancia #16, sin
      resolver unilateralmente. `condicion_iva` sigue sin CHECK (D4, sin cambios).
- [x] 1B.2 **No aplica tal como estaba escrita.** `obra_social.plantilla_campo` (el nombre real de
      la tabla) ya tenía RLS habilitada + policies `Read`/`Write plantilla_campo` + trigger de
      auditoría aplicados antes de este change (confirmado con `pg_class.relrowsecurity`,
      `pg_policies`, `information_schema.triggers`). La migración 1B.1 documenta esto explícitamente
      (para que nadie la lea y crea que la tabla quedó sin RLS) en vez de re-crear objetos que ya
      existen.
- [x] 1B.3 **Hecho**, en el mismo archivo de 1B.1: `CREATE INDEX IF NOT EXISTS` sobre
      `requisitos_os.tipo_documento_id` y `plantilla_campo.obra_social_id` — confirmados
      genuinamente faltantes con `pg_indexes` (el índice único compuesto de `requisitos_os` no
      ayuda a un filtro solo por `tipo_documento_id`; `plantilla_campo` no tenía ningún índice
      además de la PK).
- [x] 1B.4 **Hecho**, adaptado a los nombres reales (`tipo_comprobante`, `plantilla_campo`, el
      payload de la plantilla anidado bajo `plantilla_factura.identificador_origen` + `.campos`).
      `20260731120001_obra_social_rpc.sql`: las dos funciones, `SECURITY INVOKER`,
      `SET search_path = ''`, get-or-create trim+lower sobre `tipos_documento`, semántica parcial
      con `?` de jsonb, códigos `45101`/`45102`/`45103`, `REVOKE`/`GRANT`/`COMMENT ON FUNCTION`.
- [x] 1B.5 **Hecho.** Los 6 puntos, verificados leyendo el archivo completo (no solo grep) y con
      el test automatizado `obraSocialMigrations.test.ts` (tarea 4.9): (1) `SECURITY DEFINER` solo
      aparece en comentarios/advertencias, nunca como cláusula activa — confirmado por el test que
      quita comentarios y strings antes de buscar; (2) `SET search_path = ''` en ambas funciones;
      (3) `REVOKE ALL ... FROM anon` explícito en ambas, sin ningún `GRANT` a `anon`; (4)
      `plantilla_campo` tiene RLS + policy `SELECT` + policy de escritura (ya existían, ver 1B.2);
      (5) ninguna policy usa `auth.role() = 'authenticated'` a secas ni `user_metadata` (confirmado
      leyendo `pg_policies` en 1.4); (6) ninguna migración existente (`20260724100003` y anteriores)
      fue editada — las dos nuevas son archivos separados. `supabase db advisors --linked --type
      security` corrido **antes** de aplicar: **15 hallazgos**, todos preexistentes y ajenos (7
      funciones `SECURITY DEFINER` legítimas × `anon`/`authenticated` + protección de contraseñas
      filtradas deshabilitada) — ninguno menciona `obra_social.crear_obra_social_completa` ni
      `actualizar_obra_social_completa` (esperado: no están aplicadas todavía).
- [x] 1B.6 **Confirmado aplicado (2026-08-06).** La nota "bloqueado" estaba desactualizada — Enzo ya
      había aplicado ambas migraciones. Verificado contra `pkryfoljypuzfifofdwp`: `select proname,
      prosecdef from pg_proc where proname in ('crear_obra_social_completa',
      'actualizar_obra_social_completa')` → ambas existen, `prosecdef = false` en las dos (SECURITY
      INVOKER confirmado). `supabase db advisors --linked --type security` → 15 hallazgos, idénticos
      a los de 1B.5, ninguno nuevo sobre estas funciones.
- [x] 1B.7 **No aplica — confirmado durante 1.3.** El segundo paso del expand/contract de
      `tipo_factura` era necesario solo si la columna seguía siendo `TEXT` con un `CHECK NOT VALID`.
      La columna real (`tipo_comprobante`) ya es el enum `facturacion.tipo_factura`
      ('A'/'B'/'C') — más estricto que un CHECK, sin filas que puedan violarlo. No hay nada que
      validar en dos pasos.
- [x] 1B.8 **Hecho (2026-08-06/07), verificado en vivo contra `pkryfoljypuzfifofdwp` vía REST/RPC
      con JWTs reales** (`andrea.test@gmail.com` = `obra_social: admin`; `rominaop@pastor.com` =
      `obra_social: read`, sin `write`). Los 6 puntos:
      (a) Andrea crea una obra social de prueba (`TEST-C04-1B8-BORRAR`) con un ítem de checklist →
      `200`, `id` devuelto, `select` posterior la ve completa;
      (b) Romina intenta crear → `403`, `code: 42501`, "new row violates row-level security
      policy" — **0 filas creadas**, `SECURITY INVOKER` funcionando;
      (c) Romina intenta `actualizar_obra_social_completa` sobre la obra social de Andrea → **no**
      da `42501` directo, da **`45103`** ("No existe una obra social con id...") — confirma
      exactamente la nota que dejó este ítem: el `UPDATE` afecta 0 filas por RLS y la función lo
      traduce a `45103`, mismo resultado neto (cero escrituras);
      (d) Andrea reordena el checklist (2 ítems, `orden` 5 y 1) → releído, el orden persiste exacto;
      (e) Andrea actualiza `telefono` sin incluir la clave `checklist` → releído, los 2 ítems del
      checklist siguen intactos (la trampa de jsonb de D6 no rompe nada);
      (f) alta con un ítem de checklist de nombre vacío → `400`, `code: 45101`, confirmado **0
      filas** en `obra_social` (`select` posterior sin resultados) — rollback atómico.
      Datos de prueba (obra social + 2 `tipos_documento` TEST del catálogo compartido) borrados al
      terminar.
      (g) `select proname, prosecdef from pg_proc where proname in ('crear_obra_social_completa',
      'actualizar_obra_social_completa');` → `false` en ambas;
      (h) `auditoria.logs` tiene el rastro completo del alta exitosa de (a) —incluidas las filas de
      `campos_plantilla_factura`— o **ninguno** de las fallidas.
- [x] 1B.9 **Hecho.** Actualizada la entrada de `knowledge-base/10_preguntas_abiertas.md` con el
      costo acumulado real: dos changes, **tres** funciones de escritura multi-tabla
      (`crear_paciente_completo`, `crear_obra_social_completa`, `actualizar_obra_social_completa`),
      siete changes de integración por delante en `CHANGES.md` §Plan de integración. No se montó
      pgTAP acá — la decisión sigue pendiente del equipo técnico, ahora con el dato actualizado.

## 2. Los 4 campos del docx + el formato de identificador de afiliado, sobre el mock (D9 + D12) — fase autocontenida y revertible

> **Safety net obligatorio antes de esta sección**: `cd frontend && npx vitest run`, comparar con el
> baseline de 0.3. Acá se tocan archivos existentes por primera vez.
>
> Al terminar esta sección la app funciona **exactamente igual que antes**, con 4 campos más y sin
> Supabase de por medio. Es un punto de corte limpio: si el swap se posterga, esta fase se puede
> commitear y dejar sola.

- [x] 2.1 **Hecho.** `codigo?`, `direccion?`, `telefono?`, `condicionIva?` agregados a `ObraSocial`,
      los cuatro opcionales; `condicionIva` es `string` libre. Comentario documenta que las 4
      columnas ya existen desde `20260724100003`.
- [x] 2.2 **Hecho.** Comentario de `cuit` reescrito: ya no afirma "del prestador", deja explícita la
      ambigüedad `obra_social.cuit` vs. `prestadores.cuit` sin resolverla (D8, discrepancia #12).
- [x] 2.3 **Hecho, TDD.** `SCHEMA_VERSION` 1 → 2. RED: test con `schemaVersion: 1` en localStorage
      (ya no coincide) → GREEN. Ver tabla de evidencia TDD.
- [x] 2.4 **Hecho.** Los 4 campos quedan `undefined` para OSECAC (ninguna fuente verificable) — test
      dedicado de que no se inventan valores.
- [x] 2.5 **Hecho, TDD.** `ObraSocialFormInput` ganó los 4 campos como opcionales (para poder pasar
      el `ObraSocialFormValues` completo); test de que vacíos no producen error.
- [x] 2.6 **Hecho, TDD.** Los 4 campos en `ObraSocialForm.tsx` (grupo "Datos Principales", reusando
      `Field`/`Input`). Tests: se renderizan, se editan, se propagan al submit, precarga en edición
      (con y sin los 4 campos completos).
- [x] 2.7 **Hecho, TDD.** Resumen de solo lectura de `ObraSocialDetail.tsx`: cada campo se omite si
      no está completo (en vez de un "—"), test de que no rompe con los 4 ausentes.
- [x] 2.8 **NO APLICA — D12 revertida (decisión de la usuaria, 2026-07-31).**
      `obra_social.formato_identificador_afiliado` **no existe** en la base real (ver 1.3/1B.1): en su
      lugar, `coberturas_paciente.formato_afiliado` ya resuelve RN-ID-02 del lado de Pacientes, al
      revés de lo que D12 había decidido. La usuaria confirmó dejar la realidad ya construida —
      `ObraSocial` **no** gana el campo `formatoIdentificadorAfiliado`. Ver design.md, bloque "❌ D12
      REVERTIDA". Documentado en `knowledge-base/04_modelo_de_datos.md` (discrepancia #16, cerrada) y
      `CHANGES.md` §C-04.
- [x] 2.9 **NO APLICA** — depende de 2.8, revertida.
- [x] 2.10 **NO APLICA** — depende de 2.8, revertida.
- [x] 2.11 **NO APLICA** — depende de 2.8, revertida.
- [x] 2.12 **NO APLICA** — depende de 2.8, revertida (no hay campo `formatoIdentificadorAfiliado` que
      sembrar en el fixture).
- [x] 2.13 **Hecho.** Suite sin regresiones contra el baseline de 0.3 (1430 → 1439 tras la §2, medido
      con el flag `NODE_OPTIONS` del hallazgo de entorno), `npx tsc -b --noEmit` y `npx oxlint`
      limpios.

## 3. Mapeo puro — `obraSocialMapping.ts` (TDD, sin red)

> **⛔ Precondición**: la tarea **0.1** (checkpoint D3/D8) debe estar respondida.
>
> Todas las tareas de esta sección: RED (test primero) → GREEN (mínimo) → TRIANGULATE (≥2 casos por
> comportamiento: happy path + borde) → REFACTOR. Archivo nuevo, no requiere safety net previo.

- [x] 3.1 **Hecho, adaptado a la columna real `tipo_comprobante`** (no `tipo_factura`, ver hallazgo
      de 1.3). TRIANGULATE cubierto: fila completa, 4 campos opcionales en `NULL`,
      `tipo_comprobante`/`modalidad_facturacion`/`identificador_origen` fuera de la unión (caen al
      default documentado), `plazo_cobro_dias` no numérico (default 90).
- [x] 3.2 `parseRequisitoRow`: fila de `requisitos_os` con su `tipos_documento` embebido →
      `ChecklistItem`. **`ChecklistItem.id` = `tipos_documento.id`**, no `requisitos_os.id` (D2 — es
      la decisión de clave menos obvia del change; que el test lo diga explícitamente en su nombre).
      TRIANGULATE: fila completa, fila sin `tipos_documento` embebido → descartada, fila con
      `requerido` en `NULL` → `true`.
- [x] 3.3 Orden del checklist: ordenar por `orden` asc con desempate por `id` (D2/RN-FA-08).
      TRIANGULATE: orden desordenado en la respuesta → se ordena; dos filas con el mismo `orden` →
      desempate determinista, dos llamadas dan el mismo resultado; colección vacía → `[]`.
- [x] 3.4 `parseCampoPlantillaRow` + orden de la plantilla: `origen` fuera de la unión cerrada
      `OrigenCampoPlantilla` (12 literales) se **descarta**, conservando los reconocidos.
      `PlantillaCampo.orden` viaja desde la columna. TRIANGULATE: campos válidos ordenados, uno con
      origen desconocido descartado, colección vacía.
- [x] 3.5 `ensamblarObraSocial(row)`: combinar todo en una `ObraSocial`, incluyendo
      `plantillaFactura.identificadorOrigen` desde `obra_social.identificador_origen` con el default
      documentado si el valor no pertenece a `IdentificadorOrigenFactura`. **`formatoIdentificadorAfiliado`
      no se mapea** — D12 revertida (2.8), el campo no existe en `ObraSocial`. TRIANGULATE: obra
      social completa, obra social sin checklist ni plantilla, obra social con una fila hija
      malformada (se descarta esa fila, el resto sobrevive).
- [x] 3.6 `toCrearObraSocialPayload(nueva: NuevaObraSocial)`: función pura que arma el **único
      argumento `jsonb`** de la RPC de alta. Claves en snake_case, **espejando exactamente** los
      `->>` de `20260731120001_obra_social_rpc.sql` (leer el archivo real, no inferirlo del
      `design.md`). El checklist viaja como array de `{ nombre, requerido }` con el `orden` derivado
      del índice del array — **no** se envía `ChecklistItem.id`, porque el id lo resuelve el
      get-or-create del servidor (D3). TRIANGULATE: obra social mínima, completa, y con checklist
      pero sin plantilla.
- [x] 3.7 `toActualizarObraSocialPayload(cambios: ActualizacionObraSocial)`: **la semántica parcial
      es lo que se está testeando**. Clave ausente ⇒ la clave **no aparece** en el jsonb; clave
      presente con array vacío ⇒ aparece con `[]` (significa "vaciar la colección"). TRIANGULATE con
      al menos: solo `nombre`, solo `checklist`, `checklist: []`, y un objeto vacío. Este es el test
      que impide borrar el checklist de alguien que solo editó el nombre (D6).
- [x] 3.8 REFACTOR + `npx tsc -b --noEmit` limpio. Anotar el conteo de tests nuevo.

## 4. Repository real — `SupabaseObraSocialRepository.ts` (TDD, con fake tipado)

> El fake del cliente Supabase se construye a mano con interfaces propias, **sin `any`, sin `as`**,
> siguiendo `frontend/src/shared/lib/pacientes/SupabasePacienteRepository.test.ts` como referencia de
> estilo (que a su vez sigue a `SupabaseCuentaRepository.test.ts`). Ojo con
> `erasableSyntaxOnly` de `tsconfig.app.json`: prohíbe propiedades de parámetro de constructor.

- [x] 4.1 Fake tipado del subconjunto de supabase-js usado: `schema().from().select()`, `.eq()`,
      `.maybeSingle()`, `.schema().rpc()`. El fake debe **registrar** todas las llamadas emitidas
      para que 4.5 pueda afirmar que el alta no hace inserts sueltos.
- [x] 4.2 `list()`: una sola consulta con los embeds de dos niveles de D5
      (`requisitos_os ( …, tipos_documento ( … ) )`). Test **anti N+1**: 3 obras sociales → una sola
      consulta a `obra_social.obra_social`, cero consultas adicionales por obra social o por
      colección. Test de error traducido si la consulta falla.
- [x] 4.3 `getById()`: `.eq().maybeSingle()`; resuelve `null` si no hay fila **y** si RLS la filtra —
      **nunca lanza** en ese caso. Tests separados para los dos caminos (son indistinguibles desde
      el cliente y el test debe dejar claro que eso es deliberado).
- [x] 4.4 `mapearErrorObraSocial`: traducir a los mensajes en castellano de la tabla de D7 —
      `23505` sobre `cuit`, `23505` sobre `tipos_documento.tipo`, `23503` (documento de paciente que
      usa el tipo), `42501`/`PGRST301` (RLS), `PGRST106` (schema no expuesto), `PGRST202` (RPC
      inexistente → 1B.6 sin aplicar), `PGRST204` (columna inexistente → 1B.1 sin aplicar), `45101`,
      `45102`, `45103`, más el genérico. Un test por rama + un test dedicado a que **no se filtra el
      texto crudo de Postgres** hacia la UI.
- [x] 4.5 `create()`: **una sola** llamada
      `supabase.schema('obra_social').rpc('crear_obra_social_completa', { p_os: … })` con el payload
      de 3.6, y después `getById(uuid_devuelto)` para devolver el estado real releído. Tests:
      (a) happy path devolviendo el `id` generado por la base; (b) **el fake registra exactamente
      una llamada `.rpc()` y CERO `.insert()`** sobre las cuatro tablas — este test es el que impide
      que alguien reintroduzca la secuencia de inserts; (c) relectura `null` → lanza (no se devuelve
      una `ObraSocial` inventada).
- [x] 4.6 `create()` — errores de la RPC. Un test por caso, todos verificando que **no** se emite
      ningún borrado compensatorio (la transacción del servidor ya hizo rollback): `23505` sobre
      `cuit`, `42501`, `45101`, `45102`, `PGRST202`, `PGRST204`.
- [x] 4.7 `update()`: una sola llamada
      `rpc('actualizar_obra_social_completa', { p_id, p_cambios })` con el payload de 3.7, y
      relectura final. Tests: clave ausente ⇒ el payload no la lleva (verificado sobre lo que el fake
      registró), `checklist: []` ⇒ sí la lleva, `45103` ⇒ mensaje idéntico al del mock
      (`No existe una obra social con id "…".`), relectura `null` ⇒ lanza.
- [x] 4.8 Test de código fuente vía `import … from './SupabaseObraSocialRepository.ts?raw'`: el
      archivo no contiene `service_role`, no contiene `any` **ni siquiera en los comentarios en
      castellano** (el regex `/\bany\b/` no distingue código de prosa — a `integracion-pacientes`
      3.12 le pasó y hubo que reescribir el comentario de cabecera), y no consulta `modulos.permisos`
      ni `modulos.modulos` (no duplica la autorización, `security-review`).
- [x] 4.9 Test de las dos migraciones como texto: `20260731120001_obra_social_rpc.sql` contiene
      `SECURITY INVOKER` y **no** contiene `SECURITY DEFINER` fuera de comentarios y literales, y
      `20260731120000_obra_social_config_facturacion.sql` contiene `ENABLE ROW LEVEL SECURITY` sobre
      `campos_plantilla_factura`. Es la **única barrera automatizada** contra la regresión de
      seguridad más grave del change (D10). **Usar `node:fs`, no `?raw`**: `integracion-pacientes`
      3.12b ya verificó empíricamente que `fs.allow` de Vite deniega rutas fuera de `frontend/`
      ("Denied ID"), y que el chequeo debe filtrar comentarios `--` y literales de cadena antes de
      buscar `SECURITY DEFINER`, porque el archivo **sí** menciona esa cadena en sus advertencias en
      castellano (un `.not.toContain` ingenuo da falso positivo).
- [x] 4.10 REFACTOR + `npx tsc -b --noEmit` y `npx oxlint` limpios. Cobertura del código nuevo ≥ 85 %
      (`npx vitest run --coverage` sobre `shared/lib/obrasSociales/`). **No** agregar tests
      tautológicos ni relajar aserciones para inflar el número: si falta cobertura, es
      comportamiento real sin test.

## 5. Cableado en el punto de composición — el swap real

> **Safety net obligatorio antes de esta sección**: `cd frontend && npx vitest run`, comparar con el
> conteo de la §4.
>
> **⛔ Precondición dura**: las tareas **1B.6** (migraciones aplicadas) y **1B.8** (verificación con
> cuentas reales) deben estar confirmadas. Sin las migraciones en la base, la pantalla queda con el
> alta rota (`PGRST202`) y el listado roto (`PGRST204`). **No dar esta sección por hecha antes.**

- [x] 5.1 `ObraSocialesRoute.tsx`: reemplazar `mockObraSocialRepository` por la implementación real.
      Actualizar el comentario del composition root para que refleje el estado nuevo (real para
      Obras Sociales; documentos siguen en mock), siguiendo el criterio de `CuentasRoute.tsx` y
      `PacientesRoute.tsx`.
- [x] 5.2 `ObraSocialesRoute.test.tsx`: ajustar el doble inyectado. Los tests de comportamiento de la
      feature siguen corriendo contra un doble, **nunca** contra Supabase real. Patrón ya resuelto en
      `PacientesRoute.test.tsx` / `router.cuentas.test.tsx`:
      `vi.mock('../../shared/lib/supabaseClient', …)` con `schema().from().select()` resolviendo
      `{ data: [], error: null }`. La aserción pasa de "aparece el fixture precargado" a "el
      composition root monta sin colgarse en 'cargando' y muestra el heading" — verifica cableado, no
      contenido de un fixture que ya no existe en este camino.
- [x] 5.3 Verificar que ningún otro archivo de `features/obras-sociales/` importa
      `SupabaseObraSocialRepository` ni `supabaseClient` (grep dirigido). Único resultado de
      producción esperado: el import nuevo de 5.1.
- [x] 5.4 Suite completa verde sin regresiones contra el baseline de la §4 +
      `npx tsc -b --noEmit` + `npx oxlint` limpios.

## 6. Señalización de discrepancias en la UI

> Solo `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`. Nunca `style={{}}`, nunca
> markup de alerta propio. Revisar el catálogo del design system antes de escribir markup. Criterio
> de agrupación: **un cartel por grupo temático**, no uno por campo (igual que `PacienteDetail`).

- [x] 6.1 `ChecklistEditor.tsx`: cartel sobre el **catálogo compartido** (D3) — el nombre del ítem se
      guarda en un catálogo de tipos de documento compartido con Pacientes, conviene revisar la
      ortografía, y un ítem ya usado por documentos de pacientes no se puede quitar del catálogo.
      Es el cartel más importante del change.
- [x] 6.2 `ObraSocialDetail.tsx`: cartel sobre la **ambigüedad del CUIT** (D8, discrepancia #12) — la
      base tiene `obra_social.cuit` y `prestadores.cuit` como columnas distintas y no está confirmado
      cuál representa este campo. Pendiente de confirmar con quien mantiene el docx.
- [x] 6.3 `ObraSocialDetail.tsx`: revisar los `AvisoModeloDatos` **preexistentes** (los puso
      `obras-sociales-ui` en 2026-07-24 sobre checklist / plantilla / modalidad, discrepancias 1 y 2
      del bloque ⚠️ de `CHANGES.md`). Varios de esos puntos **quedan resueltos por este change** (el
      checklist ya es relacional, las 4 columnas de negocio ya existen). Actualizar el texto para que
      diga qué quedó resuelto y qué sigue abierto — **no borrar el cartel entero sin leerlo**: parte
      de lo que dice sigue vigente.
- [x] 6.4 Tests de los carteles siguiendo el patrón de `PacienteDetail.test.tsx`: escopear con
      `getAllByRole('note').find(...)` + `toHaveTextContent` (**no** `getByText` con regex — el texto
      usa `<strong>` y `getNodeText` de testing-library solo concatena los text nodes *directos*, así
      que un regex que cruza un límite `<strong>` no matchea), más un conteo `toHaveLength` para
      confirmar que ningún cartel se duplica.

## 7. Documentación de las discrepancias (fuera del código)

- [x] 7.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: bloque nuevo "Obras Sociales vs.
      esquema real de `C-04`" con las 14 discrepancias de la tabla D11 de `design.md`, marcando
      explícitamente cuáles quedan **resueltas por este change** (#3 a #11) y cuáles siguen
      **pendientes de confirmar** (#12 CUIT ambiguo, #13 Prestadores, #14 condición IVA). Mismo
      formato numerado que los bloques de `facturacion-ui` / `integracion-pacientes`.
- [x] 7.2 `knowledge-base/04_modelo_de_datos.md`: sección nueva con el contrato de escritura del
      módulo — las dos funciones `obra_social.crear_obra_social_completa` /
      `actualizar_obra_social_completa`, dejando escrito que son **`SECURITY INVOKER` a propósito** y
      que convertirlas a `SECURITY DEFINER` bypassearía el gateo por módulo **y daría acceso de
      escritura al catálogo compartido con Pacientes**. Confirmar leyendo el `.sql` real antes de
      escribirlo, no asumirlo del `design.md`.
- [x] 7.3 `knowledge-base/04_modelo_de_datos.md` §ObraSocial: actualizar la entidad con los 4 campos
      del docx (código, dirección, teléfono, condición frente al IVA) y con el checklist modelado
      relacional contra el catálogo compartido. El bullet **Prestadores** de §Discrepancias, que hoy
      dice *"Sumarla como entidad cuando se construya C-04"*, pasa a decir **decidido: change propio
      `prestadores-crud`**, con las 3 razones de D8 y la pregunta abierta de la relación.
- [x] 7.4 `CHANGES.md` §`C-04`: reescribir el bloque `⚠️ Discrepancia` — los 4 puntos actuales pasan
      a: (1) **resuelto** (las 4 columnas de negocio están en la base, configurables); (2)
      **resuelto** (checklist relacional + orden + obligatoriedad); (3) **resuelto** (los 4 campos
      del docx están en el frontend); (4) **decidido** (Prestadores va a change propio, ver D8).
      Agregar los 3 puntos **nuevos** que este change abre y no cierra: CUIT ambiguo, valores de
      `condicion_iva`, y quién administra el catálogo `tipos_documento`.
- [x] 7.5 `CHANGES.md` §Plan de integración Backend↔Frontend: actualizar la fila 2 (Obra Social /
      C-04) con el estado real y qué queda pendiente de revisión manual de backend, con el mismo
      formato que usó la fila 1 para `integracion-pacientes`.
- [x] 7.6 `knowledge-base/10_preguntas_abiertas.md`: agregar las 3 preguntas nuevas (CUIT de la obra
      social vs. del prestador; valores de `condicion_iva`; administración del catálogo
      `tipos_documento`) y actualizar la entrada de pgTAP con el costo acumulado (1B.9) — estas
      **ninguna se cierra acá**. Además, **cerrar** la parte de IN-01 sobre el formato del afiliado
      (RN-ID-02): dejar escrito que quedó decidida el 2026-07-31 (se deriva de
      `obra_social.formato_identificador_afiliado`, D12) y que lo único pendiente es la ejecución del
      lado de Pacientes (`integracion-pacientes` §8). IN-01 en sentido estricto (qué campo va en la
      factura, `identificador_origen`) sigue abierta — no confundir las dos.
- [x] 7.7 `ROADMAP-FRONTEND.md` §FASE FE-8: actualizar la fila de `C-04`. **Marcarla `✅` solo si las
      secciones 5 y 8 están realmente completas**; si 1B.6/1B.8 siguen bloqueadas por backend, usar
      `🔶 En progreso` con el detalle de qué está hecho y qué falta — mismo criterio (y misma
      desviación deliberada) que la tarea 6.5 de `integracion-pacientes`: no afirmar en un documento
      que otros agentes usan como fuente de verdad algo que no es cierto.

## 8. Verificación

- [x] 8.1 `cd frontend && npx tsc -b --noEmit` sin errores (**nunca** `tsc --noEmit` a secas: el
      `tsconfig.json` raíz es de project references y sin `-b` compila cero archivos).
- [x] 8.2 `cd frontend && npx oxlint` limpio (los warnings preexistentes de
      `react(only-export-components)` en los `*RepositoryContext.tsx` son ajenos a este change).
- [x] 8.3 `cd frontend && npx vitest run` verde, sin regresiones contra el baseline de 0.3.
- [x] 8.4 **Hecho.** Cobertura final sobre `shared/lib/obrasSociales/`: **97.5% statements / 93.75%
      branches / 100% funciones / 100% líneas** (`npx vitest run --coverage`). Gaps residuales
      (líneas puntuales en `SupabaseObraSocialRepository.ts` y `obraSocialMapping.ts`) son ramas
      defensivas de códigos de error/valores fuera de unión genuinamente improbables desde la API
      pública — no se infló el número con tests tautológicos.
- [ ] 8.5 **PARCIAL — la parte de backend/permisos ya está cubierta por 1B.8** (alta/edición con
      `write` funciona, `read` sin `write` no escribe nada, `SECURITY INVOKER` confirmado). **Falta
      la parte genuinamente visual, requiere navegador**: drag-and-drop del checklist, editor de
      plantilla, y que el aviso de solo lectura de `gateo-obrasocial` se vea correctamente con una
      cuenta `read` — y confirmar que una cuenta con permiso de **otro** módulo (`pacientes`) no
      habilita esta pantalla en el router. Pendiente de un pase manual en `npm run dev`.
- [x] 8.6 **Hecho (2026-08-06/07).** Verificado en `auditoria.logs` contra `pkryfoljypuzfifofdwp`:
      el alta y las dos ediciones de `1B.8` dejaron rastro completo — `INSERT`/`UPDATE` en
      `obra_social`, `INSERT`/`DELETE` en `requisitos_os` (el reorder borra y reinserta), `INSERT`
      en `tipos_documento` por el get-or-create (2 filas nuevas, `TEST-doc-borrar`/`-2`), todo con
      `usuario_id` de Andrea. `plantilla_campo` no se ejerció en esta prueba (no se mandó
      `plantilla_factura` en el payload de test) pero su trigger de auditoría ya estaba confirmado
      preexistente por 1.3/1.4.
- [x] 8.7 **Hecho.** Se revirtió `ObraSocialesRoute.tsx` al mock (`mockObraSocialRepository`), se
      corrió `npx tsc -b --noEmit` (limpio) y `ObraSocialesRoute.test.tsx` (verde, el
      `vi.mock('supabaseClient')` queda inerte sin romper nada), y se volvió a aplicar el cableado
      real — confirmado idéntico al estado previo. Las migraciones no hace falta revertirlas.
- [x] 8.8 **Completo (2026-08-06/07), repetido post-aplicación.** `select proname, prosecdef from
      pg_proc where proname in ('crear_obra_social_completa', 'actualizar_obra_social_completa')` →
      ambas presentes, `prosecdef = false` en las dos (**SECURITY INVOKER**, nunca `DEFINER`).
      `information_schema.routine_privileges` → `EXECUTE` solo para `authenticated`/`postgres`,
      **`anon` sin `EXECUTE`**. `plantilla_campo`: `relrowsecurity = true`, 2 policies (`Read
      plantilla_campo`, `Write plantilla_campo`). `supabase db advisors --linked --type security` →
      15 hallazgos, idénticos a los de 1B.5/1B.6, ninguno menciona estas funciones.
