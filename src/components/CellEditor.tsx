"use client";

// Manual cell editing with INSTANT revalidation: every change flows back
// into the same roster state the validator reads, so issues, metrics and the
// publish gate update immediately. The editor edits the employee's day
// status (roster_days) and their process coverages (roster_coverage)
// separately — exactly like the data model.

import { useState } from "react";
import type {
  DayStatus,
  RosterCoverage,
  RosterDay,
  SchedulingInput,
} from "../lib/types";
import { fmtDate } from "../lib/engine/explain";
import type { SelectedCell } from "./RosterGrid";

const STATUSES: DayStatus[] = ["WORK", "WEEKLY_OFF", "LEAVE", "COMP_OFF", "HOLIDAY_OFF", "CLOSED"];

/** Human labels — nobody should have to decode raw status codes. */
const STATUS_LABELS: Record<DayStatus, string> = {
  WORK: "Working",
  WEEKLY_OFF: "Weekly off",
  LEAVE: "Leave",
  COMP_OFF: "Comp-off",
  HOLIDAY_OFF: "Holiday off",
  CLOSED: "Closed (brand shut)",
};

export default function CellEditor({
  input,
  days,
  coverage,
  selected,
  onClose,
  onApply,
}: {
  input: SchedulingInput;
  days: RosterDay[];
  coverage: RosterCoverage[];
  selected: SelectedCell;
  onClose: () => void;
  onApply: (days: RosterDay[], coverage: RosterCoverage[]) => void;
}) {
  const emp = input.employees.find((e) => e.id === selected.employeeId);
  const current = days.find(
    (d) => d.employeeId === selected.employeeId && d.date === selected.date,
  );
  const [status, setStatus] = useState<DayStatus>(current?.status ?? "CLOSED");
  const myAssignments = input.assignments.filter((a) => a.employeeId === selected.employeeId);
  const [checked, setChecked] = useState<Set<string>>(
    new Set(
      coverage
        .filter((c) => c.employeeId === selected.employeeId && c.date === selected.date)
        .map((c) => c.brandProcessId),
    ),
  );

  if (!emp) return null;

  const apply = () => {
    const rosterId = current?.rosterId ?? days[0]?.rosterId ?? "roster";
    const nextDays = days.map((d) =>
      d.employeeId === selected.employeeId && d.date === selected.date
        ? { ...d, status }
        : d,
    );
    const without = coverage.filter(
      (c) => !(c.employeeId === selected.employeeId && c.date === selected.date),
    );
    const added: RosterCoverage[] =
      status === "WORK"
        ? [...checked]
            .map((bpId) => myAssignments.find((a) => a.brandProcessId === bpId))
            .filter((a): a is NonNullable<typeof a> => !!a)
            .map((a) => ({
              rosterId,
              employeeId: selected.employeeId,
              date: selected.date,
              brandProcessId: a.brandProcessId,
              allocationPct: a.allocationPct,
              role: a.role,
            }))
        : [];
    onApply(nextDays, [...without, ...added]);
  };

  return (
    <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/50 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-bold text-slate-900">
          Edit cell — {emp.name}, {fmtDate(selected.date)}
        </h3>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-slate-500 hover:text-slate-800">
          Close
        </button>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        Change this person&apos;s day below, then press <b>Apply &amp; revalidate</b>. Every
        rule is re-checked instantly — if your change breaks coverage anywhere, it appears in
        the Risk Centre immediately. Nothing is silently accepted.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">This person is:</span>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              status === s ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {status === "WORK" && (
        <div className="mt-3">
          <span className="text-sm text-slate-600">
            Processes covered this day (only configured assignments can be selected; allocation % is the configured contribution):
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {myAssignments.map((a) => (
              <label
                key={a.brandProcessId}
                className="flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs ring-1 ring-slate-300"
              >
                <input
                  type="checkbox"
                  checked={checked.has(a.brandProcessId)}
                  onChange={(e) => {
                    const next = new Set(checked);
                    if (e.target.checked) next.add(a.brandProcessId);
                    else next.delete(a.brandProcessId);
                    setChecked(next);
                  }}
                />
                {a.brandProcessId} · {a.role} · {a.allocationPct}%
              </label>
            ))}
            {myAssignments.length === 0 && (
              <span className="text-xs text-slate-400">This employee has no assignments.</span>
            )}
          </div>
        </div>
      )}
      <button
        onClick={apply}
        className="mt-4 rounded-md bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
      >
        Apply &amp; revalidate
      </button>
      <span className="ml-2 text-xs text-slate-500">
        Issues, coverage % and the publish gate update immediately after applying.
      </span>
    </div>
  );
}
