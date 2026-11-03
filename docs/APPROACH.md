# Approach note — RosterIQ (Smart Roster Management System)

**What I built:** RosterIQ, a Coverage Risk & Repair Engine — a Next.js +
TypeScript web app (Supabase Postgres schema included) that generates,
validates, and repairs a monthly roster for a 32-employee, 23-brand sample
company in December 2026, and, more importantly, *accounts for every
brand-process-day*: gaps are shown with exact numbers and named root causes,
never silently absorbed.

**How it works, briefly:**

- **Split data model.** Attendance (`roster_days`: one status per
  employee-day) is separate from work (`roster_coverage`: many process
  allocations per day). That split is what lets one person cover two
  processes of a brand and take a single day off from both.
- **Deterministic engine, no AI in decisions.** Calendars live on
  brand-processes (365 / daily-except-holidays / Sundays+holidays-off);
  coverage counts by headcount with allocation % as a daily ≤100% workload
  cap and a 20% minimum contribution; weekly offs are chosen
  most-constrained-first with backup-aware costs, then a bounded repair phase
  (max 3 passes) tries strictly-improving swaps.
- **An independent validator** recomputes every rule from raw assignments —
  coverage, allocation caps, eligibility, weekly rest, consecutive days — so
  generation bugs can't hide. A pre-generation audit proves *structural*
  infeasibility by capacity maths (required staff-days vs maximum supply);
  the generator itself only ever reports a *gap in this roster*, and the
  bounded search reports *repair not found* when it hits its limit. Those
  three claims are never conflated.
- **Verified on purpose-built scenarios, not vibes:** the baseline month
  validates with zero mandatory issues (1,427 required units, 100% covered,
  ~209 ms generation); a structural fixture (PureGlow without its backup:
  needs 7 staff-days/week, max supply 6); and a deliberately unfixable case
  (EcoLiving CS, 14 Dec 2026 — assignee and designated backup both on
  approved leave) where the app reports the exact shortfall, offers no fake
  repair, and **blocks publishing**. 17 automated Vitest tests assert all of
  this, including determinism and a 2× scale run (64 employees, ~531 ms).
  The scheduler sits behind an interface so a constraint optimizer can
  replace the heuristic if a future benchmark — not preference — demands it.
- **Safety rails:** approved leave is never overridden; repairs are
  second-order checked (a fix that breaks the helper's own brand is
  rejected, not scored); publishing is hard-blocked by mandatory issues;
  editing a published roster forks a new version. Supabase access is
  anon-key + RLS with a 3 s timeout and a clearly labelled local fallback,
  so the demo can never be taken down by a paused project. An optional Groq
  endpoint may only rephrase validated explanations; without a key the app
  is fully functional on deterministic templates.

Demo, tests, and the full question-by-question README are in the repository.
