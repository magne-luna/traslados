-- Migration: autorizacion_periodo_mes
-- Change: autorizacion-mensual (design.md D1, D2, D3; tasks.md 1.1-1.3).
--
-- Qué hace: agrega `periodo_mes` a `facturacion.autorizacion` y la unicidad correcta para que una
-- misma obra social pueda responder mes a mes (1 fila por mes) en vez del modelo 1:1 de hoy.
--
-- ⚠️ Por qué esto NO necesita `DROP CONSTRAINT` (D1, verificado en vivo, tasks.md 0.5, 2026-08-22):
-- `facturacion.autorizacion.presupuesto_id` NUNCA tuvo un `UNIQUE`. La 1:1 actual es una
-- convención de APLICACIÓN en tres superficies (`.maybeSingle()` de la Edge Function,
-- `getByPresupuestoId(): Promise<Autorizacion | null>` del repository, y el `INSERT` único de
-- `20260815090000_presupuesto_autoriza_pendiente.sql`), no una restricción de la base. El único
-- índice existente sobre esa columna es `idx_autorizacion_presupuesto_id`
-- (`20260802100000_presupuesto_autorizacion_indices.sql:41-42`), un `CREATE INDEX` NO-`UNIQUE` —
-- re-verificado en vivo el 2026-08-22 (tasks.md 0.5: "único índice sobre presupuesto_id es
-- idx_autorizacion_presupuesto_id, no UNIQUE"). Como nunca hubo una restricción `UNIQUE` que
-- romper, esta migración solo AGREGA columna e índice; no hay nada que dropear.
--
-- Por qué el `CHECK (EXTRACT(DAY FROM periodo_mes) = 1)` y no confiar en el mapping del frontend
-- (D1): sin este `CHECK`, `2026-03-15` y `2026-03-01` son dos "marzos" distintos para el índice
-- único de abajo, y la unicidad que ese índice promete se vuelve falsa. Acá la cerradura SÍ va en
-- la base — a propósito, y a diferencia de `dias_semana TEXT[]`
-- (`20260821170000_presupuesto_vigencia_dependencia_traslado.sql:52-60`, "la cerradura la impone
-- el tipo, no la base"): allá se protegía un valor de presentación, acá se protege la CLAVE de
-- unicidad de un dato financiero. `normalizarPeriodoMes` (frontend, Fase 3 de este change) es la
-- primera línea de defensa; este `CHECK` es la segunda, y la que no se puede saltear.
--
-- Por qué el índice único es PARCIAL (`WHERE periodo_mes IS NOT NULL`) (D1, D3): las filas legacy
-- (creadas bajo el modelo 1:1, antes de este change) no tienen mes y tienen que poder seguir
-- existiendo sin romper nada. Un índice total dependería del comportamiento `NULLS DISTINCT` de
-- Postgres, que es un default histórico y no una intención escrita en este repo — el `WHERE` hace
-- la intención explícita y es a prueba de que alguien active `NULLS NOT DISTINCT` en el futuro.
-- `IF NOT EXISTS` por el mismo motivo que ya usa `20260802100000`: no asumir que nadie más creó ya
-- este índice.
--
-- Sin RLS nueva: esta migración NO crea ninguna tabla, solo agrega una columna a
-- `facturacion.autorizacion`, que ya está cubierta por las policies de "Read/Write presupuesto"
-- (`20260730140000_split_modulos_permisos.sql`, gateadas por
-- `modulos.tiene_permiso('presupuestos', ...)`), que aplican a la fila completa, columna nueva
-- incluida. Mismo criterio, textual, que
-- `20260821170000_presupuesto_vigencia_dependencia_traslado.sql:69-75` dejó escrito para el change
-- hermano. Se deja explícito acá también para que un reviewer no lo lea como un olvido de RLS.
--
-- Sin backfill (D3): las filas que existen hoy (varias por la auto-creación de
-- `20260815090000_presupuesto_autoriza_pendiente.sql`, aplicada 2026-08-15) se crearon bajo el
-- modelo 1:1 y nadie cargó un mes para ellas. Derivarles uno de `fecha_emision` o
-- `vigencia_desde` sería fabricar un dato financiero que nadie ingresó. `NULL` en `periodo_mes`
-- significa, a propósito, "esta fila es del modelo anterior" — mismo criterio, textual, que
-- `vigencia_desde`/`vigencia_hasta` de `facturacion.presupuesto`
-- (`20260821170000...:33-38`) y que `facturacion.autorizacion.vigencia_desde`
-- (`20260729130000_schema_autorizacion_monto_vigencia.sql`) ya usan para sus propias filas
-- históricas.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance CRÍTICO — datos de salud + facturación a obra social): la aplica la usuaria o Enzo
-- con `supabase db push`, DESPUÉS de revisar. Ver tasks.md 1.6.
--
-- Rollback: `DROP INDEX facturacion.idx_autorizacion_presupuesto_periodo;` seguido de
-- `ALTER TABLE facturacion.autorizacion DROP COLUMN periodo_mes;`. Con filas reales que ya tengan
-- un mes cargado, ese `DROP COLUMN` borra ese dato — igual criterio de "punto de no retorno" que
-- el Rollback Plan del change hermano (`rollback-rpc-presupuesto.sql:36-40`). Si ya hay meses
-- cargados en producción, el rollback barato es dejar la columna y revertir solo el frontend/RPC
-- de la migración hermana (`20260822181000_presupuesto_rpc_autorizacion_primer_mes.sql`).

ALTER TABLE facturacion.autorizacion
  ADD COLUMN periodo_mes DATE
  CHECK (periodo_mes IS NULL OR EXTRACT(DAY FROM periodo_mes) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_autorizacion_presupuesto_periodo
  ON facturacion.autorizacion (presupuesto_id, periodo_mes)
  WHERE periodo_mes IS NOT NULL;

COMMENT ON COLUMN facturacion.autorizacion.periodo_mes IS
  'Mes calendario que cubre esta respuesta de la obra social, persistido como el primer día del '
  'mes (ej. 2026-03-01), NUNCA un ordinal (D2 de autorizacion-mensual: "mes 1/2/3" se DERIVA en '
  'frontend/src/shared/lib/presupuestos/periodoAutorizacion.ts, nunca se persiste). CHECK exige '
  'día 1 para que el índice único de abajo no distinga "marzo" en dos fechas distintas. NULL = '
  'fila creada bajo el modelo 1:1 anterior a este change (D3) — NO fabricar un valor retroactivo; '
  'la UI la muestra como "Sin mes cargado". Puede convivir con filas mensuales del mismo '
  'presupuesto (el índice único de abajo es PARCIAL a propósito).';

COMMENT ON INDEX facturacion.idx_autorizacion_presupuesto_periodo IS
  'Reemplaza la garantía de unicidad que la aplicación (no la base) le daba al modelo 1:1 anterior '
  '(nunca hubo UNIQUE(presupuesto_id) en la base — ver idx_autorizacion_presupuesto_id, un índice '
  'NO-único, en 20260802100000_presupuesto_autorizacion_indices.sql). PARCIAL '
  '(WHERE periodo_mes IS NOT NULL) para que las filas legacy sin mes puedan coexistir sin romper '
  'la unicidad de las filas mensuales (D1, D3 de autorizacion-mensual/design.md). Un 23505 de este '
  'índice se mapea en el frontend (edgeFunctionErrors.ts) a "Ya existe una autorización para ese '
  'mes en este presupuesto."';
