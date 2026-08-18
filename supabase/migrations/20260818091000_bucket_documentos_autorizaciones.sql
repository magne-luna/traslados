-- Migration: bucket_documentos_autorizaciones
-- Description: integracion-documentos-autorizaciones (D2). Quinto bucket privado de
-- documentos, mismo patron que los 4 creados en 20260727000001_create_buckets.sql +
-- 20260729100001_storage_objects_rls.sql (C-01/C-03).
--
-- Gateo por modulo: documentos-autorizaciones -> presupuestos (NO un modulo nuevo).
-- presupuestos ya gatea facturacion.autorizacion (tabla, ver 20260730140000) y la Edge
-- Function `autorizaciones` (requirePermiso('presupuestos', 'write')). Reusarlo evita dejar
-- sin acceso al archivo a cuentas que hoy ya tienen acceso a la fila; un modulo nuevo
-- requeriria re-onboarding manual de permisos sin beneficio.

INSERT INTO storage.buckets (id, name, public) VALUES
  ('documentos-autorizaciones', 'documentos-autorizaciones', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Read documentos-autorizaciones" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-autorizaciones' AND modulos.tiene_permiso('presupuestos', 'read'));
CREATE POLICY "Write documentos-autorizaciones" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-autorizaciones' AND modulos.tiene_permiso('presupuestos', 'write'));
CREATE POLICY "Update documentos-autorizaciones" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-autorizaciones' AND modulos.tiene_permiso('presupuestos', 'write'));
CREATE POLICY "Delete documentos-autorizaciones" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-autorizaciones' AND modulos.tiene_permiso('presupuestos', 'write'));
