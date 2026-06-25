import { requireSession } from "@/lib/session";
import { NewNoteForm } from "@/components/editor/NewNoteForm";

export default async function NewNotePage() {
  // Per-route auth gate (SPEC §8). Static `/notes/new` wins over `/notes/[id]`.
  await requireSession();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">New note</h1>
      <NewNoteForm />
    </main>
  );
}
