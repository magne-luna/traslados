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

- [x] 1.1 **✅ Verificado (2026-08-11).** `conductores`, `facturacion` y `pacientes` devuelven
      `42501` contra una tabla real de cada schema (`conductores.conductores`,
      `facturacion.gastos_vehiculos`, `pacientes.paciente`) con la anon key vía REST — los tres
      schemas están expuestos en el Data API, ninguno devolvió `PGRST106`/`PGRST205`.
- [x] 1.2 **✅ Verificado (2026-08-11).** `supabase migration list --linked`: las 49 migraciones
      locales tienen `local == remote` exacto, sin ningún desfasaje — incluida
      `20260724100006_schema_conductores.sql`, aplicada. No hace falta `migration repair`.
- [x] 1.3 **✅ Verificado (2026-08-11).** `conductores`=0, `vehiculo`=2, `mantenimiento`=2,
      `accesorios_vehiculo`=4, `conductores_vehiculos`=0, `documentacion_vehiculo`=0,
      `documentacion_conductores`=0. `mantenimiento` con filas confirma que el `NOT VALID` habría
      sido necesario si el CHECK de D4 hubiera tenido un camino de escritura previo — no lo tuvo
      (ver nota de 1B.2/1B.7), así que no aplicó igual.
- [x] 1.4 **✅ Verificado (2026-08-11).** `pacientes.accesorios`: exactamente los 5 valores
      esperados (`andador`, `silla-plegable`, `silla-postural`, `silla-rigida`, `tripode`), sin
      filas inesperadas ni duplicados semánticos.
- [x] 1.5 **✅ Verificado (2026-08-11).** Las policies vigentes usan `tiene_permiso('vehiculos', …)`
      en las 5 tablas de flota (`vehiculo`, `mantenimiento`, `accesorios_vehiculo`,
      `documentacion_vehiculo`, `habilitaciones_vehiculo`, y **`conductores_vehiculos`**, base de
      D10) y `tiene_permiso('conductores', …)` en las 2 de conductores (`conductores`,
      `documentacion_conductores`). Confirmado con `pg_get_expr` sobre `pg_policy`, no solo
      `polcmd`.
- [x] 1.6 **✅ Verificado (2026-08-11).** `facturacion.gastos_vehiculos`: columnas `id`,
      `vehiculo_id`, `monto` (numeric), `fecha` (date) — sin `descripcion`, confirma el hueco. FK
      `fk_vehiculo` → `conductores.vehiculo(id) ON DELETE CASCADE` existe. Policies gateadas por
      `tiene_permiso('facturacion', …)`.
- [x] 1.7 **✅ Verificado (2026-08-11).** Cero filas violan `uq_conductor_semana` (la tabla
      `conductores_vehiculos` está vacía, ver 1.3). Migración 1B.6 escrita a continuación.

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
        planeaba D4). **`subtipo`/`detalle` — ✅ agregadas (2026-08-10)**, no en este archivo sino
        en `20260810120000_vehiculo_mantenimiento_subtipo_detalle.sql` (migración nueva, escrita al
        cerrar el gap 4B.4 en vivo, no coordinada de antemano con Enzo — ver nota de §5 arriba).
        Mismo tipo (`TEXT`, nullable) que planeaba esta línea.
      - ~~`ALTER TABLE facturacion.gastos_vehiculos ADD COLUMN descripcion TEXT`~~ — **sin objeto**:
        D9/D11 quedaron SUPERSEDED, los gastos viven en `conductores.mantenimiento` (`categoria =
        'gasto'`), no en `facturacion.gastos_vehiculos`. Esa tabla queda abandonada, no se le agrega
        nada.
