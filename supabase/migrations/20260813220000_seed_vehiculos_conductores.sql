-- Migration: seed_vehiculos_conductores
-- Description: Datos iniciales de ejemplo para poder armar hojas de ruta — sin esto, el módulo de
-- conductores arranca vacío y no hay vehículo ni conductor para asignar en la demo. Fuente:
-- frontend/src/shared/lib/mocks/vehiculosFixture.ts y conductoresFixture.ts (fixture de flota,
-- C-08/C-09, y fixture de conductores, C-10).
--
-- Idempotente: ON CONFLICT DO NOTHING sobre los UNIQUE naturales (patente en vehiculo, dni en
-- conductores). SIN UUID fijos: los genera la DB (gen_random_uuid).
--
-- Estados con el valor EXACTO del enum de la migración de schema (20260724100006): el fixture del
-- frontend usa 'fuera-de-servicio' con guiones, pero el enum real es 'fuera de servicio' (con
-- espacios) — este seed no repite el error del fixture.
--
-- NO se siembran asignaciones semanales (conductores_vehiculos), habilitaciones ni mantenimiento:
-- el objetivo es que existan vehículos y conductores para poder armar hojas de ruta, nada más.
--
-- ⚠️ Se redacta como artefacto de diseño. NO se aplica desde el agente — `supabase db push` es
-- acción explícita de Enzo, junto con el resto de las migraciones de esta rama.

INSERT INTO conductores.vehiculo (tipo, patente, modelo, capacidad, kilometraje, notas, estado) VALUES
  -- Etios: única unidad con notas (campo ejercitado en el fixture de flota).
  ('sedan', 'AC123DE', 'Toyota Etios', 4, 85000,
   'Aire acondicionado con pérdida de gas — revisar antes del verano.', 'habilitado'),
  ('furgon', 'AD456FG', 'Renault Kangoo', 5, 46000, NULL, 'habilitado'),
  -- Partner: fuera de servicio (enum real, no 'fuera-de-servicio' como el fixture).
  ('furgon', 'AE789HI', 'Peugeot Partner', 3, 61200, NULL, 'fuera de servicio')
ON CONFLICT (patente) DO NOTHING;

INSERT INTO conductores.conductores (
  nombre, apellido, fecha_nacimiento, domicilio, dni, cuil, telefono, estado, notas
) VALUES
  -- González: sin restricciones ni observaciones.
  ('Marcos', 'González', NULL, 'Av. Rivadavia 4500, CABA', '28456789', '20-28456789-3', '11-4444-5555', 'operando', NULL),
  -- Pérez: restricción de perfil redactada en notas (texto libre, patrón D6-B del fixture).
  ('Carlos', 'Pérez', '1958-03-12', 'Calle 50 N°1234, La Plata', '15789456', '20-15789456-9', '11-5555-6666', 'operando',
   'No traslada pacientes con carga física: no trasladar con silla rígida ni asistencia de carga física.'),
  -- Díaz: fuera de servicio (licencia médica en el fixture) — enum real, no 'fuera-de-servicio'.
  ('Lucía', 'Díaz', NULL, 'Mitre 800, Vicente López', '32112233', '27-32112233-4', NULL, 'fuera de servicio', NULL)
ON CONFLICT (dni) DO NOTHING;