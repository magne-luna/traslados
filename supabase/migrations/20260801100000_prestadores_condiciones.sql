-- Migration: prestadores_condiciones
-- Change: prestadores-crud (rama de demo). US-300 literal: "se registra plazo de cobro, tipo de
-- comprobante (A/B/C) y demás condiciones particulares POR PRESTADOR". Supuesto provisorio #3 del
-- proposal, SIN confirmar con Andrea.
--
-- ⚠️ ADITIVA A PROPÓSITO: no dropea ni transforma ninguna columna existente. Las columnas gemelas
-- de obra_social.obra_social (plazo_cobro_dias, tipo_comprobante) quedan en su lugar, sin uso
-- desde el frontend a partir de este change — mismo patrón no destructivo que
-- facturacion.gastos_vehiculos (C-08) y coberturas_paciente.formato_afiliado (20260731140000).
--
-- ⚠️ ALCANCE DE ESTA MIGRACIÓN: work unit 1 de la cadena de PRs de prestadores-crud (chain
-- strategy: feature-branch-chain sobre feature/prestadores-crud). Agrega EXCLUSIVAMENTE las 2
-- columnas de condiciones particulares sobre obra_social.prestadores. La tabla de vínculo N:N
-- `obra_social.obra_social_prestador` (con su RLS y trigger de auditoría) es alcance de un work
-- unit posterior de la misma cadena, no de esta migración — design.md de prestadores-crud describe
-- el par completo en un único archivo conceptual, pero el corte de PR de esta rama de demo lo
-- separa en dos migraciones para mantener cada PR revisable de forma independiente.
--
-- ⚠️ Se redacta como artefacto de diseño. NO se aplica desde el agente: `supabase db push` es
-- siempre acción explícita de Enzo.

ALTER TABLE obra_social.prestadores
  ADD COLUMN plazo_cobro_dias INT NOT NULL DEFAULT 90,
  ADD COLUMN tipo_comprobante facturacion.tipo_factura NOT NULL DEFAULT 'A';

-- RLS de obra_social.prestadores ya cubre la tabla completa (policies "Read prestadores" /
-- "Write prestadores" y trigger trg_audit_prestadores de 20260724100003_schema_obra_social.sql) —
-- agregar 2 columnas no requiere policies nuevas.

-- ⚠️ NO se crea ningún archivo DROP COLUMN para obra_social.obra_social — D3 de design.md es
-- explícito: esa migración queda solo documentada en comentario dentro de design.md/proposal.md,
-- nunca como archivo, hasta que Andrea confirme el modelo.
