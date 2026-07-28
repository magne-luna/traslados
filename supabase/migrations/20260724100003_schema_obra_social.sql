CREATE SCHEMA IF NOT EXISTS obra_social;
REVOKE ALL ON SCHEMA obra_social FROM anon;
GRANT USAGE ON SCHEMA obra_social TO authenticated;

CREATE TABLE obra_social.tipos_documento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL UNIQUE
);

CREATE TABLE obra_social.obra_social (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social TEXT NOT NULL,
    cuit TEXT NOT NULL UNIQUE,
    codigo TEXT,
    direccion TEXT,
    telefono TEXT,
    condicion_iva TEXT,
    tipo_factura TEXT
);

CREATE TABLE obra_social.requisitos_os (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id) ON DELETE CASCADE,
    tipo_documento_id UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE CASCADE,
    UNIQUE(obra_social_id, tipo_documento_id)
);

CREATE TABLE obra_social.prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social TEXT NOT NULL,
    cuit TEXT NOT NULL UNIQUE,
    direccion TEXT,
    telefono TEXT
);

-- RLS
ALTER TABLE obra_social.tipos_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_social.obra_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_social.requisitos_os ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_social.prestadores ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA obra_social TO authenticated;

-- Policies
-- Corrected against the docx: the module catalog example text itself reads "(por ejemplo:
-- pacientes, obra_social, facturación, conductores)" and every entity in this área says "el
-- módulo 'obra_social'" verbatim (underscore, singular) -- not the frontend folder name
-- 'obras-sociales'. My first pass here matched the frontend's routing convention instead of
-- the docx; reverted to the docx's actual identifier, which also matches this schema's own
-- name (obra_social), so tipo_modulo now equals the schema name here just like every other
-- domain.
CREATE POLICY "Read obra_social" ON obra_social.obra_social FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write obra_social" ON obra_social.obra_social FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

CREATE POLICY "Read prestadores" ON obra_social.prestadores FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write prestadores" ON obra_social.prestadores FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

CREATE POLICY "Read tipos_documento" ON obra_social.tipos_documento FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write tipos_documento" ON obra_social.tipos_documento FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

CREATE POLICY "Read requisitos_os" ON obra_social.requisitos_os FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write requisitos_os" ON obra_social.requisitos_os FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

-- Triggers
CREATE TRIGGER trg_audit_os AFTER INSERT OR UPDATE OR DELETE ON obra_social.obra_social FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_prestadores AFTER INSERT OR UPDATE OR DELETE ON obra_social.prestadores FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_tipos_doc AFTER INSERT OR UPDATE OR DELETE ON obra_social.tipos_documento FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_req_os AFTER INSERT OR UPDATE OR DELETE ON obra_social.requisitos_os FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
