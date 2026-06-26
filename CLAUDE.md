# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippets.

## DISCLAIMER

This repo is just practicing exercise while watching "Claude Code - The Practical Guide" course on Udemy. This is implementation of student of that course. So it could be wrong or inconsistent in some mements. If you want to have original sources, here is the repo of the author: https://github.com/academind/claude-code-course-resources

And here is the Udemy course (NOT free): https://www.udemy.com/course/claude-code-the-practical-guide

So I hope the author is ok about me using similar repo, since materials I attach are published already by him or generated it with Claude Code by myself. So no copyright violation here I hope so.

## What this is

A note-taking web app: authenticated users CRUD rich-text notes and publicly share them via unguessable links. **`SPEC.md` is the authoritative design document** — read it before implementing anything. It is unusually detailed (data model, auth, authorization matrix, editor config, sharing flows, security, build phases §16) and decisions there override guesses made from the current code.

**Current state: auth + DB foundation done (~Phase 2 of SPEC §16), not greenfield.** Working: `lib/db.ts` (shared `bun:sqlite` handle, WAL + FK pragmas, creates the `notes` table), `lib/auth.ts` (better-auth instance; auto-runs its migrations on cold start), `lib/auth-client.ts`, `lib/session.ts` (`getSession`/`requireSession`), `components/AuthForm.tsx`, the `(auth)/login` + `(auth)/signup` pages, and `app/api/auth/[...all]/route.ts`. `app/page.tsx` is a placeholder nav page; `/dashboard`, `/notes/[id]`, and `/share/[publicId]` exist as placeholders only.

Not yet built: `lib/notes.ts`, `lib/tiptap.ts`, `lib/validation.ts`, `actions/notes.ts` (no mutations yet), `middleware.ts`, the `(app)` layout auth-gate, and the editor/list/share components. The auth gate is currently per-page via `requireSession()` (`lib/session.ts`), not a layout or middleware. Note the list route is `/dashboard` here, whereas SPEC §11 uses `/notes`. Next step per the spec: Phase 3–4 — notes data layer + CRUD UI + TipTap editor.

## Package manager & runtime

- **Bun** is the package manager (`bun.lock`). Use `bun install` / `bun add <pkg>`, not npm/pnpm.
- The data layer uses **`bun:sqlite`**, which only works when Next.js runs **under the Bun runtime**, not Node. The `package.json` scripts already handle this: `dev`/`build`/`start` run `bun run --bun next …` (SPEC §3.2). Keep them — reverting to plain `next …` breaks all `bun:sqlite` code.
- On Windows, the Bun + Next dev server can be flaky (socket / hot-reload / 4xx-on-POST). If that happens, run under WSL2 or fall back to `node:sqlite` (SPEC §3.2, §17).

## Commands

```bash
bun install            # install dependencies
bun run dev            # dev server at http://localhost:3000 (see runtime note above re: --bun)
bun run build          # production build
bun run start          # serve production build
bun run lint           # ESLint (flat config, eslint-config-next)
```

There is **no test framework configured** — no test runner, no test scripts. If asked to add tests, confirm the intended framework first.

Database setup is automatic — there is no manual migration step. On cold start, `lib/auth.ts` runs better-auth's migrations (`getMigrations` → `runMigrations`, idempotent) to create the `user`/`session`/`account`/`verification` tables, and `lib/db.ts` runs `CREATE TABLE IF NOT EXISTS notes`.

**Decision (resolves a SPEC §17 open item):** the `notes` schema lives in `lib/db.ts`, _not_ a separate `scripts/init-db.ts` — there is no `scripts/` dir and no `db:*` scripts. The SPEC §15 manual commands (`bunx auth migrate`, `bun run scripts/init-db.ts`) are **not** used here.

## Architecture (target, per SPEC)

App Router with a strict **reads vs. writes** split:

- **Reads** (list, open, render public note) run in **Server Components** that import a server-only data module (`lib/notes.ts`) and query SQLite directly. No REST API for reads.
- **Writes** (create/update/delete/share/unshare) go through **Server Actions** in `actions/notes.ts` (`"use server"`). Every action follows the same guard order: **session → ownership → Zod validation → SQL → `revalidatePath`**.
- **Auth** is better-auth via a single catch-all route `app/api/auth/[...all]/route.ts`. Client forms call the better-auth React client; server code calls `auth.api.getSession({ headers })`.
- **One SQLite file, two consumers**: `lib/db.ts` opens a single shared `bun:sqlite` `Database` (WAL + foreign keys on) and creates the `notes` table. Both `lib/auth.ts` (better-auth's Kysely adapter manages the `user`/`session`/`account`/`verification` tables) and `lib/notes.ts` (raw SQL for `notes` queries — not yet created) import that same instance.

### Invariants that must not be broken

- **Authorization is re-checked server-side on every single-note read and every mutation** (`note.user_id === session.user.id`). `middleware.ts` is an _optimistic UX redirect only_ (cookie-presence check) and is never the real gate. Return **404 (`notFound()`), not 403**, for notes the user doesn't own, so existence isn't revealed.
- **Public access is gated solely on `is_public = 1`, looked up by the high-entropy `public_id`** — never by the internal note `id`. Public URLs are `/share/{public_id}`. The internal id is never exposed on public routes.
- **Note content is stored as TipTap/ProseMirror JSON** (`JSON.stringify(editor.getJSON())`) in a TEXT column, **never raw HTML**. The public page renders it server-side with `@tiptap/static-renderer`'s `renderToReactElement` (React-escaped, no `dangerouslySetInnerHTML`).
- **`lib/tiptap.ts` is the single source of truth for the editor extension set, shared by both the client editor and the server renderer.** They must use the identical config or node/mark mappings won't match. Disabling unused StarterKit extensions is also a security measure (constrains the doc schema) — see SPEC §9.1, §14.1.
- **All SQL is parameterized** (`$name` binds via `db.query(...)`). Never interpolate user input into SQL.

## Stack specifics

- **Next.js 16 + React 19**, App Router, TypeScript strict. Path alias `@/*` → project root (`tsconfig.json`).
- **Tailwind v4, CSS-first**: configured in `app/globals.css` via `@import "tailwindcss"` — there is no `tailwind.config.js`. Rich-text rendering needs `@tailwindcss/typography` (`prose` classes); the SPEC adds it with `@plugin "@tailwindcss/typography";` in the CSS, but **it is not installed yet**.
- **Installed**: `@tiptap/starter-kit`, `@tiptap/pm`, `better-auth`, `zod`. **Per the SPEC but NOT yet installed**: `@tiptap/react`, `@tiptap/static-renderer`, `@tailwindcss/typography` — `bun add` them when reaching those phases.
- TipTap editor must use `immediatelyRender: false` under SSR (SPEC §9.2).

## Environment

`.env.example` is aligned with SPEC §15: `DATABASE_PATH=./data/app.sqlite`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`. Env var names are consistent across spec, example, and code — `lib/db.ts` reads `DATABASE_PATH` (default `./data/app.sqlite`); `lib/auth.ts` reads `BETTER_AUTH_URL`. `NEXT_PUBLIC_APP_URL` is reserved for building share links (Phase 5).

`data/` holds the live SQLite file (+ `-wal`/`-shm`) and stays out of version control (SPEC §15). It is gitignored via `/data/` and untracked; never commit it.
