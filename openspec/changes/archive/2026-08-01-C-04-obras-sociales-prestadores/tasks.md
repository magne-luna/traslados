# Tasks: C-04 Obras Sociales y Prestadores (backend) — cierre de schema

## Phase 1: Schema

- [x] 1.1 Rename `tipo_factura` → `tipo_comprobante`, convert to `facturacion.tipo_factura` enum
- [x] 1.2 Add `plazo_cobro_dias`, `modalidad_facturacion`, `admite_pagos_parciales`, `identificador_origen` to `obra_social.obra_social`
- [x] 1.3 Add `orden`, `requerido` to `obra_social.requisitos_os`
- [x] 1.4 Create `obra_social.plantilla_campo` + RLS + audit trigger

> Confirmado aplicado en remoto (`supabase migration list`), aunque el archivo de migración
> local que hizo este cambio ya no existe en disco (borrado a propósito por el usuario,
> 2026-07-29) — ver memoria `feedback_no_db_changes`. No recrear sin que se pida.

## Phase 2: Edge Functions

- [x] 2.1 `supabase/functions/obra-social/index.ts` (ya existía, cubre `obra_social.obra_social`)
- [x] 2.2 `supabase/functions/prestadores/index.ts`
- [x] 2.3 `supabase/functions/requisitos-os/index.ts` (checklist, `?obraSocialId=`, find-or-create sobre `tipos_documento`)
- [x] 2.4 `supabase/functions/plantilla-campo/index.ts` (`?obraSocialId=`)

## Phase 3: Deploy (requires explicit go-ahead)

- [x] 3.1 `supabase db push` (ya aplicado en remoto)
- [x] 3.2 `supabase functions deploy prestadores`
- [x] 3.3 `supabase functions deploy requisitos-os`
- [x] 3.4 `supabase functions deploy plantilla-campo`
