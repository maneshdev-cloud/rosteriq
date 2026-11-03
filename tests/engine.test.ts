// RosterIQ engine tests — Vitest.
// Every scenario that the demo shows is asserted here first.

import { describe, expect, it } from "vitest";
import seedJson from "../src/lib/data/seed.json";
import structuralFixture from "../fixtures/structural-risk-pureglow.json";
import stressFixture from "../fixtures/stress-ecoliving-2026-12-14.json";
import type { PeriodContext, SchedulingInput } from "../src/lib/types";
import { isOperatingDay, weekday } from "../src/lib/engine/calendar";
import { requiredStaff } from "../src/lib/engine/demand";
import { auditFeasibility } from "../src/lib/engine/audit";
import { scheduler } from "../src/lib/engine/scheduler";
import { validateRoster } from "../src/lib/engine/validator";
import {
  applyRepair,
  recommendRepairs,
  simulateChange,
} from "../src/lib/engine/simulator";
import { computeMetrics } from "../src/lib/engine/metrics";

const seed = seedJson as unknown as SchedulingInput & {
  previousContext: SchedulingInput extends never ? never : { days: never[] };
};
const input = seed as unknown as SchedulingInput;
const previousContext = (seedJson as unknown as { previousContext: PeriodContext })
  .previousContext;
const MONTH = "2026-12";
const OPTS = {
  seed: 42,
  maxRepairPasses: 3,
  maxCandidatesPerPass: 50,
  previousContext,
};
const VAL_OPTS = { month: MONTH, previousContext, nextContext: null };

const bp = (id: string) => input.brandProcesses.find((b) => b.id === id)!;
const rule = (id: string) => input.coverageRules.find((r) => r.brandProcessId === id);

function generate(inp: SchedulingInput = input) {
  return scheduler.generate(inp, MONTH, OPTS);
}

describe("operating calendars", () => {
  it("Christmas Day (Fri 25 Dec 2026): 365 operates, holiday-off calendars close", () => {
    expect(weekday("2026-12-25")).toBe(5);
    expect(isOperatingDay(bp("ecoliving:CS"), "2026-12-25", input.holidays)).toBe(true);
    expect(isOperatingDay(bp("fitfuel:ACC"), "2026-12-25", input.holidays)).toBe(false);
    expect(isOperatingDay(bp("auracare:NDR"), "2026-12-25", input.holidays)).toBe(false);
  });
  it("Sunday 6 Dec 2026: Sunday-off processes close, 365 processes operate", () => {
    expect(weekday("2026-12-06")).toBe(0);
    expect(isOperatingDay(bp("stylenest:CS"), "2026-12-06", input.holidays)).toBe(false);
    expect(isOperatingDay(bp("urbanthread:CS"), "2026-12-06", input.holidays)).toBe(true);
    expect(isOperatingDay(bp("voguenest:CS"), "2026-12-06", input.holidays)).toBe(true);
    // Fully Sunday-off brands: every process closed, owner rests with no cover needed
    expect(isOperatingDay(bp("modecraft:CS"), "2026-12-06", input.holidays)).toBe(false);
    expect(isOperatingDay(bp("homeease:CS"), "2026-12-06", input.holidays)).toBe(false);
  });
  it("sale-day overrides raise required staffing", () => {
    expect(requiredStaff(bp("luxebeauty:CS"), rule("luxebeauty:CS"), "2026-12-19", input.holidays)).toBe(2);
    expect(requiredStaff(bp("luxebeauty:CS"), rule("luxebeauty:CS"), "2026-12-18", input.holidays)).toBe(1);
    expect(requiredStaff(bp("activelife:CS"), rule("activelife:CS"), "2026-12-12", input.holidays)).toBe(2);
  });
});

describe("structural audit", () => {
  it("baseline dataset has NO proven structural shortage", () => {
    expect(auditFeasibility(input, MONTH)).toEqual([]);
  });
  it("PureGlow without its backup is a PROVEN structural shortage (7 needed vs 6 supply)", () => {
    const broken: SchedulingInput = {
      ...input,
      assignments: input.assignments.filter(
        (a) =>
          !structuralFixture.removeAssignments.some(
            (r) => r.employeeId === a.employeeId && r.brandProcessId === a.brandProcessId,
          ),
      ),
      eligibility: input.eligibility.filter(
        (e) =>
          !structuralFixture.removeEligibility.some(
            (r) => r.employeeId === e.employeeId && r.brandProcessId === e.brandProcessId,
          ),
      ),
    };
    const findings = auditFeasibility(broken, MONTH);
    const f = findings.find((x) => x.brandProcessId === "pureglow:CS");
    expect(f).toBeDefined();
    expect(f!.requiredStaffDaysPerWeek).toBe(7);
    expect(f!.maxSupplyStaffDaysPerWeek).toBe(6);
  });
});

