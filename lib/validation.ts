import { z } from "zod";

// Hard caps for note input (SPEC §13). Validated on the server for every
// mutation — never trust the client.
export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_BYTES = 1_000_000; // ~1 MB of serialized JSON

// Optional title: trimmed, length-capped, and normalized so an empty string
// becomes `null` (we derive a display label from the content instead — §5.4).
export const TitleSchema = z
  .string()
  .trim()
  .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`)
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

// Minimal top-level shape check for a TipTap/ProseMirror document. The editor's
// whitelisted extensions (lib/tiptap.ts) constrain which nodes/marks can appear;
// here we only assert the document envelope (SPEC §9.1, §13).
export const NoteContentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()),
});

// The document a brand-new note starts with: a single empty paragraph.
export const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

// Validate + normalize a title input. Throws (ZodError) on an invalid type.
export function normalizeTitle(input: unknown): string | null {
  return TitleSchema.parse(input);
}

// Validate a TipTap document and return it serialized for storage. Throws on an
// invalid shape or an oversized payload. We serialize the ORIGINAL object (not
// Zod's parsed output) so nothing inside the doc is silently dropped.
export function serializeContent(input: unknown): string {
  NoteContentSchema.parse(input);
  const serialized = JSON.stringify(input);
  if (new TextEncoder().encode(serialized).length > MAX_CONTENT_BYTES) {
    throw new Error("CONTENT_TOO_LARGE");
  }
  return serialized;
}
