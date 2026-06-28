// Read-only viewer for a publicly shared note (SPEC §10.3, §14.1).
//
// This is a SERVER COMPONENT (no "use client"): it renders the stored TipTap/
// ProseMirror JSON to React server-side via @tiptap/static-renderer's
// `renderToReactElement`, with NO editor instance and NO DOM. The output is
// React-escaped (no `dangerouslySetInnerHTML`), which is the core XSS defence for
// untrusted rich text (SPEC §14.1) — the renderer only maps the known node/mark
// types from our shared `extensions` to fixed tags, so arbitrary markup can't be
// injected through the document.
//
// NOTE (prd-vs-spec): the prd step says "render with editable: false", which would
// mean mounting the full @tiptap/react editor in a client component. We instead
// follow the authoritative CLAUDE.md invariant + SPEC §10.3 — server-side static
// rendering with the shared `extensions` (lib/tiptap.ts). That keeps the internal
// editor off the public route entirely and renders without a browser. A future
// iter should NOT switch this to a client editable:false editor.

import type { JSONContent } from "@tiptap/core";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { extensions } from "@/lib/tiptap";

const DEFAULT_NOTE_TITLE = "Untitled note";

export function PublicNoteViewer({
  title,
  contentJson,
}: {
  title: string | null;
  contentJson: JSONContent;
}) {
  const displayTitle = title?.trim() ? title : DEFAULT_NOTE_TITLE;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{displayTitle}</h1>

      {/* Server-rendered TipTap JSON. `prose` gives headings/lists/code/rules the
          right typography (dark-mode aware); the shared `extensions` MUST match
          the editor's so node/mark mappings line up (CLAUDE.md invariant). */}
      <div className="prose dark:prose-invert max-w-none">
        {renderToReactElement({ content: contentJson, extensions })}
      </div>
    </article>
  );
}
