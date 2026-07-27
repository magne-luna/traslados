# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

Project: Traslados — Sistema de Gestión Integral para servicio de traslado personalizado de personas con discapacidad (cliente Andrea Pastor, Magne Studios).

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Hooks design, component composition, Server vs Client decision, error boundary placement, context optimization, rendering performance | react-best-practices | ~/.claude/skills/react-best-practices/SKILL.md |
| React component development, Next.js page creation, state management design, frontend performance audit, component library setup | senior-frontend | ~/.claude/skills/senior-frontend/SKILL.md |
| Designing UI components, component architectures, responsive layouts, design systems, state management selection | frontend-ui-design | ~/.claude/skills/frontend-ui-design/SKILL.md |
| Building a Tailwind design system, tokens, component variants, responsive patterns, accessibility | tailwind-design-system | ~/.claude/skills/tailwind-design-system/SKILL.md |
| "design system", "design tokens", "component library", "theme", "Tailwind config", "dark mode tokens", "color system" | ui-design-system | ~/.claude/skills/ui-design-system/SKILL.md |
| Any task involving Supabase (Database, Auth, Edge Functions, Realtime, Storage, RLS, CLI, MCP, migrations) | supabase | ~/.claude/skills/supabase/SKILL.md |
| Writing/reviewing/optimizing Postgres queries, schema, configs | supabase-postgres-best-practices | ~/.claude/skills/supabase-postgres-best-practices/SKILL.md |
| Designing DB schemas, migrations, data relationships, query optimization, indexes, SQL vs NoSQL | database-schema-design | ~/.claude/skills/database-schema-design/SKILL.md |
| Designing API endpoints, request/response schemas, OpenAPI specs, REST/GraphQL/tRPC choice | api-design | ~/.claude/skills/api-design/SKILL.md |
| Security vulnerability review, auth/authz implementation, input handling, secrets, dependency CVE audit | security-review | ~/.claude/skills/security-review/SKILL.md |
| Optimizing performance, load times, DB queries, performance budgets, bottleneck diagnosis | performance-optimization | ~/.claude/skills/performance-optimization/SKILL.md |
| Choosing testing approach, frameworks, coverage thresholds, test infra setup | testing-strategy | ~/.claude/skills/testing-strategy/SKILL.md |
| Writing new code/features/bug fixes requiring RED-GREEN-REFACTOR TDD cycle | test-driven-development | ~/.claude/skills/test-driven-development/SKILL.md |
| Playwright-based web app testing — screenshots, console logs, interaction, visual regression, a11y, network mocking | webapp-testing | ~/.claude/skills/webapp-testing/SKILL.md |
| Automate browser interactions via the `playwright-cli` command-line tool | playwright-cli | ~/.claude/skills/playwright-cli/SKILL.md |
| PDF generation, extraction, form filling, merge/split, OCR, watermarking, metadata | pdf-processing | ~/.claude/skills/pdf-processing/SKILL.md |
| Excel file manipulation — read/write, formulas, charts, conditional formatting, pivot tables | xlsx-processing | ~/.claude/skills/xlsx-processing/SKILL.md |
| Setting up CI/CD, deployment configs, deploy checklists, infra | deployment | ~/.claude/skills/deployment/SKILL.md |
| Any map, place, geocoding, routing/ETA, nearby search, Street View, marker clustering, drawing, geofencing, heatmap, air-quality/pollen/solar/weather feature using Google Maps Platform | google-maps-platform | ~/.claude/skills/google-maps-platform/SKILL.md |
| Interacting with Google Drive data (files, folders, permissions, shared drives) | google-drive | ~/.claude/skills/google-drive/SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### react-best-practices
- Server Components by default; add `'use client'` only for state/effects/handlers/browser APIs.
- Never lie about `useEffect` deps (`react-hooks/exhaustive-deps`); always cleanup with `AbortController`.
- Do NOT use `useEffect` for data fetching — use React Query/SWR or Server Components.
- Profile BEFORE memoizing (`React.memo`/`useMemo`/`useCallback`) — premature memoization is the top anti-pattern.
- Prefer compound components / slots over prop-explosion for complex UI; custom hooks return an object (not array) for >2 values.
- Error boundaries at route/feature/data level — never at leaf/individual-element level.
- Never use array index as key for dynamic lists; use stable unique IDs.
- Split/memoize Context value when re-renders are a measured problem; otherwise lift state up.
- Virtualize lists > 100 items (`@tanstack/react-virtual`).
- Keep components < ~200 lines — extract sub-components.

