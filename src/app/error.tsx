"use client";

import Link from "next/link";

// Route error boundary (Next.js file convention). Shows a safe, generic
// message — never a stack trace or internal detail — with a retry action.
// Next 16 passes `unstable_retry`; older shapes pass `reset`. Support both.

export default function ErrorPage({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  const retry = unstable_retry ?? reset;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-red-600">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">RosterIQ hit an unexpected error</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your roster data is held in this browser session and has not been sent
        anywhere. Retrying usually recovers the view; if it does not, reload the
        page to regenerate the roster from the sample dataset.
      </p>
      {error?.digest && (
        <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => retry?.()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Return to the dashboard
        </Link>
      </div>
    </main>
  );
}
