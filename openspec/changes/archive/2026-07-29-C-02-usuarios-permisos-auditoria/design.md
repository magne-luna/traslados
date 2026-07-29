# Design: C-02 Usuarios, Permisos y Auditoría (backend)

## Technical Approach

Three Postgres schemas (`usuarios`, `modulos`, `auditoria`) plus one Edge Function. `usuarios.usuarios` mirrors `auth.users` 1:1 via FK, adding `rol` (fixed enum, bootstrap-assigned) and profile fields. `modulos.permisos` is a join table (`usuario_id`, `modulo_id`, `nivel_acceso`) checked by the SECURITY DEFINER function `modulos.tiene_permiso()`, which every future domain table's RLS policy calls — `admin` short-circuits to true, `empleado` is checked against the matrix. `auditoria.log_action()` is a generic trigger function any table can attach via `CREATE TRIGGER ... EXECUTE FUNCTION auditoria.log_action()`, logging `TG_TABLE_NAME`/`TG_OP`/`auth.uid()`/before-after JSON. Account creation has no public signup path, so it goes through a service-role Edge Function gated on the caller already being `admin`.

Two of the three migrations already existed as untracked drafts (`20260724100001_schema_modulos_auditoria.sql`, `20260724100002_schema_usuarios.sql`) — this change fixes 2 bugs in them rather than rewriting, since nothing has been pushed to any database yet.

The first admin account (Andrea) is **not** bootstrapped by code — it's created like any other account (dashboard or SQL) and then promoted with a one-time manual `UPDATE usuarios.usuarios SET rol = 'admin' WHERE id = '<her-uuid>'` run directly in the Supabase SQL Editor. This works because `prevent_rol_tampering()` only blocks `rol` changes when `current_setting('request.jwt.claims', true)` is present — i.e., when the request came through PostgREST/the API with a JWT. A direct SQL Editor session has no JWT context, so the trigger's top-level check (`IF current_setting(...) IS NULL THEN RETURN NEW; END IF;`) short-circuits and the update goes through untouched. No code path is needed for this — it's an operational step, done once, before any other account is created.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Roles**: fixed `rol` enum vs. pure per-module matrix | KB narrative (`03_actores_y_roles.md`) says no fixed roles; docx describes fixed `Rol` + anti-self-promotion. Contradiction was explicitly left unresolved pending confirmation | **Fixed `rol` (admin/empleado) + per-module matrix for empleados** — matches docx structure (docx wins on structure per project's hard rules) and the already-drafted migrations. KB docs to be updated as a follow-up. |
| **Admin bootstrap**: automatic first-signup-is-admin rule vs. manual SQL step | An automatic rule adds trigger complexity for a scenario that happens exactly once per project's lifetime, and Andrea's account is created by hand anyway (no self-service signup exists) | One-time manual `UPDATE ... SET rol = 'admin'` via SQL Editor after her account is created — `handle_new_user()` stays untouched, always defaulting to `empleado` |
| **Account creation**: public signup vs. admin-only Edge Function | KB explicitly requires no public signup ("altas las hace la administradora") | `supabase/functions/create-user`, service-role, checks caller is `admin` via `usuarios.usuarios` before calling `auth.admin.createUser()` |
| **Audit log read access**: everyone vs. admin-only | Docx's own text: "Es de solo lectura para los usuarios autenticados... y no es accesible en absoluto para usuarios no autenticados" | `auditoria.logs` SELECT policy allows **any authenticated user**, `USING (true)` (this policy was **missing entirely** in the draft — RLS was enabled with zero policies, meaning the table was 100% unreadable via the API; my first fix wrongly restricted it to admin-only, corrected against the docx quote above) |
| **Permission module catalog**: 9 frontend feature-folder names vs. the docx's 4 real modules | The docx's own module catalog example and every entity's access-control text name exactly 4 modules: `pacientes`, `obra_social`, `facturacion`, `conductores` — `presupuestos-autorizaciones` and `vehiculos` don't exist as separate modules in the docx (Presupuesto/Autorización share `facturacion`; Vehículo/Mantenimiento/etc. share `conductores`) | Seed only these 4 (see `20260728120000_seed_modulos.sql`); reverted the 4-file review's module-name changes in `obra_social`/`facturacion`/`conductores` migrations to match |
| **`modulos.permisos.usuario_id`**: comment-only "logical FK" vs. real FK | The draft left it as `UUID NOT NULL` with just a comment; a deleted account would leave orphaned permission rows | Add `REFERENCES auth.users(id) ON DELETE CASCADE` |
| **Migration style**: patch migration on top vs. edit in place | Nothing has been pushed to any remote/local database yet — these are still draft files | Edit the 2 existing files directly; add one new migration only for the seed data (a genuinely new concern, not a bug fix) |
| **RF-004 ingreso/egreso**: no stable Supabase column for "last logout" | `auth.users.last_sign_in_at` is a documented, stable column for login; there's no equivalent for logout | Login: trigger on `auth.users` copying `last_sign_in_at`. Logout: trigger on `auth.audit_log_entries` reacting to `payload->>'action' = 'logout'` — the only other source Supabase Auth itself provides for that event; added as its own migration since the 6 reviewed files were already pushed to remote by the time this was requested |

## Data Flow

