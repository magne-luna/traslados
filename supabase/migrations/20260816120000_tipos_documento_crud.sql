-- Migration: tipos_documento_crud
-- Description: Gestionable al catalogo facturacion.tipos_documento (RF-410, mismo cambio que
-- 20260816090000_catalogo_accesorios_icono_activa para pacientes.accesorios). La cabecera de
-- 20260816100000_facturacion_tipos_documento.sql documentaba explicitamente este future:
-- "Si en el futuro este catalogo pasa a ser editable desde una pantalla, agregar el trigger en
-- ESE change, junto con la policy de escritura y la RPC correspondiente" — este es ESE change.
--
-- El catalogo ahora es gestionable desde la UI del detalle de factura (alta, edicion y baja
-- suave vía `activa`, mismo patron que pacientes.accesorios): se agregan los campos
-- `requerido` (el checklist documental de la factura se arma desde este catalogo) y `activa`
-- (baja logica). El DELETE NO se expone desde la UI: la baja es siempre suave (activa = false)
-- y la FK `documento_factura.id_tipo_documento ... ON DELETE RESTRICT` (20260816100000) sigue
-- protegiendo los tipos con documentos cargados; la policy de DELETE existe solo para espejar
-- el patron "Write ... FOR ALL" de los catalogos editables del repo.
--
-- Aditiva e inerte para el frontend hasta que el mismo change consume los campos nuevos.
-- SIN CREATE FUNCTION (sin RPC ni SECURITY DEFINER). La escribe el agente; la aplica la usuaria/Enzo.

ALTER TABLE facturacion.tipos_documento ADD COLUMN requerido BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facturacion.tipos_documento ADD COLUMN activa BOOLEAN NOT NULL DEFAULT true;

-- Backfill: espeja el seed de `CHECKLIST_DOCUMENTOS_FACTURA` (frontend/src/shared/lib/facturacion/
-- checklistDocumentosFactura.ts) — comprobante ARCA y asistencia son obligatorios para que la
-- factura tenga respaldo documental completo ante una auditoria; CODEM se deja opcional porque no
-- todas las prestaciones (ej. traslados sin codigo de discapacidad especifico) lo generan.
-- TODOS quedan activos (default true), ninguno nace desactivado.
UPDATE facturacion.tipos_documento SET requerido = true  WHERE tipo = 'Comprobante ARCA';
UPDATE facturacion.tipos_documento SET requerido = true  WHERE tipo = 'Asistencia';
UPDATE facturacion.tipos_documento SET requerido = false WHERE tipo = 'CODEM';

-- Escritura directa desde el cliente (anon + RLS, sin RPC ni EDGE): el frontend necesita
-- INSERT/UPDATE/DELETE para el CRUD inline del detalle de factura. Hasta aca la tabla solo tenia
-- GRANT SELECT (20260816100000); se amplia a ALL con el mismo criterio que
-- 20260729100000_schema_documento_factura.sql (GRANT ALL ON facturacion.documento_factura) — la
-- authorization efectiva la imponen las policies, el GRANT solo abre el canal PostgREST.
GRANT ALL ON facturacion.tipos_documento TO authenticated;

-- Policies: mismas reglas que "Read accesorios"/"Write accesorios" (20260724100004 +
-- 20260816090000) y "Read documento_factura"/"Write documento_factura" (20260729100000).
-- DROP POLICY IF EXISTS + CREATE POLICY: mismo estilo idempotente de 20260816090000.
DROP POLICY IF EXISTS "Read tipos_documento facturacion" ON facturacion.tipos_documento;
CREATE POLICY "Read tipos_documento facturacion" ON facturacion.tipos_documento FOR SELECT TO authenticated
  USING (modulos.tiene_permiso('facturacion', 'read'));

DROP POLICY IF EXISTS "Write tipos_documento facturacion" ON facturacion.tipos_documento;
CREATE POLICY "Write tipos_documento facturacion" ON facturacion.tipos_documento FOR ALL TO authenticated
  USING (modulos.tiene_permiso('facturacion', 'write'));

-- Audit: espeja el trigger de los catalogos editables del repo (trg_audit_tipos_doc de
-- obra_social.tipos_documento, 20260724100003; trg_audit_accesorios de pacientes.accesorios,
-- 20260724100004; trg_audit_documento_factura, 20260729100000). Diferido a este change a
-- proposito por la cabecera de 20260816100000 — antes no habia via de escritura desde el cliente
-- y el trigger hubiera sido codigo muerto; ahora cada alta/edicion/baja suave queda auditada.
CREATE TRIGGER trg_audit_tipos_documento_facturacion AFTER INSERT OR UPDATE OR DELETE ON facturacion.tipos_documento
  FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

-- Rollback: si hace falta revertir, en orden —
--   1. DROP TRIGGER trg_audit_tipos_documento_facturacion ON facturacion.tipos_documento;
--   2. DROP POLICY IF EXISTS "Write tipos_documento facturacion" ON facturacion.tipos_documento;
--   3. DROP POLICY IF EXISTS "Read tipos_documento facturacion" ON facturacion.tipos_documento;
--   4. REVOKE ALL ON facturacion.tipos_documento FROM authenticated;
--      GRANT SELECT ON facturacion.tipos_documento TO authenticated;
--   5. ALTER TABLE facturacion.tipos_documento DROP COLUMN activa;
--   6. ALTER TABLE facturacion.tipos_documento DROP COLUMN requerido;
--   Los UPDATEs del backfill no se revierten (los valores nuevos son los que el frontend
--   espera); si se quiere el estado previo habria que limpiar las filas creadas desde la UI.