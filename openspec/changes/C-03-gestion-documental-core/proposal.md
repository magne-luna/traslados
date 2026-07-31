# Proposal: Gestión Documental Core (backend)

## Intent

Close the gap left by C-01/C-02/C-04/C-05/C-08's existing `documento_*` tables: the 4 storage
buckets exist but have zero RLS policies (Postgres denies everything by default with RLS
enabled and no policy), and Facturas has no document table at all despite US-900 requiring it.

## Scope

### In Scope
- `facturacion.documento_factura` table (mirrors `pacientes.documentos`'s already-established
  shape: FK to the entity, FK to the shared `obra_social.tipos_documento` catalog, `archivo_url`,
  `created_at`), with RLS gated by `modulos.tiene_permiso('facturacion', ...)` and an audit
  trigger — same pattern already used by `pacientes.documentos`/`documentacion_conductores`/
  `documentacion_vehiculo`.
- Seed 3 `obra_social.tipos_documento` catalog rows for factura-specific attachments named
  explicitly in C-07's scope: comprobante ARCA, asistencia, CODEM.
- `storage.objects` RLS policies (SELECT/INSERT/UPDATE/DELETE) for the 4 existing buckets,
  gated by `modulos.tiene_permiso()` against the module that owns each bucket's entity.

### Out of Scope
- Any frontend code — `DocumentChecklist`/`DocumentoRepository` already exist as a mock
  (FE-1), frontend-owned change to wire to real storage
- The per-entity `documento_*` tables for pacientes/conductores/vehiculos — already built and
  pushed as part of C-02's broader review, not re-touched here
- Per-record folder scoping inside buckets (e.g. one folder per paciente) — access is
  module-level per the docx ("el acceso... se controla por módulo"), not per-record; a
  per-record path convention is a frontend/upload-path concern, not an RLS concern

## Bucket → module mapping

| Bucket | Module (`modulos.tiene_permiso`) |
|--------|-----------------------------------|
| `documentos-pacientes` | `pacientes` |
| `documentos-vehiculos` | `conductores` (vehiculo tables live under this module — see C-02) |
| `documentos-conductores` | `conductores` |
| `documentos-facturas` | `facturacion` |

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `supabase/migrations/<new>_schema_documento_factura.sql` | New | `facturacion.documento_factura` table + RLS + audit trigger + tipo_documento seed |
| `supabase/migrations/<new>_storage_objects_rls.sql` | New | RLS policies on `storage.objects` for the 4 buckets |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bucket→module mapping wrong, locking out legitimate uploads | Low | Mapping directly derived from C-02's already-confirmed module boundaries (docx-verified) |
| `documento_factura`'s `tipo_documento` FK too rigid for future factura attachment types | Low | Same catalog table already used everywhere else; adding a new row is a 1-line seed, not a schema change |

## Rollback Plan

- Drop `facturacion.documento_factura` and its policies/trigger
- Drop the 3 seeded `tipos_documento` rows
- Drop the `storage.objects` policies (buckets themselves stay, from C-01)

## Dependencies

- `C-01` (buckets), `C-02` (RLS pattern, `tiene_permiso()`) — both done

## Success Criteria

- [ ] `facturacion.documento_factura` created, RLS'd, audited
- [ ] 3 factura-specific `tipos_documento` rows seeded
- [ ] Each of the 4 buckets has working SELECT/INSERT/UPDATE/DELETE policies scoped to its module
- [ ] A user without permission on a module cannot read/write that module's bucket; a user with permission can
