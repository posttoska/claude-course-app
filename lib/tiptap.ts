import StarterKit from "@tiptap/starter-kit";

// Single source of truth for the editor's extension set. This SAME array must
// be used by the client editor AND the server-side static renderer (SPEC §9.1,
// §10.3) so node/mark mappings match — do not fork it.
//
// We expose only the formatting in SPEC §9.1, so every other StarterKit
// node/mark is disabled. Constraining the schema this way means stored docs can
// only contain whitelisted nodes/marks, which also tightens the XSS surface
// (SPEC §14.1). StarterKit v3 adds Link + Underline marks, so they're disabled
// explicitly here too.
export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    orderedList: false,
    blockquote: false,
    strike: false,
    link: false,
    underline: false,
  }),
];
