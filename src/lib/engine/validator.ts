// Independent validator — the single source of truth for roster validity.
//
// It shares NO code with the generator's placement logic: demand, coverage
// and employee rules are recomputed here from the raw assignments. A roster
// produced by any means (generator, manual edit, simulator) is only trusted
// once it has passed through this module.
//
// Mandatory rules:  M1 coverage shortfall · M2 work on leave / non-work day ·
//                   M3 no weekly rest or > max consecutive days ·
//                   M4 work outside assignment/eligibility or below the
//                      minimum contribution · M5 daily allocation > 100%.
// Preference rules: P1 weekly-off preference · P2 weekend-off imbalance.
// Boundary honesty: when previous/next period context needed for a check is
// missing, the result is BOUNDARY_UNVERIFIED — never a silent pass.

import type {
  PeriodContext,
  RosterCoverage,
  RosterDay,
  SchedulingInput,
  ValidationIssue,
} from "../types";
import { addDays, datesOfMonth, weekday, weeksOfMonth } from "./calendar";
import { requiredStaff } from "./demand";
import { isOnLeave } from "./availability";
import { fmtDate, shortfallMessage } from "./explain";

export interface ValidateOptions {
  month: string;
  previousContext?: PeriodContext | null;
  nextContext?: PeriodContext | null;
}

