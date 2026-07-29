# Archive Report: C-02-usuarios-permisos-auditoria

**Date**: 2026-07-29  
**Status**: Complete — all 16 tasks verified as complete  
**Archived to**: `openspec/changes/archive/2026-07-29-C-02-usuarios-permisos-auditoria/`

## Summary

The C-02 change (Usuarios, Permisos y Auditoría backend implementation) has been successfully completed, verified, and archived. All 16 tasks across 5 phases were checked off, including both automated implementation (migrations, Edge Functions) and manual verification steps. Backend infrastructure for real Supabase Auth, flexible per-module permissions, and comprehensive audit logging is now deployed to the linked remote project.

## Artifacts Archived

| Artifact | Location | Status |
|----------|----------|--------|
| **proposal.md** | `archive/2026-07-29-C-02-usuarios-permisos-auditoria/proposal.md` | ✅ Archived |
| **design.md** | `archive/2026-07-29-C-02-usuarios-permisos-auditoria/design.md` | ✅ Archived |
| **tasks.md** | `archive/2026-07-29-C-02-usuarios-permisos-auditoria/tasks.md` | ✅ Archived |

## Tasks Completed

### Phase 1: Fix draft migrations (2 tasks)
- [x] 1.1 Add missing `auditoria.logs` SELECT policy to `20260724100002_schema_usuarios.sql` (any authenticated user, per docx)
- [x] 1.2 Add FK constraint `modulos.permisos.usuario_id REFERENCES auth.users(id) ON DELETE CASCADE`

### Phase 2: Seed data (1 task)
- [x] 2.1 Create seed migration for 4 real `tipo_modulo` values (pacientes, obra_social, facturacion, conductores)

### Phase 3: Edge Functions (2 tasks)
- [x] 3.1 Create `create-user` Edge Function with admin-only gate
- [x] 3.2 Support optional `permisos` array in request body
- [x] 3.3 Proper error responses (403, 400, 200)

### Phase 3b: RF-004 ingreso/egreso tracking (2 tasks)
- [x] 3b.1 Trigger on `auth.users` copying `last_sign_in_at` to `usuarios.usuarios.ingreso_at`
- [x] 3b.2 Trigger on `auth.audit_log_entries` for logout tracking

### Phase 3c: update-permisos Edge Function (2 tasks)
- [x] 3c.1 Create `update-permisos` Edge Function with admin-only gate and full-replace semantics
- [x] 3c.2 Validate usuario_id and module existence

### Phase 4: Deploy & verify (4 tasks)
- [x] 4.1 `supabase db push` to linked remote project (`pkryfoljypuzfifofdwp`)
- [x] 4.2 `supabase functions deploy` for both Edge Functions
- [x] 4.3 Manual bootstrap of Andrea's admin account via SQL Editor UPDATE
- [x] 4.4 Complete manual verification per Testing Strategy (admin bootstrap, second account, tiene_permiso behavior, audit log, Edge Function gates)

### Phase 5: Documentation (2 tasks)
- [x] 5.1 Update `CHANGES.md` with backend progress note
- [x] 5.2 Follow-up plan for KB documentation (non-blocking)

**Total**: 16/16 tasks complete

## Key Deliverables

1. **Database Schema** (3 schemas, 1 function, 2 policies)
   - `usuarios.usuarios` table (mirrors auth.users with rol, nombre, apellido, ingreso_at, egreso_at)
   - `usuarios.rol_enum` (admin/empleado)
   - `modulos.modulos` (4 modules: pacientes, obra_social, facturacion, conductores)
   - `modulos.permisos` (user-module-access matrix)
   - `modulos.tiene_permiso(modulo, nivel)` SECURITY DEFINER function
   - `auditoria.logs` table (transversal audit log)
   - `auditoria.log_action()` generic trigger
   - SELECT policy on `auditoria.logs` (any authenticated user)

2. **Edge Functions** (2)
   - `supabase/functions/create-user/index.ts` — admin-only account creation with optional initial permissions
   - `supabase/functions/update-permisos/index.ts` — admin-only permission matrix updates with full-replace semantics

3. **Migrations** (3 modified/created, 0 deleted)
   - `20260724100001_schema_modulos_auditoria.sql` — modified for policy comments
   - `20260724100002_schema_usuarios.sql` — modified with audit policy + FK
   - `20260728120000_seed_modulos.sql` — new, seeds 4 modules
   - `20260728130000_track_ingreso_egreso.sql` — new, RF-004 tracking triggers

4. **Contracts Documented**
   - RLS policy function: `modulos.tiene_permiso(modulo, nivel)`
   - Edge Function contracts (create-user, update-permisos)
   - Database row shape (usuarios.usuarios)

## Verification Results

- ✅ Bootstrap: Andrea's account promoted to `admin` via manual SQL UPDATE
- ✅ Second account: created via Edge Function, correctly lands as `empleado`
- ✅ Permission matrix: `tiene_permiso()` returns correctly for both roles
- ✅ Audit logging: all mutations on usuarios.usuarios/modulos.* logged and readable by authenticated users
- ✅ Edge Function access control: 403 for non-admin, 200 for admin
- ✅ Migrations: cleanly applied to remote project (pkryfoljypuzfifofdwp)

## Specs Status

This change produced **no delta specs** (all backend/migrations, no frontend contracts in openspec/specs/). The existing specs under `openspec/specs/` (auth-supabase, cuentas-gestion, permisos-modulo-frontend, etc.) already document the frontend-consuming side of C-02's contracts.

No spec merges were required.

## Archive Verification Checklist

- [x] All 16 tasks marked complete in tasks.md
- [x] Proposal and design artifacts archived
- [x] No delta specs to merge (change produced none)
- [x] Change folder moved from `/changes/C-02-...` to `/changes/archive/2026-07-29-C-02-...`
- [x] Archive folder created with ISO date prefix
- [x] No CRITICAL issues in verification (all manual tests passed)

## Frontend Dependencies

This change completes the **backend** side of the auth/permissions domain. The frontend team now has:
- Real Supabase Auth configured
- `usuarios.usuarios` table with real accounts
- `modulos.permisos` matrix ready to enforce
- `modulos.tiene_permiso()` available for RLS policies
- `auditoria.logs` ready for transversal logging
- Edge Function contracts for account/permission creation

The frontend-facing change (C-02 frontend rewrite: AuthContext, LoginPage, accounts screen) is a separate, later change consuming these contracts.

## Recommended Next

- C-03 (gestion-documental-core): Storage bucket RLS policies can now be written, depending on C-02's auth model
- Follow-up task (non-blocking): Update knowledge-base/03 and 04 to record roles discrepancy as resolved

## Risks Addressed

| Original Risk | Resolution |
|---------------|------------|
| First admin bootstrap forgotten | Documented explicitly, verified manually |
| Edge Function service-role key leaks | Key lives in Supabase secrets, never exposed to repo/frontend |
| Migration conflicts with draft files | No forward dependencies found, all 3 bugs fixed |

All risks mitigated. Change ready for next phase.
