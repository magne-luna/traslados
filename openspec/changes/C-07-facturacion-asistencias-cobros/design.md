# Design: C-07 Facturación, Asistencias y Cobros (backend) — cierre de schema

## Technical Approach

Columnas nuevas nullable en `facturacion.facturas` (todas ausentes mientras la factura sigue en
`a facturar`, sin emitir) + tabla propia `asistencia_prestacion` (1---N, `ON DELETE CASCADE`). La
API (`facturas/index.ts`) expone `asistencias` embebida en el body de la Factura — igual que el
frontend la modela — pero internamente hace un `SELECT ... asistencia_prestacion(*)` (embedding
de PostgREST) para leer, y un reemplazo completo (`DELETE` + `INSERT`) para escribir, nunca un
merge parcial contra las filas existentes.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `asistencias` como tabla propia vs. columna JSON en `facturas` | JSON evitaría el join, pero pierde FK/RLS/audit trigger por fila y no es queryable para reportes (`C-11`) | Tabla propia, expuesta embebida en la API para no romper el contrato del frontend |
| Reemplazo completo vs. diff incremental de `asistencias` en `PATCH` | Diff incremental (detectar altas/bajas/ediciones) es más eficiente pero mucho más código y estado a rastrear (ids nuevos vs. existentes) | Reemplazo completo (delete+insert), mismo patrón ya usado en `update-permisos` — más simple, correcto siempre, el volumen por factura es bajo |
| `estado` de la API vs. el enum de la base | El enum de la base tiene `'pendiente'` (sinónimo histórico del docx) que el frontend no usa | Mapeo explícito en los dos sentidos (`estadoToApi`/`estadoToDb`); nunca se escribe `'pendiente'` desde la API |
| `identificador_origen`/`identificador_valor` como 2 columnas vs. 1 columna JSON | El campo es un snapshot congelado al emitir (IN-01, RN-FA-06), no se vuelve a tocar — 2 columnas nullable alcanzan, sin necesidad de JSON | 2 columnas planas, igual que `monto_autorizado`/`vigencia_desde` de `C-06` |

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `supabase/migrations/20260730100000_schema_factura_gaps.sql` | Create | 8 columnas + tabla `asistencia_prestacion` |
| `supabase/functions/facturas/index.ts` | Create | CRUD + asistencias embebidas, mapeo de `estado` |
| `supabase/functions/cobros/index.ts` | Create | CRUD sin `PATCH` |

## Testing Strategy

Manual (sin harness de integración DB en este repo, mismo precedente que `C-02`/`C-04`/`C-06`):
crear paciente + obra social + presupuesto/autorización de prueba, insertar una factura con 2
`asistencias`, confirmar que el `GET` las devuelve en el mismo orden; hacer `PATCH` con un array
distinto y confirmar reemplazo completo (no acumulación); insertar `cobros` para esa factura y
confirmar `?facturaId=` filtra correctamente; confirmar que borrar la factura cascadea sobre
`asistencia_prestacion`, `documento_factura` y `cobros`.

## Threat Matrix

| Amenaza | Mitigación |
|---|---|
| Cuenta sin permiso de `facturacion` lee/escribe facturas de otro paciente | RLS existente (`modulos.tiene_permiso('facturacion', ...)`), sin cambios en este change |
| `PATCH` de `asistencias` deja filas huérfanas de una factura vieja | Reemplazo completo siempre filtra por `factura_id` antes de insertar el nuevo set |
| Se escribe `'pendiente'` en `estado` desde la API, divergiendo del contrato del frontend | `estadoToDb` nunca produce `'pendiente'` — solo lectura lo mapea a `'a-facturar'` |

## Migration & Rollout

Migración aditiva (solo columnas nullable + tabla nueva), sin backfill necesario — no hay datos
reales cargados todavía. Deploy de Edge Functions independiente de la migración, pero requiere
que la migración haya corrido antes (las columnas deben existir).

## Open Questions

Ninguna bloqueante para cerrar el schema. Pendientes de negocio (no bloquean este change,
`knowledge-base/10_preguntas_abiertas.md`): identificador DNI/afiliado por defecto, plazos
90/45/60 días y su precedencia, integración ARCA, período estructurado vs. manual.
