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
- [ ] **0.2** ⚠️ **Firma G4 (D8)** — confirmar por escrito que `montoAutorizado` pasa a ser el tope
      **del mes** para filas con `periodoMes`, conservando la semántica **anual** para las filas
      legacy, y que las dos semánticas conviven en `montoConsumido` sin refactor.
      **Sin esta firma no se escribe una línea de la Fase 6b.**
- [ ] **0.3** ⚠️ **Firma G5 (D7)** — confirmar la política "preseleccionar el mes coincidente +
      advertir sin bloquear", explícitamente **en contra** de auto-resolver (rompería D6 de
      `facturacion-seleccion-autorizacion`) y de bloquear (rompería RN-PA-02).
      **Sin esta firma no se escribe una línea de la Fase 6b.**
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

- [ ] **1.1** `supabase/migrations/<ts>_autorizacion_periodo_mes.sql`: `ADD COLUMN periodo_mes DATE`
      con `CHECK (periodo_mes IS NULL OR EXTRACT(DAY FROM periodo_mes) = 1)` (D1).
- [ ] **1.2** Mismo archivo: `CREATE UNIQUE INDEX … (presupuesto_id, periodo_mes) WHERE periodo_mes IS NOT NULL`.
      Justificar en la cabecera por qué es **parcial** (D1) y por qué **no** hay `DROP CONSTRAINT`
      (nunca hubo `UNIQUE`).
- [ ] **1.3** Cabecera del `.sql`: sin RLS nueva (no hay tabla nueva, las policies de `presupuestos`
      ya cubren la columna), sin backfill (D3), rollback = `DROP INDEX` + `DROP COLUMN`.
- [ ] **1.4** `supabase/migrations/<ts>_presupuesto_rpc_autorizacion_primer_mes.sql`:
      `CREATE OR REPLACE` de `crear_presupuesto_completo` y `crear_presupuestos_lote` agregando
      `periodo_mes` al `INSERT` de autorización vía
      `date_trunc('month', NULLIF(… ->> 'vigencia_desde','')::date)::date` (D4).
      ⚠️ Conservar **byte por byte**: firma, `SECURITY INVOKER`, `SET search_path = ''`,
      códigos `45401`-`45404`, el bloque ⚠️⚠️ `NUNCA SECURITY DEFINER`.
- [ ] **1.5** Actualizar el test de texto de fuente sobre las RPC (`presupuestoMigrations.test.ts`).
- [ ] **1.6** ⚠️ **El agente NO ejecuta `supabase db push`.** La usuaria aplica; se registra evidencia
      post-aplicación acá.

## Fase 2 — Edge Function `autorizaciones`

- [ ] **2.1** `periodo_mes` en `AutorizacionRow` / `AutorizacionInput` / `toApi` / `toDb`
      (patrón `!== undefined` = partial update, igual que el resto).
- [ ] **2.2** `GET ?presupuestoId=` → lista ordenada por `periodo_mes NULLS FIRST`; **`.maybeSingle()`
      fuera**; `200 []` en lugar de `404` (D5). Reemplazar el comentario `:133-136` que dejaba el
      punto marcado, citando este change.
- [ ] **2.3** Filtro opcional `&periodoMes=`.
- [ ] **2.4** Actualizar la cabecera del archivo: la relación ya no es `1---1` (`:8-9`).

## Fase 3 — Contrato y funciones puras (TDD estricto)

- [ ] **3.1** `Autorizacion.periodoMes?: string` en `shared/types/presupuesto.ts`; reescribir el
      comentario `:189` (1---1 → 1:N) y documentar `NULL` = modelo anterior (D3).
- [ ] **3.2** **RED/GREEN/TRIANGULATE** `periodoAutorizacion.ts` → `normalizarPeriodoMes`
      (`'2026-03'`, `'2026-03-15'`, `'2026-03-01'` → `'2026-03-01'`; entrada inválida).
- [ ] **3.3** Ídem `ordinalMes` — casos: orden normal, **mes salteado**, **carga fuera de orden**
      (RN-PA-02), lista con legacy `undefined`.
- [ ] **3.4** Ídem `etiquetaPeriodoMes` — incluye el caso `undefined → 'Sin mes cargado'` (nunca un mes
      inventado).
- [ ] **3.5** Ídem `coincidePeriodoFacturado` / `validarCoherenciaPeriodo` (D7) — coincide, no coincide,
      autorización legacy sin período.
