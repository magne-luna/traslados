# Apply Progress: C-01-foundation-setup

## Summary

Implementation of Supabase infrastructure foundation: env vars, versioned migrations, 4 private storage buckets, shared Supabase client, Google Maps placeholder, and smoke tests.

**10/10 tasks completed** in single batch.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 Add `@supabase/supabase-js` | N/A (dep only) | Config | N/A | ➖ | ➖ | ➖ | ➖ |
| 1.2 Create `.env.example` | N/A (config) | Config | N/A | ➖ | ➖ | ➖ | ➖ |
| 1.3 Update `.gitignore` | N/A (config) | Config | N/A | ➖ | ➖ | ➖ | ➖ |
| 1.4 Add `envPrefix` to vite.config.ts | N/A (config) | Config | N/A | ➖ | ➖ | ➖ | ➖ |
| 2.1 Create `supabase/migrations/` | N/A (dir) | Infra | N/A | ➖ | ➖ | ➖ | ➖ |
| 2.2 Create buckets migration | N/A (SQL) | Infra | N/A | ➖ | ➖ | ➖ | ➖ |
| 3.1 Create `supabaseClient.ts` | `supabaseClient.test.ts` | Unit | New module | ✅ Written first | ✅ Passed | ✅ 3 assertions | ➖ None needed |
| 3.2 Create `googleMapsClient.ts` | `googleMapsClient.test.ts` | Unit | New module | ✅ Written first | ✅ Passed | ✅ 2 assertions | ➖ None needed |
| 4.1 Write smoke tests | Same as 3.1/3.2 | Unit | N/A | ✅ Merged | ✅ Passed | ✅ See above | ➖ None needed |
| 4.2 Verify `tsc -b --noEmit` | N/A (build) | Build | N/A | ➖ | ✅ Passed (exit 0) | ➖ | ➖ |

**Key**: ✅ completed, ➖ N/A (config/infra/build tasks don't require RED tests).

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command | `npx vitest run src/shared/lib/__tests__/` — 2 files, 3 tests, exit 0 |
| Runtime harness | N/A — no runtime boundary exists (no real Supabase instance connected) |
| Rollback boundary | `frontend/.env` (delete), `supabase/migrations/` (delete folder), `frontend/src/shared/lib/supabaseClient.ts` (delete), `frontend/src/shared/lib/googleMapsClient.ts` (delete), revert `package.json`/`.gitignore`/`vite.config.ts` changes |

## Changes Made

| File | Action |
|------|--------|
| `frontend/package.json` | Modified — added `@supabase/supabase-js` |
| `frontend/.env.example` | Created — env var template |
| `frontend/.gitignore` | Modified — added `.env` |
| `frontend/vite.config.ts` | Modified — added `envPrefix` |
| `supabase/migrations/` | Created — migration directory |
| `supabase/migrations/20260727000001_create_buckets.sql` | Created — 4 private buckets |
| `frontend/src/shared/lib/supabaseClient.ts` | Created — singleton client |
| `frontend/src/shared/lib/googleMapsClient.ts` | Created — type stub |
| `frontend/src/shared/lib/__tests__/supabaseClient.test.ts` | Created — smoke test |
| `frontend/src/shared/lib/__tests__/googleMapsClient.test.ts` | Created — structural test |
