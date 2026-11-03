// Deterministic roster generator: greedy placement + bounded local repair.
//
// Pipeline: fix unavailability (leave / closures) -> choose weekly offs
// most-constrained-first with coverage-aware costs -> apply designated
// backups to the gaps that remain -> bounded local repair (off-day swaps
// that strictly reduce mandatory issues) -> independent validation.
//
// Guarantees: deterministic for a fixed seed; respects hard constraints
// (leave, eligibility, allocation cap, rest rules) or reports the gap;
// NEVER claims optimality or that an uncovered roster is impossible —
// uncovered demand is reported as a gap in THIS roster (claimKind "gap").

import type {
  Assignment,
  GeneratedRoster,
  GenerateOptions,
  RosterCoverage,
  RosterDay,
  SchedulingInput,
} from "../types";
import { addDays, datesOfMonth, weekday, weeksOfMonth } from "./calendar";
import { requiredStaff } from "./demand";
import { isOperatingDay } from "./calendar";
import { isOnLeave, leaveOn } from "./availability";
import { validateRoster } from "./validator";

type StatusMap = Map<string, RosterDay["status"]>;
const key = (emp: string, date: string) => `${emp}|${date}`;
const bpKey = (bp: string, date: string) => `${bp}|${date}`;

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function generateRoster(
  input: SchedulingInput,
  month: string,
  options: GenerateOptions,
): GeneratedRoster {
  const dates = datesOfMonth(month);
  const dateSet = new Set(dates);
  const weeks = weeksOfMonth(month);
  const bpById = new Map(input.brandProcesses.map((bp) => [bp.id, bp]));
  const ruleByBp = new Map(input.coverageRules.map((r) => [r.brandProcessId, r]));
  const req = (bpId: string, date: string) =>
    requiredStaff(bpById.get(bpId)!, ruleByBp.get(bpId), date, input.holidays);

  const ownAssignments = new Map<string, Assignment[]>();
  const bpAssignments = new Map<string, Assignment[]>();
  for (const a of input.assignments) {
    ownAssignments.set(a.employeeId, [...(ownAssignments.get(a.employeeId) ?? []), a]);
    bpAssignments.set(a.brandProcessId, [...(bpAssignments.get(a.brandProcessId) ?? []), a]);
  }
  const isFloater = (empId: string) =>
    (ownAssignments.get(empId) ?? []).every((a) => a.role === "backup");
  const operatingOwn = (empId: string, date: string, roles: Assignment["role"][]) =>
    (ownAssignments.get(empId) ?? []).filter(
      (a) =>
        roles.includes(a.role) &&
        isOperatingDay(bpById.get(a.brandProcessId)!, date, input.holidays),
    );

  // -- Step 1: planned primary/shared cover counts (everyone working) -------
  const plannedCover = new Map<string, number>();
  for (const bp of input.brandProcesses) {
    for (const date of dates) {
      if (req(bp.id, date) === 0) continue;
      const n = (bpAssignments.get(bp.id) ?? []).filter(
        (a) =>
          a.role !== "backup" &&
          !isOnLeave(input.leaves, a.employeeId, date),
      ).length;
      plannedCover.set(bpKey(bp.id, date), n);
    }
  }
  const backupCommitAlloc = new Map<string, number>(); // emp|date -> %
  const backupCommitCount = new Map<string, number>(); // bp|date -> count
  const intendedBackup = new Set<string>(); // bp|date|emp

  const findBackup = (bpId: string, date: string, offs: Set<string>) => {
    const candidates = (bpAssignments.get(bpId) ?? [])
      .filter((a) => a.role === "backup")
      .filter((a) => !isOnLeave(input.leaves, a.employeeId, date))
      .filter((a) => !offs.has(key(a.employeeId, date)))
      .filter(
        (a) =>
          (backupCommitAlloc.get(key(a.employeeId, date)) ?? 0) + a.allocationPct <= 100,
      )
      .sort(
        (x, y) =>
          (backupCommitAlloc.get(key(x.employeeId, date)) ?? 0) -
          (backupCommitAlloc.get(key(y.employeeId, date)) ?? 0),
      );
    return candidates[0];
  };

  // -- Step 1b: pre-commit backups for leave-driven gaps ---------------------
  // plannedCover already excludes employees on approved leave, so any
  // shortfall visible now is caused by leave. Committing the designated
  // backup BEFORE weekly-off selection means floaters will not choose their
  // own off on a day they are needed to cover someone's leave.
  const offs = new Set<string>();
  for (const bp of input.brandProcesses) {
    for (const date of dates) {
      const needed = req(bp.id, date);
      while (
        (plannedCover.get(bpKey(bp.id, date)) ?? 0) +
          (backupCommitCount.get(bpKey(bp.id, date)) ?? 0) <
        needed
      ) {
        const backup = findBackup(bp.id, date, offs);
        if (!backup) break;
        intendedBackup.add(`${bp.id}|${date}|${backup.employeeId}`);
        backupCommitAlloc.set(
          key(backup.employeeId, date),
          (backupCommitAlloc.get(key(backup.employeeId, date)) ?? 0) +
            backup.allocationPct,
        );
        backupCommitCount.set(
          bpKey(bp.id, date),
          (backupCommitCount.get(bpKey(bp.id, date)) ?? 0) + 1,
        );
      }
    }
  }

  // -- Step 2: weekly offs ---------------------------------------------------
  const contextStatus = new Map<string, RosterDay["status"]>();
  for (const d of options.previousContext?.days ?? [])
    contextStatus.set(key(d.employeeId, d.date), d.status);

  const kindOf = (empId: string, date: string, offSet: Set<string>): "WORK" | "REST" => {
    if (!dateSet.has(date)) {
      const s = contextStatus.get(key(empId, date));
      return s === "WORK" ? "WORK" : "REST";
    }
    if (isOnLeave(input.leaves, empId, date)) return "REST";
    if (offSet.has(key(empId, date))) return "REST";
    if (isFloater(empId)) return "WORK";
    return operatingOwn(empId, date, ["primary", "shared"]).length > 0 ? "WORK" : "REST";
  };

  const consecutiveViolated = (
    empId: string,
    max: number,
    offSet: Set<string>,
    upto: string,
  ): boolean => {
    let run = 0;
    for (let d = "2026-11-25"; d <= upto; d = addDays(d, 1)) {
      if (kindOf(empId, d, offSet) === "WORK") {
        run++;
        if (run > max) return true;
      } else run = 0;
    }
    return false;
  };

  // Most-constrained employees first; floaters (backup-only) last.
  const ordered = [...input.employees].sort((a, b) => {
    const score = (empId: string) => {
      const own = ownAssignments.get(empId) ?? [];
      if (own.every((x) => x.role === "backup")) return -1;
      return own
        .filter((x) => x.role !== "backup")
        .reduce((s, x) => {
          const bp = bpById.get(x.brandProcessId)!;
          const sole =
            (bpAssignments.get(x.brandProcessId) ?? []).filter((y) => y.role !== "backup")
              .length === 1;
          return s + (bp.calendarType === "ALL_365" ? 2 : 1) + (sole ? 3 : 0);
        }, 0);
    };
    return score(b.id) - score(a.id) || a.id.localeCompare(b.id);
  });

  for (const week of weeks) {
    const inMonth = week.filter((d) => dateSet.has(d));
    if (inMonth.length === 0) continue;
    const weekEnd = week[week.length - 1];
    for (const emp of ordered) {
      const floater = isFloater(emp.id);
      // Final partial week (extends into next month): the weekly off may
      // legitimately fall in the next period, so only force an in-month off
      // when the employee's current consecutive run is already long. The
      // validator reports this boundary as unverified rather than passed.
      if (week.some((d) => !dateSet.has(d) && d > dates[dates.length - 1])) {
        let run = 0;
        for (let d = addDays(inMonth[0], -1); ; d = addDays(d, -1)) {
          if (kindOf(emp.id, d, offs) === "WORK") run++;
          else break;
        }
        if (run + inMonth.length <= emp.maxConsecutiveDays) continue;
      }
      // Free rest: if ANY day of this week is already a rest-equivalent day
      // for this employee (every process they serve is closed that day —
      // e.g. a Sunday-off brand's Sunday, or Christmas for non-365 brands),
      // that day IS their weekly rest. Choosing a second off would waste
      // scarce backup capacity for no benefit.
      if (!floater) {
        const freeRestDay = week.find(
          (d) =>
            !isOnLeave(input.leaves, emp.id, d) &&
            (ownAssignments.get(emp.id) ?? []).some((a) => a.role !== "backup") &&
            operatingOwn(emp.id, d, ["primary", "shared"]).length === 0,
        );
        if (freeRestDay) {
          // The free rest only helps if the working run INTO it stays legal.
          let run = 0;
          for (let d = addDays(freeRestDay, -1); ; d = addDays(d, -1)) {
            if (kindOf(emp.id, d, offs) === "WORK") run++;
            else break;
          }
          if (run <= emp.maxConsecutiveDays) continue;
        }
      }
      const candidates = inMonth.filter((d) => {
        if (isOnLeave(input.leaves, emp.id, d)) return false;
        if (floater) return true;
        return operatingOwn(emp.id, d, ["primary", "shared"]).length > 0;
      });
      if (candidates.length === 0) continue;

      let best: { date: string; cost: number } | undefined;
      for (const d of candidates) {
        let cost = 0;
        if (!floater) {
          for (const a of operatingOwn(emp.id, d, ["primary", "shared"])) {
            const coverAfter =
              (plannedCover.get(bpKey(a.brandProcessId, d)) ?? 0) -
              1 +
              (backupCommitCount.get(bpKey(a.brandProcessId, d)) ?? 0);
            if (coverAfter < req(a.brandProcessId, d)) {
              if (findBackup(a.brandProcessId, d, offs)) cost += 5;
              else cost += 100;
            }
          }
        } else {
          // A floater must not take their off on a day they are already
          // committed to cover.
          for (const cov of intendedBackup) {
            const [bp, date, empId] = cov.split("|");
            void bp;
            if (empId === emp.id && date === d) cost += 500;
          }
        }
        if (!emp.weeklyOffPref.includes(weekday(d))) cost += 10;
        const trial = new Set(offs);
        trial.add(key(emp.id, d));
        if (consecutiveViolated(emp.id, emp.maxConsecutiveDays, trial, weekEnd))
          cost += 10000;
        cost += ((hashCode(emp.id + d) + options.seed) % 10) * 0.01; // deterministic tie-break
        if (!best || cost < best.cost) best = { date: d, cost };
      }
      if (!best) continue;
      const d = best.date;
      offs.add(key(emp.id, d));
      if (!floater) {
        for (const a of operatingOwn(emp.id, d, ["primary", "shared"])) {
          plannedCover.set(
            bpKey(a.brandProcessId, d),
            (plannedCover.get(bpKey(a.brandProcessId, d)) ?? 0) - 1,
          );
          const coverAfter =
            (plannedCover.get(bpKey(a.brandProcessId, d)) ?? 0) +
            (backupCommitCount.get(bpKey(a.brandProcessId, d)) ?? 0);
          if (coverAfter < req(a.brandProcessId, d)) {
            const backup = findBackup(a.brandProcessId, d, offs);
            if (backup) {
              intendedBackup.add(`${a.brandProcessId}|${d}|${backup.employeeId}`);
              backupCommitAlloc.set(
                key(backup.employeeId, d),
                (backupCommitAlloc.get(key(backup.employeeId, d)) ?? 0) +
                  backup.allocationPct,
              );
              backupCommitCount.set(
                bpKey(a.brandProcessId, d),
                (backupCommitCount.get(bpKey(a.brandProcessId, d)) ?? 0) + 1,
              );
            }
          }
        }
      }
    }
  }

  // -- Step 3: statuses -------------------------------------------------------
  const rosterId = `roster-${month}-v1`;
  const buildStatuses = (): StatusMap => {
    const map: StatusMap = new Map();
    for (const emp of input.employees) {
      for (const date of dates) {
        const leave = leaveOn(input.leaves, emp.id, date);
        if (leave) {
          map.set(key(emp.id, date), leave.type === "comp_off_taken" ? "COMP_OFF" : "LEAVE");
        } else if (offs.has(key(emp.id, date))) {
          map.set(key(emp.id, date), "WEEKLY_OFF");
        } else if (isFloater(emp.id)) {
          map.set(key(emp.id, date), "CLOSED"); // standby unless covering (set in buildCoverage)
        } else if (operatingOwn(emp.id, date, ["primary", "shared"]).length > 0) {
          map.set(key(emp.id, date), "WORK");
        } else {
          map.set(
            key(emp.id, date),
            input.holidays.some((h) => h.date === date) ? "HOLIDAY_OFF" : "CLOSED",
          );
        }
      }
    }
    return map;
  };

  // -- Step 4: coverage from statuses -----------------------------------------
  const buildCoverage = (statuses: StatusMap): RosterCoverage[] => {
    const coverage: RosterCoverage[] = [];
    const alloc = new Map<string, number>();
    const count = new Map<string, number>();
    const tryAdd = (a: Assignment, date: string): boolean => {
      const used = alloc.get(key(a.employeeId, date)) ?? 0;
      if (used + a.allocationPct > 100) return false;
      alloc.set(key(a.employeeId, date), used + a.allocationPct);
      count.set(bpKey(a.brandProcessId, date), (count.get(bpKey(a.brandProcessId, date)) ?? 0) + 1);
      coverage.push({
        rosterId,
        employeeId: a.employeeId,
        date,
        brandProcessId: a.brandProcessId,
        allocationPct: a.allocationPct,
        role: a.role,
      });
      return true;
    };
    for (const date of dates) {
      for (const emp of input.employees) {
        if (statuses.get(key(emp.id, date)) !== "WORK") continue;
        for (const a of operatingOwn(emp.id, date, ["primary", "shared"])) tryAdd(a, date);
      }
      // Designated backups fill whatever is still short.
      for (const bp of input.brandProcesses) {
        const needed = req(bp.id, date);
        if (needed === 0) continue;
        const backups = (bpAssignments.get(bp.id) ?? [])
          .filter((a) => a.role === "backup")
          .sort((x, y) =>
            intendedBackup.has(`${bp.id}|${date}|${y.employeeId}`)
              ? 1
              : intendedBackup.has(`${bp.id}|${date}|${x.employeeId}`)
                ? -1
                : x.employeeId.localeCompare(y.employeeId),
          );
        for (const a of backups) {
          if ((count.get(bpKey(bp.id, date)) ?? 0) >= needed) break;
          const st = statuses.get(key(a.employeeId, date));
          if (st === "LEAVE" || st === "COMP_OFF" || st === "WEEKLY_OFF") continue;
          if (tryAdd(a, date) && st === "CLOSED")
            statuses.set(key(a.employeeId, date), "WORK");
        }
      }
    }
    return coverage;
  };

  const toDays = (statuses: StatusMap): RosterDay[] => {
    const out: RosterDay[] = [];
    for (const emp of input.employees)
      for (const date of dates)
        out.push({
          rosterId,
          employeeId: emp.id,
          date,
          status: statuses.get(key(emp.id, date))!,
        });
    return out;
  };

  let statuses = buildStatuses();
  let coverage = buildCoverage(statuses);
  const validate = (s: StatusMap, c: RosterCoverage[]) =>
    validateRoster(input, toDays(s), c, {
      month,
      previousContext: options.previousContext ?? null,
      nextContext: null,
    });
  const mandatoryCount = (s: StatusMap, c: RosterCoverage[]) =>
    validate(s, c).filter((i) => i.severity === "mandatory").length;
  // Repair may never TRADE violation types: a move that fixes coverage by
  // creating a rest/leave/allocation violation is not an improvement.
  const nonGapMandatory = (s: StatusMap, c: RosterCoverage[]) =>
    validate(s, c).filter(
      (i) => i.severity === "mandatory" && i.code !== "COVERAGE_SHORTFALL",
    ).length;

  // -- Step 5: bounded local repair -------------------------------------------
  const initialMandatory = mandatoryCount(statuses, coverage);
  let currentMandatory = initialMandatory;
  let attempts = 0;
  let capHit = false;
  const maxPasses = options.maxRepairPasses ?? 3;

  for (let pass = 0; pass < maxPasses; pass++) {
    const gaps = validate(statuses, coverage)
      .filter((i) => i.severity === "mandatory" && i.code === "COVERAGE_SHORTFALL" && i.date)
      .sort((a, b) => `${a.date}|${a.brandId}`.localeCompare(`${b.date}|${b.brandId}`));
    if (gaps.length === 0) break;
    attempts = pass + 1;
    let improved = false;
    let examined = 0;
    for (const gap of gaps) {
      if (examined >= options.maxCandidatesPerPass) {
        capHit = true;
        break;
      }
      const bpId = `${gap.brandId}:${gap.processCode}`;
      const offCandidates = (bpAssignments.get(bpId) ?? [])
        .map((a) => a.employeeId)
        .filter((empId) => statuses.get(key(empId, gap.date!)) === "WEEKLY_OFF")
        .sort();
      let accepted = false;
      for (const empId of offCandidates) {
        if (accepted) break;
        const week = weeks.find((w) => w.includes(gap.date!)) ?? [];
        for (const alt of week.filter((d) => dateSet.has(d) && d !== gap.date)) {
          if (examined >= options.maxCandidatesPerPass) {
            capHit = true;
            break;
          }
          if (statuses.get(key(empId, alt)) !== "WORK") continue;
          examined++;
          // Trial: move this employee's weekly off from the gap date to alt.
          // Offs live in `offs`; trial statuses are rebuilt around the swap
          // by direct status edits (coverage is rebuilt from statuses).
          const trial = new Map(statuses);
          trial.set(key(empId, gap.date!), "WORK");
          trial.set(key(empId, alt), "WEEKLY_OFF");
          // Floater standby flips from the accepted run must not leak into
          // the trial's base: rebuild trial coverage on the trial map.
          const trialCoverage = buildCoverage(new Map(trial));
          // buildCoverage flips CLOSED->WORK on its own map; re-derive:
          const trialStatuses = new Map(trial);
          for (const row of trialCoverage)
            if (trialStatuses.get(key(row.employeeId, row.date)) === "CLOSED")
              trialStatuses.set(key(row.employeeId, row.date), "WORK");
          const trialMandatory = mandatoryCount(trialStatuses, trialCoverage);
          if (
            trialMandatory < currentMandatory &&
            nonGapMandatory(trialStatuses, trialCoverage) <=
              nonGapMandatory(statuses, coverage)
          ) {
            // Commit: update the canonical offs set so future builds agree.
            offs.delete(key(empId, alt));
            offs.add(key(empId, alt)); // alt becomes the off (already), gap date off removed below
            offs.delete(key(empId, gap.date!));
            statuses = trialStatuses;
            coverage = trialCoverage;
            currentMandatory = trialMandatory;
            improved = true;
            accepted = true;
            break;
          }
        }
      }
      if (capHit) break;
    }
    if (!improved) break;
  }

  const finalIssues = validate(statuses, coverage);
  return {
    roster: { id: rosterId, month, version: 1, status: "DRAFT" },
    days: toDays(statuses),
    coverage,
    repair: {
      attempts,
      improvementFound: currentMandatory < initialMandatory,
      remainingIssues: finalIssues,
      searchLimitReached: capHit,
    },
  };
}