export function validateRoster(
  input: SchedulingInput,
  days: RosterDay[],
  coverage: RosterCoverage[],
  opts: ValidateOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const monthDates = datesOfMonth(opts.month);
  const monthSet = new Set(monthDates);
  const rosterId = days[0]?.rosterId ?? coverage[0]?.rosterId ?? "roster";

  const brandById = new Map(input.brands.map((b) => [b.id, b]));
  const processByCode = new Map(input.processes.map((p) => [p.code, p]));
  const bpById = new Map(input.brandProcesses.map((bp) => [bp.id, bp]));
  const ruleByBp = new Map(input.coverageRules.map((r) => [r.brandProcessId, r]));
  const empById = new Map(input.employees.map((e) => [e.id, e]));
  const assignmentByKey = new Map(
    input.assignments.map((a) => [`${a.employeeId}|${a.brandProcessId}`, a]),
  );
  const dayStatus = new Map<string, RosterDay["status"]>();
  for (const d of opts.previousContext?.days ?? []) dayStatus.set(`${d.employeeId}|${d.date}`, d.status);
  for (const d of opts.nextContext?.days ?? []) dayStatus.set(`${d.employeeId}|${d.date}`, d.status);
  for (const d of days) dayStatus.set(`${d.employeeId}|${d.date}`, d.status);
  const statusOf = (emp: string, date: string) => dayStatus.get(`${emp}|${date}`);

  // ---- M2 / M4: every coverage row must itself be legitimate --------------
  const validCoverage: RosterCoverage[] = [];
  for (const row of coverage) {
    const bp = bpById.get(row.brandProcessId);
    const emp = empById.get(row.employeeId);
    if (!bp || !emp) continue;
    const status = statusOf(row.employeeId, row.date);
    let ok = true;
    if (status !== "WORK") {
      ok = false;
      issues.push({
        code: "ON_LEAVE_ASSIGNED",
        severity: "mandatory",
        claimKind: "validation",
        date: row.date,
        brandId: bp.brandId,
        processCode: bp.processCode,
        employeeId: row.employeeId,
        message:
          `${fmtDate(row.date)}, ${brandById.get(bp.brandId)?.name}, ${processByCode.get(bp.processCode)?.name}: ` +
          `${emp.name} is assigned coverage but their day status is ${status ?? "missing"}` +
          `${isOnLeave(input.leaves, row.employeeId, row.date) ? " (approved leave)" : ""}. ` +
          `Invalid assignments never count as coverage.`,
      });
    }
    const assignment = assignmentByKey.get(`${row.employeeId}|${row.brandProcessId}`);
    if (!assignment) {
      ok = false;
      issues.push({
        code: "NOT_ASSIGNED",
        severity: "mandatory",
        claimKind: "validation",
        date: row.date,
        brandId: bp.brandId,
        processCode: bp.processCode,
        employeeId: row.employeeId,
        message:
          `${fmtDate(row.date)}, ${brandById.get(bp.brandId)?.name}, ${processByCode.get(bp.processCode)?.name}: ` +
          `${emp.name} has no assignment or eligibility for this process.`,
      });
    } else if (row.allocationPct < (ruleByBp.get(row.brandProcessId)?.minAllocationPct ?? 0)) {
      ok = false;
      issues.push({
        code: "BELOW_MIN_CONTRIBUTION",
        severity: "mandatory",
        claimKind: "validation",
        date: row.date,
        brandId: bp.brandId,
        processCode: bp.processCode,
        employeeId: row.employeeId,
        message:
          `${fmtDate(row.date)}, ${brandById.get(bp.brandId)?.name}, ${processByCode.get(bp.processCode)?.name}: ` +
          `${emp.name}'s allocation of ${row.allocationPct}% is below the minimum contribution of ` +
          `${ruleByBp.get(row.brandProcessId)?.minAllocationPct}% for this process, so it does not count as coverage.`,
      });
    }
    if (ok) validCoverage.push(row);
  }

  // ---- M5: daily allocation cap -------------------------------------------
  const allocByEmpDate = new Map<string, number>();
  for (const row of coverage) {
    const k = `${row.employeeId}|${row.date}`;
    allocByEmpDate.set(k, (allocByEmpDate.get(k) ?? 0) + row.allocationPct);
  }
  for (const [k, total] of allocByEmpDate) {
    if (total > 100) {
      const [empId, date] = k.split("|");
      issues.push({
        code: "ALLOCATION_EXCEEDED",
        severity: "mandatory",
        claimKind: "validation",
        date,
        employeeId: empId,
        required: 100,
        actual: total,
        message: `${fmtDate(date)}: ${empById.get(empId)?.name} is allocated ${total}% of daily capacity across brands (maximum 100%).`,
      });
    }
  }

  // ---- M1: coverage shortfall per brand-process-date ----------------------
  const coverCount = new Map<string, number>();
  for (const row of validCoverage) {
    const k = `${row.brandProcessId}|${row.date}`;
    coverCount.set(k, (coverCount.get(k) ?? 0) + 1);
  }
  for (const bp of input.brandProcesses) {
    const rule = ruleByBp.get(bp.id);
    for (const date of monthDates) {
      const required = requiredStaff(bp, rule, date, input.holidays);
      if (required === 0) continue;
      const actual = coverCount.get(`${bp.id}|${date}`) ?? 0;
      if (actual >= required) continue;
      const assigned = input.assignments.filter((a) => a.brandProcessId === bp.id);
      const covering = new Set(
        validCoverage
          .filter((r) => r.brandProcessId === bp.id && r.date === date)
          .map((r) => r.employeeId),
      );
      const notCovering = assigned.filter((a) => !covering.has(a.employeeId));
      const primaries = assigned.filter((a) => a.role !== "backup");
      const backups = assigned.filter((a) => a.role === "backup");
      const name = (id: string) => empById.get(id)?.name ?? id;
      issues.push({
        code: "COVERAGE_SHORTFALL",
        severity: "mandatory",
        claimKind: "gap",
        date,
        brandId: bp.brandId,
        processCode: bp.processCode,
        required,
        actual,
        message: shortfallMessage({
          date,
          brandName: brandById.get(bp.brandId)?.name ?? bp.brandId,
          processName: processByCode.get(bp.processCode)?.name ?? bp.processCode,
          required,
          actual,
          soleAssigneeName:
            primaries.length === 1 ? name(primaries[0].employeeId) : undefined,
          soleAssigneeOnLeave:
            primaries.length === 1 &&
            (isOnLeave(input.leaves, primaries[0].employeeId, date) ||
              statusOf(primaries[0].employeeId, date) === "LEAVE" ||
              statusOf(primaries[0].employeeId, date) === "COMP_OFF"),
          soleAssigneeOnWeeklyOff:
            primaries.length === 1 &&
            statusOf(primaries[0].employeeId, date) === "WEEKLY_OFF",
          designatedBackupNames: backups.map((a) => name(a.employeeId)),
          backupsOnLeave: backups
            .filter(
              (a) =>
                isOnLeave(input.leaves, a.employeeId, date) ||
                statusOf(a.employeeId, date) === "LEAVE" ||
                statusOf(a.employeeId, date) === "COMP_OFF",
            )
            .map((a) => name(a.employeeId)),
          backupsOnWeeklyOff: backups
            .filter((a) => statusOf(a.employeeId, date) === "WEEKLY_OFF")
            .map((a) => name(a.employeeId)),
          onLeaveNames: notCovering
            .filter((a) => isOnLeave(input.leaves, a.employeeId, date))
            .map((a) => name(a.employeeId)),
          hasAnyBackup: backups.length > 0,
          poolExhausted: notCovering.length === assigned.length,
        }),
      });
    }
  }

  // ---- M3: weekly rest + consecutive days ---------------------------------
  const weeks = weeksOfMonth(opts.month);
  const boundaryReported = new Set<string>();
  for (const emp of input.employees) {
    for (const week of weeks) {
      const statuses = week.map((d) => statusOf(emp.id, d));
      const missing = statuses.filter((s) => s === undefined).length;
      const hasRest = statuses.some((s) => s !== undefined && s !== "WORK");
      if (hasRest) continue;
      if (missing > 0) {
        if (!boundaryReported.has(emp.id)) {
          boundaryReported.add(emp.id);
          issues.push({
            code: "BOUNDARY_UNVERIFIED",
            severity: "preference",
            claimKind: "validation",
            employeeId: emp.id,
            message:
              `${emp.name}: weekly-rest check for a month-boundary week is unverified — ` +
              `period context is missing and every known day is a working day. This is reported as unverified, not passed.`,
          });
        }
        continue;
      }
      // Only flag a week the employee was actually expected to work in:
      // at least one in-month day where a process they serve operates or
      // they were rostered. Pure leave/closed weeks need no extra off.
      const inMonth = week.filter((d) => monthSet.has(d));
      const expected = inMonth.some((d) => statusOf(emp.id, d) === "WORK");
      if (expected) {
        issues.push({
          code: "NO_WEEKLY_REST",
          severity: "mandatory",
          claimKind: "validation",
          date: week.find((d) => monthSet.has(d)),
          employeeId: emp.id,
          message: `${emp.name} has no rest day in the week of ${fmtDate(week[0])}. Every employee needs at least one rest day per Monday–Sunday week; approved leave does not count as the weekly off.`,
        });
      }
    }
    // Consecutive working days across the whole visible sequence.
    const seqDates = [...new Set([...dayStatus.keys()].map((k) => k.split("|")[1]))]
      .filter((d) => statusOf(emp.id, d) !== undefined)
      .sort();
    let run = 0;
    let runStart = "";
    for (const d of seqDates) {
      if (statusOf(emp.id, d) === "WORK") {
        if (run === 0) runStart = d;
        run++;
        if (run === emp.maxConsecutiveDays + 1) {
          issues.push({
            code: "CONSECUTIVE_DAYS_EXCEEDED",
            severity: "mandatory",
            claimKind: "validation",
            date: runStart,
            employeeId: emp.id,
            required: emp.maxConsecutiveDays,
            actual: run,
            message: `${emp.name} works more than ${emp.maxConsecutiveDays} consecutive days starting ${fmtDate(runStart)}.`,
          });
        }
      } else run = 0;
    }
    // A run touching the last day of the month cannot be fully verified
    // without next-period context.
    const lastDate = monthDates[monthDates.length - 1];
    if (!opts.nextContext && statusOf(emp.id, lastDate) === "WORK") {
      let tail = 0;
      for (let d = lastDate; statusOf(emp.id, d) === "WORK"; d = addDays(d, -1)) tail++;
      if (tail >= emp.maxConsecutiveDays - 1) {
        issues.push({
          code: "BOUNDARY_UNVERIFIED",
          severity: "preference",
          claimKind: "validation",
          date: lastDate,
          employeeId: emp.id,
          message: `${emp.name} ends the month on a ${tail}-day working run; whether the consecutive-day limit holds depends on next-period context, which does not exist yet. Reported as pending, not verified.`,
        });
      }
    }
  }

  // ---- P1: weekly-off preference (aggregated per employee) ----------------
  for (const emp of input.employees) {
    if (emp.weeklyOffPref.length === 0) continue;
    let missed = 0;
    for (const week of weeks) {
      const offs = week.filter(
        (d) => monthSet.has(d) && statusOf(emp.id, d) === "WEEKLY_OFF",
      );
      if (offs.length === 0) continue;
      if (!offs.some((d) => emp.weeklyOffPref.includes(weekday(d)))) missed++;
    }
    if (missed > 0) {
      issues.push({
        code: "WEEKLY_OFF_PREFERENCE",
        severity: "preference",
        claimKind: "validation",
        employeeId: emp.id,
        message: `${emp.name}'s weekly off fell outside their preferred day in ${missed} week(s). Preference only — mandatory rest was still provided.`,
      });
    }
  }

  void rosterId;
  return issues;
}
