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
  const [showGuide, setShowGuide] = useState(true);
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
        <p className="animate-pulse text-[15px] font-medium text-slate-600">
          Loading RosterIQ — building the December 2026 roster for the sample company…
        </p>
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
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-lg font-extrabold tracking-tight text-white shadow-sm"
          >
            RQ
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-900">
              RosterIQ{" "}
              <span className="text-[13px] font-semibold uppercase tracking-wider text-teal-700">
                Coverage Risk &amp; Repair Engine
              </span>
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-slate-500">
              December 2026 · {input.employees.length} employees · {input.brands.length} brands ·{" "}
              {input.pods.length} pods
            </p>
          </div>
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
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 shadow-sm"
            title="Authorization demo: viewers cannot edit or publish"
          >
            <option value="manager">Manager</option>
            <option value="viewer">Viewer (read-only)</option>
          </select>
          <button
            onClick={() => input && regenerate(input, previousContext)}
            className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700"
          >
            Regenerate roster
          </button>
          <button
            onClick={downloadCSV}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={publish}
            disabled={!canPublish || role !== "manager"}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm enabled:hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
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
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-[15px] leading-relaxed text-red-900 shadow-sm">
          <strong>Publishing is blocked:</strong> {metrics.mandatoryIssues} mandatory issue(s) are open.{" "}
          <button className="font-semibold underline" onClick={() => setTab("issues")}>
            Review them in the Risk Centre
          </button>
          .
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-[15px] leading-relaxed text-sky-900 shadow-sm">
          {notice}
        </div>
      )}
      <p className="mt-3 text-[13px] font-medium text-slate-500">{dataNote}</p>

      {/* Tabs */}
      <nav className="mt-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {(
          [
            ["dashboard", "Dashboard"],
            ["roster", "Roster"],
            ["setup", "Setup"],
            ["issues", "Risk Centre"],
            ["simulator", "Simulator"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-semibold transition-colors ${
              tab === t
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {label}
            {t === "issues" && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  metrics.mandatoryIssues > 0
                    ? "bg-red-600 text-white"
                    : tab === t
                      ? "bg-slate-700 text-slate-100"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {metrics.mandatoryIssues + metrics.preferenceIssues}
              </span>
            )}
          </button>
        ))}
        {/* Context help: wherever the reviewer is, this strip says in one
            line what the page is and what to do on it. No guessing. */}
        <div className="ml-auto hidden items-center gap-2.5 self-center rounded-lg bg-teal-50 py-2 pl-2.5 pr-4 lg:flex">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[13px] font-extrabold text-white"
          >
            ?
          </span>
          <p className="text-[13px] font-medium leading-snug text-teal-900">
            {
              {
                dashboard:
                  "The month's score — is every brand covered? Follow the 2-minute guide below.",
                roster:
                  "Who works which day. Click any cell to change a person's day — rules re-check instantly.",
                setup:
                  "The company's data — people, brands, leaves. Change anything; the roster rebuilds itself.",
                issues:
                  "Every problem in plain English: what is uncovered, why, and whether it blocks publishing.",
                simulator:
                  "Test a day off before approving it. The real roster never changes on this page.",
              }[tab]
            }
          </p>
        </div>
      </nav>

      {tab === "dashboard" && (
        <section className="mt-6 space-y-6">
          {showGuide && (
            <div className="rounded-2xl bg-slate-900 px-6 py-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-white">
                    New here? Start here — it takes two minutes.
                  </h2>
                  <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-slate-300">
                    RosterIQ builds the <b className="text-white">December 2026 duty roster</b> for
                    a sample company — 32 employees looking after 23 client brands — and{" "}
                    <b className="text-white">proves every brand is covered, every day</b>. If
                    coverage is ever impossible, it says so honestly instead of hiding the gap.
                  </p>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 ring-1 ring-slate-600 hover:bg-slate-800 hover:text-white"
                >
                  Hide guide
                </button>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-3">
                <li className="rounded-xl bg-slate-800/80 p-4">
                  <p className="text-sm font-bold text-teal-300">Step 1 — See the roster</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    Who works which day, for which brand. Click any cell to change a
                    person&apos;s day — every rule is re-checked instantly.
                  </p>
                  <button
                    onClick={() => setTab("roster")}
                    className="mt-2.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Open the roster →
                  </button>
                </li>
                <li className="rounded-xl bg-slate-800/80 p-4">
                  <p className="text-sm font-bold text-teal-300">Step 2 — Break it safely</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    In the Simulator, give the only EcoLiving employee a day off and watch
                    the system find safe cover — or honestly report that none exists.
                  </p>
                  <button
                    onClick={() => setTab("simulator")}
                    className="mt-2.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Try the Simulator →
                  </button>
                </li>
                <li className="rounded-xl bg-slate-800/80 p-4">
                  <p className="text-sm font-bold text-teal-300">Step 3 — Check the risks</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    The Risk Centre lists every problem in plain English — what is
                    uncovered, why, and what it would take to fix it.
                  </p>
                  <button
                    onClick={() => setTab("issues")}
                    className="mt-2.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Open the Risk Centre →
                  </button>
                </li>
              </ol>
              <p className="mt-3 text-[13px] text-slate-400">
                The four cards below are the month&apos;s score: coverage, uncovered positions,
                and the issues that would block publishing this roster.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Coverage" value={`${metrics.coveragePct}%`} sub={`${metrics.fullyCoveredUnits} of ${metrics.requiredUnits} required units fully covered`} tone={metrics.coveragePct === 100 ? "good" : "bad"} />
            <MetricCard label="Uncovered positions" value={String(metrics.uncoveredPositions)} sub="Sum of staffing shortfalls — never hidden" tone={metrics.uncoveredPositions === 0 ? "good" : "bad"} />
            <MetricCard label="Mandatory issues" value={String(metrics.mandatoryIssues)} sub="Block publishing until resolved" tone={metrics.mandatoryIssues === 0 ? "good" : "bad"} />
            <MetricCard label="Preference issues" value={String(metrics.preferenceIssues)} sub="Non-blocking (e.g. weekly-off preference)" tone="neutral" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-[17px] font-bold text-slate-900">Structural risk audit (before generation)</h2>
              {audit.length === 0 ? (
                <p className="mt-2 text-[15px] leading-relaxed text-emerald-700">
                  No proven structural shortages in the current configuration. Every brand-process
                  has enough assigned staff-days per week — this does not guarantee a feasible
                  roster, it rules out provable impossibility.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-[15px] leading-relaxed text-red-700">
                  {audit.map((f) => (
                    <li key={f.brandProcessId} className="rounded bg-red-50 p-2">{f.message}</li>
                  ))}
                </ul>
              )}
              <h3 className="mt-6 text-[15px] font-bold text-slate-900">Next 7 days — gaps per day</h3>
              <div className="mt-2.5 flex gap-2">
                {dates.slice(0, 7).map((d) => (
                  <div
                    key={d}
                    className={`flex-1 rounded-lg px-2 py-2.5 text-center text-[13px] ${
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

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-[17px] font-bold text-slate-900">Pods</h2>
              <table className="mt-3 w-full text-[15px]">
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
              <h3 className="mt-6 text-[15px] font-bold text-slate-900">Approved leave &amp; comp-offs in December</h3>
              <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed text-slate-600">
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
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
            Monthly roster — December 2026
          </h2>
          <p className="mb-4 mt-2 max-w-4xl text-[15px] leading-relaxed text-slate-500">
            Each <b>row is one employee</b>, each <b>column is one day</b>. The letters show
            what that person covers that day — <b>CS</b> Customer Support, <b>ACC</b>{" "}
            Abandoned Cart Conversions, <b>NDR</b> Non-Delivery Report Management, <b>RET</b>{" "}
            Customer Retention. Use the views above the grid to group the same roster by pod,
            brand, or process. <b>Click any cell</b> to change that person&apos;s day.
          </p>
          {/* Editor lives HERE by default — directly under the heading, in
              full view the moment a cell is clicked, never buried below
              32 rows of grid. */}
          {selected && (
            <div className="mb-4">
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
            </div>
          )}
          <RosterGrid
            input={input}
            days={days}
            coverage={coverage}
            issues={issues}
            month={MONTH}
            onSelectCell={role === "manager" ? setSelected : undefined}
          />
          {role !== "manager" && (
            <p className="mt-2 text-xs text-slate-400">
              You are in Viewer mode — editing is disabled. Switch to Manager to edit cells.
            </p>
          )}
        </section>
      )}

      {tab === "setup" && (
        <section className="mt-6">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Company setup</h2>
          <p className="mb-4 mt-2 max-w-4xl text-[15px] leading-relaxed text-slate-500">
            This is the company&apos;s data: the people, the brands, who is allowed to cover
            what, plus holidays and approved leaves. <b>Change anything here and the roster is
            rebuilt and re-checked automatically</b> — no code, no spreadsheets. Try adding a
            leave for Geeta Rao and watch the roster react.
          </p>
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
  const accent =
    tone === "good"
      ? "border-l-emerald-500"
      : tone === "bad"
        ? "border-l-red-500"
        : "border-l-slate-300";
  return (
    <div className={`rounded-2xl border border-slate-200 border-l-4 ${accent} bg-white p-5 shadow-sm`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div
        className={`mt-1.5 text-4xl font-extrabold tracking-tight ${
          tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-800"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[13px] leading-snug text-slate-500">{sub}</div>
    </div>
  );
}
