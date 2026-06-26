"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getOwnedNote } from "@/lib/notes";
import { EMPTY_DOC, normalizeTitle, serializeContent } from "@/lib/validation";

// Authoritative auth gate for every mutation (SPEC §8, §12). The middleware /
// layout are optimistic UX only — this is the real check.
async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user.id;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// Create a note from the "New Note" form (title + TipTap content) and return to
// the dashboard. Guard order per SPEC §12: session -> validate -> SQL -> revalidate.
export async function createNote(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  let title: string | null;
  let content: string;
  try {
    const rawTitle = formData.get("title");
    const rawContent = formData.get("content");
    title = normalizeTitle(typeof rawTitle === "string" ? rawTitle : null);
    const doc =
      typeof rawContent === "string" && rawContent.length > 0 ? JSON.parse(rawContent) : EMPTY_DOC;
    content = serializeContent(doc);
  } catch {
    throw new Error("INVALID_INPUT");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.query(
    `INSERT INTO notes (id, user_id, title, content, is_public, public_id, created_at, updated_at)
     VALUES ($id, $uid, $title, $content, 0, NULL, $now, $now)`,
  ).run({
    $id: id,
    $uid: userId,
    $title: title,
    $content: content,
    $now: now,
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Update a note's title + content. Returns a result object instead of throwing
// so the client editor can render save status cleanly.
export async function updateNote(
  id: string,
  input: { title?: string | null; content: unknown },
): Promise<ActionResult> {
  const userId = await requireUserId();

  // Ownership: 404-semantics — never confirm another user's note exists (§8, §14.2).
  if (!getOwnedNote(id, userId)) return { ok: false, error: "NOT_FOUND" };

  let title: string | null;
  let content: string;
  try {
    title = normalizeTitle(input.title);
    content = serializeContent(input.content);
  } catch {
    return { ok: false, error: "INVALID_INPUT" };
  }

  db.query(
    `UPDATE notes SET title = $title, content = $content, updated_at = $now
     WHERE id = $id AND user_id = $uid`,
  ).run({
    $title: title,
    $content: content,
    $now: new Date().toISOString(),
    $id: id,
    $uid: userId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/notes/${id}`);
  return { ok: true };
}

// Delete a note. Scoping the DELETE by user_id makes a non-owned id a silent
// no-op, so we never leak whether some other user's id exists.
export async function deleteNote(id: string): Promise<void> {
  const userId = await requireUserId();
  db.query("DELETE FROM notes WHERE id = $id AND user_id = $uid").run({
    $id: id,
    $uid: userId,
  });
  revalidatePath("/dashboard");
}

// Result of a sharing toggle. Returns the public id so the client can render the
// share link without a refetch.
export type ShareResult =
  | { ok: true; isPublic: boolean; publicId: string | null }
  | { ok: false; error: string };

// Turn public sharing on/off for an owned note (SPEC §8, §10, §14.2). Public
// access is gated SOLELY on is_public = 1 looked up by the high-entropy
// public_id, so flipping is_public to 0 makes the /share link 404 ("leads
// nowhere"). We KEEP the public_id when unsharing, so re-enabling sharing
// revives the SAME link (user's chosen semantics).
export async function setNoteSharing(id: string, makePublic: boolean): Promise<ShareResult> {
  const userId = await requireUserId();

  const note = getOwnedNote(id, userId);
  if (!note) return { ok: false, error: "NOT_FOUND" };

  // Generate a high-entropy public_id on first share; reuse it thereafter.
  const publicId = makePublic ? (note.public_id ?? crypto.randomUUID()) : note.public_id;

  db.query(
    `UPDATE notes SET is_public = $pub, public_id = $pid
     WHERE id = $id AND user_id = $uid`,
  ).run({
    $pub: makePublic ? 1 : 0,
    $pid: publicId,
    $id: id,
    $uid: userId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/notes/${id}`);
  revalidatePath(`/notes/${id}/edit`);
  if (publicId) revalidatePath(`/share/${publicId}`);

  return { ok: true, isPublic: makePublic, publicId: publicId ?? null };
}
