"use client";

// NoteEditor — the client-side TipTap rich-text editor for a single note
// (SPEC §9.2). The /notes/[id] Server Component does the auth + ownership + 404
// work and hands the already-fetched `note` here as initial data; this component
// owns only the in-browser editing surface.
//
// SCOPE (this prd task): mount the editor, initialise it with the note's stored
// content, and track edits. The toolbar, title input, and save/delete/share wiring
// are later prd tasks that extend this same component — the editor instance and the
// tracked content below are what they build on.

import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { extensions } from "@/lib/tiptap";
import type { Note } from "@/lib/notes";

export function NoteEditor({
  note,
  onChange,
}: {
  note: Note;
  /** Optional callback fired with the latest doc on every edit. */
  onChange?: (content: JSONContent) => void;
}) {
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

  // useEditor returns null on the first render under SSR (immediatelyRender:false).
  if (!editor) return null;

  return (
    <div className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      {/* Toolbar (next prd task) mounts here, above the editable content. */}
      <EditorContent editor={editor} />
    </div>
  );
}
