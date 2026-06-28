// Single source of truth for the TipTap/ProseMirror extension set (SPEC §9.1,
// CLAUDE.md invariant). This SAME array is consumed by both the client editor
// (components/NoteEditor.tsx) and — in a later task — the server-side static
// renderer for public notes. They must use the identical config or the node/mark
// mappings won't line up.
//
// Disabling the StarterKit extensions we don't expose is also a security measure:
// it constrains the document schema to our whitelist, so stored docs can only
// ever contain nodes/marks the toolbar can produce (SPEC §9.1, §14.1).
//
// IMPORTANT: no "use client" and no server-only imports here — this module has to
// load both in the browser editor bundle and inside a Server Component renderer.

import { StarterKit } from "@tiptap/starter-kit";

/**
 * The whitelisted editor extensions. KEPT (exposed in the toolbar, SPEC §9.1):
 * bold, italic, heading (H1–H3), paragraph, code, codeBlock, bulletList +
 * listItem, horizontalRule — plus StarterKit's structural defaults (document,
 * text, hardBreak, history/undo-redo, cursors). DISABLED below: everything we
 * don't offer, to lock down the stored-document schema.
 */
export const extensions = [
  StarterKit.configure({
    // Headings limited to the three levels the toolbar exposes.
    heading: { levels: [1, 2, 3] },
    // Not offered in the UI → disabled so they can't appear in stored docs.
    orderedList: false,
    blockquote: false,
    strike: false,
    link: false,
    underline: false,
  }),
];
