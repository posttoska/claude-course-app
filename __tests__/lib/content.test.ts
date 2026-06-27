import { describe, it, expect } from "vitest";
import { FALLBACK_TITLE, firstText, noteLabel } from "@/lib/content";

// Build a stored-content string of paragraphs from plain text lines.
function docOf(...lines: string[]): string {
  return JSON.stringify({
    type: "doc",
    content: lines.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  });
}

const EMPTY_PARA_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

describe("noteLabel", () => {
  it("uses an explicit title, trimmed", () => {
    expect(noteLabel({ title: "  My Note  ", content: docOf("body") })).toBe("My Note");
  });

  it("derives from the first non-empty text when there is no title", () => {
    expect(noteLabel({ title: null, content: docOf("First line", "second") })).toBe("First line");
  });

  it("skips whitespace-only text nodes when deriving", () => {
    expect(noteLabel({ title: null, content: docOf("   ", "real text") })).toBe("real text");
  });

  it("falls back when an empty-string title meets empty content", () => {
    expect(noteLabel({ title: "", content: EMPTY_PARA_DOC })).toBe(FALLBACK_TITLE);
  });

  it("falls back when content has no text", () => {
    expect(noteLabel({ title: null, content: EMPTY_PARA_DOC })).toBe(FALLBACK_TITLE);
  });

  it("falls back when content is malformed JSON", () => {
    expect(noteLabel({ title: null, content: "{broken" })).toBe(FALLBACK_TITLE);
  });

  it("truncates a long derived label to 80 code points + ellipsis", () => {
    const label = noteLabel({ title: null, content: docOf("a".repeat(200)) });
    expect(label.endsWith("…")).toBe(true);
    expect([...label].length).toBe(81); // 80 chars + the ellipsis
  });

  it("truncates over code points without splitting astral characters (emoji)", () => {
    const label = noteLabel({ title: null, content: docOf("😀".repeat(100)) });
    expect(label.endsWith("…")).toBe(true);
    // 80 whole emoji + ellipsis — never a lone surrogate half.
    expect([...label].filter((ch) => ch === "😀").length).toBe(80);
  });
});

describe("firstText", () => {
  it("finds text nested a few levels down", () => {
    const node = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "nested" }] }],
            },
          ],
        },
      ],
    };
    expect(firstText(node)).toBe("nested");
  });

  it("returns null past the depth cap instead of overflowing the stack", () => {
    let node: unknown = { type: "text", text: "deep" };
    for (let i = 0; i < 400; i++) node = { type: "wrap", content: [node] };
    expect(firstText(node)).toBeNull();
  });
});
