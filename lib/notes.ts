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
// The pure derivation logic lives in the DB-free lib/content.ts so it stays
// unit-testable without the Bun-only `bun:sqlite` import; re-exported here so
// existing `@/lib/notes` imports keep working unchanged.
export { noteLabel, FALLBACK_TITLE } from "@/lib/content";
