-- Migration: storage_objects_rls
-- Description: C-03 gestion-documental-core. Los 4 buckets privados creados en C-01 tienen
-- RLS habilitado por default de Supabase Storage, sin ninguna politica -- hoy nadie
-- (ni siquiera un usuario autenticado con permiso) puede subir ni leer un archivo en
-- ninguno de los 4 buckets. Estas policies son las que realmente habilitan el storage.
--
-- Mapeo bucket -> modulo (igual que las tablas de dominio de cada entidad, ver C-02):
--   documentos-pacientes  -> pacientes
--   documentos-vehiculos  -> conductores (vehiculo vive bajo ese modulo, no uno propio)
--   documentos-conductores -> conductores
--   documentos-facturas   -> facturacion

CREATE POLICY "Read documentos-pacientes" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pacientes' AND modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write documentos-pacientes" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-pacientes' AND modulos.tiene_permiso('pacientes', 'write'));
CREATE POLICY "Update documentos-pacientes" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-pacientes' AND modulos.tiene_permiso('pacientes', 'write'));
CREATE POLICY "Delete documentos-pacientes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-pacientes' AND modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read documentos-vehiculos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write documentos-vehiculos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('conductores', 'write'));
CREATE POLICY "Update documentos-vehiculos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('conductores', 'write'));
CREATE POLICY "Delete documentos-vehiculos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read documentos-conductores" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-conductores' AND modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write documentos-conductores" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-conductores' AND modulos.tiene_permiso('conductores', 'write'));
CREATE POLICY "Update documentos-conductores" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-conductores' AND modulos.tiene_permiso('conductores', 'write'));
CREATE POLICY "Delete documentos-conductores" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-conductores' AND modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read documentos-facturas" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-facturas' AND modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write documentos-facturas" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-facturas' AND modulos.tiene_permiso('facturacion', 'write'));
CREATE POLICY "Update documentos-facturas" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-facturas' AND modulos.tiene_permiso('facturacion', 'write'));
CREATE POLICY "Delete documentos-facturas" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-facturas' AND modulos.tiene_permiso('facturacion', 'write'));
