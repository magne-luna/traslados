# Tasks — integracion-facturacion

> **⛔ GOVERNANCE CRÍTICO — ESTE CHANGE NO ESTÁ APROBADO PARA APPLY.**
> Facturación es el dominio equivalente a *Billing* en la tabla de gobernanza del proyecto:
> **análisis solamente; cero código de aplicación sin aprobación humana explícita**. La sección **0**
> es un portón, no una formalidad: **ninguna tarea de la sección 1 en adelante puede ejecutarse hasta
> que la usuaria responda las cinco aprobaciones de `design.md` §Aprobaciones requeridas.**
> Si el apply arranca sin esas respuestas, se detiene y se pregunta.
>
> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true`. Toda tarea que escriba
> código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net y se registra el
> baseline. **No caer en Standard Mode.**
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> (el flag es obligatorio en este sandbox — ver 0.6).
>
> **⚠️ Las migraciones NO las aplica el agente.** Las corre la usuaria / Enzo (backend). Es
> governance, no un límite técnico: el CLI del sandbox tiene sesión válida contra el proyecto real y
> se usó **solo para lectura** durante el propose. Las verificaciones de RLS con cuentas reales son
> tareas de coordinación explícitas (§1B), no pasos escondidos dentro de otra tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo change;
> type-check con **`npx tsc -b --noEmit`** (con `-b`, nunca `tsc --noEmit` a secas — sin `-b` compila
> cero archivos y siempre reporta 0 errores); Conventional Commits; el docx manda en estructura y la
> KB en reglas de negocio, y toda discrepancia se documenta en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden de fases pensado para no dejar el árbol a medias**: las §3 y §4 escriben archivos que
> **nadie importa todavía** — la app sigue andando con mocks. El swap real ocurre en un único commit
> en la §5. Cada fase es revertible por sí sola.

---

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [x] 0.1 **Aprobación D3** — agregar la columna `facturacion.facturas.fecha_factura DATE` (nullable).
      Es la única modificación de schema del change y toca un dominio financiero.
      **Respondido 2026-08-12: sí.**
- [x] 0.2 **Aprobación D4** — crear las dos funciones RPC `SECURITY INVOKER`
      (`crear_factura_completa`, `actualizar_factura_completa`). Son código de servidor que escribe
      facturas, sin harness automatizado que las verifique.
      **Respondido 2026-08-12: sí.**
- [x] 0.3 **Aprobación D6** — incluir el swap de `CobroRepository` en este mismo change (el argumento
      de por qué es obligatorio y no opcional está en `design.md` D6).
      **Respondido 2026-08-12: sí, mismo change.**
- [x] 0.4 **Aprobación D9 (CHECKPOINT de mayor riesgo funcional)** — dejar la validación de cupo
      (RN-FA-02) operando sobre fuente mixta: facturas reales × autorizaciones de fixture, con cartel
      visible. Opciones A / B / C en `design.md` D9.
      **Respondido 2026-08-12: opción A (fuente mixta + cartel).**
- [x] 0.5 **Aprobación D10** — `CREATE INDEX` sin `CONCURRENTLY`, justificado en que las 6 tablas
      tienen 0 filas hoy. Se aparta de una regla dura de `database-schema-design`.
      **Respondido 2026-08-12: sí (re-verificar conteo en 1.4 antes de aplicar).**
- [x] 0.6 **Coordinación con backend (Enzo), previa a escribir el `.sql` de D3.** Confirmar que
      `fecha_factura` no está ya planeada con otro nombre. Es el aprendizaje directo de D12-revertida
      de `integracion-obra-social`: el schema real viene por delante del repo desde hace tres changes.
      **Respondido 2026-08-12: confirmado, no existe columna equivalente.**
- [x] 0.7 Revisar `https://supabase.com/changelog.md` por cambios en `schema()`, embeds,
      `maybeSingle()` o `rpc()` desde la última verificación (2026-07-31, `@supabase/supabase-js`
      `^2.49.4`). Registrar hallazgos o "sin novedades".
      **Verificado 2026-08-12.** Changelog público (`supabase.com/changelog.md`) revisado hasta la
      última entrada (2026-07-30) — sin novedades sobre `schema()`, embeds, `maybeSingle()` o `rpc()`.
      El `CHANGELOG.md` del propio paquete `@supabase/supabase-js` (más granular) sí tiene un cambio
      relevante para tener en el radar, aunque **no aplica a este change ni a la versión instalada**:
      `2.112.0` (2026-08-03) — *"postgrest: honour `throwOnError` when `maybeSingle` finds multiple
      rows"* (#2580). Los repositories de este change no usan `throwOnError`, y la versión realmente
      instalada en `node_modules` es **`2.110.8`** (no `2.112.x`) pese al `^2.49.4` del `package.json`
      — el lockfile la fija por debajo del último release. Sin cambios de firma en `schema()`, en la
      sintaxis de embeds ni en `rpc()`. `dist-tags.latest` real de npm hoy es `2.112.3`.
- [x] 0.8 **Safety net / baseline.** Correr
      `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run` y registrar el
      número exacto de tests y archivos. **No asumir el baseline** — hay trabajo concurrente de otra
      sesión sobre el repo (`CHANGES.md` §Plan de integración, fila 3). Sin el flag `NODE_OPTIONS`
      fallan ~112 tests por un bug de entorno diagnosticado (Node v26 + jsdom 29 + vitest 4: el
      `localStorage` nativo experimental de Node shadowea el de jsdom) — **no es regresión y no se
      "arregla" tocando `vite.config.ts`**, que es compartido con el trabajo en paralelo.
      **Ejecutado 2026-08-12, una sola corrida** (816.44s, ~13.6 min):
      **`Test Files: 4 failed | 245 passed (249)`** — **`Tests: 5 failed | 2506 passed (2511)`**.
      Las 5 fallas son **todas** en `src/features/obras-sociales/ChecklistEditor.test.tsx` (el mismo
      archivo aparece repetido en el log — mismo patrón: `getByRole('button', { name: /^agregar$/i
      })` no encuentra el elemento tras interacción previa del test). **No es el baseline de ~112
      fallas del bug de `localStorage`** (ese está evitado por el flag `NODE_OPTIONS`, confirmado: si
      fuera el bug de entorno serían ~112 fallas dispersas, no 5 concentradas en un solo archivo).
      Este es el **baseline real y exacto** contra el que se compara la §5.5 y la §8.1 de este change
      — **no asumir 0 fallas**: `ChecklistEditor.test.tsx` ya entra roto, ajeno a este change (es de
      `features/obras-sociales/`, no de `features/facturacion/`). Si §5.5/8.1 encuentran exactamente
      estas mismas 5 fallas y ninguna otra, **no hay regresión**.

---

## 1. Precondiciones del backend (verificar, no modificar)

> Todo lo de esta sección es **solo lectura**. Ninguna tarea acá corre DDL.

