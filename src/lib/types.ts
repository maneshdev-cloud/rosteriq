// RosterIQ — core domain types.
// Pure types only: no React, Supabase, or UI imports anywhere in the engine layer.
//
// Locked decisions (see PLAN.md):
// - A roster day (attendance status) is SEPARATE from roster coverage
//   (process allocations). One employee-date = one status, many coverages.
// - Coverage is counted by HEADCOUNT. Allocation % is a workload cap only:
//   the sum of an employee's coverage % on one date must be <= 100.
// - A coverage row only counts toward min_staff if its allocation_pct meets
//   the brand-process minimum contribution (coverage_rules.min_allocation_pct).
// - No time-of-day logic. A cell is a date-state, never a shift window.

export type CalendarType =
  | "ALL_365" // operates every day, incl. Sundays and public holidays
  | "DAILY_EXCEPT_HOLIDAYS" // operates every day except public holidays
  | "SUN_AND_HOLIDAYS_OFF"; // closed Sundays and public holidays

export type ProcessCode = "CS" | "ACC" | "NDR" | "RET";

export type AssignmentRole = "primary" | "shared" | "backup";

export type DayStatus =
  | "WORK"
  | "WEEKLY_OFF"
  | "LEAVE"
  | "HOLIDAY_OFF"
  | "COMP_OFF"
  | "CLOSED"; // reserved: every process the employee serves is closed that day

export type RosterStatus = "DRAFT" | "VALIDATED" | "PUBLISHED";

export type IssueSeverity = "mandatory" | "preference";

// The four claims are NOT interchangeable (interview-critical):
// - "structural"  : auditFeasibility proved a lower-bound shortage from
//                   capacity/eligibility maths alone.
// - "gap"         : the generated roster leaves demand uncovered. The
//                   heuristic does NOT prove no roster could cover it.
// - "repair"      : bounded local search found no safe improvement within
//                   its pass/candidate limits. Not a proof of impossibility.
// - "validation"  : validateRoster checked the assignments against the rules.
export type ClaimKind = "structural" | "gap" | "repair" | "validation";

export interface Pod {
  id: string;
  name: string;
  leadEmployeeId: string;
}

export interface Employee {
  id: string;
  name: string;
  podId: string;
  isPodLead: boolean;
  /** Preferred weekly-off weekdays, 0 = Sunday .. 6 = Saturday. Preference only. */
  weeklyOffPref: number[];
  maxConsecutiveDays: number; // mandatory, default 6
}

export interface Brand {
  id: string;
  name: string;
  podId: string;
}

export interface ProcessDef {
  code: ProcessCode;
  name: string;
}

export interface BrandProcess {
  id: string; // `${brandId}:${processCode}`
  brandId: string;
  processCode: ProcessCode;
  calendarType: CalendarType;
}

export interface CoverageRule {
  brandProcessId: string;
  minStaff: number;
  /** Minimum allocation % for one worker's coverage to count toward minStaff. */
  minAllocationPct: number;
  /** Date-specific staffing overrides, e.g. sale days. Key: ISO date. */
  overrides?: Record<string, number>;
}

export interface Assignment {
  employeeId: string;
  brandProcessId: string;
  role: AssignmentRole;
  /** Contribution (share of the employee's daily capacity) when covering. */
  allocationPct: number;
}

/** Explicit eligibility, separate from assignment: who MAY ever cover. */
export interface Eligibility {
  employeeId: string;
  brandProcessId: string;
}

export interface Holiday {
  date: string; // ISO date
  name: string;
}

export interface Leave {
  employeeId: string;
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
  type: "planned_leave" | "comp_off_taken";
  status: "approved";
  /** For comp_off_taken: the holiday worked that earned the credit. */
  earnedOn?: string;
}

export interface Roster {
  id: string;
  month: string; // "2026-12"
  version: number;
  status: RosterStatus;
}

/** One row per employee per date: the attendance status ONLY. */
export interface RosterDay {
  rosterId: string;
  employeeId: string;
  date: string;
  status: DayStatus;
}

/** Many rows per employee per date: the processes actually covered. */
export interface RosterCoverage {
  rosterId: string;
  employeeId: string;
  date: string;
  brandProcessId: string;
  allocationPct: number;
  role: AssignmentRole;
}

export interface ValidationIssue {
  code:
    | "COVERAGE_SHORTFALL"
    | "ON_LEAVE_ASSIGNED"
    | "NO_WEEKLY_REST"
    | "CONSECUTIVE_DAYS_EXCEEDED"
    | "NOT_ASSIGNED"
    | "DUPLICATE_COVERAGE"
    | "ALLOCATION_EXCEEDED"
    | "BELOW_MIN_CONTRIBUTION"
    | "BOUNDARY_UNVERIFIED"
    | "WEEKLY_OFF_PREFERENCE"
    | "WEEKEND_IMBALANCE";
  severity: IssueSeverity;
  claimKind: ClaimKind;
  date?: string;
  brandId?: string;
  processCode?: ProcessCode;
  employeeId?: string;
  required?: number;
  actual?: number;
  message: string;
}

/** Previous/next period day statuses used for month-boundary rule checks. */
export interface PeriodContext {
  days: RosterDay[]; // e.g. 25-30 Nov 2026 when validating December 2026
  direction: "previous" | "next";
}

export interface SchedulingInput {
  pods: Pod[];
  employees: Employee[];
  brands: Brand[];
  processes: ProcessDef[];
  brandProcesses: BrandProcess[];
  coverageRules: CoverageRule[];
  assignments: Assignment[];
  eligibility: Eligibility[];
  holidays: Holiday[];
  leaves: Leave[];
}

// ---------------------------------------------------------------------------
// Engine contracts (src/lib/engine/*). Pure functions, deterministic.
// ---------------------------------------------------------------------------

export interface AuditFinding {
  brandProcessId: string;
  requiredStaffDaysPerWeek: number;
  maxSupplyStaffDaysPerWeek: number;
  message: string;
}

export interface GenerateOptions {
  seed: number; // fixed seed => reproducible output
  maxRepairPasses: number; // hard cap, default 3
  maxCandidatesPerPass: number; // hard cap on changes examined per pass
  previousContext?: PeriodContext;
}

export interface RepairResult {
  attempts: number;
  improvementFound: boolean;
  remainingIssues: ValidationIssue[];
  /** True when the pass/candidate cap stopped the search. A capped search
   *  is NOT a conflict and NOT proof that no solution exists. */
  searchLimitReached: boolean;
}

export interface GeneratedRoster {
  roster: Roster;
  days: RosterDay[];
  coverage: RosterCoverage[];
  repair: RepairResult;
}