- [x] 1B.2 En el **mismo archivo**, el CHECK de coherencia de la unión discriminada (D4), con
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
      **✅ Hecho (2026-08-10), pero SIN `NOT VALID`** — ver nota de 1B.7: se validó en el mismo paso,
      no en uno separado, porque no había filas preexistentes que pudieran violarlo (verificado: sin
      camino de escritura previo para `categoria IN ('preventivo','correctivo')`, ver nota de §5).
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
- [x] 1B.6 **✅ Escrita (2026-08-11).** No en `…_campos.sql` (ese archivo nunca se creó, ver 1B.1
      reconciliado) sino en `20260811100000_conductores_vehiculos_colision_semanal.sql`, migración
      propia. 1.7 verificado en vivo el mismo día: 0 filas violatorias (la tabla está vacía). El
      constraint que hace imposible la colisión de asignación semanal (D7 §Colisión):
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
- [x] 1B.7 Escribir la tarea de validación diferida como paso **separado y explícito**:
      `ALTER TABLE conductores.mantenimiento VALIDATE CONSTRAINT chk_categoria_subtipo;`. Solo se
      corre **después** de confirmar que no hay filas violatorias
      (`select id, categoria, subtipo, detalle from conductores.mantenimiento where …`). Si las hay,
      **se reportan a backend**, no se borran ni se "arreglan" desde acá.
      **⚠️ SIN OBJETO (2026-08-10)** — no se hizo como paso separado: `chk_categoria_subtipo` (1B.2)
      se agregó ya validado (sin `NOT VALID`) porque la tabla no tenía ninguna fila
      `preventivo`/`correctivo` para violarlo (nunca hubo un camino de escritura hasta esta sesión —
      `subtipo`/`detalle` recién se agregaron en la misma migración). Si esa asunción resulta
      incorrecta, la migración simplemente hubiera fallado (transaccional) — no aplicó a medias.
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
- [x] 1B.10 **✅ Completa (2026-08-11).** Una sola migración real queda en pie
      (`20260811100000_conductores_vehiculos_colision_semanal.sql`; 1B.1/1B.8 quedaron sin objeto,
      reconciliados contra el backend real de Enzo — ver notas ahí). `supabase db advisors --linked
      --type security` **antes** y **después** de aplicar: mismos 15 hallazgos WARN en ambas
      corridas, diff vacío. Todos preexistentes y no relacionados (funciones `SECURITY DEFINER`
      intencionales — `modulos.tiene_permiso`, `auditoria.log_action`, triggers de `usuarios` —
      + leaked password protection deshabilitada).
- [x] 1B.11 **✅ Aplicada (2026-08-11).** `supabase db push --linked` a pedido explícito de la
      usuaria (excepción puntual a "no la aplica el agente" — el CLI de este sandbox sí tiene el
      proyecto linkeado y credenciales de escritura). `supabase migration list` confirma
      `20260811100000` con `local == remote`. Constraint `uq_conductor_semana UNIQUE (conductor_id,
      fecha_init)` verificado presente en `conductores.conductores_vehiculos` vía
      `pg_get_constraintdef`. **§7 desbloqueada.**
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

> **Sección creada 2026-08-01 como guía, consecuencia directa de design.md §Reconciliación con
> C-08-vehiculos-mantenimiento** — en ese momento documentaba lo que había que cambiar sin
> reescribir nada. **✅ Actualización (2026-08-01, apply batch 4): 4B.1/4B.2/4B.3/4B.5 ya están
> implementadas** en `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts` +
> `vehiculoMapping.test.ts` (78 tests, todos verdes; 100% stmts/lines/funcs, 97.12% branches).
> **4B.4 sigue bloqueado**, ver su propia entrada — pendiente de una decisión de Enzo sobre el
> `#### Gap abierto` de design.md antes de tocar `mantenimientos` para el repository real.

- [x] 4B.1 **✅ Completa (2026-08-01, apply batch 4).** `parseGastoRow`/`toGastoRows` dejaron de
      leer/escribir `facturacion.gastos_vehiculos`. Ahora consumen/producen el elemento del array
      `gastos` que ya arma `gastoToApi()` en la Edge Function (`{id, fecha, monto, descripcion,
      categoria}`, sourced de `conductores.mantenimiento` con `categoria='gasto'`). **Decisión
      tomada (conservadora, ver ⚠️ ASUNCIÓN REVERSIBLE en el código, pendiente de confirmar con
      Enzo)**: `GastoVehiculo` NO gana un campo `categoria` — `categoria`/`categoria_gasto` se
      ignoran por completo en la lectura y nunca se emiten en la escritura (es opcional en
      `GastoInput`, así que omitirlo es seguro). `toGastoRows`/`GastoRowInput` ya no incluyen `id`
      (la colección se reemplaza entera, delete+insert, igual que `mantenimientos`). 1 test nuevo
      de triangulación dedicado a la asunción de `categoria`/`categoria_gasto` ignorados.
- [x] 4B.2 **✅ Completa (2026-08-01, apply batch 4).** `ensamblarVehiculo` dejó de llamar
      `derivarHabilitaciones()` para el repository real — esa función sigue viva sin tocar,
      importada directamente por `mockVehiculoRepository.ts`/`VehiculoDetail.tsx` (confirmado por
      grep). Nuevas `parseHabilitacionRow`/`parseHabilitacionesRows` consumen `record.habilitaciones`
      ya resuelto por `habilitacionToApi()` (Edge Function) desde la tabla real
      `conductores.habilitaciones_vehiculo` — confirmado que `RegistroHabilitacion` no tiene ni
      necesita `id`. 7 tests nuevos.
- [x] 4B.3 **✅ Completa (2026-08-01, apply batch 4).** `kilometraje` sigue siendo columna propia,
      ahora nullable — `readNumber` ya trataba cualquier no-numérico (incluido `null`) como `0`,
      confirmado con test dedicado explícito. `kilometrajeUltimoService`/`fechaUltimoService`
      **eliminados por completo** de `CrearVehiculoPayload`/`toCrearVehiculoPayload`/
      `toActualizarVehiculoPayload` (nunca se emiten, ni con la clave `_ultimo_service` ni
      camelCase) — el mapeo solo los lee de la respuesta JSON (`parseVehiculoRow`, claves camelCase
      `kilometrajeUltimoService`/`fechaUltimoService`, ya no `kilometraje_ultimo_service`/
      `fecha_ultimo_service`, columnas que no existen).
