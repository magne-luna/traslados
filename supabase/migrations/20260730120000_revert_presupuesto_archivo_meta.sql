-- Migration: revert_presupuesto_archivo_meta
-- Description: revierte 20260729160000_schema_presupuesto_autorizacion_archivo_meta.sql. Ese
-- archivo se habia descartado (decision: el frontend usa archivo_url directamente, sin
-- nombre/fecha de carga separados -- el nombre ya viaja en la URL, la fecha ya es
-- fecha_emision/fecha_respuesta) pero volvio a aparecer en disco y se aplico de nuevo por
-- error via `supabase db push`. Las Edge Functions de presupuestos/autorizaciones ya usan
-- archivo_url, nunca estas 2 columnas -- sin uso, se dropean.

ALTER TABLE facturacion.presupuesto
  DROP COLUMN archivo_nombre,
  DROP COLUMN archivo_cargado_en;

ALTER TABLE facturacion.autorizacion
  DROP COLUMN archivo_nombre,
  DROP COLUMN archivo_cargado_en;
