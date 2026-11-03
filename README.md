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

## Assumptions (documented per §4 of the brief)

Scheduling is **date-based, not time-based**: one attendance decision per
employee per day, no shifts, hours, or time-tracking. Rules as implemented:

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

## The 8 questions from the brief (§8)

### 1. How did you model employees, brands, processes, pods, and their relationships?

Plain relational data (PostgreSQL schema in `supabase/migrations/001_init.sql`,
RLS in `002`):

- A **pod** groups employees and has a pod lead (an employee). **Brands**
  belong to a pod; every brand is looked after by that pod's team.
- A **brand-process** pairs a brand with one of the processes (CS, ACC, NDR,
  RET) and carries *that pair's* operating calendar, minimum staffing, and
  minimum allocation — because the same brand can run CS 365 days while its
  ACC closes on Sundays.
- An **assignment** links an employee to a brand-process with a role
  (`primary` / `shared` / `backup`) and an allocation %. **Eligibility** is a
  separate table: being assigned and being eligible are different facts, and
  coverage only counts when both hold.
- The roster itself is deliberately split in two:
  - `roster_days` — ONE row per employee-date: the attendance status
    (`WORK / WEEKLY_OFF / LEAVE / HOLIDAY_OFF / COMP_OFF / CLOSED`).
  - `roster_coverage` — MANY rows per employee-date: which brand-processes
    they cover that day, at what allocation, in what role.

  A single-cell model cannot express "one person covers Customer Support and
  Cart Recovery today, and takes Friday off for both."
- Holidays, leaves (including comp-offs linked to the holiday that earned
  them via `earned_on`), date-specific staffing overrides (sale days), roster
  versions, and validation issues are all first-class dated records.

### 2. How does your system generate a roster and determine whether it satisfies the required constraints?

Generation is a deterministic pipeline (pure TypeScript, no AI):

1. **Demand** is computed per brand-process-date from its calendar, the
   holiday list, and date overrides (e.g. LuxeBeauty CS needs 2 people on
   the 19 Dec sale day instead of 1).
2. A **structural audit** runs *before* generation: for every brand-process
   and week it compares required staff-days against the maximum its assigned
   pool could ever supply after mandatory rest and approved leave. If supply
   < demand, the configuration is provably infeasible and is reported as
   such — no roster generation can fix a maths problem.
3. The **generator** places weekly offs and coverage employee-by-employee,
   most-constrained-first, with a cost model that already knows coverage: a
   day off is expensive if it would open a gap nobody can cover, cheap if a
   designated backup is free. Designated backups are pre-committed to
   leave-driven gaps, and a bounded local repair phase (max 3 passes) then
   tries strictly-improving off-day swaps.
4. An **independent validator** — a separate module that shares no placement
   logic with the generator — recomputes everything from the raw data:
   coverage vs minimum staffing on every operating day, allocation ≤ 100%
   per day and ≥ the minimum contribution, no coverage on leave/off days,
   at least one rest day per week, max 6 consecutive days, assignment +
   eligibility for every coverage row.

A roster "satisfies the constraints" only when the validator returns zero
mandatory issues, and **publishing is hard-blocked until it does** —
mandatory rules can never be waived by a manager. December 2026 baseline:
1,427 required units, 100% covered, 0 mandatory issues, generated in
~209 ms.

### 3. How did you handle the difference between single-resource brands and brands with multiple employees?

There is no special case in the engine — the difference falls out of the
assignments. In the sample data, 19 of 23 brands (~83%, matching the brief's
staffing pattern) have **one dedicated employee covering all of the brand's
processes**: that person has one attendance status per day and one coverage
row per process. The remaining 4 brands have 2–3 employees who usually split
processes, with some overlap where two people share a process.

What *is* handled explicitly is the fragility difference. A single-resource
brand has zero redundancy, so the structural audit watches it hardest: a
365-day process needs 7 staff-days a week, but one person can supply at most
6 (mandatory weekly rest). Remove PureGlow's only backup and the audit
proves the configuration infeasible before any roster is generated
(fixture: `fixtures/structural-risk-pureglow.json`). Multi-employee brands
fail softer — the validator and simulator can usually find cover inside the
brand's own team first.

### 4. What happens when an employee manages all processes for a brand but is unavailable on a required working day?

Exactly the EcoLiving case in the demo data. Geeta Rao is the sole assignee
for EcoLiving; her approved leave is **never overridden**. On 15 Dec 2026
the system:

1. flags EcoLiving CS (and ACC) as a coverage gap with exact numbers
   (required 1, actual 0),
2. names the root cause — `SOLE_ASSIGNEE_ON_LEAVE`: the only assignee is on
   approved leave and no designated backup could cover automatically,