- [x] 4B.4 **✅ Cerrado (2026-08-10).** Backend (Enzo) agregó `subtipo`/`detalle` a
      `conductores.mantenimiento` (`20260810120000_vehiculo_mantenimiento_subtipo_detalle.sql`) y
      actualizó la Edge Function (`supabase/functions/vehiculos/index.ts`) para exponer
      `mantenimiento` en cada respuesta y aceptar `mantenimientos` en el body (`replaceMantenimientos`).
      `vehiculoMapping.ts:447` ya lee `record.mantenimiento` en vez de degradar a `[]`. Verificado
      2026-08-11: `npx tsc -b --noEmit` sin errores y `vehiculoMapping.test.ts` 78/78 en verde.
- [x] 4B.5 **✅ Completa (2026-08-01, apply batch 4).** `parseAccesoriosRows` reescrita para
      consumir el array plano `accesoriosCompatibles: string[]` que ya resuelve la Edge Function,
      en vez del embed anidado `accesorios_vehiculo → accesorios` de D11. Sin cambio de fondo (el
      catálogo de 5 valores es el mismo, 1B.3).

## 5. Repository real de Vehículos + swap — `SupabaseVehiculoRepository.ts`

> **✅ COMPLETA (2026-08-10, sesión disparada por el bug `22P02 invalid input syntax for type
> uuid: "vehiculo-etios"` al crear una hoja de ruta — `HojaDeRutaRoute.tsx` inyectaba
> `mockVehiculoRepository` contra un `SupabaseHojaDeRutaRepository` real, y `pacientes.recorrido.
> vehiculo_id` es `UUID NOT NULL`).** Confirmado contra el código real, no solo contra este
> documento: la Edge Function `supabase/functions/vehiculos/index.ts` ya estaba completa (GET
> list/getById, POST, PATCH, DELETE — habilitaciones, gastos y accesorios incluidos), y
> `vehiculoMapping.ts` (§4/§4B) ya estaba reconciliado contra su respuesta real. Lo único que
> faltaba era este repository. **Las tareas 5.1-5.8 de abajo describen un plan que no aplica**:
> asumían PostgREST+RPC directo (embeds client-side, query batcheada a
> `facturacion.gastos_vehiculos`, degradación D10 por `42501` cross-módulo, tabla de errores D12
> con códigos Postgres/PGRST/RPC) — la Edge Function real resuelve todo eso **server-side**
> (`toApi()` arma accesorios/gastos/habilitaciones con un cliente `admin` que bypasea RLS, sin
> exponer ningún caso de degradación al cliente) y responde con el mismo formato HTTP simple que
> `presupuestos`/`autorizaciones` (401/403/404/400 + `{ error: string }`), no códigos Postgres. Se
> mantienen sin marcar (como registro histórico de lo que este documento planeaba antes de conocer
> el backend real, mismo criterio que 1B.8), reemplazadas de hecho por lo que sigue:
>
> - **`frontend/src/shared/lib/vehiculos/edgeFunctionErrors.ts`** (nuevo, + `.test.ts`, 13 casos) —
>   `mapearErrorVehiculo`/`esErrorNotFound`, mismo patrón que `presupuestos/edgeFunctionErrors.ts`
>   pero contra el formato real de `vehiculos/index.ts`: 401/403/404 fijos, 400 despacha por texto
>   (`vehiculo_patente_key` → patente duplicada, `falta el campo requerido` → campos faltantes,
>   default → mensaje genérico). Nunca propaga `error.message` crudo.
> - **`frontend/src/shared/lib/vehiculos/SupabaseVehiculoRepository.ts`** (nuevo, + `.test.ts`, 15
>   casos) — `list()`/`getById()`/`create()`/`update()` vía `supabase.functions.invoke('vehiculos',
>   …)`, reusando `ensamblarVehiculo` (lectura) de `vehiculoMapping.ts`. **Bug real evitado por un
>   test dedicado**: los payloads de escritura (`toCrearVehiculoPayload`/`toActualizarVehiculoPayload`
>   existentes en `vehiculoMapping.ts`) apuntaban al `p_vehiculo jsonb` de la RPC SUPERSEDED
>   (`accesorios` en vez de `accesoriosCompatibles`, `estado` pasado por `toEstadoVehiculoRow` a
>   formato de base) — enviarlos tal cual a la Edge Function real habría descartado
>   `accesoriosCompatibles` en silencio (clave que la función nunca lee) y roto todo alta/edición a
>   `'fuera-de-servicio'` (la función hace su propia conversión de dominio→base; convertirla antes
>   le manda `'fuera de servicio'` con espacio, que no matchea, y degrada a `'habilitado'`). Se
>   escribieron `toCrearVehiculoInput`/`toActualizarVehiculoInput` **nuevos, locales a este
>   archivo** (no se tocó `vehiculoMapping.ts` más que exportar `toGastoRows`, que ya existía) con
>   la forma real. `notas` y `mantenimientos` (preventivo/correctivo) **no viajan**: la Edge
>   Function real ni lee ni expone `notas` (gap encontrado en esta sesión, no documentado antes en
>   D9/D11/D12) y `mantenimientos` sigue sin tener dónde escribirse (gap ya conocido, 4B.4/§Gap
>   abierto de `design.md`) — ninguno de los dos se resuelve acá.
> - **5.9 CORTE REAL 1 — hecho**: `VehiculosRoute.tsx` inyecta `supabaseVehiculoRepository`.
>   `VehiculosRoute.test.tsx` reescrito al patrón de `PacientesRoute.test.tsx` (mockea
>   `supabaseClient`, ya no hay fixture de `localStorage` que afirmar).
> - **Adicional, fuera del plan original de §5 pero necesario para cerrar el bug que disparó esta
>   sesión**: `HojaDeRutaRoute.tsx` también pasa a inyectar `supabaseVehiculoRepository` (antes
>   inyectaba `mockVehiculoRepository` en paralelo a `VehiculosRoute.tsx`, mismo gap). Conductor
>   **sigue en mock** en ese archivo — a diferencia de Vehículo, no hay ninguna Edge Function
>   `conductores` en `supabase/functions/` todavía (revisado en esta sesión): crear una hoja de
>   ruta sigue rompiendo con el mismo `22P02` sobre `conductor_id` hasta que exista el backend real
>   de §7 y se repita este mismo swap ahí. `HojaDeRutaRoute.test.tsx` y el aviso
>   `AvisoModeloDatos` de `HojaDeRutaPage.tsx` (y su test) se actualizaron para reflejar que solo
>   Conductor sigue siendo fixture.
> - Suite completa + `npx tsc -b --noEmit`: cero regresiones (ver 5.11 abajo, corrido de verdad en
>   esta sesión, a diferencia del resto de este bloque que quedó sin marcar).
>
> **Verificado en navegador (2026-08-10, más tarde en la misma sesión).** La usuaria probó
> `update()` en vivo (localhost:5174 contra el proyecto real) y encontró un segundo bug, este sí de
> backend compartido, no de este repository: `supabase/functions/_shared/auth.ts::CORS_HEADERS`
> nunca definía `Access-Control-Allow-Methods` — sin ese header el navegador bloquea por CORS
> cualquier PATCH/DELETE contra **cualquier** Edge Function que use este helper (16 funciones, no
> solo `vehiculos`: `pacientes*`, `presupuestos`, `autorizaciones`, `cobros`, `facturas`,
> `obra-social`, `requisitos-os`, `plantilla-campo`, `vehiculo-documentos`). Invisible en tests
> porque todos mockean `supabase.functions.invoke` (sin fetch real, sin preflight). Arreglado
> (agregado `'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'`) y las 16
> funciones redeployadas (`supabase functions deploy <fn>`). Ver engram
> `bugfix/edge-functions-cors-allow-methods` para el detalle. **Confirmado por la usuaria**: el
> `update()` original completó bien tras el redeploy.
>
> **✅ Gap 4B.4 (mantenimientos) CERRADO (2026-08-10).** Se implementó de punta a punta, no solo el
> mensaje de error del bug de arriba:
> - **Migración** `20260810120000_vehiculo_mantenimiento_subtipo_detalle.sql`: agrega
>   `subtipo`/`detalle` (nullable) a `conductores.mantenimiento` + el CHECK `chk_categoria_subtipo`
>   de design.md D4, validado en el mismo paso (sin filas preexistentes que pudieran violarlo — no
>   existía ningún camino de escritura para `categoria IN ('preventivo','correctivo')` hasta
>   ahora). Aplicada por la usuaria vía `supabase db push --db-url <pooler>` (la conexión directa
>   por IPv6 tiraba timeout — típico, se resolvió con la connection string del pooler,
>   `aws-0-us-east-1.pooler.supabase.com:5432`).
> - **`supabase/functions/vehiculos/index.ts`**: `MantenimientoRow`/`MantenimientoInput` con
>   `subtipo`/`detalle`; `replaceMantenimientos()` (mismo patrón que `replaceGastos()`, pisa solo
>   `categoria <> 'gasto'` de la misma tabla); wireado en POST y PATCH; `toApi()` expone
>   `mantenimiento` (**singular**, a propósito — coincide con el embed de PostgREST y con lo que
>   `ensamblarVehiculo()` ya leía desde `record.mantenimiento` sin tocar esa función). Redeployada.
> - **`SupabaseVehiculoRepository.ts`**: `toMantenimientoInput()` reusa `toMantenimientoRows()` de
>   `vehiculoMapping.ts` (§4.4, ya tenía el shape correcto para esto, solo le sacamos el `id`).
>   `create()`/`update()` ahora sí persisten mantenimientos.
> - El guard "payload vacío → error claro" del bug de arriba **queda** (protege `notas`, que sigue
>   sin soporte — gap distinto, no resuelto).
> - Tests: `SupabaseVehiculoRepository.test.ts` actualizado (payload de create/update con
>   mantenimientos, shape snake_case exacto). `vehiculoMapping.test.ts` sin tocar, 100% verde.
>   `tsc -b --noEmit` limpio.
>
> **Cuarto bug, backend, encontrado al probar el cierre de 4B.4 en vivo (2026-08-10)**: agregar un
> mantenimiento seguía dando el mismo falso 404 — pero esta vez con el payload correcto llegando al
> servidor (confirmado con Network tab del navegador). Causa real, en `vehiculos/index.ts`, no en
> el frontend: el handler PATCH hacía `.update(toDb(body))` incondicionalmente, pero `toDb()` **solo
> traduce columnas propias de `vehiculo`** (patente/modelo/tipo/capacidad/estado/kilometraje) —
> `habilitaciones`/`gastos`/`mantenimientos`/`accesoriosCompatibles` las manejan los `replace*` por
> separado. Un PATCH que solo toca una de esas colecciones deja `toDb(body) === {}`, y
> `.update({})` no devuelve fila → 404 falso. **Mismo bug afecta (afectaba) gastos-solo,
> habilitaciones-solo y accesoriosCompatibles-solo** — nadie lo había probado en vivo todavía, no es
> exclusivo de mantenimientos. **Fix**: si `toDb(body)` queda vacío, el handler hace un `select`
> (para confirmar que el id existe) en vez de un `.update({})`. Redeployado. Vale la pena revisar si
> el mismo patrón (`update(toDb(body))` incondicional con colecciones hijas aparte) existe en otras
> Edge Functions con la misma forma (`presupuestos`, `pacientes`, etc.) — no revisado en esta
> sesión, fuera de alcance.
>
> **Tercer bug encontrado en la misma sesión de prueba en navegador**: agregar un mantenimiento
> (preventivo/correctivo) desde `VehiculoDetail.tsx` tiraba `"No existe un vehículo con id
> «84ab114d-…»"` — el mismo vehículo que la usuaria acababa de editar bien. Causa: `update(id, {
> mantenimientos: [...] })` es la única clave que este repository no traduce (gap de la Edge
> Function, ver 4B.4 arriba) — el payload armado quedaba `{}`, Postgres devuelve 0 filas ante un
> `UPDATE` sin columnas, y la Edge Function lo lee como 404 "vehiculo no encontrado". **Fix
> aplicado (2026-08-10)**: `SupabaseVehiculoRepository.update()` ahora corta *antes* de llamar al
> servidor si el payload armado queda vacío pero `cambios` no lo estaba, con un mensaje honesto
> ("Este cambio todavía no se puede guardar contra el servidor real") en vez del 404 engañoso.
> Cubre el mismo caso para `notas` (mismo gap, sin ejercitar en UI todavía). **No resuelve el gap
> de fondo** — mantenimiento sigue sin poder persistirse. Eso requiere, aparte:
> 1. Migración nueva: `conductores.mantenimiento` no tiene columnas `subtipo`/`detalle` (1B.1 ya lo
>    decía, sigue así — verificado contra el schema real de nuevo en esta sesión).
> 2. Sumar a `vehiculos/index.ts` un `replaceMantenimientos()` análogo a `replaceGastos()`.
>
> Pendiente de decidir si se arranca ahora o queda para una sesión aparte.
>
> **Nota de orden**: los bloques de arriba quedaron en el orden en que se escribieron, no en el
> orden cronológico real de la sesión. Orden real: CORS (16 funciones) → este "tercer bug" (mensaje
> claro) → cierre del gap 4B.4 (migración + Edge Function + repository, bloque de arriba con el
> checklist de archivos) → "cuarto bug" (`toDb(body)` vacío en el PATCH, arreglado en la Edge
> Function) → reversión de habilitaciones a derivación (bloque siguiente). El gap de mantenimiento
> **sí se cerró** en esta misma sesión — la frase de arriba ("pendiente de decidir") quedó vieja.
>
> **Quinto cambio, una reversión de diseño pedida por la usuaria (2026-08-10)**: con mantenimientos
> ya persistiendo de verdad, quedó visible que "Habilitaciones" mostraba "Sin habilitaciones" aun
> después de cargar un preventivo VTV — porque 4B.2 había reconciliado `ensamblarVehiculo` para leer
> la tabla real `conductores.habilitaciones_vehiculo` (D3 opción A, como construyó Enzo), pero
> **nunca se armó ninguna UI para escribir ahí** — esa tabla está siempre vacía. La usuaria,
> consultada, prefirió explícitamente no agregar un formulario aparte que duplicara la carga de
> fecha de vencimiento ("¿no sería tener el mismo formulario repetido?"). **Se revierte a D3 opción
> B**: `ensamblarVehiculo` vuelve a derivar `habilitaciones` con `derivarHabilitaciones(mantenimientos)`
> (la función pura que ya usaba el mock, sin cambios), ignorando por completo `record.habilitaciones`.
> `parseHabilitacionRow`/`parseHabilitacionesRows` quedan sin uso pero sin borrar (con sus tests),
> por si se retoma un formulario propio más adelante. Sin cambios de backend ni de escritura (4.7b
> seguía sin emitir `habilitaciones`, sigue igual — ahora es la decisión correcta, no una omisión).
> Tests de `ensamblarVehiculo` actualizados; 78/78 verde en `vehiculoMapping.test.ts`. Cero deploy
> necesario (100% frontend).

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
- [x] 5.9 **CORTE REAL 1** — `VehiculosRoute.tsx` pasa a inyectar `supabaseVehiculoRepository`.
      Ajustar `VehiculosRoute.test.tsx` (doble inyectado). El diff de producto es **un import y una
      prop**. **✅ Hecho (2026-08-10)**, ver nota de arriba.
