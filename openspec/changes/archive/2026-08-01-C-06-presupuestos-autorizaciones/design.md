# Design: C-06 Presupuestos y Autorizaciones (backend) — cierre de schema

## Technical Approach

Dos columnas nuevas nullable en `facturacion.autorizacion` + un trigger `BEFORE INSERT OR
UPDATE` que solo actúa cuando `monto_autorizado` viene informado (es opcional, no todas las
autorizaciones necesitan comparación monetaria explícita per el contrato del frontend) —
consulta el `monto` del `presupuesto` referenciado y rechaza con `RAISE EXCEPTION` si lo supera.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| RN-PA-01 como CHECK constraint vs. trigger | Un `CHECK` no puede leer otra tabla (`presupuesto.monto`); la regla cruza 2 tablas | Trigger `BEFORE INSERT OR UPDATE`, `RAISE EXCEPTION` si `monto_autorizado > presupuesto.monto` |
| `monto_autorizado` obligatorio vs. nullable | El docx no tiene este campo en absoluto; forzarlo `NOT NULL` inventaría un requisito que no existe en ninguna fuente | Nullable — la validación solo corre cuando el campo viene informado |

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `supabase/migrations/<new>_schema_autorizacion_monto_vigencia.sql` | Create | Todo el scope de este change |

## Testing Strategy

Manual: insertar presupuesto con `monto = 1000`; insertar autorización con `monto_autorizado =
1500` → debe fallar; con `800` → debe pasar; con `vigencia_desde` anterior a `fecha_respuesta` →
debe pasar (carga retroactiva, RN-PA-02).

## Open Questions

Ninguna bloqueante.
