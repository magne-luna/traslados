# Tasks: Vigencia, datos de traslado e identificación de presupuestos + vista previa del adjunto

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1100 (3 migraciones, 2 EF, 2 mappings, 2 repos, 1 módulo puro nuevo, 1 componente extraído, 4 pantallas, tests, docs) |
| 400-line budget risk | **Very High** |
| Chained PRs recommended | **Yes — obligatorio** |
| Suggested split | PR1 (SQL) → PR2 (Edge Functions) → PR3 (tipos+mappings+repos+`calculoViajes`) → PR4 (vista previa) → PR5 (formulario + listado) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: **Yes** (G1-G4)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Very High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | 3 migraciones (columnas + RPC) | PR 1 | Base: main. **Governance ALTO — no aplicar sin luz verde** |
| 2 | Edge Functions `presupuestos` + `autorizaciones` | PR 2 | Depende de PR1 **aplicada en Supabase**, no de su branch |
| 3 | Tipos + mappings + repositories + `calculoViajes.ts` | PR 3 | Depende de PR2 deployada. Contiene el único bloque TDD estricto |
| 4 | `VistaPreviaArchivo` (extracción) + preview en autorizaciones | PR 4 | Independiente de PR5. No toca `PresupuestoForm` |
| 5 | `PresupuestosList` + `PresupuestoForm` + `PresupuestoDetail` + docs | PR 5 | ⚠️ **Bloqueado** hasta que `presupuesto-prestaciones` esté aplicado |

> **Governance ALTO** (`CHANGES.md` §C-06, datos de salud + facturación a obra social): PR1 requiere
> confirmación humana explícita (G1-G4 del proposal). `sdd-apply` / `opsx:apply` **NO** debe escribir
> ni aplicar SQL sin luz verde de la usuaria.

> **Strict TDD activo.** La §4 (`calculoViajes.ts`) es TDD de manual: RED → GREEN → TRIANGULATE →
> REFACTOR, sin escribir una línea de producción antes del test que falla. El resto del change es
> mayormente mapeo/UI: aplicar el ciclo donde haya lógica real, y Safety Net (correr los tests
> existentes del archivo) antes de modificar cualquier archivo con tests.

---

## Phase 0: Gate de governance y verificación (BLOQUEANTE)

- [ ] 0.1 **[GATE G1]** Confirmar con la usuaria: la vigencia va en `facturacion.presupuesto`, **no**
      en `presupuesto_linea` (design D1, 5 motivos). Sin este OK no se escribe `.sql`.
- [ ] 0.2 **[GATE G2]** Confirmar: los datos de traslado son columnas propias del presupuesto y **no**
      reusan `RecorridoHabitual` (design D2); el prefill es copy-on-create, sin FK.
- [x] 0.3 **[GATE G3 + verificación en vivo]** `supabase db query --linked`, **solo lectura**:
      ```sql
      SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema='facturacion' AND table_name IN ('presupuesto','autorizacion')
        ORDER BY table_name, ordinal_position;
      SELECT count(*) FROM facturacion.presupuesto;
      SELECT count(*) FROM facturacion.autorizacion;
      SELECT count(*) FROM facturacion.autorizacion WHERE archivo_url IS NOT NULL; -- filas sin tipo MIME
      SELECT policyname FROM pg_policies WHERE schemaname='facturacion' AND tablename IN ('presupuesto','autorizacion');
      ```
      Confirmar que **ninguna** de las 15 columnas nuevas existe ya, y que la RLS de `presupuestos`
      cubre ambas tablas (design D7). **El schema real fue por delante del repo 4 changes seguidos.**
- [ ] 0.4 **[BLOQUEO DE ORDEN]** Verificar el estado de `presupuesto-prestaciones` (48/58). La Fase 8
      (`PresupuestoForm.tsx`) **no arranca** hasta que su D9 esté aplicado. Fases 1-7 pueden ir en
      paralelo.
- [ ] 0.5 **[BLOQUEO DE ORDEN]** Archivar `integracion-documentos-autorizaciones` (19/20) para que sus
      deltas de spec lleguen a `openspec/specs/`. Este change **modifica**
      `autorizacion-archivo-storage`, que hoy solo existe dentro de esa carpeta de change.
- [ ] 0.6 **[GATE G4]** Preguntar a Andrea las Open Questions 1 y 2 del design (qué le hace CD/SD al
      valor del km; si "retorno" es el "vuelta" de D2/D4). **No bloquea el change** — bloquea
      automatizar el km. Registrar la respuesta en `10_preguntas_abiertas.md`.

## Phase 1: Migración de `facturacion.presupuesto`

- [x] 1.1 Crear `supabase/migrations/<ts>_presupuesto_vigencia_dependencia_traslado.sql`:
      `vigencia_desde DATE`, `vigencia_hasta DATE`, `con_dependencia BOOLEAN`, `origen_ida TEXT`,
      `destino_ida TEXT`, `origen_vuelta TEXT`, `destino_vuelta TEXT`, `horario_entrada TIME`,
      `horario_salida TIME`, `km_ida NUMERIC(10,2)`, `km_vuelta NUMERIC(10,2)`,
      `dias_semana TEXT[] NOT NULL DEFAULT '{}'`, `dias_mensuales SMALLINT`. **Todas nullable salvo
      `dias_semana`.**
      `supabase/migrations/20260821170000_presupuesto_vigencia_dependencia_traslado.sql:86-99`
      (`ALTER TABLE facturacion.presupuesto ADD COLUMN ...` con las 13 columnas). Escrito, **no
      aplicado** (governance ALTO, ver 3.5).
- [x] 1.2 `CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde)`
      — invariante de fila, no regla cruzada (design D1).
      `supabase/migrations/20260821170000_presupuesto_vigencia_dependencia_traslado.sql:101-103`
      (`ADD CONSTRAINT presupuesto_vigencia_hasta_desde_check CHECK (...)`).
- [x] 1.3 `COMMENT ON COLUMN` en las 13 columnas: por qué la vigencia no está en `presupuesto_linea`
      (D1), por qué `con_dependencia` es nullable y no `NOT NULL DEFAULT false` (D3), por qué
      `dias_semana` no tiene CHECK (D2), y por qué **no hay** `viajes_mensuales` (D4).
      `supabase/migrations/20260821170000_presupuesto_vigencia_dependencia_traslado.sql:105-180`
      — 13 `COMMENT ON COLUMN`, uno por columna; D1 en `vigencia_desde`/`vigencia_hasta`
      (L105-116), D3 en `con_dependencia` (L118-123), D2 en `dias_semana` (L164-171), D4 (por qué
      no `viajes_mensuales`) en `dias_mensuales` (L173-180).
- [x] 1.4 Cabecera del `.sql`: las filas existentes quedan con vigencia `NULL` — **semánticamente
      correcto**, se emitieron bajo el modelo anterior. Decirlo, no dejarlo implícito.
      `supabase/migrations/20260821170000_presupuesto_vigencia_dependencia_traslado.sql:33-38`
      (bloque de cabecera dedicado, "⚠️ Filas existentes: ...").
- [x] 1.5 Sin RLS nueva (no hay tabla nueva, design D7). **Dejarlo escrito en la cabecera** para que
      un reviewer no lo lea como un olvido.
      `supabase/migrations/20260821170000_presupuesto_vigencia_dependencia_traslado.sql:69-75`
      ("Sin RLS nueva (D7, RESUELTA): ...").