### senior-frontend
- TypeScript strict mode everywhere; never use `any` — use `unknown` + type guards.
- Atomic design hierarchy: Atoms -> Molecules -> Organisms -> Templates -> Pages.
- State selection: server state -> TanStack Query; forms -> React Hook Form + Zod; global UI -> Zustand; local -> useState/useReducer; URL state -> nuqs/useSearchParams.
- Server Components by default; Client Components only when interactivity/hooks/browser APIs are required.
- Mandatory >85% test coverage (lines/branches/functions/statements) — Vitest + React Testing Library + Playwright E2E.
- Perf budget: bundle < 200KB gzip initial load, LCP < 2.5s, FID < 100ms, CLS < 0.1; use next/image + next/font; virtualize lists > 100 items.
- No prop drilling beyond 2 levels — use composition/context/Zustand; no barrel exports (breaks tree-shaking).
- Test behavior/outcomes, never implementation details.

### frontend-ui-design
- Discovery first: confirm framework, existing design system, target devices, WCAG level, data needs before designing — STOP and present summary before proceeding.
- WCAG 2.1 AA is the floor, not optional: semantic HTML before ARIA, visible focus indicators (never `outline:none` without replacement), full keyboard operability, logical tab order, focus traps in modals.
- Color contrast: 4.5:1 normal text, 3:1 large text/UI components; never rely on color alone to convey info.
- Mobile-first responsive; prefer container queries for component-level responsiveness; fluid typography via `clamp()`.
- State selection heuristic: start with `useState`, escalate only on real limitation; form libs only for >3 fields with validation.
- Design tokens (not hard-coded values); support light+dark themes, respect `prefers-color-scheme`, allow user override.
- Design loading/error/empty states explicitly — never leave blank screens.

### tailwind-design-system
- Use for building Tailwind-based design systems: tokens, variants, responsive/dark-mode patterns.
- Clarify goals/constraints first, then apply best practices with validation.
- For detailed patterns/examples, consult `resources/implementation-playbook.md` inside the skill directory rather than improvising.

### ui-design-system
- Token architecture is 3 layers: Primitive (raw values, e.g. `--color-blue-500`) -> Semantic (`--action-primary`) -> Component (`--button-height-md`). Components must reference semantic tokens only, never primitives directly.
- Use OKLCH for color tokens; 4px/8px base spacing scale; rem units everywhere (never mix px/rem/em).
- Tailwind v4: define tokens via CSS `@theme` block, not JS config.
- Dark mode = remap semantic tokens (never "invert colors"); support both `prefers-color-scheme` and a `data-theme` class override.
- Prefer container queries over media queries for component-level responsiveness.
- Never use `!important` to fight the cascade; extend existing components with variants instead of one-offs.
- Contrast ratio >= 4.5:1 (WCAG AA) is a hard verification item.

### supabase
- Fetch `https://supabase.com/changelog.md` and check breaking changes before implementing — do not rely on training data for Supabase APIs/CLI/config.toml.
- RLS: enable on every table in `public` (and any exposed schema); UPDATE policies need both `USING` and `WITH CHECK`; UPDATE requires a SELECT policy too (else silently 0 rows).
- Never use `auth.role() = 'authenticated'` (deprecated, breaks with anonymous sign-ins) — use the policy `TO` clause plus an ownership predicate (`TO authenticated` alone = auth without authz = BOLA/IDOR).
- Never use `user_metadata`/`raw_user_meta_data` for authorization — it's user-editable; use `app_metadata`/`raw_app_meta_data`.
- Views bypass RLS by default — use `WITH (security_invoker = true)` (PG15+) or restrict access on older PG.
- `SECURITY DEFINER` functions bypass RLS and are publicly executable by default — avoid; if required, keep in a non-exposed schema with an explicit `auth.uid()` check.
- Never expose `service_role`/secret keys client-side; only publishable/anon keys in frontend code.
- Storage upsert needs INSERT + SELECT + UPDATE grants (not just INSERT).
- Schema changes: use `execute_sql`/`supabase db query` to iterate, never `apply_migration` for iterative local changes (writes migration history every call); run `supabase db advisors` before committing a migration.

