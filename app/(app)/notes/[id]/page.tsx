import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getOwnedNote } from "@/lib/notes";
import { NoteEditor } from "@/components/editor/NoteEditor";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  // Authoritative ownership check. 404 for missing OR not-owned, so we never
  // reveal that another user's note exists (SPEC §8, §14.2).
  const note = getOwnedNote(id, session.user.id);
  if (!note) notFound();

  const content = JSON.parse(note.content);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <NoteEditor
        noteId={note.id}
        initialTitle={note.title ?? ""}
        initialContent={content}
      />
    </main>
  );
}
