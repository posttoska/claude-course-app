"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNote } from "@/actions/notes";

// Delete control for the note viewing page (SPEC §12, course vid 39): a button
// that opens a native <dialog> confirmation. On confirm it removes the note and
// navigates back to /dashboard. showModal() gives us a focus-trapped, Esc-
// dismissible modal with an inert backdrop for free.
export function DeleteNoteDialog({ noteId }: { noteId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    if (pending) return; // don't let it be dismissed mid-delete
    dialogRef.current?.close();
  }

  async function confirmDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteNote(noteId);
      router.push("/dashboard");
    } catch {
      // Keep the dialog open and recover instead of hanging on "Deleting…".
      setPending(false);
      setError("Could not delete the note. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-md border border-red-500/40 px-4 py-2 font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
      >
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-black/10 bg-background p-6 text-foreground shadow-xl backdrop:bg-black/50 dark:border-white/15"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Delete this note?
        </h2>
        <p className="mt-2 text-sm text-foreground/60">This cannot be undone.</p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </dialog>
    </>
  );
}
