# Proposal: Vehículos y Mantenimiento (backend) — cierre de schema

## Intent

`conductores.vehiculo`/`mantenimiento`/`accesorios_vehiculo`/`documentacion_vehiculo` ya existían
(pusheados durante C-08/C-09, revisión de rebote — el docx unifica Vehículos y Conductores bajo
un único módulo de permisos 'conductores'). Cerrar el gap real contra el contrato del frontend
(`shared/types/vehiculo.ts`) antes de exponer las Edge Functions.

## Scope

### In Scope
- `conductores.mantenimiento`: agregar `monto`, `descripcion`, `categoria_gasto` (enum
  `'mantenimiento'|'reparacion'|'service'`, sub-clasificación del frontend sobre `categoria =
  'gasto'`, ausente del docx). **Decisión confirmada con Enzo**: los gastos del vehículo viven
  acá (`categoria = 'gasto'`), no en `facturacion.gastos_vehiculos` — el docx modela una única
  "Categoría / Tipo de intervención" (gasto/preventivo/correctivo). `gastos_vehiculos` queda sin
  usar (no se dropea: no hay certeza de que nada más lo referencie).
- `conductores.vehiculo`: agregar `kilometraje` (odómetro actual, columna propia — no se deriva
  de nada, cambia con el uso del vehículo).
- Tabla nueva `conductores.habilitaciones_vehiculo` (VTV/RTO con `fecha_emision`/
  `fecha_vencimiento` propias, RN-VE-04) — distinta de `documentacion_vehiculo` (archivo
  genérico, sin vencimiento propio, discrepancia ya documentada en `CHANGES.md`).
- Edge Functions `vehiculos` (habilitaciones y gastos embebidos con reemplazo completo, mismo
  patrón que `facturas`/asistencias; `accesoriosCompatibles` resuelto contra el catálogo
  compartido `pacientes.accesorios`; `kilometrajeUltimoService`/`fechaUltimoService` derivados
  del último registro `preventivo` de `mantenimiento`, nunca columnas propias) y
  `vehiculo-documentos` (mismo patrón que `pacientes-documentos`).

### Out of Scope
- Una Edge Function dedicada para registrar mantenimiento preventivo/correctivo: el frontend hoy
  no tiene ninguna pantalla que liste o cree estos eventos — `VehiculoMantenimiento.tsx` solo
  *deriva* el estado de servicio a partir de `kilometraje`/`kilometrajeUltimoService`/
  `fechaUltimoService`, ya cubiertos por la Edge Function de `vehiculos`. Se construye cuando el
  frontend agregue esa pantalla — no antes (no hay consumidor hoy).
- Alertas de vencimiento (VTV/service) como lógica de servidor: hoy son funciones puras del
  frontend (`shared/lib/mantenimiento/`, `shared/lib/reportes/alertasMantenimiento.ts`).

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `supabase/migrations/20260730110000_schema_vehiculo_gaps.sql` | New | 3 columnas en `mantenimiento`, 1 en `vehiculo`, tabla `habilitaciones_vehiculo` |
| `supabase/functions/vehiculos/index.ts` | New | CRUD + habilitaciones/gastos embebidos |
| `supabase/functions/vehiculo-documentos/index.ts` | New | CRUD, mismo patrón que `pacientes-documentos` |

## Rollback Plan

Tablas sin datos reales todavía — dropear las columnas nuevas, la tabla
`habilitaciones_vehiculo`, y despublicar las 2 Edge Functions.

## Dependencias

`C-01`, `C-02`, `C-03` (documentos, ya existente).

## Success Criteria

- [ ] Insertar un vehículo con `habilitaciones`/`gastos`/`accesoriosCompatibles` embebidos y
      recuperarlo con los mismos arrays
- [ ] `kilometrajeUltimoService`/`fechaUltimoService` reflejan el último registro `preventivo`
      sin necesidad de escribirlos directamente
- [ ] Reemplazar `accesoriosCompatibles` con un valor desconocido falla con error claro
