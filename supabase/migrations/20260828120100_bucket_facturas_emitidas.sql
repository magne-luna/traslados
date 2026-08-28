-- Migration: bucket_facturas_emitidas
-- Change: openspec/changes/facturacion-electronica-arca/ (design.md D7, tasks.md 2B.6)
--
-- Sexto bucket privado, mismo patrón exacto que `20260818091000_bucket_documentos_autorizaciones.sql`
-- (que a su vez sigue `20260727000001_create_buckets.sql` + `20260729100001_storage_objects_rls.sql`):
-- `INSERT INTO storage.buckets ... public = false` + 4 policies sobre `storage.objects`
-- (SELECT/INSERT/UPDATE/DELETE) gateadas por `modulos.tiene_permiso('facturacion', <nivel>)`.
--
-- ¿Qué guarda? El PDF del comprobante fiscal que la Edge Function `facturar` genera con `pdf-lib`
-- inmediatamente después de obtener el CAE de ARCA. Clave de objeto determinista:
--   {facturaId}/{cbteTipo}-{ptoVta}-{cbteNro}.pdf
-- un PDF por factura (RN-FA-06: el PDF NO se regenera si después se corrige la factura). La ruta
-- se persiste en `facturacion.facturas.comprobante_pdf_url` (columna de `20260828120000_factura_arca.sql`).
--
-- Gateo por módulo `facturacion` (no un módulo nuevo): es el mismo módulo que ya gatea
-- `facturacion.facturas` / `facturacion.cobros` y la Edge Function `facturar`
-- (`requirePermiso('facturacion', ...)`). Un módulo nuevo dejaría sin acceso al PDF a las cuentas
-- que ya tienen acceso a la factura.
--
-- Acceso desde el frontend: SOLO vía signed URL de vigencia acotada (la EF o el repo la generan
-- con el service_role / `createSignedUrl`). La UI nunca recibe una URL pública — el bucket es
-- `public = false` y no hay ninguna policy `TO anon` / `TO public`.
--
-- La EF sube el objeto con el cliente service_role (`admin.storage.from('facturas-emitidas').upload`)
-- — el objeto se sube en nombre del sistema, no del usuario; la policy de INSERT de abajo es la
-- segunda capa de defensa (para cualquier escritura que sí venga de una sesión de usuario).
--
-- Rollback:
--   DROP POLICY "Read facturas-emitidas"   ON storage.objects;
--   DROP POLICY "Write facturas-emitidas"  ON storage.objects;
--   DROP POLICY "Update facturas-emitidas" ON storage.objects;
--   DROP POLICY "Delete facturas-emitidas" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'facturas-emitidas';   -- solo si está vacío
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md 2B.9).
-- Antes y después: `supabase db advisors --linked --type security` — el delta no debe sumar
-- ningún hallazgo nuevo.

INSERT INTO storage.buckets (id, name, public) VALUES
  ('facturas-emitidas', 'facturas-emitidas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Read facturas-emitidas" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write facturas-emitidas" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'write'));
CREATE POLICY "Update facturas-emitidas" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'write'));
CREATE POLICY "Delete facturas-emitidas" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'write'));
