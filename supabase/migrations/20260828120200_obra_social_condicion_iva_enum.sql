-- Migration: obra_social_condicion_iva_enum
-- Change: openspec/changes/facturacion-electronica-arca/ (design.md D4-bis, tasks.md 4B.5)
--
-- ¿Qué hace? `obra_social.obra_social.condicion_iva` deja de ser `TEXT` libre y pasa a admitir
-- solo los ocho códigos que acepta ARCA (README de `arca-miniserver`), que son los canónicos:
--   IVA_RESPONSABLE_INSCRIPTO | IVA_SUJETO_EXENTO | CONSUMIDOR_FINAL |
--   IVA_RESPONSABLE_MONOTRIBUTO | MONOTRIBUTO | PROVEEDOR_DEL_EXTERIOR |
--   CLIENTE_DEL_EXTERIOR | IVA_LIBERADO
-- Se implementa como `CHECK (condicion_iva IS NULL OR condicion_iva IN (...))`, no como enum PG:
-- menos partes móviles, y `identificador_origen_factura` es el único enum del schema `obra_social`.
--
-- ¿Por qué? La emisión de Factura A (Edge Function `facturar`, este mismo change) necesita la
-- condición IVA del receptor como uno de esos códigos exactos. Cierra la discrepancia #14 de
-- `integracion-obra-social` ("condicion_iva sin valores enumerados en ninguna fuente"). Decisión
-- de la usuaria, 2026-08-28.
--
-- Backfill (verificado con `supabase db query --linked`, 2026-08-28 — 10 obras sociales):
--   'Exento' (3 filas)  -> 'IVA_SUJETO_EXENTO'
--   'respo'  (1 fila)   -> NULL   (dato de prueba incompleto; Andrea lo re-carga con el <select>
--                                  nuevo del formulario — no se adivina un valor fiscal)
--   NULL     (6 filas)  -> se mantiene NULL (una OS sin condición IVA cargada es válida; solo
--                          bloquea EMITIR Factura A, no el alta de la OS)
-- La regla general de backfill: cualquier valor que no sea uno de los 8 códigos ni NULL se
-- normaliza a NULL antes de agregar el CHECK, para que la migración no falle sobre datos viejos.
--
-- Rollback:
--   ALTER TABLE obra_social.obra_social DROP CONSTRAINT obra_social_condicion_iva_check;
--   (el backfill no se revierte: 'Exento'->'IVA_SUJETO_EXENTO' es una normalización, no una
--    pérdida de información; 'respo' era un dato inválido)
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md 4B.7).
-- No toca la RPC `obra_social.actualizar_obra_social_completa` (escribe el texto tal cual; el
-- CHECK lo valida en el INSERT/UPDATE). No toca RLS ni ninguna otra columna.

-- 1. Backfill: normalizar valores conocidos y descartar el resto -------------------------------

UPDATE obra_social.obra_social
  SET condicion_iva = 'IVA_SUJETO_EXENTO'
  WHERE condicion_iva = 'Exento';

UPDATE obra_social.obra_social
  SET condicion_iva = NULL
  WHERE condicion_iva IS NOT NULL
    AND condicion_iva NOT IN (
      'IVA_RESPONSABLE_INSCRIPTO', 'IVA_SUJETO_EXENTO', 'CONSUMIDOR_FINAL',
      'IVA_RESPONSABLE_MONOTRIBUTO', 'MONOTRIBUTO', 'PROVEEDOR_DEL_EXTERIOR',
      'CLIENTE_DEL_EXTERIOR', 'IVA_LIBERADO'
    );

-- 2. CHECK idempotente (ADD CONSTRAINT no tiene IF NOT EXISTS en PG15) -------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obra_social_condicion_iva_check'
      AND conrelid = 'obra_social.obra_social'::regclass
  ) THEN
    ALTER TABLE obra_social.obra_social
      ADD CONSTRAINT obra_social_condicion_iva_check
      CHECK (condicion_iva IS NULL OR condicion_iva IN (
        'IVA_RESPONSABLE_INSCRIPTO', 'IVA_SUJETO_EXENTO', 'CONSUMIDOR_FINAL',
        'IVA_RESPONSABLE_MONOTRIBUTO', 'MONOTRIBUTO', 'PROVEEDOR_DEL_EXTERIOR',
        'CLIENTE_DEL_EXTERIOR', 'IVA_LIBERADO'
      ));
  END IF;
END;
$$;

COMMENT ON COLUMN obra_social.obra_social.condicion_iva IS
  'Condición frente al IVA de la obra social (receptora de la Factura A). Uno de los 8 códigos de '
  'ARCA (CHECK obra_social_condicion_iva_check) o NULL. Lo consume la Edge Function `facturar`. '
  'Ver openspec/changes/facturacion-electronica-arca/design.md D4-bis (cierra discrepancia #14).';