- [x] 1.1 Reconfirmar que el schema `facturacion` está expuesto en el Data API. Método verificado el
      2026-07-31: `curl` con la `anon key` contra
      `GET /rest/v1/facturas?select=id&limit=1` con `Accept-Profile: facturacion` →
      `401 {"code":"42501","message":"permission denied for schema facturacion"}` (**no**
      `PGRST106`/`PGRST205`). Control negativo con `Accept-Profile: obra_social` → `404 PGRST205`.
      **Reconfirmado 2026-08-12, idéntico resultado**: `facturacion` → `401 42501 "permission denied
      for schema facturacion"`; `obra_social` (control negativo) → `404 PGRST205`. Sin cambios.
- [x] 1.2 Revisar el estado del historial de migraciones (`supabase migration list --linked`) por el
      desfasaje ya conocido y **agravado** en este dominio: 2 tablas y 10+ columnas de `facturacion`
      existen en producción sin ninguna migración commiteada que las cree (discrepancia N6 de
      `design.md` D12). Registrar el estado, **no correr `migration repair`** (es decisión de backend).
      **Verificado 2026-08-12.** Todas las migraciones locales están sincronizadas con el remoto
      (`local === remote` en cada fila hasta `20260811110000`). **Pero hay 3 migraciones aplicadas al
      remoto sin archivo local**: `20260812120000` (`schema_pacientes_prestaciones`), `20260812130000`
      (`presupuesto_prestacion_id`) y `20260812140000` (`presupuesto_rpc`) — nombres consultados vía
      `supabase_migrations.schema_migrations`. **No son de este change** (son del change
      `presupuesto-prestaciones`, mergeado hoy mismo a `main` por otra sesión, confirmado por memoria
      de sesión). Se registran acá porque confirman que el patrón N6 (schema real por delante del repo
      sin migración commiteada) sigue activo **hoy**, en un dominio adyacente (`presupuesto`/
      `autorizacion`, ver 1.3/1.4 más abajo) — no se corrió `migration repair` ni ningún DDL.
- [x] 1.3 **Volver a verificar el schema real antes de escribir nada**, no confiar en lo capturado en
      el propose. Contra el proyecto vinculado, con `supabase db query --linked`:
      columnas de `facturacion.facturas` / `asistencia_prestacion` / `cobros`
      (`information_schema.columns`), los enums (`pg_enum`), las FK y CHECK (`pg_constraint`), los
      índices (`pg_indexes`), las policies (`pg_policies`), los GRANT
      (`information_schema.role_table_grants`) y los triggers. Comparar contra el bloque §Context de
      `design.md` y **reportar toda diferencia antes de continuar** — es el tercer change consecutivo
      en que la base va por delante del documento.
      **Verificado 2026-08-12.** `facturas` (19 columnas), `asistencia_prestacion` (7) y `cobros` (4)
      coinciden **exactamente** con `design.md` §Context: mismos nombres, tipos, nullability y
      defaults; **`fecha_factura` sigue sin existir** (confirma que D3 sigue siendo necesaria). Los
      tres enums (`estado_factura` 5 literales, `tipo_factura` A/B/C, `identificador_origen_factura`)
      coinciden byte a byte. FK, CHECK (`mes_facturado` 1..12) y triggers de auditoría
      (`trg_audit_facturas`/`_asistencia_prestacion`/`_cobros`, `AFTER INSERT/UPDATE/DELETE →
      auditoria.log_action()`) coinciden. Policies de `facturas`/`asistencia_prestacion`/`cobros`
      coinciden (`FOR ALL`/`SELECT`, `USING` sin `WITH CHECK`, `tiene_permiso('facturacion', …)`).
      GRANT a `authenticated` (INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER), **nada** a
      `anon` — coincide.
      **⚠️ Discrepancia real encontrada** (no es una regresión de este change, es deriva concurrente):
      `pg_indexes` sobre el schema `facturacion` ya **no** tiene "exactamente 7 índices: las 7 primary
      keys" como afirma `design.md` D10 §El hecho. Hoy tiene **11**: las 7 PK **más**
      `idx_autorizacion_presupuesto_id`, `idx_presupuesto_obra_social_id`,
      `idx_presupuesto_paciente_id` e `idx_presupuesto_prestacion_id` (esta última sobre una columna
      `presupuesto.prestacion_id` que `design.md` no menciona). Estos 4 índices son exactamente los
      que D10 marca como **"fuera de alcance, se reporta pero no se toca"** (de `C-06`) — los aplicó el
      change `presupuesto-prestaciones` (mergeado hoy, ver 1.2). **No afecta la decisión de D10**: las
      4 tablas que este change sí indexa (`facturas`, `asistencia_prestacion`, `cobros`,
      `documento_factura`) siguen sin ningún índice de FK, y ninguna de esas 6 columnas objetivo tiene
      índice todavía. Solo desactualiza la frase "7 índices = todas PK" del §Context de `design.md`, no
      su plan de acción.
      Policies de `presupuesto`/`autorizacion` reconfirmadas: `tiene_permiso('presupuestos', …)`, no
      `'facturacion'` — coincide con D9/N4.
