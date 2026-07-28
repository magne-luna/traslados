# Design: C-01 Foundation Setup — Supabase Infrastructure

## Technical Approach

Establish the Supabase backend foundation in three layers: (1) env vars wiring for Vite, (2) versioned migrations folder with an initial SQL migration that creates 4 private storage buckets, (3) typed shared clients (`supabaseClient.ts`, `googleMapsClient.ts`) in the existing `frontend/src/shared/lib/` structure. The `@supabase/supabase-js` dependency must be added first since it is not yet in `package.json`. No RLS policies or auth tables yet — those ship in C-02.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Env var naming**: rename to `VITE_SUPABASE_URL` vs. add `envPrefix` in `vite.config.ts` | Rename breaks KB naming; `envPrefix` keeps names aligned with KB at cost of one config line | Add `envPrefix: ['VITE_', 'SUPABASE_']` to `vite.config.ts` — `SUPABASE_URL` and `SUPABASE_ANON_KEY` accessible as `import.meta.env.SUPABASE_URL` without renaming |
| **Migration tool**: raw SQL via `supabase/migrations/` vs. Supabase CLI | CLI adds dev dependency and CI step; raw SQL is portable, visible, and sufficient at this stage | Raw timestamped SQL files under `supabase/migrations/` — no CLI wrapper |
| **Client singleton**: module-level export vs. React Context | Context couples to React render tree; module-level singleton is framework-agnostic and matches how `createClient` is documented | Module-level singleton: `export const supabase = createClient(url, anonKey)` |
| **Bucket creation**: via Supabase dashboard vs. SQL migration | Dashboard is manual, not repeatable; SQL migration via `storage.create_bucket()` is versioned and automatic | SQL migration using `storage.create_bucket()` — all 4 buckets created atomically |
| **Google Maps client**: placeholder type vs. removed import | Removing the import breaks existing `@vis.gl/react-google-maps` dep usage; placeholder keeps contract stable | Type-only stub exporting a documented placeholder object — no network calls, compiles to zero bytes after tree-shaking |
| **.env file lifecycle**: committed vs. gitignored | `.env` contains secrets; anon key is public but URL is not sensitive — still idiomatic to keep `.env` gitignored | Create `.env` locally (gitignored), provide `.env.example` committed with placeholder values |

## Data Flow

```
frontend/.env ──→ Vite (envPrefix) ──→ supabaseClient.ts (createClient)
                                              │
                                              ▼
                                    Supabase project (URL + anon key)
                                              │
                                              ▼
                              Supabase Storage (4 private buckets)
                                       via initial migration
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/package.json` | Modify | Add `@supabase/supabase-js` dependency |
| `frontend/.env` | Create | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (gitignored, populated manually) |
| `frontend/.env.example` | Create | Template with placeholder values (committed) |
| `frontend/.gitignore` | Modify | Add `.env` to prevent accidental commits |
| `frontend/vite.config.ts` | Modify | Add `envPrefix: ['VITE_', 'SUPABASE_']` |
| `supabase/migrations/` | Create | Directory for versioned SQL migrations |
| `supabase/migrations/20260727000001_create_buckets.sql` | Create | Initial migration: create 4 private buckets via `storage.create_bucket()` |
| `frontend/src/shared/lib/supabaseClient.ts` | Create | Singleton Supabase client with `createClient` + typed exports |
| `frontend/src/shared/lib/googleMapsClient.ts` | Create | Type-only placeholder stub for deferred Google Maps key |
| `frontend/src/shared/lib/__tests__/supabaseClient.test.ts` | Create | Smoke test confirming client initialization and connection |

**Total**: 6 new, 3 modified, 0 deleted.

## Interfaces / Contracts

```typescript
// supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl: string = import.meta.env.SUPABASE_URL
const supabaseAnonKey: string = import.meta.env.SUPABASE_ANON_KEY

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
```

```typescript
// googleMapsClient.ts
/**
 * Google Maps client — placeholder.
 * API key is deferred. Initialize with @vis.gl/react-google-maps
 * once GOOGLE_MAPS_API_KEY is available via env vars.
 * No network calls. No initialization.
 */
export const googleMapsClient = {} as const
export type GoogleMapsClient = typeof googleMapsClient
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `supabaseClient` module exports a valid `SupabaseClient` when env vars are set | Mock `import.meta.env`, assert instance is not null |
| Unit | `googleMapsClient` compiles and exports typed object with no side effects | Static import check, assert no functions/network calls |
| Build | Both files pass `tsc -b --noEmit` with strict mode | Existing CI check covers all files |
| Smoke | Test Supabase connection with a lightweight query (`SELECT 1` or `ping`) | Use `supabase.rpc('ping')` or `supabase.from('_supabase_migrations').select('*').limit(1)` — confirm round-trip succeeds |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required for existing data. The `.env` file must be populated manually by the developer with real Supabase project credentials. The `@supabase/supabase-js` package must be installed via `npm install` after adding it to `package.json`.

## Open Questions

- None — all decisions are scoped and aligned with the proposal and specs.
