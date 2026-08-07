# Tasks: C-03 Gestión Documental Core (backend)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 60–90 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |

## Phase 1: Facturas documents

- [x] 1.1 Create `facturacion.documento_factura` table (FK `factura_id`, FK `id_tipo_documento` → `obra_social.tipos_documento`, `archivo_url`, `created_at`)
- [x] 1.2 RLS: SELECT/write policies gated by `modulos.tiene_permiso('facturacion', ...)`
- [x] 1.3 Audit trigger `trg_audit_documento_factura`
- [x] 1.4 Seed 3 `obra_social.tipos_documento` rows: comprobante ARCA, asistencia, CODEM

## Phase 2: Storage RLS

- [x] 2.1 4 buckets × SELECT (read) + INSERT/UPDATE/DELETE (write) policies on `storage.objects`, per the bucket→module mapping in `proposal.md`

## Phase 3: Deploy & verify (requires explicit go-ahead)

- [x] 3.1 `supabase db push` — migrations `20260729100000`/`20260729100001` ya en remoto (`supabase migration list --linked` local=remote); verificado en vivo 2026-08-05: tabla `facturacion.documento_factura` existe, 3 `tipos_documento` sembrados, 16 policies en `storage.objects`
- [x] 3.2 Manual verification per `design.md` §Testing Strategy — verificado en vivo 2026-08-06
      contra `pkryfoljypuzfifofdwp` vía REST/Storage API con JWTs reales: (1) usuario `admin` con
      permiso `facturacion` write (`andrea.test@gmail.com`) sube a `documentos-facturas` → `200`;
      (2) usuario sin permiso `facturacion` (`rominaop@pastor.com`, solo `pacientes`/otros) → `403`
      RLS denial; (3) insert en `facturacion.documento_factura` genera fila en `auditoria.logs`
      (`tabla_afectada: documento_factura`, `accion: INSERT`, `usuario_id` del autor). Datos de
      prueba (factura + documento + archivo de storage) borrados al terminar; logs de auditoría
      del test quedan (append-only, no se tocan).
