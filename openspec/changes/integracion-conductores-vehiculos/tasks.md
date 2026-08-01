# Tasks — integracion-conductores-vehiculos

> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net (`cd frontend && npx vitest run`) y se registra el baseline. **No caer en
> Standard Mode.** Test runner: `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE ALTO — checkpoint ✅ RESUELTO (2026-07-31).** `CHANGES.md` declara `C-08` como ALTO
> y `C-09` como BAJO; para un change combinado aplica el más restrictivo. Las cuatro decisiones que
> bloqueaban la tarea **0.1** ya están tomadas por la usuaria y volcadas en `design.md`:
> **D3 → opción B** (habilitaciones derivadas de `conductores.mantenimiento`),
> **D5 → opción A** (degradar y avisar; el modelo de permisos no se toca),
> **D6 → opción B** (`restricciones` se elimina del dominio; todo va a `observaciones` ↔ `notas`) y
> **colisión de asignación semanal → se bloquea SIEMPRE, sin override, con el constraint
> `uq_conductor_semana` en la base**. **Ya no hay nada bloqueado**: la §4 y siguientes pueden avanzar.
>
> **⚠️ D3, D6 y la colisión cambian pantallas ya aprobadas por la usuaria.** Eso no venía contemplado
> en la versión original de este archivo (que daba las ~25 componentes por intocables) y suma tres
> fases nuevas: **§2B** (habilitaciones derivadas — `VehiculoDetail`, `VehiculoMantenimiento`,
> fixture), **§2C** (restricciones → observaciones — `ConductorForm`, `ConductorDetail`,
> `ConductoresList`, tipo del dominio, fixture) y **§2D** (se elimina el override `permitirMultiple`
> de `AsignacionSemanalTabla` y de `validarAsignacionSemanal`). Las tres son **enteramente sobre el
> mock** y van antes del mapeo.
>
> **⚠️ Las migraciones NO las aplica el agente.** Las corre la usuaria / Enzo (backend): el sandbox
> no tiene Docker ni credenciales del proyecto real. Las verificaciones de RLS con cuentas reales son
> tareas de coordinación explícitas (§1B.8 a §1B.12), no pasos escondidos dentro de otra tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo change;
> type-check con `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional Commits.
>
> **Orden de fases pensado para no dejar el árbol a medias** (design.md D2): la §2, §2B, §2C y §2D
> son **enteramente sobre el mock** y cada una termina con la app funcionando; recién ahí queda la
> forma final del dominio y empieza el mapeo. El swap de
> Vehículos ocurre en la §5 y el de Conductores en la §7. Cada fase es revertible por sí sola.
> Entre §5 y §7 hay un **estado transitorio conocido y documentado** (§5.6): el selector de vehículo
> de la pantalla de Conductores muestra vehículos reales mientras las asignaciones siguen en
> `localStorage`. Si el change se detiene ahí, revertir §5 devuelve la coherencia.
>
> **⚠️⚠️ RECONCILIACIÓN CON EL BACKEND REAL (2026-08-01).** `C-08-vehiculos-mantenimiento`, el change
> de Enzo, ya está mergeado en `origin/main` (migraciones `20260729140000_seed_accesorios.sql`,
> `20260730110000_schema_vehiculo_gaps.sql`, `20260730150000_fix_habilitaciones_vehiculo_modulo.sql`,
> y la Edge Function `supabase/functions/vehiculos/index.ts`) y **es la fuente de verdad** para
> Vehículos de acá en adelante — ver `design.md` §Reconciliación con C-08-vehiculos-mantenimiento
> para el detalle completo con cita exacta. Resumen de lo que cambia en **este** archivo, marcado
> inline en cada tarea afectada: **1B.1** (kilometraje ya aplicado, distinto de lo planeado; no se
> agregan `kilometraje_ultimo_service`/`fecha_ultimo_service`), **1B.3** (accesorios ya sembrados),
> **1B.5** (la tabla `habilitaciones_vehiculo` que acá se daba por descartada **sí existe**),
> **1B.8** (las 4 RPC `SECURITY INVOKER` no se escriben: la atomicidad la resuelve la Edge Function),
> **§4B** (nueva, guía de reconciliación de `vehiculoMapping.ts` para el próximo batch de apply) y
> **§5** (el repository real llama a la Edge Function por HTTP, no a PostgREST+RPC). **Esto NO toca
> nada de Conductores**: D4/D6/D7/§1B.4/§1B.6/§1B.9/§6/§7 siguen exactamente como estaban, sin
> conflicto con el backend de Enzo. El código de mapeo (`vehiculoMapping.ts`, §4, ya implementado)
> **no se reescribe en este batch** — eso es trabajo del próximo `sdd-apply`.

## 0. Checkpoint de diseño (antes de escribir código) — GOVERNANCE ALTO

- [x] 0.1 **✅ RESUELTO (2026-07-31).** Las cuatro decisiones fueron presentadas a la usuaria con el
      trade-off escrito de `design.md` y están **cerradas**. No se reabren ni se vuelven a proponer
      alternativas; lo que sigue es el veredicto y su consecuencia directa en este archivo.
      - **D3 — Habilitaciones VTV/RTO → opción B: se derivan de `conductores.mantenimiento`**
        (filas `categoria='preventivo'` + `subtipo IN ('vtv','rto')`). **No se crea
        `conductores.habilitaciones_vehiculo`**; la duplicación de vencimientos desaparece en la
        causa raíz. `Vehiculo.habilitaciones[]` pasa a ser **derivada** (calculada en el mapeo puro,
        nunca persistida) y la única vía de carga de una VTV/RTO pasa a ser el alta de mantenimiento
        preventivo. Consecuencias en este archivo: **§2B** (UI), 1B.5, 4.7, 8.3.
      - **D5 — Gateo cruzado del catálogo de accesorios → opción A: degradar y avisar.** Sin
        `pacientes: read`, el vehículo se lee **entero** con `accesoriosCompatibles: []` más un
        `AvisoModeloDatos` que explica que falta el permiso del módulo Pacientes. **El modelo de
        permisos no se mueve** (B descartada) y ninguna ruta pasa a exigir dos permisos (C
        descartada). Ya es lo que describía D10; el seed del catálogo sigue igual. Consecuencias:
        1B.3, 5.4, 8.2.
      - **D6 — `Conductor.restricciones` → opción B: todo a `notas`, docx literal.** El tipo
        `restricciones: RestriccionConductor[]` **se elimina del dominio** junto con la unión
        `RestriccionConductor` y `restriccionConductorOptions.ts`; el único campo libre del perfil
        queda `observaciones?: string`, que ya mapea a la columna `notas`. **No se agrega ninguna
        columna** a `conductores.conductores`. Costo asumido a sabiendas por la usuaria: `C-10`
        pierde el filtro automático por restricción (RN-GL-03 pasa a **lectura humana** de texto
        libre, no dato computable). Consecuencias: **§2C** (UI), 1B.4, 6.4, 8.5, 9.4.
      - **Colisión de asignación semanal → se bloquea SIEMPRE, sin excepción y sin override.**
        Ninguna fuente (KB ni docx) confirma que la excepción sea un caso real, y el override
        `permitirMultiple` está apagado por defecto desde `conductores-ui` (2026-07-24) sin que
        nadie lo haya usado nunca. Se resuelve con **un constraint de base de datos**, no con lógica
        de aplicación: `ALTER TABLE conductores.conductores_vehiculos ADD CONSTRAINT
        uq_conductor_semana UNIQUE (conductor_id, fecha_init)`. **No hay validación de colisión en
        la RPC, no hay flag `permitirMultiple` en los payloads y no existe el código `45205`**; la
        violación llega como `23505` y se distingue del constraint viejo por el nombre (D12). El
        override **se elimina del frontend** (§2D) y `validarAsignacionSemanal` pasa a ser
        incondicional. Consecuencias: **§2D** (UI), 1.7, 1B.6, 1B.9, 6.8, 7.4, 7.4b, 7.6.
- [x] 0.2 **✅ Confirmado (2026-07-31, apply).** `openspec/changes/archive/2026-07-31-vehiculo-mantenimiento-registro/`
      existe en el filesystem del repo → `vehiculo-mantenimiento-registro` está archivado. El
      bloqueo de `CHANGES.md` ("no tocar `features/vehiculos/` desde otro agente mientras tanto") ya
      no rige. No se detectó trabajo en paralelo sobre esos archivos durante esta sesión.
- [x] 0.3 **✅ Verificado (2026-07-31, apply).** Se descargó `https://supabase.com/changelog.md`
      (200 OK) y se buscaron entradas sobre `schema()`, `rpc()`, `maybeSingle()`, `.in()` y embeds
      anidados con alias. `@supabase/supabase-js` resuelto en `package-lock.json`: `2.110.8`. No
      aparecieron breaking changes nuevos que afecten esa superficie más allá de lo ya registrado en
      `integracion-pacientes`/`integracion-obra-social` (drops de versiones de Node.js, "Tables not
      exposed to Data and GraphQL API automatically" — ya cubierto por la verificación de *Exposed
      schemas* de la tarea 1.1 — y mejoras de inferencia de tipos en embeds/RPC que no cambian
      comportamiento en runtime). Sin bloqueante para este change.
- [x] 0.4 **✅ Baseline registrado (2026-07-31, apply).** `cd frontend && npx vitest run`:
      **1405 tests passing / 114 failing, 179/198 test files en verde** (19 archivos fallan
      completamente). **Fallo preexistente, no se arregla acá**: los 19 archivos que fallan lo hacen
      con el mismo error, `TypeError: Cannot read properties of undefined (reading 'clear')` sobre
      `localStorage.clear()` en su `beforeEach` (todos los `mock*Repository.test.ts` que tocan
      `localStorage` directamente: `mockVehiculoRepository`, `mockConductorRepository`,
      `mockPacienteRepository`, `mockPresupuestoRepository`, `mockObraSocialRepository`,
      `mockAutorizacionRepository`, `mockHojaDeRutaRepository`, `mockFacturaRepository`,
      `mockCobroRepository`, entre otros). **Causa raíz aislada** con un test de diagnóstico
      descartable: Node.js `v26.0.0` (el runtime del sandbox) expone un `globalThis.localStorage`
      experimental propio (advertencia `ExperimentalWarning: localStorage is not available because
      --localstorage-file was not provided`) que pisa/conflictúa con el `window.localStorage` que
      jsdom monta para el entorno de test de vitest — `typeof localStorage` da `undefined` incluso
      con `--no-file-parallelism` y en aislamiento total (un solo archivo). Es un problema de entorno
      (versión de Node del sandbox), no del código de la aplicación ni de este change: determinístico
      (mismos 19 archivos fallan siempre, no es flaky) y preexistente a cualquier cambio de esta
      sesión. **Medido, no asumido**: 1405/1519 tests pasan (92.5%), 179/198 archivos.

