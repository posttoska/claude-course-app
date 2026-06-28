// Zod schemas + content checks for note mutations (SPEC §13). Every Server Action
// validates its input here before touching the DB — the client is never trusted.
//
// We don't deep-validate every ProseMirror node: the editor is constrained to a
// whitelist via lib/tiptap.ts, so an honest client can only emit allowed
// nodes/marks. As defense in depth we still require the doc *shape* (`type: "doc"`
// + a `content` array) and cap the serialized size to reject crafted or oversized
// payloads sent straight to an action.

import { z } from "zod";

/** Max title length, after trimming (SPEC §13). */
export const MAX_TITLE_LENGTH = 200;

/** Max serialized note-content size in bytes (~1 MB) to prevent oversized rows (SPEC §13). */
export const MAX_CONTENT_BYTES = 1_000_000;

/** Optional note title: trimmed and length-capped. Empty string is allowed (a label can be derived). */
export const TitleSchema = z.string().trim().max(MAX_TITLE_LENGTH);

/**
 * TipTap/ProseMirror document: an object with `type: "doc"` and a `content`
 * array. `looseObject` keeps any extra top-level keys (e.g. `attrs`) rather than
 * silently dropping them; individual node shapes aren't deep-checked here (the
 * editor whitelist does that — SPEC §9.1). The serialized size is capped.
 */
export const NoteContentSchema = z
  .looseObject({
    type: z.literal("doc"),
    content: z.array(z.unknown()),
  })
  .refine((doc) => new TextEncoder().encode(JSON.stringify(doc)).length <= MAX_CONTENT_BYTES, {
    message: "Note content is too large.",
  });

/** Input accepted by the create-note action — every field optional (SPEC §12). */
export const CreateNoteSchema = z.object({
  title: TitleSchema.optional(),
  contentJson: NoteContentSchema.optional(),
});

export type CreateNoteSchemaInput = z.infer<typeof CreateNoteSchema>;
