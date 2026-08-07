# Design: C-03 Gestión Documental Core (backend)

## Technical Approach

Two independent additions, no changes to existing tables. `facturacion.documento_factura`
copies `pacientes.documentos`'s exact shape (entity FK + shared catalog FK + `archivo_url` +
`created_at`), gated by `modulos.tiene_permiso('facturacion', ...)`, audited via the same
`auditoria.log_action()` trigger used everywhere else. `storage.objects` gets explicit RLS
policies per bucket — Supabase enables RLS on this table by default with zero policies, so
today every bucket is 100% inaccessible even to authenticated users; these policies are what
actually turns the 4 C-01 buckets into usable storage.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `documento_factura.tipo_documento`: own catalog vs. shared `obra_social.tipos_documento` | A separate catalog duplicates a concept that already exists; C-07's own scope text says "usando el patrón de C-03" | Reuse the shared catalog, same FK pattern as `pacientes.documentos` |
| Storage RLS granularity: per-record folder path vs. per-module only | The docx's own access-control text for every document-bearing entity says "el acceso... se controla por módulo", never per-record | Module-level only — `bucket_id = 'x' AND modulos.tiene_permiso(module, level)`, no `storage.foldername()` parsing |
| Storage RLS operations: `FOR ALL` vs. one policy per operation | `FOR ALL` collapses SELECT/INSERT/UPDATE/DELETE into one clause, less explicit about which level (read vs. write) gates which operation | One policy per operation: SELECT gated by `read`, INSERT/UPDATE/DELETE gated by `write` — matches the `nivel_acceso` semantics already established (`admin` always satisfies `write`, `write` always satisfies `read`, via `tiene_permiso()`'s own logic) |

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `supabase/migrations/<new>_schema_documento_factura.sql` | Create | `facturacion.documento_factura` + RLS + audit trigger + 3 seeded `tipos_documento` rows |
| `supabase/migrations/<new>_storage_objects_rls.sql` | Create | 16 policies (4 buckets × SELECT/INSERT/UPDATE/DELETE) on `storage.objects` |

## Testing Strategy

Manual, same precedent as C-02 (no DB integration harness in this repo): as a user with
`facturacion` write access, upload a file to `documentos-facturas` and confirm success; as a
user with only `pacientes` access, confirm the same upload is rejected (403/RLS denial); confirm
`facturacion.documento_factura` inserts appear in `auditoria.logs`.

## Migration / Rollout

Applied via `supabase db push` after explicit go-ahead, same as every prior migration in this
project — nothing auto-applies.

## Open Questions

None blocking.