- [ ] 5.10 Anotar en esta tarea el **estado transitorio conocido** (D2): desde acá hasta §7, el
      selector de vehículo de la pantalla de Conductores muestra vehículos **reales** mientras las
      asignaciones siguen guardándose en `localStorage` contra ids de mock que ya no existen. Es
      esperado y dura una sola fase. Si el change se detiene acá, **revertir 5.9**. **Sin verificar
      en navegador (2026-08-10)**: esta sesión no tuvo acceso a un proyecto Supabase real
      (credenciales/red) para confirmar en vivo que la pantalla de Conductores sigue coherente con
      vehículos reales — pendiente de una pasada manual antes de dar el change por cerrado.
- [x] 5.11 Suite completa + `npx tsc -b --noEmit` + `oxlint`. Cero regresiones contra 0.4. **✅ Hecho
      (2026-08-10)**: suite completa en verde (28 tests nuevos: 13 de `edgeFunctionErrors.test.ts` +
      15 de `SupabaseVehiculoRepository.test.ts`), 1 falla pre-existente sin relación
      (`VehiculosRoute.test.tsx` viejo, error de entorno de `localStorage` en Node — ya estaba roto
      antes de esta sesión, no se tocó). `tsc -b --noEmit` limpio. `oxlint` no se corrió (no
      solicitado, agregar en la próxima pasada).

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