### supabase-postgres-best-practices
- Reference categories by priority: query performance (critical) > connection mgmt (critical) > security/RLS (critical) > schema design (high) > concurrency/locking (medium-high) > data access (medium) > monitoring (low-medium) > advanced features (low).
- Consult `references/<prefix>-*.md` files for concrete incorrect-vs-correct SQL examples per rule rather than guessing.
- Apply when writing/reviewing any SQL, index, or connection-pooling configuration on Postgres/Supabase.

### database-schema-design
- Discovery first (entities, relationships, query patterns, volume, read/write ratio) — STOP and present conceptual model before logical design.
- Always start normalized (3NF); denormalize only with measured evidence of a performance problem.
- Default NOT NULL; specific types over `varchar` (e.g. `timestamptz`); always add FK/CHECK/UNIQUE constraints; index every FK column.
- Composite index column order: high-cardinality equality columns first, range columns last — a `(A,B,C)` index does not serve queries on `B` or `C` alone.
- Migrations: never break in one step — use expand/contract (add nullable -> dual write -> backfill in batches of ~1000 -> switch reads -> drop old). Never `CREATE INDEX` without `CONCURRENTLY` in production; never `ALTER COLUMN TYPE` directly (locks table).
- Every migration needs a rollback plan; test rollback in staging first.
- UUID PKs for distributed systems, auto-increment for single-node.

### api-design
- Discovery first — ask about resources, consumers, auth, paradigm (REST/GraphQL/tRPC), versioning, pagination one at a time; STOP and confirm before designing endpoints.
- Consistent naming: plural nouns for collections (`/users`); verbs in URLs (`/getUsers`) are an anti-pattern.
- Consistent error shape across ALL endpoints: `{ "error": { "code", "message", "details": [...] } }`.
- Every list endpoint must be paginated (cursor for real-time/large data, offset for small/admin, keyset for time-series/logs) — never skip pagination.
- Correct HTTP methods/status codes: POST->201, DELETE->204, PUT/DELETE idempotent, PATCH not idempotent.
- Version from day one; never return 200 for error conditions.
- Auth must be specified per endpoint before the OpenAPI spec is generated.

### security-review
- OWASP Top 10 checklist is mandatory for any auth/session change: broken access control, crypto failures, injection, insecure design, misconfig, vulnerable components, auth failures, integrity failures, logging failures, SSRF.
- Always parameterized queries — never string-concatenate user input into SQL/commands; always allow-list validation, never block-list.
- JWT: RS256 for multi-service, 15 min max access token expiry, HttpOnly cookies (never localStorage), minimal claims.
- Secrets: never hard-code, never commit `.env`, never log (even at debug), never pass as CLI args, unique per environment; rotate API keys/DB passwords every 90 days.
- Security headers required: CSP, HSTS, X-Content-Type-Options: nosniff, X-Frame-Options, Referrer-Policy.
- CORS: never `Access-Control-Allow-Origin: *` with credentials — allowlist specific origins.
- File uploads: validate MIME server-side, random filenames, store outside web root, enforce size limits.
- For new auth/session features run full STRIDE threat modeling (spoofing/tampering/repudiation/info disclosure/DoS/privilege escalation).

### performance-optimization
- Mandatory MEASURE -> IDENTIFY -> OPTIMIZE -> VERIFY cycle — never optimize without a captured baseline; if improvement isn't measurable after the fix, revert it.
- Change ONE thing at a time so improvement is attributable.
- Track p95/p99 latency, not averages.
- Web Vitals targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Bundle: route-level code splitting (`React.lazy`+`Suspense`), tree shaking, dynamic imports for heavy libs.
- DB: `EXPLAIN ANALYZE` before adding indexes; Seq Scan on large table = missing index; index WHERE/JOIN/ORDER BY columns, equality columns before range columns in composites.
- Cache with an explicit invalidation strategy before introducing it — never cache "and figure out invalidation later."

