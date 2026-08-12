-- Migration: presupuesto_prestacion_id
-- Change: presupuesto-prestaciones (design.md D1, tasks.md 5.1) -- PR 2 de 3 ("columna + RPC +
-- Edge Function"). Requiere que `20260812120000_schema_pacientes_prestaciones.sql` (PR 1) ya esté
-- aplicada -- esta FK referencia `pacientes.prestaciones(id)`. Gate §0 de tasks.md aprobado
-- explícitamente por la usuaria (D1/D2/D3) antes de escribir esta migración.
--
-- ¿Qué agrega? Un vínculo OPCIONAL entre `facturacion.presupuesto` y una prestación puntual del
-- catálogo del paciente, para soportar obras sociales con `modalidad_facturacion = 'por-prestacion'`
-- (design.md D9): cada prestación seleccionada genera su propio presupuesto, con su propio `monto`
-- y su propia autorización 1:1. `monto` NO cambia de tipo, nullability ni semántica al agregar esta
-- columna (KB discrepancia #13, NO reabierta -- design.md D5).
--
-- `prestacion_id UUID NULL` -- nullable a propósito: en modalidad `general` queda `NULL` para
-- siempre (el desglose de esa modalidad vive solo en el formulario, PR 3, nunca se persiste).
-- Poner `NOT NULL` rompería todas las filas existentes y todas las futuras de modalidad `general`.
--
-- `ON DELETE` de la FK queda en el default (`NO ACTION`/`RESTRICT`) -- defensa en profundidad: la UI
-- nunca hace `DELETE` real sobre `pacientes.prestaciones` (borrado LÓGICO vía `activa`, D1 de la
-- migración de PR 1), pero si alguien lo hiciera a mano por SQL directo, la base sigue sin permitir
-- dejar un presupuesto financiero con una FK rota.
--
-- Volumen verificado (gate §0.3 de tasks.md, `supabase db query --linked`, solo lectura, antes de
-- escribir esta migración): 2 presupuestos, 2 autorizaciones -- ninguna de las dos estructuras
-- nuevas de este change (`pacientes.prestaciones`, `presupuesto.prestacion_id`) existía todavía.
-- Con ese volumen, tanto el `ADD COLUMN ... NULL` (sin default, O(1) en Postgres 11+) como el
-- `CREATE INDEX` posterior toman un lock que dura microsegundos -- no se justifica `CONCURRENTLY`
-- (que además no puede correr dentro de la transacción en la que `supabase db push`/`migration up`
-- envuelve cada migración; mismo criterio y misma justificación ya documentados en
-- `20260802100000_presupuesto_autorizacion_indices.sql`).
--
-- Todos los presupuestos existentes (los 2 medidos arriba) quedan con `prestacion_id IS NULL` tras
-- este `ADD COLUMN`, que es semánticamente correcto: fueron emitidos bajo el modelo anterior, sin
-- ningún concepto de prestación vinculada.
--
-- Esta columna es INERTE en este PR hasta que el Edge Function/RPC (`20260812140000_presupuesto_rpc.sql`,
-- misma PR) y el frontend (PR 3, bifurcación de `PresupuestoForm`) la escriban/lean.
--
-- Rollback: `DROP INDEX` sobre el índice de abajo, luego `ALTER TABLE facturacion.presupuesto
-- DROP COLUMN prestacion_id` -- destructivo SOLO para el vínculo nuevo: los presupuestos y sus montos quedan
-- intactos. Si ya hubo altas en modalidad `por-prestacion`, se pierde a qué prestación correspondía
-- cada una, pero no el presupuesto ni su autorización (design.md §Rollback).
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance, no límite técnico) -- la aplica la usuaria/Enzo con `supabase db push`.

ALTER TABLE facturacion.presupuesto
  ADD COLUMN prestacion_id UUID REFERENCES pacientes.prestaciones(id);

COMMENT ON COLUMN facturacion.presupuesto.prestacion_id IS
  'Vínculo OPCIONAL a pacientes.prestaciones (presupuesto-prestaciones, design.md D1/D5/D9). '
  'Poblado únicamente en obras sociales con modalidad_facturacion = ''por-prestacion'' (un '
  'presupuesto por prestación, alta atómica vía facturacion.crear_presupuestos_lote). En modalidad '
  '''general'' queda SIEMPRE NULL -- el desglose de esa modalidad vive solo en el formulario, nunca '
  'se persiste. NO reabre la discrepancia KB #13: monto sigue siendo un importe único.';

CREATE INDEX idx_presupuesto_prestacion_id ON facturacion.presupuesto (prestacion_id);

-- Rollback:
-- DROP INDEX IF EXISTS facturacion.idx_presupuesto_prestacion_id;
-- ALTER TABLE facturacion.presupuesto DROP COLUMN IF EXISTS prestacion_id;
-- Punto de no retorno (design.md §Rollback): una vez que existan presupuestos reales con
-- prestacion_id poblado, este rollback pierde la información de qué prestación correspondía a cada
-- uno (no el presupuesto ni su monto ni su autorización).
