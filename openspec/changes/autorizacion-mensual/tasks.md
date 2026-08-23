# Tasks: autorizacion-mensual

> **Governance: CRÍTICO.** Este change altera la cardinalidad de la que depende la corrección de la
> facturación a una obra social. La Fase 0 es **bloqueante**: ninguna tarea de las Fases 1+ arranca
> sin sus checkboxes marcados por una persona, no por el agente.
>
> **Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`,
> runner `cd frontend && npx vitest run`). Toda función pura y todo componente nuevo:
> RED → GREEN → TRIANGULATE → REFACTOR, con Safety Net antes de tocar archivos existentes.

---

## Fase 0 — Gates bloqueantes (los marca una persona)

- [x] **0.1** Archivar `presupuestos-vigencia-datos-traslado-vista-previa` (`/opsx:archive`) para que
      sus deltas de spec estén sincronizados en `openspec/specs/` antes de que este change los
      modifique. Ídem `facturacion-seleccion-autorizacion` si sigue activo.
      **Hecho 2026-08-22**: `presupuestos-vigencia-datos-traslado-vista-previa` archivado (commits
      `4218e9d`, `a6680fe`), sus 5 capabilities nuevas ya en `openspec/specs/`.
      `facturacion-seleccion-autorizacion` **deliberadamente NO se archiva** — sigue en 34/43 con
      trabajo real pendiente, no solo verificación humana diferida. La usuaria confirmó seguir sin
      archivarlo; queda anotado el riesgo de superposición sobre `autorizacionesPendientes.ts`/
      `FacturaForm.tsx` paso 2 para la Fase 5/6b de este change.
- [x] **0.2** ⚠️ **Firma G4 (D8)** — confirmar por escrito que `montoAutorizado` pasa a ser el tope
      **del mes** para filas con `periodoMes`, conservando la semántica **anual** para las filas
      legacy, y que las dos semánticas conviven en `montoConsumido` sin refactor.
      **Sin esta firma no se escribe una línea de la Fase 6b.**
      **Confirmado 2026-08-22** por la usuaria: OQ-1 se resuelve provisoriamente con la lectura (a)
      — `presupuesto.monto` es el monto **mensual**, se compara cada mes contra ese mismo número, sin
      trigger agregado. Decisión explícita de la usuaria ("hagámoslo contra monto mensual y si no
      después lo ajustamos"), **no** confirmación de Andrea — queda anotado como provisorio en
      `10_preguntas_abiertas.md` (OQ-1), a revisar si su respuesta real difiere.
- [x] **0.3** ⚠️ **Firma G5 (D7)** — confirmar la política "preseleccionar el mes coincidente +
      advertir sin bloquear", explícitamente **en contra** de auto-resolver (rompería D6 de
      `facturacion-seleccion-autorizacion`) y de bloquear (rompería RN-PA-02).
      **Sin esta firma no se escribe una línea de la Fase 6b.**
      **Confirmado 2026-08-22** por la usuaria.
- [x] **0.4** Firma G2 (mes como `DATE` día-1 absoluto, ordinal derivado) y G3 (auto-creación de
      **un** mes, el primero).
      **Confirmado 2026-08-22** por la usuaria — se le explicaron ambas decisiones explícitamente
      antes de aprobar el arranque de las Fases 1-6a.
- [x] **0.5** ⚠️ **Verificación del schema real en vivo, de solo lectura**, antes de escribir cualquier
      `.sql` (el schema real fue por delante del repo 5 changes seguidos):
      `supabase db query --linked` → confirmar (a) que `periodo_mes` **no** existe todavía en
      `facturacion.autorizacion`; (b) que **sigue sin haber** `UNIQUE` sobre `presupuesto_id`;
      (c) `count(*)` de `facturacion.autorizacion` y cuántos presupuestos ya tienen más de una fila;
      (d) `security_type = 'INVOKER'` de las 2 RPC. Registrar la evidencia acá.
      **Verificado 2026-08-22** (orquestador): `periodo_mes` no existe (0 columnas). Único índice
      sobre `presupuesto_id` es `idx_autorizacion_presupuesto_id` (no `UNIQUE`) — solo `autorizacion_pkey`
      (sobre `id`) es único. `count(*) = 6` filas totales, `0` en grupos con `presupuesto_id`
      duplicado. `crear_presupuesto_completo`/`crear_presupuestos_lote` confirmadas `SECURITY INVOKER`.
- [ ] **0.6** Enviar OQ-1 y OQ-2 a Andrea (texto en `design.md` D9) y OQ-3 a Enzo. **No bloquean el
      resto del change**, pero tienen que estar enviadas antes de la Fase 1.
      **Pendiente de la usuaria** — no ejecutable por el agente (requiere WhatsApp/llamada real).
- [x] **0.7** Cargar OQ-1/OQ-2 en `knowledge-base/10_preguntas_abiertas.md` con prioridad **Alta**.

---

## Fase 1 — SQL (artefactos de diseño; los aplica la usuaria, nunca el agente)

- [x] **1.1** `supabase/migrations/20260822180000_autorizacion_periodo_mes.sql`: `ADD COLUMN periodo_mes DATE`
      con `CHECK (periodo_mes IS NULL OR EXTRACT(DAY FROM periodo_mes) = 1)` (D1).
      **Hecho 2026-08-22**: `20260822180000_autorizacion_periodo_mes.sql:64-66`.
- [x] **1.2** Mismo archivo: `CREATE UNIQUE INDEX … (presupuesto_id, periodo_mes) WHERE periodo_mes IS NOT NULL`.
      Justificar en la cabecera por qué es **parcial** (D1) y por qué **no** hay `DROP CONSTRAINT`
      (nunca hubo `UNIQUE`).
      **Hecho 2026-08-22**: índice `idx_autorizacion_presupuesto_periodo` en
      `20260822180000_autorizacion_periodo_mes.sql:68-70`; justificación del "no `DROP CONSTRAINT`"
      (nunca hubo `UNIQUE`, solo `idx_autorizacion_presupuesto_id` no-único) en `:7-16`; motivo del
      índice parcial en `:27-33`.
- [x] **1.3** Cabecera del `.sql`: sin RLS nueva (no hay tabla nueva, las policies de `presupuestos`
      ya cubren la columna), sin backfill (D3), rollback = `DROP INDEX` + `DROP COLUMN`.
      **Hecho 2026-08-22**: sin RLS en `20260822180000_autorizacion_periodo_mes.sql:35-41`, sin
      backfill en `:43-51`, rollback en `:57-62`.
- [x] **1.4** `supabase/migrations/20260822181000_presupuesto_rpc_autorizacion_primer_mes.sql`:
      `CREATE OR REPLACE` de `crear_presupuesto_completo` y `crear_presupuestos_lote` agregando
      `periodo_mes` al `INSERT` de autorización vía
      `date_trunc('month', NULLIF(… ->> 'vigencia_desde','')::date)::date` (D4).
      ⚠️ Conservar **byte por byte**: firma, `SECURITY INVOKER`, `SET search_path = ''`,
      códigos `45401`-`45404`, el bloque ⚠️⚠️ `NUNCA SECURITY DEFINER`.
      **Hecho 2026-08-22**: partido de la versión LIVE más reciente de las dos RPC
      (`20260821172000_presupuesto_rpc_campos_nuevos.sql`, aplicada 2026-08-21 por
      `presupuestos-vigencia-datos-traslado-vista-previa`), no de una versión vieja. `INSERT` de
      autorización con `periodo_mes` en `20260822181000_presupuesto_rpc_autorizacion_primer_mes.sql:113-117`
      (alta simple) y `:189-193` (lote). Firma, `SECURITY INVOKER`, `SET search_path = ''`,
      18 columnas del `INSERT` de `presupuesto`, `insertar_lineas_presupuesto` y códigos
      `45401`-`45403` conservados byte por byte; `45404` no vive en este archivo (pertenece al
      helper de `20260816110000`, invocado sin redefinir) — verificado por test, ver 1.5.
- [x] **1.5** Actualizar el test de texto de fuente sobre las RPC (`presupuestoMigrations.test.ts`).
      **Hecho 2026-08-22**: `frontend/src/shared/lib/presupuestos/presupuestoMigrations.test.ts:266-350`
      (nuevo `describe('migración 20260822181000_presupuesto_rpc_autorizacion_primer_mes.sql')`, 8
      tests: `SECURITY INVOKER` ×2/no `DEFINER`, `search_path` ×2, firma sin cambios, `periodo_mes`
      derivado con `date_trunc` en las dos funciones, sin código de error nuevo, 18 columnas del
      `INSERT` de `presupuesto` intactas, llamada a `insertar_lineas_presupuesto` ×2, sin
      `EXCEPTION WHEN`, `NO convertir a SECURITY DEFINER` ×2). Corrida: `cd frontend && npx vitest
      run src/shared/lib/presupuestos/presupuestoMigrations.test.ts` → **31/31 passed** (23
      preexistentes + 8 nuevos).
- [x] **1.6** ⚠️ **El agente NO ejecuta `supabase db push`.** La usuaria aplica; se registra evidencia
      post-aplicación acá.
      **Escrito, no aplicado (2026-08-22)** — las dos migraciones de esta fase
      (`20260822180000_autorizacion_periodo_mes.sql`,
      `20260822181000_presupuesto_rpc_autorizacion_primer_mes.sql`) quedan como artefacto de diseño
      en `supabase/migrations/`, **sin ejecutar** ningún `supabase db push` / `migration up` / `db
      query` de escritura desde el agente. **Pendiente de aplicación real por la usuaria o Enzo.**
      Queda para después de aplicar: reverificar en vivo (a) `periodo_mes` existe y el `CHECK` día-1
      funciona, (b) el índice único parcial rechaza un segundo mes duplicado del mismo presupuesto,
      (c) las dos RPC siguen dando de alta presupuestos sin `vigencia_desde` con `periodo_mes NULL`
      (paridad byte a byte con el comportamiento anterior).
      **Aplicado 2026-08-22** — verificado en vivo (orquestador) vía `supabase db query --linked`:
      columna `periodo_mes` presente en `facturacion.autorizacion`; índice
      `idx_autorizacion_presupuesto_periodo` presente.

## Fase 2 — Edge Function `autorizaciones`

- [x] **2.1** `periodo_mes` en `AutorizacionRow` / `AutorizacionInput` / `toApi` / `toDb`
      (patrón `!== undefined` = partial update, igual que el resto).
      **Hecho 2026-08-22**: `supabase/functions/autorizaciones/index.ts:50-53` (`AutorizacionRow.periodo_mes`),
      `:76-80` (`AutorizacionInput.periodoMes?`), `:100-101` (`toApi`), `:122-123` (`toDb`, patrón
      `!== undefined` idéntico al resto del archivo). `deno check` limpio (ver 2.4 más abajo).
- [x] **2.2** `GET ?presupuestoId=` → lista ordenada por `periodo_mes NULLS FIRST`; **`.maybeSingle()`
      fuera**; `200 []` en lugar de `404` (D5). Reemplazar el comentario `:133-136` que dejaba el
      punto marcado, citando este change.
      **Hecho 2026-08-22**: `supabase/functions/autorizaciones/index.ts:151-169`. `.maybeSingle()`
      retirado; `.order('periodo_mes', { ascending: true, nullsFirst: true })`; devuelve
      `(data as AutorizacionRow[]).map(toApi)` siempre (incluido `[]`), nunca `404`. Comentario
      viejo (`:133-136` en la versión pre-edit, citaba "el punto 7... hasta que eso se decida")
      reemplazado por uno que cita `tasks.md 2.2, design.md D5` de este change (`:152-157`).
      ⚠️ **Riesgo explícito para Fase 4**: `SupabaseAutorizacionRepository.getByPresupuestoId`
      (`:246-259`) todavía espera un objeto único (`parseAutorizacionApi(data)` sin `Array.isArray`)
      y trata el `404` como "sin autorización" (`esErrorNotFound`). Con este cambio de EF ya en vivo,
      esa llamada va a recibir un array (`200 [...]` o `200 []`) en lugar de `{...}`/`404` — el
      repository queda roto hasta que Fase 4.1/4.2 lo conviertan a `listByPresupuestoId` y retiren
      `esErrorNotFound` de esa consulta (exactamente lo que D5 anticipa: "los pasos 3 y 4-6 no se
      pueden desplegar por separado"). No se tocó `SupabaseAutorizacionRepository.ts` en esta fase
      (fuera de alcance asignado).
- [x] **2.3** Filtro opcional `&periodoMes=`.
      **Hecho 2026-08-22**: `supabase/functions/autorizaciones/index.ts:137` (lectura del query
      param), `:164-166` (`.eq('periodo_mes', periodoMes)` aplicado solo dentro de la rama
      `presupuestoId`, condicional a que venga).
- [x] **2.4** Actualizar la cabecera del archivo: la relación ya no es `1---1` (`:8-9`).
      **Hecho 2026-08-22**: `supabase/functions/autorizaciones/index.ts:8-11` — "relacion 1:N con
      Presupuesto -- autorizacion-mensual tasks.md Fase 2, design.md D5; antes 1---1". Safety net:
      reconstruido el archivo pre-edit vía `git show HEAD:supabase/functions/autorizaciones/index.ts`
      y corrido `deno check` sobre ambas versiones — **0 errores en las dos** (baseline y editado).

## Fase 3 — Contrato y funciones puras (TDD estricto)

- [x] **3.1** `Autorizacion.periodoMes?: string` en `shared/types/presupuesto.ts`; reescribir el
      comentario `:189` (1---1 → 1:N) y documentar `NULL` = modelo anterior (D3).
      **Hecho 2026-08-22**: campo en `frontend/src/shared/types/presupuesto.ts:242`
      (`periodoMes?: string`, comentario `:225-241` documenta ISO `YYYY-MM-01`, `undefined` =
      modelo anterior D3, convivencia con filas mensuales, orden/etiqueta y semántica anual D8).
      Comentario de `presupuestoId` (`:189-191`) reescrito de "relación 1---1" a "relación **1:N**"
      citando D1/D2 de este change. `npx tsc -b --noEmit` limpio tras el cambio.
- [x] **3.2** **RED/GREEN/TRIANGULATE** `periodoAutorizacion.ts` → `normalizarPeriodoMes`
      (`'2026-03'`, `'2026-03-15'`, `'2026-03-01'` → `'2026-03-01'`; entrada inválida).
      **Hecho 2026-08-22**: `frontend/src/shared/lib/presupuestos/periodoAutorizacion.ts:32-42`
      (impl), test `periodoAutorizacion.test.ts:16-49` (7 casos, incluye triangulación diciembre y
      3 formas de entrada inválida). **Decisión (entrada inválida)**: `throw
      PeriodoMesInvalidoError` (`:18-23`) — la firma de contrato de D2 declara retorno `string` no
      opcional, así que ni se inventa un string ni se devuelve `undefined`; el llamador decide cómo
      mostrar el error.
- [x] **3.3** Ídem `ordinalMes` — casos: orden normal, **mes salteado**, **carga fuera de orden**
      (RN-PA-02), lista con legacy `undefined`.
      **Hecho 2026-08-22**: impl `periodoAutorizacion.ts:60-72`, test `periodoAutorizacion.test.ts:57-97`
      (orden normal, mes salteado, fuera de orden RN-PA-02, legacy mezclado, período no encontrado).
      **Decisión (tie-breaking/legacy)**: el ordinal se recalcula SIEMPRE por fecha ordenada
      ascendente entre los períodos con mes, nunca por posición de inserción en el array de
      entrada; las entradas `undefined` (legacy) no tienen ordinal propio y tampoco cuentan para la
      numeración de las filas con mes (no corren la numeración, no son "Mes 0").
- [x] **3.4** Ídem `etiquetaPeriodoMes` — incluye el caso `undefined → 'Sin mes cargado'` (nunca un mes
      inventado).
      **Hecho 2026-08-22**: impl `periodoAutorizacion.ts:99-107`, test
      `periodoAutorizacion.test.ts:104-115`. **Decisión (formato exacto)**: devuelve SOLO
      `'{mes en minúscula} {año}'` (ej. `'marzo 2026'`), sin el prefijo "Mes N" — el design.md D10
      (`Mes {ordinalMes}` + `etiquetaPeriodoMes` → *"Mes 2 · abril 2026"*) deja explícito que el
      prefijo "Mes N" lo antepone quien llama (combinando con `ordinalMes`), no esta función; la
      tabla de contrato de D2 confirma el mismo mapeo (`'2026-03-01'` → `'marzo 2026'`).
- [x] **3.5** Ídem `coincidePeriodoFacturado` / `validarCoherenciaPeriodo` (D7) — coincide, no coincide,
      autorización legacy sin período.
      **Hecho 2026-08-22**: impl `periodoAutorizacion.ts:126-161`, test
      `periodoAutorizacion.test.ts:122-176` (`coincidePeriodoFacturado`: coincide/mes distinto/año
      distinto/legacy; `validarCoherenciaPeriodo`: los 3 estados). **Decisión (forma de retorno)**:
      `coincidePeriodoFacturado` conserva el booleano de la tabla de contrato de D2 (insumo de la
      preselección); `validarCoherenciaPeriodo` devuelve la unión `'coincide' | 'no-coincide' |
      'legacy-sin-periodo'` (`:143`) — un booleano plano fusionaría "elegiste mal el mes" con "esta
      fila es legacy y no tiene con qué comparar" en el mismo `false`, y D7 pide mensajes distintos
      para cada caso en el aviso de Fase 6b.
- [x] **3.6** `autorizacionMapping.ts`: `periodoMes` en las 3 direcciones + round-trip test.
      **Hecho 2026-08-22**: `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts:105`
      (parse), `:130` (`CrearAutorizacionPayload.periodoMes?`), `:149` (`toCrearAutorizacionPayload`,
      patrón `!== undefined`), `:176` (`toActualizarAutorizacionPayload`, mismo patrón). Test
      `autorizacionMapping.test.ts:277-336` (8 casos: parse presente/ausente, create presente/ausente,
      update presente/ausente, 2 round-trip incluyendo legacy). Safety net previo: 24/24 tests
      pasando en `autorizacionMapping.test.ts` antes de tocar el archivo; 32/32 después (24 + 8
      nuevos), sin romper ninguno de los existentes.

## Fase 4 — Repositories

- [x] **4.1** `AutorizacionRepository`: `getByPresupuestoId` → `listByPresupuestoId(): Promise<Autorizacion[]>` (D5).
      **Hecho 2026-08-23**: `frontend/src/shared/lib/presupuestos/AutorizacionRepository.ts:25`
      (`listByPresupuestoId(presupuestoId: string, periodoMes?: string): Promise<Autorizacion[]>`),
      docstring `:13-24` explica el reemplazo (no convivencia, mismo criterio que D6 de
      `facturacion-seleccion-autorizacion` citado en design.md D5). Cabecera del archivo (`:3-8`)
      actualizada de "relación 1---1" a "relación **1:N**".
- [x] **4.2** `SupabaseAutorizacionRepository` (`:246-259`): plural; **retirar** el `esErrorNotFound`
      de esa consulta; `&periodoMes=` opcional.
      **Hecho 2026-08-23**: `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts:246-269`
      (`async listByPresupuestoId(presupuestoId, periodoMes)`). `esErrorNotFound` retirado de esta
      consulta (`:259` comenta explícitamente por qué); cualquier error se traduce con
      `mapearErrorEdgeFunction(..., { operacion: 'listar' })` igual que `list()`. `&periodoMes=`
      opcional agregado a la querystring solo si vino (`:251-252`, patrón `!== undefined`). `data`
      mapeado como array con el mismo patrón anti-N+1 que `list()` (`:262-268`). `esErrorNotFound`
      sigue importado/usado por `getById`/`obtenerAutorizacion` (`:144`) — no se tocó ese camino.
- [x] **4.3** `edgeFunctionErrors.ts`: actualizar `:122,143` (el 404 ya no aplica a esta consulta) y
      **mapear `23505` del índice único** a *"Ya existe una autorización para ese mes en este presupuesto."*
      **Hecho 2026-08-23**: comentarios de `mapearErrorEdgeFunction` (`:131-136` en el archivo
      editado) y de `esErrorNotFound` (`:156-161`) reescritos para dejar explícito que
      `listByPresupuestoId` YA NO pasa por el atajo de 404 (la EF devuelve `200 []`, tasks.md Fase 2).
      `MENSAJE_AUTORIZACION_DUPLICADA` exportado en `:54-57`; helper `esViolacionDeUnicidadPeriodo`
      (detecta `'23505'` crudo) en `:100-104`; rama nueva en `mapear400` en `:120` (antes de la FK,
      después de RN-PA-01). **RED→GREEN**: 2 tests agregados primero en
      `edgeFunctionErrors.test.ts:96-121` (mapeo básico + triangulación con texto crudo distinto y
      operación `actualizar`) — corridos en rojo (`TypeError`/mensaje genérico, no el de dominio)
      antes de escribir la implementación, y en verde después
      (`npx vitest run src/shared/lib/presupuestos/edgeFunctionErrors.test.ts` → 19/19, 17
      preexistentes + 2 nuevos).
- [x] **4.4** `mockAutorizacionRepository.ts` (`:78`): plural + **bump de `SCHEMA_VERSION`** (regla del
      proyecto: cambió la forma persistida) + fixtures con 2-3 meses y al menos una fila legacy.
      **Hecho 2026-08-23**: `SCHEMA_VERSION` 1 → 2 en `mockAutorizacionRepository.ts:18`, comentario
      `:12-17` explica el motivo (mismo patrón de bump que `mockObraSocialRepository` en
      `integracion-obra-social` D9, verificado antes de escribir). `listByPresupuestoId` en `:84-100`
      (filtra por `presupuestoId` + `periodoMes` opcional, ordena legacy primero y luego ascendente
      por mes — mismo orden que la EF real). Fixtures nuevas en
      `autorizacionesFixture.ts:59-86` (`presupuesto-camila-1`, 3 meses: 2 `autorizada` + 1
      `pendiente`), las 4 filas legacy existentes (sin `periodoMes`) quedan intactas como caso legacy.
      **RED→GREEN→TRIANGULATE**: tests nuevos escritos primero en `mockAutorizacionRepository.test.ts`
      (corridos en rojo: `listByPresupuestoId is not a function`), implementación después, verde
      confirmado (`npx vitest run .../mockAutorizacionRepository.test.ts` → 23/23).
- [x] **4.5** Safety Net + actualización de los tests de repository existentes
      (`SupabaseAutorizacionRepository.test.ts:280-315`, `mockAutorizacionRepository.test.ts:71-85`).
      **Hecho 2026-08-23**: Safety Net previo (antes de tocar nada) —
      `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` sobre los 13 archivos de este
      change/dependientes → **162/162 passed** (baseline; el runner correcto necesita esa
      `NODE_OPTIONS`, ver Issues). `SupabaseAutorizacionRepository.test.ts:280-364` reescrito
      (describe `getByPresupuestoId()` → `listByPresupuestoId()`, 8 tests: querystring con/sin
      `periodoMes`, array con varias filas, `[]` ya no es 404, `data` no-array, filas malformadas,
      403, 404 real ya no interceptado). `mockAutorizacionRepository.test.ts:71-125` reescrito (4
      tests: legacy 1 elemento, `[]` sin autorización, todas las filas multi-mes ordenadas, filtro
      `periodoMes`) + conteos de longitud de fixture actualizados de 4 a 7 en 3 tests + 1 test nuevo
      de bump de `SCHEMA_VERSION` (mismo patrón que `mockObraSocialRepository.test.ts:129-145`).
      Verificación final (después de todos los cambios de Fase 4):
      `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` sobre los 13 archivos →
      **173/173 passed** (162 baseline + 11 nuevos, cero regresiones). `cd frontend && npx tsc -b
      --noEmit` → limpio. `npx vitest run` completo del repo (`--maxWorkers=2`, corrida completa
      tarda ~4 min) → 3186/3210 passed; los 24 fallos restantes están en 6 archivos que NO mencionan
      `Autorizacion` en absoluto (`ChecklistEditor.test.tsx`, `PacienteDetail.test.tsx`,
      `PacientesPage.test.tsx`, `VehiculosPage.test.tsx` — error de fondo
      `useCatalogoAccesoriosRepository debe usarse dentro de <CatalogoAccesoriosRepositoryProvider>`,
      sin relación con este change) — **pre-existentes, no introducidos por esta fase**, reportados
      sin tocar (regla de Safety Net: no arreglar fallas preexistentes).
      **Callers adaptados fuera del repository layer** (para que `tsc -b` compile, D5 anticipa que
      "los pasos 3 y 4-6 no se pueden desplegar por separado"):
      - `PresupuestoDetail.tsx:81-95,120-135`: toma la primera fila de `listByPresupuestoId` (mínimo
        correcto para esta fase) — `TODO(autorizacion-mensual Fase 6a)` explícito para la Table de
        meses real. Test `PresupuestoDetail.test.tsx` actualizado (14/14 passed).
      - `autorizacionesPendientes.ts:9-33,42-51`: `flatMap` sobre `listByPresupuestoId` (mismo filtro
        de estado que antes, por fila) — no descarta meses en silencio; orden por `periodoMes`
        queda `TODO(autorizacion-mensual Fase 5)`. Tests nuevos en
        `autorizacionesPendientes.test.ts` prueban explícitamente que varios meses del mismo
        presupuesto aportan una entrada cada uno (9/9 passed).
      - Fakes de tests renombrados/adaptados (sin cambio de lógica de producción, solo conformidad
        de interfaz): `AutorizacionRepositoryContext.test.tsx`, `useAutorizaciones.test.ts`,
        `PresupuestosPage.test.tsx`, `FacturaDetail.test.tsx`, `FacturaForm.test.tsx`,
        `FacturacionPage.test.tsx`, `useEmisionFactura.test.ts`,
        `PresupuestosFacturacionCoherencia.test.tsx` — ver lista completa de call sites en el
        reporte de apply-progress (engram `sdd/autorizacion-mensual/apply-progress`).

## Fase 5 — Selector de facturación (D6)

- [x] **5.1** Safety Net: correr `autorizacionesPendientes.test.ts` + `FacturaForm.test.tsx` y anotar
      el baseline.
      **Hecho 2026-08-23**: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run
      src/shared/lib/facturacion/autorizacionesPendientes.test.ts
      src/features/facturacion/FacturaForm.test.tsx` → **35/35 passed** (9 +
      26, baseline, antes de tocar nada). También se corrió
      `etiquetaAutorizacion.test.ts` de forma preventiva (8/8, no pedido explícitamente por 5.1 pero
      tocado por 5.3 más abajo).
