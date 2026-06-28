// Dashboard — the protected note listing (SPEC §11 `/notes`; routed at /dashboard
// here per the prd). A Server Component that fetches the signed-in user's notes
// directly from the data layer (SPEC §3.1: reads run in Server Components, no REST
// API) and renders them, with an empty state when the user has no notes yet.
//
// Protection is authoritative: requireAuth() validates the session server-side and
// redirects to /authenticate when there is none (SPEC §7.5, §8). getNotesByUser is
// scoped to session.user.id, so a user only ever sees their own notes.

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getNotesByUser } from "@/lib/notes";

/** Stable, server-rendered date label (e.g. "28 Jun 2026"). */
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const notes = getNotesByUser(session.user.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your notes</h1>
          <p className="text-sm text-foreground/60">
            {notes.length === 0
              ? "You don't have any notes yet."
              : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/20">
          <p className="text-sm font-medium">No notes yet</p>
          <p className="mt-1 text-sm text-foreground/60">
            Create your first note to start writing and sharing.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Link
                href={`/notes/${note.id}`}
                className="flex h-full flex-col gap-3 rounded-lg border border-black/10 p-4 transition-colors hover:border-black/25 hover:bg-black/[.02] dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-white/[.04]"
              >
                <h2 className="line-clamp-2 font-medium tracking-tight">
                  {note.title?.trim() || "Untitled note"}
                </h2>
                <div className="mt-auto flex items-center justify-between gap-2 text-xs text-foreground/55">
                  <span>Updated {formatUpdatedAt(note.updatedAt)}</span>
                  <span
                    className={
                      note.isPublic
                        ? "rounded-full bg-green-600/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400"
                        : "rounded-full bg-black/[.06] px-2 py-0.5 font-medium text-foreground/60 dark:bg-white/10"
                    }
                  >
                    {note.isPublic ? "Public" : "Private"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
