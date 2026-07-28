CREATE SCHEMA IF NOT EXISTS pacientes;
REVOKE ALL ON SCHEMA pacientes FROM anon;
GRANT USAGE ON SCHEMA pacientes TO authenticated;

CREATE TABLE pacientes.paciente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_a TEXT NOT NULL,
    nombre_b TEXT,
    apellido_a TEXT NOT NULL,
    apellido_b TEXT,
    fecha_nacimiento DATE,
    dni TEXT NOT NULL UNIQUE,
    cuil_titular TEXT,
    domicilio TEXT,
    obra_social_id UUID REFERENCES obra_social.obra_social(id) ON DELETE SET NULL,
    amparo_judicial BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pacientes.cud (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    numero_cud TEXT NOT NULL,
    emision DATE,
    vencimiento DATE,
    vigente BOOLEAN DEFAULT true
);

CREATE TABLE pacientes.clinicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL UNIQUE REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    diagnostico JSONB,
    condicion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pacientes.accesorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL,
    descripcion TEXT
);

CREATE TABLE pacientes.accesorios_pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    accesorio_id UUID NOT NULL REFERENCES pacientes.accesorios(id) ON DELETE CASCADE,
    UNIQUE(paciente_id, accesorio_id)
);

CREATE TABLE pacientes.personas_a_cargo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    dni TEXT,
    telefono TEXT,
    telefono_alternativo TEXT
);

CREATE TABLE pacientes.direcciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    calle TEXT NOT NULL,
    numero TEXT,
    tipo_lugar TEXT
);

CREATE TABLE pacientes.recorridos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    id_dir_inicial UUID NOT NULL REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT,
    id_dir_final UUID NOT NULL REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT,
    dia_semana TEXT NOT NULL,
    hora TIME NOT NULL
);

CREATE TABLE pacientes.historial_recorridos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    id_vehiculo UUID, -- FK to conductores.vehiculo added in later migration
    id_dir_inicial UUID NOT NULL REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT,
    id_dir_final UUID NOT NULL REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT,
    estado TEXT
);

CREATE TABLE pacientes.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    id_tipo_documento UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT,
    archivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE obra_social.coberturas_paciente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id) ON DELETE CASCADE,
    num_afiliado TEXT,
    fecha_desde DATE,
    fecha_hasta DATE
);

-- RLS
ALTER TABLE pacientes.paciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.cud ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.clinicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.accesorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.accesorios_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.personas_a_cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.recorridos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.historial_recorridos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE obra_social.coberturas_paciente ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA pacientes TO authenticated;
GRANT ALL ON obra_social.coberturas_paciente TO authenticated;

-- Policies for pacientes
CREATE POLICY "Read pacientes" ON pacientes.paciente FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write pacientes" ON pacientes.paciente FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read cud" ON pacientes.cud FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write cud" ON pacientes.cud FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read clinicos" ON pacientes.clinicos FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write clinicos" ON pacientes.clinicos FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read accesorios" ON pacientes.accesorios FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write accesorios" ON pacientes.accesorios FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read accesorios_pacientes" ON pacientes.accesorios_pacientes FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write accesorios_pacientes" ON pacientes.accesorios_pacientes FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read personas_a_cargo" ON pacientes.personas_a_cargo FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write personas_a_cargo" ON pacientes.personas_a_cargo FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read direcciones" ON pacientes.direcciones FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write direcciones" ON pacientes.direcciones FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read recorridos" ON pacientes.recorridos FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write recorridos" ON pacientes.recorridos FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read historial_recorridos" ON pacientes.historial_recorridos FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write historial_recorridos" ON pacientes.historial_recorridos FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

CREATE POLICY "Read documentos" ON pacientes.documentos FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write documentos" ON pacientes.documentos FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

-- Corrected against the docx: "Cobertura del Paciente" says "el módulo 'obra_social'"
-- verbatim (underscore, singular) -- same correction as
-- 20260724100003_schema_obra_social.sql.
CREATE POLICY "Read coberturas_paciente" ON obra_social.coberturas_paciente FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write coberturas_paciente" ON obra_social.coberturas_paciente FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

-- Triggers
CREATE TRIGGER trg_audit_pacientes AFTER INSERT OR UPDATE OR DELETE ON pacientes.paciente FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_cud AFTER INSERT OR UPDATE OR DELETE ON pacientes.cud FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_clinicos AFTER INSERT OR UPDATE OR DELETE ON pacientes.clinicos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_accesorios AFTER INSERT OR UPDATE OR DELETE ON pacientes.accesorios FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_accesorios_pacientes AFTER INSERT OR UPDATE OR DELETE ON pacientes.accesorios_pacientes FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_personas_a_cargo AFTER INSERT OR UPDATE OR DELETE ON pacientes.personas_a_cargo FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_direcciones AFTER INSERT OR UPDATE OR DELETE ON pacientes.direcciones FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_recorridos AFTER INSERT OR UPDATE OR DELETE ON pacientes.recorridos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_historial_recorridos AFTER INSERT OR UPDATE OR DELETE ON pacientes.historial_recorridos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_documentos AFTER INSERT OR UPDATE OR DELETE ON pacientes.documentos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_coberturas_paciente AFTER INSERT OR UPDATE OR DELETE ON obra_social.coberturas_paciente FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
