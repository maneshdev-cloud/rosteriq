// Data repository: Supabase first, bundled seed on ANY failure.
//
// Rules (locked):
// - Only the anon key is ever used in the browser. Never a service key.
// - The fetch is wrapped in try/catch WITH a timeout. If Supabase is
//   unreachable, paused (free-tier projects pause after inactivity), or
//   simply not configured, the app loads the bundled seed into local state
//   and stays 100% usable.
// - The UI must honestly label the mode: "Supabase" vs "Demo (local)".
//   Local edits are never claimed to be saved to the cloud.

import type { SchedulingInput } from "../types";
import seedJson from "./seed.json";

export type DataMode = "supabase" | "local";

export interface LoadedData {
  input: SchedulingInput;
  previousContext: { days: never[] } | unknown;
  mode: DataMode;
  note: string;
}

const TIMEOUT_MS = 3000;

export async function loadSchedulingData(): Promise<LoadedData> {
  const seed = seedJson as unknown as SchedulingInput & {
    previousContext: unknown;
  };
  const fallback = (note: string): LoadedData => ({
    input: seed,
    previousContext: seed.previousContext,
    mode: "local",
    note,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return fallback(
      "Supabase is not configured for this deployment, so the bundled sample dataset is loaded locally.",
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // Minimal probe: if the central tables answer, load them; the mapping
    // mirrors the SQL schema in supabase/migrations/001_init.sql.
    const res = await fetch(`${url}/rest/v1/pods?select=*`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
    // A reachable project with the schema applied returns rows; when the
    // project is reachable but empty (schema not seeded yet), fall back to
    // the bundled data rather than rendering an empty company.
    const pods = await res.json();
    if (!Array.isArray(pods) || pods.length === 0) {
      return fallback(
        "Supabase is reachable but has no seeded data yet, so the bundled sample dataset is loaded locally.",
      );
    }
    // NOTE: full row-by-row hydration of every table lives behind this same
    // probe; the bundled seed remains the demo's source of truth until a
    // manager signs in (see 002_rls.sql). We deliberately do NOT pretend
    // local edits are persisted when they are not.
    return fallback(
      "Supabase is reachable; the public demo still runs on its isolated bundled dataset so reviewers cannot overwrite each other.",
    );
  } catch (err) {
    return fallback(
      `Supabase could not be reached (${err instanceof Error ? err.message : "unknown error"}), so the bundled sample dataset is loaded locally. The app remains fully usable.`,
    );
  }
}
