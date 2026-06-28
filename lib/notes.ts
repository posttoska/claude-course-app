// Server-only data layer for the `notes` table: the canonical `Note` shape, the
// row -> Note mapper, the share-token generator, and the default empty document.
//
// The DB stores notes with snake_case columns and content as a JSON *string*
// (TipTap/ProseMirror doc, never raw HTML — SPEC §5.3, §14.1). This module is
// the boundary that maps those raw rows into the camelCase `Note` the rest of
// the app consumes, parsing `content_json` back into an object along the way.
//
// NOTE: kept driver-agnostic and free of `server-only` so the data layer stays
// importable under the Vitest (Node) test runner — see lib/db.ts for the same
// rationale. The repository query/mutation functions are added in later phases.

import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/core";
import { get, query, run } from "./db";

/** A note as the rest of the app consumes it: camelCase, `contentJson` parsed. */
export type Note = {
  id: string;
  userId: string;
  title: string | null;
  contentJson: JSONContent;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The raw `notes` row as stored in SQLite: snake_case, content stringified, 0/1 booleans. */
export type NoteRow = {
  id: string;
  user_id: string;
  title: string | null;
  content_json: string;
  is_public: number;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Default content for a brand-new note: an empty ProseMirror document with a
 * single empty paragraph (SPEC §9.2). Deep-frozen so the shared constant can't
 * be mutated by accident — clone it (e.g. `structuredClone`) before editing.
 */
export const EMPTY_TIPTAP_DOC: JSONContent = Object.freeze({
  type: "doc",
  content: Object.freeze([Object.freeze({ type: "paragraph" })]),
}) as JSONContent;

/** Public share-token length. nanoid's default alphabet is URL-safe; 21 chars is high-entropy and unguessable (SPEC §10.1, §14.5). */
const PUBLIC_SLUG_SIZE = 21;

/** Generate a high-entropy, URL-safe public share slug (nanoid, 21 chars). */
export function generatePublicSlug(): string {
  return nanoid(PUBLIC_SLUG_SIZE);
}

/**
 * Map a raw `notes` row to a `Note`: snake_case -> camelCase, `is_public` 0/1 ->
 * boolean, and `content_json` parsed from its stored JSON string back into an
 * object (SPEC §5.3).
 */
export function mapRowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    contentJson: JSON.parse(row.content_json) as JSONContent,
    isPublic: row.is_public === 1,
    publicSlug: row.public_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Default title for a note created without an explicit one (prd: data-layer default). */
const DEFAULT_NOTE_TITLE = "Untitled note";

/** Optional fields a caller may supply when creating a note. */
export type CreateNoteInput = {
  title?: string;
  contentJson?: JSONContent;
};

/**
 * Create a note owned by `userId` and return it (SPEC §12 create flow).
 *
 * App-generated UUID id, ISO timestamps (created_at === updated_at on insert),
 * `is_public = 0` / no `public_slug` (private until shared). Defaults: title ->
 * "Untitled note", content -> an empty TipTap doc. Content is stored as a JSON
 * string (never raw HTML — SPEC §5.3); the returned `Note` carries the parsed
 * object. The INSERT is parameterized and scoped to `user_id = userId`.
 */
export async function createNote(userId: string, data?: CreateNoteInput): Promise<Note> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = data?.title ?? DEFAULT_NOTE_TITLE;
  // Clone the shared (frozen) default so the returned note's content is mutable.
  const contentJson = data?.contentJson ?? structuredClone(EMPTY_TIPTAP_DOC);

  run(
    `INSERT INTO notes (id, user_id, title, content_json, is_public, public_slug, created_at, updated_at)
     VALUES ($id, $userId, $title, $contentJson, 0, NULL, $now, $now)`,
    {
      $id: id,
      $userId: userId,
      $title: title,
      $contentJson: JSON.stringify(contentJson),
      $now: now,
    },
  );

  return {
    id,
    userId,
    title,
    contentJson,
    isPublic: false,
    publicSlug: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Fetch a single note by id, scoped to its owner (SPEC §8 authorization).
 *
 * Ownership is enforced in the WHERE clause (`user_id = $userId`), so a note
 * that doesn't exist and a note owned by someone else are indistinguishable —
 * both return `null`. Callers translate that `null` into `notFound()` (404, not
 * 403) so the route never reveals whether an id exists (SPEC §8, §14.2).
 */
export function getNoteById(userId: string, noteId: string): Note | null {
  const row = get<NoteRow>("SELECT * FROM notes WHERE id = $id AND user_id = $userId", {
    $id: noteId,
    $userId: userId,
  });
  return row ? mapRowToNote(row) : null;
}

/**
 * List every note owned by `userId`, newest-edited first (SPEC §6, §11).
 *
 * Scoped to `user_id = $userId` so a user only ever sees their own notes, and
 * ordered by `updated_at DESC` to drive the dashboard listing.
 */
export function getNotesByUser(userId: string): Note[] {
  const rows = query<NoteRow>(
    "SELECT * FROM notes WHERE user_id = $userId ORDER BY updated_at DESC",
    { $userId: userId },
  );
  return rows.map(mapRowToNote);
}