describe("generator", () => {
  it("is deterministic for a fixed seed", () => {
    const a = generate();
    const b = generate();
    expect(a.days).toEqual(b.days);
    expect(a.coverage).toEqual(b.coverage);
  });
  it("baseline December roster passes the independent validator with zero mandatory issues", () => {
    const gen = generate();
    const issues = validateRoster(input, gen.days, gen.coverage, VAL_OPTS);
    const mandatory = issues.filter((i) => i.severity === "mandatory");
    if (mandatory.length > 0) {
      console.log(mandatory.map((m) => m.message).join("\n"));
    }
    expect(mandatory).toEqual([]);
  });
  it("never exceeds the 100% daily allocation cap", () => {
    const gen = generate();
    const sums = new Map<string, number>();
    for (const c of gen.coverage) {
      const k = `${c.employeeId}|${c.date}`;
      sums.set(k, (sums.get(k) ?? 0) + c.allocationPct);
    }
    expect([...sums.values()].every((v) => v <= 100)).toBe(true);
  });
  it("repair is bounded: attempts never exceed the 3-pass cap", () => {
    const gen = generate();
    expect(gen.repair.attempts).toBeLessThanOrEqual(3);
  });
  it("baseline metrics: coverage is honestly reported", () => {
    const gen = generate();
    const issues = validateRoster(input, gen.days, gen.coverage, VAL_OPTS);
    const m = computeMetrics(input, gen.days, gen.coverage, issues, MONTH);
    expect(m.requiredUnits).toBeGreaterThan(1000);
    expect(m.uncoveredPositions).toBe(0);
    expect(m.coveragePct).toBe(100);
  });
});

describe("validator catches deliberately invalid rosters", () => {
  it("flags coverage assigned on approved leave (M2)", () => {
    const gen = generate();
    const bad = [
      ...gen.coverage,
      {
        rosterId: gen.roster.id,
        employeeId: "kavya-reddy",
        date: "2026-12-10", // approved leave in the seed
        brandProcessId: "auracare:CS",
        allocationPct: 60,
        role: "primary" as const,
      },
    ];
    const issues = validateRoster(input, gen.days, bad, VAL_OPTS);
    expect(issues.some((i) => i.code === "ON_LEAVE_ASSIGNED" && i.employeeId === "kavya-reddy")).toBe(true);
  });
  it("flags coverage by an employee with no assignment (M4)", () => {
    const gen = generate();
    const day = gen.days.find((d) => d.employeeId === "aarav-mehta" && d.status === "WORK")!;
    const bad = [
      ...gen.coverage,
      {
        rosterId: gen.roster.id,
        employeeId: "aarav-mehta",
        date: day.date,
        brandProcessId: "ecoliving:CS",
        allocationPct: 70,
        role: "primary" as const,
      },
    ];
    const issues = validateRoster(input, gen.days, bad, VAL_OPTS);
    expect(issues.some((i) => i.code === "NOT_ASSIGNED")).toBe(true);
  });
});

describe("EcoLiving stress scenario (fixture)", () => {
  const stressed: SchedulingInput = {
    ...input,
    leaves: [...input.leaves, ...(stressFixture.addLeaves as SchedulingInput["leaves"])],
  };
  it("14 Dec 2026: required 1, actual 0, both names in the explanation, publish blocked", () => {
    const gen = generate(stressed);
    const issues = validateRoster(stressed, gen.days, gen.coverage, VAL_OPTS);
    const gap = issues.find(
      (i) =>
        i.code === "COVERAGE_SHORTFALL" &&
        i.brandId === "ecoliving" &&
        i.processCode === "CS" &&
        i.date === "2026-12-14",
    );
    expect(gap).toBeDefined();
    expect(gap!.required).toBe(1);
    expect(gap!.actual).toBe(0);
    expect(gap!.message).toContain("EcoLiving");
    expect(gap!.message).toContain("Geeta Rao");
    expect(gap!.message).toContain("Rashmi Iyer");
    expect(issues.some((i) => i.severity === "mandatory")).toBe(true); // publish blocked
  });
  it("no repair candidate can be applied for the unfixable gap", () => {
    const gen = generate(stressed);
    const issues = validateRoster(stressed, gen.days, gen.coverage, VAL_OPTS);
    const gap = issues.find(
      (i) => i.code === "COVERAGE_SHORTFALL" && i.brandId === "ecoliving" && i.date === "2026-12-14",
    )!;
    const candidates = recommendRepairs(stressed, { days: gen.days, coverage: gen.coverage }, gap);
    expect(candidates.every((c) => !c.canApply || !!c.rejectedBecause)).toBe(true);
  });
});

