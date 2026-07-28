# Tasks: Foundation Setup — Supabase Infrastructure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 80–120 |
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

## Phase 1: Dependencies & Configuration

- [x] 1.1 Add `@supabase/supabase-js` to `frontend/package.json` dependencies
- [x] 1.2 Create `frontend/.env.example` with `SUPABASE_URL` and `SUPABASE_ANON_KEY` placeholders
- [x] 1.3 Update `frontend/.gitignore` — add `.env` to prevent secret commits
- [x] 1.4 Add `envPrefix: ['VITE_', 'SUPABASE_']` to `frontend/vite.config.ts`

## Phase 2: Infrastructure

- [x] 2.1 Create `supabase/migrations/` directory
- [x] 2.2 Create `supabase/migrations/20260727000001_create_buckets.sql` — 4 private buckets via `storage.create_bucket()`: `documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`, `documentos-facturas`

## Phase 3: Shared Clients

- [x] 3.1 Create `frontend/src/shared/lib/supabaseClient.ts` — singleton via `createClient` from `@supabase/supabase-js`
- [x] 3.2 Create `frontend/src/shared/lib/googleMapsClient.ts` — type-only placeholder stub (no network calls, no API key)

## Phase 4: Testing & Verification

- [x] 4.1 Write `frontend/src/shared/lib/__tests__/supabaseClient.test.ts` — smoke test verifying env vars load and client initializes as valid `SupabaseClient`
- [x] 4.2 Verify both client files pass `tsc -b --noEmit` with strict mode