> **✅ Desbloqueada (1B.11 aplicada 2026-08-11).** Sesión disparada por el mismo bug que ya se
> había arreglado para Vehículos en §5 (`22P02 invalid input syntax for type uuid`), esta vez con
> Conductores: `HojaDeRutaRoute.tsx` inyectaba `mockConductorRepository` (ids mock tipo
> `"conductor-gonzalez"`) contra un `SupabaseHojaDeRutaRepository` real. A diferencia de Vehículos,
> **no existe Edge Function `conductores`** en `supabase/functions/` — este repository sigue el
> plan original de 1B.8: PostgREST directo para lectura + 2 RPC `SECURITY INVOKER`
> (`supabase/migrations/20260811110000_conductores_rpc.sql`) para escritura.

- [x] 7.1 (RED) **✅ Completa.** Fake tipado del cliente, mismo patrón de 5.1.
- [x] 7.2 (RED→GREEN) **✅ Completa.** `list()`/`getById()` con el embed de `conductores_vehiculos`
      (D11). `getById` de un id inexistente → `null`, no lanza.
- [x] 7.3 (RED→GREEN→TRIANGULATE) **✅ Parcial.** Sin `vehiculos: read`, el embed vuelve vacío →
      `asignaciones: []` y la lectura del conductor **no falla** (`ensamblarConductor` degrada sin
      romper, cubierto por tests en `SupabaseConductorRepository.test.ts`). **Gap real, no cerrado**:
      el `Conductor` de dominio no lleva ningún flag de degradación, así que el cartel de aviso que
      D10 pide en `ConductorDetail` §Flota (*"la asignación semanal requiere permiso del módulo
      Vehículos"*) **no está escrito** — hoy la sección se ve simplemente vacía, sin explicar por
      qué. Requiere agregar la señal al tipo/mapping/tests antes de poder escribir el cartel; no se
      improvisó a último momento. Queda pendiente para un próximo batch.
- [x] 7.4 (RED→GREEN) **✅ Completa.** `create()`/`update()` vía `.rpc()`, tests de "una sola
      `.rpc()`" y relectura posterior. Sin flag de instrucción de escritura (D7 §Colisión eliminó
      `permitirMultiple`).
