// Pre-generation structural audit.
//
// The audit is the ONLY engine part allowed to make a "structural" claim,
// and only when simple capacity maths proves it: for a brand-process, if
// the staff-days required per week exceed the maximum staff-days the
// eligible, assigned employees could ever supply that week (each capped by
// the mandatory weekly rest: at most 6 working days, minus approved leave),
// the configuration cannot work — no generator, however clever, could fix it.
//
// A passed audit does NOT guarantee a feasible roster (employees are shared
// across brands); it only rules out these provable lower-bound shortages.

import type { AuditFinding, SchedulingInput } from "../types";
import { datesOfMonth, weeksOfMonth } from "./calendar";
import { requiredStaff } from "./demand";
import { isOnLeave } from "./availability";

export function auditFeasibility(
  input: SchedulingInput,
  month: string,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const weeks = weeksOfMonth(month);
  const monthDates = new Set(datesOfMonth(month));
  const ruleByBp = new Map(input.coverageRules.map((r) => [r.brandProcessId, r]));

  for (const bp of input.brandProcesses) {
    // Supply pool: employees both ASSIGNED (any role — primary, shared or
    // designated backup) and ELIGIBLE for this brand-process.
    const pool = input.assignments
      .filter((a) => a.brandProcessId === bp.id)
      .map((a) => a.employeeId)
      .filter((empId) =>
        input.eligibility.some(
          (e) => e.employeeId === empId && e.brandProcessId === bp.id,
        ),
      );
    const poolUnique = [...new Set(pool)];

    for (const week of weeks) {
      const weekInMonth = week.filter((d) => monthDates.has(d));
      if (weekInMonth.length === 0) continue;
      const demand = weekInMonth.reduce(
        (sum, d) => sum + requiredStaff(bp, ruleByBp.get(bp.id), d, input.holidays),
        0,
      );
      if (demand === 0) continue;
      // Max supply: each pool member can work at most 6 days in the week
      // (mandatory rest) and none on approved leave.
      const supply = poolUnique.reduce((sum, empId) => {
        const leaveDays = weekInMonth.filter((d) =>
          isOnLeave(input.leaves, empId, d),
        ).length;
        return sum + Math.max(0, Math.min(6, weekInMonth.length) - leaveDays);
      }, 0);
      if (supply < demand) {
        findings.push({
          brandProcessId: bp.id,
          requiredStaffDaysPerWeek: demand,
          maxSupplyStaffDaysPerWeek: supply,
          message:
            `${bp.id}: requires ${demand} staff-days in the week of ${weekInMonth[0]}, ` +
            `but its ${poolUnique.length} assigned employee(s) can supply at most ${supply} ` +
            `(mandatory weekly rest and approved leave applied). This is a proven structural ` +
            `shortage: add an eligible backup, reduce the requirement, or change the calendar.`,
        });
        break; // one finding per brand-process is enough
      }
    }
  }
  return findings;
}
