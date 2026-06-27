import { describe, it, expect } from "vitest";
import {
  EMPTY_DOC,
  MAX_CONTENT_BYTES,
  MAX_TITLE_LENGTH,
  NoteContentSchema,
  normalizeTitle,
  parseNoteContent,
  serializeContent,
} from "@/lib/validation";

describe("normalizeTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTitle("  Hi  ")).toBe("Hi");
  });

  it("normalizes empty / whitespace-only / nullish titles to null", () => {
    expect(normalizeTitle("")).toBeNull();
    expect(normalizeTitle("   ")).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle(undefined)).toBeNull();
  });

  it("accepts a title exactly at the length cap", () => {
    const max = "a".repeat(MAX_TITLE_LENGTH);
    expect(normalizeTitle(max)).toBe(max);
  });

  it("throws for a title over the length cap", () => {
    expect(() => normalizeTitle("a".repeat(MAX_TITLE_LENGTH + 1))).toThrow();
  });

  it("throws for a non-string title", () => {
    expect(() => normalizeTitle(123)).toThrow();
  });
});

describe("parseNoteContent", () => {
  it("returns the parsed doc for valid stored JSON", () => {
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    expect(parseNoteContent(JSON.stringify(doc))).toEqual(doc);
  });

  it("preserves nested attrs (returns the original object, not a zod-stripped one)", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [] }] };
    expect(parseNoteContent(JSON.stringify(doc))).toEqual(doc);
  });

  it("falls back to EMPTY_DOC for malformed JSON", () => {
    expect(parseNoteContent("{not json")).toEqual(EMPTY_DOC);
  });

  it("falls back to EMPTY_DOC for the literal JSON null (JSON.parse does not throw)", () => {
    expect(parseNoteContent("null")).toEqual(EMPTY_DOC);
  });

  it("falls back to EMPTY_DOC for a non-doc envelope", () => {
    expect(parseNoteContent(JSON.stringify({ type: "paragraph" }))).toEqual(EMPTY_DOC);
    expect(parseNoteContent(JSON.stringify({ type: "doc", content: "x" }))).toEqual(EMPTY_DOC);
  });
});

describe("serializeContent", () => {
  it("serializes a valid doc verbatim (no silent drops)", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 3 }, content: [] }] };
    expect(serializeContent(doc)).toBe(JSON.stringify(doc));
  });

  it("throws on an invalid doc envelope", () => {
    expect(() => serializeContent({ type: "paragraph" })).toThrow();
    expect(() => serializeContent(null)).toThrow();
  });

  it("throws CONTENT_TOO_LARGE for an oversized payload", () => {
    const huge = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a".repeat(MAX_CONTENT_BYTES + 10) }],
        },
      ],
    };
    expect(() => serializeContent(huge)).toThrow("CONTENT_TOO_LARGE");
  });
});

describe("NoteContentSchema", () => {
  it("accepts a doc envelope and rejects non-docs", () => {
    expect(NoteContentSchema.safeParse({ type: "doc", content: [] }).success).toBe(true);
    expect(NoteContentSchema.safeParse({ type: "para", content: [] }).success).toBe(false);
    expect(NoteContentSchema.safeParse({ type: "doc" }).success).toBe(false);
  });
});