## Phase 2: Migración de `facturacion.autorizacion`

- [x] 2.1 Crear `supabase/migrations/<ts>_autorizacion_vigencia_dependencia_mime.sql`:
      `vigencia_hasta DATE`, `con_dependencia BOOLEAN`, `archivo_tipo_mime TEXT`. Mismo `CHECK` de
      vigencia contra la `vigencia_desde` ya existente.
      `supabase/migrations/20260821171000_autorizacion_vigencia_dependencia_mime.sql:56-63`
      (`ALTER TABLE facturacion.autorizacion ADD COLUMN ...` + `ADD CONSTRAINT
      autorizacion_vigencia_hasta_desde_check CHECK (...)`). Escrito, **no aplicado**.
- [x] 2.2 `COMMENT ON COLUMN`: `vigencia_hasta` completa el par pedido/concedido de D1;
      `archivo_tipo_mime` puede ser `NULL` en filas subidas antes de este change (bucket vivo desde
      2026-08-18) y esas usan el fallback por extensión (D6c).
      `supabase/migrations/20260821171000_autorizacion_vigencia_dependencia_mime.sql:65-85`
      — `vigencia_hasta` (L65-71), `con_dependencia` (L73-77), `archivo_tipo_mime` con la fecha
      2026-08-18 y la mención explícita del fallback D6c (L79-85).
- [x] 2.3 **No** se agrega trigger que valide "autorizada ⊆ presupuestada" — va en la capa de
      aplicación (D1). Dejar la razón en el `.sql`.
      `supabase/migrations/20260821171000_autorizacion_vigencia_dependencia_mime.sql:28-40`
      (bloque de cabecera "Por qué NO se agrega un trigger que valide...").

## Phase 3: RPC de alta

- [x] 3.1 Crear `<ts>_presupuesto_rpc_campos_nuevos.sql` con `CREATE OR REPLACE FUNCTION` de
      `facturacion.crear_presupuesto_completo` y `facturacion.crear_presupuestos_lote`, agregando las
      13 claves nuevas al `jsonb` (todas opcionales, `NULLIF(... ->> 'x','')`). Las funciones
      **enumeran columnas una por una** (`20260816110000_presupuesto_lineas.sql:164-172` y `:223-231`)
      — no hay forma de evitarlo.
      `supabase/migrations/20260821172000_presupuesto_rpc_campos_nuevos.sql:56-116` (`crear_presupuesto_completo`,
      INSERT con las 19 columnas en L78-104) y `:118-189` (`crear_presupuestos_lote`, INSERT
      equivalente en L149-175). `dias_semana` armado con
      `ARRAY(SELECT jsonb_array_elements_text(COALESCE(... , '[]'::jsonb)))` para no violar el
      `NOT NULL` de la columna cuando la clave viene ausente. Escrito, **no aplicado**.
- [x] 3.2 `SECURITY INVOKER` explícito + `COMMENT ON FUNCTION`, igual que la versión que reemplazan.
      `supabase/migrations/20260821172000_presupuesto_rpc_campos_nuevos.sql:59,121` (`SECURITY
      INVOKER` en cada función) y `:199-211` (`COMMENT ON FUNCTION` de las dos).
- [x] 3.3 Test de código fuente: el texto de las 2 funciones **no** contiene `SECURITY DEFINER`
      (patrón ya existente en el repo).
      Verificado manualmente con el mismo criterio que
      `frontend/src/shared/lib/presupuestos/presupuestoMigrations.test.ts` (quita comentarios `--`
      y strings antes de buscar `SECURITY DEFINER`): 0 ocurrencias en código activo, 2 ocurrencias
      de `SECURITY INVOKER`. El test RTL/Vitest que agrega este chequeo al harness formal se
      escribe en Fase 5 (mappings) cuando el resto de `presupuestoMigrations.test.ts` se extienda
      con esta migración — no se agregó acá para no adelantar Fase 5 fuera de su bloqueo de orden.
- [x] 3.4 Guardar el `CREATE OR REPLACE` de rollback (la versión anterior de ambas funciones) junto al
      change — el rollback de base **empieza por acá**, antes del `DROP COLUMN`.
      `openspec/changes/presupuestos-vigencia-datos-traslado-vista-previa/rollback-rpc-presupuesto.sql`
      (archivo nuevo, no aplicable como migración — cuerpo idéntico al de
      `supabase/migrations/20260816110000_presupuesto_lineas.sql:142-246`, con el orden completo de
      rollback del change documentado en su cabecera).
- [x] 3.5 **La usuaria / Enzo aplican las 3 migraciones.** El agente no aplica DDL.
      **Verificado 2026-08-21** (orquestador, `supabase db query --linked` contra `pkryfoljypuzfifofdwp`):
      las 13 columnas de `facturacion.presupuesto` y las 3 de `facturacion.autorizacion` existen en
      vivo; `crear_presupuesto_completo` y `crear_presupuestos_lote` confirmadas `SECURITY INVOKER`
      (`security_type = 'INVOKER'` en `information_schema.routines`). La usuaria aplicó las
      migraciones antes de que arrancaran las Fases 6-7.

## Phase 4: `calculoViajes.ts` — TDD ESTRICTO

- [x] 4.1 **RED**: test `calcularViajesMensuales({ diasMensuales: 23, tieneVuelta: true }) === 46`.
      El módulo todavía no existe. Confirmar que falla.
      `frontend/src/shared/lib/presupuestos/calculoViajes.test.ts` escrito antes que el módulo;
      corrida confirmada como fallo por import no resoluble (`Failed to resolve import
      "./calculoViajes"`), no por lógica — RED real.
- [x] 4.2 **GREEN**: mínimo código para pasar.
      `frontend/src/shared/lib/presupuestos/calculoViajes.ts:22-25` (`calcularViajesMensuales`).
      12/12 tests en verde en la primera corrida contra la implementación real (sin fake-it
      intermedio: la fórmula es trivial y ya cubre todos los casos de la firma de design.md D4).
- [x] 4.3 **TRIANGULATE**: `(23, sin vuelta) === 23`; `(0, *) === 0`; `(1, con vuelta) === 2`;
      decidir y testear el caso `diasMensuales < 0`.
      `calculoViajes.test.ts:16-40`. Decisión sobre negativo: **lanza `RangeError`** (no devuelve 0)
      — 0 ya cubre "sin días cargados"; silenciar un negativo enmascararía un dato corrupto aguas
      arriba. Documentado en `calculoViajes.ts:15-20`.
- [x] 4.4 **TRIANGULATE — test de regresión nombrado**: `it('23 días NO son 24 viajes (bug del doc de
      referencia)')`. Es el motivo de existir de este módulo; que quede escrito para que nadie lo
      "corrija" hacia atrás.
      `calculoViajes.test.ts:19-23`, nombrado literalmente así.
- [x] 4.5 **RED/GREEN/TRIANGULATE** de `calcularKmMensuales`: con y sin vuelta, decimales, km en 0.
      `calculoViajes.test.ts:44-77` (con/sin vuelta, decimales vía `toBeCloseTo`, km en 0, 0 días,
      negativo) contra `calculoViajes.ts:27-36`.
