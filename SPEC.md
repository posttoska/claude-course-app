# Technical Specification — Note Taking App

A web app where authenticated users create, edit, delete, and publicly share rich‑text notes. Notes are stored as ProseMirror/TipTap JSON in SQLite.

---

## 1. Overview & Scope

### 1.1 Goals (in scope)

- Email/password authentication (sign up, sign in, sign out, session persistence).
- Authenticated CRUD on notes owned by the signed‑in user.
- Rich‑text editing via TipTap with a fixed formatting set (see §9).
- Public sharing of a note via an unguessable link, and the ability to stop sharing.
- Read‑only public rendering of shared notes without requiring the viewer to log in.

### 1.2 Non‑goals (explicitly out for v1)

Real‑time collaboration, comments, folders/tags, full‑text search, image/file uploads, OAuth/social login, multi‑user permissions beyond "owner + public link", versioning/history, and mobile apps. See §17 for the deferred list.

### 1.3 Core rules

- A user only ever sees and mutates **their own** notes (owner model).
- A note is either **private** (default) or **public**. Public notes are readable by anyone holding the share link; everything else stays private.
- The note body is rich text persisted as JSON, never as raw HTML in the DB.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime / toolchain | **Bun** (package manager + JS runtime) | Required to use `bun:sqlite`. See the runtime caveat in §3.2. |
| Framework | **Next.js (App Router, v15/16)** | Server Components for reads, Server Actions for mutations. |
| Language | **TypeScript** (strict) | |
| Styling | **TailwindCSS v4** | CSS‑first config (`@import "tailwindcss"`); no `tailwind.config.js` needed. Add `@plugin "@tailwindcss/typography"` for `prose` rendering. |
| Auth | **better-auth** | Email/password, cookie sessions, schema + migrations via its CLI. |
| Editor | **TipTap v3** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`) | Headless ProseMirror editor. |
| Server‑side render of note content | **`@tiptap/static-renderer`** | Renders TipTap JSON → React/HTML with no browser/editor instance (used for the public page). |
| Database | **SQLite** via **`bun:sqlite`** (`Database`) | Raw SQL, prepared statements. Single file, WAL mode. |

> **One database file, two consumers.** better-auth and the notes layer share the same SQLite file and the same `Database` instance (§6). better-auth manages its four tables through its Kysely adapter; the `notes` table is managed by your own SQL.

---

## 3. Architecture

### 3.1 Request flow

- **Reads** (list notes, open a note, render a public note) happen in **Server Components** that import a server‑only data‑access module (`lib/notes.ts`) and query SQLite directly. No internal REST API is needed for reads.
- **Mutations** (create/update/delete/share/unshare) happen through **Server Actions** (`"use server"`). Each action: resolves the session → authorizes ownership → validates input → executes SQL → `revalidatePath`.
- **Auth endpoints** are served by a single catch‑all route handler at `/api/auth/[...all]` provided by better-auth. Client auth forms call the better-auth client, which talks to this handler.
- **Optimistic route protection** is done in `middleware.ts` (cookie presence check). The **authoritative** auth/ownership check is always re‑done inside the Server Component / Server Action (§7.5, §8).

```
Browser
  │  (client components: login/signup forms, TipTap editor)
  ▼
Next.js (App Router, running on the Bun runtime)
  ├── /api/auth/[...all]      → better-auth handler  ─┐
  ├── Server Components (reads) → lib/notes.ts ───────┤→ bun:sqlite Database → app.sqlite
  ├── Server Actions (writes)  → lib/notes.ts ────────┘        ▲
  └── middleware.ts (optimistic cookie check)                  │
                              better-auth (Kysely adapter) ────┘
