"use client";

// ONE grid component. The five required views (Company / Pod / Brand /
// Process / Employee) are grouping and filtering states over the same
// canonical roster data — not five separate tables or scheduling systems.

import { Fragment, useMemo, useState } from "react";
import type {
  RosterCoverage,
  RosterDay,
  SchedulingInput,
  ValidationIssue,
} from "../lib/types";
import { datesOfMonth } from "../lib/engine/calendar";
import { requiredStaff } from "../lib/engine/demand";

export interface SelectedCell {
  employeeId: string;
  date: string;
}

type View = "company" | "pod" | "brand" | "process" | "employee";

const STATUS_STYLE: Record<RosterDay["status"], { label: string; cls: string }> = {
  WORK: { label: "W", cls: "bg-teal-50 text-teal-900" },
  WEEKLY_OFF: { label: "OFF", cls: "bg-slate-100 text-slate-500" },
  LEAVE: { label: "LV", cls: "bg-amber-100 text-amber-800" },
  HOLIDAY_OFF: { label: "HO", cls: "bg-sky-50 text-sky-700" },
  COMP_OFF: { label: "CO", cls: "bg-violet-100 text-violet-800" },
  CLOSED: { label: "–", cls: "bg-white text-slate-300" },
};

interface Cell {
  date: string;
  text: string;
  cls: string;
  title: string;
  employeeId?: string;
  gap?: boolean;
}
interface Row {
  id: string;
  label: string;
  sub: string;
  group?: string;
  cells: Cell[];
}