## 1. Precondiciones del backend (verificar, no modificar)

- [ ] 1.1 Verificar que el schema `conductores` está en *Exposed schemas* del Data API
      (`Accept-Profile: conductores` → `42501`, **no** `PGRST106`/`PGRST205`). Verificar lo mismo para
      `facturacion` (D10 lo necesita para los gastos). `pacientes` ya fue confirmado el 2026-07-30
      por `integracion-pacientes` 1.2 — reconfirmar y anotar.
- [ ] 1.2 Verificar el **estado del historial de migraciones** contra el remoto
      (`supabase migration list --linked`) y, en particular, **si
      `20260724100006_schema_conductores.sql` está aplicada**. `integracion-pacientes` 1B.3 registró
      un desfasaje conocido (~12 versiones aplicadas al remoto sin commitear, y `20260730180000`
      aplicada por SQL Editor sin quedar en `supabase_migrations.schema_migrations`). Anotar el
      estado real **antes** de escribir migraciones nuevas y dejar documentado si hace falta
      `supabase migration repair --status applied`.
      **Nota**: aunque `20260724100006` resultara no aplicada, **no se la edita** — la migración
      aditiva es la única opción segura (design.md §Risks). Consolidar sería una decisión de la
      usuaria, no del agente.
- [ ] 1.3 Confirmar contra la base real el contenido actual de las 7 tablas del schema:
      `select count(*) from conductores.conductores`, `…vehiculo`, `…mantenimiento`,
      `…accesorios_vehiculo`, `…conductores_vehiculos`, `…documentacion_vehiculo`,
      `…documentacion_conductores`. Importa porque si `mantenimiento` tiene filas, el CHECK de D4
      necesita el `NOT VALID` sí o sí. **No insertar ni modificar nada.**
- [ ] 1.4 **Bloqueante para el seed de D5**: `select id, tipo from pacientes.accesorios order by
      tipo;`. Si backend ya cargó filas con otros nombres (`"Silla plegable"` con mayúscula y
      espacio, por ejemplo), el seed de la unión cerrada crearía **duplicados semánticos**. Si
      aparecen filas inesperadas, **parar y reportar a la usuaria** — la reconciliación no la decide
      el agente.
- [ ] 1.5 Confirmar que las policies vigentes del schema son las de `20260730140000_split_modulos_permisos.sql`
      y no las originales de `20260724100006`: `select polname, polcmd from pg_policy where
      polrelid::regclass::text like 'conductores.%';` — las 5 tablas de flota deben decir
      `tiene_permiso('vehiculos', …)` y las 2 de conductores `tiene_permiso('conductores', …)`.
      **Verificar especialmente `conductores_vehiculos` → `vehiculos`**, que es la base de D10.
      Registrar el resultado.
- [ ] 1.6 Verificar que `facturacion.gastos_vehiculos` sigue gateada por `facturacion` y que su FK
      `vehiculo_id → conductores.vehiculo(id)` existe. Anotar sus columnas exactas (`id`,
      `vehiculo_id`, `monto NUMERIC(10,2)`, `fecha DATE`) para confirmar el hueco de `descripcion`.
- [ ] 1.7 **Bloqueante para 1B.6**: verificar que no haya filas que violen el constraint
      `uq_conductor_semana` que 1B.6 va a agregar. `ADD CONSTRAINT … UNIQUE` **no admite
      `NOT VALID`** (a diferencia del CHECK de 1B.2), así que una sola fila violatoria hace fallar el
      deploy entero:
      ```sql
      select conductor_id, fecha_init, count(*), array_agg(vehiculo_id)
      from conductores.conductores_vehiculos
      group by conductor_id, fecha_init
      having count(*) > 1;
      ```
      Cero filas ⇒ seguir. Si aparece alguna, **parar y reportar a la usuaria**: cuál asignación
      sobrevive es una decisión de negocio, **no la toma el agente**, y no se borra ni se reasigna
      nada. Probabilidad baja —el schema se creó el 2026-07-24 y la app todavía no escribe contra
      él— pero el costo de no chequearlo es un deploy roto a mitad de camino.

## 1B. Migraciones (governance ALTO — tocan RLS, un catálogo compartido y otro módulo de permisos)

> **⚠️⚠️ Regla dura del change**: las cuatro funciones son `SECURITY INVOKER`. Convertirlas a
> `SECURITY DEFINER` bypassearía RLS por completo (el owner es superusuario) y permitiría a cualquier
> usuario autenticado editar vehículos y conductores **y escribir en `facturacion.gastos_vehiculos`,
> que pertenece a otro módulo con datos financieros**. No hacerlo bajo ninguna circunstancia, ni
> "temporalmente para probar".
>
> **⚠️ Toda tabla nueva define su RLS en el mismo archivo que la crea** (regla dura del proyecto).
> Tras la resolución de D3 por la opción B, **este change no crea ninguna tabla**: la regla queda sin
> objeto acá y las 7 tablas existentes conservan sus policies vigentes sin tocarse.

- [ ] 1B.1 ~~Escribir `supabase/migrations/20260801120000_conductores_vehiculos_campos.sql`~~
      **⚠️ RECONCILIADO (2026-08-01, ver `design.md` §Reconciliación).** Enzo ya aplicó
      `20260730110000_schema_vehiculo_gaps.sql` con parte de este contenido, en forma distinta a la
      planeada acá:
      - ~~`ALTER TABLE conductores.vehiculo ADD COLUMN kilometraje INTEGER NOT NULL DEFAULT 0`~~ —
        **ya existe**: `kilometraje INT` (**nullable, sin default**, no `NOT NULL DEFAULT 0`). **No
        re-emitir este `ADD COLUMN`** (fallaría por duplicado). El mapeo del repository real trata
        `null` como `0` en la lectura, igual que ya hace la Edge Function — no se pide una migración
        de ajuste de nullability que nadie pidió.
      - ~~`… ADD COLUMN kilometraje_ultimo_service INTEGER NOT NULL DEFAULT 0`~~ /
        ~~`… ADD COLUMN fecha_ultimo_service DATE`~~ — **no se agregan**: la Edge Function los deriva
        del último registro `preventivo` de `mantenimiento`, no de columnas propias (ver design.md,
        invierte el Non-Goal original).
      - `ALTER TABLE conductores.mantenimiento ADD COLUMN subtipo TEXT, ADD COLUMN detalle TEXT,
        ADD COLUMN descripcion TEXT` (D4) — **`descripcion` ya existe** (Enzo la agregó para
        `gastoToApi`/`descripcion` del gasto, columna compartida con el uso de mantenimiento que
        planeaba D4). **`subtipo`/`detalle` siguen sin existir** — es parte del `#### Gap abierto`
        de `design.md` (no hay dónde persistir el nivel 2 de la intervención todavía). No se escribe
        esta migración hasta coordinar con Enzo cuál de los dos caminos del gap se toma.
      - ~~`ALTER TABLE facturacion.gastos_vehiculos ADD COLUMN descripcion TEXT`~~ — **sin objeto**:
        D9/D11 quedaron SUPERSEDED, los gastos viven en `conductores.mantenimiento` (`categoria =
        'gasto'`), no en `facturacion.gastos_vehiculos`. Esa tabla queda abandonada, no se le agrega
        nada.
- [ ] 1B.2 En el **mismo archivo**, el CHECK de coherencia de la unión discriminada (D4), con
      `NOT VALID` a propósito — la validación es la tarea 1B.7, separada y posterior:
      ```sql
      ALTER TABLE conductores.mantenimiento ADD CONSTRAINT chk_categoria_subtipo CHECK (
        (categoria = 'gasto'      AND subtipo IS NULL AND detalle IS NULL) OR
        (categoria = 'preventivo' AND subtipo IN ('cambio-aceite-filtros','vtv','rto') AND detalle IS NULL) OR
        (categoria = 'correctivo' AND subtipo = 'otro' AND detalle IS NOT NULL AND btrim(detalle) <> '') OR
        (categoria = 'correctivo' AND subtipo IN ('alternador','bateria','frenos','embrague','cubiertas'))
      ) NOT VALID;
      ```
      Los valores son **exactamente** los de las uniones de `frontend/src/shared/types/vehiculo.ts`
      (`SubtipoPreventivo`, `SubtipoCorrectivoConocido`). **No inventar ninguno.**
- [x] 1B.3 ~~En el **mismo archivo**, el catálogo de accesorios (D5).~~ **✅ Ya aplicado por Enzo
      (2026-08-01, ver design.md §Reconciliación).** `20260729140000_seed_accesorios.sql` ya hace
      exactamente esto: `ALTER TABLE pacientes.accesorios ADD CONSTRAINT accesorios_tipo_unique
      UNIQUE (tipo)` (mismo efecto que el `uq_accesorios_tipo` planeado, distinto nombre — cosmético,
      no se renombra) + `INSERT … VALUES ('silla-plegable'), ('silla-rigida'), ('silla-postural'),
      ('andador'), ('tripode') ON CONFLICT (tipo) DO NOTHING`, los mismos 5 valores exactos. **No
      se re-escribe ni se re-aplica.**
- [x] 1B.4 ~~Columna de restricciones del conductor.~~ **Sin trabajo: D6 resolvió por B.** No se
      agrega ninguna columna a `conductores.conductores` — `notas TEXT` ya existe y es el único
      lugar donde viven observaciones y restricciones de perfil. Verificar, al escribir 1B.1, que la
      migración **no** incluye ningún `ADD COLUMN restricciones`. El trabajo real de esta decisión
      es de frontend y está en **§2C**.
- [x] 1B.5 ~~Tabla `conductores.habilitaciones_vehiculo`.~~ **Sin trabajo, pero por un motivo
      distinto al que decía esta entrada** — **⚠️ RECONCILIADO (2026-08-01)**: esta línea decía "D3
      resolvió por B, no se crea ninguna tabla". **La realidad es la inversa**: Enzo **sí** creó
      `conductores.habilitaciones_vehiculo(id, vehiculo_id, tipo, fecha_emision,
      fecha_vencimiento)` en `20260730110000_schema_vehiculo_gaps.sql`, con RLS gateada por
      `vehiculos` (corregida en `20260730150000_fix_habilitaciones_vehiculo_modulo.sql`) y trigger
      de auditoría — exactamente la opción A que D3 había descartado. Ver design.md §Reconciliación
      D3 para el detalle completo. **Sigue sin haber trabajo de migración pendiente acá** (la tabla
      ya existe, no se re-crea), pero **sí** cambia 4.7/5.x: el repository real no deriva
      habilitaciones con `derivarHabilitaciones()`, consume el JSON que la Edge Function ya arma
      desde esa tabla (ver §4B).
