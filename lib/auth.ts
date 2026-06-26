import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getMigrations } from "better-auth/db/migration";
import { db } from "./db";

// better-auth blocks cross-origin auth requests (CSRF) unless the request's Origin is
// trusted. In production we trust only the configured base URL. In development we ALSO
// trust localhost / private-LAN origins, so the dev server works when opened from another
// device on the network (e.g. a phone at http://192.168.x.x:3000) without hardcoding the
// machine's IP. (A non-localhost host over plain HTTP still shows the browser's "Not
// secure" warning — use http://localhost:3000 to avoid it.)
const BASE_ORIGIN = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const IS_PROD = process.env.NODE_ENV === "production";

function isPrivateDevOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "http:") return false;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^10\./.test(hostname) || // RFC 1918 private ranges
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

export const auth = betterAuth({
  database: db, // the shared bun:sqlite Database; dialect auto-detected
  emailAndPassword: { enabled: true },
  trustedOrigins: async (request) => {
    // `request` is undefined during init and server-side auth.api calls.
    if (IS_PROD || !request) return [BASE_ORIGIN];
    const origin = request.headers.get("origin");
    return origin && isPrivateDevOrigin(origin) ? [BASE_ORIGIN, origin] : [BASE_ORIGIN];
  },
  plugins: [nextCookies()], // MUST be last; forwards cookies set in Server Actions
});

// Ensure better-auth's tables (user, session, account, verification) exist.
// getMigrations diffs the live DB against the auth config; runMigrations only
// has work to do on first run, so this is idempotent on every cold start.
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
if (toBeCreated.length > 0 || toBeAdded.length > 0) {
  await runMigrations();
}
