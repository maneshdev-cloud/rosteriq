# RosterIQ — Implementation Audit

Independent audit of the existing codebase against the Datastraw brief,
performed 2026-11-03 (after the first build/deploy). Status vocabulary:
**IMPLEMENTED AND VERIFIED** · **IMPLEMENTED BUT UNVERIFIED** ·
**PARTIALLY IMPLEMENTED** · **MISSING** · **BROKEN** · **BLOCKED** ·
**DEFERRED**.

Rule applied throughout: nothing is called working without evidence, and
limitations are stated rather than dressed up.

## Baseline (before repairs)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm test` | 17/17 pass (engine suite only) |
| `npm run build` | pass |
| `npm run lint` | **FAIL: 2 errors, 2 warnings** (see D4) |

Fake-functionality sweep (`TODO|FIXME|Math.random|setTimeout|localStorage|
service_role` across src/supabase/tests/scripts): no placeholder handlers, no
random data, no fake saves, no service keys. The only `setTimeout` uses are
AbortController timeouts (repository probe 3s, Groq call 8s). The only
`catch` blocks are: invalid JSON → 400 (API), Groq failure → deterministic
template (labelled `mode: "template"`), Supabase probe failure → labelled
local fallback. None of them reports a fake success.

## Area-by-area status

| Area | Status | Evidence |
|---|---|---|
| Dashboard metrics | IMPLEMENTED AND VERIFIED | `src/lib/engine/metrics.ts` computes from the validated state; Playwright session + recorded walkthrough show 100% / 1427 of 1427 / 0 uncovered, matching test assertions |
| Employee management | PARTIALLY IMPLEMENTED | Setup adds/removes employees in demo state and regeneration respects it. No edit-in-place, no `isActive` deactivation flag. Demo scope; documented |
| Brand / process management | PARTIALLY IMPLEMENTED | Brands add/remove; brand-processes add/remove with calendar type; processes are the fixed CS/ACC/NDR/RET set (brief's process categories) |
| Pods / pod leads | PARTIALLY IMPLEMENTED | Pods + leads exist in data and views; pod CRUD is not exposed in Setup |
| Resource allocations | IMPLEMENTED AND VERIFIED | Assignments carry role (primary/shared/backup) + allocation %; Setup edits them; engine + validator consume them |
| Operating calendars | IMPLEMENTED AND VERIFIED | `calendar.ts` + `demand.ts`; unit tests cover ALL_365 / holiday-excl / Sunday-off, sale-day overrides, holiday behaviour per process |
| Leaves / comp-offs | IMPLEMENTED AND VERIFIED | `availability.ts`; leave blocks placement and counts in validation; comp-off credit via `leaves.earned_on`; fixtures assert both |
| Weekly offs | IMPLEMENTED AND VERIFIED (after D1) | Generator selects real offs; validator enforces rest + max consecutive, incl. boundary honesty (`BOUNDARY_UNVERIFIED`) |
| Roster generator | IMPLEMENTED AND VERIFIED | Deterministic (seeded); determinism test compares two runs byte-for-byte; benchmark in engine tests (Dec 2026 ≈ 209 ms; 2× dataset ≈ 531 ms, measured 2026-11-03) |
| Validator independence | IMPLEMENTED AND VERIFIED (after D1–D3) | Recomputes demand/coverage from raw state; shares no placement logic with the generator. Deliberate-violation suite: `tests/validator.test.ts` (11 tests) |
| Conflict detection | IMPLEMENTED AND VERIFIED | Issues carry code, severity, claim kind, required/actual, and a data-generated explanation (never hardcoded per-instance) |
| Roster grid, five views | IMPLEMENTED AND VERIFIED | One `RosterGrid` component, five groupings of the same state; recorded walkthrough exercises all five |
| Manual editing | IMPLEMENTED AND VERIFIED | Cell editor mutates state; parent revalidates instantly (visible in the demo video: a shortfall appears and clears) |
| Simulator | IMPLEMENTED AND VERIFIED | Clones state, never mutates the live roster until a repair is applied; before/after metrics share one denominator |
| Repair suggestions | IMPLEMENTED AND VERIFIED | Eligibility + availability + capacity filters, explicit rejection reasons, second-order check, bounded passes/candidates, honest "search exhausted ≠ impossible" wording |
| Supabase reads/writes | PARTIALLY IMPLEMENTED / BLOCKED | `repository.ts` probes the project (anon key, 3s timeout) and falls back honestly in every case; full hydration and all writes are NOT implemented — the public demo is deliberately isolated. No live Supabase project exists to verify against (account action), so cloud CRUD is BLOCKED, not faked |
| Authentication | MISSING (by design, disclosed) | No Supabase Auth is wired. The Manager/Viewer switch is a demo view mode, NOT a security boundary, and is never described as one |
| Authorization / RLS | IMPLEMENTED BUT UNVERIFIED | `002_rls.sql`: RLS on all 14 tables, public read of fictional data, manager-write (JWT `app_metadata.role`) on 8 tables, deny-by-default elsewhere. Cannot be verified without a live project (BLOCKED) |
| Fallback honesty | IMPLEMENTED AND VERIFIED | Every fallback path returns a specific note shown in the UI header ("Demo (local)" pill + note text) |
| Publishing gate | IMPLEMENTED AND VERIFIED | Publish hard-blocked while mandatory issues exist (visible in UI + walkthrough); editing a published roster forks a new draft version. Client-side only, because there is no cloud persistence yet |
| Export | IMPLEMENTED AND VERIFIED | CSV built from current validated state (`export.ts`) |
| Error handling | IMPLEMENTED AND VERIFIED (after D5, D6) | Custom 404 (verified: HTTP 404 + page on unknown route), route error boundary with retry, loading state, consistent API error shape |
| Deployment | IMPLEMENTED AND VERIFIED | Vercel production: HTTP 200, correct title, `/api/explain` responds. Note: this sandbox's headless browser cannot tunnel to vercel.app, so deployed checks are curl/API-level plus the identical local production build driven by Playwright |

## Defects found and fixed

- **D1 (High) — Validator counted approved LEAVE as weekly rest.**
  `hasRest` accepted any non-WORK status, contradicting the locked rule
  (and the validator's own NO_WEEKLY_REST message) that leave never replaces
  the weekly off. Fixed: rest = WEEKLY_OFF / HOLIDAY_OFF / COMP_OFF / CLOSED
  only. Regression tests: synthetic leave-week now flags NO_WEEKLY_REST;
  baseline still validates with 0 mandatory issues, proving the generator
  already granted real offs in leave weeks.
- **D2 (High) — Duplicate coverage rows inflated headcount.**
  The validator counted every row; two identical rows for one employee
  counted as two people and double-counted capacity. Fixed: duplicates are
  flagged `DUPLICATE_COVERAGE` (mandatory) and excluded from headcount and
  capacity totals. The SQL schema already prevents this at rest (composite
  PK on `roster_coverage`); the validator now matches it for in-memory
  states. Test included.
- **D3 (Medium) — Validator ignored the eligibility table.**
  It checked assignments only; a row with an assignment but no eligibility
  would have counted. Fixed: coverage requires assignment AND eligibility,
  else `NOT_ASSIGNED`. Seed pairs are identical (111/111), so the baseline
  is unchanged.
- **D4 (Medium) — Lint failed on the shipped code.**
  RosterGrid reassigned a variable during render (React Compiler error),
  an unused eslint-disable, an unused import, and an `any` in tests. All
  fixed; `npm run lint` is now clean. (The same pass caught a wrong type
  name — `PeriodContext`, not `PreviousContext` — now consistent.)
- **D5 (Medium) — No routing failure conventions.**
  Unknown routes showed the framework default. Added `not-found.tsx`,
  `error.tsx` (safe message, retry, digest reference only), `loading.tsx`
  per the installed Next.js 16 conventions. Verified live.
- **D6 (Low) — `/api/explain` error shape and bounds.**
  Errors are now `{ error: { code, message } }`; missing text → 400,
  invalid JSON → 400, text over 4000 chars → 413. Verified live. Success
  and template-fallback semantics unchanged.
- **D7 (Low) — RLS migration comment overstated coverage.**
  The comment claimed manager-write policies were "repeated for every
  table"; eight tables have them. Corrected the comment to state the real
  posture (the rest are deny-by-default, which was already the safe
  behaviour).

## Known limitations (stated, not hidden)

1. **No cloud persistence.** The deployed demo runs on an isolated bundled
   dataset, labelled "Demo (local)". Setup edits live in browser session
   state; a refresh regenerates from the seed. Supabase schema, RLS and the
   probe/fallback path are implemented; hydration, writes, auth and policy
   verification require a live Supabase project (BLOCKED on account setup).
2. **Roles are a demo view mode.** Manager/Viewer changes what the UI
   offers; it is not authentication and must not be presented as such.
3. **Single demo month.** December 2026 only; no month navigation.
4. **Risk Centre filters** are severity-only (no brand/pod/date filters).
5. **Generator is a heuristic.** It proves nothing about global optimality;
   the audit proves specific structural shortages only where the capacity
   maths is sound. OR-Tools behind the `Scheduler` interface is the
   documented next step, gated on benchmark evidence.
6. **Boundary verification** needs previous/next period context; where it
   is absent the validator reports `BOUNDARY_UNVERIFIED` (preference)
   instead of passing silently.

## Final verification (after repairs)

| Command / check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run lint` | clean (0 problems) |
| `npm test` | **28/28 pass** (17 engine + 11 validator) |
| `npm run build` | pass |
| Local prod server: `/` | HTTP 200 |
| Local prod server: unknown route | HTTP 404 + custom page |
| Local prod server: `/api/explain` | 200 template / 400 INVALID_JSON / 413 TEXT_TOO_LARGE |
| Baseline roster | 1,427/1,427 units, 100% covered, 0 mandatory issues |
| EcoLiving stress fixture | exact expected issue text, publish blocked |
| PureGlow structural fixture | audit proves 7 required vs 6 max staff-days/week |