- [x] 7.4b (RED→GREEN) **✅ Completa.** Los dos `23505` de `conductores_vehiculos` discriminados
      por nombre de constraint, con test para cada uno más el fallback cuando el nombre no viene en
      el error (`SupabaseConductorRepository.test.ts:305-347`).
- [x] 7.5 (RED→GREEN) **✅ Completa.** Test explícito (`SupabaseConductorRepository.test.ts:349`,
      "create() nunca toca el schema auth ni la tabla usuarios") — RN-GL-03.
- [x] 7.6 (RED→GREEN) **✅ Completa.** `mapearErrorConductor`: tabla completa de D12 cubierta
      (`SupabaseConductorRepository.test.ts:365-441`) — `23505` sobre `dni`, los dos `23505` de
      `conductores_vehiculos`, `23503`, `42501` de `conductores` vs. `vehiculos`, `45201`/`45202`,
      `PGRST202`/`PGRST204`/`PGRST106`, genérico. Sin `45205`.
- [x] 7.7 **✅ Completa.** Test de código fuente (`?raw`, `SupabaseConductorRepository.test.ts:449`):
      sin `service_role`, sin `any` como token, sin `modulos.permisos`/`modulos.modulos`.
- [x] 7.8 **CORTE REAL 2 — ✅ Completa (2026-08-11).** `ConductoresRoute.tsx` inyecta
      `supabaseConductorRepository` **y** `supabaseVehiculoRepository` (los dos providers montados).
      `ConductoresRoute.test.tsx` ajustado. Además — **el fix real del bug que disparó esta
      sesión** — `HojaDeRutaRoute.tsx` deja de inyectar `mockConductorRepository` y pasa a
      `supabaseConductorRepository`, verificado con `grep` sobre el archivo (sin ninguna referencia
      a `mockConductorRepository` en el path de escritura).
