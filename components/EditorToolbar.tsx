"use client";

// EditorToolbar — formatting controls for the NoteEditor's TipTap instance
// (SPEC §9.3). Each button issues a chained command and reflects the editor's
// current active state. Whitelist (matches the lib/tiptap extension set): Bold,
// Italic, H1–H3, Paragraph (resets the current block to normal text), Inline
// code, Code block, Bullet list, and Horizontal rule.
//
// REACTIVITY (the crux): in @tiptap/react v3 the editor state is NOT
// auto-reactive — a deliberate perf choice — so a plain read of
// editor.isActive()/editor.can() would freeze on the initial state and the
// buttons would never highlight. We subscribe through the useEditorState hook,
// whose selector re-runs on every transaction and re-renders only when one of
// the selected values changes (TipTap docs: "Reacting to Editor state changes").

import type { ReactNode } from "react";
import { type Editor, useEditorState } from "@tiptap/react";

/** A single toolbar control: a toggle button that reflects active/disabled state. */
function ToolbarButton({
  label,
  onClick,
  isActive = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      aria-label={label}
      title={label}
      className={`min-w-8 rounded-md px-2.5 py-1 text-sm leading-5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        isActive
          ? "bg-foreground text-background"
          : "text-foreground/70 hover:bg-black/[.06] hover:text-foreground dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/** Thin vertical separator between toolbar groups. */
function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-black/10 dark:bg-white/15" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  // Select only the active/enabled flags the buttons render from, so the toolbar
  // re-renders on formatting changes but not on every keystroke of plain typing.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor.isActive("bold"),
      canBold: editor.can().chain().focus().toggleBold().run(),
      isItalic: editor.isActive("italic"),
      canItalic: editor.can().chain().focus().toggleItalic().run(),
      isH1: editor.isActive("heading", { level: 1 }),
      isH2: editor.isActive("heading", { level: 2 }),
      isH3: editor.isActive("heading", { level: 3 }),
      isParagraph: editor.isActive("paragraph"),
      isCode: editor.isActive("code"),
      canCode: editor.can().chain().focus().toggleCode().run(),
      isCodeBlock: editor.isActive("codeBlock"),
      canCodeBlock: editor.can().chain().focus().toggleCodeBlock().run(),
      isBulletList: editor.isActive("bulletList"),
      canBulletList: editor.can().chain().focus().toggleBulletList().run(),
      // Horizontal rule is an insert, not a toggle — no active state, just
      // whether it can be inserted at the current selection.
      canHorizontalRule: editor.can().chain().focus().setHorizontalRule().run(),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="mb-2 flex flex-wrap items-center gap-1 border-b border-black/10 pb-2 dark:border-white/15"
    >
      <ToolbarButton
        label="Bold"
        isActive={state.isBold}
        disabled={!state.canBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        isActive={state.isItalic}
        disabled={!state.canItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Heading 1"
        isActive={state.isH1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        isActive={state.isH2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        isActive={state.isH3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Paragraph"
        isActive={state.isParagraph}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        ¶
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Inline code"
        isActive={state.isCode}
        disabled={!state.canCode}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-xs">{"</>"}</span>
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        isActive={state.isCodeBlock}
        disabled={!state.canCodeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <span className="font-mono text-xs">{"{ }"}</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        label="Bullet list"
        isActive={state.isBulletList}
        disabled={!state.canBulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span className="leading-none tracking-tighter">•≡</span>
      </ToolbarButton>
      <ToolbarButton
        label="Horizontal rule"
        disabled={!state.canHorizontalRule}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </ToolbarButton>
    </div>
  );
}
