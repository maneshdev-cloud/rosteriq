// Loading state for the root route while the client workspace hydrates.
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-lg font-bold text-slate-900">
        RosterIQ <span className="font-normal text-slate-500">Coverage Risk &amp; Repair Engine</span>
      </p>
      <p className="mt-2 animate-pulse text-sm text-slate-500">
        Loading data and generating the roster…
      </p>
    </main>
  );
}
