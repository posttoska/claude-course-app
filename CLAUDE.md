# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Keep your replies extremely concise and focus on conveying the key information. No unnecessary fluff, no long code snippets.

## What this is

A note-taking web app: authenticated users CRUD rich-text notes and publicly share them via unguessable links. **`SPEC.md` is the authoritative design document** — read it before implementing anything. It is unusually detailed (data model, auth, authorization matrix, editor config, sharing flows, security, build phases §16) and decisions there override guesses made from the current code.

**Current state: only the `create-next-app` boilerplate exists.** `app/page.tsx` and `app/layout.tsx` are still the default template; none of the SPEC structure (`lib/`, `actions/`, `components/`, `scripts/`, `middleware.ts`) has been built. Work here is greenfield implementation against the spec, roughly at Phase 1 of SPEC §16.

## Package manager & runtime

- **Bun** is the package manager (`bun.lock`). Use `bun install` / `bun add <pkg>`, not npm/pnpm.
- The data layer uses **`bun:sqlite`**, which only works when Next.js runs **under the Bun runtime**, not Node. SPEC §3.2 requires the scripts be `bun --bun next dev` (etc.). **The current `package.json` scripts are still plain `next dev` / `next build` / `next start`** — they must be switched to `bun --bun …` before any `bun:sqlite` code will run. Update them when starting the DB layer.
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

Database setup (per SPEC §15 — these scripts/files don't exist yet, create them as part of the DB phase):

```bash
bunx @better-auth/cli migrate   # generate/apply better-auth's 4 tables (run with dev server stopped)
bun run scripts/init-db.ts      # create the `notes` table
```

## Architecture (target, per SPEC)

App Router with a strict **reads vs. writes** split:

- **Reads** (list, open, render public note) run in **Server Components** that import a server-only data module (`lib/notes.ts`) and query SQLite directly. No REST API for reads.
- **Writes** (create/update/delete/share/unshare) go through **Server Actions** in `actions/notes.ts` (`"use server"`). Every action follows the same guard order: **session → ownership → Zod validation → SQL → `revalidatePath`**.
- **Auth** is better-auth via a single catch-all route `app/api/auth/[...all]/route.ts`. Client forms call the better-auth React client; server code calls `auth.api.getSession({ headers })`.
- **One SQLite file, two consumers**: `lib/db.ts` opens a single shared `bun:sqlite` `Database` (WAL + foreign keys on). Both `lib/auth.ts` (better-auth's Kysely adapter manages the `user`/`session`/`account`/`verification` tables) and `lib/notes.ts` (your raw SQL owns the `notes` table) import that same instance.

### Invariants that must not be broken

- **Authorization is re-checked server-side on every single-note read and every mutation** (`note.user_id === session.user.id`). `middleware.ts` is an *optimistic UX redirect only* (cookie-presence check) and is never the real gate. Return **404 (`notFound()`), not 403**, for notes the user doesn't own, so existence isn't revealed.
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

`.env.example` currently defines only `BETTER_AUTH_SECRET` and `DB_PATH=data/app.db`. Note this **diverges from SPEC §15**, which uses `DATABASE_PATH=./data/app.sqlite` and also expects `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`. Reconcile the env var names between the spec, `.env.example`, and `lib/db.ts` when wiring up the database, and pick one consistently. Keep `data/` out of version control.
