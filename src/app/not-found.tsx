import Link from "next/link";

// 404 for unknown routes (Next.js file convention). The app is a single
// workspace at "/", so the only helpful action is returning there.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-teal-700">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        RosterIQ has a single workspace — the dashboard, roster grid, setup, risk
        centre and simulator all live on the home page.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        Return to the dashboard
      </Link>
    </main>
  );
}
