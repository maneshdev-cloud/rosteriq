# RosterIQ — Locked Plan (Datastraw Smart Roster assessment)

Build started 3 Nov 2026, ~10 PM IST, on Manesh's go-ahead, after three
review rounds with friends' plans. This file is the decision record.

## Stack (final)
Next.js + TypeScript (single app, Vercel) · Supabase Postgres (anon key,
read-only in the browser; local labelled demo fallback) · Pure TypeScript
engine · Vitest. **No** Python / FastAPI / Render / OR-Tools, **no**
mandatory AI. Groq, if used at all, only rephrases deterministic issue text.

## Resolutions of the last four corrections
- **A. Baseline vs EcoLiving — Option A adopted.** The baseline December
  roster is coverable with legitimate relief (every solo 365 brand has a
  designated floater). EcoLiving's unfixable day (Mon 14 Dec 2026) lives in
  the stress fixture: sole assignee Geeta Rao on leave AND designated backup
  Rashmi Iyer on leave the same day — the shortage is *caused by the change*,
  which is what the simulator demo must show. The no-backup structural case
  survives as its own fixture (PureGlow), not in the baseline.
- **B. Minimum contribution.** Coverage counts by headcount, allocation % is
  a daily workload cap (coverage sums ≤ 100/day), AND a coverage row counts
  toward min_staff only if allocation ≥ coverage_rules.min_allocation_pct
  (20 in the seed; every configured assignment verified ≥ 20).
- **C. Day status ≠ process calendar.** roster_days status is derived from
  the employee's whole day; process closures live on brand_processes
  calendars. Working CS on Christmas while your NDR is closed = WORK.
  Comp-off credits earned vs taken are separate (leaves.earned_on).
- **D. Boundary context is SIX days.** December validation receives
  25–30 Nov 2026 day statuses (seed.previousContext). Missing context →
  BOUNDARY_UNVERIFIED issue, never a silent pass. No Jan 2027 context
  exists, so forward checks report "pending".

## Other locked rules
- Repair: max 3 passes + candidate cap per pass; RepairResult returns
  attempts / improvementFound / remainingIssues / searchLimitReached.
  Hitting the cap is not a conflict and not proof of impossibility.
- Claims language (never interchangeable): structural (audit-proven) ·
  gap (this roster) · repair not found (search limit) · validation passed.
- Publish: hard-blocked on any mandatory issue. No waivers.
- One grid component; the 5 views are grouping/filter state. No hourly
  or shift-time logic anywhere — date-states only.
- Supabase failure/timeout → bundled seed in local state, UI labelled
  "Demo (local)" vs "Supabase". Never claim a local edit was saved.
- Generator uses only pre-configured assignments; designated backups may
  be auto-applied, eligible-but-not-designated candidates are suggested only.
- Canonical names live in scripts/build-seed.mjs; everything copies from it.

## Dataset (verified by script, 3 Nov)
32 employees (8/pod) · 23 brands (19 solo = 82.6%, 4 multi) · 50
brand-processes · 111 assignments · 111 eligibility rows · sale-day overrides:
LuxeBeauty CS min 2 on 19 Dec, ActiveLife CS min 2 on 12 Dec · holiday:
25 Dec 2026 (Fri) Christmas · baseline leaves: Kavya Reddy 10–11 Dec
(coverable), Ishaan Verma comp-off 28 Dec (earned 25 Dec).

## Schedule (all IST)
- 3 Nov night: foundation — scaffold, types, schema, seed, fixtures. ✅
- 4 Nov: calendar, demand, availability, audit, validator + Vitest tests.
- 5 Nov: generator + bounded repair, one grid / 5 views, setup editing.
- 6 Nov: simulator, publish gating, Supabase read + fallback, deploy,
  README/APPROACH. **Target: complete deployable submission by 6 Nov evening.**
- 7 Nov: contingency, video, final checks, submit (working deadline
  ~6:27 PM from the 3 Nov 6:27 PM email + 4 days; PDF does not print an
  exact deadline — confirm in Keka when possible).

## Submission
To ozair.shaikh@datastraw.in, aryan.jaiswal@datastraw.in · CC
talent@datastraw.in · Subject: "Smart Roster Management System Assignment -
Manesh Sunil Jadhav" · Body: live URL, GitHub repo, LinkedIn
(linkedin.com/in/manesh-jadhav04 — incognito-check it first), demo video,
2–3 sentence technical approach note, then as a separate final line under
its own heading: curriculum internship from 7 Dec 2026, 20 weeks.

## Build completion (2026-11-03, ~22:20 IST)
Full build completed in one session on Manesh's go-ahead ("do it entirely").
- Engine complete: calendar/demand/availability/audit/generator (greedy + bounded repair ≤3 passes)/independent validator/simulator (root cause + ranked, second-order-checked repairs)/metrics/export; Scheduler interface for a future optimizer.
- Benchmark results: baseline Dec 2026 — 1,427 required units, 100% covered, 0 uncovered, 0 mandatory issues, generate ~209ms, validate ~19ms, repair passes needed: 0. 2× scale (64 emp/46 brands): generate ~531ms, validate ~64ms, 0 mandatory. 17/17 Vitest tests pass; production build passes.
- Key engineering finds during build: (1) floater capacity is the binding constraint — solved by making 2 brands per pod fully Sunday-off (owners rest free) + multi-brand internal cross-cover assignments; (2) Ishaan comp-off moved 28→30 Dec (28th collided with Priya Nair's forced rest day); (3) repair accepts only trades that never create rest/leave/allocation violations.
- Dataset now: 111 assignments / 111 eligibility rows (floaters back up ALL processes of designated brands; multi-brand colleagues cross-cover).
- Remaining (Manesh's steps): create GitHub repo + push, Vercel import/deploy, optional Supabase project + migrations, record video (docs/VIDEO_SCRIPT.md), verify deadline in Keka, send submission email by 7 Nov ~18:27 IST (aim 6 Nov evening).