### testing-strategy
- Analyze existing stack/tests/CI before recommending frameworks — do not prescribe blind.
- Testing pyramid ratios: ~60% unit, ~30% integration, ~10% E2E; E2E only for critical user journeys.
- Coverage targets by category: overall 70–85%, critical paths (auth/payments) 90–95%, new code in PRs 80–90%, utilities 95–100%.
- Framework picks for Node/TS stack: Vitest (unit), Vitest+Supertest (integration), Playwright (E2E).
- Test behavior/outcomes, not implementation; mock only at boundaries (external APIs, DB, filesystem, time) — excessive mocking tests nothing real.
- Enforce coverage thresholds in CI, not just locally.

### test-driven-development
- Iron Law / HARD-GATE: **no production code without a failing test first** — no exceptions.
- Cycle per behavior: RED (one failing test, verify it fails for the right reason) -> GREEN (minimum code to pass, hardcoding is fine) -> REFACTOR (clean up, rerun full suite after every change).
- Run the FULL test suite after every GREEN and every refactor step — all tests must pass, not just the new one.
- One test per cycle — never batch multiple tests before writing code.
- If a test passes immediately on first run, the test is wrong or the behavior already exists — investigate, don't proceed.
- Never modify a test to make it pass — fix the code; tests specify the requirement.
- Invoke `verification-before-completion` before claiming any TDD-driven work is done.

### webapp-testing
- Locator priority in Playwright tests: `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId` (last resort) — never CSS selectors or XPath.
- Use Page Object Model for key pages/flows.
- Never `page.waitForTimeout()` — use `expect().toBeVisible()`/proper web-first assertions instead.
- axe-core accessibility scan (`wcag2a`,`wcag2aa`,`wcag21aa`) is mandatory on every page tested.
- Mask dynamic content (timestamps, avatars, charts) in visual regression screenshots; disable animations.
- CI config: headless, 2 retries on CI, screenshot+video only on failure, JUnit XML output.
- Mobile viewport tests required for responsive features (e.g. `viewport: {width:375, height:667}`).

### playwright-cli
- CLI tool for browser automation, distinct from the Playwright test framework: `open`/`goto`/`click`/`fill`/`snapshot`/`screenshot`/`close`.
- Prefer snapshot `ref`s (e.g. `e15`) over raw CSS selectors for targeting elements; use `find` to search a large snapshot instead of dumping it all.
- Use `--raw` to strip status/snapshot noise when piping output to other tools; `--json` for structured output.
- On Windows cmd/PowerShell, escape `&` in URLs (`^&` in cmd, `--%` prefix in PowerShell) or query params get truncated.
- Use named sessions (`-s=name`) for concurrent/multi-tab browser workflows.

### pdf-processing
- Library choice by task: pdfplumber (text/table extraction), reportlab (generation), pypdf (merge/split/metadata/forms), pytesseract+pdf2image (OCR of scanned docs), weasyprint (HTML->PDF).
- Never OCR a digital (already text-extractable) PDF — attempt direct text extraction first, OCR only if empty.
- Detect encryption and page rotation explicitly before extracting — don't assume unencrypted/upright pages.
- Never load huge PDFs entirely into memory — stream/process in chunks; always use context managers to close file handles.
- Test rendering output in multiple viewers (Adobe, Preview, Chrome) before considering generation complete.

### xlsx-processing
- Library choice: openpyxl for rich formatting/charts/conditional formatting, pandas for data analysis/pivots; combine both for formatted reports from analysis.
- Row-count gate: standard mode fine under 10K rows; 10K–1M rows requires `write_only`/`read_only` streaming mode; above ~1M rows use CSV/Parquet instead of XLSX (Excel hard limit: 1,048,576 rows).
- Always close `read_only` workbooks (`wb.close()` or context manager) — avoids resource leaks.
- Always use `.xlsx`, never legacy `.xls`.
- Freeze header row (`ws.freeze_panes`) on data sheets; set explicit `number_format` for dates to avoid rendering as raw numbers.
- Test output in Excel, LibreOffice, AND Google Sheets — formatting varies across apps.

