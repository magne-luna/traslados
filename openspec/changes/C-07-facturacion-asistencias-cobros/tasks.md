# Tasks: C-07 Facturación, Asistencias y Cobros (backend) — cierre de schema

## Phase 1: Schema

- [x] 1.1 Agregar `cantidad_km`, `fecha_estimada_cobro`, `prestacion`, `mes_facturado`,
      `anio_facturado`, `dependencia_y_retorno`, `domicilio_id`, `identificador_origen`,
      `identificador_valor` a `facturacion.facturas`
- [x] 1.2 Crear `facturacion.asistencia_prestacion` + RLS + audit trigger

## Phase 2: Edge Functions

- [x] 2.1 `supabase/functions/facturas/index.ts` (CRUD + asistencias embebidas, mapeo de `estado`)
- [x] 2.2 `supabase/functions/cobros/index.ts` (CRUD sin `PATCH`)

## Phase 3: Deploy (requiere OK explícito)

- [x] 3.1 `supabase db push`
- [x] 3.2 `supabase functions deploy facturas`
- [x] 3.3 `supabase functions deploy cobros`