```

### 3.2 Runtime caveat (important)

`bun:sqlite` is a **Bun‑runtime API**. It only works when the server code actually executes under Bun, not Node. With Next.js you must run the CLI under Bun:

```jsonc
// package.json
{
  "scripts": {
    "dev":   "bun --bun next dev",
    "build": "bun --bun next build",
    "start": "bun --bun next start",
    "db:auth": "bunx auth@latest migrate",   // creates auth tables
    "db:init": "bun run scripts/init-db.ts"        // creates the notes table
  }
}
```

Next.js still uses its own bundler (Turbopack/Webpack); `--bun` only swaps the runtime underneath, which is what makes `bun:sqlite` available inside Server Components, Server Actions, and route handlers.

Two practical risks to plan for:
- **Windows:** the Bun runtime + Next.js dev server can be rough on native Windows in some Bun versions. If you hit socket/hot‑reload/`4xx`‑on‑POST oddities in dev, run inside **WSL2**.
- **Fallback:** if the Bun runtime proves unstable for your setup, you can keep everything else and swap the DB driver to `node:sqlite` (`import { DatabaseSync } from "node:sqlite"`, Node ≥ 22.5) or `better-sqlite3`. better-auth supports all three, and the raw‑SQL data layer needs only a thin adapter change. Decide this early (§17).

---

## 4. Project Structure

```
notes-app/
├── app/
│   ├── layout.tsx                      # root layout
│   ├── page.tsx                        # "/" → redirect to /notes or /login
│   ├── (auth)/
│   │   ├── login/page.tsx              # client sign-in form
│   │   └── signup/page.tsx             # client sign-up form
│   ├── (app)/                          # protected route group
│   │   ├── layout.tsx                  # authoritative session check + redirect
│   │   └── notes/
│   │       ├── page.tsx                # list (dashboard)
│   │       └── [id]/page.tsx           # open one note (loads editor)
│   ├── share/
│   │   └── [publicId]/page.tsx         # public read-only view (no auth)
│   └── api/
│       └── auth/[...all]/route.ts      # better-auth handler
├── actions/
│   └── notes.ts                        # "use server" mutations
├── components/
│   ├── editor/
│   │   ├── NoteEditor.tsx              # "use client" TipTap editor
│   │   └── Toolbar.tsx                 # formatting buttons
│   ├── NoteList.tsx
│   ├── ShareControls.tsx               # share / copy link / unshare
│   └── AuthForm.tsx
├── lib/
│   ├── db.ts                           # bun:sqlite Database + pragmas (shared)
│   ├── auth.ts                         # betterAuth() server instance
│   ├── auth-client.ts                  # createAuthClient() for the browser
│   ├── notes.ts                        # server-only data access (queries)
│   ├── tiptap.ts                       # shared extension config (editor + renderer)
│   └── validation.ts                   # Zod schemas + content checks
├── scripts/
│   └── init-db.ts                      # CREATE TABLE notes (run once)
├── middleware.ts                       # optimistic cookie redirect
├── .env
└── package.json
```

---

## 5. Data Model

### 5.1 better-auth tables (generated, not hand‑written)

better-auth requires four core tables: **`user`**, **`session`**, **`account`**, **`verification`**. You do **not** write these by hand — generate them from your auth config:

```bash
# Applies the schema directly to SQLite (built-in Kysely adapter):
bunx auth@latest migrate

# (or) emit a schema.sql you apply yourself:
bunx auth@latest generate
```

Run migrations with the dev server stopped to avoid file locking. Relevant facts for the data model:

- The `user` table's primary key `id` is a **TEXT** string (random id by default; UUID if you enable that option). Your `notes.user_id` foreign key targets `user(id)`.
- With email/password enabled, the hashed password lives in the `account` table — never in `user`. You never read or write it directly.

### 5.2 `notes` table (you own this)

```sql
-- scripts/init-db.ts executes this once.
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT    PRIMARY KEY,                 -- app-generated UUID (crypto.randomUUID())
  user_id     TEXT    NOT NULL
                      REFERENCES "user"(id) ON DELETE CASCADE,
  title       TEXT,                                -- optional; see §5.4
  content     TEXT    NOT NULL,                    -- JSON.stringify(TipTap doc)
  is_public   INTEGER NOT NULL DEFAULT 0,          -- 0 = private, 1 = public (SQLite has no bool)
  public_id   TEXT    UNIQUE,                      -- high-entropy share token, NULL until first shared
  created_at  TEXT    NOT NULL,                    -- ISO 8601, app-set
  updated_at  TEXT    NOT NULL                     -- ISO 8601, app-set
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
-- public_id already has a UNIQUE index; SQLite permits multiple NULLs in it.
```

### 5.3 Storage decisions

- **Content** = the object returned by `editor.getJSON()`, persisted as `JSON.stringify(doc)` in a `TEXT` column. Parse with `JSON.parse` on read. (Keeping it as JSON, not HTML, is what makes safe server rendering and future re‑editing straightforward.)
- **IDs** = `crypto.randomUUID()` generated in app code. Using non‑sequential string ids (consistent with better-auth) avoids exposing counts and prevents trivial enumeration on authenticated routes.
- **Timestamps** = ISO 8601 strings (`new Date().toISOString()`). They sort lexicographically and are human‑readable. (Alternative: `INTEGER` Unix‑ms — pick one and stay consistent.)
- **Booleans** = `0`/`1` integers (SQLite convention).

### 5.4 Title (recommended, optional)

Your definition is "a note is a piece of text," so a title is not strictly required. But a list view needs a label. Recommendation: keep `title` nullable, let the user optionally set one, and when empty derive a display label from the first non‑empty text node of the content (truncated). Decide in §17 whether to store it or always derive it.

---

## 6. Database Access Layer (`bun:sqlite`)

A single shared `Database` instance, opened once, with WAL and foreign keys enabled. Import it from both `lib/auth.ts` and `lib/notes.ts`.

```ts
// lib/db.ts
import { Database } from "bun:sqlite";

