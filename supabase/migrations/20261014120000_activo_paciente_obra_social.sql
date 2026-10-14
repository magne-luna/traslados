-- Baja lógica de pacientes y obras sociales (reunión con Andrea, 2026-10-07): nunca se borran,
-- se inactivan. Presupuestos, facturas y hojas de ruta ya emitidos siguen apuntando a la fila.
-- Conductores y vehículos NO entran acá: reusan su `estado` existente ('fuera de servicio').
--
-- Sin policies nuevas: las de RLS existentes ("Write ..." FOR ALL) ya cubren el UPDATE de una
-- columna más en la misma tabla.

ALTER TABLE pacientes.paciente ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
ALTER TABLE obra_social.obra_social ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