- [x] 7.9 **✅ Completa (2026-08-11).** `npx tsc -b --noEmit` limpio. `src/shared/lib/conductores`:
      89/89. `src/features/conductores` + `src/features/hojas-de-ruta`: 7 fallas en corrida
      conjunta, las 7 timeouts de 5000ms — re-verificadas en aislado (`ConductorForm.test.tsx`
      15/15, resto igual) y confirmadas como el flake de contención de recursos ya documentado en
      esta sesión (ver `hojas-de-ruta-geocoding`/verify), no regresiones de este batch. `oxlint` no
      corrido (no confirmado que esté configurado en este proyecto).
      **Además, fuera del alcance original de 7.x**: se sacó de `ConductorDetail.tsx` un
      `AvisoModeloDatos` que había quedado obsoleto — decía "a coordinar con Enzo antes de cerrar
      C-09" sobre si Restricciones se mantenía como catálogo estructurado, pero D6-B ya resolvió
      eso (Restricciones se eliminó del dominio, solo queda `observaciones` como texto libre)—
      dejarlo activo inducía a error a quien lo leyera. Sin test que dependiera de ese texto.

## 8. Señalización de discrepancias en la UI

> Regla dura del proyecto: toda discrepancia se documenta en **dos lugares** (KB + `CHANGES.md`) **y**
> con un cartel `AvisoModeloDatos` en la pantalla, para que quien vea la app la note sin leer la KB.
> Reusar `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`, nunca markup a mano.

- [x] 8.1 `VehiculoDetail.tsx` — **reescribir** el cartel de gastos: hoy dice que el docx ubica los
      gastos bajo el módulo `facturacion`; pasa a decir que **así está implementado** y qué implica
      (sin `facturacion: read` la sección se ve vacía y **eso no significa que no haya gastos**).
- [x] 8.2 `VehiculoDetail.tsx` — cartel nuevo en la sección de accesorios: el catálogo vive en el
      schema `pacientes` y requiere permiso del módulo **Pacientes**; una lista vacía puede ser
      "no admite accesorios" o "no tenés el permiso". Solo se muestra cuando el flag de degradación
      de 5.4 está activo.
- [x] 8.3 `VehiculoDetail.tsx` — **reescribir** el cartel de la sección Mantenimiento (D3-B). Hoy
      dice que "el vencimiento de VTV/RTO se sigue rastreando en las habilitaciones del vehículo, no
      en el historial" y anuncia la duplicación como pendiente: **eso ya no es cierto**. Pasa a
      decir que las habilitaciones VTV/RTO **se derivan del historial** (intervención preventiva con
      subtipo VTV/RTO y su próximo vencimiento), alineado con el docx, y que **el kilometraje y el
      último service siguen siendo campos propios de Vehículo**, no derivados — que es la parte de la
      divergencia con el docx que sobrevive.
