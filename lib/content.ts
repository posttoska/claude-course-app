// Pure, DB-free helpers for turning a note's stored content into a display
// label. Deliberately kept OUT of lib/notes.ts (which opens `bun:sqlite` and so
// can't be imported outside the Bun runtime) so this logic is unit-testable
// under plain Vitest. lib/notes.ts re-exports `noteLabel`/`FALLBACK_TITLE` from
// here, so existing `@/lib/notes` imports are unaffected.

const MAX_DERIVED_TITLE = 80;
export const FALLBACK_TITLE = "Untitled note";

// First non-empty text node in a TipTap doc, depth-first. The depth cap turns a
// pathologically nested (malformed/hostile) doc into a graceful miss instead of
// a stack overflow.
export function firstText(node: unknown, depth = 0): string | null {
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
export function noteLabel(note: { title: string | null; content: string }): string {
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
