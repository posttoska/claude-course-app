// NoteList — presentational listing of a user's notes (SPEC §11 dashboard).
//
// A Server Component (read-only links, no client JS): it just renders the notes
// it's handed. The dashboard page owns the data fetch (getNotesByUser, scoped to
// the owner) and passes the result here. Each card links to /notes/[id]; an empty
// list shows a helpful prompt instead.

import Link from "next/link";
import type { Note } from "@/lib/notes";

/** Stable, server-rendered date label (e.g. "28 Jun 2026"). */
function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/15 px-6 py-16 text-center dark:border-white/20">
        <p className="text-sm font-medium">No notes yet</p>
        <p className="mt-1 text-sm text-foreground/60">
          Create your first note to start writing and sharing.
        </p>
      </div>
    );
  }

  return (
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
  );
}
