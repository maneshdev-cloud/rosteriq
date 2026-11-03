# RosterIQ — Smart Roster Management System

**A Coverage Risk & Repair Engine.** RosterIQ generates a monthly roster for a
multi-brand company and guarantees one thing above all else: *every
brand-process-day is accounted for.* Coverage gaps are never hidden, approved
leave is never overridden to fill a gap, and a repair is never applied if it
silently breaks another brand.

Built for the Datastraw AI + Tech Intern assessment. Demo month: **December 2026**
with a realistic sample company — **32 employees, 4 pods, 23 brands (19 solo,
4 multi-resource), 50 brand-processes**.

**Live demo:** https://rosteriq-zeta.vercel.app
**Repository:** https://github.com/maneshdev-cloud/rosteriq

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest suites (28 tests: engine + validator)
npm run build      # production build
```

No accounts, keys, or services are required. Without Supabase environment
variables the app loads its bundled dataset and labels itself **Demo (local)**;
with them it probes Supabase first and still falls back safely (see Q4/Q6).

## What it does

- **Dashboard** — coverage %, uncovered positions, mandatory/preference issue
  counts, a pre-generation structural risk audit, a 7-day gap strip, pod table,
  and the month's approved leaves/comp-offs.
- **Roster grid** — ONE grid component; the five required views (Company, Pod,
  Brand, Process, Employee) are grouping/filter state over the same data.
  Click any cell to edit day status and process coverage; the roster
  revalidates instantly.
- **Setup** — employees, brands, brand-processes (with operating calendars),
  assignments, holidays, and leaves are all configurable in the UI. No code
  changes to add a person, a brand, or a rule.
- **Risk Centre** — every validation issue with severity, claim type, and a
  deterministic explanation. An optional AI button rephrases an explanation;
  it never changes facts (see Q7).
- **Simulator** — test an absence before approving it: root-cause analysis of
  every new gap, ranked repair candidates (each second-order checked), and a
  before/after comparison. The live roster is never mutated by a simulation.
- **Publish gate** — publishing is hard-blocked while any mandatory issue
  exists, with the reason shown. Editing a published roster forks a new draft
  version; published versions are never silently overwritten.

---

## The 8 questions from the brief

### 1. What assumptions did you make? What did you include and exclude?

Scheduling is **date-based, not time-based**: one attendance decision per
employee per day, no shifts, hours, or time-tracking (out of scope per the
brief). Rules as implemented:

- The week runs **Monday–Sunday**. Every employee gets **at least one rest
  day per week** and works **at most 6 consecutive days**. Both are mandatory.
  *Which* day is the weekly off is a preference (each employee has a preferred
  day; missing it is a preference note, never a violation).
- **Approved leave does not count as the weekly off**, and leave is never
  overridden by the generator, a repair, or a simulation.
- A day on which **all of an employee's processes are closed counts as rest**
  (e.g. the Sunday of a Sunday-off brand, or Christmas for a non-365 brand).
- Operating calendars live on the **brand-process**, not the brand: a brand
  runs 365 days for Customer Support while its cart-recovery process closes
  on Sundays. Three calendar kinds: `ALL_365`, `DAILY_EXCEPT_HOLIDAYS`,
  `SUN_AND_HOLIDAYS_OFF`.
- Coverage is counted by **headcount**. An employee's **allocation % is a
  daily workload cap**: the sum of their process allocations on a day must be
  ≤ 100%, and a coverage only counts if its allocation is at least the
  process's `min_allocation_pct` (20% in the sample data). This stops a 5%
  token allocation from claiming full coverage of a second brand.
- The generator may only use **pre-configured assignments**. Designated
  backups can be applied automatically; people who are merely *eligible* are
  suggested to the manager, never silently assigned.
- Working a 365-day process on a public holiday earns a comp-off credit;
  taking it is scheduled manually (dates in the leave data, linked by
  `earned_on`).

### 2. How does the system handle multiple processes?

Processes are first-class data. `brand_processes` pairs a brand with a
process and carries the operating calendar and staffing rule for that exact
pair. Demand (how many people a process needs on a date) is computed per
brand-process-date, including date overrides — e.g. a sale day needing 2
people on LuxeBeauty CS (19 Dec) instead of 1. An employee serving three
processes of one brand has one attendance status for the day and one coverage
row per process — which is why the roster model is split (Q4).

### 3. How did you handle weekly offs and mandatory rules?

In generation, weekly offs are chosen employee-by-employee,
most-constrained-first, with a cost model that already knows coverage: a day
is expensive if taking it off would open a gap nobody can cover, cheap if a
designated backup is free. Backups are pre-committed to leave-driven gaps
before offs are chosen, employees whose processes are all closed on a day use
that day as their rest (no backup capacity wasted), and a bounded local
repair phase (max 3 passes) then tries strictly-improving off-day swaps. The
**independent validator** re-checks everything afterwards: rest per week,
consecutive-day limit, coverage, allocation cap, eligibility. Mandatory rules
can never be waived by a manager; preference rules (preferred off-day,
weekend balance) are reported but do not block publishing.

### 4. How is data organised and validated?

PostgreSQL schema in `supabase/migrations/001_init.sql` (RLS in `002`).
The central design decision is the **split roster model**:

- `roster_days` — ONE row per employee-date: the attendance status
  (`WORK / WEEKLY_OFF / LEAVE / HOLIDAY_OFF / COMP_OFF / CLOSED`).
- `roster_coverage` — MANY rows per employee-date: which brand-processes they
  cover, at what allocation, in what role.

A single-cell model cannot express "one person covers Customer Support and
Cart Recovery today, and takes Friday off for both." Everything else is
plain relational data: pods, employees, brands, processes, brand_processes,
coverage_rules, assignments, eligibility, holidays, leaves, roster versions,
and issues. **Validation is a separate engine module that shares no placement
logic with the generator** — it recomputes demand, coverage, and employee
rules from the raw assignments, so a bug in generation cannot hide in
checking. Claims are typed and never interchangeable: a **gap** (this roster
leaves demand uncovered), a **repair not found** (the bounded search stopped),
a **structural impossibility** (only the audit may claim it, only with
capacity maths), and **validation passed** (the listed rules were checked).
Where month-boundary context is missing, the result is *boundary unverified*,
never a silent pass.

### 5. How are infeasible situations detected and explained?

Three layers, each honest about what it can prove:

1. **Structural audit (before generation).** For every brand-process and
   week: required staff-days vs the maximum its assigned pool could ever
   supply after mandatory rest and leave. If supply < demand, the
   configuration is *provably* infeasible — e.g. remove PureGlow's only
   backup and the audit shows CS needs 7 staff-days/week while one person can
   supply at most 6 (fixture: `fixtures/structural-risk-pureglow.json`).
2. **Generation + validation.** Gaps the audit cannot see (it can't detect
   every interaction) surface as validator issues with exact required/actual
   numbers and a deterministic root-cause message naming the people involved.
3. **The unfixable case, shown not hidden.** Fixture
   `fixtures/stress-ecoliving-2026-12-14.json`: EcoLiving CS on Mon 14 Dec
   2026 — sole assignee Geeta Rao and designated backup Rashmi Iyer are both
   on approved leave and nobody else is eligible. The app reports
   "required 1, actual 0", the repair engine returns **no applicable
   candidate**, and **publishing is blocked**. The correct manager actions
   (add eligibility, change the requirement, accept the uncovered day
   explicitly) are listed in the Simulator.

### 6. How does it scale to 100+ employees?

The engine is pure TypeScript with no per-employee special cases, and it was
benchmarked rather than assumed (Vitest, this machine):

| Dataset | Generate | Validate | Required units | Uncovered | Mandatory issues |
|---|---|---|---|---|---|
| 32 employees · 23 brands · 50 processes (Dec 2026) | ~209 ms | ~19 ms | 1,427 | **0** | **0** |
| 64 employees · 46 brands (duplicated 2×) | ~531 ms | ~64 ms | 2,854 | 0 | 0 |

The 32-employee baseline solves with **zero repair passes needed** — the
selection phase already produces a valid roster. The heuristic was *not*
chosen by default: it sits behind a `Scheduler` interface
(`src/lib/engine/scheduler.ts`), and the benchmark scenarios (baseline, sale
days, leave clusters, the structural and stress fixtures, 2× scale) are the
acceptance gate. If a future dataset shows the heuristic leaving *avoidable*
gaps, a CP-SAT scheduler can be dropped in behind the same interface without
touching the validator, simulator, or UI — the honest escalation path,
adopted only if the benchmark demands it. Data-wise, the app probes Supabase
via REST with the **anon key only** (RLS makes public read safe; writes need
an authenticated manager role), always with a 3-second timeout and a labelled
local fallback, because a paused free-tier project must never take the demo
down.

### 7. Where did you use AI?

**Nowhere in any scheduling decision.** Generation, validation, audit,
simulation, and repair ranking are deterministic and reproducible (fixed
seed). The optional layer (`src/app/api/explain/route.ts`, Groq) receives one
already-validated issue message and may only rephrase it for readability; it
is instructed to add no facts, it cannot mark anything valid or invalid, and
on any failure — including no API key — the deterministic template text is
returned unchanged and the app works fully. AI assistance was also used in
*building* this project; every engine rule here is covered by automated tests
so the behaviour does not depend on trusting generated code.

### 8. What would you improve with more time?

- A CP-SAT-backed scheduler behind the existing interface, adopted only if a
  larger benchmark (100+ employees, tighter pools) shows avoidable gaps.
- Full Supabase Auth sign-in and persisted editing (the schema, RLS policies,
  and versioning model are already in place; the demo intentionally runs on
  its labelled local dataset so reviewers can't overwrite each other).
- Richer repair moves: off-day *swaps* between two employees, and comp-off
  auto-scheduling from earned credits.
- Historical analytics: gap trends by brand/pod across months, and fairness
  reports (weekend-off distribution) as first-class dashboards.
- Shift-level (hourly) scheduling as a separate layer, if a real client
  needed it — deliberately excluded here per the brief.

## Repository map

```
src/lib/types.ts            domain types + engine contracts
src/lib/engine/             calendar · demand · availability · audit ·
                            generator · validator · simulator · explain ·
                            metrics · export · scheduler (interface)
src/lib/data/repository.ts  Supabase probe (anon key, timeout) + local fallback
src/components/             dashboard shell · one grid (5 views) · cell editor ·
                            setup · risk centre · simulator
src/app/api/explain/        optional grounded AI rephrasing endpoint
supabase/migrations/        001 schema · 002 row-level security
scripts/build-seed.mjs      canonical dataset generator (single source of names)
fixtures/                   structural-risk + unfixable-case scenarios
tests/engine.test.ts        17 tests over every engine claim above
tests/validator.test.ts     11 tests: deliberately invalid rosters the
                            validator must catch + determinism
docs/IMPLEMENTATION_AUDIT.md  independent audit: status per area, defects
                            found and fixed, what is blocked and why
docs/APPROACH.md            approach note · docs/INTERVIEW_GUIDE.md ·
docs/VIDEO_SCRIPT.md
```
