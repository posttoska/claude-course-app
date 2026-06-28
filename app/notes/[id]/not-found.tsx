// Editor 404 page — rendered when /notes/[id]/page.tsx calls notFound() because
// the note doesn't exist OR isn't owned by the signed-in user (the two are
// deliberately indistinguishable; SPEC §8/§14.2 — return 404, not 403, so the app
// never reveals whether an id exists). A friendly, on-brand page with a clear way
// back, instead of the bare default 404.

import Link from "next/link";

export default function NoteNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-foreground/50">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Note not found</h1>
      <p className="mt-2 text-sm text-foreground/60">
        This note doesn’t exist, or you don’t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        ← Back to dashboard
      </Link>
    </main>
  );
}
