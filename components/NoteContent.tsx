import { Fragment, type ReactNode } from "react";

// Read-only renderer: stored ProseMirror/TipTap JSON => custom JSX elements.
// This is a server component (no client JS shipped). It is a SECOND consumer of
// the schema defined in lib/tiptap.ts, so the node/mark cases below must stay in
// sync with the editor's whitelist. Only whitelisted node/mark types emit an
// element; anything unrecognized is unwrapped (children rendered) or dropped, so
// a stray node can never inject markup. Text is plain React children — always
// escaped, never dangerouslySetInnerHTML (SPEC §10.3, §14.1).
//
// The input is treated as untrusted SHAPE: NoteContentSchema only validates the
// doc envelope, so nested nodes can be malformed (non-array content, null nodes,
// pathological depth). Every accessor below guards against that so a bad row
// degrades to empty output instead of a 500.

type Mark = { type?: string; attrs?: Record<string, unknown> };
type ProseNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: unknown;
  text?: unknown;
  marks?: unknown;
};

// Real editor content nests only a handful of levels (nested lists); anything
// past this is malformed/hostile. Truncate rather than overflow the React render
// stack (which blows far below the ~20k-depth write cap).
const MAX_DEPTH = 300;

function applyMarks(text: string, marks: unknown, keyBase: string): ReactNode {
  if (!Array.isArray(marks) || marks.length === 0) return text;
  // reduceRight so marks[0] is the OUTERMOST element, matching ProseMirror's
  // DOMSerializer (and thus what the live editor displays).
  return marks.reduceRight<ReactNode>((acc, raw, i) => {
    const mark = raw as Mark;
    const key = `${keyBase}-m${i}`;
    switch (mark?.type) {
      case "bold":
        return <strong key={key}>{acc}</strong>;
      case "italic":
        return <em key={key}>{acc}</em>;
      case "code":
        return <code key={key}>{acc}</code>;
      default:
        // Unknown/disabled mark: render the text unwrapped.
        return acc;
    }
  }, text);
}

function renderChildren(nodes: unknown, keyBase: string, depth: number): ReactNode {
  if (!Array.isArray(nodes)) return null;
  return nodes.map((node, i) => (
    <Fragment key={`${keyBase}-${i}`}>{renderNode(node, `${keyBase}-${i}`, depth)}</Fragment>
  ));
}

function renderNode(node: unknown, key: string, depth: number): ReactNode {
  if (depth > MAX_DEPTH) return null;
  if (!node || typeof node !== "object") return null;
  const n = node as ProseNode;
  const next = depth + 1;

  switch (n.type) {
    case "text":
      return applyMarks(typeof n.text === "string" ? n.text : "", n.marks, key);
    case "paragraph": {
      const kids = renderChildren(n.content, key, next);
      // Preserve intentional blank lines: an empty paragraph would otherwise
      // collapse to zero height under `prose`.
      const isEmpty = kids == null || (Array.isArray(kids) && kids.length === 0);
      return <p>{isEmpty ? <br /> : kids}</p>;
    }
    case "heading": {
      // TipTap/ProseMirror omits a node's `attrs` entirely when every attribute
      // is at its default, and the Heading default level is 1 — so a stored H1
      // has NO attrs.level. The editor reconstructs it as <h1> via that default;
      // mirror it here (missing/level 1 => h1) instead of falling through to h3,
      // or the two renderers disagree and every H1 shows as <h3> publicly.
      const level = n.attrs?.level;
      const Tag = level === 2 ? "h2" : level === 3 ? "h3" : "h1";
      return <Tag>{renderChildren(n.content, key, next)}</Tag>;
    }
    case "bulletList":
      return <ul>{renderChildren(n.content, key, next)}</ul>;
    case "listItem":
      return <li>{renderChildren(n.content, key, next)}</li>;
    case "codeBlock":
      return (
        <pre>
          <code>{renderChildren(n.content, key, next)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr />;
    case "hardBreak":
      return <br />;
    default:
      // Unknown/disabled node: drop the wrapper but keep any children, so the
      // renderer degrades gracefully instead of emitting an unwhitelisted tag.
      return Array.isArray(n.content) ? renderChildren(n.content, key, next) : null;
  }
}

export function NoteContent({ content }: { content: unknown }) {
  return <div className="prose dark:prose-invert max-w-none">{renderNode(content, "root", 0)}</div>;
}
