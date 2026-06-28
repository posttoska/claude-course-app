// Dashboard loading skeleton — shown via Suspense while the /dashboard Server
// Component awaits the session + notes query (it's a dynamic, DB-backed page).
//
// A Server Component (no client JS): it just mirrors the real dashboard layout
// (mx-auto max-w-5xl header + card grid) with animate-pulse placeholders so the
// page doesn't flash empty. Kept in sync with page.tsx / NoteList's structure.

const SKELETON_CARDS = 6;

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6" aria-busy="true">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-black/[.08] dark:bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded-md bg-black/[.06] dark:bg-white/[.07]" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-black/[.08] dark:bg-white/10" />
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
          <li
            key={i}
            className="flex h-full flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="h-5 w-3/4 animate-pulse rounded bg-black/[.07] dark:bg-white/[.08]" />
            <div className="mt-auto flex items-center justify-between gap-2">
              <div className="h-3 w-24 animate-pulse rounded bg-black/[.06] dark:bg-white/[.07]" />
              <div className="h-5 w-14 animate-pulse rounded-full bg-black/[.06] dark:bg-white/[.07]" />
            </div>
          </li>
        ))}
      </ul>

      <span className="sr-only">Loading your notes…</span>
    </main>
  );
}
