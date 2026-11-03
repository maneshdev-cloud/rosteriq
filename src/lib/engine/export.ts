// CSV export of the roster grid (employee rows x date columns).

import type { RosterCoverage, RosterDay, SchedulingInput } from "../types";
import { datesOfMonth } from "./calendar";

const STATUS_CODE: Record<RosterDay["status"], string> = {
  WORK: "W",
  WEEKLY_OFF: "OFF",
  LEAVE: "LV",
  HOLIDAY_OFF: "HO",
  COMP_OFF: "CO",
  CLOSED: "-",
};

export function rosterToCSV(
  input: SchedulingInput,
  days: RosterDay[],
  coverage: RosterCoverage[],
  month: string,
): string {
  const dates = datesOfMonth(month);
  const podName = new Map(input.pods.map((p) => [p.id, p.name]));
  const statusOf = new Map(days.map((d) => [`${d.employeeId}|${d.date}`, d.status]));
  const coverOf = new Map<string, string[]>();
  for (const c of coverage) {
    const k = `${c.employeeId}|${c.date}`;
    coverOf.set(k, [...(coverOf.get(k) ?? []), c.brandProcessId.split(":")[1]]);
  }
  const header = ["Employee", "Pod", ...dates.map((d) => d.slice(8))];
  const lines = [header.join(",")];
  for (const emp of input.employees) {
    const cells = dates.map((date) => {
      const status = statusOf.get(`${emp.id}|${date}`) ?? "CLOSED";
      if (status !== "WORK") return STATUS_CODE[status];
      const procs = coverOf.get(`${emp.id}|${date}`) ?? [];
      return procs.length ? procs.join("+") : "W";
    });
    lines.push([`"${emp.name}"`, `"${podName.get(emp.podId) ?? ""}"`, ...cells].join(","));
  }
  return lines.join("\n");
}
