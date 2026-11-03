# Interview guide — explaining RosterIQ in your own words

*For Manesh. Read this twice before the demo call. Every answer below is the
short version of something the code actually does — no bluffing needed.*

## The 30-second pitch

"RosterIQ is a coverage risk and repair engine. It generates a monthly
roster for 32 employees across 23 brands and 50 brand-processes, but its real
promise is honesty: every brand-process-day is either covered or shown as a
gap with the exact shortfall and the reason. It never overrides approved
leave, never applies a repair that breaks another brand, and it blocks
publishing while mandatory problems exist."

## The five things they will probe — and your answers

### 1. "Why did you split the roster into two tables?"

Because one cell can't hold the truth. An employee has **one attendance
status** per day (working, weekly off, leave) but can cover **several
processes** that day. If you store coverage inside the day cell, "Priya is
off" and "Priya covers PureGlow CS + ACC" fight each other. So:
`roster_days` = attendance (one row per employee-day), `roster_coverage` =
work (many rows per employee-day). It's the same reason the schema is
relational instead of JSON in one table.

### 2. "Your four claim types — what's the difference?"

- **Structural impossibility** — the *audit* proves it with arithmetic before
  generation: required staff-days per week vs the maximum the assigned pool
  can supply after rest rules and leave. PureGlow CS without its backup:
  needs 7, one person can give at most 6. No algorithm could fix that.
- **Gap** — *this roster* leaves demand uncovered. It says nothing about
  whether another roster could cover it.
- **Repair not found** — my bounded search (3 passes, capped candidates) hit
  its limit. A confession about my search, not about the problem.
- **Validation passed** — the listed rules were checked and held. Not "the
  roster is optimal", not "nothing else could be wrong".

Mixing these up is how scheduling tools lie. I kept them as separate types
in code so I *can't* mix them up.

### 3. "Why is the validator independent from the generator?"

If the same code places people and checks the placement, a bug validates
itself. My validator shares no placement logic with the generator — it
recomputes demand, coverage, eligibility, allocation sums, rest and
consecutive-day rules from the raw assignments. The generator's output is
just a claim until the validator passes it. That's also why manual edits and
simulator results go through the same validator: there's one source of truth
for "is this roster valid".

### 4. "Walk me through a repair. What's the second-order check?"

Example: Geeta (EcoLiving) takes leave on 15 Dec. The simulator shows CS and
ACC gaps, with root cause "sole assignee on leave". It recommends Rashmi, the
designated backup: +40 points for being designated, +20 same pod, points for
spare capacity, minus points for consecutive days already worked. The
**second-order check** asks: does giving Rashmi this cover break *her*
obligations? She's checked for allocation overflow, rest-rule violations,
and consecutive-day limits — if any fails, she's **rejected with the reason
shown**, not just scored lower. A fix that creates a new problem elsewhere
is not a fix. On 14 Dec the same simulation honestly fails: Rashmi is fully
allocated covering DailyNest that day, so the tool says so instead of
double-booking her.

### 5. "Why not just use a constraint solver (OR-Tools)?"

Deliberately benchmarked, not ideological. The heuristic (greedy
most-constrained-first + bounded repair, deterministic seed) solves the
actual dataset — 1,427 required units, 100% covered, zero mandatory issues,
~209 ms, and zero repair passes even needed — plus the 2× scale test. The
generator sits behind a `Scheduler` interface, so if a bigger or tighter
dataset ever shows *avoidable* gaps, CP-SAT drops in behind the same
contract and the validator still has the final word. I didn't want a Python
service, a second deployment, and a solver I couldn't fully explain, solving
a problem the benchmark said I didn't have.

## Traps to avoid

- Don't call the roster "optimal". Say "valid, and produced fast; optimality
  was not the requirement".
- Don't say "the audit guarantees feasibility". It rules out *proven*
  shortages only; interactions are the validator's job after generation.
- Don't claim Supabase persistence for the demo. Say: "schema and RLS are in
  the repo; the demo deliberately runs on a labelled local dataset with a
  Supabase probe and fallback, so a paused free-tier project can't break it."
- Don't say AI schedules anything. "AI can only rephrase an explanation that
  deterministic code already produced."
- If asked about the December 28–31 boundary: "Rest checks crossing into
  January are reported as boundary-unverified, not passed — the system would
  rather admit it can't see than pretend."

## Numbers to remember

32 employees · 4 pods · 23 brands (19 solo / 4 multi) · 50 brand-processes ·
111 assignments · 1,427 required units in December · 100% covered · 0
mandatory issues · generate ~209 ms · validate ~19 ms · 17 automated tests ·
repair cap 3 passes · min contribution 20% · allocation cap 100%/day ·
max 6 consecutive days.
