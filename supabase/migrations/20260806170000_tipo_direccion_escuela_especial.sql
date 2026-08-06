-- Agrega 'escuela-especial' al enum pacientes.tipo_direccion (RF-113), pedido directo de Enzo
-- 2026-08-06. Aditivo: ALTER TYPE ... ADD VALUE no afecta filas existentes ni ningún otro valor
-- del enum. Se ubica después de 'escuela' por orden lógico de lectura, sin efecto funcional.
ALTER TYPE pacientes.tipo_direccion ADD VALUE 'escuela-especial' AFTER 'escuela';
