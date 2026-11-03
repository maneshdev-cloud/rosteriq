// Independent-validator tests: deliberately INVALID rosters must be caught.
//
// The generator passing its own output proves nothing on its own. These
// tests mutate a valid baseline (or build tiny synthetic inputs) and assert
// the validator reports each specific violation with the right code.

import { describe, expect, it } from "vitest";
import seedJson from "../src/lib/data/seed.json";
import type {
  PeriodContext,
  RosterCoverage,
  RosterDay,
  SchedulingInput,
} from "../src/lib/types";
import { scheduler } from "../src/lib/engine/scheduler";
import { validateRoster } from "../src/lib/engine/validator";

const input = seedJson as unknown as SchedulingInput;
const previousContext = (seedJson as unknown as { previousContext: PeriodContext })
  .previousContext;
const MONTH = "2026-12";
const OPTS = { seed: 42, maxRepairPasses: 3, maxCandidatesPerPass: 50, previousContext };
const VAL = { month: MONTH, previousContext };

const gen = scheduler.generate(input, MONTH, OPTS);
const codes = (issues: ReturnType<typeof validateRoster>) => issues.map((i) => i.code);
const cloneCov = (): RosterCoverage[] => gen.coverage.map((r) => ({ ...r }));

describe("validator catches deliberate violations in the real dataset", () => {
  it("baseline has zero mandatory issues (control)", () => {
    const issues = validateRoster(input, gen.days, gen.coverage, VAL);
    expect(issues.filter((i) => i.severity === "mandatory")).toEqual([]);
  });

  it("coverage assigned during approved leave -> ON_LEAVE_ASSIGNED", () => {
    // Kavya Reddy is on approved leave 10-11 Dec 2026; her day status is LEAVE.
    const cov = cloneCov();
    cov.push({
      rosterId: gen.roster.id,
      employeeId: "kavya-reddy",
      date: "2026-12-10",
      brandProcessId: "auracare:CS",
      allocationPct: 50,
      role: "primary",
    });
    const issues = validateRoster(input, gen.days, cov, VAL);
    expect(codes(issues)).toContain("ON_LEAVE_ASSIGNED");
  });

  it("removed coverage -> COVERAGE_SHORTFALL with required 1, actual 0", () => {
    const cov = cloneCov().filter(
      (r) => !(r.brandProcessId === "ecoliving:CS" && r.date === "2026-12-07"),
    );
    const issues = validateRoster(input, gen.days, cov, VAL);
    const hit = issues.find(
      (i) =>
        i.code === "COVERAGE_SHORTFALL" &&
        i.brandId === "ecoliving" &&
        i.date === "2026-12-07",
    );
    expect(hit).toBeDefined();
    expect(hit?.required).toBe(1);
    expect(hit?.actual).toBe(0);
  });

  it("coverage without assignment/eligibility -> NOT_ASSIGNED", () => {
    // Geeta Rao has no assignment or eligibility for PureGlow CS.
    const date = gen.coverage.find((r) => r.employeeId === "geeta-rao")!.date;
    const cov = cloneCov().filter(
      (r) =>
        !(
          r.employeeId === "geeta-rao" &&
          r.date === date &&
          r.brandProcessId === "ecoliving:ACC"
        ),
    );
    cov.push({
      rosterId: gen.roster.id,
      employeeId: "geeta-rao",
      date,
      brandProcessId: "pureglow:CS",
      allocationPct: 50,
      role: "primary",
    });
    const issues = validateRoster(input, gen.days, cov, VAL);
    expect(codes(issues)).toContain("NOT_ASSIGNED");
  });

  it("daily allocation above 100% -> ALLOCATION_EXCEEDED with the real total", () => {
    const cov = cloneCov();
    const row = cov.find(
      (r) =>
        r.employeeId === "aarav-mehta" &&
        r.date === "2026-12-01" &&
        r.brandProcessId === "novaskin:CS",
    )!;
    row.allocationPct += 20; // 40 -> 60; day total 100 -> 120
    const issues = validateRoster(input, gen.days, cov, VAL);
    const hit = issues.find((i) => i.code === "ALLOCATION_EXCEEDED");
    expect(hit).toBeDefined();
    expect(hit?.actual).toBe(120);
  });

  it("a duplicated coverage row is flagged and never double-counted", () => {
    const cov = cloneCov();
    const row = cov.find(
      (r) => r.brandProcessId === "ecoliving:CS" && r.date === "2026-12-07",
    )!;
    cov.push({ ...row });
    const issues = validateRoster(input, gen.days, cov, VAL);
    expect(codes(issues)).toContain("DUPLICATE_COVERAGE");
    // The duplicate must not inflate capacity or invent/shortchange coverage.
    expect(codes(issues)).not.toContain("ALLOCATION_EXCEEDED");
    expect(
      issues.some(
        (i) => i.code === "COVERAGE_SHORTFALL" && i.brandId === "ecoliving" && i.date === "2026-12-07",
      ),
    ).toBe(false);
  });

  it("allocation below the minimum contribution -> BELOW_MIN_CONTRIBUTION", () => {
    const cov = cloneCov();
    const row = cov.find(
      (r) => r.brandProcessId === "ecoliving:CS" && r.date === "2026-12-07",
    )!;
    row.allocationPct = 10; // minimum contribution is 20
    const issues = validateRoster(input, gen.days, cov, VAL);
    expect(codes(issues)).toContain("BELOW_MIN_CONTRIBUTION");
  });
});