export default function RosterGrid({
  input,
  days,
  coverage,
  issues,
  month,
  onSelectCell,
}: {
  input: SchedulingInput;
  days: RosterDay[];
  coverage: RosterCoverage[];
  issues: ValidationIssue[];
  month: string;
  onSelectCell?: (c: SelectedCell) => void;
}) {
  const [view, setView] = useState<View>("company");
  const [podId, setPodId] = useState(input.pods[0]?.id ?? "");
  const [processCode, setProcessCode] = useState("CS");
  const [employeeId, setEmployeeId] = useState(input.employees[0]?.id ?? "");
  const dates = datesOfMonth(month);

  const statusOf = useMemo(
    () => new Map(days.map((d) => [`${d.employeeId}|${d.date}`, d.status])),
    [days],
  );
  const coverByEmpDate = useMemo(() => {
    const m = new Map<string, RosterCoverage[]>();
    for (const c of coverage) {
      const k = `${c.employeeId}|${c.date}`;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [coverage]);
  const coverByBpDate = useMemo(() => {
    const m = new Map<string, RosterCoverage[]>();
    for (const c of coverage) {
      const k = `${c.brandProcessId}|${c.date}`;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return m;
  }, [coverage]);
  const gapBpDates = useMemo(() => {
    const s = new Set<string>();
    for (const i of issues) {
      if (i.code === "COVERAGE_SHORTFALL" && i.date)
        s.add(`${i.brandId}:${i.processCode}|${i.date}`);
    }
    return s;
  }, [issues]);
  const ruleByBp = useMemo(
    () => new Map(input.coverageRules.map((r) => [r.brandProcessId, r])),
    [input],
  );
  const empGapDates = useMemo(() => {
    // dates where this employee is an assignee of a shortfall brand-process
    const s = new Set<string>();
    for (const i of issues) {
      if (i.code !== "COVERAGE_SHORTFALL" || !i.date) continue;
      const bpId = `${i.brandId}:${i.processCode}`;
      for (const a of input.assignments) {
        if (a.brandProcessId === bpId) s.add(`${a.employeeId}|${i.date}`);
      }
    }
    return s;
  }, [issues, input]);

  const initials = (name: string) =>
    name.replace(/\(Floater\)/, "").trim().split(" ").map((w) => w[0]).slice(0, 2).join("");

  function employeeRow(emp: (typeof input.employees)[number]): Row {
    return {
      id: emp.id,
      label: emp.name,
      sub: input.pods.find((p) => p.id === emp.podId)?.name ?? "",
      group: input.pods.find((p) => p.id === emp.podId)?.name,
      cells: dates.map((date) => {
        const status = statusOf.get(`${emp.id}|${date}`) ?? "CLOSED";
        const cov = coverByEmpDate.get(`${emp.id}|${date}`) ?? [];
        const st = STATUS_STYLE[status];
        return {
          date,
          text: status === "WORK" && cov.length > 0 ? cov.map((c) => c.brandProcessId.split(":")[1]).join("+") : st.label,
          cls: st.cls,
          title:
            status === "WORK"
              ? cov.map((c) => `${c.brandProcessId} (${c.allocationPct}%, ${c.role})`).join(", ") || "Working"
              : st.label,
          employeeId: emp.id,
          gap: empGapDates.has(`${emp.id}|${date}`) && status !== "WORK",
        };
      }),
    };
  }

  function bpRow(bp: (typeof input.brandProcesses)[number]): Row {
    const brand = input.brands.find((b) => b.id === bp.brandId);
    return {
      id: bp.id,
      label: `${brand?.name} · ${bp.processCode}`,
      sub: bp.calendarType.replaceAll("_", " "),
      group: brand?.name,
      cells: dates.map((date) => {
        const req = requiredStaff(bp, ruleByBp.get(bp.id), date, input.holidays);
        const cov = (coverByBpDate.get(`${bp.id}|${date}`) ?? []).filter(
          (c) => statusOf.get(`${c.employeeId}|${date}`) === "WORK",
        );
        if (req === 0)
          return { date, text: "·", cls: "bg-slate-50 text-slate-300", title: "Process closed on this date" };
        const gap = cov.length < req;
        return {
          date,
          text: cov.map((c) => initials(input.employees.find((e) => e.id === c.employeeId)?.name ?? "")).join(" "),
          cls: gap ? "bg-red-100 text-red-800 font-semibold" : "bg-teal-50 text-teal-900",
          title: gap
            ? `GAP: required ${req}, actual ${cov.length}`
            : cov.map((c) => input.employees.find((e) => e.id === c.employeeId)?.name).join(", "),
          gap: gapBpDates.has(`${bp.id}|${date}`),
        };
      }),
    };
  }

  const rows: Row[] = useMemo(() => {
    switch (view) {
      case "company":
        return input.employees.map(employeeRow);
      case "pod":
        return input.employees.filter((e) => e.podId === podId).map(employeeRow);
      case "employee": {
        const emp = input.employees.find((e) => e.id === employeeId);
        return emp ? [employeeRow(emp)] : [];
      }
      case "brand":
        return input.brandProcesses.map(bpRow);
      case "process":
        return input.brandProcesses.filter((bp) => bp.processCode === processCode).map(bpRow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, podId, processCode, employeeId, input, days, coverage, issues]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {(["company", "pod", "brand", "process", "employee"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm capitalize ${view === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === "pod" && (
          <select value={podId} onChange={(e) => setPodId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {input.pods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {view === "process" && (
          <select value={processCode} onChange={(e) => setProcessCode(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {input.processes.map((p) => (
              <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
            ))}
          </select>
        )}
        {view === "employee" && (
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {input.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-slate-400">
          Click a cell to edit it (Manager mode). Red outline = this employee is an assignee of a gap that day.
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-44 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">
                {view === "brand" || view === "process" ? "Brand · Process" : "Employee"}
              </th>
              {dates.map((d) => (
                <th key={d} className="min-w-11 px-1 py-2 text-center font-medium text-slate-500">
                  {d.slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const groupHeader =
                view === "company" && row.group !== rows[i - 1]?.group ? row.group : undefined;
              return (
                <Fragment key={row.id}>
                  {groupHeader && (
                    <tr key={`g-${groupHeader}`}>
                      <td colSpan={dates.length + 1} className="bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                        {groupHeader}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                      <div className="font-medium text-slate-800">{row.label}</div>
                      <div className="text-[10px] text-slate-400">{row.sub}</div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.date} className="px-0.5 py-1">
                        <button
                          title={`${cell.date} — ${cell.title}`}
                          onClick={() =>
                            cell.employeeId && onSelectCell?.({ employeeId: cell.employeeId, date: cell.date })
                          }
                          className={`w-full rounded px-1 py-1 text-center text-[10px] ${cell.cls} ${
                            cell.gap ? "outline-2 outline-red-400" : ""
                          } ${cell.employeeId && onSelectCell ? "cursor-pointer hover:ring-2 hover:ring-teal-300" : "cursor-default"}`}
                        >
                          {cell.text || "—"}
                        </button>
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span><b>W / CS+ACC</b> working (processes covered)</span>
        <span><b>OFF</b> weekly off</span>
        <span><b>LV</b> leave</span>
        <span><b>HO</b> holiday off</span>
        <span><b>CO</b> comp-off</span>
        <span><b>–</b> closed / standby</span>
        <span className="text-red-600"><b>red</b> coverage gap</span>
      </div>
    </div>
  );
}
