"use client";

// Setup: configure the whole system without code changes — employees,
// brands, brand-processes with calendars, assignments, holidays, leaves.
// Every change regenerates and revalidates the roster in the parent.

import { useState } from "react";
import type { SchedulingInput } from "../lib/types";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function SetupPanel({
  input,
  onChange,
}: {
  input: SchedulingInput;
  onChange: (next: SchedulingInput) => void;
}) {
  const [empName, setEmpName] = useState("");
  const [empPod, setEmpPod] = useState(input.pods[0]?.id ?? "");
  const [brandName, setBrandName] = useState("");
  const [brandPod, setBrandPod] = useState(input.pods[0]?.id ?? "");
  const [bpBrand, setBpBrand] = useState(input.brands[0]?.id ?? "");
  const [bpProcess, setBpProcess] = useState("CS");
  const [bpCalendar, setBpCalendar] = useState("ALL_365");
  const [asEmp, setAsEmp] = useState(input.employees[0]?.id ?? "");
  const [asBp, setAsBp] = useState(input.brandProcesses[0]?.id ?? "");
  const [asRole, setAsRole] = useState("backup");
  const [asAlloc, setAsAlloc] = useState(40);
  const [holDate, setHolDate] = useState("2026-12-26");
  const [holName, setHolName] = useState("");
  const [lvEmp, setLvEmp] = useState(input.employees[0]?.id ?? "");
  const [lvStart, setLvStart] = useState("2026-12-15");
  const [lvEnd, setLvEnd] = useState("2026-12-15");
  const [lvType, setLvType] = useState("planned_leave");

  const selectCls = "rounded-md border border-slate-300 px-2 py-1.5 text-sm";
  const btnCls = "rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700";
  const cardCls = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={cardCls}>
        <h3 className="text-[15px] font-bold text-slate-900">Employees ({input.employees.length})</h3>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
          {input.employees.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <span className="flex-1">
                {e.name}
                <span className="text-slate-400"> · {input.pods.find((p) => p.id === e.podId)?.name}{e.isPodLead ? " · pod lead" : ""}</span>
              </span>
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={() =>
                  onChange({
                    ...input,
                    employees: input.employees.filter((x) => x.id !== e.id),
                    assignments: input.assignments.filter((a) => a.employeeId !== e.id),
                    eligibility: input.eligibility.filter((a) => a.employeeId !== e.id),
                  })
                }
              >
                remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="New employee name" className={`${selectCls} flex-1`} />
          <select value={empPod} onChange={(e) => setEmpPod(e.target.value)} className={selectCls}>
            {input.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            className={btnCls}
            onClick={() => {
              if (!empName.trim()) return;
              onChange({
                ...input,
                employees: [
                  ...input.employees,
                  { id: slug(empName), name: empName.trim(), podId: empPod, isPodLead: false, weeklyOffPref: [0], maxConsecutiveDays: 6 },
                ],
              });
              setEmpName("");
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-[15px] font-bold text-slate-900">Brands ({input.brands.length}) &amp; processes ({input.brandProcesses.length})</h3>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
          {input.brandProcesses.map((bp) => (
            <li key={bp.id} className="flex items-center gap-2">
              <span className="flex-1">
                {input.brands.find((b) => b.id === bp.brandId)?.name} · {bp.processCode}
                <span className="text-slate-400"> · {bp.calendarType.replaceAll("_", " ")}</span>
              </span>
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={() =>
                  onChange({
                    ...input,
                    brandProcesses: input.brandProcesses.filter((x) => x.id !== bp.id),
                    coverageRules: input.coverageRules.filter((r) => r.brandProcessId !== bp.id),
                    assignments: input.assignments.filter((a) => a.brandProcessId !== bp.id),
                    eligibility: input.eligibility.filter((a) => a.brandProcessId !== bp.id),
                  })
                }
              >
                remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="New brand name" className={`${selectCls} flex-1`} />
          <select value={brandPod} onChange={(e) => setBrandPod(e.target.value)} className={selectCls}>
            {input.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            className={btnCls}
            onClick={() => {
              if (!brandName.trim()) return;
              onChange({ ...input, brands: [...input.brands, { id: slug(brandName), name: brandName.trim(), podId: brandPod }] });
              setBrandName("");
            }}
          >
            Add brand
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={bpBrand} onChange={(e) => setBpBrand(e.target.value)} className={selectCls}>
            {input.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={bpProcess} onChange={(e) => setBpProcess(e.target.value)} className={selectCls}>
            {input.processes.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
          </select>
          <select value={bpCalendar} onChange={(e) => setBpCalendar(e.target.value)} className={selectCls}>
            <option value="ALL_365">365 days</option>
            <option value="DAILY_EXCEPT_HOLIDAYS">Daily except holidays</option>
            <option value="SUN_AND_HOLIDAYS_OFF">Sundays + holidays off</option>
          </select>
          <button
            className={btnCls}
            onClick={() => {
              const id = `${bpBrand}:${bpProcess}`;
              if (input.brandProcesses.some((x) => x.id === id)) return;
              onChange({
                ...input,
                brandProcesses: [...input.brandProcesses, { id, brandId: bpBrand, processCode: bpProcess as never, calendarType: bpCalendar as never }],
                coverageRules: [...input.coverageRules, { brandProcessId: id, minStaff: 1, minAllocationPct: 20 }],
              });
            }}
          >
            Add process
          </button>
        </div>
      </div>

      <div className={cardCls}>
        <h3 className="text-[15px] font-bold text-slate-900">Assignments ({input.assignments.length})</h3>
        <p className="text-xs text-slate-500">
          Assignments define who covers what, with a role and a contribution %. Adding an assignment
          also grants eligibility. The generator may only use configured assignments.
        </p>
        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm">
          {input.assignments.map((a, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex-1">
                {input.employees.find((e) => e.id === a.employeeId)?.name}
                <span className="text-slate-400"> → {a.brandProcessId} · {a.role} · {a.allocationPct}%</span>
              </span>
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={() => onChange({ ...input, assignments: input.assignments.filter((_, j) => j !== i) })}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={asEmp} onChange={(e) => setAsEmp(e.target.value)} className={selectCls}>
            {input.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={asBp} onChange={(e) => setAsBp(e.target.value)} className={selectCls}>
            {input.brandProcesses.map((bp) => <option key={bp.id} value={bp.id}>{bp.id}</option>)}
          </select>
          <select value={asRole} onChange={(e) => setAsRole(e.target.value)} className={selectCls}>
            <option value="primary">primary</option>
            <option value="shared">shared</option>
            <option value="backup">backup</option>
          </select>
          <input type="number" min={20} max={100} value={asAlloc} onChange={(e) => setAsAlloc(Number(e.target.value))} className={`${selectCls} w-20`} />
          <button
            className={btnCls}
            onClick={() => {
              if (input.assignments.some((a) => a.employeeId === asEmp && a.brandProcessId === asBp)) return;
              onChange({
                ...input,
                assignments: [...input.assignments, { employeeId: asEmp, brandProcessId: asBp, role: asRole as never, allocationPct: asAlloc }],
                eligibility: input.eligibility.some((e) => e.employeeId === asEmp && e.brandProcessId === asBp)
                  ? input.eligibility
                  : [...input.eligibility, { employeeId: asEmp, brandProcessId: asBp }],
              });
            }}
          >
            Add assignment
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className={cardCls}>
          <h3 className="text-[15px] font-bold text-slate-900">Public holidays ({input.holidays.length})</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {input.holidays.map((h) => (
              <li key={h.date} className="flex items-center gap-2">
                <span className="flex-1">{h.date} — {h.name}</span>
                <button className="text-xs text-red-500 hover:underline" onClick={() => onChange({ ...input, holidays: input.holidays.filter((x) => x.date !== h.date) })}>
                  remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input type="date" value={holDate} onChange={(e) => setHolDate(e.target.value)} className={selectCls} />
            <input value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="Holiday name" className={`${selectCls} flex-1`} />
            <button className={btnCls} onClick={() => { if (!holName.trim()) return; onChange({ ...input, holidays: [...input.holidays, { date: holDate, name: holName.trim() }] }); setHolName(""); }}>
              Add
            </button>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="text-[15px] font-bold text-slate-900">Leaves &amp; comp-offs ({input.leaves.length})</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {input.leaves.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex-1">
                  {input.employees.find((e) => e.id === l.employeeId)?.name}
                  <span className="text-slate-400"> · {l.type === "comp_off_taken" ? "comp-off" : "leave"} · {l.startDate} → {l.endDate}</span>
                </span>
                <button className="text-xs text-red-500 hover:underline" onClick={() => onChange({ ...input, leaves: input.leaves.filter((_, j) => j !== i) })}>
                  remove
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={lvEmp} onChange={(e) => setLvEmp(e.target.value)} className={selectCls}>
              {input.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} className={selectCls} />
            <input type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} className={selectCls} />
            <select value={lvType} onChange={(e) => setLvType(e.target.value)} className={selectCls}>
              <option value="planned_leave">planned leave</option>
              <option value="comp_off_taken">comp-off taken</option>
            </select>
            <button className={btnCls} onClick={() => onChange({ ...input, leaves: [...input.leaves, { employeeId: lvEmp, startDate: lvStart, endDate: lvEnd, type: lvType as never, status: "approved" as const }] })}>
              Add leave
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Tip for the demo: add a leave for Rashmi Iyer on 14 Dec 2026, regenerate, and EcoLiving
            becomes the unfixable case — generation reports the gap and publishing blocks.
          </p>
        </div>
      </div>
    </div>
  );
}
