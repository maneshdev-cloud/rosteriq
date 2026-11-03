"use client";

// RosterIQ — main application shell.
// One client app: dashboard, roster grid (5 views over ONE grid component),
// setup, issues, simulator. All scheduling truth comes from the pure engine
// in src/lib/engine — this file only holds state and renders it.

import { useEffect, useMemo, useState } from "react";
import type {
  RosterCoverage,
  RosterDay,
  SchedulingInput,
} from "../lib/types";
import { loadSchedulingData, type DataMode } from "../lib/data/repository";
import { scheduler } from "../lib/engine/scheduler";
import { validateRoster } from "../lib/engine/validator";
import { auditFeasibility } from "../lib/engine/audit";
import { computeMetrics } from "../lib/engine/metrics";
import { rosterToCSV } from "../lib/engine/export";
import { datesOfMonth } from "../lib/engine/calendar";
import { fmtDate } from "../lib/engine/explain";
import RosterGrid, { type SelectedCell } from "./RosterGrid";
import SetupPanel from "./SetupPanel";
import IssuesPanel from "./IssuesPanel";
import SimulatorPanel from "./SimulatorPanel";
import CellEditor from "./CellEditor";

const MONTH = "2026-12";
const GEN_OPTS = {
  seed: 42,
  maxRepairPasses: 3,
  maxCandidatesPerPass: 50,
};

type Tab = "dashboard" | "roster" | "setup" | "issues" | "simulator";
type Role = "manager" | "viewer";