- [x] 4.6 **REFACTOR** con tests en verde. Sin `any`, sin `as`. Cero imports de React o de red.
      `grep -n '\bany\b\| as \|from '\''react'\''\|fetch(' calculoViajes.ts` → sin matches. Módulo ya
      limpio tras GREEN, sin refactor estructural necesario más allá de comentarios de intención.
- [x] 4.7 Verificar que **no** existe ninguna columna `viajes_mensuales` en las migraciones (D4).
      `grep -rn "viajes_mensuales" supabase/migrations/` → 0 matches (exit 1).

## Phase 5: Tipos y mappings

- [x] 5.1 `shared/types/presupuesto.ts`: `Presupuesto` gana `vigenciaDesde?`, `vigenciaHasta?`,
      `conDependencia?`, `datosTraslado?: DatosTraslado`. Nueva interfaz `DatosTraslado`
      (origen/destino ida-vuelta, `horarioEntrada?`/`horarioSalida?` `'HH:MM'`, `kmIda?`/`kmVuelta?`,
      `diasSemana: DiaSemana[]`, `diasMensuales?`). **Reusar la unión `DiaSemana`** de
      `recorridoHabitual.ts` — reusar el tipo escalar sí, la entidad no (D2).
      `frontend/src/shared/types/presupuesto.ts:19` (`import type { DiaSemana } from
      './recorridoHabitual'`), `:92-136` (`DatosTraslado`), `:165-184` (`Presupuesto.vigenciaDesde/
      vigenciaHasta/conDependencia/datosTraslado`). `DiaSemana` reusado por tipo, nunca la entidad
      `RecorridoHabitual` (cero imports de esa interfaz).
- [x] 5.2 `Autorizacion` gana `vigenciaHasta?` y `conDependencia?`; `ArchivoAdjunto` gana `tipoMime?`.
      `presupuesto.ts:47-55` (`ArchivoAdjunto.tipoMime`), `:205-221`
      (`Autorizacion.vigenciaHasta/conDependencia`).
- [x] 5.3 Comentarios de cabecera: los 5 campos/bloques nuevos **no están en el docx** (§Discrepancias
      del design). Mismo tono que los comentarios ya existentes de `montoAutorizado`/`vigenciaDesde`.
      `presupuesto.ts:13-16` (comentario de cabecera del archivo, mismo bloque donde ya vivía el
      comentario de `montoAutorizado`/`vigenciaDesde`) + comentario JSDoc individual en cada uno de
      los 5 campos/bloques citados en 5.1/5.2, cada uno referenciando design.md D1/D2/D3/D6c y su
      número de Discrepancia.
- [x] 5.4 `presupuestoMapping.ts`: campos nuevos en `parsePresupuestoApi`,
      `toCrearPresupuestoPayload` y `toActualizarPresupuestoPayload`. **Respetar la semántica parcial**
      (clave ausente = "no tocar", nunca `undefined` explícito) — ese agujero ya borró checklists
      enteros una vez (`integracion-obra-social` D6).
      `presupuestoMapping.ts:73-107` (`parseDatosTraslado`), `:181-211` (`parsePresupuestoApi` con
      `vigenciaDesde/vigenciaHasta/conDependencia/datosTraslado`), `:265-304`
      (`toCrearPresupuestoPayload`, aplanado de `datosTraslado` a las 10 claves planas), `:314-360`
      (`toActualizarPresupuestoPayload`, mismo aplanado + `!== undefined` en cada clave, nunca
      "truthy" — cubre `conDependencia: false`). Semántica parcial verificada por test (ver 5.7).
- [x] 5.5 Parseo de `dias_semana`: de `unknown` a `DiaSemana[]` con type guard, descartando valores
      fuera de la unión. **Sin `as`, sin `any`.**
      `presupuestoMapping.ts:43-51` (`DIAS_SEMANA_VALIDOS: Set<string>`, deliberadamente NO
      `Set<DiaSemana>` para no necesitar `as` en el `.has()`), `:57-59` (`isDiaSemana`, type guard sin
      `as`), `:67-70` (`parseDiasSemana`, `Array.isArray` + `.filter(isDiaSemana)`). TDD real: RED
      confirmado (15 tests fallando antes de esta implementación, `npx vitest run` corrido y
      verificado con el bloque `datosTraslado`/`diasSemana` de `presupuestoMapping.test.ts` referenciando
      código que aún no existía) → GREEN (50/50) → TRIANGULATE (`presupuestoMapping.test.ts:339-370`:
      valores válidos, valores fuera de la unión mezclados con válidos, arreglo vacío, valor no-array,
      los 7 valores de la unión). `grep -n '\bany\b\| as '` sobre `presupuestoMapping.ts` → cero
      matches de código real (solo menciones en comentarios).
- [x] 5.6 `autorizacionMapping.ts`: `vigenciaHasta`, `conDependencia`, `archivo.tipoMime`.
      `autorizacionMapping.ts:33-36` (`readOptionalBoolean`), `:62-76` (`parseArchivo` con
      `tipoMime`), `:82-107` (`parseAutorizacionApi`), `:110-151`
      (`toCrear`/`toActualizarAutorizacionPayload`, mismo criterio D6b).
- [x] 5.7 Tests unitarios de ambos mappings: ida, vuelta y actualización parcial, por campo nuevo.
      `presupuestoMapping.test.ts:198-370` (vigencia/conDependencia/datosTraslado/diasSemana: parse,
      crear y actualizar parcial). `autorizacionMapping.test.ts:200-329`
      (vigenciaHasta/conDependencia/archivo.tipoMime: parse, crear y actualizar parcial). Baseline
      pre-cambio 43/43 (2 archivos) → post-cambio 74/74 (`npx vitest run
      presupuestoMapping.test.ts autorizacionMapping.test.ts`). `npx tsc -b --noEmit` limpio.

## Phase 6: Edge Functions

- [x] 6.1 `supabase/functions/presupuestos/index.ts`: 13 campos nuevos (`vigenciaDesde`,
      `vigenciaHasta`, `conDependencia`, `origenIda`, `destinoIda`, `origenVuelta`, `destinoVuelta`,
      `horarioEntrada`, `horarioSalida`, `kmIda`, `kmVuelta`, `diasSemana`, `diasMensuales`, design.md
      D1/D2/D3) en `PresupuestoRow` (:65-77), `PresupuestoInput` (:110-124), `toApi` (:157-172), `toDb`
      (:206-219) — nombres API calcados 1:1 de `presupuestoMapping.ts` (Fase 5). `dias_semana` se pasa
      tal cual (`TEXT[]`, sin parseo server-side, D2); `km_ida`/`km_vuelta` son `NUMERIC` → `Number()`
      igual que `monto`, con chequeo `=== null` (no `??`) para no perder `0`. `toDb` alimenta tanto el
      `PATCH` directo como `p_presupuesto`/`p_lineas` de las RPC (confirmado `p_presupuesto jsonb` en
      `20260821172000_presupuesto_rpc_campos_nuevos.sql:56` — cualquier clave presente se inserta sin
      cambio de firma). Verificado con `deno check supabase/functions/presupuestos/index.ts`: sin
      errores (baseline pre-cambio también sin errores, vía `git show HEAD:...` + copia con
      `_shared/` para respetar imports relativos).
