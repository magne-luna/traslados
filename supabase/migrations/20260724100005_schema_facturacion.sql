CREATE SCHEMA IF NOT EXISTS facturacion;
REVOKE ALL ON SCHEMA facturacion FROM anon;
GRANT USAGE ON SCHEMA facturacion TO authenticated;

CREATE TYPE facturacion.estado_autorizacion AS ENUM ('pendiente', 'autorizada', 'judicializada', 'rechazada');
-- Corrected (C-07 review, then corrected again against CHANGES.md's own words): my first pass
-- here dropped 'pendiente' as supposedly redundant with 'a facturar' and hyphenated everything
-- to match the frontend's (provisional, mock-only) EstadoFactura type -- wrong, same mistake
-- as the categoria_mantenimiento one just above. CHANGES.md's own C-07 discrepancy note (point
-- 5) quotes the docx directly: "a facturar, cobrada, pagada parcialmente, pendiente" -- 4 real,
-- distinct states, missing only 'facturado' (needed as the trigger for the fecha_estimada_cobro
-- calculation, per that same note). Kept the original space-separated Spanish style (matches
-- the rest of this file's enums, e.g. estado_autorizacion), just added 'facturado'.
CREATE TYPE facturacion.estado_factura AS ENUM ('a facturar', 'pendiente', 'facturado', 'cobrado', 'pagado parcialmente');
CREATE TYPE facturacion.tipo_factura AS ENUM ('A', 'B', 'C');

CREATE TABLE facturacion.presupuesto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id),
    monto NUMERIC(10, 2),
    fecha_emision DATE,
    archivo_url TEXT
);

CREATE TABLE facturacion.autorizacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id UUID NOT NULL REFERENCES facturacion.presupuesto(id) ON DELETE CASCADE,
    estado facturacion.estado_autorizacion DEFAULT 'pendiente',
    fecha_respuesta DATE,
    cupo_mensual_dias INT,
    cupo_mensual_km INT,
    archivo_url TEXT
);

CREATE TABLE facturacion.facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id),
    descripcion TEXT,
    dias INT,
    valor_km NUMERIC(10, 2),
    monto NUMERIC(10, 2),
    estado facturacion.estado_factura DEFAULT 'a facturar',
    fecha_init DATE,
    fecha_tope DATE,
    tipo facturacion.tipo_factura
);

CREATE TABLE facturacion.cobros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facturas_id UUID NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    monto_pagado NUMERIC(10, 2) NOT NULL
);

CREATE TABLE facturacion.gastos_vehiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID, -- FK created in next migration
    monto NUMERIC(10, 2),
    fecha DATE
);

ALTER TABLE facturacion.presupuesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.autorizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.cobros ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion.gastos_vehiculos ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA facturacion TO authenticated;

-- Policies
CREATE POLICY "Read facturacion" ON facturacion.facturas FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write facturacion" ON facturacion.facturas FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

-- Corrected against the docx: Presupuesto's and Autorización's own "¿Quién puede ver/editar
-- esto?" text both say "el módulo 'facturacion'" verbatim -- same module as Facturas/Cobros/
-- Gastos de Vehículos, not a separate 'presupuestos-autorizaciones' module. My first pass here
-- split them based on CHANGES.md's C-06/C-07 change boundaries, but change boundaries (how the
-- work gets planned/built) aren't the same thing as permission-module boundaries (how RLS
-- gates access) -- the docx is the structural authority here and it's explicit both entities
-- share 'facturacion'.
CREATE POLICY "Read presupuesto" ON facturacion.presupuesto FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write presupuesto" ON facturacion.presupuesto FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

CREATE POLICY "Read autorizacion" ON facturacion.autorizacion FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write autorizacion" ON facturacion.autorizacion FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

CREATE POLICY "Read cobros" ON facturacion.cobros FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write cobros" ON facturacion.cobros FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

CREATE POLICY "Read gastos_vehiculos" ON facturacion.gastos_vehiculos FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write gastos_vehiculos" ON facturacion.gastos_vehiculos FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

-- Triggers
CREATE TRIGGER trg_audit_presupuestos AFTER INSERT OR UPDATE OR DELETE ON facturacion.presupuesto FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_facturas AFTER INSERT OR UPDATE OR DELETE ON facturacion.facturas FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_autorizacion AFTER INSERT OR UPDATE OR DELETE ON facturacion.autorizacion FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_cobros AFTER INSERT OR UPDATE OR DELETE ON facturacion.cobros FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_gastos_vehiculos AFTER INSERT OR UPDATE OR DELETE ON facturacion.gastos_vehiculos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
