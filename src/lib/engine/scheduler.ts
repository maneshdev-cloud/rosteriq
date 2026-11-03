// The scheduler interface — the seam where a stronger optimizer can replace
// the heuristic WITHOUT touching the validator, simulator, or UI.
//
// Today: HeuristicScheduler (greedy placement + bounded local repair).
// Future: a CP-SAT-backed scheduler implementing this same interface, chosen
// only if the benchmark (scripts/benchmark.mjs / tests) shows the heuristic
// leaving avoidable gaps on realistic data. The interface returns a roster
// plus its RepairResult; callers must still run validateRoster() on the
// output — no scheduler's word is ever taken for validity.

import type { GeneratedRoster, GenerateOptions, SchedulingInput } from "../types";
import { generateRoster } from "./generator";

export interface Scheduler {
  readonly name: string;
  generate(input: SchedulingInput, month: string, options: GenerateOptions): GeneratedRoster;
}

export const heuristicScheduler: Scheduler = {
  name: "heuristic-greedy-bounded-repair",
  generate: (input, month, options) => generateRoster(input, month, options),
};

/** The currently selected scheduler. Swap this one binding to change engines. */
export const scheduler: Scheduler = heuristicScheduler;
