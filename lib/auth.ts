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