### deployment
- Detect deployment target/CI/infra context first and get user confirmation before designing the pipeline — do not assume a platform.
- Standard pipeline stages: Build -> Test -> Lint/Check -> Deploy -> Verify; branch gating (feature branches: build+test+lint only; main: + deploy to staging; tags/release: + deploy to production, often manual approval).
- Every deploy needs a documented rollback plan and post-deploy health/smoke checks — never a manual, un-audited production deploy.
- Secrets only via env vars/secrets manager, never committed to code/config; pin image/dependency versions (never `latest` tag in production).
- Add concurrency groups to CI config to prevent overlapping/conflicting deploys.
- Always deploy to staging before production — never skip staging.

### google-maps-platform
- Mandatory entry point for ANY Google Maps Platform code (new feature, bug fix, refactor, or review) — must fetch the Skills Index (`https://www.gstatic.com/googlemapsplatform-agent-skills/index.json`) and load the matching per-product sub-skill before writing code; do not rely on training-data memory for Maps APIs.
- Hard-banned legacy APIs (disabled for new projects, not just "deprecated"): `google.maps.Marker` (use `AdvancedMarkerElement`), legacy `Autocomplete`/`SearchBox`/`PlacesService` (use Places API New), `DirectionsService`/`DirectionsRenderer` and `DistanceMatrixService` (use Routes API `Route.computeRoutes()`/`computeRouteMatrix`), `google.maps.Geocoder` JS class (use Geocoding REST API directly), `visualization.HeatmapLayer` (use deck.gl), Drawing library (use Terra Draw).
- Framework policy: React MUST use `@vis.gl/react-google-maps` (never `google-map-react`/`@react-google-maps/api`); Angular MUST use `@angular/google-maps`; vanilla JS uses `@googlemaps/js-api-loader`.
- Critical failure traps: REST endpoints (Routes/Places New/Geocoding) block client-side `fetch()` via CORS — always use SDK wrappers or a server proxy; `<Map>`/`<gmp-map>` needs explicit CSS height or renders 0x0; `mapId` is mandatory whenever rendering `AdvancedMarkerElement` (use `"DEMO_MAP_ID"` for prototyping).
- Never hardcode API keys — request via env var, instruct the user to restrict keys by HTTP referrer/package/bundle ID and to specific APIs.
- All place data (names, addresses, hours, ratings, coordinates) must come from a live API call — never hallucinated from memory.
- For prototyping, the free Maps Demo Key needs no billing account (covers Maps JS, Places, Routes, Geocoding, Weather, Maps Grounding Lite, Places UI Kit) but is not for production use.

### google-drive
- Use the Membrane CLI (`membrane`) for all Google Drive integration — it handles OAuth/credential refresh automatically; never ask the user for raw API keys/tokens.
- Flow: `membrane connection ensure "<drive url>"` -> if `state:"BUILDING"` poll with `connection get <id> --wait` -> if `CLIENT_ACTION_REQUIRED` surface `clientAction.uiUrl`/instructions to the user.
- Discover actions before writing custom API calls: `membrane action list --connectionId=ID --intent "<query>"` — prebuilt actions handle pagination/field-mapping/edge cases raw calls miss.
- Run actions with `membrane action run <actionId> --connectionId=ID --input '{...}' --json`; result is in the `output` field.
- Fall back to `membrane request CONNECTION_ID /path` (proxy) only when no prebuilt action covers the use case.

## Project Conventions

No project-level convention files found yet (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `copilot-instructions.md` — none exist at project root as of this scan). This section will populate once the `agent-instruction` phase generates the canonical project `CLAUDE.md`/`AGENTS.md`. Re-run this skill after that file exists to pick up project-specific conventions.

| File | Path | Notes |
|------|------|-------|
| — | — | None found — normal for a pre-`agent-instruction` project state |
