"use client";

import { useEditorState, type Editor } from "@tiptap/react";

// Toolbar reflects the editor's active marks/nodes. In TipTap v3 `useEditor`
// does not re-render on every transaction, so we subscribe to just the state we
// render via `useEditorState` (re-renders only when one of these booleans flips).
export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor?.isActive("bold") ?? false,
      isItalic: editor?.isActive("italic") ?? false,
      isCode: editor?.isActive("code") ?? false,
      isCodeBlock: editor?.isActive("codeBlock") ?? false,
      isBulletList: editor?.isActive("bulletList") ?? false,
      isParagraph: editor?.isActive("paragraph") ?? false,
      isH1: editor?.isActive("heading", { level: 1 }) ?? false,
      isH2: editor?.isActive("heading", { level: 2 }) ?? false,
      isH3: editor?.isActive("heading", { level: 3 }) ?? false,
    }),
  });

  const toggles: { label: string; title: string; active: boolean; run: () => void }[] = [
    { label: "B", title: "Bold", active: state.isBold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "I", title: "Italic", active: state.isItalic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "H1", title: "Heading 1", active: state.isH1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", title: "Heading 2", active: state.isH2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "H3", title: "Heading 3", active: state.isH3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "¶", title: "Paragraph", active: state.isParagraph, run: () => editor.chain().focus().setParagraph().run() },
    { label: "</>", title: "Inline code", active: state.isCode, run: () => editor.chain().focus().toggleCode().run() },
    { label: "Code block", title: "Code block", active: state.isCodeBlock, run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: "• List", title: "Bullet list", active: state.isBulletList, run: () => editor.chain().focus().toggleBulletList().run() },
  ];

  const btnClass = (active: boolean) =>
    `rounded px-2 py-1 text-sm leading-none transition hover:bg-black/5 dark:hover:bg-white/10 ${
      active ? "bg-black/10 font-semibold dark:bg-white/15" : ""
    }`;

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center gap-1 border-b border-black/10 pb-2 dark:border-white/10"
    >
      {toggles.map((t) => (
        <button
          key={t.title}
          type="button"
          title={t.title}
          aria-label={t.title}
          aria-pressed={t.active}
          onClick={t.run}
          className={btnClass(t.active)}
        >
          {t.label}
        </button>
      ))}
      <button
        type="button"
        title="Horizontal rule"
        aria-label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btnClass(false)}
      >
        —
      </button>
    </div>
  );
}
