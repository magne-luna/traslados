# Tasks: C-02 Usuarios, Permisos y Auditoría (backend)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150–200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

```
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low
```

## Phase 1: Fix draft migrations

- [ ] 1.1 `20260724100002_schema_usuarios.sql` — add `CREATE POLICY "Admins can read audit logs" ON auditoria.logs FOR SELECT TO authenticated USING (...)` (placed here, after `usuarios.usuarios` exists, since the policy needs to check `rol`)
- [ ] 1.2 `20260724100002_schema_usuarios.sql` — add FK `modulos.permisos.usuario_id REFERENCES auth.users(id) ON DELETE CASCADE` (as an `ALTER TABLE` after `modulos.permisos` exists)

## Phase 2: Seed data

- [ ] 2.1 Create `supabase/migrations/20260728120000_seed_modulos.sql` — insert the 4 real `tipo_modulo` values (pacientes, obra_social, facturacion, conductores) into `modulos.modulos`

## Phase 3: Edge Function

- [ ] 3.1 Create `supabase/functions/create-user/index.ts` — verify caller JWT belongs to an `admin` (query `usuarios.usuarios`), then use service-role client to call `auth.admin.createUser()` with `user_metadata: { nombre, apellido }`
- [ ] 3.2 Accept optional `permisos` array in the request body, insert corresponding `modulos.permisos` rows for the new account in the same call
- [ ] 3.3 Return 403 with a clear error body for non-admin callers, 400 for validation failures, 200 + `{ id, email }` on success

## Phase 3b: RF-004 ingreso/egreso tracking

- [ ] 3b.1 Create `supabase/migrations/20260728130000_track_ingreso_egreso.sql` — trigger on `auth.users` copying `last_sign_in_at` to `usuarios.usuarios.ingreso_at`
- [ ] 3b.2 Same migration — trigger on `auth.audit_log_entries` updating `egreso_at` when `payload->>'action' = 'logout'`

## Phase 3c: update-permisos Edge Function

- [ ] 3c.1 Create `supabase/functions/update-permisos/index.ts` — admin-only, full-replace semantics (upsert given `{modulo, nivel_acceso}` pairs, delete anything not included) for an existing `usuario_id`
- [ ] 3c.2 Validate `usuario_id` exists and every `modulo` resolves against `modulos.modulos`, return 404/400 accordingly

## Phase 4: Deploy & verify (requires explicit go-ahead before each remote action)

- [ ] 4.1 `supabase db push` — apply migrations to the linked remote project (`pkryfoljypuzfifofdwp`)
- [ ] 4.2 `supabase functions deploy create-user`
- [ ] 4.3 Create Andrea's `auth.users` account, then run the one-time manual `UPDATE usuarios.usuarios SET rol = 'admin' WHERE id = '<her-uuid>'` in the SQL Editor
- [ ] 4.4 Manual verification per `design.md` §Testing Strategy (admin bootstrap, second account empleado, `tiene_permiso()` behavior, audit log visibility, Edge Function 403/200 split)

## Phase 5: Documentation

- [ ] 5.1 Add backend progress note to `CHANGES.md`'s C-02 entry (leave `[ ]` checkbox — frontend side still pending)
- [ ] 5.2 (Follow-up, non-blocking) Update `knowledge-base/03_actores_y_roles.md` / `04_modelo_de_datos.md` to record the roles discrepancy as resolved
