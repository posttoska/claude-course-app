"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { extensions } from "@/lib/tiptap";
import { deleteNote, updateNote } from "@/actions/notes";
import { Toolbar } from "@/components/editor/Toolbar";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NoteEditor({
  noteId,
  initialTitle,
  initialContent,
}: {
  noteId: string;
  initialTitle: string;
  initialContent: JSONContent;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false, // REQUIRED under Next.js SSR (SPEC §9.2)
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert max-w-none min-h-[50vh] rounded-md border border-black/10 p-4 focus:outline-none focus:ring-2 focus:ring-foreground/15 dark:border-white/10",
        "aria-label": "Note content",
      },
    },
    onUpdate: () => {
      setDirty(true);
      setStatus("idle");
    },
  });

  const markDirty = useCallback(() => {
    setDirty(true);
    setStatus("idle");
  }, []);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setStatus("saving");
    const result = await updateNote(noteId, {
      title,
      content: editor.getJSON(),
    });
    if (result.ok) {
      setDirty(false);
      setStatus("saved");
      router.refresh(); // refresh the dashboard list (updated_at / label)
    } else {
      setStatus("error");
    }
  }, [editor, noteId, title, router]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteNote(noteId);
      router.push("/dashboard");
    } catch {
      // Recover the UI instead of hanging on "Deleting…".
      setDeleting(false);
      setDeleteError("Could not delete the note. Please try again.");
    }
  }, [noteId, router]);

  if (!editor) return null;

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "error"
        ? "Save failed — try again."
        : dirty
          ? "Unsaved changes"
          : status === "saved"
            ? "Saved"
            : "";

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          markDirty();
        }}
        placeholder="Untitled note"
        aria-label="Note title"
        maxLength={200}
        className="w-full rounded-md bg-transparent text-2xl font-semibold outline-none placeholder:text-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/15"
      />

      <Toolbar editor={editor} />
      <EditorContent editor={editor} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || status === "saving"}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          <span
            role="status"
            aria-live="polite"
            className={`text-xs ${
              status === "error" ? "text-red-600 dark:text-red-400" : "text-foreground/50"
            }`}
          >
            {statusText}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-500/40 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          {deleteError && (
            <span role="alert" className="text-xs text-red-600 dark:text-red-400">
              {deleteError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
