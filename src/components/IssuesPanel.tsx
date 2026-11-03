"use client";

// Coverage Risk Centre: every validator issue with its deterministic
// explanation, severity, and claim type. The optional AI button rephrases
// the explanation via /api/explain — it never changes the facts, and the
// deterministic text is always shown as the source of truth.

import { useState } from "react";
import type { SchedulingInput, ValidationIssue } from "../lib/types";

const CLAIM_LABEL: Record<ValidationIssue["claimKind"], string> = {
  structural: "Structural (audit-proven)",
  gap: "Gap in this roster",
  repair: "Repair not found",
  validation: "Validation",
};

export default function IssuesPanel({
  input,
  issues,
}: {
  input: SchedulingInput;
  issues: ValidationIssue[];
}) {
  const [filter, setFilter] = useState<"all" | "mandatory" | "preference">("all");
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const shown = issues.filter((i) => filter === "all" || i.severity === filter);
  const keyOf = (i: ValidationIssue, idx: number) =>
    `${i.code}|${i.date ?? ""}|${i.brandId ?? ""}|${i.processCode ?? ""}|${i.employeeId ?? ""}|${idx}`;

  const explainWithAI = async (issue: ValidationIssue, key: string) => {
    setBusy(key);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: issue.message }),
      });
      const data = await res.json();
      setAiText((prev) => ({
        ...prev,
        [key]: data.mode === "ai" ? data.text : `${data.text} (deterministic template — AI layer not configured)`,
      }));
    } catch {
      setAiText((prev) => ({ ...prev, [key]: `${issue.message} (AI layer unreachable — deterministic template shown)` }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-slate-900">Coverage Risk Centre</h2>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
          {(["all", "mandatory", "preference"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm capitalize ${filter === f ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Claim types are kept distinct on purpose: a <b>gap</b> means this roster leaves demand
        uncovered (not that coverage is impossible); only the audit can claim a{" "}
        <b>structural</b> shortage, and only with capacity maths.
      </p>
      {shown.length === 0 && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          No {filter === "all" ? "" : filter} issues. The roster passes the independent validator
          on every checked rule.
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {shown.map((issue, idx) => {
          const key = keyOf(issue, idx);
          return (
            <li
              key={key}
              className={`rounded-xl border p-4 ${
                issue.severity === "mandatory"
                  ? "border-red-200 bg-red-50/60"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${issue.severity === "mandatory" ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {issue.severity.toUpperCase()}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{issue.code}</span>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                  {CLAIM_LABEL[issue.claimKind]}
                </span>
                {issue.brandId && (
                  <span className="text-slate-500">
                    {input.brands.find((b) => b.id === issue.brandId)?.name}
                    {issue.processCode ? ` · ${issue.processCode}` : ""}
                  </span>
                )}
                <button
                  onClick={() => explainWithAI(issue, key)}
                  disabled={busy === key}
                  className="ml-auto rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy === key ? "Asking AI…" : "AI explain"}
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-800">{issue.message}</p>
              {aiText[key] && (
                <p className="mt-2 rounded-lg bg-white/70 p-2 text-sm text-slate-600 ring-1 ring-slate-200">
                  <span className="font-semibold">AI rephrase:</span> {aiText[key]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
