// Public read-only note page (SPEC §10.3, §11 `/share/[publicId]` — here `/p/[slug]`
// per the prd routes). This is the ONLY note route with NO auth: anyone holding
// the unguessable share link can read it.
//
// Lookup is by the high-entropy `public_slug` (the share token), never the internal
// note id (SPEC §10.1, §14.5). `getNoteByPublicSlug` gates SOLELY on `is_public = 1`
// (CLAUDE.md invariant), so a private note — even one that still carries a slug from
// a previous share — returns null and 404s. notFound() (not 403) so the route never
// reveals whether a slug exists.
//
// Reads happen directly in the Server Component (SPEC §3.1 — no REST API); the JSON
// is rendered server-side by <PublicNoteViewer/> (no editor, no DOM, React-escaped).

import { notFound } from "next/navigation";
import { getNoteByPublicSlug } from "@/lib/notes";
import { PublicNoteViewer } from "@/components/PublicNoteViewer";

export default async function PublicNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const note = getNoteByPublicSlug(slug);
  if (!note) notFound();

  return <PublicNoteViewer title={note.title} contentJson={note.contentJson} />;
}