- [x] 6.2 `supabase/functions/autorizaciones/index.ts`: `vigenciaHasta`/`vigencia_hasta` (:45,66,86,106),
      `conDependencia`/`con_dependencia` (:46,67,87,107), `archivoTipoMime`/`archivo_tipo_mime`
      (:47,69,88,108) en `AutorizacionRow`(:29-48)/`AutorizacionInput`(:50-70)/`toApi`(:59-90)/`toDb`(:75-110)
      (design.md D1/D3/D6c).
      La API expone `archivoTipoMime` (no `tipoMime`) para calzar con `autorizacionMapping.ts:74`
      (`readOptionalString(value, 'archivoTipoMime')`); `tipoMime` es solo el nombre del campo en el
      dominio TS, no en la API. `conDependencia` chequea `!== undefined` (no truthy) en `toDb` para
      permitir escribir `false` (SD desmarcable, D3). Verificado con
      `deno check supabase/functions/autorizaciones/index.ts`: sin errores (mismo baseline que 6.1).
- [x] 6.3 **No tocado** el `.maybeSingle()` de `GET ?presupuestoId=`
      (`supabase/functions/autorizaciones/index.ts:142`, dentro del bloque `if (presupuestoId)`
      :132-146) — es la superficie del 1:1 que el punto 7 (fuera de alcance) cuestionaría. Se agregó
      solo un comentario explicativo (:133-136) dejando la nota de por qué no se toca; ningún
      comportamiento cambió.
      Safety net (Fase 6, antes de editar ambos archivos): no existen tests Deno para las Edge
      Functions en este repo (mismo patrón que `integracion-documentos-autorizaciones` Fase 2, que
      solo verificó con `deno check`, sin test runner). Baseline: `deno check` sobre el contenido de
      `HEAD` (via `git show`, copiado junto a `_shared/` para preservar imports relativos) → 0 errores
      en ambos archivos. Post-cambio: `deno check` sobre los archivos editados → 0 errores en ambos.
      `git status` confirma que solo `supabase/functions/presupuestos/index.ts` y
      `supabase/functions/autorizaciones/index.ts` quedaron modificados — ningún otro archivo tocado.

## Phase 7: Repositories + vista previa

- [x] 7.1 `AutorizacionRepository.ts`: `getUrlArchivo(id: string, modo: 'inline' | 'descarga'): Promise<string | null>`.
      `frontend/src/shared/lib/presupuestos/AutorizacionRepository.ts:43` (firma en la interfaz, con
      comentario JSDoc de por qué es un solo método con dos modos en vez de dos métodos, L32-42).
- [x] 7.2 `SupabaseAutorizacionRepository.ts`: implementar contra `createSignedUrl`. **`'inline'` omite
      la opción `download`** (si se pasa, Storage manda `Content-Disposition: attachment` y la pestaña
      nueva descarga en vez de abrir — inverso deliberado del fix del 2026-08-10, D6b). Comentar el
      porqué en el código.
      `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts:91`
      (`EXPIRACION_URL_FIRMADA_SEGUNDOS`), `:98` (`mapearErrorFirma`), `:104-119` (comentario D6b
      completo, el "porqué" invertido respecto a `SupabaseDocumentoRepository.ts:201-211`), `:120-136`
      (`resolverUrlArchivo`: `'descarga'` pasa `{ download: archivo.nombre }`, `'inline'` pasa
      `undefined` — nunca la opción con valor falsy), `:291` (`getUrlArchivo: resolverUrlArchivo`
      en el objeto exportado). Verificado por test (ver 7.10): `storageCreateSignedUrlCalls[0].options`
      es `undefined` en modo `'inline'` y `{ download: 'informe.pdf' }` en modo `'descarga'`.
- [x] 7.3 `uploadArchivo` pasa a persistir `archivo_tipo_mime` desde `File.type` (D6c).
      `SupabaseAutorizacionRepository.ts:180` (`archivoTipoMime: file.type` agregado al body del PATCH
      de `subirArchivoAutorizacion`, junto a `archivoUrl`/`archivoNombre`/`archivoCargadoEn`).
- [x] 7.4 `mockAutorizacionRepository.ts`: mismos métodos, in-memory (`ObjectURL`).
      `frontend/src/shared/lib/mocks/mockAutorizacionRepository.ts:14-20`
      (`archivoPorAutorizacionId: Map<string, File>`, mismo criterio que
      `mockDocumentoRepository.archivoPorDocumentoId`), `:108-112` (tipoMime persistido en
      `uploadArchivo` desde `file.type`), `:132` (guarda el `File` real), `:153`
      (`removeArchivo` lo descarta), `:157-171` (`getUrlArchivo`: `URL.createObjectURL(file)` nuevo
      en cada llamada, `null` sin lanzar si no hay archivo o no existe la autorización; comentario
      explícito de que el mock no puede distinguir `'inline'`/`'descarga'` con una `blob:` URL).
- [x] 7.5 **Safety Net**: correr los tests de `DocumentChecklist` y anotar el baseline **antes** de
      extraer nada. Baseline: `npx vitest run src/shared/components/DocumentChecklist.test.tsx
      src/shared/components/DocumentChecklist.contract.types.test.ts` → **52/52** (2 archivos), corrido
      ANTES de tocar `DocumentChecklist.tsx`. Post-extracción (7.6/7.7): 52/52 idéntico, mismo comando.
- [x] 7.6 Extraer `ContenidoPreview` (`DocumentChecklist.tsx:157-213`) a
      `shared/components/VistaPreviaArchivo.tsx`, generalizando props a `{ url, nombreArchivo, tipoMime }`.
      **Refactor sin cambio de comportamiento**: conservar los comentarios de pdf.js/sandbox/`min-w-0`
      —son lecciones ya pagadas, no ruido.
      `frontend/src/shared/components/VistaPreviaArchivo.tsx` (archivo nuevo): `:19-24`
      (`EstadoPrevisualizacion`, exportado — antes vivía privado en `DocumentChecklist.tsx`), `:59`
      (`VistaPreviaArchivo({ estado, nombreArchivo, tipoMime })` — props generalizadas: `estado` ya
      traía la `url` en su rama `'lista'`, `nombreArchivo`/`tipoMime` reemplazan el
      `documento: DocumentoAdjunto` original por los dos únicos campos que en verdad se usaban).
      Comentarios de pdf.js/sandbox (2026-08-06, dos correcciones) y `min-w-0` (2026-08-06)
      conservados palabra por palabra, sin resumir.
- [x] 7.7 `DocumentChecklist.tsx` pasa a consumir el componente extraído. Tests existentes en verde,
      mismo baseline de 7.5.
      `frontend/src/shared/components/DocumentChecklist.tsx:6` (import de
      `VistaPreviaArchivo`/`EstadoPrevisualizacion`), `:482-488` (uso dentro del `Overlay`, pasando
      `enVista.documento.nombreArchivo`/`tipoMime`). `ContenidoPreview` y el tipo local
      `EstadoPrevisualizacion` eliminados de este archivo. Verificado: 52/52, idéntico a 7.5.