- [ ] 1B.6 En el **mismo archivo** (`…_campos.sql`), el constraint que hace imposible la colisión de
      asignación semanal (D7 §Colisión). **Bloqueado por 1.7**, que verifica que no haya filas
      violatorias:
      ```sql
      ALTER TABLE conductores.conductores_vehiculos
        ADD CONSTRAINT uq_conductor_semana UNIQUE (conductor_id, fecha_init);
      ```
      - **Constraint con nombre, no `CREATE UNIQUE INDEX` suelto**: el nombre es lo que viaja en el
        error de Postgres y es lo único que permite a `mapearErrorConductor` distinguir los dos
        `23505` posibles (7.6).
      - **No es un índice parcial**: `conductores_vehiculos` no tiene soft-delete ni `estado` ni
        `activo` — todas las filas son asignaciones vigentes, no hay nada que filtrar y un `WHERE`
        siempre verdadero sugeriría una condición inexistente.
      - El `UNIQUE(conductor_id, vehiculo_id, fecha_init)` existente queda **como está**: el nuevo lo
        subsume, pero este change no borra nada que una migración aplicada haya creado.
      - **Sin `NOT VALID`** — `ADD CONSTRAINT … UNIQUE` no lo admite (a diferencia del CHECK de
        1B.2): construye el índice y hace fallar la migración entera si hay filas violatorias.
- [ ] 1B.7 Escribir la tarea de validación diferida como paso **separado y explícito**:
      `ALTER TABLE conductores.mantenimiento VALIDATE CONSTRAINT chk_categoria_subtipo;`. Solo se
      corre **después** de confirmar que no hay filas violatorias
      (`select id, categoria, subtipo, detalle from conductores.mantenimiento where …`). Si las hay,
      **se reportan a backend**, no se borran ni se "arreglan" desde acá.
- [ ] 1B.8 ~~Escribir `supabase/migrations/20260801120001_conductores_vehiculos_rpc.sql` con las
      cuatro funciones `SECURITY INVOKER`.~~ **⚠️ SIN OBJETO (2026-08-01, ver design.md
      §Reconciliación D9/D11).** Estas 4 funciones **no existen y no se van a escribir para
      Vehículos**: Enzo resolvió la atomicidad multi-tabla dentro de la Edge Function
      `supabase/functions/vehiculos/index.ts`, que corre con un cliente `service-role` tras un único
      chequeo grueso `tiene_permiso('vehiculos', nivel)` (D10 SUPERSEDED). **No se aplica esta
      tarea.** El texto original queda abajo como registro de lo que este documento planeaba antes
      de conocer el backend real — no se borra, se mantiene sin marcar como pendiente:
      `conductores.crear_vehiculo_completo(p_vehiculo jsonb) RETURNS uuid`,
      `conductores.actualizar_vehiculo_completo(p_id uuid, p_cambios jsonb) RETURNS uuid`,
      `conductores.crear_conductor_completo(p_conductor jsonb) RETURNS uuid`,
      `conductores.actualizar_conductor_completo(p_id uuid, p_cambios jsonb) RETURNS uuid`.
      Requisitos no negociables de cada una:
      - `SECURITY INVOKER` **escrito explícitamente** (aunque sea el default) + `SET search_path = ''`
        + `REVOKE ALL … FROM PUBLIC` y `FROM anon` + `GRANT EXECUTE … TO authenticated` +
        `COMMENT ON FUNCTION` con la prohibición de `DEFINER`.
      - Semántica parcial con el operador `?` de `jsonb` (`p_cambios ? 'mantenimientos'`), que
        distingue *clave ausente* de *clave presente con `null`*. **`->>` sola no alcanza y
        confundirlas borraría el historial de cualquiera que edite solo la patente.**
      - Colecciones hijas por **reemplazo completo** (`DELETE` + `INSERT`) dentro de la transacción.
      - `facturacion.gastos_vehiculos` se toca **solo si `p_cambios ? 'gastos'`**; ídem
        `accesorios_vehiculo` con `? 'accesoriosCompatibles'`. Si se tocaran siempre, un usuario con
        `vehiculos: write` y sin `facturacion: write` no podría cambiar ni la patente.
      - Códigos de error propios `45201`–`45204` según la tabla de D9. **No hay `45205`**: la
        colisión de asignación semanal la garantiza el constraint `uq_conductor_semana` (1B.6), no la
        función. Las funciones **no validan colisión de asignaciones**.
- [x] 1B.9 ~~Validación server-side de la colisión de asignación semanal dentro de las RPC.~~ **Sin
      trabajo: la colisión se bloquea siempre y la barrera es el constraint `uq_conductor_semana`
      (1B.6), no lógica de aplicación.** Las cuatro funciones **no** validan colisión de
      asignaciones, el `jsonb` **no** acepta ninguna clave `permitirMultiple` y **no existe el código
      `45205`**. La verificación previa de filas violatorias es la tarea **1.7**.
- [ ] 1B.10 Revisar las dos migraciones contra el checklist de `supabase-postgres-best-practices` y
      correr `supabase db advisors --linked --type security` **antes** de aplicar (para tener la
      línea base de hallazgos preexistentes) y **después**. Registrar el diff.
- [ ] 1B.11 **Aplicar las dos migraciones** al proyecto real. **Las corre la usuaria / Enzo, no el
      agente.** Esta tarea **bloquea** §5 y §7.
- [ ] 1B.12 Verificación manual con **cuentas reales** (no desde el SQL Editor, que conecta como
      superusuario y **no ejercita RLS** — lección de `integracion-pacientes` 1.3). Checklist:
      - `vehiculos: write` → alta completa de vehículo con accesorios y mantenimientos: filas en
        `vehiculo` + `accesorios_vehiculo` + `mantenimiento`, rastro en `auditoria.logs`.
      - `vehiculos: read` sin `write` → `42501` y **cero filas** insertadas (la prueba de que
        `INVOKER` está haciendo su trabajo).
      - `vehiculos: write` **sin** `facturacion: write` → editar la patente funciona; cargar un gasto
        falla con `42501` y rollback total de esa llamada, sin dejar el vehículo a medias.
      - `vehiculos: write` **sin** `pacientes: read` → el vehículo se lee entero con
        `accesoriosCompatibles` vacío, **sin error** (D10).
      - `conductores: write` **sin** `vehiculos: read` → guarda datos personales del conductor;
        `asignaciones` vuelve vacío y guardar una asignación falla con `42501`.
      - **Colisión semanal (1B.6)**: con `conductores: write` + `vehiculos: write`, guardar un
        conductor con dos vehículos **distintos** en la misma semana → `23505` sobre
        `uq_conductor_semana` y **cero filas** insertadas (rollback total), **sin ninguna forma de
        habilitarlo**. Repetir el **mismo** par conductor-vehículo-semana → también `23505`, y
        confirmar cuál constraint reporta Postgres para que los mensajes de 7.6 matcheen la realidad.
      - `select conname from pg_constraint where conrelid = 'conductores.conductores_vehiculos'::regclass;`
        → aparecen los **dos** constraints (el viejo y `uq_conductor_semana`).
      - `select proname, prosecdef from pg_proc where pronamespace = 'conductores'::regnamespace;`
        → `prosecdef = false` en las 4 funciones nuevas.

## 2. `Vehiculo.notas` + kilometraje, sobre el mock (D15 #3 y #7) — fase autocontenida y revertible

> Esta fase **no toca Supabase**. Al terminar, la app anda exactamente igual que antes, con campos
> nuevos. Punto de corte limpio y revertible por sí solo.

- [x] 2.1 (RED) Test de `shared/types/vehiculo.ts`: `Vehiculo.notas?: string`. La columna
      `conductores.vehiculo.notas` existe en la base y hoy **nace `NULL` para siempre** porque
      ninguna vía de la app la completa (discrepancia ya anotada en `CHANGES.md` §C-08).
      **Opcional, no requerida**: la columna es nullable y el docx no la marca obligatoria; volverla
      requerida sería una regla de negocio que ninguna fuente respalda. RED confirmado vía
      `npx tsc -b --noEmit` (`vehiculo.notas.types.test.ts`, mismo patrón que
      `vehiculo.mantenimientoRegistro.types.test.ts`: `vitest run` no type-checkea).
- [x] 2.2 (GREEN) Sumar el campo al tipo. Verificado con `cd frontend && npx tsc -b --noEmit` (limpio).
- [x] 2.3 Subir `SCHEMA_VERSION` de `mockVehiculoRepository` **3 → 4** (regla de
      `openspec/config.yaml` §apply.guidelines) y actualizar `buildVehiculosFixture()` para que al
      menos un vehículo del fixture traiga `notas` y otro no. `vehiculo-etios` trae notas,
      `vehiculo-kangoo`/`vehiculo-partner` no.
- [x] 2.4 (RED→GREEN) `VehiculoForm.tsx`: campo de texto para `notas`, con los componentes del design
      system (`Input`/`Textarea` de `design-system/components.tsx`), nunca markup Tailwind a mano.
      RED confirmado (4 tests fallando), GREEN con `Textarea` de `design-system/form.tsx`.
- [x] 2.5 (RED→GREEN) `VehiculoDetail.tsx`: mostrar `notas` en la ficha; ausencia = no se renderiza la
      sección, no un `—` inventado. **Adicional no listado explícitamente pero necesario para no dejar
      una afirmación falsa en la UI**: se eliminó el `AvisoModeloDatos` que anunciaba "Falta el campo
      Notas…" — esa discrepancia es exactamente la que esta tarea cierra, dejarlo habría anunciado como
      pendiente algo ya resuelto (mismo criterio que 2D.3 aplica más abajo). Ningún test lo cubría.
- [x] 2.6 Confirmar que `kilometraje`, `kilometrajeUltimoService` y `fechaUltimoService` ya existen en
      el tipo y en la UI (vienen de `vehiculos-ui`) y que **lo único que faltaba eran las columnas**
      (1B.1). Verificado: ya están en `shared/types/vehiculo.ts`, `VehiculoForm.tsx` y
      `VehiculoMantenimiento.tsx` — tarea de verificación, sin código nuevo.
- [x] 2.7 Correr la suite completa y confirmar cero regresiones contra el baseline de 0.4.

## 2B. Habilitaciones VTV/RTO derivadas del historial, sobre el mock (D3 → opción B)

