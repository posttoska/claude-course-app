import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getOwnedNote, noteLabel } from "@/lib/notes";
import { parseNoteContent } from "@/lib/validation";
import { NoteContent } from "@/components/NoteContent";
import { NoteDate } from "@/components/NoteDate";
import { DeleteNoteDialog } from "@/components/DeleteNoteDialog";
import { ShareControl } from "@/components/ShareControl";

export default async function NoteViewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  // Authoritative ownership check. 404 for missing OR not-owned, so we never
  // reveal that another user's note exists (SPEC §8, §14.2).
  const note = getOwnedNote(id, session.user.id);
  if (!note) notFound();

  // A corrupt or non-doc row degrades to an empty doc instead of a 500.
  const content = parseNoteContent(note.content);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{noteLabel(note)}</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Updated <NoteDate iso={note.updated_at} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-foreground/60 transition hover:opacity-70">
            Back
          </Link>
          <Link
            href={`/notes/${note.id}/edit`}
            className="rounded-md bg-foreground px-4 py-2 font-medium text-background transition hover:opacity-90"
          >
            Edit
          </Link>
          <DeleteNoteDialog noteId={note.id} />
        </div>
      </div>

      <NoteContent content={content} />

      <div className="mt-8">
        <ShareControl
          noteId={note.id}
          initialIsPublic={note.is_public === 1}
          initialPublicId={note.public_id}
        />
      </div>
    </main>
  );
}
