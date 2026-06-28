"use client";

// ShareToggle — the per-note sharing control (SPEC §10.2 share/unshare flows).
// Lives on the /notes/[id] editor page; the owner flips a note between private
// and public, and when public sees its unguessable share link + a Copy button.
//
// SCOPE: drive the share UX only. The authoritative auth + ownership re-check and
// the SQL stay server-side in toggleShareAction (SPEC §8, §12, §14.2); this
// component just calls it and reflects the result. The public link is built from
// the returned `publicSlug` (never the internal note id, SPEC §10.1/§14.5).

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { toggleShareAction } from "@/lib/actions/notes";

// Base URL for share links (SPEC §15 — NEXT_PUBLIC_APP_URL is the public origin).
// Empty fallback yields a relative "/p/<slug>" URL, which still copies/opens fine.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// How long the "Copied!" confirmation stays visible after a successful copy.
const COPIED_FEEDBACK_MS = 2000;

export function ShareToggle({
  noteId,
  initialIsPublic,
  initialPublicSlug,
}: {
  noteId: string;
  initialIsPublic: boolean;
  initialPublicSlug: string | null;
}) {
  const toast = useToast();

  // Local state mirrors the server so the switch flips instantly; the action's
  // returned note keeps it in sync (and re-shares reuse the same slug, SPEC §10.2).
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [publicSlug, setPublicSlug] = useState(initialPublicSlug);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = publicSlug ? `${APP_URL}/p/${publicSlug}` : "";

  async function handleToggle() {
    const next = !isPublic;
    setPending(true);
    const result = await toggleShareAction(noteId, next);
    setPending(false);

    if (!result.ok) {
      toast(result.error || "Couldn't update sharing", "error");
      return;
    }

    // Trust the server's view of the note (it owns slug minting/reuse).
    setIsPublic(result.data.isPublic);
    setPublicSlug(result.data.publicSlug);
    setCopied(false);
    toast(result.data.isPublic ? "Note is now public" : "Note is now private");
  }

  // Copy the share link to the clipboard with transient "Copied!" feedback.
  // navigator.clipboard can reject (denied permission / insecure context), so the
  // failure is surfaced as an error toast rather than swallowed.
  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast("Couldn't copy link", "error");
    }
  }

  return (
    <section
      aria-label="Sharing"
      className="mt-4 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Public sharing</h2>
          <p className="mt-0.5 text-xs text-foreground/55">
            {isPublic ? "Anyone with the link can view this note." : "Only you can see this note."}
          </p>
        </div>

        {/* Accessible switch: a real <button> with role="switch" + aria-checked,
            so screen readers announce the on/off state and it's keyboard-operable. */}
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label="Make note public"
          onClick={() => void handleToggle()}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            isPublic ? "bg-green-600" : "bg-black/20 dark:bg-white/25"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isPublic ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {isPublic && publicSlug && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            readOnly
            value={shareUrl}
            aria-label="Public share link"
            onFocus={(event) => event.currentTarget.select()}
            className="w-full flex-1 rounded-md border border-black/10 bg-black/[.03] px-3 py-1.5 text-sm text-foreground/80 focus:outline-none dark:border-white/15 dark:bg-white/[.06]"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/10"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}
    </section>
  );
}
