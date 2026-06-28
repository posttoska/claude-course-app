"use client";

// NoteEditor — the client-side TipTap rich-text editor for a single note
// (SPEC §9.2). The /notes/[id] Server Component does the auth + ownership + 404
// work and hands the already-fetched `note` here as initial data; this component
// owns only the in-browser editing surface.
//
// SCOPE (this prd task adds persistence): mount the editor, a controlled title
// input, the toolbar, AND save the note's title + content through the
// updateNoteAction Server Action — both via a debounced auto-save (1.5s after the
// last edit) and an explicit "Save" button — with a live status indicator
// (Saving… / Saved / Unsaved / Couldn't save). The auth + ownership re-check + the
// SQL stay server-side in the action; this component only drives the UX.

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { extensions } from "@/lib/tiptap";
import { EditorToolbar } from "@/components/EditorToolbar";
import { updateNoteAction } from "@/lib/actions/notes";
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
  // Controlled title state, initialised from the stored title (null → empty so the
  // input stays controlled and the placeholder shows).
  const [title, setTitle] = useState(note.title ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Latest values read at save time. Refs (not state) so the debounced save and
  // the editor's onUpdate always see the current title/content without re-creating
  // callbacks or re-rendering on every keystroke.
  const titleRef = useRef<string>(note.title ?? "");
  const contentRef = useRef<JSONContent>(note.contentJson);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist the current title + content via the Server Action. Cancels any pending
  // debounce so a manual save and the timer can't double-fire. An empty title is
  // sent as null so the column clears (the list falls back to "Untitled note").
  const save = useCallback(async () => {
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
    setStatus(result.ok ? "saved" : "error");
  }, [note.id]);

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

      <div className="mt-3 flex items-center justify-end gap-3 border-t border-black/10 pt-3 dark:border-white/15">
        <span
          role="status"
          aria-live="polite"
          className={`text-xs ${status === "error" ? "text-red-600 dark:text-red-400" : "text-foreground/55"}`}
        >
          {STATUS_LABEL[status]}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