```
auth.users (Supabase Auth)
  |  AFTER INSERT trigger: usuarios.handle_new_user()
  v
usuarios.usuarios (rol bootstrap: first row = admin, rest = empleado)
  |
  |  admin only, via create-user Edge Function --> auth.admin.createUser() --> (loops back to trigger above)
  |
  v
modulos.permisos (usuario_id, modulo_id, nivel_acceso) --> modulos.tiene_permiso(modulo, nivel)
                                                                    |
                                                                    v
                                              RLS policies on every future domain table

Every INSERT/UPDATE/DELETE on usuarios.usuarios / modulos.* --> auditoria.log_action() trigger --> auditoria.logs
                                                                                                     (SELECT: any authenticated user, per docx)
```

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `supabase/migrations/20260724100001_schema_modulos_auditoria.sql` | Modify | Comment-only pointer to where the audit-log SELECT policy is actually created |
| `supabase/migrations/20260724100002_schema_usuarios.sql` | Modify | Add missing `auditoria.logs` SELECT policy (any authenticated user, per docx) + FK on `modulos.permisos.usuario_id` |
| `supabase/migrations/20260728120000_seed_modulos.sql` | Create | Seed `modulos.modulos` with the 4 real `tipo_modulo` values (docx-derived) |
| `supabase/functions/create-user/index.ts` | Create | Admin-only account creation via service-role client |
| `CHANGES.md` | Modify | Backend progress note under C-02 |

**Total**: 2 new, 3 modified, 0 deleted.

## Interfaces / Contracts

### Database (for RLS policies in every future change)
```sql
-- Call from any table's RLS policy:
modulos.tiene_permiso('pacientes', 'write')  -- returns boolean
```

### `modulos.modulos.tipo_modulo` — canonical values (seeded)
```
pacientes, obra_social, facturacion, conductores
```
(Matches the docx's real module boundaries exactly — not the frontend's 9 feature-folder
names. `usuarios` isn't a module: access to `usuarios.usuarios` is governed by `rol`, not
`tiene_permiso()`. `dashboard` isn't a module: pure read-aggregation, no table of its own.)

### Edge Function contract — update-permisos (for the frontend team's later change)
```
POST /functions/v1/update-permisos
Authorization: Bearer <admin's JWT>

Request body (full replace — whatever isn't listed gets revoked):
{
  "usuario_id": string,
  "permisos": { "modulo": string, "nivel_acceso": "read" | "write" | "admin" }[]
}

Response 200:
{ "usuario_id": string, "permisos": [...] }

Response 403: { "error": "solo administradores pueden editar permisos" }
Response 404: { "error": "no existe una cuenta con ese usuario_id" }
Response 400: { "error": string }
```

### Edge Function contract — create-user (for the frontend team's later change)
```
POST /functions/v1/create-user
Authorization: Bearer <admin's JWT>

Request body:
{
  "email": string,
  "password": string,
  "nombre": string,
  "apellido": string,
  "permisos"?: { "modulo": string, "nivel_acceso": "read" | "write" | "admin" }[]
}

Response 200:
{ "id": string, "email": string }

Response 403: { "error": "solo administradores pueden crear cuentas" }
Response 400: { "error": string }  // validation failure
```

### `usuarios.usuarios` row shape (for the frontend team's later change)
```
id: uuid (= auth.users.id)
email: text
nombre: text
apellido: text
rol: 'admin' | 'empleado'
ingreso_at: timestamptz | null
egreso_at: timestamptz | null
created_at: timestamptz
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| DB (manual) | Bootstrap: Andrea's account promoted to `admin` via SQL Editor `UPDATE`; any account created afterward via the Edge Function stays `empleado` | Create Andrea's `auth.users` row, run the manual `UPDATE`, confirm `rol = 'admin'`; then create a second account via the Edge Function and confirm it lands as `empleado` |
| DB (manual) | `modulos.tiene_permiso()` returns correctly for both roles | SQL editor, call function as different `auth.uid()` contexts (via `set_config` or by testing through PostgREST with real JWTs) |
| DB (manual) | Every mutation on `usuarios.usuarios`/`modulos.*` lands in `auditoria.logs`, readable by any authenticated user | SQL editor, mutate then query as both roles |
| Edge Function | Admin-only gate: 403 for non-admin JWT, 200 + created user for admin JWT | `curl` smoke test against the deployed function, documented in `apply-progress.md` |

No pgTAP or automated DB integration harness exists in this repo yet (C-01 only unit-tested its client with mocks); introducing one is out of scope for this change — manual verification against the real linked project is the precedent to follow.

## Threat Matrix

| Vector | Mitigation |
|--------|------------|
| Non-admin creates account directly via PostgREST insert into `auth.users`/`usuarios.usuarios` | `auth.users` isn't writable via the anon/authenticated API at all (Supabase-managed); `usuarios.usuarios` has no INSERT policy for `authenticated` — only the `SECURITY DEFINER` trigger writes to it |
| Employee self-promotes to `admin` via UPDATE | `usuarios.prevent_rol_tampering()` trigger raises an exception on any `rol` change unless the acting user is already `admin` |
| Employee reads another module's data without permission | Every future table's RLS policy calls `modulos.tiene_permiso()`, which checks `auth.uid()` against `modulos.permisos` |
| Service-role key exposure | Lives only in Supabase Edge Function secrets; never referenced from `frontend/` |
| Audit log tampering | No UPDATE/DELETE grants on `auditoria.logs` for `authenticated`; only `SECURITY DEFINER` trigger inserts |

## Migration / Rollout

Nothing has been applied to the linked remote project (`pkryfoljypuzfifofdwp`) yet -- `supabase db push` and `supabase functions deploy create-user` will be run only after explicit go-ahead, since both act on shared/remote infrastructure. No existing data to migrate (fresh project).

## Open Questions

- None blocking. Documentation follow-up (non-blocking): update `knowledge-base/03_actores_y_roles.md` and `04_modelo_de_datos.md` to record the docx-vs-KB roles discrepancy as **resolved** (hybrid model), rather than leaving it flagged as open.