// ---- Synthetic rule tests ---------------------------------------------------

function syntheticInput(withLeave: boolean): SchedulingInput {
  return {
    pods: [{ id: "pod-x", name: "Pod X", leadEmployeeId: "emp-1" }],
    employees: [
      {
        id: "emp-1",
        name: "Test Person",
        podId: "pod-x",
        isPodLead: true,
        weeklyOffPref: [],
        maxConsecutiveDays: 6,
      },
    ],
    brands: [{ id: "brand-1", name: "BrandOne", podId: "pod-x" }],
    processes: [{ code: "CS", name: "Customer Support" }],
    brandProcesses: [
      { id: "brand-1:CS", brandId: "brand-1", processCode: "CS", calendarType: "ALL_365" },
    ],
    coverageRules: [{ brandProcessId: "brand-1:CS", minStaff: 1, minAllocationPct: 20 }],
    assignments: [
      { employeeId: "emp-1", brandProcessId: "brand-1:CS", role: "primary", allocationPct: 100 },
    ],
    eligibility: [{ employeeId: "emp-1", brandProcessId: "brand-1:CS" }],
    holidays: [],
    leaves: withLeave
      ? [
          {
            employeeId: "emp-1",
            startDate: "2026-12-10",
            endDate: "2026-12-11",
            type: "planned_leave" as const,
            status: "approved" as const,
          },
        ]
      : [],
  };
}

function syntheticState(
  statuses: Record<string, RosterDay["status"]>,
): { days: RosterDay[]; coverage: RosterCoverage[] } {
  const days: RosterDay[] = Object.entries(statuses).map(([date, status]) => ({
    rosterId: "test",
    employeeId: "emp-1",
    date,
    status,
  }));
  const coverage: RosterCoverage[] = Object.entries(statuses)
    .filter(([, s]) => s === "WORK")
    .map(([date]) => ({
      rosterId: "test",
      employeeId: "emp-1",
      date,
      brandProcessId: "brand-1:CS",
      allocationPct: 100,
      role: "primary" as const,
    }));
  return { days, coverage };
}

describe("validator rest rules (synthetic)", () => {
  it("approved leave does NOT count as the weekly rest", () => {
    // Mon 7 - Sun 13 Dec 2026: work Mon-Wed, leave Thu-Fri, work Sat-Sun.
    const { days, coverage } = syntheticState({
      "2026-12-07": "WORK",
      "2026-12-08": "WORK",
      "2026-12-09": "WORK",
      "2026-12-10": "LEAVE",
      "2026-12-11": "LEAVE",
      "2026-12-12": "WORK",
      "2026-12-13": "WORK",
    });
    const issues = validateRoster(syntheticInput(true), days, coverage, { month: MONTH });
    expect(codes(issues)).toContain("NO_WEEKLY_REST");
  });

  it("a real weekly off in the same pattern satisfies the rest rule", () => {
    const { days, coverage } = syntheticState({
      "2026-12-07": "WORK",
      "2026-12-08": "WORK",
      "2026-12-09": "WORK",
      "2026-12-10": "WORK",
      "2026-12-11": "WORK",
      "2026-12-12": "WORK",
      "2026-12-13": "WEEKLY_OFF",
    });
    const issues = validateRoster(syntheticInput(false), days, coverage, { month: MONTH });
    expect(codes(issues)).not.toContain("NO_WEEKLY_REST");
  });

  it("eight consecutive working days -> CONSECUTIVE_DAYS_EXCEEDED", () => {
    const statuses: Record<string, RosterDay["status"]> = {};
    for (let d = 7; d <= 14; d++) {
      statuses[`2026-12-${String(d).padStart(2, "0")}`] = "WORK";
    }
    const { days, coverage } = syntheticState(statuses);
    const issues = validateRoster(syntheticInput(false), days, coverage, { month: MONTH });
    expect(codes(issues)).toContain("CONSECUTIVE_DAYS_EXCEEDED");
  });
});

describe("generator determinism", () => {
  it("identical inputs produce identical output", () => {
    const a = scheduler.generate(input, MONTH, OPTS);
    const b = scheduler.generate(input, MONTH, OPTS);
    expect(JSON.stringify(a.days)).toBe(JSON.stringify(b.days));
    expect(JSON.stringify(a.coverage)).toBe(JSON.stringify(b.coverage));
  });
});
