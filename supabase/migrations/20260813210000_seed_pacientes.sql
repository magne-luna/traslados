-- Migration: seed_pacientes
-- Description: Datos iniciales de ejemplo para poder armar hojas de ruta y mostrárselas a Andrea
-- apenas se aplique esta rama — sin esto, el módulo de pacientes arranca vacío y no hay nada para
-- vincular en la demo. Fuente: frontend/src/shared/lib/mocks/pacientesFixture.ts (3 pacientes con
-- los casos relevantes: obra social por CUIT, sin obra social, con y sin amparo judicial).
--
-- Idempotente: ON CONFLICT (dni) DO NOTHING sobre el UNIQUE natural de pacientes.paciente; las
-- direcciones no tienen constraint UNIQUE (la tabla nació sin él), así que usan
-- INSERT ... SELECT ... WHERE NOT EXISTS por (paciente, calle) para poder rerunear la migración
-- sin duplicar filas. SIN UUID fijos: los genera la DB (gen_random_uuid).
--
-- Omitidos a propósito (nullable, el schema manda): datos clínicos, CUD, accesorios, personas a
-- cargo y coberturas (num_afiliado) no se siembran — el objetivo es tener pacientes con
-- direcciones para armar recorridos/hojas de ruta, nada más. `dias`/`horario` de las direcciones
-- del fixture también se omiten: la función pacientes.crear_paciente_completo no los persiste
-- (discrepancia #4 de knowledge-base/04_modelo_de_datos.md §Discrepancias, sigue vigente), y no
-- se siembra a mano un dato operativo que el flujo de alta real nunca produce.
--
-- ⚠️ Se redacta como artefacto de diseño. NO se aplica desde el agente — `supabase db push` es
-- acción explícita de Enzo, junto con el resto de las migraciones de esta rama.

INSERT INTO pacientes.paciente (
  nombre_a, nombre_b, apellido_a, apellido_b,
  fecha_nacimiento, dni, cuil_titular, obra_social_id, amparo_judicial, amparo_judicial_aclaracion
) VALUES
  -- Martina Gómez Díaz, Sol — OSECAC (resuelta por CUIT, patrón del repo), sin amparo.
  ('Martina', 'Sol', 'Gómez', 'Díaz', '2015-03-12', '45123456', '27-30111222-4',
   (SELECT id FROM obra_social.obra_social WHERE cuit = '30-54155200-6'), false, NULL),
  -- Facundo Pereyra — OSECAC, amparo judicial con aclaración.
  ('Facundo', NULL, 'Pereyra', NULL, '2010-11-02', '46987654', '20-25333444-5',
   (SELECT id FROM obra_social.obra_social WHERE cuit = '30-54155200-6'), true,
   'Amparo judicial N°4521/22 — cobertura al 100%.'),
  -- Brisa Ledesma — sin obra social, sin amparo.
  ('Brisa', NULL, 'Ledesma', NULL, '2018-06-20', '48222111', '27-28555666/01', NULL, false, NULL)
ON CONFLICT (dni) DO NOTHING;

-- Direcciones vinculadas al paciente por DNI (subselect del id, patrón del repo). El fixture de
-- Brisa no trae dirección: se le asigna un domicilio real de referencia en La Plata ('Calle 7
-- N°1520') que se ajustará con los datos reales del cliente. `numero` se omite siempre
-- (discrepancia #5: el flujo de alta persiste NULL).
INSERT INTO pacientes.direcciones (paciente_id, calle, tipo_lugar, localidad)
SELECT p.id, v.calle, v.tipo_lugar::pacientes.tipo_direccion, v.localidad
FROM (VALUES
  ('45123456', 'Av. Rivadavia 4500',     'domicilio', 'CABA'),
  ('45123456', 'Escuela N°12, Bulnes 1200', 'escuela',   'CABA'),
  ('46987654', 'Calle 50 N°850',         'domicilio', 'La Plata'),
  ('48222111', 'Calle 7 N°1520',         'domicilio', 'La Plata') -- Brisa: dirección de referencia, a ajustar con datos reales
) AS v(dni, calle, tipo_lugar, localidad)
JOIN pacientes.paciente p ON p.dni = v.dni
WHERE NOT EXISTS (
  SELECT 1 FROM pacientes.direcciones d
  WHERE d.paciente_id = p.id AND d.calle = v.calle
);