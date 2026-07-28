CREATE SCHEMA IF NOT EXISTS conductores;
REVOKE ALL ON SCHEMA conductores FROM anon;
GRANT USAGE ON SCHEMA conductores TO authenticated;

CREATE TYPE conductores.estado_conductor AS ENUM ('operando', 'fuera de servicio');
-- Bug fix (C-08/C-09 review): values must match the documented vehicle status
-- vocabulary (knowledge-base/04_modelo_de_datos.md §Vehiculo, CHANGES.md C-08 scope,
-- RN-VE-02 "vehículo fuera de servicio") — 'activo'/'inactivo' doesn't match what
-- RN-VE-02 and the future C-10 hoja-de-ruta filtering logic will check for.
CREATE TYPE conductores.estado_vehiculo AS ENUM ('habilitado', 'fuera de servicio');
-- Corrected (C-08 review, then corrected again with Enzo against the docx): my first pass
-- here dropped 'gasto' as supposedly redundant with facturacion.gastos_vehiculos and added
-- vtv/rto to match the frontend's RegistroHabilitacion contract -- wrong call. Enzo confirmed
-- against docs/core/Traslados-Modelo-Datos.docx: the real field is "Categoría / Tipo de
-- intervención: gasto, mantenimiento preventivo o mantenimiento correctivo" -- 'gasto' is
-- correct structure, not a duplicate. Reverted to the original 3 values. VTV/RTO vencimiento
-- tracking stays a separate open question (already flagged in CHANGES.md's C-08 discrepancy
-- note: docx tracks VTV/RTO as generic document-catalog items with no vencimiento of their
-- own, "el vencimiento se rastrea vía mantenimiento" -- unresolved how, not via this enum) --
-- not decided here.
CREATE TYPE conductores.categoria_mantenimiento AS ENUM ('gasto', 'preventivo', 'correctivo');

CREATE TABLE conductores.conductores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    fecha_nacimiento DATE,
    domicilio TEXT,
    dni TEXT NOT NULL UNIQUE,
    cuil TEXT,
    telefono TEXT,
    estado conductores.estado_conductor DEFAULT 'operando',
    notas TEXT
);

CREATE TABLE conductores.documentacion_conductores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conductor_id UUID NOT NULL REFERENCES conductores.conductores(id) ON DELETE CASCADE,
    tipo_documento TEXT NOT NULL,
    archivo_url TEXT NOT NULL
);

CREATE TABLE conductores.vehiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT,
    patente TEXT NOT NULL UNIQUE,
    modelo TEXT,
    capacidad INT,
    año INT,
    notas TEXT,
    estado conductores.estado_vehiculo DEFAULT 'habilitado'
);

-- Add missing FKs to previous schemas that depend on vehiculos
ALTER TABLE pacientes.historial_recorridos ADD CONSTRAINT fk_vehiculo FOREIGN KEY (id_vehiculo) REFERENCES conductores.vehiculo(id) ON DELETE SET NULL;
ALTER TABLE facturacion.gastos_vehiculos ADD CONSTRAINT fk_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES conductores.vehiculo(id) ON DELETE CASCADE;

CREATE TABLE conductores.accesorios_vehiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE CASCADE,
    accesorio_id UUID NOT NULL REFERENCES pacientes.accesorios(id) ON DELETE CASCADE,
    UNIQUE(vehiculo_id, accesorio_id)
);

-- Bug fix (C-08 review): the draft split this into a "documento_vehiculo" catalog table
-- (holding archivo_url, i.e. an actual uploaded file) joined to vehiculo via a many-to-many
-- table. That shape is wrong for uploaded documents — nothing stopped the same documento_id
-- (the same uploaded file) from being linked to multiple different vehiculos via
-- documentacion_vehiculo, which makes no sense for a per-vehicle file (VTV/cédula/seguro
-- scan). A real reusable catalog (no per-instance file) is the right shape for M2M, as
-- correctly done above for conductores.accesorios_vehiculo. A per-vehicle uploaded document
-- is 1 file : 1 vehiculo, same pattern already used correctly for
-- conductores.documentacion_conductores right above (vehiculo_id + tipo_documento + archivo_url
-- in one row, no separate catalog table). Collapsed into a single table to match that pattern.
CREATE TABLE conductores.documentacion_vehiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE CASCADE,
    tipo_documento TEXT NOT NULL,
    archivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conductores.mantenimiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE CASCADE,
    categoria conductores.categoria_mantenimiento NOT NULL,
    fecha DATE NOT NULL,
    fecha_proximo_vencimiento DATE,
    km_actual INT,
    km_proximo_vencimiento INT
);

CREATE TABLE conductores.conductores_vehiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conductor_id UUID NOT NULL REFERENCES conductores.conductores(id) ON DELETE CASCADE,
    vehiculo_id UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE CASCADE,
    fecha_init DATE NOT NULL,
    fecha_fin_semana DATE NOT NULL,
    UNIQUE(conductor_id, vehiculo_id, fecha_init)
);

ALTER TABLE conductores.conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores.documentacion_conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores.vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores.accesorios_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores.documentacion_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores.mantenimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores.conductores_vehiculos ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA conductores TO authenticated;

-- Policies
CREATE POLICY "Read conductores" ON conductores.conductores FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write conductores" ON conductores.conductores FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read documentacion_conductores" ON conductores.documentacion_conductores FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write documentacion_conductores" ON conductores.documentacion_conductores FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

-- Corrected against the docx: Vehículo, Accesorios del Vehículo, Documentación del Vehículo
-- and Mantenimiento each have their own "¿Quién puede ver/editar esto?" text, and all four say
-- "el módulo 'conductores'" verbatim -- there is no separate 'vehiculos' permission module in
-- the docx (Área 6 is literally titled "Conductores y Vehículos", one module). My first pass
-- here split them based on CHANGES.md's C-08/C-09 change boundaries, but change boundaries
-- (planning/build order) aren't the same thing as permission-module boundaries (RLS) -- the
-- docx is the structural authority and it's explicit all of these share 'conductores'.
CREATE POLICY "Read vehiculo" ON conductores.vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write vehiculo" ON conductores.vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read accesorios_vehiculo" ON conductores.accesorios_vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write accesorios_vehiculo" ON conductores.accesorios_vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read documentacion_vehiculo" ON conductores.documentacion_vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write documentacion_vehiculo" ON conductores.documentacion_vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read mantenimiento" ON conductores.mantenimiento FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write mantenimiento" ON conductores.mantenimiento FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

CREATE POLICY "Read conductores_vehiculos" ON conductores.conductores_vehiculos FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write conductores_vehiculos" ON conductores.conductores_vehiculos FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

-- Triggers
CREATE TRIGGER trg_audit_conductores AFTER INSERT OR UPDATE OR DELETE ON conductores.conductores FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_vehiculos AFTER INSERT OR UPDATE OR DELETE ON conductores.vehiculo FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_documentacion_conductores AFTER INSERT OR UPDATE OR DELETE ON conductores.documentacion_conductores FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_accesorios_vehiculo AFTER INSERT OR UPDATE OR DELETE ON conductores.accesorios_vehiculo FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_documentacion_vehiculo AFTER INSERT OR UPDATE OR DELETE ON conductores.documentacion_vehiculo FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_mantenimiento AFTER INSERT OR UPDATE OR DELETE ON conductores.mantenimiento FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_conductores_vehiculos AFTER INSERT OR UPDATE OR DELETE ON conductores.conductores_vehiculos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
