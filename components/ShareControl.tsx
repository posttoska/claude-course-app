"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setNoteSharing } from "@/actions/notes";

// NEXT_PUBLIC_* is inlined at build time, so this value is identical on the
// server and the client (no hydration mismatch). Required for absolute share
// links (SPEC §15); if it's somehow unset we recover from the browser origin.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// Owner-only control to toggle public sharing and surface the public link.
// Sharing is an immediate action, independent of the editor's Save.
export function ShareControl({
  noteId,
  initialIsPublic,
  initialPublicId,
}: {
  noteId: string;
  initialIsPublic: boolean;
  initialPublicId: string | null;
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [publicId, setPublicId] = useState(initialPublicId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Prefer the configured origin (stable across SSR/hydration). Only if it's
  // unset do we fall back to the browser origin AFTER mount — so the first paint
  // matches the server (no hydration mismatch) and the copied link stays
  // absolute/shareable even on a misconfigured deploy.
  const [origin, setOrigin] = useState(APP_URL);
  useEffect(() => {
    if (!APP_URL) setOrigin(window.location.origin);
  }, []);

  // Track the "Copied" reset timer so rapid clicks don't leave a stale timer
  // that clears the confirmation early; also clear it on unmount.
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const shareUrl = publicId ? `${origin}/share/${publicId}` : null;

  async function toggle() {
    const makePublic = !isPublic;
    setError(null);
    setPending(true);
    try {
      const result = await setNoteSharing(noteId, makePublic);
      if (!result.ok) {
        setError("Could not update sharing. Please try again.");
        return;
      }
      setIsPublic(result.isPublic);
      setPublicId(result.publicId);
      setCopied(false);
      router.refresh();
    } catch {
      setError("Could not update sharing. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically — select and copy the link.");
    }
  }

  return (
    <section
      aria-label="Public sharing"
      className="rounded-md border border-black/10 p-4 dark:border-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">Public sharing</h2>
          <p className="mt-0.5 text-xs text-foreground/60">
            {isPublic
              ? "Anyone with the link can view this note (read-only)."
              : "This note is private. Turn on sharing to get a public link."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={isPublic}
          className="shrink-0 rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
        >
          {pending ? "Saving…" : isPublic ? "Make private" : "Make public"}
        </button>
      </div>

      {isPublic && shareUrl && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            aria-label="Public link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-xs text-foreground/80 outline-none dark:border-white/20"
          />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
