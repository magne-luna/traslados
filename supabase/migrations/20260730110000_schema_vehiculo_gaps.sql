-- Migration: schema_vehiculo_gaps
-- Description: C-08 vehiculos-mantenimiento. Cierra el gap real entre el schema existente
-- (conductores.vehiculo/mantenimiento, ya creados de rebote en C-08/C-09) y el contrato del
-- frontend (shared/types/vehiculo.ts).
--
-- Decision confirmada con Enzo: los gastos del vehiculo NO van en una tabla aparte
-- (facturacion.gastos_vehiculos queda sin usar, no se dropea porque no hay certeza de que nada
-- mas la referencie) -- van en `conductores.mantenimiento` con categoria = 'gasto', tal cual el
-- docx modela una unica "Categoria / Tipo de intervencion". Lo que le faltaba a esa tabla para
-- poder representar un GastoVehiculo completo: `monto`, `descripcion`, y una sub-categoria propia
-- del frontend (GastoVehiculo.categoria: 'mantenimiento'|'reparacion'|'service', que el docx no
-- tiene -- agregado real de negocio, nullable, solo aplica cuando categoria = 'gasto').
--
-- VTV/RTO (RegistroHabilitacion: tipo + fechaEmision + fechaVencimiento) no tenian donde
-- persistirse -- distinto de `documentacion_vehiculo` (archivo subido, sin vencimiento propio,
-- discrepancia ya documentada en CHANGES.md). Tabla nueva `habilitaciones_vehiculo`.
--
-- `kilometraje` (odometro actual) es dato propio que se actualiza con el uso del vehiculo, no se
-- deriva de nada -- columna propia en `vehiculo`. `kilometrajeUltimoService`/`fechaUltimoService`
-- SI se derivan del ultimo registro `categoria = 'preventivo'` de `mantenimiento` (evita 2 fuentes
-- de verdad para el mismo dato) -- sin columnas nuevas para esos 2, resueltos en la Edge Function.

CREATE TYPE conductores.categoria_gasto_vehiculo AS ENUM ('mantenimiento', 'reparacion', 'service');

ALTER TABLE conductores.mantenimiento
  ADD COLUMN monto NUMERIC(10, 2),
  ADD COLUMN descripcion TEXT,
  ADD COLUMN categoria_gasto conductores.categoria_gasto_vehiculo;

ALTER TABLE conductores.vehiculo
  ADD COLUMN kilometraje INT;

CREATE TYPE conductores.tipo_habilitacion AS ENUM ('vtv', 'rto');

CREATE TABLE conductores.habilitaciones_vehiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE CASCADE,
    tipo conductores.tipo_habilitacion NOT NULL,
    fecha_emision DATE,
    fecha_vencimiento DATE
);

ALTER TABLE conductores.habilitaciones_vehiculo ENABLE ROW LEVEL SECURITY;
GRANT ALL ON conductores.habilitaciones_vehiculo TO authenticated;

CREATE POLICY "Read habilitaciones_vehiculo" ON conductores.habilitaciones_vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('conductores', 'read'));
CREATE POLICY "Write habilitaciones_vehiculo" ON conductores.habilitaciones_vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('conductores', 'write'));

CREATE TRIGGER trg_audit_habilitaciones_vehiculo AFTER INSERT OR UPDATE OR DELETE ON conductores.habilitaciones_vehiculo FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
