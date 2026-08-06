-- Migration: fix_documentos_vehiculos_rls_modulo
-- Description: El bucket documentos-vehiculos (C-03, 20260729100001_storage_objects_rls.sql)
-- quedo gateado por el modulo 'conductores', pero conductores.documentacion_vehiculo (y el
-- resto del dominio vehiculos) chequea el modulo 'vehiculos' desde el split de modulos del
-- 30/07 (permisos-modulos-granulares). Nadie actualizo storage.objects en ese split: una
-- cuenta con permiso de escritura en 'vehiculos' puede insertar la fila en
-- documentacion_vehiculo pero no puede subir el archivo al bucket. Hallazgo del propose de
-- integracion-documentos (2026-08-05), verificado en vivo contra supabase db query --linked.

DROP POLICY "Read documentos-vehiculos" ON storage.objects;
DROP POLICY "Write documentos-vehiculos" ON storage.objects;
DROP POLICY "Update documentos-vehiculos" ON storage.objects;
DROP POLICY "Delete documentos-vehiculos" ON storage.objects;

CREATE POLICY "Read documentos-vehiculos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write documentos-vehiculos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('vehiculos', 'write'));
CREATE POLICY "Update documentos-vehiculos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('vehiculos', 'write'));
CREATE POLICY "Delete documentos-vehiculos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('vehiculos', 'write'));
