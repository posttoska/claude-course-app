"use client";

// Dashboard error boundary — catches errors thrown while rendering /dashboard
// (e.g. the notes query failing). Next.js App Router error files MUST be Client
// Components and receive { error, reset }; `reset()` re-renders the segment to
// retry. We log the error to the console for diagnostics but show the user a
// generic message (don't leak internals), mirroring the dashboard's layout/theme.

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div
        role="alert"
        className="rounded-lg border border-red-500/30 bg-red-500/[.04] px-6 py-16 text-center"
      >
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-foreground/60">
          We couldn&apos;t load your notes. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