- [x] 1.4 **Verificar `count(*)` de las 6 tablas de `facturacion`.** Es la condición que sostiene D10
      (índices sin `CONCURRENTLY`). Si alguna tiene filas en volumen, **la migración de índices se
      rehace con `CONCURRENTLY` fuera de transacción** y se vuelve a consultar a la usuaria.
      **Verificado 2026-08-12** (las 7 tablas del schema, no 6 — ver nota): `facturas` = 0,
      `asistencia_prestacion` = 0, `cobros` = 0, `documento_factura` = 0, `gastos_vehiculos` = 0.
      **⚠️ `presupuesto` = 2 y `autorizacion` = 2** (`design.md` D10/Risks decía "las seis tablas
      tienen 0 filas hoy" — ya no es cierto para estas dos). Sin impacto en D10: `presupuesto` y
      `autorizacion` están **fuera del alcance de índices de este change** (son de `C-06`, ya además
      indexadas por otro change, ver 1.3), y las **4 tablas que este change sí va a indexar**
      (`facturas`, `asistencia_prestacion`, `cobros`, `documento_factura`) siguen en **0 filas**. La
      condición de D10 (`CREATE INDEX` sin `CONCURRENTLY` porque las tablas objetivo están vacías)
      **sigue sosteniéndose** para el alcance real de la migración de este change. Se reporta el
      cambio de cifra igual porque D10 lo pide explícitamente como "condición de caducidad" a
      re-verificar.
- [x] 1.5 Confirmar que el módulo `facturacion` existe en `modulos.modulos` (verificado el
      2026-07-31) y averiguar qué permisos tiene realmente la cuenta *Facturación* de
      `VITE_TEST_ACCOUNTS` — en particular **si tiene o no `presupuestos: read`**, porque es la que
      expone la trampa de D9.
      **Reconfirmado 2026-08-12**: `modulos.modulos` tiene `facturacion` y `presupuestos` como
      módulos **distintos** (junto con `pacientes`, `obra_social`, `conductores`, `vehiculos`,
      `hojas_de_ruta`) — confirma la base de D9/N4.
      **⚠️ Discrepancia de setup, no de schema**: `VITE_TEST_ACCOUNTS` **no está definido** en
      `frontend/.env.local` (el archivo solo trae `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
      `VITE_GOOGLE_MAPS_API_KEY`; el `.env.local` fue modificado hoy 2026-08-12, probablemente por la
      sesión concurrente de `presupuesto-prestaciones`). No se pudo leer el email/password de la
      cuenta *Facturación* desde ahí. Se identificó igual el usuario real por `usuarios.usuarios`
      (`nombre = 'facturacion'`, `apellido = 'pastor traslados'`, sin exponer email/password —
      lectura directa de `auth.users` fue bloqueada por el sandbox por contener PII, correctamente) y
      se leyeron sus permisos reales en `modulos.permisos`:
      `facturacion: write`, `conductores: read`, `hojas_de_ruta: read`, `obra_social: read`,
      `vehiculos: write`. **`pacientes` y `presupuestos` no aparecen en absoluto** (ni `read` ni
      `write`) — confirma **empíricamente**, no solo en teoría, la trampa de D9/N4: esta cuenta puede
      escribir facturas pero **no** puede leer autorizaciones/presupuestos reales, así que cuando
      `C-06` se integre va a ver 0 autorizaciones en silencio, exactamente como predice `design.md`.
      **Acción recomendada para quien ejecute §1B**: restaurar/coordinar `VITE_TEST_ACCOUNTS` en
      `.env.local` antes de las verificaciones manuales de esa sección, o documentar el
      email/password por otro canal — sin eso, 1B.8-1B.12 y 8.3 no se pueden ejecutar desde la UI con
      el flujo de autocompletado.

## 1B. Migraciones y verificación manual (coordinación con backend)

> **Bloqueada por 0.1, 0.2, 0.5 y 0.6.** El agente **escribe** los `.sql`; **la usuaria / Enzo los
> aplica**. La verificación manual es un checklist de coordinación, no un paso automatizado.

- [x] 1B.1 **Hecho 2026-08-12.**
      `supabase/migrations/20260812150000_factura_fecha_emision_indices.sql`:
      `ALTER TABLE facturacion.facturas ADD COLUMN IF NOT EXISTS fecha_factura DATE;` (nullable, sin
      default, sin `NOT NULL`, per D3) + los **6 índices** de D10 (`facturas.paciente_id`,
      `facturas.domicilio_id`, `asistencia_prestacion.factura_id`, `cobros.facturas_id`,
      `documento_factura.factura_id`, `documento_factura.id_tipo_documento`), todos con
      `IF NOT EXISTS`, **sin `CONCURRENTLY`** — re-verificado contra 1.4: las 4 tablas objetivo de
      esta migración (`facturas`, `asistencia_prestacion`, `cobros`, `documento_factura`) siguen en
      **0 filas**; `presupuesto`/`autorizacion` (que sí tienen 2 filas cada una, ver 1.4) están
      **fuera del alcance** de esta migración, así que el criterio original de D10 se sostiene sin
      apartarse de él. Cabecera con qué agrega, por qué, rollback explícito
      (`DROP COLUMN` + `DROP INDEX` × 6) y la condición de caducidad del `CONCURRENTLY`. No toca
      ninguna columna, policy ni tabla existente.
- [x] 1B.2 **Hecho 2026-08-12.** `supabase/migrations/20260812160000_factura_rpc.sql` con
      `facturacion.crear_factura_completa(jsonb) RETURNS uuid` y
      `facturacion.actualizar_factura_completa(uuid, jsonb) RETURNS uuid`, `plpgsql`,
      **`SECURITY INVOKER` explícito**, `SET search_path = ''`, `REVOKE ALL … FROM PUBLIC, anon`,
      `GRANT EXECUTE … TO authenticated` y `COMMENT ON FUNCTION` con la prohibición de `DEFINER`
      escrita. Cabecera con bloque **⚠️⚠️** sobre el vector de bypass de RLS sobre datos financieros
      y el precedente engañoso de `facturacion.validar_autorizacion_monto()` (sí `DEFINER`,
      correcto por ser trigger de validación). Reemplazo completo del conjunto de asistencias
      (DELETE + INSERT en la misma transacción, D4); ambas releen y devuelven el registro final.
- [x] 1B.3 **Hecho 2026-08-12.** `actualizar_factura_completa` usa `p_cambios ? 'asistencias'`
      (operador `?` de `jsonb`) para distinguir clave ausente (no toca asistencias) de clave
      presente (reemplazo completo, incluso `[]`). Comentario SQL explícito sobre la trampa en la
      migración, y test dedicado en `facturaMigrations.test.ts` que verifica que el operador `?` se
      usa literalmente en el archivo.
- [x] 1B.4 **Hecho 2026-08-12.** Códigos `45201` (asistencia sin fecha/prestación), `45202`
      (`p_factura`/`p_cambios` no es objeto JSON), `45203` (`actualizar_…` con id inexistente/oculto
      por RLS) y `45204` (`mes_facturado` fuera de 1-12, defensa en profundidad sobre el `CHECK` de
      la tabla) — rango `452xx`, no colisiona con el `451xx` de `integracion-obra-social`.
- [x] 1B.5 **RED → GREEN, hecho 2026-08-12.**
      `frontend/src/shared/lib/facturacion/facturaMigrations.test.ts`, `node:fs` (no `?raw`), 10
      tests. **RED real**: se corrió con `SECURITY INVOKER` reemplazado temporalmente por
      `SECURITY DEFINER` en `20260812160000_factura_rpc.sql` → el test
      "declara SECURITY INVOKER…" falló (`expected 1 to be 2`), confirmando que la barrera detecta
      la regresión; se revirtió el cambio temporal y se corrigió de paso un regex demasiado amplio
      en el propio test (RED también en ese caso, por un bug propio, no del SQL). **GREEN**: los 10
      tests pasan contra el estado final de las dos migraciones
      (`NODE_OPTIONS="--no-experimental-webstorage" npx vitest run
      src/shared/lib/facturacion/facturaMigrations.test.ts` → `Test Files 1 passed | Tests 10
      passed`). `npx tsc -b --noEmit` y `oxlint` limpios sobre el archivo nuevo.
- [x] 1B.6 **Hecho 2026-08-12 — línea base únicamente** (no hay "después": este batch no aplica
      migraciones). `supabase db advisors --linked --type security --level warn --fail-on none` →
      **15 hallazgos preexistentes**, ninguno relacionado con `facturacion.crear_factura_completa` ni
      `actualizar_factura_completa` (no existen aún en la base real): 7×
      `anon_security_definer_function_executable` + 7× `authenticated_security_definer_function_executable`
      sobre funciones `SECURITY DEFINER` ya existentes y ajenas a este change
      (`auditoria.log_action`, `facturacion.validar_autorizacion_monto` — correcto, ver 1B.2 —,
      `modulos.tiene_permiso`, `usuarios.handle_new_user`/`prevent_rol_tampering`/`track_egreso`/
      `track_ingreso`) + 1× `auth_leaked_password_protection` (WARN, Auth-level, no de este dominio).
      El delta real (¿las dos funciones nuevas agregan o no un hallazgo `SECURITY DEFINER`?) se mide
      **después** de que la usuaria/Enzo aplique 1B.7 — queda pendiente como parte de esa tarea, no
      de esta.
- [x] 1B.7 **Aplicar las dos migraciones** — **la usuaria / Enzo**. Bloquea la §5.
      **Aplicado 2026-08-12** por Enzo vía `supabase db push --linked` (tras traer a esta rama las 3
      migraciones de `presupuesto-prestaciones` que faltaban localmente — sus PRs no están mergeadas a
      `main` todavía, así que esta rama no las tenía; commit `398824f`). Push exitoso, ambas
      migraciones aplicadas sin error.
- [ ] 1B.8 Verificación manual con la cuenta **Facturación** (`facturacion: write`): alta completa de
      una factura con 3 asistencias vía `POST /rpc/crear_factura_completa` → 1 fila en `facturas` y 3
      en `asistencia_prestacion`, con sus filas de auditoría. **Pendiente — la hace la usuaria en el
      navegador** (mismo criterio que `presupuesto-prestaciones`); bloqueada además por
      `VITE_TEST_ACCOUNTS` ausente de `frontend/.env.local` (ver hallazgo de la sección 1).
- [ ] 1B.9 Verificación manual con una cuenta con `facturacion: read` **sin** `write`: la misma
      llamada → `42501` y **cero** filas escritas en ambas tablas. **Pendiente — la hace la usuaria.**
- [ ] 1B.10 Verificación manual del caso que borra datos: `actualizar_factura_completa` con
      `{"estado":"facturado"}` (**sin** la clave `asistencias`) → las 3 asistencias **siguen ahí**.
      Repetir con `{"asistencias":[…2 filas…]}` → quedan exactamente 2. **Pendiente — la hace la
      usuaria.**
- [x] 1B.11 Verificación manual de la declaración de seguridad en la base:
      `select proname, prosecdef from pg_proc where proname in ('crear_factura_completa',
      'actualizar_factura_completa')` → **`false` en ambas, confirmado 2026-08-12.**
- [ ] 1B.12 Verificación manual de la trampa del embed (D5): con la cuenta Facturación, leer una
      factura con el embed de asistencias y confirmar que **no** vuelve con `asistencia_prestacion: []`
      cuando sí hay filas. (Hoy no puede fallar —las dos policies usan el mismo predicado— pero es el
      modo de falla "0 filas en silencio" que hay que dejar verificado.) **Pendiente — la hace la
      usuaria.**

## 2. Mapeo puro — `facturaMapping.ts` (TDD estricto, nadie lo importa todavía)

> Fase enteramente aditiva: la app sigue andando con mocks al terminarla.

- [x] 2.1 **RED** — `parseFacturaRow`: los 11 renombres de columna de D1 (`fecha_init`→`fechaInicial`,
      `fecha_tope`→`fechaTope`, `tipo`→`tipoComprobante`, `valor_km`, `cantidad_km`, `mes_facturado`,
      `anio_facturado`, `dependencia_y_retorno`, `fecha_estimada_cobro`, `fecha_factura`,
      `domicilio_id`). **GREEN → TRIANGULATE** (≥2 casos por comportamiento) **→ REFACTOR**.
      Hecho: `parseFacturaRow` en `facturaMapping.ts`, cubierto por `facturaMapping.test.ts`.
- [x] 2.2 **RED** — `estadoDesdeBase`: los **cinco** literales reales (`'a facturar'`, `'pendiente'`,
      `'facturado'`, `'cobrado'`, `'pagado parcialmente'`) + un literal desconocido → `'a-facturar'`.
      La función es **total**: nunca lanza. **GREEN → TRIANGULATE → REFACTOR**.
      Hecho: función total con `Map`, sin `Record` indexado (evita `undefined` de TS).
- [x] 2.3 **RED** — `estadoHaciaBase`: los 4 estados del dominio → los 4 literales con espacio.
      **Test explícito de que nunca emite `'pendiente'`.** Hecho, con test dedicado.
- [x] 2.4 **RED** — colapso de `identificador_origen` + `identificador_valor` en
      `identificadorFactura?: { origen, valor }`; con cualquiera de las dos en `NULL`, el campo queda
      **ausente** (no un objeto con string vacío). Hecho en `parseFacturaRow` vía
      `parseIdentificadorFactura` interna.
- [x] 2.5 **RED** — `parseAsistenciaRow` + ordenamiento client-side por `fecha` asc con desempate por
      `id`; `factura_sabados` → `facturaSabados`. Casos: colección vacía, fila malformada descartada
      sin romper la factura, dos asistencias con la misma fecha (orden estable entre lecturas).
      Hecho: `parseAsistenciaRow` exportada + `parseAsistencias`/`ensamblarFactura` para el orden.
- [x] 2.6 **RED** — **nullability (D11)**: fila con `monto`, `dias`, `valor_km`, `cantidad_km`,
      `prestacion`, `dependencia_y_retorno`, `mes_facturado`, `anio_facturado`, `domicilio_id`,
      `fecha_init`, `fecha_tope`, `tipo` y `estado` en `NULL` → factura coherente con el tipo
      (`''` para textuales, `0` para numéricos, `'a-facturar'` para estado), **cero `undefined`
      filtrándose**. Ídem `asistencia_prestacion.dependencia` / `.retorno`. Hecho, con test que
      afirma `Object.values(factura)` sin `undefined`.
- [x] 2.7 **RED** — `parseCobroRow`: `facturas_id` (**plural**) → `facturaId`, `monto_pagado` →
      `montoPagado`. Hecho.
- [x] 2.8 **RED** — `toCrearFacturaPayload`: `NuevaFactura` → `jsonb`, con las asistencias anidadas y
      el estado convertido por `estadoHaciaBase`. Hecho.
- [x] 2.9 **RED** — `toActualizarFacturaPayload`: **semántica parcial**. Clave ausente en el `Partial`
      → clave ausente en el `jsonb`. Clave presente con `undefined` → ausente. Clave presente con un
      array vacío → presente (significa "borrar todas las asistencias", y es intencional).
      **Es la trampa que borra datos: test dedicado, no un caso más.** Hecho: test dedicado
      `'EL CASO CRÍTICO: editar SOLO el estado ... NO manda la clave "asistencias"'` +
      test separado para array vacío presente.
- [x] 2.10 **RED** — `toCrearCobroPayload`. Hecho.
- [x] 2.11 `npx tsc -b --noEmit` limpio + `oxlint` limpio. **Cero `any`, cero `as` sobre datos externos.**
      Verificado: `tsc -b --noEmit` sin salida (exit 0); `oxlint` sobre los dos archivos nuevos sin
      salida. 43/43 tests verdes en `facturaMapping.test.ts`.

## 3. `SupabaseFacturaRepository.ts` (TDD estricto, nadie lo importa todavía)

- [x] 3.1 **Hecho 2026-08-12.** Fake tipado del cliente de supabase-js en
      `SupabaseFacturaRepository.test.ts` (interfaces propias, cero `any`, cero `as`), recortado al
      subconjunto real usado: `schema`, `from`, `select`, `eq`, `maybeSingle`, `rpc`, `insert`,
      `delete`. Registra cada llamada en `calls` (mismo molde que
      `SupabaseObraSocialRepository.test.ts`).
- [x] 3.2 **Hecho.** `list()`: una sola consulta a `facturacion.facturas` con el embed de
      asistencias (`SELECT_FACTURA_COMPLETA`). Test dedicado afirma
      `calls.filter((c) => c.op === 'select')` tiene longitud 1 (anti N+1, no solo el resultado).
- [x] 3.3 **Hecho.** `getById()`: fila → `Factura` (vía `ensamblarFactura`); sin fila → `null`, no
      lanza; RLS que filtra → también `null`, mismo camino de código, test separado (contrato
      explícito de la interfaz).
- [x] 3.4 **Hecho.** `listByPaciente()`: filtro `.eq('paciente_id', ...)` verificado explícitamente
      en el `RecordedCall.eq` de la consulta (no post-filtrado en memoria de `list()`).
- [x] 3.5 **Hecho.** `create()`: test dedicado verifica **exactamente una** `.rpc()`
      (`crear_factura_completa`) y **cero** `.insert()` (ninguno, ni sobre `asistencia_prestacion`
      en particular). Relee por el id devuelto vía `getFacturaById` y devuelve esa lectura.
- [x] 3.6 **Hecho.** `update()`: **exactamente una** `.rpc()` (`actualizar_factura_completa`, `p_id`
      + `p_cambios`); caso "EL CASO CRÍTICO: editar SOLO el estado" verifica que `p_cambios` NO
      tiene la clave `asistencias`; caso complementario verifica que `asistencias: []` SÍ viaja
      cuando está presente. **RED confirmado**: se forzó temporalmente el envío de
      `asistencias: []` siempre y el test del caso crítico falló como se esperaba
      (`expected ... to not have property "asistencias"`); revertido antes del commit.
- [x] 3.7 **Hecho.** Un test por código de D7: `42501`/`PGRST301`, `23503` sobre `paciente_id`,
      `23503` sobre `domicilio_id` (distinguidos por el texto de constraint del error crudo, nunca
      propagado), `23514`, `22P02`, `45201`, `45202`, `45203`, `45204`, `PGRST202`, `PGRST204`,
      `PGRST106`, y el fallback genérico distinguiendo `listar` (`getById`/`list`) de `guardar`
      (`create`/`update`). **TRIANGULATE** (`it.each` sobre los 12 códigos): ningún mensaje contiene
      nombre de tabla calificado, columnas snake_case ni jerga técnica en inglés (`schema`, `table`,
      `column`, `constraint`, `relation`, `permission denied`) — la palabra de dominio "facturas" en
      castellano queda explícitamente permitida.
- [x] 3.8 **Hecho — con `node:fs`, no `?raw`** (instrucción explícita de esta sesión de apply, pese a
      que el archivo vive dentro de `frontend/` donde `?raw` sí funciona; mismo patrón de
      `facturaMigrations.test.ts` 1B.5: `fileURLToPath(import.meta.url)` + `resolve`). Verifica que
      el archivo no contiene `service_role`, no contiene `\bany\b`, no crea su propio cliente
      (`createClient`) y sí importa el singleton de `../supabaseClient`, y que no consulta
      `.from('permisos')`/`.from('modulos')`/`schema('modulos')`.
- [x] 3.9 **Verificado.** `npx tsc -b --noEmit` sin salida (exit 0); `oxlint` sobre los dos archivos
      nuevos sin salida. Suite completa de `src/shared/lib/facturacion/`: **13 archivos / 151 tests,
      todos verdes** (incluye los 54 nuevos de `SupabaseFacturaRepository.test.ts`).

## 4. `SupabaseCobroRepository.ts` (TDD estricto — bloqueada por 0.3)

- [x] 4.1 **Hecho.** `list()`: una sola consulta sin filtro sobre `facturacion.cobros`
      (`SELECT_COBRO`, sin `.eq`). Test dedicado afirma `calls.filter(op==='select')` longitud 1 y
      `eq` vacío.
- [x] 4.2 **Hecho.** `listByFactura(facturaId)`: filtro `.eq('facturas_id', facturaId)` (plural).
      Test explícito que afirma la llamada exacta `['facturas_id', 'f-1']` y que **no** existe
      ninguna `.eq` con clave `'factura_id'` (singular) — el typo más silencioso posible.
- [x] 4.3 **Hecho.** `create()`: `.insert(toCrearCobroPayload(data))` + `.select().single()`,
      devuelve `parseCobroRow(fila)`. Test verifica payload snake_case exacto y que una relectura
      `null` sin error lanza en vez de inventar un `Cobro`.
- [x] 4.4 **Hecho.** `remove(id)`: `.delete().eq('id', id)`; test de `.eq` exacto y test de que una
      lectura posterior (mock con estado compartido) ya no incluye el cobro eliminado.
- [x] 4.5 **Hecho.** `42501`/`PGRST301` → `'No tenés permiso para modificar facturas.'` (mismo
      texto de D7, módulo `facturacion` comparte el mensaje de permiso de escritura); `23503` sobre
      `facturas_id` → mensaje **exacto** `'La factura de ese cobro ya no existe.'` (test con
      `toThrow(new Error(...))` para el string literal). Fallback genérico distingue `listar` de
      `guardar` (`create`/`remove`), igual que 3.7.
- [x] 4.6 **Hecho.** Test de coherencia: `listByFactura('f-1')` sobre un fake con 3 filas (2 de
      `f-1`, 1 de `f-2`) es idéntico a `list().filter(c => c.facturaId === 'f-1')`.
- [x] 4.7 **Hecho — con `node:fs`, no `?raw`** (mismo criterio que 3.8). Verifica: sin
      `service_role`, sin `\bany\b`, sin `createClient` propio (importa `../supabaseClient`), sin
      `.from('permisos')`/`.from('modulos')`/`schema('modulos')`.
- [x] 4.8 **Verificado.** `npx tsc -b --noEmit` sin salida (exit 0); `oxlint` sobre los dos archivos
      nuevos sin salida. Suite completa de `src/shared/lib/facturacion/`: **14 archivos / 181 tests,
      todos verdes** (151 previos + 30 nuevos de `SupabaseCobroRepository.test.ts`). RED real
      confirmado: el archivo de test se corrió antes de escribir `SupabaseCobroRepository.ts` y
      falló por módulo inexistente; tras implementar, los 30 tests pasaron en la primera corrida
      (GREEN sin iteración, mapeo reusado de `facturaMapping.ts` sin ajustes).

## 5. El swap (⚠️ el corte real — bloqueada por 1B.7)

> Un solo commit. A partir de acá la pantalla usa datos reales.

- [x] 5.1 **RED, verificado 2026-08-12.** `FacturacionRoute.test.tsx` **ya** inyectaba dobles vía
      `vi.mock('../../shared/lib/supabaseClient', …)` (mismo patrón usado por
      `supabasePacienteRepository`/`supabaseObraSocialRepository` desde el swap parcial del
      2026-08-05) — no acoplaba `mockFacturaRepository`/`mockCobroRepository` directamente en el
      test, así que no hizo falta tocar el archivo. Confirmado corriendo el test **antes** del swap
      de 5.2 (pasaba con los mocks) y **después** (pasa igual, ahora ejerce el mismo mock de cliente
      contra los repositories reales) — no hay commit intermedio real de "RED" propiamente dicho
      porque no había nada que romper: la inyección de dobles ya estaba resuelta por diseño.
- [x] 5.2 **Hecho 2026-08-12.** `FacturacionRoute.tsx`: `mockFacturaRepository` →
      `supabaseFacturaRepository`, `mockCobroRepository` → `supabaseCobroRepository`. Dos imports
      (de `shared/lib/facturacion/SupabaseFacturaRepository` y `.../SupabaseCobroRepository`) y dos
      props (`FacturaRepositoryProvider`/`CobroRepositoryProvider`). Los otros cinco repositories
      (Paciente, ObraSocial, Presupuesto, Autorizacion, Documento) y el fixture de feriados **no se
      tocaron**. `npx tsc -b --noEmit` limpio.
- [x] 5.3 **Verificado 2026-08-12.** `git diff --stat` contra el HEAD anterior: **un solo archivo
      cambiado**, `frontend/src/features/facturacion/FacturacionRoute.tsx` (+11/-9). Los 26
      componentes, 3 hooks, 2 contexts y 2 validadores de `features/facturacion/` quedan idénticos.
- [x] 5.4 **Verificado 2026-08-12.** `shared/lib/facturacion/` no aparece en el diff — ninguna de
      las 9 funciones puras (`calcularFechaEstimadaCobro`, `validarCupoFacturacion`,
      `estadoDerivadoFactura`, etc.) cambió. Ninguna regla de negocio se reimplementó en SQL: las dos
      migraciones de §1B solo agregan columna/índices/RPC de persistencia — la precedencia amparo >
      obra social > default sigue viviendo únicamente en `calcularFechaEstimadaCobro` (frontend).
- [ ] 5.5 **Ejecutado 2026-08-12, una sola corrida completa** (796.66s, ~13.3 min) —
      **NO coincide con el baseline de 0.8, PARADO sin commitear.**
      Resultado: **`Test Files: 4 failed | 249 passed (253)`** — **`Tests: 5 failed | 2643 passed
      (2648)`**. El conteo total de archivos/tests subió respecto de 0.8 (249→253 archivos,
      2511→2648 tests) por los tests nuevos de §1B/2/3/4 (`facturaMigrations`, `facturaMapping`,
      `SupabaseFacturaRepository`, `SupabaseCobroRepository`) — eso es esperado, no regresión.
      **El problema es la composición de las 5 fallas**, que ya NO son las mismas 5 del baseline:
      - 2 en `ChecklistEditor.test.tsx` (`sin permiso…` / `con permiso…`) — **coinciden** con el
        baseline (mismo archivo, mismo patrón `getByRole('button', { name: /^agregar$/i })` no
        encontrado tras interacción previa).
      - 1 en `PermisosMatrizFields.test.tsx` (`muestra un ícono de identidad por módulo…`,
        `expected 7 got 14`) — **NUEVA**, no está en el baseline.
      - 1 en `src/app/router.test.tsx` — **NUEVA**, no está en el baseline.
      - 1 en `src/app/router.cuentas.test.tsx` — **NUEVA**, no está en el baseline.
      **Triage acotado (sin arreglar nada):** re-corridos los 4 archivos sospechosos juntos en
      aislamiento → `router.test.tsx` y `router.cuentas.test.tsx` **pasan** solos (indicio de
      contaminación/flakiness entre suites en la corrida completa, no relacionado con este change).
      `PermisosMatrizFields.test.tsx` **falla también solo** (`expected 7 got 14`, un ícono
      duplicado por fila) — es una falla real, preexistente, **ajena a `features/facturacion/`**
      (pertenece a `features/cuentas/`, último tocado en el commit `2675693` de otra sesión, ninguna
      relación con el swap de esta tarea). `git diff --stat` de esta sesión confirma que
      `PermisosMatrizFields.tsx`/`.test.tsx` no fueron tocados. Ninguna de las 3 fallas nuevas está
      en `features/facturacion/`, `shared/lib/facturacion/` ni en el archivo que tocó esta tarea.
      **Conclusión: no es una regresión causada por el swap de `FacturacionRoute.tsx`**, pero
      **tampoco coincide exactamente con el baseline registrado en 0.8** — hay al menos una falla
      nueva y genuina (`PermisosMatrizFields.test.tsx`) y posible flakiness de entorno en los otros
      dos.
      **Decisión de la usuaria (2026-08-12): aceptar como flakiness/preexistente y commitear.**
      Mismo criterio ya usado en `presupuesto-prestaciones` para escalada de fallas bajo carga de
      máquina. Ninguna de las 3 fallas nuevas toca `features/facturacion/` ni
      `shared/lib/facturacion/`; `PermisosMatrizFields.test.tsx` queda registrado como falla
      preexistente ajena a este change, a investigar aparte (no en el alcance de
      `integracion-facturacion`).
- [x] 5.6 **Verificado 2026-08-12.** `mockFacturaRepository` (línea 61,
      `shared/lib/mocks/mockFacturaRepository.ts`) y `mockCobroRepository` (línea 58,
      `shared/lib/mocks/mockCobroRepository.ts`) siguen exportados, sin cambios, usables como
      dobles de test.

## 6. Carteles de discrepancia y de fuente mixta

- [x] 6.1 **RED → GREEN, hecho 2026-08-12.** `FacturaAvisoDiscrepancias.tsx`: **retiradas** las 4
      discrepancias que el schema real ya cerró (`asistencia_prestacion`, `documento_factura`,
      `fecha_estimada_cobro`, `cantidad_km` — las cuatro existen, verificado contra
      `information_schema.columns` en 1.3). RED confirmado: se actualizó
      `FacturaAvisoDiscrepancias.test.tsx` primero (6 tests nuevos afirmando ausencia del texto
      viejo/presencia del nuevo) y falló contra el componente sin tocar (6 failed); luego se
      reescribió el componente y los 9 tests del archivo pasaron.
- [x] 6.2 **RED → GREEN, hecho 2026-08-12.** Mismo commit/archivo que 6.1: **sumadas** las
      discrepancias vigentes en el mismo cartel único — el enum real conserva el literal
      `'pendiente'` que la app no modela por separado (N2, se lee como sinónimo de `a-facturar`,
      nunca se escribe), `fecha_factura` es un campo agregado sobre el docx (N1), y la factura no
      congela la obra social con la que se emitió (§Open Questions).
- [x] 6.3 **RED → GREEN, hecho 2026-08-12.** `AvisoModeloDatos` en `FacturaDocumentos.tsx` (D8)
      actualizado: ya no dice que "Factura todavía usa datos mock" (quedó desactualizado tras el
      swap de 5.2) — ahora dice explícitamente que los adjuntos de la factura todavía no se
      persisten junto con la factura real y remite al futuro change transversal de
      documentos/storage (mismo que Pacientes/Conductores/Vehículos). RED confirmado: test nuevo
      en `FacturaDocumentos.test.tsx` falló contra el texto viejo (1 failed) antes de reescribir el
      componente; GREEN con los 7 tests del archivo en verde.
- [x] 6.4 **RED → GREEN, hecho 2026-08-12.** `AvisoModeloDatos` sumado en `AlertaCupo.tsx` (D9,
      opción A confirmada en 0.4): mensaje en castellano sin tecnicismos internos ("el cupo
      autorizado que se compara acá puede no reflejar autorizaciones recientes… hasta que
      Presupuestos y Autorizaciones se integren con la base real…"), sin mencionar "fixture" ni
      "localStorage" — con test dedicado que lo verifica. RED confirmado: 2 tests nuevos fallaron
      contra el componente sin tocar; GREEN con los 7 tests del archivo en verde. Se verificó
      además que los dos consumidores reales (`FacturaForm.tsx`, `FacturaAccionesEmision.tsx`)
      siguen pasando sus tests íntegros tras envolver el status existente.
- [x] 6.5 **Verificado 2026-08-12.** `rg 'style=\{\{' ` sobre los 3 archivos tocados → sin
      resultados. Los 3 (`FacturaAvisoDiscrepancias.tsx`, `FacturaDocumentos.tsx`, `AlertaCupo.tsx`)
      importan y usan `AvisoModeloDatos` de `design-system/components.tsx`, ningún markup propio de
      cartel. `npx tsc -b --noEmit` y `oxlint` limpios sobre los 6 archivos (3 componentes + 3
      tests). Suite focalizada: `FacturaAvisoDiscrepancias.test.tsx` (9),
      `FacturaDocumentos.test.tsx` (7), `AlertaCupo.test.tsx` (7) = **23/23 verdes**;
      `FacturaForm.test.tsx` (18) y `FacturaAccionesEmision.test.tsx` (3) también verdes
      individualmente (una corrida conjunta de toda `features/facturacion/` mostró 8 timeouts
      transitorios de carga de máquina en `FacturaForm.test.tsx`, no reproducibles corriendo el
      archivo solo — mismo patrón de flakiness ya documentado en 5.5, no regresión de esta tarea).

## 7. Documentación (obligatoria, no opcional)

- [ ] 7.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bloque nuevo *"Facturación vs.
      esquema real de `C-07`"*: las 4 discrepancias **cerradas** (con la evidencia de qué existe hoy),
      la parcial (enum), y las 6 nuevas (N1-N6 de `design.md` D12).
- [ ] 7.2 `knowledge-base/10_preguntas_abiertas.md`:
      - **Actualizar el conteo acumulado de la pregunta de pgTAP** a **4 changes / 5 funciones**
        (`crear_paciente_completo`, `crear_obra_social_completa`, `actualizar_obra_social_completa`,
        `crear_factura_completa`, `actualizar_factura_completa`), con **cinco** changes de integración
        por delante. **No resolver la pregunta** — solo aportar el dato.
      - Sumar las preguntas nuevas: snapshot de obra social en la factura, `WITH CHECK` explícito en
        las policies de `facturacion`, `NOT NULL` de las columnas de `facturas`, reconciliación del
        schema real con las migraciones del repo, y el gateo de `presupuesto`/`autorizacion` por el
        módulo `presupuestos`.
      - **Dejar explícitamente sin cerrar las 4 preguntas de negocio de prioridad Alta** que este
        change hereda (D13): identificador DNI/afiliado, formato del período, plazos 90/60/45 y su
        precedencia, e integración ARCA. Anotar que el swap de backend **hereda el default, no lo
        convierte en definitivo**.
- [ ] 7.3 `CHANGES.md` §`C-07`: reescribir el bloque ⚠️ de 5 puntos contra la realidad verificada.
- [x] 7.4 **Hecho 2026-08-13.** `CHANGES.md` §`C-11`: discrepancia 3/4 (período estructurado,
      `mes_facturado`/`anio_facturado`) marcada **CERRADA** — columnas reales confirmadas en 1.3,
      mapeadas 1:1 por `parseFacturaRow`. Discrepancia 2/4 marcada **A MITAD**: el estado `facturado`
      ya existía en el enum real antes de este change (no era un hueco de schema); `fecha_factura`
      (fecha de emisión) sí se agregó en este change (D3) y sobrevive a un recargar; lo que falta es
      que `C-11` (todavía en mock) lea esos datos reales para RF-801.
- [x] 7.5 **Hecho 2026-08-13.** `CHANGES.md` §`C-06`: registrada la trampa de RLS de D9 —
      `presupuesto`/`autorizacion` gateadas por el módulo **`presupuestos`**, no por `facturacion`
      como dice la migración commiteada— como **bloqueante a resolver antes de integrar
      Presupuestos/Autorizaciones de verdad con `AlertaCupo.tsx`** (hoy la validación de cupo de
      Facturación sigue sobre fixture, D9 opción A). Aclarado que `integracion-presupuestos` (D11) ya
      cerró la trampa **para su propio transporte** (Edge Functions + `service_role`), pero no para
      un futuro acceso directo por PostgREST desde Facturación.
- [x] 7.6 **Hecho 2026-08-13.** `CHANGES.md` §Plan de integración, fila 4 (Facturación) → actualizada
      a swap real completo, con la salvedad de verificación manual pendiente (`tasks.md` §8).
- [x] 7.7 **Hecho 2026-08-13.** `ROADMAP-FRONTEND.md`, fila `C-07` actualizada al mismo criterio que
      `C-04`/`C-10` (swap real 🔶, no ✅ hasta verificación manual), con detalle del swap y remisión
      al bloqueante de RLS en §C-06.

## 8. Verificación final

- [ ] 8.1 **Ejecutado 2026-08-13, una sola corrida completa** (783.77s, ~13.1 min) —
      **NO coincide con lo aceptado en 5.5. PARADO, no arreglado — requiere decisión de la
      usuaria.**
      Resultado: **`Test Files: 6 failed | 247 passed (253)`** — **`Tests: 11 failed | 2648
      passed (2659)`**.
      Composición de las 11 fallas:
      - 2 en `ChecklistEditor.test.tsx` — **coinciden** con el baseline de 0.8 (mismo archivo,
        mismo patrón `getByRole('button', { name: /^agregar$/i })`).
      - 1 en `PermisosMatrizFields.test.tsx` (`expected 7 got 14`) — coincide con la falla nueva
        ya aceptada en 5.5 (misma composición exacta).
      - 1 en `router.test.tsx` — coincide con la falla nueva ya aceptada en 5.5.
      - `router.cuentas.test.tsx` esta vez **no falló** (pasó) — variación respecto de 5.5,
        consistente con el patrón de flakiness/contaminación entre suites ya documentado ahí.
      - 1 en `PacienteDetail.test.tsx` (timeout 5000ms) — **NUEVA, no está ni en el baseline de
        0.8 ni en 5.5**. Fuera de `features/facturacion/`, no se investigó más (fuera de alcance
        de esta tarea, mismo criterio que `PermisosMatrizFields.test.tsx` en 5.5: se registra,
        no se arregla acá).
      - 5 en `FacturaForm.test.tsx` (todos timeout 5000ms) — **⚠️ NUEVA, dentro de
        `features/facturacion/`.** Triage en aislamiento: `NODE_OPTIONS="--no-experimental-webstorage"
        npx vitest run src/features/facturacion/FacturaDetail.test.tsx
        src/features/facturacion/FacturaForm.test.tsx` → **18/18 verdes, sin ninguna falla.**
        Coincide con la flakiness por carga de máquina ya documentada en 6.5 ("una corrida
        conjunta de toda `features/facturacion/` mostró 8 timeouts transitorios... no
        reproducibles corriendo el archivo solo"). **No es una regresión real** — es el mismo
        patrón de contaminación/timeout bajo carga ya conocido.
      - 1 en `FacturaDetail.test.tsx` (`agrupa las 5 discrepancias de impacto backend en un único
        AvisoModeloDatos`, `expected undefined to be truthy`) — **⚠️⚠️ NUEVA, dentro de
        `features/facturacion/`, y REPRODUCIBLE EN AISLAMIENTO** (falla igual sola, sin carga:
        `Test Files 1 failed | 1 passed (2)` — `Tests 1 failed | 27 passed (28)`, mismo archivo,
        mismo assertion). **Esto NO es flakiness — es una falla real y determinística.**
        Hipótesis sin confirmar (no investigado a fondo, por instrucción explícita de no
        arreglar): el test busca un aviso `AvisoModeloDatos` agrupado que mencione
        `documento_factura|documentos por factura`; 6.3 reescribió el texto del
        `AvisoModeloDatos` de `FacturaDocumentos.tsx` (dejó de decir "todavía usa datos mock") y
        6.5 solo corrió `FacturaDocumentos.test.tsx` en foco, no `FacturaDetail.test.tsx` (que
        compone/agrupa los avisos de los hijos) — es candidato más probable a la causa, pero
        **no se confirmó ni se tocó código**. **CRÍTICO — reportado para que decida la usuaria,
        no corregido por este agente.**
      **Conclusión: NO se marca esta tarea como "sin regresión".** Queda sin `[x]` a propósito,
      igual que 5.5, hasta que la usuaria decida qué hacer con la falla reproducible de
      `FacturaDetail.test.tsx`.
- [x] 8.2 **Verificado 2026-08-13.** `npx tsc -b --noEmit` (con `-b`) sin salida, exit 0 — limpio.
      `oxlint .` exit 0 (sin errores) — solo warnings preexistentes y dispersos en todo el
      proyecto (`no-unsafe-optional-chaining` en tests de `hojas-de-ruta`/`pacientes`,
      `react/only-export-components` en 12 archivos que exportan contexto + componente en el
      mismo archivo — patrón sistémico repetido en 10+ `RepositoryContext.tsx` incluidos los dos
      de `features/facturacion/` (`FacturaRepositoryContext.tsx`, `CobroRepositoryContext.tsx`),
      no específico de este change — y 2 `react-hooks/exhaustive-deps` en `pacientes`). Ninguno
      de los warnings es nuevo de este change ni bloquea el build.
- [ ] 8.3 **Pendiente — verificación manual de la usuaria en el navegador (bloqueada además por
      `VITE_TEST_ACCOUNTS` ausente de `frontend/.env.local`).** Verificación manual en navegador
      con las **tres** cuentas de `VITE_TEST_ACCOUNTS`:
      - **Admin**: alta de factura con asistencias, emisión, registro de dos cobros parciales, baja de
        un cobro, vista imprimible.
      - **Facturación**: lo mismo (es el perfil real de uso). Confirmar además qué pasa con la alerta
        de cupo — es el perfil que expone la trampa de D9.
      - **Operación**: sin permiso de escritura sobre facturación → los formularios quedan en solo
        lectura y cualquier intento de escritura produce el mensaje en castellano de D7, no un error
        críptico ni un fallo silencioso.
- [ ] 8.4 **Pendiente — verificación manual de la usuaria en el navegador (bloqueada además por
      `VITE_TEST_ACCOUNTS` ausente de `frontend/.env.local`).** Verificar en el navegador que **la
      fecha de emisión sobrevive a un recargar**: emitir una factura, recargar, confirmar que la
      alerta de vencimiento se sigue calculando. Es la prueba funcional de que D3 hacía falta.
- [ ] 8.5 **Pendiente — verificación manual de la usuaria en el navegador (bloqueada además por
      `VITE_TEST_ACCOUNTS` ausente de `frontend/.env.local`).** Verificar en el navegador que
      **editar el estado de una factura no borra sus asistencias** (el modo de falla de 1B.3,
      visto desde la UI).
- [ ] 8.6 Guardar en engram (`project: "traslados-app"`, `topic_key:
      "opsx/integracion-facturacion/apply"`) las discrepancias reales encontradas en 1.3 respecto de
      lo que este `design.md` asume — cuarta vez consecutiva que conviene dejarlo escrito.