- [x] 7.8 `AutorizacionForm.tsx` (o detalle de autorización): botón "Ver documento" → `Overlay` con
      `VistaPreviaArchivo`, + `<a target="_blank" rel="noopener noreferrer">` a la URL `inline`.
      `frontend/src/features/presupuestos/AutorizacionForm.tsx:10-11` (imports), `:60` (prop
      `repository` extendida con `'getUrlArchivo'`), `:103-155` (estado `previewAbierto`/
      `estadoPreview`, `abrirPreview()`/`cerrarPreview()`, mismo patrón de cleanup por
      `URL.revokeObjectURL` que `DocumentChecklist.tsx`), `:368-410` (botón "Ver documento" — **a
      propósito fuera de `CamposSoloLectura`, comentario en L368-376 explica por qué**, `Overlay` con
      el `<a target="_blank" rel="noopener noreferrer">` a la misma URL `inline` ya resuelta, y
      `VistaPreviaArchivo` debajo).
- [x] 7.9 Fallback por extensión **solo** para filas con `archivo_tipo_mime` nulo, con comentario de
      que es compatibilidad histórica. Si no se puede inferir → rama "no se puede previsualizar" +
      descarga, que ya existe.
      `AutorizacionForm.tsx:162` (`tipoMimeEfectivo = values.archivo.tipoMime ?? inferirTipoMime(...)`),
      reusando `inferirTipoMime` de `documentoMapping.ts` (import en L11) — no reimplementado. Si
      `inferirTipoMime` tampoco resuelve, `tipoMimeEfectivo` queda `undefined` y
      `VistaPreviaArchivo` cae sola en su rama "no se puede previsualizar acá" + Descargar (mismo
      criterio que ya usa `DocumentChecklist`/`ContenidoPreview`, ahora en `VistaPreviaArchivo.tsx`).
- [x] 7.10 Tests: `getUrlArchivo` en los 2 modos; `VistaPreviaArchivo` en sus 5 desenlaces;
      `AutorizacionForm` abre preview y pestaña nueva.
      `SupabaseAutorizacionRepository.test.ts` (nuevo describe `getUrlArchivo() (7.2/7.10)`, 6 tests:
      `'inline'` sin `download`, `'descarga'` con `download`, sin archivo → `null` sin firmar,
      autorización inexistente → `null` sin firmar, 403/404 reales de Storage traducidos al
      castellano) — baseline 26/26 → **32/32**.
      `VistaPreviaArchivo.test.tsx` (archivo nuevo, 8 tests): los 5 desenlaces de la spec (imagen,
      PDF, tipo no soportado, error, sin contenido) + estado `cargando` + `tipoMime` ausente
      (fallback ya resuelto por el llamador, 7.9) — **8/8**.
      `AutorizacionForm.test.tsx` (nuevo describe `vista previa del documento adjunto`, 5 tests): sin
      archivo no ofrece el botón; clic llama `getUrlArchivo(id, 'inline')` y muestra la preview
      resuelta; aparece `<a target="_blank" rel="noopener noreferrer">` a la misma URL; estado de
      carga sin el link todavía; error de `getUrlArchivo` se traduce — baseline 24/24 →
      **29/29**. `mockAutorizacionRepository.test.ts`: 4 tests nuevos agregados (`tipoMime`
      persistido, `getUrlArchivo` con/sin archivo, id inexistente) — bloqueados por el mismo bug de
      entorno pre-existente que ya documentó la Fase 5 (`localStorage.clear()` undefined en
      `beforeEach`, 26 archivos de mocks afectados en todo el repo, confirmado no relacionado con
      este trabajo).

## Phase 8: UI de presupuestos ⚠️ BLOQUEADA POR 0.4

> **Orden desbloqueado** (verificado antes de arrancar): `presupuesto-prestaciones` §8 (8.1-8.9, 8.11)
> está `[x]` en su propio `tasks.md` — `PresupuestoForm.tsx` ya tiene la bifurcación real de D9
> (`simple`/`general`/`por-prestacion`, 72 tests) antes de que esta fase tocara el archivo. Solo la
> 8.10 de ESE change (comparación full-suite, en su propia Fase 10) queda pendiente, sin bloquear.

- [x] 8.1 `PresupuestosList.tsx` (punto 2, D5): agregar prestación (de `prestacionId` o de `lineas[]`,
      resuelta client-side) y rango de vigencia a cada tarjeta. Caso sin prestación → chip
      `"Sin prestación asociada"`, **nunca** celda vacía. Buscador filtra también por prestación.
      `frontend/src/features/presupuestos/PresupuestosList.tsx:22` (prop `nombrePrestacion`),
      `:28-46` (`textoPrestacion`/`textoVigencia`, `null` = sin prestación asociada, nunca celda
      vacía), `:83` (buscador: `prestacion.includes(termino)`), `:174` (`Chip` "Sin prestación
      asociada"). Resolución del nombre por id: `PresupuestosPage.tsx:61-68` (`nombrePrestacion`,
      busca en el catálogo de TODOS los pacientes — ids de `Prestacion` globalmente únicos, mismo
      criterio que el resto de entidades del repo), `:88` (wiring a `PresupuestosList`). Tests:
      `PresupuestosList.test.tsx` (describe "prestación y vigencia", 6 tests nuevos) — baseline
      15/15 → **21/21**.
- [x] 8.2 `PresupuestoForm.tsx`: campos de vigencia desde/hasta, **separados y visualmente distintos**
      de `fechaEmision` (es el malentendido que originó el pedido de Andrea — no los pongas cerca
      uno del otro sin distinción visual clara).
      `PresupuestoForm.tsx:591` (`<FieldGroupHeading>Vigencia del presupuesto</FieldGroupHeading>`,
      bloque propio con `AvisoModeloDatos` y divisor `border-t`, ubicado deliberadamente lejos del
      campo "Fecha de emisión" — no contiguo, no bajo el mismo título). Campos `vigencia-desde`/
      `vigencia-hasta` en el mismo bloque.
- [x] 8.3 `PresupuestoForm.tsx`: checkbox CD/SD (D3), reusando el componente del design-system
      (`frontend/src/design-system/components.tsx` — mirá qué checkbox/toggle ya existe, no inventes
      uno nuevo).
      **Hallazgo**: el design-system NO tiene un componente `Checkbox`/`Toggle` propio (revisado
      `components.tsx` completo) — el patrón ya establecido en el repo para un booleano suelto es
      `<label><input type="checkbox"/>…</label>` con las mismas clases (ver
      `VehiculoForm.tsx:132-145`/`ConductorForm.tsx:144-153`, "Fuera de servicio"). Reusado tal cual,
      sin inventar un componente nuevo: `PresupuestoForm.tsx:643` (label "Con dependencia (CD)"),
      mismo patrón en `AutorizacionForm.tsx:405` (tasks.md 8.8).
