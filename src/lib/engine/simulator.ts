// Change simulator + repair recommendations.
//
// simulateChange NEVER mutates the original roster: it applies a hypothetical
// change (e.g. emergency leave) to a copy, revalidates, and diffs the issues.
// recommendRepairs ranks candidates with hard gates first (eligibility,
// not on leave, rest rule, allocation cap) and a second-order check — a
// repair that would break the candidate's own obligations is rejected,
// never just scored lower. Scores are transparent and shown to the manager.
// Repairs are minimal-disruption by construction: each recommendation is a
// single added coverage row; nothing else in the roster moves.

import type {
  RosterCoverage,
  RosterDay,
  SchedulingInput,
  ValidationIssue,
} from "../types";
import { validateRoster, type ValidateOptions } from "./validator";
import { isOnLeave } from "./availability";
import { fmtDate } from "./explain";

export interface RosterState {
  days: RosterDay[];
  coverage: RosterCoverage[];
}

export interface RootCause {
  code:
    | "SOLE_ASSIGNEE_ON_LEAVE"
    | "ASSIGNEE_AND_BACKUP_ON_LEAVE"
    | "NO_ELIGIBLE_BACKUP"
    | "WEEKLY_OFF_WITHOUT_COVER"
    | "INSUFFICIENT_ELIGIBLE_STAFF";
  explanation: string;
}

export interface RepairCandidate {
  employeeId: string;
  employeeName: string;
  eligible: boolean;
  designatedBackup: boolean;
  /** True only when this person may be auto-applied (has a configured
   *  assignment). Eligible-but-not-designated people are suggested only. */
  canApply: boolean;
  score: number;
  reasons: string[];
  /** Set when a hard gate or the second-order check rejects the candidate. */
  rejectedBecause?: string;
  changesRequired: number; // minimal-disruption metric: always 1 when viable
}

const key = (emp: string, date: string) => `${emp}|${date}`;
const issueKey = (i: ValidationIssue) =>
  `${i.code}|${i.date ?? ""}|${i.brandId ?? ""}|${i.processCode ?? ""}|${i.employeeId ?? ""}`;

export function analyzeRootCause(
  input: SchedulingInput,
  state: RosterState,
  issue: ValidationIssue,
): RootCause {
  const bpId = `${issue.brandId}:${issue.processCode}`;
  const date = issue.date!;
  const assigned = input.assignments.filter((a) => a.brandProcessId === bpId);
  const primaries = assigned.filter((a) => a.role !== "backup");
  const backups = assigned.filter((a) => a.role === "backup");
  const statusOf = new Map(state.days.map((d) => [key(d.employeeId, d.date), d.status]));
  const name = (id: string) => input.employees.find((e) => e.id === id)?.name ?? id;
  // "On leave" means approved leave in the data OR a leave status in the
  // state being analysed (a simulated absence only exists in the state).
  const onLeave = (empId: string) =>
    isOnLeave(input.leaves, empId, date) ||
    statusOf.get(key(empId, date)) === "LEAVE" ||
    statusOf.get(key(empId, date)) === "COMP_OFF";
  const primaryOnLeave = primaries.filter((a) => onLeave(a.employeeId));
  const backupOnLeave = backups.filter((a) => onLeave(a.employeeId));

  if (primaries.length === 1 && primaryOnLeave.length === 1 && backupOnLeave.length > 0) {
    return {
      code: "ASSIGNEE_AND_BACKUP_ON_LEAVE",
      explanation:
        `Sole assignee ${name(primaries[0].employeeId)} is on approved leave on ${fmtDate(date)} ` +
        `and the designated backup ${backupOnLeave.map((a) => name(a.employeeId)).join(", ")} is also on approved leave. ` +
        `Both layers of cover for this process are absent on the same date.`,
    };
  }
  if (primaries.length === 1 && primaryOnLeave.length === 1) {
    return {
      code: "SOLE_ASSIGNEE_ON_LEAVE",
      explanation:
        `Sole assignee ${name(primaries[0].employeeId)} is on approved leave on ${fmtDate(date)} ` +
        `and no designated backup could cover. Single-resource brands have no redundancy when the owner is absent.`,
    };
  }
  if (backups.length === 0 && primaries.some((a) => statusOf.get(key(a.employeeId, date)) === "WEEKLY_OFF")) {
    return {
      code: "WEEKLY_OFF_WITHOUT_COVER",
      explanation:
        `The assignee's mandatory weekly off falls on ${fmtDate(date)} and no backup is configured for this process, ` +
        `so the weekly off (which cannot be cancelled) leaves the date uncovered.`,
    };
  }
  if (assigned.length <= (issue.required ?? 1)) {
    return {
      code: "NO_ELIGIBLE_BACKUP",
      explanation:
        `Only ${assigned.length} employee(s) are eligible for this process and none is available on ${fmtDate(date)}. ` +
        `There is no one left to recommend.`,
    };
  }
  return {
    code: "INSUFFICIENT_ELIGIBLE_STAFF",
    explanation:
      `On ${fmtDate(date)}, the eligible employees for this process are unavailable (leave, weekly off, or capacity), ` +
      `so required staffing cannot be met from the configured pool.`,
  };
}

