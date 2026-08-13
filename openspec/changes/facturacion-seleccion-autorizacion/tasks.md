# Tasks — facturacion-seleccion-autorizacion

> **⛔ GOVERNANCE CRÍTICO — ESTE CHANGE NO ESTÁ APROBADO PARA APPLY.**
> Facturación es el dominio equivalente a *Billing* en la tabla de gobernanza del proyecto:
> **análisis solamente; cero SQL ni código de aplicación sin aprobación humana explícita**. La
> sección **0** es un portón, no una formalidad: **ninguna tarea de la sección 1 en adelante puede
> ejecutarse hasta que la usuaria responda las dos aprobaciones de `design.md` §Governance (D1, D2).**
> Si el apply arranca sin esas respuestas, se detiene y se pregunta.
>
> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true`. Toda tarea que escriba
> código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net y se registra el
> baseline. **No caer en Standard Mode.**
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> (el flag es obligatorio en este sandbox — mismo bug de entorno documentado en
> `integracion-facturacion/tasks.md` 0.8: Node + jsdom + vitest hacen que `localStorage` nativo
> experimental de Node shadowee el de jsdom).
>
> **⚠️ Las migraciones NO las aplica el agente.** Las corre la usuaria / Enzo (backend). Es
> governance, no un límite técnico. Las verificaciones de RLS/persistencia con cuentas reales son
> tareas de coordinación explícitas (§1B), no pasos escondidos dentro de otra tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva/modificada define o preserva su
> RLS en el mismo change; type-check con **`npx tsc -b --noEmit`** (con `-b`, nunca `tsc --noEmit` a
> secas); Conventional Commits; el docx manda en estructura y la KB en reglas de negocio, y toda
> discrepancia se documenta en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden de fases pensado para no dejar el árbol a medias**: la §2 escribe archivos que **nadie
> importa todavía de forma que rompa el flujo actual** (tipos/mapeo aditivos) — la app sigue
> funcionando con el wizard viejo hasta la §3. El swap real del paso 2 ocurre en un único commit en
> la §3, y está bloqueado hasta que las migraciones de §1B estén aplicadas (un cliente nuevo contra
> la RPC vieja escribiría la factura ignorando en silencio `autorizacion_id`, per `design.md` D2
> *Riesgo asumido*).

---

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [x] 0.1 **Aprobación D1** — `ALTER TABLE facturacion.facturas ADD COLUMN autorizacion_id UUID
      REFERENCES facturacion.autorizacion(id)` (nullable, sin `UNIQUE`) + `CREATE INDEX` sobre esa
      columna. Modificación de schema sobre el registro financiero, y apartamiento condicional de la
      regla dura de `database-schema-design` sobre `CONCURRENTLY` (ver 0.3).
      **Respondido 2026-08-13: sí.**
- [x] 0.2 **Aprobación D2** — `CREATE OR REPLACE FUNCTION` sobre las **dos RPC vivas**
      (`facturacion.crear_factura_completa`, `facturacion.actualizar_factura_completa`) para
      leer/escribir `autorizacion_id`. Reemplaza código de servidor que hoy está en producción y
      funciona; una versión mal aplicada rompe el alta y la edición de facturas.
      **Respondido 2026-08-13: sí.**
- [x] 0.3 **Coordinación bloqueante — verificar `count(*)` real de `facturacion.facturas` antes de
      decidir `CONCURRENTLY`.** `design.md` D1 deja esto **condicionado**, no asumido: el change
      `integracion-facturacion` ya se aplicó en esta rama, así que la tabla puede tener filas de
      prueba hoy (no repetir el supuesto de "0 filas" de D10 de `integracion-facturacion`, que ya
      quedó desactualizado una vez en 1.4 de ese change). Si tiene volumen real, el índice de D1 se
      rehace con `CREATE INDEX CONCURRENTLY` fuera de transacción y **se vuelve a consultar a la
      usuaria** antes de escribir el `.sql` de 1B.1.
      **Verificado 2026-08-13 con `supabase db query "select count(*) from facturacion.facturas;"
      --linked` sobre el proyecto vinculado (`pkryfoljypuzfifofdwp`): `count(*) = 0`.** Volumen nulo,
      no hay filas de prueba ni reales. El índice de D1 **puede seguir sin `CONCURRENTLY`**, condición
      sostenida — no hace falta reconsultar a la usuaria.
- [x] 0.4 **Coordinación con backend (Enzo), previa a escribir el `.sql` de D1.** Confirmar que
      `autorizacion_id` no está ya planeada con otro nombre o forma en trabajo concurrente sobre
      `facturacion`/`presupuesto`/`autorizacion` (aprendizaje directo de D12-revertida de
      `integracion-obra-social`, y del desfasaje ya visto en `integracion-facturacion` 1.2/1.3: el
      schema real viene por delante del repo desde hace varios changes).
      **Respondido 2026-08-13 por Enzo: confirmado, no hay columna equivalente planeada.**
- [x] 0.5 **Safety net / baseline.** Correr
      `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run` y registrar el
      número exacto de archivos y tests. **No asumir el baseline de `integracion-facturacion`
      (0.8/5.5/8.1 de ese change)** — puede haber trabajo concurrente adicional sobre el repo desde
      entonces. Registrar también si aparece la misma falla conocida y ajena
      (`ChecklistEditor.test.tsx`) u otra distinta.
      **Corrida 2026-08-13, una sola vez**: `Test Files 11 failed | 242 passed (253)`,
      `Tests 26 failed | 2633 passed (2659)`. `Start at 08:21:57`, `Duration 1070.41s` (transform
      52.99s, setup 287.23s, import 142.94s, tests 860.07s, environment 1582.96s) — ~18 min, muy por
      encima de lo habitual. **Causa observada durante la corrida**: `load average` de la máquina en
      ~7.7 con otra sesión corriendo `vitest`/`turbo dev`/`next-server` de otro proyecto en paralelo
      (confirmado con `ps aux`/`uptime` durante la espera). Las dos fallas visibles en el tail
      capturado (`tail -40`, el resto del log no quedó accesible tras finalizar el proceso) son
      `Test timed out in 5000ms` en `PersonasACargoEditor.test.tsx` y `VehiculoForm.test.tsx` —
      patrón consistente con contención de CPU, no con una regresión de código (ningún archivo de
      `features/facturacion/`/`shared/lib/facturacion/` fue tocado todavía en este change). **No se
      pudo confirmar ni descartar si `ChecklistEditor.test.tsx` está entre los 11 fallidos** por el
      truncamiento del log — no está en el tail visible. **Este baseline (11 archivos/26 tests
      fallidos) no se puede comparar con confianza contra 0.8 de `integracion-facturacion`** por la
      contención de CPU detectada; se recomienda re-correr en una máquina sin carga concurrente antes
      de usarlo como referencia definitiva para 5.1.

---

## 1. Precondiciones del backend (verificar, no modificar)

> Todo lo de esta sección es **solo lectura**. Ninguna tarea acá corre DDL. Mismo criterio ya usado
> en cada change de este proyecto: **el schema real viene por delante del repo, no se asume nada del
> propose sin reverificar.**

- [x] 1.1 Reconfirmar contra el proyecto vinculado (`supabase db query --linked` o equivalente) las
      columnas actuales de `facturacion.facturas`: confirmar que **`autorizacion_id` sigue sin
      existir** (per `design.md` §Context) y que el resto de columnas coincide con lo que
      `facturaMapping.ts`/`SupabaseFacturaRepository.ts` asumen hoy. Reportar cualquier diferencia
      antes de continuar.
      **Verificado 2026-08-13**: 20 columnas en `facturacion.facturas` (`id, paciente_id, descripcion,
      dias, valor_km, monto, estado, fecha_init, fecha_tope, tipo, cantidad_km,
      fecha_estimada_cobro, prestacion, mes_facturado, anio_facturado, dependencia_y_retorno,
      domicilio_id, identificador_origen, identificador_valor, fecha_factura`).
      **`autorizacion_id` NO existe** — confirma `design.md` §Context. El resto coincide byte a byte
      con el `select` de `SupabaseFacturaRepository.ts` L17-20 y con `CrearFacturaPayload` de
      `facturaMapping.ts`. Sin diferencias.
- [x] 1.2 Reconfirmar el schema de `facturacion.autorizacion` (columnas, tipo de `estado`, FK hacia
      `presupuesto`) contra lo que `design.md` D3/D4 asume — en particular que `estado` sigue
      admitiendo el literal `'autorizada'` usado como filtro de "pendiente de facturar".
      Reconfirmar también que `Autorizacion` sigue sin `pacienteId` propio (solo `presupuestoId`),
      condición que sostiene el patrón O(N) de D3.
      **Verificado 2026-08-13**: `facturacion.autorizacion` tiene `id, presupuesto_id (NOT NULL,
      única FK a presupuesto), estado, fecha_respuesta, cupo_mensual_dias, cupo_mensual_km,
      archivo_url, monto_autorizado, vigencia_desde` — **sin `paciente_id`**, confirma que D3 sigue
      necesitando el join vía `presupuesto`. El enum `estado_autorizacion` tiene los literales
      `pendiente, autorizada, judicializada, rechazada` — **`'autorizada'` existe**. Sin diferencias
      contra lo que `design.md` D3/D4 asume.
- [x] 1.3 Reconfirmar que las dos RPC vigentes (`facturacion.crear_factura_completa`,
      `facturacion.actualizar_factura_completa`, `supabase/migrations/20260812160000_factura_rpc.sql`)
      siguen con la firma y el `SECURITY INVOKER` que `design.md` D2 asume, y que ninguna migración
      posterior ya las reemplazó por otra vía.
      **Verificado 2026-08-13** vía `pg_proc`/`pg_get_function_identity_arguments`:
      `crear_factura_completa(p_factura jsonb)` y `actualizar_factura_completa(p_id uuid, p_cambios
      jsonb)`, ambas con `prosecdef = false` (`SECURITY INVOKER`). Firma y seguridad coinciden con lo
      que `design.md` D2 asume. Última migración de facturación aplicada es
      `20260812160000` (la citada en `design.md`) — ninguna posterior la reemplazó.
- [x] 1.4 Revisar el historial de migraciones (`supabase migration list --linked`) por desfasaje
      nuevo desde la última verificación de `integracion-facturacion` (patrón N6, ya confirmado
      recurrente en este dominio). Registrar el estado, **no correr `migration repair`**.
      **Verificado 2026-08-13**: `supabase migration list --linked` — 52 migraciones, todas con
      `local == remote` (sin desfasaje, sin migraciones locales sin aplicar ni aplicadas sin archivo
      local). La más reciente es `20260812160000`. Sin drift respecto del repo. No se corrió
      `migration repair`.

---

## 1B. Migraciones (⛔ bloqueada por 0.1, 0.2, 0.3, 0.4 — las aplica la usuaria/Enzo)

> El agente **escribe** los `.sql`; **la usuaria / Enzo los aplica**. La verificación manual es un
> checklist de coordinación, no un paso automatizado.

- [ ] 1B.1 `supabase/migrations/2026XXXXXXXXXX_factura_autorizacion_id.sql` (D1): `ALTER TABLE
      facturacion.facturas ADD COLUMN autorizacion_id UUID REFERENCES facturacion.autorizacion(id)`
      (nullable, sin `UNIQUE`, `ON DELETE` default) + `CREATE INDEX IF NOT EXISTS
      idx_facturas_autorizacion_id ON facturacion.facturas (autorizacion_id)` — **con o sin
      `CONCURRENTLY` según lo que haya resuelto 0.3**. Cabecera con qué agrega, por qué, y rollback
      explícito (`DROP INDEX` + `DROP COLUMN`). No toca ninguna columna, policy ni tabla existente.
- [ ] 1B.2 `supabase/migrations/2026XXXXXXXXXX_factura_rpc_autorizacion.sql` (D2): `CREATE OR
      REPLACE FUNCTION` sobre `facturacion.crear_factura_completa` y
      `facturacion.actualizar_factura_completa`. En `crear_…`: una columna más en el `INSERT`,
      `(p_factura ->> 'autorizacion_id')::uuid`. En `actualizar_…`: el **mismo patrón `p_cambios ?
      'clave'`** que ya usa el resto de columnas — clave ausente = no tocar el vínculo existente
      (confundirlo con `->>` borraría `autorizacion_id` en cada cambio de estado). Se conservan
      **byte por byte**: `SECURITY INVOKER` explícito, `SET search_path = ''`, los códigos
      `452xx` existentes, la semántica de reemplazo completo de asistencias y la cabecera de
      advertencia ⚠️⚠️ `NUNCA SECURITY DEFINER`.
- [ ] 1B.3 **RED → GREEN.** Test de código fuente (`node:fs`, mismo patrón que
      `facturaMigrations.test.ts` de `integracion-facturacion`) que verifica que las dos funciones
      reemplazadas siguen declarando `SECURITY INVOKER` y no `SECURITY DEFINER`, y que
      `actualizar_factura_completa` usa el operador `?` (no `->>`) para `autorizacion_id`. RED real:
      forzar temporalmente `SECURITY DEFINER` o `->>` en el `.sql` y confirmar que el test falla,
      revertir, confirmar GREEN.
- [ ] 1B.4 **Aplicar las dos migraciones** — **la usuaria / Enzo**. Bloquea la §3 (el swap del
      wizard). Registrar el resultado del `db push` y cualquier hallazgo de
      `supabase db advisors --linked --type security` (delta contra el baseline ya conocido de
      `integracion-facturacion` 1B.6).
- [ ] 1B.5 Verificación manual: alta de una factura con una autorización elegida en el paso 2 →
      `facturas.autorizacion_id` queda persistido con ese id. **Pendiente — la hace la usuaria.**
- [ ] 1B.6 Verificación manual del caso que puede borrar el vínculo: editar **solo el estado** de una
      factura que ya tiene `autorizacion_id` (sin volver a elegir autorización) → el vínculo
      **sigue ahí** después de guardar. Es el mismo modo de falla que 1B.3 de `integracion-facturacion`
      pero sobre `autorizacion_id` en vez de `asistencias`. **Pendiente — la hace la usuaria.**
- [ ] 1B.7 Verificación manual de la declaración de seguridad en la base tras el reemplazo:
      `select proname, prosecdef from pg_proc where proname in ('crear_factura_completa',
      'actualizar_factura_completa')` → `false` en ambas. **Pendiente — la hace la usuaria.**

---

## 2. Tipos y mapeo (TDD estricto — aditivo, el wizard viejo sigue andando)

> Fase mayormente aditiva: `autorizacionId` no se consume todavía en el wizard hasta la §3. La baja
> de `prestadorNombre`/`prestadorDomicilio` sí toca los 5 archivos donde viven hoy (D5), pero es
> cambio de frontend puro — no requiere migración.

- [ ] 2.1 **RED** — `shared/types/factura.ts`: agregar `autorizacionId?: string` a `Factura` (y por
      lo tanto a `FacturaFormValues`, que se deriva); **retirar** `prestadorNombre`/
      `prestadorDomicilio`. **GREEN → REFACTOR.** Confirmar que `Autorizacion`/`CupoAutorizado` se
      siguen importando de `presupuesto.ts`, sin redefinir.
- [ ] 2.2 **RED** — `facturaMapping.ts` — `parseFacturaRow`: `autorizacion_id` (columna, snake_case)
      → `autorizacionId` (campo, camelCase); `NULL` → campo **ausente** (`undefined`), nunca `null`
      ni string vacío. **GREEN → TRIANGULATE** (fila con valor, fila con `NULL`) **→ REFACTOR**.
- [ ] 2.3 **RED** — `toCrearFacturaPayload`: cuando `autorizacionId` está presente en la factura de
      entrada, el payload incluye `autorizacion_id` con ese valor. **GREEN → TRIANGULATE** (con
      autorización elegida, sin autorización elegida) **→ REFACTOR**.
- [ ] 2.4 **RED** — `toActualizarFacturaPayload`: **semántica parcial, igual que la trampa ya
      resuelta para `asistencias`**. Clave `autorizacionId` ausente en el `Partial` de entrada →
      clave `autorizacion_id` ausente en el `jsonb` de salida (no sobrescribe el vínculo existente
      en la RPC, per D2). Clave presente (incluso con el mismo valor) → clave presente. **Test
      dedicado del caso crítico**: editar solo el estado no debe mandar `autorizacion_id`. **GREEN →
      TRIANGULATE → REFACTOR.**
- [ ] 2.5 **RED** — `SupabaseFacturaRepository.ts`: agregar `autorizacion_id` a la lista de columnas
      del `select` (`SELECT_FACTURA_COMPLETA` o equivalente), verificado con el fake tipado del
      cliente ya existente en el repositorio de tests (mismo patrón que
      `integracion-facturacion` §3). **GREEN → REFACTOR.**
- [ ] 2.6 **RED** — `frontend/src/shared/lib/facturacion/autorizacionesPendientes.ts` (D3, capability
      `factura-autorizacion-seleccion`): función pura `autorizacionesPendientes(pacienteId,
      presupuestoRepository, autorizacionRepository)` que:
      1. `presupuestoRepository.list()` filtrado por `pacienteId`,
      2. por cada presupuesto, `autorizacionRepository.getByPresupuestoId(p.id)`,
      3. se queda con `autorizacion !== null && autorizacion.estado === 'autorizada'`,
      4. devuelve `[{ autorizacion, presupuesto }]`.
      Cubrir los 4 scenarios de la spec: solo `'autorizada'` aparece, paciente sin ninguna pendiente
      (lista vacía, no `null`, no lanza), varias autorizaciones simultáneas del mismo paciente (todas
      aparecen), y una autorización que ya facturó el mes en curso sigue apareciendo (sin filtro por
      período). Repositories fake tipados, sin red, cero `any`. **GREEN → TRIANGULATE → REFACTOR.**
- [ ] 2.7 **RED** — Persistencia N:1 sin unicidad: test (a nivel de mapeo o repository fake) que
      confirma que dos facturas con el mismo `autorizacionId` en meses distintos se aceptan sin que
      el mapeo/payload imponga ninguna restricción de unicidad. **GREEN → REFACTOR.**
- [ ] 2.8 `frontend/src/shared/lib/mocks/facturasFixture.ts`: sacar `prestadorNombre`/
      `prestadorDomicilio` de los fixtures existentes (sin TDD — es un dato estático, no lógica).
- [ ] 2.9 `npx tsc -b --noEmit` limpio + `oxlint` limpio sobre todos los archivos tocados en esta
      sección. Cero `any`, cero `as` sobre datos externos. Suite focalizada de
      `src/shared/lib/facturacion/` completa en verde.

---

## 3. El wizard (⚠️ el corte real — bloqueada por 1B.4, un solo commit)

> A partir de acá el paso 2 deja de pedir prestador y pasa a pedir autorización. Antes de este
> commit, el frontend puede compilar y testear con los tipos/mapeo nuevos pero el wizard sigue
> mostrando el paso viejo — después de este commit, el paso viejo desaparece.

- [ ] 3.1 **RED** — `FacturaForm.tsx`, paso 2 (`pasoObraSocialContent`, L226-263 per `design.md`
      §Context): reemplazar los dos `Input` de prestador por un selector de autorizaciones
      pendientes del paciente elegido en el paso 1, usando `autorizacionesPendientes` (2.6). Obra
      social se mantiene de solo lectura. **GREEN → REFACTOR.**
- [ ] 3.2 **RED** — En modalidad `por-prestacion`, cada opción del selector se distingue con datos
      reales de la autorización/presupuesto (fecha de emisión, monto, cupos mensuales,
      `vigenciaDesde` cuando esté disponible) — **sin inventar ningún campo** como
      `Presupuesto.prestacionId` (D4 corrige al proposal: ese campo no existe, ver `design.md`
      §Context/N8). **GREEN → REFACTOR.**
- [ ] 3.3 **RED** — Estado vacío (0 autorizaciones pendientes): mensaje + link a Presupuestos,
      "Siguiente" bloqueado. El gateo `faltaCompletarPrestador` (L182-184, L395 per `design.md`) se
      **elimina** y su lugar lo toma `!values.autorizacionId`. La vista previa de la descripción
      (L186-189) deja de depender de esa bandera. **GREEN → REFACTOR.**
- [ ] 3.4 **RED** — Modo edición (`esEdicion`): la autorización ya persistida se muestra de solo
      lectura, no se puede recambiar. **GREEN → REFACTOR.**
- [ ] 3.5 **RED** — `ResumenPasoWizard.tsx`: reemplazar las props `prestadorNombre`/
      `prestadorDomicilio` por la autorización elegida (label equivalente al selector de 3.2).
      **GREEN → REFACTOR.**
- [ ] 3.6 **RED** — `useEmisionFactura.ts`: `resolverCupoAutorizado` deja de recibir solo
      `pacienteId` y adivinar — pasa a recibir también `autorizacionId` y derivar el
      `CupoAutorizado` de la autorización **elegida** vía `autorizacionRepository.getById(...)` +
      `derivarCupoAutorizado` (reusada sin cambios). Sin `autorizacionId` (facturas viejas con
      `autorizacion_id NULL`) → `undefined`, camino ya tolerado por `validarCupoFacturacion`. **GREEN
      → TRIANGULATE (con autorización, sin autorización) → REFACTOR.**
- [ ] 3.7 **RED** — Caso específico de la spec: paciente con **varias autorizaciones simultáneas**
      en `por-prestacion`; elegir una y confirmar que `AlertaCupo` se calcula contra **esa**, no
      contra la primera que devuelva el listado. Test de componente sobre `FacturaForm` con
      repositories fake que exponen ≥2 autorizaciones `'autorizada'` del mismo paciente. **GREEN →
      REFACTOR.**
- [ ] 3.8 `validateFacturaForm.ts`: decidir (per `design.md`, Open Question resuelta en esta fase) si
      la autorización se valida también a nivel formulario o solo a nivel gateo del wizard; si se
      agrega, con su propio ciclo RED→GREEN.
- [ ] 3.9 `npx tsc -b --noEmit` limpio + `oxlint` limpio. `git diff --stat` acotado a los archivos de
      esta sección (más 2.1-2.9 si no se commiteó antes) — nada fuera de
      `features/facturacion/`/`shared/types/factura.ts`/`shared/lib/facturacion/` se toca. Suite
      focalizada de `features/facturacion/` completa en verde (correr los archivos sueltos si la
      corrida conjunta muestra timeouts por carga de máquina, mismo patrón ya documentado en
      `integracion-facturacion` 6.5/8.1).

---

## 4. Documentación (obligatoria, no opcional)

- [ ] 4.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias — nueva entrada **N7**:
      `facturas.autorizacion_id` es un agregado sobre el docx (el docx no prevé ninguna referencia
      de la Factura a la Autorización), marcada para confirmar con el cliente / quien mantiene el
      docx, no resuelta unilateralmente.
- [ ] 4.2 `CHANGES.md` §C-07: registrar el cambio del paso 2 (prestador → autorización), la columna
      nueva `autorizacion_id`, el reemplazo de las dos RPC, y el riesgo aceptado de "sin control de
      doble facturación del mismo período" como asunción de negocio explícita, no como garantía del
      sistema.
- [ ] 4.3 `AvisoModeloDatos` (design-system) en el paso 2 del wizard o en el detalle de factura,
      señalando la discrepancia N7 — mismo patrón ya usado en `integracion-facturacion` §6.

---

## 5. Verificación final

- [ ] 5.1 Suite completa, **una sola corrida**:
      `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`. Comparar contra el
      baseline propio de 0.5 de este change (no contra `integracion-facturacion` 0.8/5.5/8.1
      directamente — puede haber deriva concurrente adicional). Si aparecen fallas nuevas dentro de
      `features/facturacion/` o `shared/lib/facturacion/`, **parar sin commitear** y reportar; fallas
      fuera de esos paths y ya conocidas como preexistentes (`ChecklistEditor.test.tsx` u otras
      registradas en changes anteriores) se documentan como tales, no se arreglan acá.
- [ ] 5.2 `npx tsc -b --noEmit` (con `-b`) limpio + `oxlint .` limpio sobre todo el repo (no solo los
      archivos tocados) — mismo criterio de cierre que `integracion-facturacion` 8.2.
- [ ] 5.3 Verificación manual en navegador con las **tres cuentas** de `VITE_TEST_ACCOUNTS` (queda
      para la usuaria, igual que el resto de este proyecto):
      - **Admin** / **Facturación**: alta de factura eligiendo autorización en el paso 2, edición de
        solo lectura de la autorización, estado vacío cuando el paciente no tiene autorizaciones
        pendientes.
      - **Operación** (u otra sin permiso de escritura sobre facturación): el wizard queda en solo
        lectura, sin fallo silencioso ni error críptico.
- [ ] 5.4 Verificación manual específica: paciente en modalidad `por-prestacion` con **varias
      autorizaciones simultáneas** — confirmar que el selector las distingue todas, que se puede
      elegir cualquiera, y que `AlertaCupo` refleja la elegida (no la primera del listado). Es el
      caso central que motiva este change (D6). **Pendiente — la hace la usuaria.**
- [ ] 5.5 Guardar en engram (`project: "traslados-app"`, `topic_key:
      "opsx/facturacion-seleccion-autorizacion/apply"`) cualquier discrepancia real encontrada en la
      §1 respecto de lo que `design.md` asume, siguiendo el mismo criterio ya usado en cada change
      anterior de este proyecto.