> **Consecuencia de UI del checkpoint 0.1.** Toca `features/vehiculos/`, que la versión original de
> este archivo daba por intocable. **No toca Supabase**: es un cambio de *quién llena*
> `Vehiculo.habilitaciones`, no de dónde salen los datos. Al terminar, la app anda igual y las
> habilitaciones que muestra provienen del historial de mantenimiento. Revertible por sí sola.
>
> El tipo `RegistroHabilitacion` y el campo `Vehiculo.habilitaciones: RegistroHabilitacion[]`
> **NO se eliminan**: siguen alimentando `estadoHabilitacion`, `VehiculoMantenimiento`,
> `VehiculosList`, `alertasMantenimiento` y las tarjetas del dashboard, que no se tocan.

- [x] 2B.1 (RED→GREEN→TRIANGULATE) `derivarHabilitaciones(mantenimientos): RegistroHabilitacion[]`,
      función **pura**, en `frontend/src/shared/lib/mantenimiento/` (junto a `estadoHabilitacion`, no
      dentro del mapeo de Supabase: la usan las dos implementaciones). Regla exacta de `design.md`
      D3: por cada tipo ∈ `{'vtv','rto'}`, tomar las filas `preventivo` de ese subtipo **con
      `proximoVencimientoFecha` no nulo** y quedarse con la de `fecha` **más reciente** (desempate
      determinista por `id`); `fechaEmision ← fecha`, `fechaVencimiento ← proximoVencimientoFecha`.
      Casos obligatorios: sin filas → `[]`; varias VTV → gana la más reciente; VTV **sin**
      vencimiento → no emite habilitación (**nunca inventar una fecha**); VTV y RTO independientes
      entre sí (RN-VE-04); empate de `fecha` → desempate por `id`, estable entre dos corridas. 9
      tests, todos verdes.
- [x] 2B.2 (RED→GREEN) `VehiculoDetail.tsx`: dejar de enviar `habilitaciones: []` como colección
      persistida en el alta (`handleSubmitGeneral`) — pasa a ser un campo **de salida**. La ficha
      sigue mostrando las habilitaciones exactamente igual; lo único que cambia es de dónde salen.
      **Adicional necesario, no listado explícitamente pero exigido por el escenario "con cualquier
      implementación de `VehiculoRepository`" de `vehiculo-contract`**: `mockVehiculoRepository.ts`
      ahora también deriva `habilitaciones` de `mantenimientos` en cada lectura (`list`/`getById`/
      `create`/`update`), igual que hará `SupabaseVehiculoRepository` en `ensamblarVehiculo` (§4.7).
      Sin este cambio, el mock seguiría devolviendo lo que quedó guardado bajo `habilitaciones` y la
      escena "agregar una VTV actualiza la habilitación mostrada" no se cumpliría en el mock.
- [x] 2B.3 (RED→GREEN) `VehiculoMantenimiento.tsx`: el estado vacío deja de decir "Sin habilitaciones
      registradas" a secas y pasa a decir de dónde salen (se registran como intervención preventiva
      con subtipo VTV/RTO en el historial de abajo). Usar los componentes del design system, nunca
      markup Tailwind a mano ni `style={{}}`.
- [x] 2B.4 (RED→GREEN) `vehiculosFixture.ts` + `SCHEMA_VERSION` del mock de vehículos: cada
      habilitación que el fixture muestre debe tener **su** fila de mantenimiento `preventivo` +
      `vtv`/`rto` con `proximoVencimientoFecha`. Si no, el mock y `SupabaseVehiculoRepository`
      mostrarían cosas distintas en la misma pantalla y la divergencia sería invisible. Aprovechar
      el mismo bump 3 → 4 de la tarea 2.3 y documentar los **dos** motivos junto a la constante.
      Test dedicado (`vehiculosFixture.test.ts`) confirma `derivarHabilitaciones(mantenimientos) ===
      habilitaciones` para los 3 vehículos.
- [x] 2B.5 Verificar en navegador (`npm run dev`, todavía sobre mock) que la ficha, la lista y las
      alertas del dashboard siguen mostrando lo mismo que antes del cambio. Suite completa +
      `npx tsc -b --noEmit` + `oxlint`. Cero regresiones contra 0.4. **Nota sobre verificación en
      navegador**: no se pudo abrir un browser real en este sandbox; se verificó equivalentemente
      con tests de integración de componente (`VehiculoDetail`, `VehiculoMantenimiento`,
      `vehiculosFixture`) que ejercitan la misma ruta de render.

## 2C. `Conductor.restricciones` → `observaciones`, sobre el mock (D6 → opción B)

> **Consecuencia de UI del checkpoint 0.1**, y la de mayor superficie: elimina un campo del dominio
> y toca **tres** pantallas de `features/conductores/` que este archivo daba por intocables.
> **No toca Supabase.** Al terminar, el perfil del conductor tiene un único campo de texto libre
> (`observaciones`), alineado al docx. Revertible por sí sola.
>
> **Recordatorio del veredicto**: esto deja RN-GL-03 sin dato computable y `C-10` sin filtro
> automático por restricción. Es una decisión consciente de la usuaria — **no proponer alternativas
> ni dejar el campo "por las dudas"**.