export const db = new Database(process.env.DATABASE_PATH ?? "./data/app.sqlite", {
  create: true,
});

// Connection-level pragmas (safe to run on every cold start):
db.exec("PRAGMA journal_mode = WAL;");   // better read concurrency
db.exec("PRAGMA foreign_keys = ON;");    // enforce ON DELETE CASCADE
```

Query rules:

- **Always** use parameterized statements. Never concatenate user input into SQL.
- `db.query(sql)` returns a cached prepared statement; use `.get()` (single row), `.all()` (rows), `.run()` (write).
- Bind with `$name` placeholders.

```ts
// lib/notes.ts  (server-only)
import { db } from "./db";

export type NoteRow = {
  id: string; user_id: string; title: string | null;
  content: string; is_public: number; public_id: string | null;
  created_at: string; updated_at: string;
};

export function listNotesByUser(userId: string): NoteRow[] {
  return db
    .query("SELECT * FROM notes WHERE user_id = $uid ORDER BY updated_at DESC")
    .all({ $uid: userId }) as NoteRow[];
}

export function getOwnedNote(id: string, userId: string): NoteRow | null {
  return db
    .query("SELECT * FROM notes WHERE id = $id AND user_id = $uid")
    .get({ $id: id, $uid: userId }) as NoteRow | null;
}

export function getPublicNote(publicId: string): NoteRow | null {
  return db
    .query("SELECT * FROM notes WHERE public_id = $pid AND is_public = 1")
    .get({ $pid: publicId }) as NoteRow | null;
}
```

For multi‑statement writes, wrap them in `db.transaction(() => { ... })()`.

---

## 7. Authentication (better-auth)

### 7.1 Server instance

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

export const auth = betterAuth({
  database: db,                       // the shared bun:sqlite Database
  emailAndPassword: { enabled: true },
  plugins: [nextCookies()],           // MUST be last; lets server-side calls set cookies
});
```

> `nextCookies()` is required so cookies set during server‑side auth calls (and Server Actions) are forwarded correctly in the App Router.

### 7.2 Route handler

```ts
// app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { POST, GET } = toNextJsHandler(auth);
```

### 7.3 Browser client

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
// same-origin: baseURL can be omitted
```

### 7.4 Auth flows (client forms)

- **Sign up:** `await authClient.signUp.email({ email, password, name })`
- **Sign in:** `await authClient.signIn.email({ email, password })`
- **Sign out:** `await authClient.signOut()`
- **Reactive session in client UI:** `const { data: session } = authClient.useSession()`

On success, redirect to `/notes`. Surface field‑level errors from the returned error object.

### 7.5 Session on the server (authoritative)

```ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({ headers: await headers() });
// → { user, session } | null
```

Use this in the `(app)` layout, in `/notes/[id]`, and at the top of every Server Action.

### 7.6 Middleware (optimistic only)

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const hasCookie = getSessionCookie(request);          // existence check only
  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/notes/:path*"] };
```

