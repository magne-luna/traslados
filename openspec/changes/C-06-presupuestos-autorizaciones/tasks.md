# Tasks: C-06 Presupuestos y Autorizaciones (backend) — cierre de schema

## Phase 1: Schema

- [x] 1.1 Agregar `monto_autorizado NUMERIC(10,2)`, `vigencia_desde DATE` a `facturacion.autorizacion`
- [x] 1.2 Trigger `validar_autorizacion_monto` (RN-PA-01, rechazo duro)

> Se descartó agregar `archivo_nombre`/`archivo_cargado_en`: redundante (el nombre ya viaja en
> `archivo_url`, la fecha ya es `fecha_emision`/`fecha_respuesta`). Las EF exponen `archivoUrl`
> directamente — pendiente de reconciliar con el tipo `ArchivoAdjunto` del frontend (contrato
> desactualizado, no bloqueante porque el frontend real todavía consume el mock).

## Phase 2: Edge Functions

- [x] 2.1 `supabase/functions/presupuestos/index.ts` (CRUD `facturacion.presupuesto`, patrón `pacientes`/`obra-social`)
- [x] 2.2 `supabase/functions/autorizaciones/index.ts` (CRUD `facturacion.autorizacion`, incluye `?presupuestoId=` para `getByPresupuestoId`)

## Phase 3: Deploy (requiere OK explícito)

- [x] 3.1 `supabase db push` (schema de 1.1/1.2, ya pusheado en `20260729130000_schema_autorizacion_monto_vigencia.sql`)
- [x] 3.2 `supabase functions deploy presupuestos`
- [x] 3.3 `supabase functions deploy autorizaciones`