export interface SimulationResult extends RosterState {
  issues: ValidationIssue[];
  newIssues: ValidationIssue[];
  rootCauses: Map<string, RootCause>;
}

export function simulateChange(
  input: SchedulingInput,
  base: RosterState,
  change: { employeeId: string; startDate: string; endDate: string },
  validateOpts: ValidateOptions,
): SimulationResult {
  const inRange = (d: string) => change.startDate <= d && d <= change.endDate;
  const days = base.days.map((d) =>
    d.employeeId === change.employeeId && inRange(d.date)
      ? { ...d, status: "LEAVE" as const }
      : d,
  );
  const coverage = base.coverage.filter(
    (c) => !(c.employeeId === change.employeeId && inRange(c.date)),
  );
  const beforeKeys = new Set(
    validateRoster(input, base.days, base.coverage, validateOpts).map(issueKey),
  );
  const issues = validateRoster(input, days, coverage, validateOpts);
  const newIssues = issues.filter((i) => !beforeKeys.has(issueKey(i)));
  const rootCauses = new Map<string, RootCause>();
  for (const issue of newIssues) {
    if (issue.code === "COVERAGE_SHORTFALL" && issue.date) {
      rootCauses.set(issueKey(issue), analyzeRootCause(input, { days, coverage }, issue));
    }
  }
  return { days, coverage, issues, newIssues, rootCauses };
}

