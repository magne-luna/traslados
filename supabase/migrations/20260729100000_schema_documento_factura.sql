-- Migration: schema_documento_factura
-- Description: C-03 gestion-documental-core. Facturas no tenia tabla de documentos pese a
-- que US-900 (RF-900 a RF-902) exige adjuntar imagenes/PDF tambien en el modulo Facturas.
-- Mismo patron ya usado por pacientes.documentos: FK a la entidad + FK al catalogo
-- compartido obra_social.tipos_documento + archivo_url.

CREATE TABLE facturacion.documento_factura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_id UUID NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    id_tipo_documento UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT,
    archivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE facturacion.documento_factura ENABLE ROW LEVEL SECURITY;
GRANT ALL ON facturacion.documento_factura TO authenticated;

CREATE POLICY "Read documento_factura" ON facturacion.documento_factura FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write documento_factura" ON facturacion.documento_factura FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

CREATE TRIGGER trg_audit_documento_factura AFTER INSERT OR UPDATE OR DELETE ON facturacion.documento_factura FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

-- Tipos de documento especificos de factura, nombrados en el scope de C-07 (CHANGES.md):
-- comprobante ARCA, asistencia, CODEM.
INSERT INTO obra_social.tipos_documento (tipo) VALUES
  ('comprobante ARCA'),
  ('asistencia'),
  ('CODEM')
ON CONFLICT (tipo) DO NOTHING;
