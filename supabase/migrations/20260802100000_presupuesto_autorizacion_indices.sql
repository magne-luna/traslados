-- Migration: presupuesto_autorizacion_indices
-- Change: openspec/changes/integracion-presupuestos/ (design.md D7b, tasks.md 0.4/1B.1/1B.2)
--
-- Tres índices sobre foreign keys de `facturacion.presupuesto` y `facturacion.autorizacion` que
-- `integracion-facturacion` D10 dejó explícitamente fuera por pertenecer a `C-06`.
--
-- ⚠️ POR QUÉ SIN `CONCURRENTLY` (apartamiento aprobado de una regla dura de
-- `database-schema-design`, tarea 0.4, aprobado por la usuaria el 2026-08-02):
--   (1) Las dos tablas afectadas tenían 0 filas al momento de diseñar y siguen en 0 filas
--       inmediatamente antes de escribir esta migración (ver conteo abajo) — el lock que toma un
--       `CREATE INDEX` normal sobre una tabla vacía dura microsegundos, no justifica el costo de
--       `CONCURRENTLY` (dos escaneos, sin garantía transaccional, invalidable a mitad de camino).
--   (2) `CREATE INDEX CONCURRENTLY` no puede correr dentro de un bloque de transacción, y las
--       migraciones de Supabase (`supabase db push` / `migration up`) se aplican envueltas en una.
--
-- CONTEO MEDIDO (tarea 1B.1, re-verificado inmediatamente antes de escribir este archivo,
-- vía `supabase db query --linked` contra el proyecto real, ref `pkryfoljypuzfifofdwp`):
--   fecha: 2026-08-05
--   facturacion.presupuesto  → count(*) = 0
--   facturacion.autorizacion → count(*) = 0
-- Coincide con el conteo del propose (2026-08-02: 0 / 0) y con el de la tarea 1.5 del mismo día
-- (2026-08-05: 0 / 0) — la justificación de no usar `CONCURRENTLY` sigue vigente sin cambios.
--
-- CONDICIÓN DE CADUCIDAD: si al momento de aplicar esta migración (tarea 1B.3, la ejecuta la
-- usuaria / Enzo, no el agente) alguna de las dos tablas ya tiene filas en volumen, esta migración
-- NO debe aplicarse tal cual — hay que rehacer los índices con `CREATE INDEX CONCURRENTLY` en un
-- script aparte, fuera de transacción, en su lugar.
--
-- `IF NOT EXISTS` por si `integracion-facturacion` llega a aplicar su propia migración de índices
-- sobre este schema antes que esta (verificado en tasks.md 1.6: no lo había hecho todavía al
-- momento de escribir este archivo).
--
-- Rollback: DROP INDEX × 3. Los índices no cambian ninguna semántica ni requieren backfill.

CREATE INDEX IF NOT EXISTS idx_presupuesto_paciente_id
  ON facturacion.presupuesto (paciente_id);

CREATE INDEX IF NOT EXISTS idx_presupuesto_obra_social_id
  ON facturacion.presupuesto (obra_social_id);

CREATE INDEX IF NOT EXISTS idx_autorizacion_presupuesto_id
  ON facturacion.autorizacion (presupuesto_id);