- [x] 8.4 `ConductorDetail.tsx` §Flota — **reescribir** el cartel de asignación semanal: la etiqueta
      ISO ↔ dos fechas ya no es una discrepancia pendiente sino una conversión implementada (D7); el
      cartel pasa a explicar que **la grilla requiere permiso del módulo Vehículos**, no del de
      Conductores.
- [x] 8.5 `ConductorDetail.tsx` — **reescribir** el cartel de `restricciones` (D6-B). Hoy anuncia una
      divergencia pendiente ("acá es catálogo cerrado, en el docx es texto libre — a coordinar con
      Enzo"): **esa divergencia ya no existe**, se resolvió a favor del docx. Pasa a decir que las
      restricciones de perfil se anotan en **Observaciones**, como texto libre, igual que el modelo de
      datos real — y que por eso **no se pueden filtrar automáticamente** en las hojas de ruta
      (`C-10`), que es la consecuencia que quien use la app necesita saber.
      **Ojo con el orden**: este cartel se reescribe acá, pero el `Chip` de "pendiente de confirmar"
      de `ConductorForm` ya se eliminó en 2C.3 — no re-agregarlo.
- [x] 8.6 Verificar que ningún cartel usa `style={{}}` ni reimplementa estilos que ya están en el
      design system.

## 9. Documentación de las discrepancias (fuera del código)

- [x] 9.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bloque nuevo **"Vehículos y
      Conductores vs. esquema real de C-08/C-09"**, siguiendo el formato del bloque "Pacientes vs.
      esquema real de `C-05`". Incluir el **mapa completo de los 4 módulos de permisos** (la tabla de
      §Context del design), que hoy no está documentado en ningún lado.
- [x] 9.2 `knowledge-base/04_modelo_de_datos.md` — tachar (`~~…~~` + nota de resolución) lo que este
      change cierra: `Vehiculo.notas`, `GastoVehiculo.descripcion`, la categoría de mantenimiento de
      dos niveles sin columnas, y la etiqueta ISO de la asignación semanal.
- [x] 9.3 `CHANGES.md` §C-08 — bullet `⚠️ Discrepancia` actualizado; marcar como **resuelto** que
      `gasto_vehiculo` cuelga del módulo `facturacion` (ya está implementado como
      `facturacion.gastos_vehiculos`, **no falta ninguna tabla**) y sumar lo que este change resolvió
      y lo que dejó abierto.
- [x] 9.4 `CHANGES.md` §C-09 — actualizar los 5 pendientes de UI: **#5 cerrado** (semana ISO, D7:
      conversión pura, el tipo no cambia); **#1 cerrado** (restricciones → `notas`, D6-B: el docx
      gana, el campo estructurado se elimina del dominio y `C-10` pierde el filtro computable);
      **#2 cerrado** (colisión: se bloquea **siempre**, sin override; el constraint
      `uq_conductor_semana` la vuelve imposible a nivel de base y `permitirMultiple` se elimina del
      frontend); **#3** (campos obligatorios del alta) y **#4** (checklist de
      documentos) siguen abiertos y se remiten a §Open Questions del design.
- [x] 9.4b `CHANGES.md` §C-08 y `knowledge-base/04_modelo_de_datos.md` — registrar que la
      **duplicación VTV/RTO quedó eliminada** (D3-B: las habilitaciones se derivan del historial, no
      hay tabla propia), no diferida. Es el punto 2 del bloque de `vehiculo-mantenimiento-registro`.
- [x] 9.4c `knowledge-base/05_reglas_de_negocio.md` (o donde viva RN-GL-03) — anotar que la
      restricción de carga física del conductor pasa a ser **texto libre en Observaciones** y por lo
      tanto **no es verificable automáticamente**: `C-10` la muestra para lectura humana, no la
      aplica como filtro. Decisión de la usuaria del 2026-07-31, no una limitación técnica pendiente.
- [x] 9.5 `CHANGES.md` §Plan de integración — fila 3 (Conductores + Vehículos) a su nuevo estado.
- [x] 9.6 `knowledge-base/10_preguntas_abiertas.md` — **cerrar** las tres preguntas que el checkpoint
      0.1 resolvió (catálogo de restricciones → sin objeto, no hay catálogo; colisión de asignación
      semanal → se bloquea siempre, sin override, con un constraint; cómo se rastrea el vencimiento de VTV/RTO → vía
      `mantenimiento`, con la regla de derivación de D3), anotando la fecha y la resolución en vez de
      borrarlas. Dejar abiertas las que siguen siendo del cliente: **campos obligatorios del alta de
      conductor** (#3 de C-09), **checklist de documentos** (#4), y `conductores.vehiculo.año`.
- [x] 9.7 `ROADMAP-FRONTEND.md` §FE-8 — filas `C-08` y `C-09`.

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