export default function RosterApp() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DataMode>("local");
  const [dataNote, setDataNote] = useState("");
  const [input, setInput] = useState<SchedulingInput | null>(null);
  const [previousContext, setPreviousContext] = useState<unknown>(null);
  const [days, setDays] = useState<RosterDay[]>([]);
  const [coverage, setCoverage] = useState<RosterCoverage[]>([]);
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState<"DRAFT" | "VALIDATED" | "PUBLISHED">("DRAFT");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [role, setRole] = useState<Role>("manager");
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valOpts = useMemo(
    () => ({
      month: MONTH,
      previousContext: previousContext as never,
      nextContext: null,
    }),
    [previousContext],
  );

  const regenerate = (inp: SchedulingInput, ctx: unknown) => {
    const gen = scheduler.generate(inp, MONTH, {
      ...GEN_OPTS,
      previousContext: ctx as never,
    });
    setDays(gen.days);
    setCoverage(gen.coverage);
  };

  useEffect(() => {
    (async () => {
      const loaded = await loadSchedulingData();
      setMode(loaded.mode);
      setDataNote(loaded.note);
      setInput(loaded.input);
      setPreviousContext(loaded.previousContext);
      regenerate(loaded.input, loaded.previousContext);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = useMemo(
    () => (input ? validateRoster(input, days, coverage, valOpts) : []),
    [input, days, coverage, valOpts],
  );
  const metrics = useMemo(
    () => (input ? computeMetrics(input, days, coverage, issues, MONTH) : null),
    [input, days, coverage, issues],
  );
  const audit = useMemo(
    () => (input ? auditFeasibility(input, MONTH) : []),
    [input],
  );

  /** Any edit to a PUBLISHED roster forks a new draft version — published
   *  versions are never silently overwritten. */
  const touch = () => {
    if (status === "PUBLISHED") {
      setVersion((v) => v + 1);
      setStatus("DRAFT");
      setNotice(
        "This roster was published, so your edit created a new draft version. The published version is unchanged.",
      );
    }
  };

  const onSetupChange = (next: SchedulingInput) => {
    touch();
    setInput(next);
    regenerate(next, previousContext);
  };

  const publish = () => {
    if (!metrics || metrics.mandatoryIssues > 0) return;
    setStatus("PUBLISHED");
    setNotice(`Roster v${version} published for December 2026. It passed validation with zero mandatory issues.`);
  };

  const downloadCSV = () => {
    if (!input) return;
    const blob = new Blob([rosterToCSV(input, days, coverage, MONTH)], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rosteriq-december-2026-v${version}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading || !input || !metrics) {
    return (
      <main className="mx-auto max-w-7xl p-8">
        <p className="text-slate-600">Loading RosterIQ…</p>
      </main>
    );
  }

  const canPublish = metrics.mandatoryIssues === 0 && status !== "PUBLISHED";
  const dates = datesOfMonth(MONTH);
  const shortfallsByDay = new Map<string, number>();
  for (const i of issues) {
    if (i.code === "COVERAGE_SHORTFALL" && i.date) {
      shortfallsByDay.set(i.date, (shortfallsByDay.get(i.date) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            RosterIQ <span className="text-sm font-medium text-slate-500">Coverage Risk &amp; Repair Engine</span>
          </h1>
          <p className="text-sm text-slate-500">
            December 2026 · {input.employees.length} employees · {input.brands.length} brands ·{" "}
            {input.pods.length} pods
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              mode === "supabase"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
            title={dataNote}
          >
            {mode === "supabase" ? "Supabase" : "Demo (local)"}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Roster v{version} · {status}
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            title="Authorization demo: viewers cannot edit or publish"
          >
            <option value="manager">Manager</option>
            <option value="viewer">Viewer (read-only)</option>
          </select>
          <button
            onClick={() => input && regenerate(input, previousContext)}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Regenerate roster
          </button>
          <button
            onClick={downloadCSV}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={publish}
            disabled={!canPublish || role !== "manager"}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white enabled:hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            title={
              metrics.mandatoryIssues > 0
                ? `Publishing is blocked: ${metrics.mandatoryIssues} mandatory issue(s) must be resolved first.`
                : role !== "manager"
                  ? "Viewers cannot publish."
                  : "Publish this validated roster"
            }
          >
            Publish
          </button>
        </div>
      </header>

      {metrics.mandatoryIssues > 0 && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Publishing is blocked: {metrics.mandatoryIssues} mandatory issue(s) are open.{" "}
          <button className="font-semibold underline" onClick={() => setTab("issues")}>
            Review them in the Risk Centre
          </button>
          .
        </div>
      )}
      {notice && (
        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-800">
          {notice}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">{dataNote}</p>

      {/* Tabs */}
      <nav className="mt-4 flex gap-1 border-b border-slate-200">
        {(
          [
            ["dashboard", "Dashboard"],
            ["roster", "Roster"],
            ["setup", "Setup"],
            ["issues", `Risk Centre (${metrics.mandatoryIssues + metrics.preferenceIssues})`],
            ["simulator", "Simulator"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-teal-600 text-teal-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <section className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Coverage" value={`${metrics.coveragePct}%`} sub={`${metrics.fullyCoveredUnits} of ${metrics.requiredUnits} required units fully covered`} tone={metrics.coveragePct === 100 ? "good" : "bad"} />
            <MetricCard label="Uncovered positions" value={String(metrics.uncoveredPositions)} sub="Sum of staffing shortfalls — never hidden" tone={metrics.uncoveredPositions === 0 ? "good" : "bad"} />
            <MetricCard label="Mandatory issues" value={String(metrics.mandatoryIssues)} sub="Block publishing until resolved" tone={metrics.mandatoryIssues === 0 ? "good" : "bad"} />
            <MetricCard label="Preference issues" value={String(metrics.preferenceIssues)} sub="Non-blocking (e.g. weekly-off preference)" tone="neutral" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Structural risk audit (before generation)</h2>
              {audit.length === 0 ? (
                <p className="mt-2 text-sm text-emerald-700">
                  No proven structural shortages in the current configuration. Every brand-process
                  has enough assigned staff-days per week — this does not guarantee a feasible
                  roster, it rules out provable impossibility.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-red-700">
                  {audit.map((f) => (
                    <li key={f.brandProcessId} className="rounded bg-red-50 p-2">{f.message}</li>
                  ))}
                </ul>
              )}
              <h3 className="mt-5 font-semibold text-slate-900">Next 7 days — gaps per day</h3>
              <div className="mt-2 flex gap-2">
                {dates.slice(0, 7).map((d) => (
                  <div
                    key={d}
                    className={`flex-1 rounded-lg p-2 text-center text-xs ${
                      (shortfallsByDay.get(d) ?? 0) > 0
                        ? "bg-red-100 text-red-800"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <div className="font-semibold">{fmtDate(d)}</div>
                    <div>{(shortfallsByDay.get(d) ?? 0) > 0 ? `${shortfallsByDay.get(d)} gap(s)` : "covered"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Pods</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1">Pod</th><th>Employees</th><th>Brands</th><th>Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {input.pods.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-1.5 font-medium">{p.name}</td>
                      <td>{input.employees.filter((e) => e.podId === p.id).length}</td>
                      <td>{input.brands.filter((b) => b.podId === p.id).length}</td>
                      <td>{input.employees.find((e) => e.id === p.leadEmployeeId)?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className="mt-5 font-semibold text-slate-900">Approved leave &amp; comp-offs in December</h3>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {input.leaves.map((l, idx) => (
                  <li key={idx}>
                    {input.employees.find((e) => e.id === l.employeeId)?.name} —{" "}
                    {l.type === "comp_off_taken" ? "comp-off" : "planned leave"}: {fmtDate(l.startDate)}
                    {l.endDate !== l.startDate ? ` to ${fmtDate(l.endDate)}` : ""}
                    {l.earnedOn ? ` (earned by working ${fmtDate(l.earnedOn)})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === "roster" && (
        <section className="mt-6">
          <RosterGrid
            input={input}
            days={days}
            coverage={coverage}
            issues={issues}
            month={MONTH}
            onSelectCell={role === "manager" ? setSelected : undefined}
          />
          {selected && (
            <CellEditor
              input={input}
              days={days}
              coverage={coverage}
              selected={selected}
              onClose={() => setSelected(null)}
              onApply={(nextDays, nextCoverage) => {
                touch();
                setDays(nextDays);
                setCoverage(nextCoverage);
              }}
            />
          )}
          {role !== "manager" && (
            <p className="mt-2 text-xs text-slate-400">
              You are in Viewer mode — editing is disabled. Switch to Manager to edit cells.
            </p>
          )}
        </section>
      )}

      {tab === "setup" && (
        <section className="mt-6">
          {role === "manager" ? (
            <SetupPanel input={input} onChange={onSetupChange} />
          ) : (
            <p className="text-sm text-slate-500">Viewers cannot change configuration. Switch to Manager mode to edit employees, brands, assignments, holidays and leaves.</p>
          )}
        </section>
      )}

      {tab === "issues" && (
        <section className="mt-6">
          <IssuesPanel input={input} issues={issues} />
        </section>
      )}

      {tab === "simulator" && (
        <section className="mt-6">
          <SimulatorPanel
            input={input}
            days={days}
            coverage={coverage}
            valOpts={valOpts}
            month={MONTH}
            canApply={role === "manager"}
            onCommit={(nextDays, nextCoverage, leave) => {
              touch();
              setDays(nextDays);
              setCoverage(nextCoverage);
              if (leave && input) {
                setInput({ ...input, leaves: [...input.leaves, leave] });
              }
              setNotice("Scenario applied to the roster and recorded as approved leave.");
            }}
          />
        </section>
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div
        className={`mt-1 text-3xl font-bold ${
          tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-800"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
