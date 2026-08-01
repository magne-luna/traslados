# Design: C-04 Obras Sociales y Prestadores (backend) — cierre de schema

## Technical Approach

Pure additive/rename ALTERs on the already-pushed `obra_social` schema (empty table, no data
migration risk), plus one new table (`plantilla_campo`) following the exact same RLS/audit
pattern as every other domain table gated by `modulos.tiene_permiso('obra_social', ...)`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `tipo_comprobante`: keep loose `TEXT` vs. reuse `facturacion.tipo_factura` enum | A second free-text column duplicates a validity constraint that already exists elsewhere | Reuse the enum — same valid values (A/B/C), one source of truth |
| Field names/defaults: invent new ones vs. mirror the frontend's already-built contract | The frontend team already shipped and tested `ObraSocial`/`PlantillaCampo` types with specific defaults; inventing different ones creates unnecessary translation work later | Mirror 1:1 (see `proposal.md`) |
| `requisitos_os.orden`: implicit array position vs. explicit column | RN-FA-08 requires the checklist order to be respected; without a persisted column, order depends on insertion order / no `ORDER BY` guarantee | Explicit `orden INT` column |

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `supabase/migrations/<new>_schema_obra_social_facturacion_config.sql` | Create | All of this change's scope |

## Testing Strategy

Manual: insert an `obra_social` row, confirm defaults match the frontend's; insert
`requisitos_os` rows out of order, confirm `orden` preserves intended sequence; insert
`plantilla_campo` rows, confirm RLS gates them same as `obra_social.obra_social`.

## Open Questions

None blocking — OSECAC's actual checklist content stays as real data to load later, not
structure to guess here.
