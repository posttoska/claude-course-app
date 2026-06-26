"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { extensions } from "@/lib/tiptap";
import { updateNote } from "@/actions/notes";
import { Toolbar } from "@/components/editor/Toolbar";
import { ShareControl } from "@/components/ShareControl";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NoteEditor({
  noteId,
  initialTitle,
  initialContent,
  initialIsPublic,
  initialPublicId,
}: {
  noteId: string;
  initialTitle: string;
  initialContent: JSONContent;
  initialIsPublic: boolean;
  initialPublicId: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");

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

  // Warn before a hard navigation (reload/close/external link) drops unsaved
  // edits. In-app navigation away from the editor is guarded per-link instead.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
      // Re-sync THIS edit route's server data after save; /dashboard and the
      // /notes/[id] view are freshened by revalidatePath() inside updateNote.
      router.refresh();
    } else {
      setStatus("error");
    }
  }, [editor, noteId, title, router]);

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
        <Link
          href={`/notes/${noteId}`}
          onClick={(e) => {
            if (dirty && !window.confirm("Discard unsaved changes?")) {
              e.preventDefault();
            }
          }}
          className="text-xs text-foreground/60 transition hover:opacity-70"
        >
          Back to note
        </Link>
      </div>

      <ShareControl
        noteId={noteId}
        initialIsPublic={initialIsPublic}
        initialPublicId={initialPublicId}
      />
    </div>
  );
}
