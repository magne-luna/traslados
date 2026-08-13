-- Migration: factura_autorizacion_id
-- Change: openspec/changes/facturacion-seleccion-autorizacion/ (design.md D1, tasks.md 1B.1)
--
-- ¿Qué agrega? Una columna nullable `facturas.autorizacion_id` que registra qué autorización
-- (`facturacion.autorizacion`) habilitó cada factura, más su índice de lectura.
--
-- ¿Por qué? El wizard de facturación (Paso 2) deja de pedir "prestador" (dos `Input` de texto
-- libre, sin entidad detrás) y pasa a exigir una elección explícita entre las autorizaciones
-- pendientes del paciente (D3/D4). Ese vínculo necesita persistirse para sobrevivir a la sesión
-- del wizard y para que `AlertaCupo` (RN-FA-02) se calcule contra la autorización elegida, no
-- contra la primera que resuelva la heurística vieja (D6).
--
-- Nullable: SÍ. Las facturas anteriores a este change no tienen autorización asociada, y eso ES
-- su significado, no un dato faltante. `NOT NULL` exigiría backfill inventado sobre datos
-- financieros.
--
-- UNIQUE: NO. La relación es N:1 — una autorización tiene un cupo MENSUAL recurrente
-- (`cupoMensualDias`/`cupoMensualKm`) y genera una factura por mes. Un `UNIQUE` haría imposible
-- facturar el segundo mes contra la misma autorización.
--
-- ON DELETE: default (`NO ACTION`). Borrar una autorización que ya generó facturas debe fallar,
-- no dejar facturas huérfanas ni cascadear sobre un documento fiscal.
--
-- Índice sin CONCURRENTLY: verificado en tasks.md 0.3 (2026-08-13) que
-- `select count(*) from facturacion.facturas` = 0 sobre el proyecto vinculado
-- (`pkryfoljypuzfifofdwp`). `CREATE INDEX CONCURRENTLY` no corre dentro de un bloque de
-- transacción y las migraciones de Supabase van envueltas en una — con 0 filas, el índice simple
-- no bloquea nada. Misma justificación que D10 de `integracion-facturacion`
-- (`20260812150000_factura_fecha_emision_indices.sql`).
--
-- Rollback: `DROP INDEX facturacion.idx_facturas_autorizacion_id;` +
-- `ALTER TABLE facturacion.facturas DROP COLUMN autorizacion_id;` — no transforma ni borra ningún
-- dato existente (la columna nace vacía).
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md
-- 1B.4). Depende de `facturacion.autorizacion` (ya existe) y de que ninguna migración posterior a
-- `20260812160000` haya tocado `facturacion.facturas` (reconfirmado en tasks.md 1.1/1.4).

ALTER TABLE facturacion.facturas
  ADD COLUMN autorizacion_id UUID REFERENCES facturacion.autorizacion(id);

CREATE INDEX IF NOT EXISTS idx_facturas_autorizacion_id
  ON facturacion.facturas (autorizacion_id);
