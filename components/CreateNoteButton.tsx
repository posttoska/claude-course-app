"use client";

// CreateNoteButton — the dashboard's "new note" entry point (SPEC §11, §16 phase 4).
//
// A self-contained client control: on click it calls the createNoteAction Server
// Action (which mints an empty note owned by the signed-in user), then navigates
// straight into that note's editor at /notes/[id]. It's a client component because
// it owns the pending state and drives the post-create navigation; the actual
// mutation + auth check stay on the server in the action.
//
// On failure (e.g. the session expired) it surfaces the action's error message and
// re-enables the button rather than navigating.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNoteAction } from "@/lib/actions/notes";

export function CreateNoteButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setPending(true);
    setError(null);

    const result = await createNoteAction();
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Navigate into the new note's editor. Keep `pending` true through the
    // navigation so the button stays disabled until the editor page takes over.
    router.push(`/notes/${result.data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "New note"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
