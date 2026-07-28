-- Migration: seed_modulos
-- Description: seed modulos.modulos with the real permission-module catalog.
--
-- Corrected against docs/core/Traslados-Modelo-Datos.docx (structural source of truth):
-- the docx's own Módulos section gives the catalog example verbatim as "(por ejemplo:
-- pacientes, obra_social, facturación, conductores)", and every single domain entity's
-- "¿Quién puede ver/editar esto?" text names exactly one of these four modules -- including
-- Presupuesto/Autorización/Cobros/Gastos de Vehículos (all "el módulo 'facturacion'", not a
-- separate presupuestos-autorizaciones module) and Vehículo/Mantenimiento/Documentación
-- vehicular (all "el módulo 'conductores'", not a separate vehiculos module). "usuarios" is
-- deliberately NOT a module here: access to usuarios.usuarios is governed directly by `rol`
-- (admin vs. own-row-only), never by modulos.tiene_permiso() -- see
-- 20260724100002_schema_usuarios.sql. "dashboard" is deliberately NOT a module either: the
-- docx doesn't mention it, and C-11 (panel-principal-reportes) is pure read-aggregation with
-- no RLS-gated table of its own -- access flows through whatever modules the underlying data
-- already requires.
--
-- My first pass at this seed used the frontend's 9 feature-folder names instead of the docx's
-- 4 real modules -- wrong call, corrected here.

INSERT INTO modulos.modulos (tipo_modulo) VALUES
  ('pacientes'),
  ('obra_social'),
  ('facturacion'),
  ('conductores')
ON CONFLICT (tipo_modulo) DO NOTHING;
