# Proposal: Usuarios, Permisos y Auditoría (backend)

## Intent

Establish real Supabase Auth, the account/permission model, and the audit log every later table will attach to. Without C-02, no domain table can define its RLS policies — this is the only change unblocked in the dependency graph after C-01.

This proposal covers **backend only** (database schema + one Edge Function). The frontend rewrite (`AuthContext`, login, accounts screen) is a separate, later change owned by the frontend team, consuming the contract documented in `design.md`.

## Scope

### In Scope
- `usuarios.usuarios` table (mirrors `auth.users`, adds `rol`, `nombre`, `apellido`, `ingreso_at`/`egreso_at` columns)
- `usuarios.rol_enum` (`admin` / `empleado`) — every account created via `auth.users` (API/trigger path) is forced to `empleado`; the first admin (Andrea) is bootstrapped manually via a one-time SQL Editor `UPDATE`, documented below
- `modulos.modulos` (catalog of the 4 real permission modules (per the docx, not the frontend's 9 feature folders)) + `modulos.permisos` (per-account, per-module access level: `read`/`write`/`admin`)
- `modulos.tiene_permiso(modulo, nivel)` — the function every future table's RLS policy will call
- `auditoria.logs` + `auditoria.log_action()` generic trigger — attachable to any table
- `supabase/functions/create-user` Edge Function — the only way to create an account, since there is no public signup (uses the service-role key, which per project rule may only live server-side)

### Out of Scope
- Any frontend code (`AuthContext.tsx`, `LoginPage.tsx`, `RequireAuth.tsx`, accounts/permissions screen) — separate change, frontend-owned
- RLS policies on the 4 storage buckets — belongs to C-03 (`gestion-documental-core`)
- The other 4 pre-existing draft migrations (`obra_social`, `pacientes`, `facturacion`, `conductores`) — belong to C-04/C-05/C-07/C-09, reviewed individually when those changes start

## Capabilities

### New Capabilities
- `usuarios-auth`: real Supabase Auth accounts, `admin`/`empleado` bootstrap rule
- `permisos-modulo`: per-account, per-module access matrix + `tiene_permiso()` check function
- `auditoria-log`: transversal audit log + reusable trigger
- `create-user-function`: admin-only account creation Edge Function

### Modified Capabilities
None (this is the first backend implementation of this domain — the two draft migration files being edited here were never applied to any database, so there is no prior "capability" to modify, only bugs to fix before they ship).

## Approach

1. Fix 2 correctness bugs found in the existing (untracked, unapplied) draft migrations `20260724100001_schema_modulos_auditoria.sql` and `20260724100002_schema_usuarios.sql` — see `design.md` §Architecture Decisions for the exact fixes and rationale.
2. Add a new migration seeding `modulos.modulos` with the 4 real module keys from the docx.
3. Write the `create-user` Edge Function (admin-only, service-role).
4. Document the frontend-facing contract in `design.md` for handoff, and the one-time manual bootstrap step for the first admin account.
5. Get explicit go-ahead, then push to the linked remote project and deploy the function.
6. Verify manually against the remote project, including the manual admin bootstrap.

## Resolved discrepancy (docx vs. KB)

`knowledge-base/03_actores_y_roles.md` flagged an unresolved contradiction: the KB narrative says "no roles fijos, solo matriz de permisos", while `docs/core/Traslados-Modelo-Datos.docx` describes a fixed `Rol` field (Administrador with total bypass / Empleado checked per module) plus an explicit anti-self-promotion rule. **Resolved for this change**: implement the hybrid model the docx describes (fixed `rol` + per-module permission matrix for `empleado` accounts) — this is also what the pre-existing draft migrations already implement. `knowledge-base/03_actores_y_roles.md` and `04_modelo_de_datos.md` should be updated to reflect this resolution (documentation follow-up, not blocking this proposal).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/20260724100001_schema_modulos_auditoria.sql` | Modify | Fix missing `auditoria.logs` SELECT policy |
| `supabase/migrations/20260724100002_schema_usuarios.sql` | Modify | Fix admin-bootstrap gap, add FK on `modulos.permisos.usuario_id` |
| `supabase/migrations/<new>_seed_modulos.sql` | New | Seed the 4 real `tipo_modulo` values (docx-derived, not the frontend's 9) |
| `supabase/functions/create-user/index.ts` | New | Admin-only account creation |
| `supabase/migrations/20260728130000_track_ingreso_egreso.sql` | New | RF-004: auto-populate `ingreso_at`/`egreso_at` from `auth.users.last_sign_in_at` and `auth.audit_log_entries` |
| `CHANGES.md` | Modify | Backend progress note under C-02 (checkbox stays `[ ]` — frontend still pending) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| First admin bootstrap forgotten (account created, but nobody runs the manual SQL `UPDATE`) | Low, one-time step | Documented explicitly in `design.md`/`tasks.md`; every account stays `empleado` with zero module access until it's done, so the failure mode is "nothing works yet", not a security gap |
| Edge Function's service-role key leaks | Low | Key lives only in Supabase's function secrets, never in frontend bundle or repo |
| Migrations conflict with the 4 other untouched draft files (shared `auditoria`/`modulos` schemas) | Low | Those files don't reference `usuarios`/`modulos` schema objects ahead of this change; verified no forward dependency |

## Rollback Plan

- Revert the 2 edited migration files to their pre-fix state (or drop schemas `usuarios`, `modulos`, `auditoria` and re-run)
- Drop the new seed migration
- `supabase functions delete create-user`
- Since nothing has been pushed to the remote project before this change, rollback before step 5 (push) is a pure local file revert with zero remote impact

## Dependencies

- `C-01` (Supabase project linked, storage buckets, `supabaseClient.ts`) — done

## Success Criteria

- [ ] All 3 bugs in the draft migrations fixed
- [ ] `modulos.modulos` seeded with the 4 real module keys (docx-derived)
- [ ] `create-user` Edge Function rejects non-admin callers and creates accounts for admin callers
- [ ] Migrations apply cleanly against the linked remote project
- [ ] First account created lands as `admin`; second lands as `empleado` with no default module access
- [ ] Every insert/update/delete on `usuarios.usuarios`/`modulos.*` appears in `auditoria.logs`, readable by any authenticated user (per docx), writable by nobody