> **Security note:** `getSessionCookie` only checks that a cookie *exists*; it does **not** validate it, and it has known edge cases in some Next/Bun versions. Treat middleware purely as a UX redirect. The real gate is the `auth.api.getSession` check inside the protected page/layout and every Server Action. If middleware proves flaky in your setup, drop it and rely solely on per‑page/per‑action checks.

---

## 8. Authorization

| Action | Auth required | Ownership / visibility check | On failure |
|---|---|---|---|
| Create note | Yes | owner = `session.user.id` | redirect to /login |
| List notes | Yes | `WHERE user_id = session.user.id` | redirect to /login |
| Open / edit a note | Yes | `note.user_id === session.user.id` | `notFound()` (404, don't reveal existence) |
| Update note | Yes | same as above | reject |
| Delete note | Yes | same as above | reject |
| Share / Unshare | Yes | same as above | reject |
| View public note | **No** | `note.is_public === 1` (looked up by `public_id`) | `notFound()` |

Return **404** rather than 403 for non‑owned notes so the app doesn't confirm that an id exists.

---

## 9. Rich Text Editor (TipTap)

### 9.1 Extension set

Everything you need is in **StarterKit**. Configure heading levels and **disable the extensions you don't expose** — this constrains the document schema to your whitelist, which also tightens the rendering/XSS surface (§14.1).

| Feature | TipTap node/mark | Toolbar command |
|---|---|---|
| Bold | `bold` (mark) | `toggleBold()` |
| Italic | `italic` (mark) | `toggleItalic()` |
| Headings H1–H3 | `heading` (node), `levels: [1,2,3]` | `toggleHeading({ level })` |
| Normal text | `paragraph` (node) | `setParagraph()` |
| Inline code | `code` (mark) | `toggleCode()` |
| Code block | `codeBlock` (node) | `toggleCodeBlock()` |
| Bullet list | `bulletList` + `listItem` (nodes) | `toggleBulletList()` |
| Horizontal rule | `horizontalRule` (node) | `setHorizontalRule()` |

```ts
// lib/tiptap.ts  — single source of truth for editor AND server renderer
import StarterKit from "@tiptap/starter-kit";

export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    // Disable what you don't offer, so stored docs can only contain your whitelist:
    orderedList: false,
    blockquote: false,
    strike: false,
    // ...disable any other StarterKit nodes/marks you aren't exposing
  }),
];
```

> Keep this `extensions` array shared. The server‑side renderer (§10.3) must use the **same** extension config or node/mark mappings won't match.

### 9.2 Editor component (client)

```tsx
// components/editor/NoteEditor.tsx
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { extensions } from "@/lib/tiptap";

export function NoteEditor({
  initialContent,
  onChange,
}: {
  initialContent: object;                 // parsed TipTap JSON
  onChange: (json: object) => void;
}) {
  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,             // REQUIRED under SSR/Next.js
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) return null;
  return (
    <>
      {/* <Toolbar editor={editor} /> */}
      <EditorContent editor={editor} />
    </>
  );
}
```

- `immediatelyRender: false` prevents hydration mismatches (the editor needs the DOM and must initialize client‑side). Recent TipTap auto‑detects SSR, but set it explicitly.
- New‑note initial content: `{ "type": "doc", "content": [{ "type": "paragraph" }] }`.
- Persist by sending `editor.getJSON()` to the `updateNote` action (debounce on `onUpdate`, or save on an explicit "Save" button / on blur).

### 9.3 Toolbar

Each button calls a chained command and reflects active state:

```ts
editor.chain().focus().toggleBold().run();
editor.isActive("bold");                       // → highlight the button
editor.isActive("heading", { level: 2 });
editor.can().chain().focus().toggleBold().run(); // → enable/disable
```

### 9.4 Styling the output

Use `@tailwindcss/typography`'s `prose` classes on both the editor container and the public render so headings, lists, code, and rules look correct. With Tailwind v4, enable it in your CSS: `@plugin "@tailwindcss/typography";`.

---

## 10. Public Sharing

### 10.1 Model

A note has a boolean `is_public` and a separate high‑entropy `public_id` token. The public URL is `/share/{public_id}` — **not** `/share/{note.id}`. Decoupling the public token from the internal id means: the internal id never leaks publicly, links can be revoked/rotated independently, and the token space is unguessable.

### 10.2 Flows

- **Share:** verify ownership → if `public_id` is `NULL`, generate one (`crypto.randomUUID()`) → set `is_public = 1` → return `{appUrl}/share/{public_id}`.
- **Unshare:** verify ownership → set `is_public = 0`. Keep the `public_id` so re‑sharing yields the same link. (The lookup query requires `is_public = 1`, so old links 404 while unshared.)
- **Rotate (optional):** regenerate `public_id` to permanently invalidate previously shared links.

### 10.3 Public read‑only page

No auth. Look up by token, 404 if missing or not public, render the JSON server‑side with the static renderer. Prefer `renderToReactElement` so output is React‑escaped (no `dangerouslySetInnerHTML`).

```tsx
// app/share/[publicId]/page.tsx
import { notFound } from "next/navigation";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { extensions } from "@/lib/tiptap";
import { getPublicNote } from "@/lib/notes";

export default async function PublicNotePage(
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const note = getPublicNote(publicId);
  if (!note) notFound();

  const doc = JSON.parse(note.content);
  return (
    <article className="prose max-w-none">
      {renderToReactElement({ content: doc, extensions })}
    </article>
  );
}
```

> `@tiptap/static-renderer` turns ProseMirror JSON into output with **no editor instance and no DOM**, which is ideal for a Server Component. There's also `renderToHTMLString` (from `@tiptap/static-renderer/pm/html-string`) if you need a string; if you use it, pair it with sanitization (§14.1). Confirm the exact subpaths against the static‑renderer docs for your installed version.

---

## 11. Routes & Pages

| Path | Access | Render strategy | Purpose |
|---|---|---|---|
| `/` | public | server redirect | → `/notes` if authed, else `/login` |
| `/login` | public (redirect away if authed) | client form | sign in |
| `/signup` | public (redirect away if authed) | client form | sign up |
| `/notes` | protected | Server Component (list) | dashboard listing the user's notes; "new note" entry point |
| `/notes/[id]` | protected, owner | Server Component shell + client editor | view/edit one note |
| `/share/[publicId]` | public | Server Component (static render) | read‑only shared note |
| `/api/auth/[...all]` | n/a | better-auth handler | all auth endpoints |

---

## 12. Server Actions (mutations)

All in `actions/notes.ts`, all `"use server"`. Shared shape: **session → ownership → validation → SQL → `revalidatePath`**. They throw / return an error object on auth or validation failure.

```ts
// actions/notes.ts (signatures + the standard guard)
"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedNote } from "@/lib/notes";
import { NoteContentSchema, TitleSchema } from "@/lib/validation";

async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("UNAUTHENTICATED");
  return session.user.id;
}

export async function createNote(): Promise<{ id: string }> { /* insert empty doc, return id */ }
export async function updateNote(id: string, input: { title?: string; content: unknown }): Promise<void> { /* validate + UPDATE */ }
export async function deleteNote(id: string): Promise<void> { /* ownership → DELETE */ }
export async function shareNote(id: string): Promise<{ url: string }> { /* ensure public_id, set is_public=1 */ }
export async function unshareNote(id: string): Promise<void> { /* set is_public=0 */ }
// optional: rotateShareLink(id) → regenerate public_id
```

Reads do **not** need actions — query directly in Server Components (§6).

---

## 13. Validation (`lib/validation.ts`)

Validate every mutation input on the server with **Zod**; never trust the client.

- **Content shape:** require an object with `type: "doc"` and an array `content`. Reject anything else.
- **Content size:** cap the serialized JSON (e.g. reject `> 1 MB`) to prevent abuse / oversized rows.
- **Title:** optional string, trimmed, max length (e.g. 200).
- **Defense in depth (optional):** because you disabled non‑whitelisted extensions, an honest editor can only produce allowed nodes/marks. To harden against a crafted payload sent straight to the action, either deep‑validate node/mark `type`s against your whitelist, or normalize by round‑tripping through the static renderer (unknown nodes simply don't map).

---

## 14. Security Considerations

### 14.1 XSS via rich text (the main risk)

- Store and render **JSON**, not raw HTML. The static renderer maps only known node/mark types to fixed tags, so arbitrary markup can't be injected through the document.
- Render the public page with **`renderToReactElement`** → text is React‑escaped, no `dangerouslySetInnerHTML`.
- If you ever switch to emitting an HTML **string** (`renderToHTMLString` / `generateHTML`) and injecting it, you **must** sanitize it (e.g. DOMPurify on a server DOM) before output.
- Constrain the schema by disabling unused StarterKit extensions (§9.1), and validate the doc shape on write (§13).

### 14.2 Authorization (IDOR)

Every single‑note read and every mutation re‑checks `note.user_id === session.user.id`. Public access is gated solely on `is_public = 1` via the token. Never rely on the URL or client state for ownership.

### 14.3 SQL injection

Parameterized statements everywhere (`$name` binds). No string interpolation of user input into SQL — ever.

### 14.4 Sessions, cookies, secrets

- better-auth issues httpOnly, signed, SameSite cookies and handles password hashing (scrypt by default) and session lifecycle — don't reimplement these.
- Set a strong `BETTER_AUTH_SECRET` (≥ 32 bytes: `openssl rand -base64 32`).
- Serve over HTTPS in production so secure cookies apply.

### 14.5 Share‑link enumeration

`public_id` is a UUID/high‑entropy token, so links aren't guessable. Internal note ids are never exposed on public routes. Offer link rotation (§10.2) for revocation.

### 14.6 CSRF & rate limiting

Next.js Server Actions are POST‑only with origin checks; combined with SameSite cookies this covers CSRF for mutations. better-auth has built‑in rate limiting on its auth endpoints — keep it on (and consider tightening) to slow credential stuffing.

---

## 15. Environment & Config

```bash
# .env
DATABASE_PATH=./data/app.sqlite
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000      # base URL of the app
NEXT_PUBLIC_APP_URL=http://localhost:3000  # used to build share links client-side
```

Setup order:

1. `bun install`
2. `bunx auth@latest migrate` (auth tables) — with the dev server stopped.
3. `bun run scripts/init-db.ts` (notes table).
4. `bun --bun next dev`.

Notes:
- Keep the `data/` directory out of version control.
- Tailwind v4 is CSS‑first: import Tailwind and the typography plugin from your global stylesheet rather than a JS config.

---

## 16. Suggested Build Phases

1. **Skeleton:** Next.js + Bun running via `bun --bun`, Tailwind v4, project structure, `lib/db.ts` opening SQLite with pragmas.
2. **Auth:** `lib/auth.ts`, route handler, client, login/signup pages, `auth.api.getSession` gate in the `(app)` layout, optimistic middleware. Verify sign up → session → sign out.
3. **Notes data layer + schema:** `scripts/init-db.ts`, `lib/notes.ts` query functions.
4. **CRUD UI:** `/notes` list, create action + redirect, `/notes/[id]` with the TipTap editor, update + delete actions, ownership checks, validation.
5. **Sharing:** `public_id`/`is_public`, share/unshare actions, `ShareControls`, `/share/[publicId]` public page via the static renderer.
6. **Hardening:** content size/shape validation, schema lock‑down, error states, empty states, and a pass over §14.

---

## 17. Open Decisions (resolve before/while building)

- **DB driver:** commit to `bun:sqlite` + Bun runtime, or hedge with a tiny driver abstraction so a swap to `node:sqlite`/`better-sqlite3` is cheap if the Bun runtime is unstable on your machine (esp. Windows → WSL2).
- **Title:** store an explicit `title`, or always derive a display label from the content's first text? (Affects the list UI and the schema.)
- **Save UX:** autosave (debounced `onUpdate`) vs explicit Save button vs save‑on‑blur.
- **Unshare semantics:** keep the token (re‑share reuses the link) vs null it (re‑share always mints a new link). Default chosen here: keep + optional rotate.

## 18. Out of Scope (future)

Real‑time collaboration (TipTap + Yjs), OAuth/social login, email verification & password reset flows, folders/tags, full‑text search, images/attachments, note version history, soft delete + trash, and export (Markdown/PDF).