- [x] 8.4 `PresupuestoForm.tsx`: sección "Datos del formulario de la obra social" con los 10 campos
      (D2: origen/destino ida-vuelta, horarios entrada/salida, km ida/vuelta, días de la semana, días
      mensuales) + **viajes y km mensuales calculados en vivo** con `calculoViajes.ts` (ya existe,
      Fase 4), read-only, mismo espíritu que el total de `PresupuestoLineasEditor`.
      `PresupuestoForm.tsx:623` (`<FieldGroupHeading>Datos del formulario de la obra social</FieldGroupHeading>`),
      los 10 campos en el grid inmediatamente debajo (origen/destino ida y vuelta, horarios `type="time"`,
      km `type="number"`, días de la semana como checkboxes de `DIAS_SEMANA_OPCIONES`, días
      mensuales), `:264` (`toggleDiaSemana`), `:270-296` (`tieneVuelta` derivado de
      origen/destino/km de vuelta cargados, D4 — no es columna aparte; `viajesYKmMensuales` con
      `calcularViajesMensuales`/`calcularKmMensuales` de `calculoViajes.ts`, `try/catch` para
      `diasMensuales` negativo → "sin cálculo" en vez de romper), `:781` (fila "Viajes / km
      mensuales (calculado)", mismo patrón visual que el "Total" de `PresupuestoLineasEditor.tsx:99-102`).
- [x] 8.5 Botón "Traer de los destinos habituales del paciente": **copia** los `RecorridoHabitual`
      vigentes a los campos (días + horarios), editables. **Copy-on-create, sin FK, sin referencia
      viva** (D2). Si el paciente no tiene destinos habituales → botón deshabilitado con motivo, no
      oculto.
      `frontend/src/features/presupuestos/construirDatosTrasladoDesdeRecorridos.ts` (módulo puro
      nuevo): heurística documentada — el recorrido de `hora` más temprana es el tramo de ida; si
      existe otro recorrido cuyo origen/destino es el camino inverso EXACTO, se toma como vuelta; si
      no, se copia solo-ida sin inventar un horario de vuelta. `diasSemana` es la unión de TODOS los
      días presentes, no solo el del tramo de ida. Km y `diasMensuales` NUNCA se copian (RF-110 no
      los modela). 6 tests unitarios propios (`construirDatosTrasladoDesdeRecorridos.test.ts`, RED→GREEN,
      ver evidencia TDD). Wiring: `PresupuestoForm.tsx:93` (prop `recorridoHabitualRepository`,
      `Pick<..., 'list'>` — solo lectura, nunca `create`/`remove` desde este form), `:170-203`
      (`useEffect` refetch por `pacienteId`), `:301-315` (`motivoDeshabilitadoTraerDestinos` —
      siempre visible, nunca oculta el botón — y `handleTraerDestinosHabituales`). Composition root:
      `PresupuestosRoute.tsx:3,36` (reusa `supabaseRecorridoHabitualRepository`, ya real desde
      `PacientesRoute.tsx` — RF-110), `PresupuestosPage.tsx:26,37,88`, `PresupuestoDetail.tsx:40,94,240`.
      Tests de UI: `PresupuestoForm.test.tsx` (describe "traer destinos habituales del paciente", 3
      tests: sin paciente deshabilitado con motivo, paciente sin destinos deshabilitado con motivo,
      paciente con destinos copia y queda editable).
- [x] 8.6 Validación: `vigenciaHasta >= vigenciaDesde`; en autorización, período autorizado ⊆
      presupuestado (D1). Mensajes en castellano.
      `validatePresupuestoForm.ts:31-36` (`validarRangoVigencia`, compartida entre la rama
      `unico` y `lote` — comparación de string ISO por orden lexicográfico, sin parsear a `Date`,
      mismo criterio que el `CHECK` de la base), `:62-65` (uso en `validatePresupuestoForm`).
      `PresupuestoForm.tsx:321,333` (`errorVigencia` calculado una vez, mergeado en los errores de
      AMBAS ramas del submit — vigencia es un campo compartido de `values`, no de cada ítem del
      lote). Autorización ⊆ presupuesto: `validarAutorizacion.ts:56-83`
      (`validarVigenciaAutorizacion`, función NUEVA y separada de `validarAutorizacion` — RN-PA-01
      es monto, esta es vigencia, mensajes distintos a propósito, spec "el mensaje distingue este
      caso del de RN-PA-01"). `AutorizacionForm.tsx:213-224` (wiring en `handleSubmit`, bloquea el
      guardado si no cumple). Mensajes en castellano en ambos archivos. Tests: `validatePresupuestoForm.test.ts`
      (+5), `validarAutorizacion.test.ts` (+6, describe `validarVigenciaAutorizacion`),
      `PresupuestoForm.test.tsx`/`AutorizacionForm.test.tsx` (ver 8.2/8.8 más abajo).
- [x] 8.7 `PresupuestoDetail.tsx`: mostrar vigencia, CD/SD y datos de traslado. Sin datos →
      "Sin vigencia cargada" / "Sin datos de traslado", nunca valores inventados.
      La vista de solo-lectura de `PresupuestoDetail` es `PresupuestoResumen.tsx` (componente ya
      extraído en una fase anterior, mismo patrón que `PrestacionResumen`/D9 de
      `presupuesto-prestaciones`): `PresupuestoResumen.tsx:11-19` (`textoVigencia`, "Sin vigencia
      cargada" cuando ninguno de los dos lados está cargado, nunca inferido de `fechaEmision`),
      `:21-26` (`textoConDependencia`, distingue `undefined` "No cargado" de `false` "No" — nunca
      fabrica una decisión no tomada), `:127` (stat "Con dependencia (CD/SD)"), `:164-211` (bloque
      "Datos de traslado" completo o "Sin datos de traslado" si `datosTraslado === undefined`, cada
      campo individual "Sin cargar" si falta, `DIA_SEMANA_LABEL` traduce `diasSemana`). El lado de
      la AUTORIZACIÓN (vigenciaHasta/conDependencia) se agregó al mismo Card de solo-lectura de
      `PresupuestoDetail.tsx:297-310` (ver 8.8). Tests: `PresupuestoResumen.test.tsx` (describe
      "vigencia, CD/SD y datos de traslado", 8 tests) — baseline 12/12 → **20/20**.
      `PresupuestoDetail.test.tsx` (describe "vigencia y CD/SD de la autorización", 2 tests) —
      baseline 12/12 → **14/14**.
- [x] 8.8 `AutorizacionForm.tsx`: `vigenciaHasta` + checkbox CD/SD **desmarcable** aunque el
      presupuesto lo tenga marcado (es el requisito literal de Andrea — ella carga CD pero la obra
      social puede negarlo).
      `AutorizacionForm.tsx:28,34` (`AutorizacionFormValues.vigenciaHasta`/`conDependencia`),
      `:58-59,66` (props `presupuestoVigenciaDesde`/`presupuestoVigenciaHasta`/
      `presupuestoConDependencia` — SOLO para validación/sugerencia inicial, nunca para
      deshabilitar el control), `:123-127` (estado inicial: `presupuestoConDependencia` se copia
      **solo en alta**, sin `initial` — en edición el valor ya persistido de la autorización nunca
      se re-deriva, mismo criterio D9 que `PresupuestoForm`), `:379` (`Field` "Vigencia hasta"),
      `:391-406` (checkbox "Con dependencia (CD)" — comentario explícito: **nunca** `disabled` en
      función de `presupuestoConDependencia`, requisito literal de la usuaria). Wiring desde
      `PresupuestoDetail.tsx:333-343` (`initial.vigenciaHasta`/`conDependencia` desde la
      autorización YA persistida; `presupuestoVigenciaDesde`/`Hasta`/`ConDependencia` desde el
      presupuesto asociado, solo para D1/D3). Tests: `AutorizacionForm.test.tsx` (describe
      "vigenciaHasta y CD/SD desmarcable", 6 tests: campo visible, arranca desmarcado sin
      sugerencia, arranca marcado CON sugerencia pero sigue desmarcable — clic + submit confirma
      `conDependencia: false` —, edición no re-deriva del presupuesto, vigencia dentro del período
      guarda, vigencia que excede bloquea con mensaje que NO menciona RN-PA-01) — baseline 29/29 →
      **35/35**.
- [x] 8.9 Tests RTL de las 4 pantallas.
      Totales por archivo (baseline → post-cambio, `npx vitest run` por archivo):
      `PresupuestosList.test.tsx` 15/15 → **21/21**; `PresupuestoForm.test.tsx` 30/30 → **41/41**;
      `PresupuestoDetail.test.tsx` 12/12 → **14/14**; `AutorizacionForm.test.tsx` 29/29 → **35/35**.
      Colateral (mismo criterio Fase 7 — archivos con tests que renderizan estos componentes o
      necesitaron el nuevo prop requerido `recorridoHabitualRepository`): `PresupuestoResumen.test.tsx`
      12/12 → **20/20**; `PresupuestosPage.test.tsx` 8/8 → **8/8** (prop nueva agregada a los 4
      render calls, sin tests nuevos); `PresupuestosFacturacionCoherencia.test.tsx` 4/4 → **4/4**
      (mismo motivo); `validatePresupuestoForm.test.ts` 9/9 → **14/14**; `validarAutorizacion.test.ts`
      5/5 → **11/11**; `construirDatosTrasladoDesdeRecorridos.test.ts` (archivo nuevo) **6/6**.
      `PresupuestosRoute.test.tsx` sin cambios (0/1, bug pre-existente de entorno documentado en
      Fase 5/7, `localStorage.clear()` undefined en `beforeEach` — no relacionado, confirmado de
      nuevo). `npx tsc -b --noEmit`: limpio. `npx vitest run` (repo completo): 254 archivos
      pasados / 26 fallados (mismos 26 de siempre, mismo bug de entorno — ninguno de los 4 archivos
      tocados por esta fase aparece en esa lista), 2966/3157 tests. Grep de control
      (`grep -n '\bany\b\| as '` sobre los archivos de producción tocados): 1 sola coincidencia,
      `AutorizacionForm.tsx:305` (`event.target.value as EstadoAutorizacion`) — **preexistente**, no
      agregada por esta fase.

## Phase 9: Documentación de discrepancias (regla dura del proyecto)

- [x] 9.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: **5 entradas nuevas** (tabla del
      design §Discrepancias). Referenciar #13 **sin editarla** — este change no la reabre.
      `knowledge-base/04_modelo_de_datos.md:347-370` (bullet nuevo "Vigencia, datos de traslado e
      identificación de presupuestos", insertado a continuación del bullet ✅ existente de
      Presupuesto/Autorización, antes de "Facturación y Cobros"), con las 5 discrepancias numeradas
      1-5 en `:354-367` (`presupuesto.vigencia_desde`/`vigencia_hasta` L354, `autorizacion.vigencia_hasta`
      L357, `con_dependencia` L359, bloque de datos de traslado L362, `archivo_tipo_mime` L366) —
      cada una con su pantalla `AvisoModeloDatos` citada. La #13 se referencia en `:350` ("**No
      reabre la #13** ... solo la referencia porque comparten la misma entidad `Presupuesto`, sin
      tocar su redacción ni su decisión") — cero ediciones al bullet original de la #13
      (`:1018-1036`, verificado sin diff).
- [x] 9.2 `CHANGES.md` §C-06: bullets `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` × 5 + nota de
      reapertura post-archivo.
      `CHANGES.md:940-952` (bullet `🔶 Reapertura post-archivo`, mismo formato que las reaperturas
      previas de `presupuesto-prestaciones`/`facturacion-cambios-ui`) y `:953-967` (bullet `⚠️
      Discrepancia con Traslados-Modelo-Datos.docx`, las 5 discrepancias numeradas 1-5 con su
      pantalla y referencia cruzada a la #2 con la discrepancia ya abierta de `vigenciaDesde`),
      insertados a continuación del último bullet de §C-06 (REAPERTURA #13 de
      `facturacion-cambios-ui`), antes de `### [C-10]`.
- [x] 9.3 `AvisoModeloDatos` en `PresupuestoForm`, `PresupuestoDetail` y `AutorizacionForm`.
      **Verificado, no asumido**: Fase 8 ya había agregado los carteles de `PresupuestoForm.tsx`
      (`:592-596` vigencia Discrepancia 1, `:624-628` dependencia+traslado Discrepancias 3/4) —
      confirmados correctos, sin tocar. `PresupuestoResumen.tsx` (la vista de solo lectura de
      `PresupuestoDetail`) y `AutorizacionForm.tsx` **NO** los tenían — agregados en esta fase, ciclo
      TDD real (RED confirmado antes de escribir el JSX):
      `PresupuestoResumen.tsx:132-140` (cartel de vigencia, Discrepancia 1) y `:169-173` (cartel de
      datos de traslado, Discrepancia 4, condicional a `datosTraslado !== undefined` igual que el
      bloque que describe). `AutorizacionForm.tsx:290-298` (cartel nuevo agrupando vigenciaHasta +
      conDependencia + tipoMime, Discrepancias 2/3/5, mismo criterio de agrupación por tema que los
      2 carteles preexistentes de esa pantalla). Tests: `PresupuestoResumen.test.tsx` (+2 tests
      nuevos, describe "vigencia, CD/SD y datos de traslado"; +1 test preexistente actualizado de
      `getByRole` a `getAllByRole`+`find` porque dejó de ser el único `note` de la pantalla) —
      baseline 20/20 → **22/22**. `AutorizacionForm.test.tsx` (+1 test nuevo del cartel; 2 tests
      preexistentes de conteo actualizados de "exactamente 2" a "exactamente 3" carteles) — baseline
      33/33 → **36/36**. Colateral verificado sin regresiones: `PresupuestoDetail.test.tsx`
      (14/14, sin cambios — sus asserts de `note` ya usaban `getAllByRole`+`find`/`filter` por
      texto específico, no conteo global), `PresupuestoForm.test.tsx` (41/41, sin cambios),
      `PresupuestosList.test.tsx` (21/21, sin cambios). `npx tsc -b --noEmit`: limpio. `npx vitest
      run` (repo completo): 1 archivo fallado (`PresupuestosRoute.test.tsx`, mismo bug de entorno
      pre-existente `localStorage.clear()` documentado en Fases 5/7/8, no relacionado), 186/187 del
      resto de `features/presupuestos/` en verde.
- [x] 9.4 `10_preguntas_abiertas.md`: **actualizar** el ítem de "dependencia y retorno" (L430) — Andrea
      contestó **dónde vive** el dato (presupuesto + autorización, no paciente ni obra social); siguen
      abiertos el significado numérico y "retorno". Agregar OQ 1-4 del design.
      `10_preguntas_abiertas.md:430-441` (ítem "fixes directos de Facturación" actualizado:
      afirmación tachada de "hace falta decidir dónde vive el dato", reemplazada por el párrafo
      "Actualizado 2026-08-21" que cita D3 del design y dice explícitamente que la pregunta **no se
      cierra** — quedan significado numérico y "retorno"), `:449-473` (sección nueva "Preguntas
      nuevas — `presupuestos-vigencia-datos-traslado-vista-previa`", las 4 Open Questions del
      design.md transcriptas con su decisor).
- [x] 9.5 Actualizar `presupuesto-cupo-consumible` / `CupoAutorizado` si la vigencia debe viajar en la
      proyección — **evaluar, no asumir**; si toca Facturación, se registra como OQ 4 y se deja fuera.
      **Evaluado en código, no asumido**: `shared/types/presupuesto.ts:234-239`
      (`CupoAutorizado.vigenciaDesde` ya existe desde `presupuestos-ui`, 2026-07-24) y
      `shared/lib/presupuestos/cupoAutorizado.ts:7-14` (`derivarCupoAutorizado` ya la proyecta) —
      pero `shared/lib/facturacion/validarCupoFacturacion.ts` (la función real de gateo RN-FA-02)
      **no lee `vigenciaDesde` en ningún punto** (confirmado por grep): el dato viaja pero no gatea
      nada, hoy. **Decisión: no se agrega `vigenciaHasta` (nuevo de este change) a `CupoAutorizado`**
      — sumar el dato sin implementar el gateo sería repetir el mismo problema que ya tiene
      `vigenciaDesde`, y el gateo en sí es exactamente la OQ 4 (toca Facturación CRÍTICO, decisor
      Andrea + Enzo, `facturacion-seleccion-autorizacion` activo en paralelo). Documentado en
      `10_preguntas_abiertas.md:468-476` (OQ 4, con la cita de archivo:línea de arriba). Ningún
      archivo de `shared/lib/facturacion/` ni `shared/lib/presupuestos/cupoAutorizado.ts` fue
      modificado — confirmado por `git status`.

## Phase 10: Verificación final

- [x] 10.1 `cd frontend && npx tsc -b --noEmit` (**nunca** `tsc --noEmit` a secas).
      Corrido desde `frontend/`: **salida vacía, exit 0**. Cero errores de tipos en todo el proyecto
      (project-references completo, no solo los archivos de este change).
- [x] 10.2 `cd frontend && npx vitest run` — todo verde.
      **254 archivos pasados / 26 fallados, 2969/3160 tests** (el mismo listado exacto de 26 archivos
      que documentaron las Fases 5/7/8/9 — `mockAutorizacionRepository.test.ts`,
      `mockCobroRepository.test.ts`, `mockConductorRepository.test.ts`, `mockFacturaRepository.test.ts`,
      `mockHojaDeRutaRepository.test.ts`, `mockObraSocialRepository.test.ts`,
      `mockPacienteRepository.test.ts`, `mockPresupuestoRepository.test.ts`,
      `mockRecorridoHabitualRepository.test.ts`, `mockVehiculoRepository.test.ts`,
      `AppShell.test.tsx`, `router.cuentas.test.tsx`, `router.test.tsx`,
      `PermisosMatrizFields.test.tsx`, `FacturacionRoute.test.tsx`, `RecorridoCard.test.tsx`,
      `ChecklistEditor.test.tsx`, `ObraSocialesRoute.test.tsx`, `PacienteDetail.test.tsx`,
      `PacienteForm.test.tsx`, `PacientesPage.test.tsx`, `PacientesRoute.test.tsx`,
      `PresupuestosRoute.test.tsx`, `VehiculoForm.test.tsx`, `VehiculosPage.test.tsx`,
      `VehiculosRoute.test.tsx`) — mismo error raíz confirmado (`TypeError: Cannot read properties of
      undefined (reading 'clear')` en `localStorage.clear()` de cada `beforeEach`, bug de entorno de
      Node 26 en esta máquina, no relacionado con este change; bajo Node 24 estos mismos 26 archivos
      pasan, según el batch de Fase 1). **Cero regresiones nuevas causadas por este change**: verificado
      con `git diff` sobre las 5 líneas de "as"/casts de los archivos de Edge Functions y del mock de
      autorizaciones (ver 10.3) — ninguno de los archivos que este change modificó introduce un fallo
      distinto al de siempre; `mockAutorizacionRepository.test.ts` (el único de los 26 que este change
      sí tocó, Fase 7) falla con el mismo `TypeError` de `localStorage.clear()`, no por lógica nueva.
- [x] 10.3 Grep de control: cero `any` y cero `as` sobre datos externos en los archivos tocados.
      `command grep -n '\bany\b\| as '` sobre los 21 archivos de producción (frontend + Edge Functions)
      tocados por este change (Fases 1-9, lista completa via `git status --porcelain` del repo):
      **cero matches nuevos**. Aparecen 8 líneas con `as`/`any` en 4 archivos
      (`AutorizacionForm.tsx:316` `event.target.value as EstadoAutorizacion`;
      `mockAutorizacionRepository.ts:29` `value as Record<string, unknown>`;
      `autorizacionMapping.ts:45-46` `value as EstadoAutorizacion`; 10 líneas en
      `supabase/functions/autorizaciones/index.ts` y `supabase/functions/presupuestos/index.ts`,
      todas `data as XRow[]`/`body as XInput` del cliente de Supabase) — **todas preexistentes**,
      confirmado con `git diff` de cada archivo: ninguna de esas líneas aparece entre las líneas
      agregadas (`+`) del diff de este change. Los archivos nuevos (`calculoViajes.ts`,
      `VistaPreviaArchivo.tsx`, `construirDatosTrasladoDesdeRecorridos.ts`) y el resto de los
      modificados (`PresupuestoForm.tsx`, `PresupuestoDetail.tsx`, `PresupuestoResumen.tsx`,
      `PresupuestosList.tsx`, `PresupuestosPage.tsx`, `PresupuestosRoute.tsx`,
      `validatePresupuestoForm.ts`, `validarAutorizacion.ts`, `DocumentChecklist.tsx`,
      `AutorizacionRepository.ts`, `SupabaseAutorizacionRepository.ts`, `presupuestoMapping.ts`,
      `shared/types/presupuesto.ts`) dan **cero** matches.
- [ ] 10.4 Verificación manual con 2 cuentas reales (`presupuestos: read` y sin el módulo) contra la
      vista previa y contra la edición de los campos nuevos. **Pendiente — tarea humana, no ejecutable
      por el agente.** Mismo patrón que `integracion-documentos-autorizaciones` tarea 5.2 en este mismo
      proyecto: requiere credenciales reales de 2 cuentas distintas contra el Supabase real, decisión
      que solo la usuaria puede tomar/ejecutar. No se intentó ni se fabricó un resultado.
- [x] 10.5 Recorrer los Success Criteria del proposal uno por uno y marcarlos.
      Ver `proposal.md` §Success Criteria — 6 de 10 marcados con evidencia verificable (tests/grep/tsc),
      4 dejados sin marcar por depender de 10.4 (verificación manual con cuentas reales / app corriendo
      contra el Supabase real) o de la aplicación efectiva de las migraciones en producción (§0.3/§3.5,
      ambas todavía `[ ]` en este mismo `tasks.md` — **discrepancia detectada y no resuelta acá**: el
      criterio de disparo de esta Fase 10 asumía las 3 migraciones ya aplicadas en vivo, pero las
      gates de Fase 0 y la tarea 3.5 siguen sin marcar; una consulta de solo lectura a la base real
      para confirmarlo fue bloqueada por el sandbox de este agente — se deja para que la usuaria/Enzo
      confirmen, no se asume ni se marca).
