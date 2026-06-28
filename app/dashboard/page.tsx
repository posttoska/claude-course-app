// Dashboard — the protected note listing (SPEC §11 `/notes`; routed at /dashboard
// here per the prd). A Server Component that fetches the signed-in user's notes
// directly from the data layer (SPEC §3.1: reads run in Server Components, no REST
// API) and hands them to <NoteList> for rendering (which also owns the empty state).
//
// Protection is authoritative: requireAuth() validates the session server-side and
// redirects to /authenticate when there is none (SPEC §7.5, §8). getNotesByUser is
// scoped to session.user.id, so a user only ever sees their own notes.

import { requireAuth } from "@/lib/auth";
import { getNotesByUser } from "@/lib/notes";
import { NoteList } from "@/components/NoteList";

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

      <NoteList notes={notes} />
    </main>
  );
}
