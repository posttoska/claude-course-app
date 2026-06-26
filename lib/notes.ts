import { db } from "@/lib/db";

// A row of the `notes` table (SPEC §6). This module is the server-only data
// access layer for reads; writes live in actions/notes.ts.
export type NoteRow = {
  id: string;
  user_id: string;
  title: string | null;
  content: string; // JSON.stringify(TipTap doc)
  is_public: number; // 0 | 1 (SQLite has no boolean)
  public_id: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
};

export function listNotesByUser(userId: string): NoteRow[] {
  return db
    .query("SELECT * FROM notes WHERE user_id = $uid ORDER BY updated_at DESC")
    .all({ $uid: userId }) as NoteRow[];
}

export function getOwnedNote(id: string, userId: string): NoteRow | null {
  return db
    .query("SELECT * FROM notes WHERE id = $id AND user_id = $uid")
    .get({ $id: id, $uid: userId }) as NoteRow | null;
}

// Public-safe projection: the internal `id` and `user_id` are deliberately NOT
// selected, so they can never reach the public /share route regardless of how
// that page evolves (SPEC §14.2/§14.5 — internal ids are never exposed publicly).
export type PublicNote = Pick<NoteRow, "title" | "content" | "created_at" | "updated_at">;

export function getPublicNote(publicId: string): PublicNote | null {
  return db
    .query(
      "SELECT title, content, created_at, updated_at FROM notes WHERE public_id = $pid AND is_public = 1",
    )
    .get({ $pid: publicId }) as PublicNote | null;
}

// ---- Display label (title or derived-from-content) ----

const MAX_DERIVED_TITLE = 80;
export const FALLBACK_TITLE = "Untitled note";

// First non-empty text node in a TipTap doc, depth-first. The depth cap turns a
// pathologically nested (malformed/hostile) doc into a graceful miss instead of
// a stack overflow.
function firstText(node: unknown, depth = 0): string | null {
  if (depth > 300 || !node || typeof node !== "object") return null;
  const n = node as { text?: unknown; content?: unknown };
  if (typeof n.text === "string" && n.text.trim().length > 0) {
    return n.text.trim();
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      const found = firstText(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// A display label for a note: its explicit title, else derived from the first
// line of content, else a fallback. Used by the dashboard list (SPEC §5.4).
export function noteLabel(note: Pick<NoteRow, "title" | "content">): string {
  if (note.title && note.title.trim().length > 0) return note.title.trim();

  let text: string | null;
  try {
    text = firstText(JSON.parse(note.content));
  } catch {
    return FALLBACK_TITLE;
  }

  if (!text) return FALLBACK_TITLE;
  // Slice over code points (not UTF-16 units) so we never split an astral
  // character (emoji, rare CJK) into a lone surrogate.
  return text.length > MAX_DERIVED_TITLE
    ? `${[...text].slice(0, MAX_DERIVED_TITLE).join("").trimEnd()}…`
    : text;
}