export function recommendRepairs(
  input: SchedulingInput,
  state: RosterState,
  issue: ValidationIssue,
): RepairCandidate[] {
  const bpId = `${issue.brandId}:${issue.processCode}`;
  const date = issue.date!;
  const statusOf = new Map(state.days.map((d) => [key(d.employeeId, d.date), d.status]));
  const brand = input.brands.find((b) => b.id === issue.brandId);
  const allocOn = (empId: string) =>
    state.coverage
      .filter((c) => c.employeeId === empId && c.date === date)
      .reduce((s, c) => s + c.allocationPct, 0);
  const consecutiveBefore = (empId: string) => {
    let n = 0;
    const sorted = state.days
      .filter((d) => d.employeeId === empId && d.date < date)
      .sort((a, b) => b.date.localeCompare(a.date));
    for (const d of sorted) {
      if (d.status === "WORK") n++;
      else break;
    }
    return n;
  };
  const existingEmergencyCovers = (empId: string) =>
    state.coverage.filter((c) => c.employeeId === empId && c.role === "backup").length;
  const alreadyCovering = new Set(
    state.coverage
      .filter((c) => c.brandProcessId === bpId && c.date === date)
      .map((c) => c.employeeId),
  );

  const candidates: RepairCandidate[] = [];
  for (const emp of input.employees) {
    if (alreadyCovering.has(emp.id)) continue;
    const eligible = input.eligibility.some(
      (e) => e.employeeId === emp.id && e.brandProcessId === bpId,
    );
    if (!eligible) continue;
    const assignment = input.assignments.find(
      (a) => a.employeeId === emp.id && a.brandProcessId === bpId,
    );
    const base: RepairCandidate = {
      employeeId: emp.id,
      employeeName: emp.name,
      eligible,
      designatedBackup: assignment?.role === "backup",
      canApply: !!assignment,
      score: 0,
      reasons: [],
      changesRequired: 1,
    };
    // Hard gates first.
    const status = statusOf.get(key(emp.id, date));
    if (status === "LEAVE" || status === "COMP_OFF" || isOnLeave(input.leaves, emp.id, date)) {
      candidates.push({ ...base, rejectedBecause: "On approved leave on this date." });
      continue;
    }
    if (status === "WEEKLY_OFF") {
      candidates.push({
        ...base,
        rejectedBecause:
          "On their mandatory weekly off. Working them would break the rest rule — an off-swap is a different repair type.",
      });
      continue;
    }
    if (assignment && allocOn(emp.id) + assignment.allocationPct > 100) {
      candidates.push({
        ...base,
        rejectedBecause: `Daily capacity would exceed 100% (currently ${allocOn(emp.id)}%, this cover needs ${assignment.allocationPct}%).`,
      });
      continue;
    }
    // Second-order check: if this person is on standby (CLOSED) and making
    // them work would push them past the consecutive-day limit, reject.
    if (status === "CLOSED" && consecutiveBefore(emp.id) >= emp.maxConsecutiveDays) {
      candidates.push({
        ...base,
        rejectedBecause:
          "Second-order check failed: they have already worked the maximum consecutive days, so this cover would create a rest violation.",
      });
      continue;
    }
    // Scoring (transparent — every point is explained).
    let score = 0;
    const reasons: string[] = [];
    if (assignment?.role === "backup") {
      score += 40;
      reasons.push("Designated backup for this process (+40)");
    } else if (assignment) {
      reasons.push("Configured assignee for this process (+0)");
    } else {
      score -= 10;
      reasons.push("Eligible but not designated — suggestion only, manager must configure the assignment first (−10)");
    }
    if (brand && emp.podId === brand.podId) {
      score += 20;
      reasons.push("Same pod as the brand (+20)");
    }
    const spare = 100 - allocOn(emp.id);
    score += Math.round(spare / 5);
    reasons.push(`Spare daily capacity ${spare}% (+${Math.round(spare / 5)})`);
    const consec = consecutiveBefore(emp.id);
    if (consec > 0) {
      score -= consec * 3;
      reasons.push(`Already worked ${consec} consecutive day(s) (−${consec * 3})`);
    }
    const fairness = existingEmergencyCovers(emp.id);
    if (fairness > 0) {
      score -= fairness * 2;
      reasons.push(`Already covering ${fairness} other gap(s) this month (−${fairness * 2})`);
    }
    reasons.push("Second-order check passed: adding this cover does not remove or break their existing coverage");
    candidates.push({ ...base, score, reasons });
  }
  return candidates.sort((a, b) => {
    if (!!a.rejectedBecause !== !!b.rejectedBecause) return a.rejectedBecause ? 1 : -1;
    return b.score - a.score;
  });
}

/** Apply one chosen repair to a simulated state and revalidate. */
export function applyRepair(
  input: SchedulingInput,
  state: RosterState,
  issue: ValidationIssue,
  employeeId: string,
  validateOpts: ValidateOptions,
): { state: RosterState; issues: ValidationIssue[] } {
  const bpId = `${issue.brandId}:${issue.processCode}`;
  const assignment = input.assignments.find(
    (a) => a.employeeId === employeeId && a.brandProcessId === bpId,
  );
  if (!assignment || !issue.date) return { state, issues: validateRoster(input, state.days, state.coverage, validateOpts) };
  const days = state.days.map((d) =>
    d.employeeId === employeeId && d.date === issue.date && d.status === "CLOSED"
      ? { ...d, status: "WORK" as const }
      : d,
  );
  const coverage = [
    ...state.coverage,
    {
      rosterId: state.days[0]?.rosterId ?? "roster",
      employeeId,
      date: issue.date,
      brandProcessId: bpId,
      allocationPct: assignment.allocationPct,
      role: assignment.role,
    },
  ];
  return {
    state: { days, coverage },
    issues: validateRoster(input, days, coverage, validateOpts),
  };
}
