# Design: C-08 Vehículos y Mantenimiento (backend) — cierre de schema

## Technical Approach

`habilitaciones` y `gastos` se exponen embebidos en el body de `Vehiculo` (igual que
`asistencias` en `facturas`), pero internamente viven en tablas propias
(`habilitaciones_vehiculo`, `mantenimiento` filtrado por `categoria`). Lectura vía embedding de
PostgREST (mismo schema `conductores`); escritura vía reemplazo completo (delete + insert).
`accesoriosCompatibles` resuelve contra `pacientes.accesorios` (catálogo cross-schema) con 2
consultas separadas, porque el embedding de PostgREST no cruza schemas expuestos por separado.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Gastos en `mantenimiento` (categoría `'gasto'`) vs. tabla `gastos_vehiculos` aparte | El docx modela una única "Categoría / Tipo de intervención"; una tabla aparte duplica el concepto y ya existe `facturacion.gastos_vehiculos` sin usar | Confirmado con Enzo: todo en `mantenimiento`. `gastos_vehiculos` queda huérfano, no se dropea |
| `kilometrajeUltimoService`/`fechaUltimoService` como columnas propias vs. derivadas | Guardarlas aparte crea 2 fuentes de verdad (pueden desincronizarse del último registro real) | Derivadas del último `mantenimiento` con `categoria = 'preventivo'`, ordenado por `fecha desc` |
| `habilitaciones_vehiculo` como tabla nueva vs. extender `documentacion_vehiculo` | `documentacion_vehiculo` es archivo subido (`archivo_url NOT NULL`); `RegistroHabilitacion` del frontend no tiene ningún campo de archivo, es un concepto distinto (vencimiento, no adjunto) | Tabla nueva, sin relación con documentos |
| `accesoriosCompatibles`: resolver via embedding cross-schema vs. 2 consultas | El embedding de PostgREST no cruza `conductores`→`pacientes` de forma confiable (schemas expuestos por separado) | 2 consultas: `accesorios_vehiculo` (ids) → `pacientes.accesorios` (tipos). Mismo costo que un embed, sin depender de una feature no verificada |

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `supabase/migrations/20260730110000_schema_vehiculo_gaps.sql` | Create | Columnas + tabla `habilitaciones_vehiculo` |
| `supabase/functions/vehiculos/index.ts` | Create | CRUD + habilitaciones/gastos/accesorios embebidos |
| `supabase/functions/vehiculo-documentos/index.ts` | Create | CRUD, patrón `pacientes-documentos` |

## Testing Strategy

Manual (sin harness de integración DB, mismo precedente que los changes anteriores): crear un
vehículo, agregar 2 habilitaciones (vtv/rto) y 2 gastos embebidos, confirmar que el `GET` los
devuelve; hacer `PATCH` con un array de gastos distinto y confirmar reemplazo completo; asignar
`accesoriosCompatibles` con un valor real (ej. `'andador'`) y confirmar que resuelve el id
correcto; probar con un valor inventado y confirmar que falla con 400 explícito; confirmar que
`kilometrajeUltimoService`/`fechaUltimoService` reflejan el último `mantenimiento` preventivo
insertado directamente por SQL (sin pasar por la Edge Function, ya que no hay una para crearlos
todavía).

## Threat Matrix

| Amenaza | Mitigación |
|---|---|
| Cuenta sin permiso de `conductores` lee/escribe vehículos | RLS existente, sin cambios en este change |
| `accesoriosCompatibles` con un `tipo` no seedeado se inserta silenciosamente | `resolveAccesorioIds` falla explícito si algún tipo no resuelve, antes de tocar `accesorios_vehiculo` |
| Reemplazo de `gastos` borra también filas `preventivo`/`correctivo` de otro vehículo | El `DELETE` siempre filtra por `vehiculo_id` **y** `categoria = 'gasto'` |

## Migration & Rollout

Migración aditiva (columnas nullable + tabla nueva), sin backfill — no hay datos reales
cargados. Deploy de Edge Functions independiente, pero requiere que la migración haya corrido
antes.

## Open Questions

Ninguna bloqueante para cerrar el schema de vehículos. Queda abierto (no bloquea este change):
cuándo y cómo el frontend expondrá una pantalla para registrar mantenimiento
preventivo/correctivo — hoy no existe, por eso no se construyó su Edge Function.