- [x] 2C.1 (RED) Tests que fijan la forma nueva de `shared/types/conductor.ts`: `Conductor` **sin**
      `restricciones`, con `observaciones?: string` como único campo libre del perfil. `observaciones`
      **no se renombra** a `notas` en el frontend: el renombre columna↔dominio ya está resuelto en el
      mapeo (D15 #1). RED confirmado vía `tsc -b --noEmit` (`conductor.restricciones.types.test.ts`).
- [x] 2C.2 (GREEN) Eliminar `restricciones` de `Conductor` y la unión `RestriccionConductor` de
      `shared/types/conductor.ts`, y **borrar** `features/conductores/restriccionConductorOptions.ts`
      completo. Verificar con `cd frontend && npx tsc -b --noEmit`: el compilador es el que enumera
      todos los consumidores, no una búsqueda a ojo. El compilador enumeró 23 errores en 12 archivos
      de producción + test; todos corregidos (2C.3 a 2C.7).
- [x] 2C.3 (RED→GREEN) `ConductorForm.tsx`: sacar el `<fieldset>` de checkboxes de "Restricciones de
      perfil", su `<legend>`, su `Chip` de "⚠️ Pendiente de confirmar con el cliente: catálogo cerrado
      de restricciones", el campo `restricciones` de `ConductorFormValues`/`DEFAULT_VALUES` y el
      handler `toggleRestriccion`. El `Textarea` de Observaciones queda como único lugar donde se
      anota una restricción de perfil; ajustar su rótulo/ayuda para que se entienda que eso también
      va ahí. Actualizar `ConductorForm.test.tsx`. 15 tests, todos verdes.
- [x] 2C.4 (RED→GREEN) `ConductorDetail.tsx`: sacar el bloque de `Chip`s de restricciones y el
      "Sin restricciones de perfil" de la ficha, y el campo `restricciones` de los `initial`/payload
      que arma para el form y para `actualizar`. Actualizar `ConductorDetail.test.tsx`. 12 tests,
      todos verdes. **Nota**: el `AvisoModeloDatos` de esta pantalla que sigue anunciando
      "Restricciones" como catálogo cerrado pendiente de coordinar **no se toca acá** — tasks.md ya
      lo asigna explícitamente a **§8.5** con la advertencia de no re-agregar el `Chip` de 2C.3.
- [x] 2C.5 (RED→GREEN) **`ConductoresList.tsx`** — no estaba contemplado en el checkpoint y también
      muestra las restricciones por fila: sacar la columna/celda de `Chip`s y su estado vacío.
      Actualizar `ConductoresList.test.tsx` y `ConductoresPage.test.tsx`. 22 + 4 tests, todos verdes.
- [x] 2C.6 (RED→GREEN) `conductoresFixture.ts` + `SCHEMA_VERSION` del mock de conductores **2 → 3**
      (la forma de `Conductor` cambia de manera incompatible con el payload guardado; el mismatch
      re-siembra, nunca migra). Al menos un conductor del fixture debe traer una restricción
      **redactada dentro de `observaciones`**, para que la pantalla siga mostrando el caso real.
      Documentar el motivo del bump junto a la constante. `conductor-perez` trae la restricción
      redactada dentro de `observaciones`.
- [x] 2C.7 Barrer los tests que quedaron mencionando restricciones fuera de `features/conductores/`
      (`useConductores.test.ts`, `mockConductorRepository.test.ts`, y los de `dashboard/` y
      `hojas-de-ruta/` que arman conductores de prueba). Son fixtures de test, no lógica: se ajustan,
      no se reescriben. 13 archivos ajustados (`useConductoresDashboard.test.ts`,
      `NuevoRecorridoForm.test.tsx`, `VistaGlobalHojaDeRuta.test.tsx`, `HojaDeRutaImprimible.test.tsx`,
      `HojaDeRutaPage.coherencia.test.tsx`, `DashboardPage.test.tsx`, `HojaDeRutaPage.test.tsx`,
      `RecorridosDelDiaPanel.test.tsx`, `RecorridoCard.test.tsx`, `DashboardAccesibilidad.test.tsx`,
      `disponibilidad.test.ts`, `mockConductorRepository.test.ts`, `useConductores.test.ts`).
- [x] 2C.8 Suite completa + `npx tsc -b --noEmit` + `oxlint`. Cero regresiones contra 0.4.
      Verificar en navegador que alta, edición, ficha y listado de conductores andan sin el campo.
      **Nota sobre verificación en navegador**: no se pudo abrir un browser real en este sandbox;
      se verificó equivalentemente con tests de integración de componente que ejercitan alta,
      edición, ficha y listado.

## 2D. Se elimina el override de colisión, sobre el mock (decisión de 0.1)

> **Consecuencia de UI de la decisión de colisión**, no contemplada en la versión original de este
> archivo: la colisión **se bloquea siempre**, así que el override `permitirMultiple` deja de existir
> en todo el frontend. La validación pura pasa a ser **incondicional** y la barrera real pasa a ser
> el constraint `uq_conductor_semana` (1B.6). **No toca Supabase**; va sobre el mock, después de §2C
> y antes del mapeo de Conductores. Revertible por sí sola.
>
> **Los tipos de payload NO cambian**: `NuevoConductor` / `ActualizacionConductor` quedan como están.
> No hay ningún flag que llevar hasta la RPC, y por eso tampoco hay canal que abrir.

- [x] 2D.1 (RED→GREEN) `shared/lib/conductores/validarAsignacionSemanal.ts`: eliminar el parámetro
      `permitirMultiple` de `ValidarAsignacionSemanalInput` y la rama `if (colision &&
      !permitirMultiple)` pasa a ser `if (colision)`. La función queda **total e incondicional**:
      toda colisión de vehículos distintos en la misma semana se rechaza. Actualizar
      `validarAsignacionSemanal.test.ts`: los 4 casos que pasaban `permitirMultiple: false` pierden
      la clave, y el caso `permitirMultiple: true` **se reemplaza** por uno que afirma que la
      colisión se rechaza igual (no se borra el test: se invierte la aserción, que es lo que
      documenta la decisión). Sumado un test de tipos (`@ts-expect-error`) que confirma que la
      firma no admite `permitirMultiple`. 6 tests, todos verdes.
- [x] 2D.2 (RED→GREEN) `AsignacionSemanalTabla.tsx`: sacar el `useState` `permitirMultiple`, el
      toggle "Permitir múltiple" (el `<label>` + `<input type="checkbox">` + los dos `<span>` del
      switch) y el argumento de la llamada a `validarAsignacionSemanal`. El `Button` de "Asignar"
      queda solo en su fila — ajustar el contenedor `flex items-center justify-between` para que no
      quede un hueco a la izquierda (usar los componentes del design system, nunca `style={{}}`).
      Actualizar el comentario de cabecera del archivo, que hoy describe el override.
- [x] 2D.3 (RED→GREEN) `AsignacionSemanalTabla.tsx`: sacar también el `AvisoPendienteCliente`
      *"Confirmar si un conductor puede tener dos vehículos la misma semana (excepción explícita)"* —
      **esa pregunta está cerrada** (pendiente #2 de C-09) y dejar el cartel sería anunciar como
      pendiente algo ya decidido. Si hace falta señalizar algo en su lugar, es que la restricción es
      dura y viene de la base, no un `AvisoPendienteCliente`.
- [x] 2D.4 (RED→GREEN) `AsignacionSemanalTabla.test.tsx`: el test *"bloquea el guardado por colisión
      sin `permitirMultiple`"* pierde la mención al flag; el test *"permite la excepción explícita"*
      **se reemplaza** por uno que confirma que **no existe** ningún control para habilitar la doble
      asignación y que la colisión se bloquea siempre. 13 tests, todos verdes.
- [x] 2D.5 Suite completa + `npx tsc -b --noEmit` + `oxlint`. Cero regresiones contra 0.4. Verificar
      en navegador que el alta de asignación sigue andando y que una colisión muestra el error.
      **Nota sobre verificación en navegador**: no se pudo abrir un browser real en este sandbox; se
      verificó equivalentemente con `AsignacionSemanalTabla.test.tsx` (alta exitosa + colisión
      bloqueada con mensaje visible).

## 3. Preparación del mapeo — verificaciones que ahorran retrabajo

- [x] 3.1 Releer `frontend/src/shared/lib/vehiculos/VehiculoRepository.ts` y
      `conductores/ConductorRepository.ts` y anotar las 4 firmas exactas. **Ninguna cambia en este
      change.**

      Las 4 firmas, **idénticas** en las dos interfaces (solo cambia el tipo del dominio):
      ```ts
      list(): Promise<Vehiculo[]>                                          // ConductorRepository: Promise<Conductor[]>
      getById(id: string): Promise<Vehiculo | null>                        // getById(id): Promise<Conductor | null>
      create(data: NuevoVehiculo): Promise<Vehiculo>                       // create(data: NuevoConductor): Promise<Conductor>
      update(id: string, data: ActualizacionVehiculo): Promise<Vehiculo>   // update(id, data: ActualizacionConductor): Promise<Conductor>
      ```
      `getById` de un id inexistente resuelve `null`, nunca lanza — confirmado en el comentario de
      ambas interfaces. Ningún método cambia de firma en este change (D2, D15): el swap de §5/§7 es
      estrictamente un cambio de implementación inyectada.

- [x] 3.2 Releer `useVehiculos.ts` / `useConductores.ts` y confirmar que renderizan `err.message` sin
      transformarlo (`toErrorMessage`). Es lo que hace que el contrato de error de D12 sea normativo.

      Confirmado: los dos hooks tienen la **misma** `toErrorMessage`:
      ```ts
      function toErrorMessage(err: unknown): string {
        if (err instanceof Error) return err.message;
        return 'Ocurrió un error inesperado.';
      }
      ```
      Se usa en `cargar()`, `crear()` y `actualizar()`, siempre como `setError(toErrorMessage(err))`
      antes de volver a lanzar (`crear`/`actualizar` hacen `throw err` después de setear el error, así
      que el componente que llama también puede capturarlo). Ningún componente re-parsea ni
      transforma `err.message` — confirma que el contrato de error (instancia de `Error`, mensaje en
      castellano mostrable tal cual) es **normativo**: cualquier implementación que rompa esa forma
      rompe la UI sin aviso en tiempo de compilación.

- [x] 3.3 Anotar, contra `frontend/src/shared/types/vehiculo.ts`, los 4 miembros de la unión
      `MantenimientoRegistro` y qué columna alimenta cada campo. Este mapa es el input del test de
      triangulación de 4.3.

      Los 4 miembros de la unión discriminada (`shared/types/vehiculo.ts`), con la columna real de
      `conductores.mantenimiento` que alimenta cada campo (D4, migración `…campos.sql` 1B.1/1B.2):

      | Miembro | Campos propios | Columna(s) que lo alimentan |
      |---|---|---|
      | `{ tipoIntervencion: 'preventivo'; subtipo: SubtipoPreventivo }` | — | `categoria='preventivo'`, `subtipo IN ('cambio-aceite-filtros','vtv','rto')` |
      | `{ tipoIntervencion: 'correctivo'; subtipo: SubtipoCorrectivoConocido }` | — | `categoria='correctivo'`, `subtipo IN ('alternador','bateria','frenos','embrague','cubiertas')` |
      | `{ tipoIntervencion: 'correctivo'; subtipo: 'otro'; detalle: string }` | `detalle` | `categoria='correctivo'`, `subtipo='otro'`, `detalle IS NOT NULL` |
      | `{ tipoIntervencion: 'gasto' }` | — | `categoria='gasto'`, `subtipo IS NULL`, `detalle IS NULL` |

      Campos comunes a los 4 (`MantenimientoRegistroBase`): `id ← id`, `fecha ← fecha`,
      `kilometraje ← km_actual`, `proximoVencimientoFecha? ← fecha_proximo_vencimiento`,
      `proximoVencimientoKm? ← km_proximo_vencimiento`, `descripcion? ← descripcion` (columna
      aditiva de 1B.1). El `chk_categoria_subtipo` (1B.2) es exactamente la tabla de arriba escrita
      como CHECK — una fila que no calce ningún renglón no puede existir una vez validado el
      constraint, y mientras esté `NOT VALID` el mapeo la descarta (4.3).

## 4. Mapeo puro de Vehículos — `vehiculoMapping.ts` (TDD, sin red)

> ~~Bloqueada por el checkpoint **0.1**.~~ **Desbloqueada**: D3 resolvió por B (habilitaciones
> derivadas, 4.7) y D5 por A (accesorios degradan, 4.5 + 5.4). Requiere **§2B** terminada, porque
> el mapeo reusa `derivarHabilitaciones` de 2B.1.
>
> **✅ Completa (2026-07-31, apply batch 2).** Archivo nuevo:
> `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts` +
> `vehiculoMapping.test.ts` (65 tests, todos verdes). Enteramente pura/sin red, cero `any`, cero
> `as` (verificado con `grep`, no solo por revisión). `tsc -b --noEmit` y `oxlint` limpios.

- [x] 4.1 (RED→GREEN→TRIANGULATE) `parseVehiculoRow`: renombres, `capacidad`/`kilometraje`
      numéricos (degradan a `0` si no son número, nunca `NaN`), `notas` opcional (`undefined` si
      ausente, no `''` inventado). Fila sin `id` o sin `patente` → se descarta (`null`), no rompe
      el `list()` entero. La columna `año` (D15 #14) se lee de la fila y se ignora deliberadamente
      — sin campo en el dominio, discrepancia ya documentada y no resuelta en este change. 6 tests.
- [x] 4.2 (RED→GREEN→TRIANGULATE) `parseEstadoVehiculo` / `toEstadoVehiculoRow` (D13): `'fuera de
      servicio'` ↔ `'fuera-de-servicio'`, `'habilitado'` ↔ `'habilitado'`. **Funciones totales, no
      un `.replace(' ','-')`**: comparación literal por rama, no reemplazo de substring. Valor
      desconocido (incluido `null`/`undefined`/no-string) → degrada a `'habilitado'`, nunca lanza.
      5 tests.
- [x] 4.3 (RED→GREEN→TRIANGULATE) `parseMantenimientoRow`: reconstruye la unión discriminada de 4
      miembros desde `categoria` + `subtipo` + `detalle`, espejando **exactamente** el CHECK
      `chk_categoria_subtipo` de D4/1B.2 rama por rama. 14 tests: los 4 miembros (incluida una VTV
      con vencimiento completo), `correctivo`+`'otro'` sin `detalle` (descartada),
      `correctivo`+`'otro'` con `detalle` en blanco/`'   '` (descartada, `btrim` del CHECK),
      `preventivo` con subtipo fuera de la unión (descartada), `correctivo` con subtipo fuera de la
      unión conocida y distinto de `'otro'` (descartada), `gasto` con `subtipo` presente (viola el
      CHECK, descartada), fila sin `id`/sin `fecha` (descartada), valor no-objeto (descartado).
      **Decisión no obvia encontrada leyendo el CHECK con atención** (no estaba en el enunciado de
      la tarea): la rama `correctivo` + subtipo conocido (`alternador`/`bateria`/`frenos`/
      `embrague`/`cubiertas`) del CHECK **no exige `detalle IS NULL`**, a diferencia de la rama
      `preventivo`. Una fila con ese subtipo y un `detalle` perdido igual satisface el CHECK real
      en la base. El tipo de ese miembro (design.md D4) no tiene campo `detalle`, así que la
      decisión tomada es **ignorar el `detalle` en la lectura** en vez de descartar una fila que la
      base considera válida (sería más estricto que la propia base). Test dedicado de
      triangulación que lo confirma.
- [x] 4.4 (RED→GREEN) `toMantenimientoRows`: la vuelta. `tipoIntervencion: 'gasto'` no emite
      `subtipo` ni `detalle` (`null`); `'otro'` emite los dos; `preventivo`/`correctivo` conocido
      emiten `subtipo` y `detalle: null`. 4 tests.
- [x] 4.5 (RED→GREEN) `parseAccesoriosRows`: del embed de dos niveles
      (`accesorios_vehiculo → accesorios.tipo`) a `AccesorioMovilidad[]`. Un `tipo` que no pertenece a
      la unión cerrada se descarta (sin `as`); una fila sin el embed anidado también se descarta sin
      romper el resto. Embed vacío → `[]` **sin distinguir** todavía si es "no tiene" o "RLS lo
      ocultó" — esa distinción la agrega el repository en 5.4, no el mapeo. 5 tests.
- [x] 4.6 (RED→GREEN) `parseGastoRow`: `monto NUMERIC(10,2)` llega como `string` desde PostgREST en
      algunas versiones — parseado con `Number()` (nunca `parseFloat` sobre `unknown` sin
      narrowing) y `NaN`/no-numérico descarta la fila entera (nunca un monto inventado).
      `descripcion` opcional. 8 tests.
- [x] 4.7 (RED→GREEN) **Habilitaciones derivadas (D3-B)**. No hay `parseHabilitacionRow` ni tabla que
      leer: `ensamblarVehiculo` llama a `derivarHabilitaciones(mantenimientos)` (2B.1) **después** de
      mapear (y filtrar) el historial, y `Vehiculo.habilitaciones` sale de ahí. Tests: la VTV
      derivada de su fila de mantenimiento llega en `habilitaciones`, y una fila de mantenimiento
      **descartada por incoherente** (4.3, `categoria='correctivo'` + `subtipo='vtv'`, combinación
      inexistente en el CHECK) no produce una habilitación fantasma — nunca llega a
      `derivarHabilitaciones` porque `parseMantenimientoRow` ya la filtró antes.
- [x] 4.7b (RED→GREEN) La escritura **nunca** emite `habilitaciones`: `toCrearVehiculoPayload` y
      `toActualizarVehiculoPayload` ignoran esa clave aunque venga en el payload (es un campo de
      salida, y no hay tabla donde ponerla). Test explícito con `'habilitaciones' in payload` para
      las dos funciones, incluido el caso `ActualizacionVehiculo.habilitaciones` presente (el tipo
      la admite por ser `Partial<Omit<Vehiculo,'id'>>`, pero nunca se lee).
- [x] 4.8 (RED→GREEN→TRIANGULATE) `ensamblarVehiculo(row, gastosRows)`: ordena mantenimientos y
      gastos por `fecha` desc con `id` como desempate determinista (también desc — "el más nuevo
      primero" aplicado consistentemente a las dos claves de orden). Colecciones vacías → arrays
      vacíos, nunca `undefined` (verificado explícitamente para las 4 colecciones). Fila de
      vehículo inválida → `null` (no rompe el `list()` entero); `gastosRows` no-array → `gastos: []`.
      8 tests.
- [x] 4.9 (RED→GREEN→TRIANGULATE) `toActualizarVehiculoPayload(cambios)`: **la semántica parcial**.
      Clave ausente ≠ clave presente con `[]`. Test dedicado por colección (`mantenimientos`,
      `gastos`, `accesoriosCompatibles`) confirmando que editar solo la patente **no** emite esas
      claves, y que una colección vacía explícita **sí** viaja (`'mantenimientos' in payload ===
      true`, `payload.mantenimientos === []`). También cubre `estado` (traducido), `notas`/
      `fechaUltimoService` (`''` → `null`, vaciar el campo) y todos los campos escalares presentes
      a la vez. 12 tests. También se escribió `toCrearVehiculoPayload` (implícita en el enunciado
      de 4.7b, no tenía número propio): argumento `p_vehiculo` completo, sin `habilitaciones`.
- [x] 4.10 (REFACTOR) Type guards compartidos extraídos desde el inicio de la implementación
      (`isRecord`, `esFilaConId`, y la fábrica `esValorDe<T>` para uniones cerradas de string sin
      `as`, que reemplaza el patrón `Set<T>.has(value as T)` de `pacienteMapping`/
      `obraSocialMapping` — acá la regla de 4.3 prohíbe `as` explícitamente). También compartidas:
      `toGastoRows` (entre `toCrearVehiculoPayload`/`toActualizarVehiculoPayload`) y
      `ordenarPorFechaDescYId` (entre mantenimientos y gastos de `ensamblarVehiculo`). Suite verde
      tras cada paso (65/65 al final). `grep` confirma cero `as`/`any` en el archivo de producción.
- [x] 4.11 Cobertura de `vehiculoMapping.ts`: **100% statements, 100% lines, 96.59% branches, 100%
      funciones** (umbral del proyecto: 80, precedente de `integracion-pacientes`: 85, pedido acá:
      ≥85 %) — medido con `vitest run --coverage --coverage.include='...vehiculoMapping.ts'`.

## 4B. Reconciliación de `vehiculoMapping.ts` con la Edge Function real de Enzo (C-08)

> **Nueva sección (2026-08-01), consecuencia directa de design.md §Reconciliación con
> C-08-vehiculos-mantenimiento.** `vehiculoMapping.ts` (§4) ya está implementado y verde sobre la
> forma que este documento había planeado (PostgREST + RPC directo). **Esta sección documenta lo
> que hay que cambiar, no lo reescribe todavía** — la reescritura del mapeo es trabajo del **próximo
> batch de `sdd-apply`**, no de esta reconciliación. Nada de lo siguiente se implementa acá.

- [ ] 4B.1 `parseGastoRow`/`toGastoRows`: dejar de leer/escribir `facturacion.gastos_vehiculos` (D9/
      D11 SUPERSEDED). Deben leer/escribir filas de `conductores.mantenimiento` con `categoria =
      'gasto'`, usando `monto`, `descripcion` y `categoria_gasto` (columnas ya aplicadas por Enzo).
      Decidir, junto con Enzo, si `GastoVehiculo` recupera un campo `categoria` (gap documentado en
      design.md) o si el mapeo lo ignora en la lectura y nunca lo emite en la escritura.
- [ ] 4B.2 Habilitaciones: dejar de llamar `derivarHabilitaciones()` en `ensamblarVehiculo` para el
      repository real (la función sigue viva para el mock, sin tocar). El repository real consume
      `habilitaciones` ya resuelto por la Edge Function (viene de la tabla real
      `conductores.habilitaciones_vehiculo`, sin `id` en el JSON — el tipo `RegistroHabilitacion` no
      lo necesita, confirmado contra `shared/types/vehiculo.ts`).
- [ ] 4B.3 Kilometraje: `kilometraje` sigue siendo columna propia pero **nullable** (tratar `null`
      como `0` en la lectura, sin pedir migración de nullability). `kilometrajeUltimoService`/
      `fechaUltimoService` dejan de ser payload de escritura del vehículo — son derivados por la
      Edge Function del último `mantenimiento` `preventivo`, y el mapeo del repository real solo los
      lee del JSON de respuesta, nunca los envía en `toCrearVehiculoPayload`/
      `toActualizarVehiculoPayload`.
- [ ] 4B.4 `mantenimientos`: **bloqueado por el `#### Gap abierto` de design.md** — la Edge Function
      no expone ningún array de intervenciones preventivas/correctivas todavía. No implementar una
      solución unilateral (ni inventar un array vacío permanente): coordinar con Enzo cuál de los
      dos caminos del gap se toma antes de tocar `parseMantenimientoRow`/`ensamblarVehiculo` para el
      repository real.
- [ ] 4B.5 Accesorios: sin cambios de fondo — el catálogo `pacientes.accesorios` ya está sembrado
      (1B.3) con los mismos 5 valores que `parseAccesoriosRows` ya espera. Ajustar solamente la
      fuente: la Edge Function ya resuelve `accesoriosCompatibles` como `string[]` de `tipo`, no como
      el embed anidado `accesorios_vehiculo → accesorios` de D11 — el mapeo consume ese array
      directo en vez de reconstruirlo de un embed de dos niveles.

## 5. Repository real de Vehículos + swap — `SupabaseVehiculoRepository.ts`

> **⚠️ RECONCILIADO (2026-08-01, ver design.md §Reconciliación D11).** Esta fase ya **no** está
> bloqueada por 1B.11 (las 4 migraciones/RPC de D9 no se van a escribir, ver 1B.8) — las migraciones
> de Enzo ya están mergeadas y presumiblemente desplegadas al proyecto real (**asunción a
> verificar**: no hay forma de confirmar el estado de deploy desde este sandbox; si al implementar
> §5 aparece `PGRST204`/`404` contra la Edge Function, es la señal de que falta desplegar, no un bug
> del mapeo). El repository real **llama a la Edge Function `vehiculos` por HTTP**, no a
> PostgREST+RPC directo: mismo patrón que `frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.ts`
> (`supabase.functions.invoke(nombre, { body, method })`, con `mapearErrorEdgeFunction` traduciendo
> `error.context` por status). Las tareas de abajo **siguen siendo las de la versión anterior de
> este documento** (siguen sin implementarse) y quedan para el próximo batch de `sdd-apply`, que
> deberá reescribirlas contra el patrón real en vez de PostgREST+RPC — no se reescriben acá porque
> esta reconciliación es solo documentación/specs, no código.

- [ ] 5.1 (RED) Montar el fake tipado de `supabaseClient` (`vi.mock('../supabaseClient')`) con
      interfaces propias, **cero `any`, cero `as`**, que **registra** cada llamada. Precedente:
      `SupabasePacienteRepository.test.ts`.
- [ ] 5.2 (RED→GREEN) `list()` y `getById()` con el `select` de embeds de D11 sobre
      `schema('conductores')`. `getById` de un id inexistente → **`null`, no lanza**.
- [ ] 5.3 (RED→GREEN) La **segunda consulta batcheada** a `facturacion.gastos_vehiculos`: una sola
      query con `.in('vehiculo_id', ids)` para `list()`, agrupada client-side. Test que afirma
      **una** llamada, no N.
- [ ] 5.4 (RED→GREEN→TRIANGULATE) **Degradación cross-módulo (D10)**, el requisito de comportamiento
      más importante de la fase:
      - `42501`/embed vacío de `pacientes` → `accesoriosCompatibles: []` **+ flag de degradación**,
        y `list()`/`getById()` **no fallan**.
      - `42501` de `facturacion` en la lectura → `gastos: []` + flag, `getById()` **no falla**.
      - Nunca inventar un accesorio ni un monto; nunca convertir un permiso faltante en una pantalla
        rota.
- [ ] 5.5 (RED→GREEN) `create()` y `update()` vía `.rpc()`. Tests que afirman que `create()` emite
      **una sola** `.rpc()` y **ningún** `.insert()` sobre las tablas hijas, y que la relectura
      posterior devuelve lo que quedó realmente en la base.
- [ ] 5.6 (RED→GREEN) `mapearErrorVehiculo`: la tabla completa de D12 (`23505` patente, `23503`,
      `23514`, `22P02`, `42501` de `vehiculos` vs. de `facturacion`, `45201`–`45204`, `PGRST202`,
      `PGRST204`, `PGRST106`, genérico). Cada rama con su test. **Nunca propagar `error.message`
      crudo** (filtra nombres de tablas y devuelve texto en inglés).
- [ ] 5.7 Test de código fuente (`?raw`) del repository: no contiene `service_role`, no contiene
      `any`, no consulta `modulos.permisos` ni `modulos.modulos`.
- [ ] 5.8 Test que lee `20260801120001_conductores_vehiculos_rpc.sql` **con `node:fs`** (no con `?raw`
      de Vite — no funciona para rutas fuera de `frontend/`, lección de `integracion-pacientes`
      3.12b) y verifica que dice `SECURITY INVOKER` y **no** `SECURITY DEFINER` fuera de comentarios
      y literales. **Es la única barrera automatizada** contra la regresión de seguridad más grave.
- [ ] 5.9 **CORTE REAL 1** — `VehiculosRoute.tsx` pasa a inyectar `supabaseVehiculoRepository`.
      Ajustar `VehiculosRoute.test.tsx` (doble inyectado). El diff de producto es **un import y una
      prop**.
- [ ] 5.10 Anotar en esta tarea el **estado transitorio conocido** (D2): desde acá hasta §7, el
      selector de vehículo de la pantalla de Conductores muestra vehículos **reales** mientras las
      asignaciones siguen guardándose en `localStorage` contra ids de mock que ya no existen. Es
      esperado y dura una sola fase. Si el change se detiene acá, **revertir 5.9**.
- [ ] 5.11 Suite completa + `npx tsc -b --noEmit` + `oxlint`. Cero regresiones contra 0.4.

## 6. Mapeo puro de Conductores — `semanaIso.ts` + `conductorMapping.ts` (TDD, sin red)

> **✅ Completa (2026-08-01, apply batch 3).** Archivos:
> `frontend/src/shared/lib/conductores/semanaIso.ts` (heredado de un intento previo interrumpido de
> este mismo batch, verificado línea por línea contra los 5 casos borde exigidos y **corregido**
> antes de aceptarlo — ver 6.1) + `semanaIso.test.ts` (9 tests) y
> `frontend/src/shared/lib/conductores/conductorMapping.ts` (nuevo) +
> `conductorMapping.test.ts` (nuevo, 35 tests). Enteramente puro/sin red, cero `any`, cero `as`
> (verificado con `grep`). `tsc -b --noEmit` y `oxlint` limpios. Reconciliación de backend
> (2026-08-01) confirmada sin efecto sobre esta sección (D4/D6/D7/1B.4/1B.6/1B.9 no tocan Conductores).

- [x] 6.1 (RED→GREEN→TRIANGULATE) `semanaIso.ts`, módulo aritmético puro, **sin nada de Postgres**.
      `semanaIsoADesdeHasta('2026-W30')` → `{ desde: lunes, hasta: domingo }`;
      `desdeHastaASemanaIso(init, fin)` → `'2026-W30'`. Casos borde obligatorios, uno por test:
      - la semana 1 ISO es **la que contiene el primer jueves del año**, no la del 1 de enero;
      - años de **53 semanas**;
      - una semana que **cruza el cambio de año** (empieza en diciembre, termina en enero);
      - **el parseo de un `DATE` sin corrimiento de zona horaria**: `new Date('2026-07-27')` se
        interpreta como **UTC** y en Argentina (UTC−3) devuelve el 26. Parsear a componentes y
        construir la fecha **local**. Es el bug más probable de todo el change.
      - ida y vuelta: `desdeHastaASemanaIso(semanaIsoADesdeHasta(s)) === s` para ≥ 10 semanas
        distintas repartidas en el año.

      **Nota de continuidad**: este archivo y su test ya existían en el filesystem al empezar este
      batch, de un intento previo de esta misma tarea que quedó interrumpido a mitad de ciclo. Se
      verificaron los 9 tests contra los 5 casos borde exigidos por el enunciado — todos presentes y
      correctos (semana 1 ISO vía primer jueves, año de 53 semanas 2026, cruce de año 2026-W53,
      parseo local sin `new Date(stringISO)` con comentario explícito del bug UTC−3, round-trip de
      12 semanas) — y se corrieron: 9/9 verdes. Se adoptó tal cual, sin reescribir, con una sola
      corrección real encontrada recién al correr `tsc -b --noEmit` (paso que el intento anterior no
      había llegado a hacer): `parseFechaLocal` desestructuraba
      `fecha.split('-').map(Number)` en `[anio, mes, dia]`, y con
      `noUncheckedIndexedAccess: true` (tsconfig del proyecto) el compilador correctamente marca esos
      tres valores como `number | undefined` — error real de tipos, no ruido del compilador. Corregido
      leyendo cada posición con `?? NaN` antes del `Number(...)`. Suite re-verificada verde tras el
      fix (9/9).
- [x] 6.2 (RED→GREEN→TRIANGULATE) `parseConductorRow`: renombres `dni` ↔ `documento`, `notas` ↔
      `observaciones`, `fecha_nacimiento` ↔ `fechaNacimiento`. `domicilio` y `cuil` son **requeridos
      en el tipo del frontend y nullable en la base** → degradan a `''` (la obligatoriedad real es
      pregunta abierta, no se cambia acá). Fila sin `id` o sin `dni` (las dos columnas identificadoras
      `NOT NULL` sin default) se descarta (`null`), sin romper el `list()` entero — mismo criterio que
      `parseVehiculoRow` con `id`/`patente`. 5 tests.
- [x] 6.3 (RED→GREEN→TRIANGULATE) `parseEstadoConductor` / `toEstadoConductorRow` (D13): `'fuera de
      servicio'` ↔ `'fuera-de-servicio'`. Valor desconocido → degrada a `'operando'`. Funciones
      totales (comparación literal por rama, no `.replace`), mismo patrón que `parseEstadoVehiculo`.
      5 tests.
- [x] 6.4 (RED→GREEN) **`restricciones` no se mapea (D6-B)**: no existe en el dominio ni en la base.
      Lo único que viaja es `notas` ↔ `observaciones` (ya cubierto por 6.2). Test de regresión: el
      payload de escritura **no** contiene ninguna clave `restricciones` (verificado en 6.8, junto a
      los demás tests de `toActualizarConductorPayload`), y una fila de la base que trajera una
      columna inesperada con ese nombre se ignora sin romper la lectura (`parseConductorRow` nunca
      lee `row.restricciones`). 2 tests (uno de lectura acá, uno de escritura en 6.8).
- [x] 6.5 (RED→GREEN→TRIANGULATE) `parseAsignacionRow`: `(fecha_init, fecha_fin_semana)` →
      `AsignacionSemanal { id, vehiculoId, semana }` vía `semanaIso.ts`. **Fila incoherente**
      (`fecha_init` que no es lunes): se deriva la semana que **contiene** `fecha_init` — no se
      descarta ni se "corrige" (test explícito con `fecha_init` en miércoles, `fecha_fin_semana`
      desalineada). Filas sin `id`/`vehiculo_id`/alguna fecha se descartan (`null`). 6 tests.
- [x] 6.6 (RED→GREEN→TRIANGULATE) `toAsignacionRows`: la vuelta, con `fecha_init` = lunes y
      `fecha_fin_semana` = domingo de la semana indicada. Incluye test de round-trip
      `toAsignacionRows(parseAsignacionRow(row)) === row`. 4 tests.
- [x] 6.7 (RED→GREEN→TRIANGULATE) `ensamblarConductor(row)`: asignaciones ordenadas por `fecha_init`
      asc con `id` como desempate — el orden se aplica **antes** de convertir a `semana` (sobre las
      filas crudas del embed), porque `AsignacionSemanal` ya no conserva `fecha_init` una vez mapeada.
      Embed ausente/no-array → `asignaciones: []`, nunca `undefined`. Fila de conductor inválida →
      `null`. Fila de asignación incoherente (sin `id`) descartada sin romper el conductor. 7 tests.
- [x] 6.8 (RED→GREEN→TRIANGULATE) `toActualizarConductorPayload(cambios)`: semántica parcial. Editar
      solo el teléfono **no** debe emitir la clave `asignaciones`. La semántica es uniforme para
      todas las claves —clave ausente = "no tocar"— porque **no hay ningún flag de instrucción en el
      payload**: la colisión la resuelve el constraint de la base (D7 §Colisión), no una decisión que
      viaje en el `jsonb`. Test de regresión: el payload emitido **no** contiene ninguna clave
      `permitirMultiple` ni `restricciones` (D6-B). Colección `asignaciones` explícita (incluso `[]`)
      sí viaja — clave presente ≠ ausente, mismo criterio que `toActualizarVehiculoPayload` (4.9).
      11 tests.
- [x] 6.9 Cobertura de `conductorMapping.ts` y `semanaIso.ts` ≥ 85 %: **99.11% statements, 91.34%
      branches, 100% funciones, 98.91% lines** combinadas — medido con
      `vitest run --coverage --coverage.include='...conductorMapping.ts' --coverage.include='...semanaIso.ts'`.
      Detalle por archivo: `conductorMapping.ts` 100% stmts / 94.68% branches / 100% funcs / 100%
      lines; `semanaIso.ts` 97.14% stmts / 60% branches / 100% funcs / 97.14% lines (única rama sin
      cubrir: el `throw` de formato de etiqueta inválida en `parseEtiquetaSemana`, no exigido por el
      enunciado de 6.1 y muy por encima del umbral igual).

## 7. Repository real de Conductores + swap — `SupabaseConductorRepository.ts`

> **Bloqueada por 1B.11.**

- [ ] 7.1 (RED) Fake tipado del cliente, mismo patrón de 5.1.
- [ ] 7.2 (RED→GREEN) `list()` y `getById()` con el embed de `conductores_vehiculos` (D11).
      `getById` de un id inexistente → **`null`, no lanza**.
- [ ] 7.3 (RED→GREEN→TRIANGULATE) **Degradación cross-módulo (D10)**: sin `vehiculos: read`, el
      embed de `conductores_vehiculos` vuelve vacío → `asignaciones: []` **+ flag de degradación**,
      y la lectura del conductor **no falla**. Es el caso contra-intuitivo del change (la pantalla de
      Conductores necesita el permiso de **Vehículos**) y hoy no está escrito en ningún lado.
- [ ] 7.4 (RED→GREEN) `create()` y `update()` vía `.rpc()`, mismos tests de "una sola `.rpc()`" y
      relectura posterior. El `jsonb` enviado lleva **solo datos del conductor**: no hay ningún flag
      de instrucción de escritura que propagar (D7 §Colisión eliminó `permitirMultiple`).
- [ ] 7.4b (RED→GREEN) **Colisión rechazada por la base**: los **dos** `23505` posibles sobre
      `conductores_vehiculos` se distinguen por el **nombre del constraint** que Postgres reporta en
      `message`/`details`, y cada uno tiene su mensaje:
      - `uq_conductor_semana` (1B.6) → `Error('Ese conductor ya tiene otro vehículo asignado en esa
        semana.')`
      - `conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key` → `Error('Ese conductor ya
        tiene ese vehículo asignado en esa semana.')`
      Los dos mensajes se parecen y se confunden fácil (**«otro» vs. «ese»**): test por cada uno, más
      un test del fallback cuando el nombre del constraint no viene en el error.
- [ ] 7.5 (RED→GREEN) Test de **RN-GL-03**: el alta de un conductor **no crea ninguna fila** en
      `auth.users` ni en `usuarios`. Los conductores no acceden al sistema. Verificable por
      aserción sobre las llamadas registradas del fake (el repository nunca toca `auth`) y como
      punto del checklist manual de 8.4.
- [ ] 7.6 (RED→GREEN) `mapearErrorConductor`: tabla de D12 (`23505` sobre `dni`, los **dos** `23505`
      de `conductores_vehiculos` discriminados por nombre de constraint (7.4b), `23503` de vehículo
      inexistente, `42501` de `conductores` vs. de `vehiculos`, `45201`/`45202`,
      `PGRST202`/`PGRST204`/`PGRST106`, genérico). **No existe `45205`.**
- [ ] 7.7 Test de código fuente (`?raw`): sin `service_role`, sin `any`, sin `modulos.permisos`.
- [ ] 7.8 **CORTE REAL 2** — `ConductoresRoute.tsx` pasa a inyectar `supabaseConductorRepository`
      **y** `supabaseVehiculoRepository` (monta los dos providers). Ajustar
      `ConductoresRoute.test.tsx`. El estado transitorio de 5.10 se cierra acá.
- [ ] 7.9 Suite completa + `npx tsc -b --noEmit` + `oxlint`. Cero regresiones.

## 8. Señalización de discrepancias en la UI

> Regla dura del proyecto: toda discrepancia se documenta en **dos lugares** (KB + `CHANGES.md`) **y**
> con un cartel `AvisoModeloDatos` en la pantalla, para que quien vea la app la note sin leer la KB.
> Reusar `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`, nunca markup a mano.

- [ ] 8.1 `VehiculoDetail.tsx` — **reescribir** el cartel de gastos: hoy dice que el docx ubica los
      gastos bajo el módulo `facturacion`; pasa a decir que **así está implementado** y qué implica
      (sin `facturacion: read` la sección se ve vacía y **eso no significa que no haya gastos**).
- [ ] 8.2 `VehiculoDetail.tsx` — cartel nuevo en la sección de accesorios: el catálogo vive en el
      schema `pacientes` y requiere permiso del módulo **Pacientes**; una lista vacía puede ser
      "no admite accesorios" o "no tenés el permiso". Solo se muestra cuando el flag de degradación
      de 5.4 está activo.
- [ ] 8.3 `VehiculoDetail.tsx` — **reescribir** el cartel de la sección Mantenimiento (D3-B). Hoy
      dice que "el vencimiento de VTV/RTO se sigue rastreando en las habilitaciones del vehículo, no
      en el historial" y anuncia la duplicación como pendiente: **eso ya no es cierto**. Pasa a
      decir que las habilitaciones VTV/RTO **se derivan del historial** (intervención preventiva con
      subtipo VTV/RTO y su próximo vencimiento), alineado con el docx, y que **el kilometraje y el
      último service siguen siendo campos propios de Vehículo**, no derivados — que es la parte de la
      divergencia con el docx que sobrevive.
- [ ] 8.4 `ConductorDetail.tsx` §Flota — **reescribir** el cartel de asignación semanal: la etiqueta
      ISO ↔ dos fechas ya no es una discrepancia pendiente sino una conversión implementada (D7); el
      cartel pasa a explicar que **la grilla requiere permiso del módulo Vehículos**, no del de
      Conductores.
- [ ] 8.5 `ConductorDetail.tsx` — **reescribir** el cartel de `restricciones` (D6-B). Hoy anuncia una
      divergencia pendiente ("acá es catálogo cerrado, en el docx es texto libre — a coordinar con
      Enzo"): **esa divergencia ya no existe**, se resolvió a favor del docx. Pasa a decir que las
      restricciones de perfil se anotan en **Observaciones**, como texto libre, igual que el modelo de
      datos real — y que por eso **no se pueden filtrar automáticamente** en las hojas de ruta
      (`C-10`), que es la consecuencia que quien use la app necesita saber.
      **Ojo con el orden**: este cartel se reescribe acá, pero el `Chip` de "pendiente de confirmar"
      de `ConductorForm` ya se eliminó en 2C.3 — no re-agregarlo.
- [ ] 8.6 Verificar que ningún cartel usa `style={{}}` ni reimplementa estilos que ya están en el
      design system.

## 9. Documentación de las discrepancias (fuera del código)

- [ ] 9.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bloque nuevo **"Vehículos y
      Conductores vs. esquema real de C-08/C-09"**, siguiendo el formato del bloque "Pacientes vs.
      esquema real de `C-05`". Incluir el **mapa completo de los 4 módulos de permisos** (la tabla de
      §Context del design), que hoy no está documentado en ningún lado.
- [ ] 9.2 `knowledge-base/04_modelo_de_datos.md` — tachar (`~~…~~` + nota de resolución) lo que este
      change cierra: `Vehiculo.notas`, `GastoVehiculo.descripcion`, la categoría de mantenimiento de
      dos niveles sin columnas, y la etiqueta ISO de la asignación semanal.
- [ ] 9.3 `CHANGES.md` §C-08 — bullet `⚠️ Discrepancia` actualizado; marcar como **resuelto** que
      `gasto_vehiculo` cuelga del módulo `facturacion` (ya está implementado como
      `facturacion.gastos_vehiculos`, **no falta ninguna tabla**) y sumar lo que este change resolvió
      y lo que dejó abierto.
- [ ] 9.4 `CHANGES.md` §C-09 — actualizar los 5 pendientes de UI: **#5 cerrado** (semana ISO, D7:
      conversión pura, el tipo no cambia); **#1 cerrado** (restricciones → `notas`, D6-B: el docx
      gana, el campo estructurado se elimina del dominio y `C-10` pierde el filtro computable);
      **#2 cerrado** (colisión: se bloquea **siempre**, sin override; el constraint
      `uq_conductor_semana` la vuelve imposible a nivel de base y `permitirMultiple` se elimina del
      frontend); **#3** (campos obligatorios del alta) y **#4** (checklist de
      documentos) siguen abiertos y se remiten a §Open Questions del design.
