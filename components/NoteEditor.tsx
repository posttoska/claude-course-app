"use client";

// NoteEditor — the client-side TipTap rich-text editor for a single note
// (SPEC §9.2). The /notes/[id] Server Component does the auth + ownership + 404
// work and hands the already-fetched `note` here as initial data; this component
// owns only the in-browser editing surface.
//
// SCOPE (this prd task): mount the editor, initialise it with the note's stored
// content, track edits, AND expose a controlled title input. The toolbar and
// save/delete/share wiring are later prd tasks that extend this same component —
// the editor instance, the tracked content, and the title state below are what
// they build on.

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { extensions } from "@/lib/tiptap";
import type { Note } from "@/lib/notes";

// Mirror TitleSchema's cap (lib/validation.ts, SPEC §13) so the input can't
// produce a title the save action would reject.
const TITLE_MAX_LENGTH = 200;

export function NoteEditor({
  note,
  onChange,
  onTitleChange,
}: {
  note: Note;
  /** Optional callback fired with the latest doc on every edit. */
  onChange?: (content: JSONContent) => void;
  /** Optional callback fired with the latest title on every keystroke. */
  onTitleChange?: (title: string) => void;
}) {
  // Controlled title state, initialised from the stored title (null → empty so the
  // input stays controlled and the placeholder shows). The save task reads this.
  const [title, setTitle] = useState(note.title ?? "");

  // Latest editor content, refreshed on every change. The save task reads this to
  // persist without re-querying the editor; a ref avoids re-rendering on keystroke.
  const contentRef = useRef<JSONContent>(note.contentJson);

  const editor = useEditor({
    extensions,
    content: note.contentJson, // initialise with the note's stored TipTap JSON
    immediatelyRender: false, // REQUIRED under SSR/Next.js to avoid hydration mismatch (SPEC §9.2)
    editorProps: {
      attributes: {
        class: "prose dark:prose-invert max-w-none min-h-[60vh] focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getJSON();
      contentRef.current = content;
      onChange?.(content);
    },
  });

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setTitle(next);
    onTitleChange?.(next);
  }

  // useEditor returns null on the first render under SSR (immediatelyRender:false).
  if (!editor) return null;

  return (
    <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      <input
        type="text"
        value={title}
        onChange={handleTitleChange}
        maxLength={TITLE_MAX_LENGTH}
        placeholder="Untitled note"
        aria-label="Note title"
        className="mb-2 w-full bg-transparent text-2xl font-semibold tracking-tight placeholder:text-foreground/40 focus:outline-none"
      />
      {/* Toolbar (next prd task) mounts here, above the editable content. */}
      <EditorContent editor={editor} />
    </div>
  );
}
