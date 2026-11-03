// Availability: approved leave and comp-offs taken make an employee
// unavailable. The engine NEVER overrides approved leave to fill a gap.

import type { Leave } from "../types";

export function leaveOn(leaves: Leave[], employeeId: string, iso: string): Leave | undefined {
  return leaves.find(
    (l) =>
      l.employeeId === employeeId &&
      l.status === "approved" &&
      l.startDate <= iso &&
      iso <= l.endDate,
  );
}

export function isOnLeave(leaves: Leave[], employeeId: string, iso: string): boolean {
  return leaveOn(leaves, employeeId, iso) !== undefined;
}
