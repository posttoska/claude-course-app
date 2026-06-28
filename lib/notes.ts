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
import { get, query, run, type QueryParams } from "./db";

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

/** Fields a caller may patch on an existing note. `undefined` leaves a field untouched. */
export type UpdateNoteInput = {
  title?: string | null;
  contentJson?: JSONContent;
};

/**
 * Apply a partial update to a note owned by `userId`, returning the updated
 * `Note` (or `null` if no owned note matches — SPEC §8 authorization).
 *
 * Only the fields present in `data` are written; `updated_at` is always bumped
 * to now. Ownership is enforced in the WHERE clause (`user_id = $userId`), so a
 * missing or someone-else's note simply updates 0 rows and resolves to `null`
 * via the re-read — never revealing existence (SPEC §14.2). Content is stored as
 * a JSON string (never raw HTML — SPEC §5.3).
 *
 * The SET clause is assembled from a fixed set of column assignments (no user
 * input is ever interpolated); every value is still bound via `$name` params.
 */
export function updateNote(userId: string, noteId: string, data: UpdateNoteInput): Note | null {
  const assignments: string[] = [];
  const params: QueryParams = { $id: noteId, $userId: userId };

  if (data.title !== undefined) {
    assignments.push("title = $title");
    params.$title = data.title;
  }
  if (data.contentJson !== undefined) {
    assignments.push("content_json = $contentJson");
    params.$contentJson = JSON.stringify(data.contentJson);
  }

  // Always refresh updated_at so the dashboard ordering reflects the edit.
  assignments.push("updated_at = $now");
  params.$now = new Date().toISOString();

  run(`UPDATE notes SET ${assignments.join(", ")} WHERE id = $id AND user_id = $userId`, params);

  // Re-read so the returned Note reflects the persisted row (and is null when
  // the WHERE matched nothing — not found or not owned).
  return getNoteById(userId, noteId);
}

/**
 * Delete a note owned by `userId`, returning whether a row was removed (SPEC §8,
 * §12 delete flow).
 *
 * Ownership is enforced in the WHERE clause (`user_id = $userId`), so deleting a
 * missing or someone-else's note simply affects 0 rows and returns `false` — it
 * never reveals whether the id exists (the 404-not-403 story, SPEC §14.2). The
 * DELETE is parameterized ($name binds).
 */
export function deleteNote(userId: string, noteId: string): boolean {
  const { changes } = run("DELETE FROM notes WHERE id = $id AND user_id = $userId", {
    $id: noteId,
    $userId: userId,
  });
  return changes > 0;
}

/**
 * Toggle a note's public sharing, returning the updated `Note` (or `null` if no
 * owned note matches — SPEC §8, §10.2 share/unshare flows).
 *
 * Ownership is enforced up front via `getNoteById` (scoped to `user_id`), so a
 * missing or someone-else's note resolves to `null` without revealing existence
 * (SPEC §14.2).
 *
 * - **Enable:** mint a `public_slug` only if the note doesn't already have one,
 *   so re-sharing reuses the same link; set `is_public = 1`.
 * - **Disable:** set `is_public = 0` but **KEEP** the slug. This follows SPEC
 *   §10.2 (re-share yields the same URL) and the CLAUDE.md invariant that public
 *   access is gated *solely* on `is_public = 1` — `getNoteByPublicSlug` requires
 *   it, so old links 404 while unshared. NOTE: this intentionally deviates from
 *   the prd step "clear public_slug when disabling"; SPEC is authoritative
 *   (CLAUDE.md) and a future iter shouldn't "fix" it back to clearing the slug.
 */
export function setNotePublic(userId: string, noteId: string, isPublic: boolean): Note | null {
  const existing = getNoteById(userId, noteId);
  if (!existing) return null;

  // Reuse an existing slug; only mint a new one when first enabling sharing.
  const publicSlug = isPublic ? (existing.publicSlug ?? generatePublicSlug()) : existing.publicSlug;

  run(
    `UPDATE notes SET is_public = $isPublic, public_slug = $publicSlug, updated_at = $now
     WHERE id = $id AND user_id = $userId`,
    {
      $isPublic: isPublic ? 1 : 0,
      $publicSlug: publicSlug,
      $now: new Date().toISOString(),
      $id: noteId,
      $userId: userId,
    },
  );

  // Re-read so the returned Note mirrors the persisted row.
  return getNoteById(userId, noteId);
}

/**
 * Fetch a publicly shared note by its high-entropy share token (SPEC §10.3,
 * public read-only route). No `userId` — this is the unauthenticated path.
 *
 * Gated *solely* on `is_public = 1` (CLAUDE.md invariant): an unshared note,
 * even one that still carries a slug from a prior share, returns `null` so the
 * route 404s. Lookup is by `public_slug` (the share token), never the internal
 * `id`, which is never exposed on public routes (SPEC §10.1, §14.5).
 */
export function getNoteByPublicSlug(slug: string): Note | null {
  const row = get<NoteRow>("SELECT * FROM notes WHERE public_slug = $slug AND is_public = 1", {
    $slug: slug,
  });
  return row ? mapRowToNote(row) : null;
}
