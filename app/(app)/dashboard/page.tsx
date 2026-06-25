import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listNotesByUser } from "@/lib/notes";
import { NoteList } from "@/components/NoteList";

export default async function DashboardPage() {
  const session = await requireSession();
  const notes = listNotesByUser(session.user.id);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Your notes</h1>
        <Link
          href="/notes/new"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          New Note
        </Link>
      </div>

      <NoteList notes={notes} />
    </main>
  );
}
