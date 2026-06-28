// better-auth server instance — the authoritative auth surface on the server.
//
// One SQLite file, two consumers (SPEC §6): better-auth manages the
// user/session/account/verification tables through its Kysely adapter, while
// lib/notes.ts owns the `notes` table. Both share the single handle from db.ts.
//
// better-auth never auto-migrates, so on cold start we apply its migrations
// programmatically (getMigrations -> runMigrations, idempotent). This is skipped
// during `next build` — compilation needs no database. The secret and base URL
// are read from BETTER_AUTH_SECRET / BETTER_AUTH_URL automatically (SPEC §15).

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getMigrations } from "better-auth/db/migration";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";

export const auth = betterAuth({
  // Under the Bun runtime getDb() returns a genuine bun:sqlite Database, which
  // better-auth supports natively; the cast bridges db.ts's driver-agnostic type.
  database: getDb() as unknown as import("bun:sqlite").Database,
  emailAndPassword: { enabled: true },
  plugins: [nextCookies()], // MUST be last: forwards Set-Cookie from server calls.
});

if (process.env.NEXT_PHASE !== "phase-production-build") {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}

/** The authoritative session shape `{ user, session }` (or `null` when signed out). */
export type Session = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Read the current session in a Server Component / Server Action (SPEC §7.5).
 *
 * Reads the incoming request cookies via `next/headers` and validates them
 * server-side through better-auth — this is the authoritative check (the
 * optimistic middleware cookie-presence test is never the real gate). Returns
 * `{ user, session }` when signed in, or `null` otherwise.
 */
export async function getSession(): Promise<Session> {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Require an authenticated user, returning the non-null session.
 *
 * Use at the top of every protected page/layout and Server Action. When there
 * is no valid session it `redirect()`s to the auth page (its `never` return
 * narrows the result to a guaranteed non-null `Session` for callers).
 */
export async function requireAuth(): Promise<NonNullable<Session>> {
  const session = await getSession();
  if (!session) {
    redirect("/authenticate");
  }
  return session;
}
