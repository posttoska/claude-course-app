import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getMigrations } from "better-auth/db/migration";
import { db } from "./db";

export const auth = betterAuth({
  database: db, // the shared bun:sqlite Database; dialect auto-detected
  emailAndPassword: { enabled: true },
  plugins: [nextCookies()], // MUST be last; forwards cookies set in Server Actions
});

// Ensure better-auth's tables (user, session, account, verification) exist.
// getMigrations diffs the live DB against the auth config; runMigrations only
// has work to do on first run, so this is idempotent on every cold start.
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
if (toBeCreated.length > 0 || toBeAdded.length > 0) {
  await runMigrations();
}