- [ ] 9.4b `CHANGES.md` §C-08 y `knowledge-base/04_modelo_de_datos.md` — registrar que la
      **duplicación VTV/RTO quedó eliminada** (D3-B: las habilitaciones se derivan del historial, no
      hay tabla propia), no diferida. Es el punto 2 del bloque de `vehiculo-mantenimiento-registro`.
- [ ] 9.4c `knowledge-base/05_reglas_de_negocio.md` (o donde viva RN-GL-03) — anotar que la
      restricción de carga física del conductor pasa a ser **texto libre en Observaciones** y por lo
      tanto **no es verificable automáticamente**: `C-10` la muestra para lectura humana, no la
      aplica como filtro. Decisión de la usuaria del 2026-07-31, no una limitación técnica pendiente.
- [ ] 9.5 `CHANGES.md` §Plan de integración — fila 3 (Conductores + Vehículos) a su nuevo estado.
- [ ] 9.6 `knowledge-base/10_preguntas_abiertas.md` — **cerrar** las tres preguntas que el checkpoint
      0.1 resolvió (catálogo de restricciones → sin objeto, no hay catálogo; colisión de asignación
      semanal → se bloquea siempre, sin override, con un constraint; cómo se rastrea el vencimiento de VTV/RTO → vía
      `mantenimiento`, con la regla de derivación de D3), anotando la fecha y la resolución en vez de
      borrarlas. Dejar abiertas las que siguen siendo del cliente: **campos obligatorios del alta de
      conductor** (#3 de C-09), **checklist de documentos** (#4), y `conductores.vehiculo.año`.
- [ ] 9.7 `ROADMAP-FRONTEND.md` §FE-8 — filas `C-08` y `C-09`.

## 10. Verificación

- [ ] 10.1 `cd frontend && npx vitest run` — suite completa en verde, cero regresiones contra el
      baseline de 0.4.
- [ ] 10.2 `cd frontend && npx tsc -b --noEmit` (**nunca `tsc --noEmit` a secas**) y `oxlint`
      limpios.
- [ ] 10.3 Cobertura ≥ 85 % en `shared/lib/vehiculos/` y `shared/lib/conductores/`.
- [ ] 10.4 **Verificación manual en navegador** (`npm run dev`) con las mismas cuentas de 1B.12:
      alta y edición de vehículo con accesorios, mantenimientos y gastos; alta y edición de conductor
      con asignación semanal; las cuatro combinaciones de permisos parciales mostrando la degradación
      señalizada y **ningún dato inventado**; y confirmar que dar de alta un conductor **no** crea
      ninguna cuenta de acceso (RN-GL-03). Sumar los dos casos que salen del checkpoint 0.1:
      - **D3-B**: cargar una intervención preventiva VTV con próximo vencimiento y confirmar que la
        habilitación aparece en la ficha y en la alerta del dashboard **sin ningún alta aparte**;
        cargar una segunda VTV más reciente y confirmar que gana esa.
      - **Colisión**: intentar asignar dos vehículos distintos al mismo conductor en la misma semana
        y confirmar que **la UI lo bloquea con el mensaje de la función pura**, sin ningún control
        para habilitarlo; y confirmar que la barrera de la base también actúa (misma escritura
        directa contra PostgREST → `23505` de `uq_conductor_semana`, mensaje «otro vehículo»).
- [ ] 10.5 Rastro completo en `auditoria.logs` de cada operación (RN-GL-02).
- [ ] 10.6 Prueba de **rollback**: revertir `VehiculosRoute.tsx` y `ConductoresRoute.tsx` a los mocks,
      confirmar que la app anda, y reaplicar.
- [ ] 10.7 Reconfirmar
      `select proname, prosecdef from pg_proc where pronamespace = 'conductores'::regnamespace;`
      → `false` en las 4 funciones.
- [ ] 10.8 Registrar en `openspec/changes/integracion-conductores-vehiculos/tasks.md` (este archivo)
      qué quedó pendiente de revisión de Enzo/backend antes de poder archivar, con el mismo formato
      del bullet ⏳ de `CHANGES.md` §C-05.
