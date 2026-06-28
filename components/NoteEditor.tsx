"use client";

// NoteEditor — the client-side TipTap rich-text editor for a single note
// (SPEC §9.2). The /notes/[id] Server Component does the auth + ownership + 404
// work and hands the already-fetched `note` here as initial data; this component
// owns only the in-browser editing surface.
//
// SCOPE: mount the editor, a controlled title input, the toolbar, save the note's
// title + content through the updateNoteAction Server Action (debounced auto-save
// 1.5s after the last edit + an explicit "Save" button) with a live status
// indicator, AND delete the note — a Delete button opens a confirmation <dialog>,
// confirming calls deleteNoteAction and redirects to /dashboard. The auth +
// ownership re-checks + the SQL stay server-side in the actions; this component
// only drives the UX.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { extensions } from "@/lib/tiptap";
import { EditorToolbar } from "@/components/EditorToolbar";
import { useToast } from "@/components/Toast";
import { deleteNoteAction, updateNoteAction } from "@/lib/actions/notes";
import type { Note } from "@/lib/notes";

// Mirror TitleSchema's cap (lib/validation.ts, SPEC §13) so the input can't
// produce a title the save action would reject.
const TITLE_MAX_LENGTH = 200;

// Debounce window for auto-save: long enough to coalesce a burst of typing into
// one write, short enough to feel responsive (prd: 1–2 second delay).
const AUTOSAVE_DELAY_MS = 1500;

// Save lifecycle the status indicator reflects. "unsaved" = an edit is pending
// (debounce running); the rest are self-explanatory.
type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save",
};

export function NoteEditor({ note }: { note: Note }) {
  const router = useRouter();
  const toast = useToast();

  // Controlled title state, initialised from the stored title (null → empty so the
  // input stays controlled and the placeholder shows).
  const [title, setTitle] = useState(note.title ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Delete flow state: `deleting` drives the loading UI and disables both dialog
  // buttons; `deleteError` surfaces a failed deletion inside the open dialog.
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Latest values read at save time. Refs (not state) so the debounced save and
  // the editor's onUpdate always see the current title/content without re-creating
  // callbacks or re-rendering on every keystroke.
  const titleRef = useRef<string>(note.title ?? "");
  const contentRef = useRef<JSONContent>(note.contentJson);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Persist the current title + content via the Server Action. Cancels any pending
  // debounce so a manual save and the timer can't double-fire. An empty title is
  // sent as null so the column clears (the list falls back to "Untitled note").
  //
  // Toasts: a SUCCESS toast only for an explicit Save click (`manual`) — auto-save
  // fires ~every 1.5s while typing, so a per-save success toast would be spam; the
  // inline status indicator covers it. A FAILURE always toasts (rare + important).
  const save = useCallback(
    async ({ manual = false }: { manual?: boolean } = {}) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setStatus("saving");
      const trimmed = titleRef.current.trim();
      const result = await updateNoteAction(note.id, {
        title: trimmed === "" ? null : trimmed,
        contentJson: contentRef.current,
      });
      if (result.ok) {
        setStatus("saved");
        if (manual) toast("Note saved");
      } else {
        setStatus("error");
        toast(result.error || "Couldn't save note", "error");
      }
    },
    [note.id, toast],
  );

  // Mark the note dirty and (re)arm the debounce. Only ever called from genuine
  // user edits (title keystrokes / editor transactions), so the initial load
  // never triggers a save — TipTap doesn't fire onUpdate for the initial content.
  const scheduleSave = useCallback(() => {
    setStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void save();
    }, AUTOSAVE_DELAY_MS);
  }, [save]);

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
      contentRef.current = editor.getJSON();
      scheduleSave();
    },
  });

  // Clear any pending debounce if the editor unmounts mid-edit (e.g. navigation).
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setTitle(next);
    titleRef.current = next;
    scheduleSave();
  }

  // Confirm-delete: cancel any pending auto-save (the note is going away), call the
  // Server Action (which re-checks ownership), then redirect to the dashboard on
  // success. `deleting` stays true through the navigation so the UI can't be used
  // twice; on failure we re-enable and show the error inside the open dialog.
  const handleDelete = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setDeleteError(null);
    setDeleting(true);
    const result = await deleteNoteAction(note.id);
    if (result.ok) {
      // Success feedback is the redirect itself; a toast here would unmount before
      // it could be seen. Failures keep the user on the page, so they toast (and
      // also surface inline in the still-open dialog).
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setDeleting(false);
    setDeleteError(result.error);
    toast(result.error || "Couldn't delete note", "error");
  }, [note.id, router, toast]);

  // useEditor returns null on the first render under SSR (immediatelyRender:false).
  if (!editor) return null;

  const saving = status === "saving";

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
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="rounded-md px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-600/10 dark:text-red-400"
        >
          Delete
        </button>

        <div className="flex items-center gap-3">
          <span
            role="status"
            aria-live="polite"
            className={`text-xs ${status === "error" ? "text-red-600 dark:text-red-400" : "text-foreground/55"}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <button
            type="button"
            onClick={() => void save({ manual: true })}
            disabled={saving}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Native modal confirmation (focus-trapped, Escape-to-close, ::backdrop) —
          opened imperatively via showModal(). Closing is blocked while a delete is
          in flight so the action can't be interrupted mid-navigation. */}
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (deleting) event.preventDefault();
        }}
        className="m-auto max-w-sm rounded-lg border border-black/10 bg-background p-6 text-foreground backdrop:bg-black/50 dark:border-white/15"
      >
        <h2 className="text-lg font-semibold">Delete note?</h2>
        <p className="mt-2 text-sm text-foreground/70">
          This permanently deletes “{title.trim() === "" ? "Untitled note" : title.trim()}”. This
          can’t be undone.
        </p>

        {deleteError && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {deleteError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={deleting}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