- [x] **5.2** `autorizacionesPendientes.ts`: `flatMap` sobre `listByPresupuestoId`, filtro
      `autorizada|judicializada` **por mes**, orden por `periodoMes` (legacy primero).
      **Hecho 2026-08-23**: el `flatMap`/filtro por fila ya venía de la Fase 4
      (`autorizacionesPendientes.ts:48-56`, sin cambios de lógica en esta fase); lo que agrega 5.2 es
      el orden: `ordenarPorPeriodoMes` en `autorizacionesPendientes.ts:56,62-72` (legacy `undefined`
      primero, después ascendente por `periodoMes` — mismo comparador que
      `mockAutorizacionRepository.listByPresupuestoId`, D5). TODO de Fase 4 retirado, cabecera del
      archivo reescrita citando D6c (`:5-14`). **RED**: 2 tests nuevos en
      `autorizacionesPendientes.test.ts:280-334` (orden entre presupuestos distintos insertados
      fuera de orden cronológico; legacy siempre primero) corridos en rojo ANTES de implementar
      (`npx vitest run .../autorizacionesPendientes.test.ts` → 2 failed, 9 passed) — confirmado que
      fallaban por falta de orden, no por otro motivo. **GREEN**: implementación, mismo comando →
      **11/11 passed**. Sin necesidad de refactor adicional (función ya extraída y documentada).
