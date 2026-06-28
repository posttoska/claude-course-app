"use server";

// Server Actions for note mutations (SPEC §12). Every action follows the same
// guard order: session -> ownership -> Zod validation -> SQL -> revalidatePath.
//
// Actions return a serializable `ActionResult` so client callers can react to an
// auth or validation failure, rather than the action throwing across the
// server/client boundary. The session check here is authoritative (SPEC §7.5).

import { revalidatePath } from "next/cache";
import type { JSONContent } from "@tiptap/core";
import { getSession } from "@/lib/auth";
import {
  createNote,
  deleteNote,
  getNoteById,
  setNotePublic,
  updateNote,
  type CreateNoteInput,
  type Note,
  type UpdateNoteInput,
} from "@/lib/notes";
import { CreateNoteSchema, UpdateNoteSchema } from "@/lib/validation";

/** Standard mutation result: either the produced data or a human-readable error. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Create a note owned by the signed-in user and return it (SPEC §12 create flow).
 *
 * Guard order: session -> (create has no ownership step) -> Zod validation (only
 * when input is supplied) -> SQL -> revalidate the dashboard listing. An
 * unauthenticated caller gets an error result instead of a thrown redirect, so
 * the client form decides how to recover. With no input, the repository applies
 * its defaults ("Untitled note" + an empty TipTap doc).
 */
export async function createNoteAction(input?: {
  title?: string;
  contentJson?: unknown;
}): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to create a note." };
  }

  let data: CreateNoteInput | undefined;
  if (input !== undefined) {
    const parsed = CreateNoteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Invalid note data." };
    }
    data = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.contentJson !== undefined) {
      data.contentJson = parsed.data.contentJson as JSONContent;
    }
  }

  const note = await createNote(session.user.id, data);
  revalidatePath("/dashboard");
  return { ok: true, data: note };
}

/**
 * Apply a partial update (title and/or content) to a note the caller owns and
 * return the updated note (SPEC §12 update flow).
 *
 * Guard order: session -> ownership -> Zod validation -> SQL -> revalidate.
 * Ownership is re-checked server-side (SPEC §8, §14.2): a missing or
 * someone-else's note is indistinguishable — both yield "Note not found.",
 * never revealing whether the id exists. `title` may be `null` to clear it; an
 * omitted field is left untouched. The dashboard list and the note page are both
 * revalidated so the new title/timestamp/content show up.
 */
export async function updateNoteAction(
  noteId: string,
  input: { title?: string | null; contentJson?: unknown },
): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to update a note." };
  }

  // Ownership: re-check before validating or writing. `getNoteById` is scoped to
  // the owner, so a non-owned/missing note returns null without leaking existence.
  if (!getNoteById(session.user.id, noteId)) {
    return { ok: false, error: "Note not found." };
  }

  const parsed = UpdateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid note data." };
  }

  const data: UpdateNoteInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.contentJson !== undefined) {
    data.contentJson = parsed.data.contentJson as JSONContent;
  }

  const note = updateNote(session.user.id, noteId, data);
  if (!note) {
    // Lost the row between the ownership check and the write (e.g. concurrent
    // delete) — still report "not found" rather than revealing what happened.
    return { ok: false, error: "Note not found." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/notes/${noteId}`);
  return { ok: true, data: note };
}

/**
 * Delete a note the caller owns and return its id (SPEC §12 delete flow).
 *
 * Guard order: session -> ownership+SQL (atomic) -> revalidate. `deleteNote`
 * enforces ownership in its WHERE clause and reports whether a row was actually
 * removed, so the ownership check and the delete are a single atomic step (no
 * TOCTOU window — unlike updateNoteAction, there's nothing to validate between a
 * separate check and the write). A missing or someone-else's note removes 0 rows
 * and yields "Note not found.", never revealing whether the id exists (SPEC §8,
 * §14.2, 404-not-403). The dashboard list and the (now-gone) note page are both
 * revalidated so stale caches are purged after deletion.
 */
export async function deleteNoteAction(noteId: string): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to delete a note." };
  }

  if (!deleteNote(session.user.id, noteId)) {
    return { ok: false, error: "Note not found." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/notes/${noteId}`);
  return { ok: true, data: { id: noteId } };
}

/**
 * Toggle a note's public sharing and return the updated note, including its
 * `publicSlug` (SPEC §10.2 share/unshare flows, §12).
 *
 * Guard order: session -> validate the flag -> ownership+SQL (atomic) ->
 * revalidate. Like `deleteNoteAction`, `setNotePublic` enforces ownership in its
 * own owner-scoped read/write and returns null for a missing or someone-else's
 * note, so the ownership check and the toggle are a single atomic step (no TOCTOU
 * window — there's nothing to validate between a separate check and the write).
 * A non-owned/missing note yields "Note not found.", never revealing whether the
 * id exists (SPEC §8, §14.2, 404-not-403). On enable a `public_slug` is minted
 * (reused on re-share); on disable the slug is kept but `is_public` flips to 0 so
 * old links 404 (SPEC §10.2). An unauthenticated caller gets an error result
 * instead of a thrown redirect, consistent with the other actions.
 *
 * Revalidates the dashboard (share status in the list), the note page (its share
 * controls), and — when a slug exists — the public page so its cache reflects the
 * new visibility (newly shared note appears; unshared note 404s).
 */
export async function toggleShareAction(
  noteId: string,
  isPublic: boolean,
): Promise<ActionResult<Note>> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to share a note." };
  }

  // The flag crosses the client boundary, so don't trust its runtime type.
  if (typeof isPublic !== "boolean") {
    return { ok: false, error: "Invalid share state." };
  }

  const note = setNotePublic(session.user.id, noteId, isPublic);
  if (!note) {
    return { ok: false, error: "Note not found." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/notes/${noteId}`);
  if (note.publicSlug) {
    revalidatePath(`/p/${note.publicSlug}`);
  }
  return { ok: true, data: note };
}
