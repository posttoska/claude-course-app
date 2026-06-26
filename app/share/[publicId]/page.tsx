import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicNote, noteLabel } from "@/lib/notes";
import { parseNoteContent } from "@/lib/validation";
import { NoteContent } from "@/components/NoteContent";
import { NoteDate } from "@/components/NoteDate";

// Always re-check sharing state on every request so unsharing takes effect
// immediately for everyone (no stale public render).
export const dynamic = "force-dynamic";

// The public_id is an unguessable capability URL — keep it out of search
// indexes so a shared note can't become publicly discoverable (SPEC §14.5).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// PUBLIC, unauthenticated route — it lives OUTSIDE the (app) auth area, so guests
// (not signed in) can view. Access is gated SOLELY on is_public = 1 looked up by
// the high-entropy public_id; the internal note id is never accepted or exposed
// here (SPEC §8, §10.3, §14.2). When a note is unshared (is_public = 0),
// getPublicNote returns null and the link 404s — "leads nowhere anymore".
export default async function PublicNotePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const note = getPublicNote(publicId);
  if (!note) notFound();

  const content = parseNoteContent(note.content);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <article>
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-foreground/40">
            Shared note · read only
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{noteLabel(note)}</h1>
          <p className="mt-1 text-xs text-foreground/50">
            Updated <NoteDate iso={note.updated_at} />
          </p>
        </header>

        <NoteContent content={content} />
      </article>
    </main>
  );
}
