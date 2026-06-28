// Note editor page (SPEC §11 `/notes/[id]`) — the protected, owner-only route for
// viewing/editing a single note. A Server Component "shell" (SPEC §3.1, §11:
// Server Component shell + client editor): it does the authoritative auth +
// ownership + 404 work on the server, then hands the note to the client editor.
//
// Guard order (SPEC §7.5, §8, §14.2):
//   1. requireAuth() — validate the session server-side; redirect to /authenticate
//      when there is none.
//   2. getNoteById(session.user.id, id) — ownership is baked into its WHERE clause,
//      so a missing note and a note owned by someone else are indistinguishable.
//   3. notFound() (404, NOT 403) when null — never reveal whether an id exists.
//
// NOTE (page-first flow, mirrors how the dashboard page preceded <NoteList>): this
// Server Component shell mounts the interactive client editor (NoteEditor) and
// passes it the fetched `note` as initial data. The title input, toolbar, and
// save/delete/share controls are later prd tasks that extend NoteEditor itself.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getNoteById } from "@/lib/notes";
import { NoteEditor } from "@/components/NoteEditor";

/** Stable, server-rendered date label (e.g. "28 Jun 2026"). Matches NoteList. */
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function NoteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();

  const note = getNoteById(session.user.id, id);
  if (!note) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {note.title?.trim() || "Untitled note"}
        </h1>
        <div className="flex items-center gap-3 text-xs text-foreground/55">
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
      </header>

      <NoteEditor note={note} />
    </main>
  );
}
