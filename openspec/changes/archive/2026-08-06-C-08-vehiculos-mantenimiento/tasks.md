# Tasks: C-08 Vehículos y Mantenimiento (backend) — cierre de schema

## Phase 1: Schema

- [x] 1.1 Agregar `monto`, `descripcion`, `categoria_gasto` a `conductores.mantenimiento`
- [x] 1.2 Agregar `kilometraje` a `conductores.vehiculo`
- [x] 1.3 Crear `conductores.habilitaciones_vehiculo` + RLS + audit trigger

## Phase 2: Edge Functions

- [x] 2.1 `supabase/functions/vehiculos/index.ts` (CRUD + habilitaciones/gastos/accesorios embebidos)
- [x] 2.2 `supabase/functions/vehiculo-documentos/index.ts`

## Phase 3: Deploy (requiere OK explícito)

- [x] 3.1 `supabase db push`
- [x] 3.2 `supabase functions deploy vehiculos`
- [x] 3.3 `supabase functions deploy vehiculo-documentos`
