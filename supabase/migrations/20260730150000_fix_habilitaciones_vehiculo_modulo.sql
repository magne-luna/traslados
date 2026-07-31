-- Migration: fix_habilitaciones_vehiculo_modulo
-- Description: 20260730140000_split_modulos_permisos.sql movio la RLS de vehiculo/
-- accesorios_vehiculo/documentacion_vehiculo/mantenimiento/conductores_vehiculos de
-- 'conductores' a 'vehiculos' (modulo mas granular). `habilitaciones_vehiculo` (tabla creada en
-- 20260730110000_schema_vehiculo_gaps.sql, el mismo dia pero antes del split) quedo afuera de
-- ese split -- se alinea aca para que las 6 tablas de vehiculos queden bajo el mismo modulo.

DROP POLICY IF EXISTS "Read habilitaciones_vehiculo" ON conductores.habilitaciones_vehiculo;
DROP POLICY IF EXISTS "Write habilitaciones_vehiculo" ON conductores.habilitaciones_vehiculo;
CREATE POLICY "Read habilitaciones_vehiculo" ON conductores.habilitaciones_vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write habilitaciones_vehiculo" ON conductores.habilitaciones_vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('vehiculos', 'write'));
