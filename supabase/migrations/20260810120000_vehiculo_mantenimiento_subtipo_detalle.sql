-- Migration: vehiculo_mantenimiento_subtipo_detalle
-- Description: integracion-conductores-vehiculos, cierra el gap "4B.4" (design.md #### Gap
-- abierto, tasks.md 1B.1/1B.2): `conductores.mantenimiento` nunca tuvo columnas para el nivel 2
-- de una intervención de mantenimiento (preventivo/correctivo) — solo `categoria` (nivel 1).
-- Encontrado en vivo (2026-08-10): agregar un mantenimiento desde la UI real fallaba porque no
-- había dónde persistirlo del lado del backend.
--
-- `subtipo`/`detalle` van NULLables (D4, `shared/types/vehiculo.ts::MantenimientoRegistro`):
-- 'gasto' no usa ninguno de los dos; 'preventivo' y 'correctivo' (subtipo conocido) usan solo
-- `subtipo`; 'correctivo' + 'otro' usa los dos. El CHECK de abajo es exactamente el de design.md
-- D4 (1B.2), con los mismos 3 subtipos preventivos y 5 correctivos conocidos que
-- `shared/types/vehiculo.ts` (`SubtipoPreventivo`/`SubtipoCorrectivoConocido`) — no se inventa
-- ningún valor nuevo acá.
--
-- Se valida en el mismo paso (sin `NOT VALID` + `VALIDATE` separado, a diferencia del plan
-- original de 1B.2/1B.7): hasta este momento no existe NINGÚN camino de escritura para
-- categoria IN ('preventivo','correctivo') en todo el sistema (ni mock, ni backend), así que no
-- puede haber filas existentes que violen el CHECK — si las hubiera igual, la migración es
-- transaccional y falla limpio sin dejar estado a medias.

ALTER TABLE conductores.mantenimiento
  ADD COLUMN subtipo TEXT,
  ADD COLUMN detalle TEXT;

ALTER TABLE conductores.mantenimiento ADD CONSTRAINT chk_categoria_subtipo CHECK (
  (categoria = 'gasto'      AND subtipo IS NULL AND detalle IS NULL) OR
  (categoria = 'preventivo' AND subtipo IN ('cambio-aceite-filtros','vtv','rto') AND detalle IS NULL) OR
  (categoria = 'correctivo' AND subtipo = 'otro' AND detalle IS NOT NULL AND btrim(detalle) <> '') OR
  (categoria = 'correctivo' AND subtipo IN ('alternador','bateria','frenos','embrague','cubiertas'))
);
