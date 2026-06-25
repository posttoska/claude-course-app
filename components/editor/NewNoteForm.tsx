"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import { extensions } from "@/lib/tiptap";
import { EMPTY_DOC } from "@/lib/validation";
import { createNote } from "@/actions/notes";
import { Toolbar } from "@/components/editor/Toolbar";

function SubmitButton() {
  // useFormStatus reads the enclosing <form>'s pending state (modern Next.js).
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create note"}
    </button>
  );
}

export function NewNoteForm() {
  // Mirror of the editor's JSON, carried to the server action via a hidden field.
  const [content, setContent] = useState(() => JSON.stringify(EMPTY_DOC));

  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    immediatelyRender: false, // REQUIRED under Next.js SSR (SPEC §9.2)
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert max-w-none min-h-[40vh] rounded-md border border-black/10 p-4 focus:outline-none focus:ring-2 focus:ring-foreground/15 dark:border-white/10",
        "aria-label": "Note content",
      },
    },
    onUpdate: ({ editor }) => setContent(JSON.stringify(editor.getJSON())),
  });

  if (!editor) return null;

  return (
    <form action={createNote} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="Untitled note"
          maxLength={200}
          autoComplete="off"
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Content</span>
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
        {/* The editor's TipTap JSON rides along as a hidden field. */}
        <input type="hidden" name="content" value={content} readOnly />
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link
          href="/dashboard"
          className="text-sm text-foreground/60 underline-offset-4 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