- [x] **5.3** `etiquetaAutorizacion.ts`: el período entra en la etiqueta.
      **Test obligatorio**: 3 meses del mismo presupuesto y la misma prestación producen
      **3 etiquetas distintas** (si no, son 3 opciones idénticas en el `<select>`).
      **Hecho 2026-08-23**: `etiquetaAutorizacion.ts:36-40` — sufijo ` · {etiquetaPeriodoMes(...)}`
      SIEMPRE agregado (reusa `etiquetaPeriodoMes` de `periodoAutorizacion.ts`, Fase 3, sin
      reimplementar el mapeo mes→español); fallback existente extraído a `etiquetaFallback`
      (`:43-48`) para que la función principal quede legible. **RED**: 4 tests preexistentes de
      `etiquetaAutorizacion.test.ts` actualizados al nuevo contrato (sufijo `'Sin mes cargado'` para
      legacy) + 2 tests nuevos (`:89-99` con `periodoMes` real; `:102-113` **el test obligatorio**,
      3 meses/misma prestación/mismo presupuesto) — corridos en rojo primero (6/10 failed,
      exactamente las 6 que dependían del formato viejo o del período). **GREEN**: implementación,
      `npx vitest run .../etiquetaAutorizacion.test.ts` → **10/10 passed**. **Triangulación**
      confirmada por el test obligatorio: `['Kinesiología · enero 2026', 'Kinesiología · febrero
      2026', 'Kinesiología · marzo 2026']`, las 3 distintas (`new Set(...).size === 3`).
      **Efecto de contrato en un consumidor de test** (no producción): `FacturaForm.test.tsx:538-539`
      esperaba el nombre exacto `'Kinesiología'`/`'Fonoaudiología'` como `option` — con el sufijo
      nuevo esas dos autorizaciones (legacy, sin `periodoMes` en su fixture) pasan a
      `'Kinesiología · Sin mes cargado'`/`'Fonoaudiología · Sin mes cargado'`; assertions
      actualizadas al nuevo contrato (mismo test, no se tocó `FacturaForm.tsx` de producción).
      Verificación conjunta final: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run
      src/features/facturacion/FacturaForm.test.tsx
      src/shared/lib/facturacion/autorizacionesPendientes.test.ts
      src/shared/lib/facturacion/etiquetaAutorizacion.test.ts` → **47/47 passed**. Barrido más
      amplio: `npx vitest run src/features/facturacion src/shared/lib/facturacion
      src/shared/lib/presupuestos` → **694/694 passed** (59 archivos), cero regresiones. `cd
      frontend && npx tsc -b --noEmit` → limpio.

## Fase 6a — UI de presupuestos (D10/D11)

- [x] **6a.1** Safety Net: `PresupuestoDetail.test.tsx` (baseline), `AutorizacionForm.test.tsx`.
      **Hecho 2026-08-23**: baseline pre-edición `NODE_OPTIONS=--no-experimental-webstorage npx
      vitest run src/features/presupuestos/PresupuestoDetail.test.tsx
      src/features/presupuestos/AutorizacionForm.test.tsx` → **50/50 passed** (2 archivos), `cd
      frontend && npx tsc -b --noEmit` limpio. Evidencia post-edición al final de esta fase (8a.8).
- [x] **6a.2** `PresupuestoDetail.tsx:103-141` (línea real al momento de editar, ver git history):
      estado `autorizacion: Autorizacion | null` → `autorizaciones: Autorizacion[]`; ajustar la
      lógica de `autorizacionEditing` (`:130`).
      **Hecho 2026-08-23**: `PresupuestoDetail.tsx:102` (`autorizaciones: Autorizacion[]`),
      `:105` (`filaAbierta: string | 'nueva' | null` reemplaza el booleano `autorizacionEditing` —
      identifica CUÁL fila está desplegada, no solo si "la" autorización se edita), `:110-129`
      (efecto: `listByPresupuestoId` completo en `autorizaciones`, `filaAbierta` arranca en
      `'nueva'` solo cuando `encontradas.length === 0`, D10 "sin ninguna autorización"),
      `:174-188` (`handleSubmitAutorizacion`: `create()` cuando `filaAbierta === 'nueva'`,
      `update(filaAbierta, …)` cuando es un id existente, agrega/reemplaza esa fila en el array sin
      descartar las demás), `:195-196` (`autorizacionEnEdicion` derivado).
- [x] **6a.3** `PresupuestoDetail.tsx:249-320` (línea real al momento de editar): card única →
      `Table` de meses, fila clickeable, acción "Agregar mes". Cubrir los 5 estados de D10.
      **Hecho 2026-08-23**: `PresupuestoDetail.tsx:318-386` (`Table`/`Th`/`Tr`/`Td` del design
      system, `Tr interactive` + `<button>` interno para accesibilidad por teclado, mismo patrón
      que `CuentasList.tsx`), columnas Mes/Estado/Monto autorizado/Cupo/Vigencia/Adjunto
      (textuales de D10), `:387-390` botón "+ Agregar mes" (`requiereEscritura`, mismo patrón "+
      Agregar X" que `DireccionesEditor`/`PrestacionesEditor`). Los 5 estados de D10 ("cargando ·
      sin ninguna autorización (legacy pre-2026-08-15) · solo legacy sin mes · N meses · mezcla
      legacy + meses", quote textual) cubiertos 1 test por estado en
      `PresupuestoDetail.test.tsx` (`describe('PresupuestoDetail — Table de meses, los 5 estados
      de D10')`). Columna "Adjunto" (D10/D12): presencia vía `Chip` ("Con archivo"/"Sin archivo"),
      la vista previa REAL (Overlay + `VistaPreviaArchivo`) se reusa tal cual abriendo la fila —
      decisión documentada in-line (`:372-378`) para no resolver N URLs firmadas en paralelo por
      fila sin que estuviera pedido.
- [x] **6a.4** `AutorizacionForm.tsx`: `<input type="month">` + rótulo "Mes N" derivado + prefill del
      primer mes no cargado; editable en edición con re-chequeo de unicidad.
      **Hecho 2026-08-23**: `AutorizacionForm.tsx:44` (`AutorizacionFormValues.periodoMes?:
      string`), `:439-455` (`<input type="month">`, único campo de identidad, valor mostrado
      `values.periodoMes.slice(0,7)`), `:277-280` (`rotuloMes` en vivo, reusa `ordinalMes`/
      `etiquetaPeriodoMes` de `periodoAutorizacion.ts` **tal cual** — Fase 3, no reimplementadas),
      `:282-296` (`handleMesChange`, normaliza con `normalizarPeriodoMes` — también reusada, no
      reimplementada), `:71-88` (`primerMesNoCargado`, helper nuevo LOCAL de este archivo — prefill
      derivado del rango de vigencia + meses ya existentes, D11 textual — con `sumarUnMes`,
      `:53-62`, aritmética de fecha nativa con acarreo de año). Editable en edición: el `<input>` no
      tiene ningún `disabled` condicionado a `initial` (solo al gateo de escritura general del
      `CamposSoloLectura` que envuelve todo el bloque, igual que el resto de los campos) — test
      dedicado en `AutorizacionForm.test.tsx` ("el mes queda editable en edición").
- [x] **6a.5** Mensaje de dominio al intentar cargar un mes duplicado (viene de 4.3).
      **Hecho 2026-08-23**: `AutorizacionForm.tsx:13` (import de `MENSAJE_AUTORIZACION_DUPLICADA`
      desde `edgeFunctionErrors.ts` — reusado, NO reimplementado), `:305-311` (chequeo LOCAL contra
      `periodosDelPresupuesto` antes de invocar `onSubmit`, bloquea con el mismo mensaje que el
      `23505` real mapea). `PresupuestoDetail.tsx:301-304` pasa `periodosDelPresupuesto` (las DEMÁS
      filas, excluyendo la propia en edición) para que el chequeo tenga los datos correctos. Tests:
      `AutorizacionForm.test.tsx` (bloqueo directo + triangulación "re-guardar la fila con su propio
      mes no bloquea") y `PresupuestoDetail.test.tsx` (`describe('PresupuestoDetail — mensaje de
      dominio al cargar un mes duplicado')`, confirma el wiring de `periodosDelPresupuesto` end to
      end).
- [x] **6a.6** `AvisoModeloDatos` con OQ-1/OQ-2 en `AutorizacionForm` y `PresupuestoDetail`.
      **Hecho 2026-08-23**: `AutorizacionForm.tsx:418-431` (cuarto `AvisoModeloDatos` del archivo,
      sube el conteo de carteles de 3 a 4 — mismo componente que las discrepancias docx por
      decisión explícita de design.md D9, no `AvisoPendienteCliente`); `PresupuestoDetail.tsx:255-262`
      (`AvisoModeloDatos` nuevo dentro de `Section label="Autorización"`, antes de la Table/form).
      Texto de ambos deriva de `knowledge-base/10_preguntas_abiertas.md:488-500` (OQ-1/OQ-2 ya
      cargadas ahí en la Fase 0.7), sin inventar redacción nueva. Tests: `AutorizacionForm.test.tsx`
      ("muestra el AvisoModeloDatos de OQ-1... y OQ-2...", conteo 4 carteles ×2) y
      `PresupuestoDetail.test.tsx` (cartel de Facturación sigue contándose por separado vía filtro
      de regex, no se rompe por el cartel nuevo).
- [x] **6a.7** Test: reemplazar el adjunto del mes 2 **no toca** el del mes 1 (verificar D12, no
      asumirlo).
      **Hecho 2026-08-23**: `PresupuestoDetail.test.tsx` (`describe('PresupuestoDetail — el
      adjunto de un mes no afecta al de otro mes')`): sube un archivo para abril (Mes 2, id
      `autorizacion-abril`), confirma `uploadArchivo` llamado con ESE id (nunca con
      `autorizacion-marzo`), vuelve a la Table y reabre marzo (Mes 1) — su archivo sigue siendo el
      propio (`marzo.pdf`), sin cruzarse con el recién subido para abril. Confirma D12 ("N filas
      mensuales = N archivos independientes... se verifica con un test") a nivel de estado de
      React (`setAutorizaciones` no cruza filas) — la garantía de storage por `id` de fila (D12,
      capa de `SupabaseAutorizacionRepository`/bucket) ya estaba verificada por lectura en Fase 1-4
      y no se re-implementa acá.
      **Verificación de la fase completa**: `NODE_OPTIONS=--no-experimental-webstorage npx vitest
      run src/features/presupuestos/PresupuestoDetail.test.tsx
      src/features/presupuestos/AutorizacionForm.test.tsx` → **70/70 passed** (23 +
      47, baseline 50 + 20 tests nuevos netos tras las reescrituras de 6a.2/6a.3/6a.4/6a.6). `cd
      frontend && npx tsc -b --noEmit` limpio. `npx vitest run src/features/presupuestos/` completo
      → 207/207 (14 archivos). Ver `apply-progress` (engram, o este mismo archivo si engram no
      disponible) para el resultado de la corrida completa del repo.

## Fase 6b — Facturación (D7/D8) — ⚠️ BLOQUEADA POR 0.2 y 0.3

- [x] **6b.1** ⚠️ Confirmar que 0.2 y 0.3 están firmadas. Si no, **detenerse y reportar**.
      **Hecho 2026-08-23**: verificado leyendo `tasks.md` — 0.2 (Firma G4/D8) `[x]` con evidencia
      "Confirmado 2026-08-22 por la usuaria" (línea 28); 0.3 (Firma G5/D7) `[x]` con evidencia
      "Confirmado 2026-08-22 por la usuaria" (línea 37). Ambas firmadas — se procede con 6b.2-6b.6.
- [x] **6b.2** `FacturaForm.tsx` Paso 2: preselección de la autorización cuyo `periodoMes`
      coincide con `(mesFacturado, anioFacturado)` **solo si hay exactamente una**; siempre cambiable.
      **Hecho 2026-08-23**: `FacturaForm.tsx:229-247` (efecto `preseleccionAplicadaRef`, mismo
      patrón de ref-por-identidad que `obraSocialIdPrecargada` ya usado en este archivo — corre una
      sola vez por `pacienteId`, nunca en edición D4, nunca pisa una elección manual ya hecha).
      Filtra con `coincidePeriodoFacturado` (reusada de `periodoAutorizacion.ts`, Fase 3, sin
      reimplementar la comparación) y solo asigna `autorizacionId` si `coincidencias.length === 1`.
      Siempre cambiable: el `<Select>` del Paso 2 (`:441-455`) no gana ningún `disabled` nuevo — el
      operador puede reelegir libremente después de la preselección (test dedicado lo confirma).
      **RED→GREEN**: 3 tests nuevos en `FacturaForm.test.tsx` (describe "preselección y coherencia
      de período", exactamente una coincidencia / dos coincidencias ambiguas → ninguna preselección
      / reelección manual post-preselección) corridos en rojo primero (timeout con `vi.useFakeTimers`
      + `userEvent`, replanteados sin fake timers calculando `periodoMes` relativo a "hoy" real vía
      `periodoMesRelativoAHoy`, y en rojo de nuevo por falta de implementación) antes de escribir
      `preseleccionAplicadaRef`; verde después.
- [x] **6b.3** Aviso de coherencia no bloqueante, mismo tono/lugar que
      `validarCupoFacturacion`/`validarMontoAutorizado`.
      **Hecho 2026-08-23**: componente nuevo `AlertaCoherenciaPeriodo.tsx` (mismo molde que
      `AlertaMontoAutorizado.tsx`: `role="status"`, mismas clases `chipColors`, 3 tonos —
      `warning`/`no-coincide`, `secondary`/`legacy-sin-periodo`, `success`/`coincide`). Reusa
      `validarCoherenciaPeriodo` de `periodoAutorizacion.ts` (Fase 3) sin reimplementar la
      comparación. `FacturaForm.tsx:260-266` (`resultadoCoherenciaPeriodo`, `null` sin autorización
      elegida), `:518-525` (render en la columna derecha del Paso 3, junto a `AlertaCupo`/
      `AlertaMontoAutorizado`, mismo lugar). **NO bloquea**: no toca `handleSubmit`/
      `validateFacturaForm` — Guardar sigue habilitado con cualquier resultado (test dedicado
      "no coincide... Guardar sigue habilitado"). **RED→GREEN**: 3 tests nuevos (no-coincide,
      legacy-sin-periodo, coincide) corridos en rojo antes de crear el componente/wiring, verde
      después.
- [x] **6b.4** `montoConsumido.ts`: **cero cambios de código**; reescribir la cabecera `:4-9` con las
      dos semánticas (D8) + 2 tests de regresión nominados (legacy anual / mensual).
      **Hecho 2026-08-23**: cabecera reescrita en `montoConsumido.ts:4-22` (documenta las dos
      semánticas que conviven — legacy `periodoMes === undefined` sigue siendo tope ANUAL, filas con
      `periodoMes` pasan a tope MENSUAL sin tocar el código — cita firma G4/tasks.md 0.2 y aclara que
      es una decisión provisoria de la usuaria, no de Andrea). **Cero cambios en el cuerpo de la
      función** (`montoConsumido(...)` línea 23 en adelante, idéntico al original, verificado por
      diff). 2 tests nominados agregados en `montoConsumido.test.ts:81-102`: **"fila legacy: sigue
      sumando el año (autorización sin periodoMes, modelo 1:1 anterior)"** y **"fila mensual: suma
      solo su mes (autorización con periodoMes, modelo 1:N de este change)"** — ambos pasan sin
      ningún cambio de implementación (confirma que el mismo filtro `autorizacionId + anio` ya
      resuelve las dos semánticas).
- [x] **6b.5** Confirmar por test que `useEmisionFactura.resolverCupoAutorizado` (`:60-68`) **no
      cambió** y que deriva el cupo del mes elegido.
      **Hecho 2026-08-23**: `useEmisionFactura.ts` sin modificar en esta fase (confirmado por diff,
      cero cambios). Test nuevo en `useEmisionFactura.test.ts:169-198` ("con dos autorizaciones
      mensuales del mismo presupuesto (una por mes): deriva el cupo del mes ELEGIDO, no el del otro
      mes") — dos filas `Autorizacion` con `periodoMes` distinto (`2026-03-01`/`2026-04-01`) y cupos
      distintos, confirma que `resolverCupoAutorizado(pacienteId, autorizacionId)` sigue resolviendo
      por el `autorizacionId` explícito recibido (patrón ya establecido por `facturacion-seleccion-
      autorizacion` D6, sin iterar/adivinar), nunca el cupo de la otra fila del mismo presupuesto.
      Pasa sin ningún cambio de implementación.
- [x] **6b.6** `AvisoModeloDatos` en `FacturaForm` mientras convivan filas de los dos modelos.
      **Hecho 2026-08-23**: `FacturaForm.tsx:268-274` (`convivenModelosDeAutorizacion`: `true` solo
      cuando la lista de autorizaciones PENDIENTES del paciente elegido tiene al menos una fila SIN
      `periodoMes` (legacy) Y al menos una CON `periodoMes` (mensual) simultáneamente), `:421-427`
      (render condicional del `AvisoModeloDatos` — mismo componente del design system que el resto
      del proyecto, D9/`AutorizacionForm.tsx` 6a.6, ningún cartel hand-rolled nuevo) dentro del
      Paso 2, antes del `<Select>` de Autorización. **RED→GREEN**: 2 tests nuevos (describe
      "AvisoModeloDatos por convivencia de modelos" — muestra el aviso con convivencia real / NO lo
      muestra cuando todas las autorizaciones pendientes son legacy) corridos en rojo primero
      (el positivo fallaba por ausencia del cartel; el negativo ya pasaba trivialmente sin
      implementación, confirmado explícitamente antes de dar la tarea por resuelta), verde después
      de la implementación.

      **Verificación conjunta de toda la Fase 6b**: `NODE_OPTIONS=--no-experimental-webstorage npx
      vitest run src/features/facturacion/FacturaForm.test.tsx
      src/shared/lib/facturacion/montoConsumido.test.ts
      src/features/facturacion/useEmisionFactura.test.ts` → **53/53 passed** (42 baseline + 11
      nuevos: 8 en `FacturaForm.test.tsx`, 2 en `montoConsumido.test.ts`, 1 en
      `useEmisionFactura.test.ts`), cero regresiones. Barrido más amplio: `npx vitest run
      src/features/facturacion src/shared/lib/facturacion src/shared/lib/presupuestos
      src/features/presupuestos` → **912/912 passed** (73 archivos). `cd frontend && npx tsc -b
      --noEmit` → limpio. `npx oxlint` sobre los 3 archivos de producción tocados
      (`FacturaForm.tsx`, `AlertaCoherenciaPeriodo.tsx`, `montoConsumido.ts`) → limpio (exit 0).
      Archivo nuevo: `frontend/src/features/facturacion/AlertaCoherenciaPeriodo.tsx` (componente,
      mismo molde que `AlertaMontoAutorizado.tsx`). Ningún archivo de la lista "no tocar" (Fase 3/4,
      migraciones, `AutorizacionForm.tsx`, `PresupuestoDetail.tsx`) fue editado.

## Fase 7 — Documentación

- [ ] **7.1** `knowledge-base/04_modelo_de_datos.md` §Discrepancias: `periodo_mes` (ausente del docx) +
      el cambio de cardinalidad.
- [ ] **7.2** `knowledge-base/05_reglas_de_negocio.md`: nota en RN-PA-01 (OQ-1 abierta) y RN-PA-03
      (el cupo deja de ser "recurrente" y pasa a ser "de ese mes").
- [ ] **7.3** `CHANGES.md` §C-06: nueva reapertura con ⚠️, citando `facturacion-seleccion-autorizacion/design.md:82,124`
      como decisiones que este change **levanta**.
- [ ] **7.4** Deltas de spec de las 3 capabilities nuevas + 6 modificadas (`proposal.md` §Capabilities).
      ⚠️ **No escribir escenarios que dependan de OQ-1/OQ-2** — se especifica lo decidido, no lo abierto.

## Fase 8 — Verificación

- [ ] **8.1** `cd frontend && npx tsc -b --noEmit` limpio. Cero `any` (grep de control).
- [ ] **8.2** `cd frontend && npx vitest run` — sin regresiones nuevas respecto del baseline.
- [ ] **8.3** `cd frontend && npx oxlint`.
- [ ] **8.4** **Verificación manual con la usuaria** (no la hace el agente): 3 meses con montos
      distintos y 3 adjuntos distintos; mes duplicado rechazado con mensaje claro; facturar mayo contra
      la autorización de marzo avisa y **no** bloquea; una autorización legacy sigue facturable.
- [ ] **8.5** Recorrer los Success Criteria de `proposal.md` uno por uno, marcando **solo** los que
      tengan evidencia (test nombrado o confirmación de la usuaria).
