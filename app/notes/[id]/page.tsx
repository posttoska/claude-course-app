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
// NOTE (page-first flow, mirrors how the dashboard page preceded <NoteList>): the
// rich TipTap editor (components/NoteEditor.tsx) is the next prd task. Until it
// exists, this page renders a minimal read-only shell around the fetched note and
// marks where the editor will mount; the editor task replaces that region and
// receives `note` as its initial data.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getNoteById } from "@/lib/notes";

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

      {/* Editor mount point. The interactive TipTap editor (next prd task) replaces
          this region and receives `note` (incl. note.contentJson) as initial data. */}
      <section className="rounded-lg border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/20">
        <p className="text-sm font-medium">Editor coming soon</p>
        <p className="mt-1 text-sm text-foreground/60">
          The rich-text editor for this note will load here.
        </p>
      </section>
    </main>
  );
}
