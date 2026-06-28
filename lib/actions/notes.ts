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
import { createNote, type CreateNoteInput, type Note } from "@/lib/notes";
import { CreateNoteSchema } from "@/lib/validation";

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
