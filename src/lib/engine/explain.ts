// Deterministic explanations. Every issue message in RosterIQ is built here
// (or from the same template logic) — never by an LLM. An optional AI layer
// may rephrase these strings, but it may not add facts.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-14" -> "14 Dec 2026" */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export interface ShortfallContext {
  date: string;
  brandName: string;
  processName: string;
  required: number;
  actual: number;
  /** The only assigned primary/shared employee, when there is exactly one. */
  soleAssigneeName?: string;
  soleAssigneeOnLeave?: boolean;
  soleAssigneeOnWeeklyOff?: boolean;
  designatedBackupNames: string[];
  backupsOnLeave: string[];
  backupsOnWeeklyOff: string[];
  onLeaveNames: string[];
  hasAnyBackup: boolean;
  poolExhausted: boolean;
}

export function shortfallMessage(c: ShortfallContext): string {
  const missing = c.required - c.actual;
  const fragments: string[] = [];

  if (c.soleAssigneeName && c.soleAssigneeOnLeave) {
    fragments.push(`Sole assignee ${c.soleAssigneeName} is on approved leave`);
  } else if (c.soleAssigneeName && c.soleAssigneeOnWeeklyOff) {
    fragments.push(`Sole assignee ${c.soleAssigneeName} is on weekly off`);
  } else if (c.onLeaveNames.length > 0) {
    fragments.push(`${c.onLeaveNames.join(", ")} on approved leave`);
  }

  if (c.backupsOnLeave.length > 0) {
    fragments.push(
      `designated backup ${c.backupsOnLeave.join(", ")} is also on approved leave`,
    );
  } else if (c.backupsOnWeeklyOff.length > 0) {
    fragments.push(
      `designated backup ${c.backupsOnWeeklyOff.join(", ")} is on weekly off`,
    );
  }

  let reason = "";
  if (fragments.length > 0) reason = fragments.join(" and ") + ". ";
  if (!c.hasAnyBackup) reason += "No backup is configured for this process. ";
  else if (c.poolExhausted) reason += "No other eligible employee is available. ";

  return (
    `${fmtDate(c.date)}, ${c.brandName}, ${c.processName}: required ${c.required}, actual ${c.actual}. ` +
    `${reason}${missing} staffing position${missing === 1 ? "" : "s"} uncovered.`
  );
}
