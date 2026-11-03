"use client";

// Impact Simulator: pick an employee and dates, see exactly which brands
// break BEFORE touching the real roster, read the root cause, compare
// ranked repairs (each second-order checked), and only then decide.
// Scenario comparison is metrics-before vs metrics-after vs
// metrics-after-repair, always on the same denominator.

import { useMemo, useState } from "react";
import type {
  Leave,
  RosterCoverage,
  RosterDay,
  SchedulingInput,
  ValidationIssue,
} from "../lib/types";
import type { ValidateOptions } from "../lib/engine/validator";
import { computeMetrics } from "../lib/engine/metrics";
import {
  applyRepair,
  recommendRepairs,
  simulateChange,
  type SimulationResult,
} from "../lib/engine/simulator";

export default function SimulatorPanel({
  input,
  days,
  coverage,
  valOpts,
  month,
  canApply,
  onCommit,
}: {
  input: SchedulingInput;
  days: RosterDay[];
  coverage: RosterCoverage[];
  valOpts: ValidateOptions;
  month: string;
  canApply: boolean;
  onCommit: (days: RosterDay[], coverage: RosterCoverage[], leave?: Leave) => void;
}) {
  const [employeeId, setEmployeeId] = useState("geeta-rao");
  const [start, setStart] = useState("2026-12-15");
  const [end, setEnd] = useState("2026-12-15");
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [simIssues, setSimIssues] = useState<ValidationIssue[]>([]);
  const [appliedRepairs, setAppliedRepairs] = useState(0);

  const run = () => {
    const result = simulateChange(
      input,
      { days, coverage },
      { employeeId, startDate: start, endDate: end },
      valOpts,
    );
    setSim(result);
    setSimIssues(result.issues);
    setAppliedRepairs(0);
  };

  const simMetrics = sim
    ? computeMetrics(input, sim.days, sim.coverage, simIssues, month)
    : null;
  const gaps = simIssues.filter((i) => i.code === "COVERAGE_SHORTFALL");

  return (
    <div>
      <h2 className="font-semibold text-slate-900">Impact Simulator</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Simulate an absence before approving it. The original roster is never mutated by a
        simulation. Every recommended repair is checked twice: the candidate must be eligible
        and available, and adding their cover must not break their own obligations
        (second-order check). Each repair changes exactly one thing.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5">
            {input.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">From</span>
          <input type="date" value={start} min="2026-12-01" max="2026-12-31" onChange={(e) => setStart(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-500">To</span>
          <input type="date" value={end} min="2026-12-01" max="2026-12-31" onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5" />
        </label>
        <button onClick={run} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Run simulation
        </button>
        <span className="text-xs text-slate-400">
          Try: Geeta Rao (EcoLiving) on 15 Dec — repairable. Then 14 Dec with Rashmi Iyer also
          away (add her leave in Setup first) — that one is not.
        </span>
      </div>

      {sim && simMetrics && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <CompareCard title="New gaps created" value={String(sim.newIssues.filter((i) => i.code === "COVERAGE_SHORTFALL").length)} bad={sim.newIssues.some((i) => i.code === "COVERAGE_SHORTFALL")} />
            <CompareCard title="Scenario coverage" value={`${simMetrics.coveragePct}%`} bad={simMetrics.coveragePct < 100} />
            <CompareCard title="Repairs applied in scenario" value={String(appliedRepairs)} bad={false} />
          </div>

          {sim.newIssues.length === 0 && (
            <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              This absence creates no new issues — existing cover absorbs it.
            </p>
          )}

          {gaps.map((gap, gi) => {
            const key = `${gap.brandId}|${gap.processCode}|${gap.date}`;
            const cause = sim.rootCauses.get(
              `${gap.code}|${gap.date ?? ""}|${gap.brandId ?? ""}|${gap.processCode ?? ""}|${gap.employeeId ?? ""}`,
            );
            const candidates = recommendRepairs(input, { days: sim.days, coverage: sim.coverage }, gap);
            return (
              <div key={`${key}-${gi}`} className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                <p className="text-sm font-medium text-red-900">{gap.message}</p>
                {cause && (
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold">Root cause ({cause.code}):</span> {cause.explanation}
                  </p>
                )}
                <h4 className="mt-3 text-sm font-semibold text-slate-800">Ranked repairs (1 change each)</h4>
                <ul className="mt-2 space-y-2">
                  {candidates.map((c) => (
                    <li key={c.employeeId} className="flex flex-wrap items-start gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
                      <div className="min-w-52">
                        <span className="font-medium text-slate-800">{c.employeeName}</span>
                        {c.designatedBackup && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">designated backup</span>}
                        {!c.canApply && !c.rejectedBecause && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">suggestion only</span>}
                        {c.rejectedBecause ? (
                          <p className="mt-0.5 text-xs text-red-600">Rejected: {c.rejectedBecause}</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-500">Score {c.score} · {c.reasons.join(" · ")}</p>
                        )}
                      </div>
                      {canApply && !c.rejectedBecause && c.canApply && (
                        <button
                          onClick={() => {
                            const repaired = applyRepair(input, sim, gap, c.employeeId, valOpts);
                            setSim({ ...sim, days: repaired.state.days, coverage: repaired.state.coverage });
                            setSimIssues(repaired.issues);
                            setAppliedRepairs((n) => n + 1);
                          }}
                          className="ml-auto rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
                        >
                          Apply repair
                        </button>
                      )}
                    </li>
                  ))}
                  {candidates.length === 0 && (
                    <li className="text-sm text-red-700">
                      No eligible employee exists for this process at all — this gap cannot be
                      repaired from the configured pool. It stays visible; a manager must add
                      eligibility, change the requirement, or accept the uncovered day.
                    </li>
                  )}
                </ul>
              </div>
            );
          })}

          {canApply && (
            <button
              onClick={() =>
                onCommit(sim.days, sim.coverage, {
                  employeeId,
                  startDate: start,
                  endDate: end,
                  type: "planned_leave",
                  status: "approved",
                })
              }
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Apply this scenario to the real roster
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CompareCard({ title, value, bad }: { title: string; value: string; bad: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${bad ? "text-red-600" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}
