// Editor loading skeleton — shown via Suspense while the /notes/[id] Server
// Component awaits the session + the note query (a dynamic, DB-backed page).
//
// A Server Component (no client JS): it mirrors the real editor page layout
// (back link, metadata row, editor card with title/toolbar/content placeholders)
// with animate-pulse blocks so the page doesn't flash empty. Kept in sync with
// page.tsx / NoteEditor's structure to avoid layout shift on load.

const TOOLBAR_BUTTONS = 8;
const CONTENT_LINES = 5;

export default function NoteEditorLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6" aria-busy="true">
      <div className="mb-6">
        <div className="h-4 w-32 animate-pulse rounded bg-black/[.06] dark:bg-white/[.07]" />
      </div>

      <header className="mb-4 flex items-center justify-end gap-3">
        <div className="h-3 w-28 animate-pulse rounded bg-black/[.06] dark:bg-white/[.07]" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-black/[.06] dark:bg-white/[.07]" />
      </header>

      <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
        {/* Title */}
        <div className="mb-3 h-8 w-2/3 animate-pulse rounded bg-black/[.08] dark:bg-white/10" />

        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap gap-2">
          {Array.from({ length: TOOLBAR_BUTTONS }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-8 animate-pulse rounded bg-black/[.06] dark:bg-white/[.07]"
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: CONTENT_LINES }).map((_, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded bg-black/[.05] dark:bg-white/[.06]"
              style={{ width: `${90 - i * 8}%` }}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/15">
          <div className="h-8 w-16 animate-pulse rounded bg-black/[.06] dark:bg-white/[.07]" />
          <div className="h-8 w-20 animate-pulse rounded bg-black/[.08] dark:bg-white/10" />
        </div>
      </div>

      <span className="sr-only">Loading note…</span>
    </main>
  );
}
