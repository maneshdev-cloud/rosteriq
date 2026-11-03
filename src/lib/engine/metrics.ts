// Operational metrics with exact definitions (no vanity percentages).
// A "required unit" is one brand-process-date with required staffing > 0.
// A unit is fully covered only when its valid coverage meets the requirement.

import type { RosterCoverage, RosterDay, SchedulingInput, ValidationIssue } from "../types";
import { datesOfMonth } from "./calendar";
import { requiredStaff } from "./demand";

export interface RosterMetrics {
  requiredUnits: number;
  fullyCoveredUnits: number;
  coveragePct: number;
  uncoveredPositions: number; // sum of (required - actual) over shortfall issues
  mandatoryIssues: number;
  preferenceIssues: number;
}

export function computeMetrics(
  input: SchedulingInput,
  days: RosterDay[],
  coverage: RosterCoverage[],
  issues: ValidationIssue[],
  month: string,
): RosterMetrics {
  const ruleByBp = new Map(input.coverageRules.map((r) => [r.brandProcessId, r]));
  const statusOf = new Map(days.map((d) => [`${d.employeeId}|${d.date}`, d.status]));
  const validCount = new Map<string, number>();
  for (const row of coverage) {
    if (statusOf.get(`${row.employeeId}|${row.date}`) !== "WORK") continue;
    const k = `${row.brandProcessId}|${row.date}`;
    validCount.set(k, (validCount.get(k) ?? 0) + 1);
  }
  let requiredUnits = 0;
  let fullyCoveredUnits = 0;
  for (const bp of input.brandProcesses) {
    for (const date of datesOfMonth(month)) {
      const req = requiredStaff(bp, ruleByBp.get(bp.id), date, input.holidays);
      if (req === 0) continue;
      requiredUnits++;
      if ((validCount.get(`${bp.id}|${date}`) ?? 0) >= req) fullyCoveredUnits++;
    }
  }
  const shortfalls = issues.filter((i) => i.code === "COVERAGE_SHORTFALL");
  return {
    requiredUnits,
    fullyCoveredUnits,
    coveragePct: requiredUnits === 0 ? 100 : Math.round((fullyCoveredUnits / requiredUnits) * 1000) / 10,
    uncoveredPositions: shortfalls.reduce((s, i) => s + ((i.required ?? 0) - (i.actual ?? 0)), 0),
    mandatoryIssues: issues.filter((i) => i.severity === "mandatory").length,
    preferenceIssues: issues.filter((i) => i.severity === "preference").length,
  };
}
