import Link from "next/link";
import { noteLabel, type NoteRow } from "@/lib/notes";
import { NoteDate } from "@/components/NoteDate";

export function NoteList({ notes }: { notes: NoteRow[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        No notes yet — create your first one.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
      {notes.map((note) => (
        <li key={note.id}>
          <Link
            href={`/notes/${note.id}`}
            className="flex items-baseline justify-between gap-4 py-3 transition hover:opacity-70"
          >
            <span className="min-w-0 truncate font-medium">{noteLabel(note)}</span>
            <NoteDate iso={note.updated_at} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