describe("simulator: coverable emergency leave", () => {
  // 15 Dec is used because on 14 Dec Rashmi Iyer is legitimately fully
  // allocated covering DailyNest — the engine must not pretend otherwise.
  // On 15 Dec she is on standby, so she is the honest repair.
  it("Geeta Rao on leave 15 Dec alone: gap appears, Rashmi Iyer is the top-ranked safe repair, applying it clears the gap", () => {
    const gen = generate();
    const sim = simulateChange(
      input,
      { days: gen.days, coverage: gen.coverage },
      { employeeId: "geeta-rao", startDate: "2026-12-15", endDate: "2026-12-15" },
      VAL_OPTS,
    );
    const gap = sim.newIssues.find(
      (i) => i.code === "COVERAGE_SHORTFALL" && i.brandId === "ecoliving" && i.processCode === "CS",
    );
    expect(gap).toBeDefined();
    const candidates = recommendRepairs(input, sim, gap!);
    const top = candidates.find((c) => !c.rejectedBecause);
    expect(top?.employeeId).toBe("rashmi-iyer");
    expect(top?.designatedBackup).toBe(true);
    // Geeta covers CS and ACC: the leave opens two gaps, and Rashmi's
    // capacity (70 + 30 = 100) can honestly repair both.
    const afterCS = applyRepair(input, sim, gap!, "rashmi-iyer", VAL_OPTS);
    const accGap = afterCS.issues.find(
      (i) => i.code === "COVERAGE_SHORTFALL" && i.brandId === "ecoliving" && i.processCode === "ACC" && i.date === "2026-12-15",
    );
    expect(accGap).toBeDefined();
    const repaired = applyRepair(input, afterCS.state, accGap!, "rashmi-iyer", VAL_OPTS);
    expect(
      repaired.issues.some(
        (i) => i.code === "COVERAGE_SHORTFALL" && i.brandId === "ecoliving" && i.date === "2026-12-15",
      ),
    ).toBe(false);
  });
  it("simulation does not mutate the original roster", () => {
    const gen = generate();
    const before = JSON.stringify(gen.days);
    simulateChange(
      input,
      { days: gen.days, coverage: gen.coverage },
      { employeeId: "geeta-rao", startDate: "2026-12-14", endDate: "2026-12-16" },
      VAL_OPTS,
    );
    expect(JSON.stringify(gen.days)).toBe(before);
  });
});

describe("scale benchmark (2x dataset)", () => {
  it("generates for 64 employees / 46 brands and stays bounded", () => {
    const dup = (suffix: string): SchedulingInput => ({
      ...input,
      pods: input.pods.map((p) => ({ ...p, id: p.id + suffix, leadEmployeeId: p.leadEmployeeId + suffix })),
      employees: input.employees.map((e) => ({ ...e, id: e.id + suffix, podId: e.podId + suffix })),
      brands: input.brands.map((b) => ({ ...b, id: b.id + suffix, podId: b.podId + suffix })),
      brandProcesses: input.brandProcesses.map((bp) => ({
        ...bp,
        id: bp.id + suffix,
        brandId: bp.brandId + suffix,
      })),
      coverageRules: input.coverageRules.map((r) => ({ ...r, brandProcessId: r.brandProcessId + suffix })),
      assignments: input.assignments.map((a) => ({
        ...a,
        employeeId: a.employeeId + suffix,
        brandProcessId: a.brandProcessId + suffix,
      })),
      eligibility: input.eligibility.map((e) => ({
        ...e,
        employeeId: e.employeeId + suffix,
        brandProcessId: e.brandProcessId + suffix,
      })),
      leaves: input.leaves.map((l) => ({ ...l, employeeId: l.employeeId + suffix })),
    });
    const two = dup("-x");
    const big: SchedulingInput = {
      ...input,
      pods: [...input.pods, ...two.pods],
      employees: [...input.employees, ...two.employees],
      brands: [...input.brands, ...two.brands],
      brandProcesses: [...input.brandProcesses, ...two.brandProcesses],
      coverageRules: [...input.coverageRules, ...two.coverageRules],
      assignments: [...input.assignments, ...two.assignments],
      eligibility: [...input.eligibility, ...two.eligibility],
      leaves: [...input.leaves, ...two.leaves],
    };
    const t0 = performance.now();
    const gen = scheduler.generate(big, MONTH, OPTS);
    const ms = performance.now() - t0;
    console.log(`2x generation: ${ms.toFixed(0)}ms, coverage rows: ${gen.coverage.length}`);
    expect(gen.coverage.length).toBeGreaterThan(0);
    expect(gen.repair.attempts).toBeLessThanOrEqual(3);
    expect(ms).toBeLessThan(60000);
  });
});
