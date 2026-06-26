import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getOwnedNote } from "@/lib/notes";
import { parseNoteContent } from "@/lib/validation";
import { NoteEditor } from "@/components/editor/NoteEditor";

export default async function NoteEditPage({ params }: { params: Promise<{ id: string }> }) {
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
      <NoteEditor
        noteId={note.id}
        initialTitle={note.title ?? ""}
        initialContent={content}
        initialIsPublic={note.is_public === 1}
        initialPublicId={note.public_id}
      />
    </main>
  );
}
