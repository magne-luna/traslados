# Tasks: C-03 Gestión Documental Core (backend)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 60–90 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |

## Phase 1: Facturas documents

- [ ] 1.1 Create `facturacion.documento_factura` table (FK `factura_id`, FK `id_tipo_documento` → `obra_social.tipos_documento`, `archivo_url`, `created_at`)
- [ ] 1.2 RLS: SELECT/write policies gated by `modulos.tiene_permiso('facturacion', ...)`
- [ ] 1.3 Audit trigger `trg_audit_documento_factura`
- [ ] 1.4 Seed 3 `obra_social.tipos_documento` rows: comprobante ARCA, asistencia, CODEM

## Phase 2: Storage RLS

- [ ] 2.1 4 buckets × SELECT (read) + INSERT/UPDATE/DELETE (write) policies on `storage.objects`, per the bucket→module mapping in `proposal.md`

## Phase 3: Deploy & verify (requires explicit go-ahead)

- [ ] 3.1 `supabase db push`
- [ ] 3.2 Manual verification per `design.md` §Testing Strategy
