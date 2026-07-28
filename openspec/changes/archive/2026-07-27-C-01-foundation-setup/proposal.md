# Proposal: Foundation Setup — Supabase Infrastructure

## Intent

Establish the Supabase backend infrastructure every subsequent change depends on: project config, storage buckets, shared API clients, and migrations folder. Without C-01, no feature can connect to real data.

## Scope

### In Scope
- Supabase project config via env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- `supabase/migrations/` folder with `YYYYMMDDHHMMSS_description.sql` convention
- 4 private storage buckets: `documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`, `documentos-facturas`
- Shared Supabase client (`frontend/src/shared/lib/supabaseClient.ts`) with anon key + RLS
- Google Maps client placeholder (`frontend/src/shared/lib/googleMapsClient.ts`)
- Smoke test verifying Supabase connection

### Out of Scope
- Connecting frontend mocks to real data (per-feature change)
- Auth/RLS policies and `usuarios`/`permisos_modulo` tables (C-02)
- Google Maps API key configuration (postponed)
- Any feature code, domain tables, or frontend changes

## Capabilities

### New Capabilities
- `supabase-project-setup`: Supabase env vars, client init, migrations folder
- `storage-buckets`: Creation of the 4 private buckets via migration
- `shared-api-clients`: Shared Supabase client + Google Maps placeholder

### Modified Capabilities
None

## Approach

1. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `frontend/.env` (user has an existing Supabase project)
2. Create `supabase/migrations/` with numbered files
3. Write initial migration creating 4 buckets (all private)
4. Build `frontend/src/shared/lib/supabaseClient.ts` via `createClient` with anon key
5. Build `frontend/src/shared/lib/googleMapsClient.ts` as placeholder (key deferred)
6. Write vitest smoke test that confirms Supabase connection succeeds

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/.env` | New | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `supabase/migrations/` | New | Migration folder |
| `frontend/src/shared/lib/supabaseClient.ts` | New | Shared Supabase client |
| `frontend/src/shared/lib/googleMapsClient.ts` | New | Google Maps placeholder |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Expired/misconfigured Supabase keys | Medium | Smoke test validates connection |
| `SUPABASE_ANON_KEY` leaked in bundle | Low | Only anon key in frontend, never service role |
| Google Maps placeholder becomes dead code | Low | Minimal type-only stub, no bundle impact |

## Rollback Plan

- Revert `frontend/.env` changes
- Delete `supabase/migrations/` folder
- Remove 4 buckets via Supabase dashboard
- Delete `supabaseClient.ts` and `googleMapsClient.ts`
- Drop migration row from `_supabase_migrations`

## Dependencies

- User's existing Supabase project (URL + anon key)

## Success Criteria

- [ ] `supabase/migrations/` exists with ≥1 migration file
- [ ] 4 storage buckets exist in Supabase, all private
- [ ] `supabaseClient.ts` connects (smoke test passes)
- [ ] `googleMapsClient.ts` compiles without errors
- [ ] Smoke test passes
