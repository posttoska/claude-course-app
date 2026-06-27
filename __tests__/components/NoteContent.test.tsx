import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { NoteContent } from "@/components/NoteContent";

afterEach(cleanup);

// Render a TipTap doc and hand back the container DOM node for querying.
function renderDoc(content: unknown): HTMLElement {
  return render(<NoteContent content={content} />).container;
}

function doc(...nodes: unknown[]) {
  return { type: "doc", content: nodes };
}

describe("NoteContent — headings", () => {
  // Regression: TipTap omits `attrs` when every attribute is at its default, and
  // the Heading default level is 1, so a stored H1 carries no attrs.level. The
  // editor reconstructs it as <h1>; this renderer must match (not fall to <h3>).
  it("renders a heading with no attrs (default level 1) as <h1>", () => {
    const c = renderDoc(doc({ type: "heading", content: [{ type: "text", text: "Title" }] }));
    expect(c.querySelector("h1")?.textContent).toBe("Title");
    expect(c.querySelector("h3")).toBeNull();
  });

  it("maps explicit levels 1/2/3 to h1/h2/h3 and unknown levels to h1", () => {
    const c = renderDoc(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "a" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "b" }] },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "c" }] },
        { type: "heading", attrs: { level: 6 }, content: [{ type: "text", text: "d" }] },
      ),
    );
    expect(c.querySelector("h1")?.textContent).toBe("a");
    expect(c.querySelector("h2")?.textContent).toBe("b");
    expect(c.querySelector("h3")?.textContent).toBe("c");
    expect([...c.querySelectorAll("h1")].map((e) => e.textContent)).toContain("d");
  });
});

describe("NoteContent — marks", () => {
  it("renders bold, italic, and inline code marks", () => {
    const c = renderDoc(
      doc({
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "b" },
          { type: "text", marks: [{ type: "italic" }], text: "i" },
          { type: "text", marks: [{ type: "code" }], text: "c" },
        ],
      }),
    );
    expect(c.querySelector("strong")?.textContent).toBe("b");
    expect(c.querySelector("em")?.textContent).toBe("i");
    expect(c.querySelector("code")?.textContent).toBe("c");
  });

  it("nests stacked marks with the first mark outermost", () => {
    const c = renderDoc(
      doc({
        type: "paragraph",
        content: [{ type: "text", marks: [{ type: "bold" }, { type: "italic" }], text: "x" }],
      }),
    );
    expect(c.querySelector("strong > em")?.textContent).toBe("x");
  });

  it("renders text with an unknown/disabled mark unwrapped", () => {
    const c = renderDoc(
      doc({
        type: "paragraph",
        content: [{ type: "text", marks: [{ type: "strike" }], text: "plain" }],
      }),
    );
    expect(c.querySelector("s, del, strike")).toBeNull();
    expect(c.querySelector("p")?.textContent).toBe("plain");
  });
});

describe("NoteContent — blocks", () => {
  it("renders bullet lists, code blocks, and horizontal rules", () => {
    const c = renderDoc(
      doc(
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }],
            },
          ],
        },
        { type: "codeBlock", content: [{ type: "text", text: "code();" }] },
        { type: "horizontalRule" },
      ),
    );
    expect(c.querySelector("ul li")?.textContent).toBe("item");
    expect(c.querySelector("pre code")?.textContent).toBe("code();");
    expect(c.querySelector("hr")).not.toBeNull();
  });

  it("renders an empty paragraph as a <br> so the blank line is preserved", () => {
    const c = renderDoc(doc({ type: "paragraph" }));
    expect(c.querySelector("p > br")).not.toBeNull();
  });

  it("drops an unknown/disabled node type but keeps its children", () => {
    const c = renderDoc(
      doc({
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "kept" }] }],
      }),
    );
    expect(c.querySelector("blockquote")).toBeNull();
    expect(c.textContent).toContain("kept");
  });
});

describe("NoteContent — security & resilience", () => {
  it("escapes HTML in text instead of injecting markup", () => {
    const c = renderDoc(
      doc({ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }),
    );
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("p")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("degrades gracefully on malformed shape (non-array content, null/garbage nodes)", () => {
    expect(() => renderDoc({ type: "doc", content: "nope" })).not.toThrow();
    const c = renderDoc({
      type: "doc",
      content: [
        null,
        undefined,
        42,
        { type: "paragraph", content: [{ type: "text", text: "ok" }] },
      ],
    });
    expect(c.textContent).toContain("ok");
  });

  it("caps recursion depth on pathologically nested content", () => {
    let node: unknown = { type: "text", text: "deep" };
    for (let i = 0; i < 400; i++) {
      node = { type: "bulletList", content: [{ type: "listItem", content: [node] }] };
    }
    expect(() => renderDoc({ type: "doc", content: [node] })).not.toThrow();
  });
});
