-- Migration: schema_factura_gaps
-- Description: C-07 facturacion-asistencias-cobros. Cierra el gap real entre `facturacion.facturas`
-- y el contrato del frontend (shared/types/factura.ts) contra el docx.
--
-- 3 puntos ya marcados como bloqueantes en CHANGES.md (Discrepancias 1, 3, 4):
--   - No existe una entidad de asistencias/prestaciones (el docx no la tiene; la KB/US-400 sí,
--     RN-FA-01). Se modela como tabla propia `asistencia_prestacion`, 1---N con `facturas` --
--     aunque el frontend la embebe en `Factura.asistencias[]` sin repository propio (mismo
--     ciclo de vida que la factura), la base real necesita una tabla porque N filas variables
--     por factura no caben en una columna.
--   - `cantidad_km`: el docx solo modela "Valor del kilometro", no la cantidad -- sin esto no se
--     puede validar el cupo mensual de km (RN-FA-02/RN-PA-03) ni derivar el total.
--   - `fecha_estimada_cobro`: el docx no tiene ningun campo de plazo en dias.
--
-- 6 puntos adicionales, encontrados al revisar el contrato completo de Factura (no estaban
-- listados en el discrepancy log de CHANGES.md): `prestacion`, `mes_facturado`/`anio_facturado`
-- (periodo estructurado, design.md Decision 4 de facturacion-ui), `dependencia_y_retorno`,
-- `domicilio_id` (FK a pacientes.direcciones) e `identificador_origen`/`identificador_valor`
-- (snapshot de IdentificadorFactura al emitir, IN-01/RN-FA-06 -- nunca mutable retroactivamente).
-- Todas nullable: son NULL mientras la factura sigue en 'a facturar' (aun no emitida).

ALTER TABLE facturacion.facturas
  ADD COLUMN cantidad_km NUMERIC(10, 2),
  ADD COLUMN fecha_estimada_cobro DATE,
  ADD COLUMN prestacion TEXT,
  ADD COLUMN mes_facturado INT CHECK (mes_facturado BETWEEN 1 AND 12),
  ADD COLUMN anio_facturado INT,
  ADD COLUMN dependencia_y_retorno TEXT,
  ADD COLUMN domicilio_id UUID REFERENCES pacientes.direcciones(id),
  ADD COLUMN identificador_origen obra_social.identificador_origen_factura,
  ADD COLUMN identificador_valor TEXT;

CREATE TABLE facturacion.asistencia_prestacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_id UUID NOT NULL REFERENCES facturacion.facturas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    prestacion TEXT NOT NULL,
    dependencia TEXT,
    retorno TEXT,
    -- RN-FA-03: los sabados se incluyen en dias facturables solo si esta prestacion lo indica.
    factura_sabados BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE facturacion.asistencia_prestacion ENABLE ROW LEVEL SECURITY;
GRANT ALL ON facturacion.asistencia_prestacion TO authenticated;

CREATE POLICY "Read asistencia_prestacion" ON facturacion.asistencia_prestacion FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write asistencia_prestacion" ON facturacion.asistencia_prestacion FOR ALL TO authenticated USING (modulos.tiene_permiso('facturacion', 'write'));

CREATE TRIGGER trg_audit_asistencia_prestacion AFTER INSERT OR UPDATE OR DELETE ON facturacion.asistencia_prestacion FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
