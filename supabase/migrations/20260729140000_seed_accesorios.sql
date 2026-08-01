-- Migration: seed_accesorios
-- Description: pacientes.accesorios.tipo no tenia UNIQUE, y AccesorioMovilidad en el frontend
-- (shared/types/vehiculo.ts) es un conjunto cerrado de 5 valores reutilizado por Pacientes y
-- Conductores (docx: "Este mismo catalogo de Accesorios es reutilizado por el Area de
-- Conductores"). Agrega el constraint y seedea los 5 valores para que la Edge Function de
-- pacientes-accesorios pueda resolver tipo -> id sin ambiguedad.

ALTER TABLE pacientes.accesorios ADD CONSTRAINT accesorios_tipo_unique UNIQUE (tipo);

INSERT INTO pacientes.accesorios (tipo) VALUES
  ('silla-plegable'),
  ('silla-rigida'),
  ('silla-postural'),
  ('andador'),
  ('tripode')
ON CONFLICT (tipo) DO NOTHING;