- [ ] **3.6** `autorizacionMapping.ts`: `periodoMes` en las 3 direcciones + round-trip test.

## Fase 4 — Repositories

- [ ] **4.1** `AutorizacionRepository`: `getByPresupuestoId` → `listByPresupuestoId(): Promise<Autorizacion[]>` (D5).
- [ ] **4.2** `SupabaseAutorizacionRepository` (`:246-259`): plural; **retirar** el `esErrorNotFound`
      de esa consulta; `&periodoMes=` opcional.
- [ ] **4.3** `edgeFunctionErrors.ts`: actualizar `:122,143` (el 404 ya no aplica a esta consulta) y
      **mapear `23505` del índice único** a *"Ya existe una autorización para ese mes en este presupuesto."*
- [ ] **4.4** `mockAutorizacionRepository.ts` (`:78`): plural + **bump de `SCHEMA_VERSION`** (regla del
      proyecto: cambió la forma persistida) + fixtures con 2-3 meses y al menos una fila legacy.
- [ ] **4.5** Safety Net + actualización de los tests de repository existentes
      (`SupabaseAutorizacionRepository.test.ts:280-315`, `mockAutorizacionRepository.test.ts:71-85`).

## Fase 5 — Selector de facturación (D6)

- [ ] **5.1** Safety Net: correr `autorizacionesPendientes.test.ts` + `FacturaForm.test.tsx` y anotar
      el baseline.
- [ ] **5.2** `autorizacionesPendientes.ts`: `flatMap` sobre `listByPresupuestoId`, filtro
      `autorizada|judicializada` **por mes**, orden por `periodoMes` (legacy primero).
- [ ] **5.3** `etiquetaAutorizacion.ts`: el período entra en la etiqueta.
      **Test obligatorio**: 3 meses del mismo presupuesto y la misma prestación producen
      **3 etiquetas distintas** (si no, son 3 opciones idénticas en el `<select>`).

## Fase 6a — UI de presupuestos (D10/D11)

- [ ] **6a.1** Safety Net: `PresupuestoDetail.test.tsx` (baseline), `AutorizacionForm.test.tsx`.
- [ ] **6a.2** `PresupuestoDetail.tsx:103-141`: estado `autorizacion: Autorizacion | null` →
      `autorizaciones: Autorizacion[]`; ajustar la lógica de `autorizacionEditing` (`:130`).
- [ ] **6a.3** `PresupuestoDetail.tsx:249-320`: card única → `Table` de meses, fila clickeable,
      acción "Agregar mes". Cubrir los 5 estados de D10.
- [ ] **6a.4** `AutorizacionForm.tsx`: `<input type="month">` + rótulo "Mes N" derivado + prefill del
      primer mes no cargado; editable en edición con re-chequeo de unicidad.
- [ ] **6a.5** Mensaje de dominio al intentar cargar un mes duplicado (viene de 4.3).
- [ ] **6a.6** `AvisoModeloDatos` con OQ-1/OQ-2 en `AutorizacionForm` y `PresupuestoDetail`.
- [ ] **6a.7** Test: reemplazar el adjunto del mes 2 **no toca** el del mes 1 (verificar D12, no
      asumirlo).

## Fase 6b — Facturación (D7/D8) — ⚠️ BLOQUEADA POR 0.2 y 0.3

- [ ] **6b.1** ⚠️ Confirmar que 0.2 y 0.3 están firmadas. Si no, **detenerse y reportar**.
- [ ] **6b.2** `FacturaForm.tsx` Paso 2 (`:326-381`): preselección de la autorización cuyo `periodoMes`
      coincide con `(mesFacturado, anioFacturado)` **solo si hay exactamente una**; siempre cambiable.
- [ ] **6b.3** Aviso de coherencia no bloqueante, mismo tono/lugar que
      `validarCupoFacturacion`/`validarMontoAutorizado`.
- [ ] **6b.4** `montoConsumido.ts`: **cero cambios de código**; reescribir la cabecera `:4-9` con las
      dos semánticas (D8) + 2 tests de regresión nominados (legacy anual / mensual).
- [ ] **6b.5** Confirmar por test que `useEmisionFactura.resolverCupoAutorizado` (`:60-68`) **no
      cambió** y que deriva el cupo del mes elegido.
- [ ] **6b.6** `AvisoModeloDatos` en `FacturaForm` mientras convivan filas de los dos modelos.

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