3. offers **ranked repairs**, each checked twice: the candidate must be
   eligible and available, *and* covering must not break their own duties
   (second-order check). Her designated backup Rashmi Iyer is ranked first
   and applies cleanly.

And the honest limit, also in the demo: on 14 Dec, with Rashmi *also* on
approved leave, no eligible employee exists. The repair engine returns **no
applicable candidate**, the gap stays visible, and publishing is blocked
(fixture: `fixtures/stress-ecoliving-2026-12-14.json`). The manager's real
options — add eligibility, change the requirement, or escalate — are listed
instead of the system inventing cover that does not exist.

### 5. How does your system handle conflicting requirements or insufficient staffing?

By keeping four claims separate and never interchangeable:

- **Structural impossibility** — provable from capacity maths alone (the
  pre-generation audit, §2 of Q2 above). Only the audit may claim it.
- **A gap in this roster** — the validator found demand uncovered in the
  actual generated roster, with required vs actual numbers.
- **Repair not found** — the bounded repair search stopped; this says
  something about the search, nothing about feasibility.
- **Validation passed** — the listed rules were checked and hold.

Mandatory constraints (client coverage, rest rules, leave) always outrank
preferences (preferred weekly-off day): mandatory violations block
publishing; preference violations are reported but non-blocking (35 in
December 2026, e.g. an off day that isn't the employee's preferred one).
Every violation is a plain-English issue naming the brand, process, date,
and people involved — nothing is silently dropped or averaged away. Where
month-boundary context is missing, the validator reports *boundary
unverified* rather than a silent pass.

### 6. Which parts of the process did you automate, and which did you leave under human control? Why?

**Automated:** roster generation for the whole month; validation of every
rule; conflict and gap detection with root-cause analysis; repair *ranking*
(with second-order safety checks); coverage metrics; and regeneration +
revalidation whenever Setup data changes (a new leave, a new assignment).

**Left to the human:** all source data (assignments, eligibility, leaves,
calendars); whether to *apply* a suggested repair; manual cell-level edits
(the system validates them instantly but does not make them); and the
publish decision itself.

Why: the scheduling maths is deterministic and auditable, so a machine
should do it — exhaustively and the same way every time. But accountability
decisions (approving a leave that creates a gap, accepting an uncovered
day, publishing) belong to the operations manager who owns the client
relationship. The system narrows every decision down to a explained,
pre-checked choice; it never silently decides.

AI fits the same rule: **no AI in any scheduling decision.** The optional
layer (`src/app/api/explain/route.ts`, Groq) receives one already-validated
issue message and may only rephrase it for readability; it cannot mark
anything valid or invalid, and with no API key the deterministic template
text is returned unchanged and the app works fully. (AI assistance was also
used in *building* this project; every engine rule is covered by automated
tests, so behaviour does not depend on trusting generated code.)

### 7. If the company doubled its team and brand count, what would you change about your solution?

The engine was benchmarked rather than assumed (Vitest, this machine):

| Dataset | Generate | Validate | Required units | Uncovered | Mandatory issues |
|---|---|---|---|---|---|
| 32 employees · 23 brands · 50 processes (Dec 2026) | ~209 ms | ~19 ms | 1,427 | **0** | **0** |
| 64 employees · 46 brands (duplicated 2×) | ~531 ms | ~64 ms | 2,854 | 0 | 0 |

At 2× the current design already holds, so the first changes would be
around it, not inside it: persist data in Supabase (schema and RLS are in
the repo; the demo intentionally runs on a labelled bundled dataset so
reviewers can't overwrite each other) so several managers share one source
of truth; move generation to a background job with progress once it stops
being sub-second; and virtualise the roster grid (64 × 31 cells is fine,
500 × 31 is not). The scheduling heuristic itself sits behind a `Scheduler`
interface (`src/lib/engine/scheduler.ts`): if a larger, tighter dataset
ever shows the greedy + repair approach leaving *avoidable* gaps, a CP-SAT
solver drops in behind the same interface without touching the validator,
simulator, or UI. That escalation is adopted only if the benchmark demands
it — the benchmark scenarios (baseline, sale days, leave clusters, the
structural and stress fixtures, 2× scale) are the acceptance gate.

### 8. If you had one additional week to work on this, what would you improve first?

1. **Live Supabase persistence + Auth sign-in**, so edits survive a refresh
   and pod leads get real accounts (schema, RLS, and the versioning model
   are already in place).
2. **Month navigation** — generate and compare any month, not only the
   December 2026 demo month.
3. **Pod-lead approval workflow and change notifications** when a published
   roster changes.
4. **Richer repair moves** — off-day *swaps* between two employees and
   automatic comp-off scheduling from earned credits.
5. A **CP-SAT-backed scheduler** behind the existing interface, adopted
   only if a larger benchmark shows avoidable gaps — plus fairness reports
   (weekend-off distribution) as a first-class dashboard.

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
