-- Migration: seed_obras_sociales_prestadores
-- Change: prestadores-crud (rama de demo). Datos de ejemplo para poder mostrarle el concepto a
-- Andrea apenas se aplique esta rama — sin esto, las pantallas de Obras Sociales y Prestadores
-- arrancan vacías y no hay nada que ver ni vincular en la demo.
--
-- Idempotente (ON CONFLICT DO NOTHING sobre el UNIQUE de cuit) para poder correr esta migración
-- más de una vez sin duplicar filas. Todos los campos con DEFAULT en la base (plazo_cobro_dias,
-- tipo_comprobante, modalidad_facturacion, admite_pagos_parciales, identificador_origen,
-- formato_afiliado) se omiten acá a propósito — quedan en su valor por defecto, no se inventa
-- ningún dato de negocio que el cliente no confirmó.
--
-- ⚠️ Se redacta como artefacto de diseño. NO se aplica desde el agente — `supabase db push` es
-- acción explícita de Enzo, junto con el resto de las migraciones de esta rama.

INSERT INTO obra_social.obra_social (razon_social, cuit, codigo, direccion, telefono, condicion_iva) VALUES
  ('OSECAC', '30-54155200-6', 'OS-01', 'Av. de Mayo 560, CABA', '11-4331-4000', 'Exento'),
  ('OSDE', '30-52588935-6', 'OS-02', 'Av. Leandro N. Alem 1067, CABA', '11-4108-3000', 'Exento'),
  ('Swiss Medical', '30-68312455-2', 'OS-03', 'Av. Corrientes 922, CABA', '11-4321-2727', 'Exento')
ON CONFLICT (cuit) DO NOTHING;

INSERT INTO obra_social.prestadores (razon_social, cuit, direccion, telefono) VALUES
  ('Traslados Andrea Pastor', '30-71234567-8', 'Av. Rivadavia 4500, CABA', '11-4555-1234'),
  ('Transporte Especial del Sur', '30-70987654-3', 'Av. Boedo 1200, CABA', '11-4931-5678')
ON CONFLICT (cuit) DO NOTHING;

-- Vínculo N:N de ejemplo (design.md D2, supuesto provisorio #1, sin confirmar con Andrea):
-- OSECAC y OSDE atendidas por "Traslados Andrea Pastor"; Swiss Medical también por
-- "Transporte Especial del Sur" — para que la demo muestre el caso N:N real (un prestador con
-- varias obras sociales, y una obra social con más de un prestador no se ejemplifica acá para no
-- inventar un caso de negocio que nadie pidió, pero queda fácil de armar a mano en la demo).
INSERT INTO obra_social.obra_social_prestador (obra_social_id, prestador_id)
SELECT os.id, p.id
FROM obra_social.obra_social os, obra_social.prestadores p
WHERE (os.cuit, p.cuit) IN (
  ('30-54155200-6', '30-71234567-8'), -- OSECAC <-> Traslados Andrea Pastor
  ('30-52588935-6', '30-71234567-8'), -- OSDE <-> Traslados Andrea Pastor
  ('30-68312455-2', '30-70987654-3')  -- Swiss Medical <-> Transporte Especial del Sur
)
ON CONFLICT (obra_social_id, prestador_id) DO NOTHING;
