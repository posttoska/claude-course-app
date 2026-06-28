// better-auth catch-all route handler (SPEC §7.2). Every auth endpoint —
// sign-up, sign-in, sign-out, session, etc. — is served from this single
// catch-all under /api/auth/*. The browser auth client (lib/auth-client.ts)
// and server code both talk to this handler.
//
// toNextJsHandler wires auth.handler to Next.js GET/POST route exports; the
// nextCookies() plugin on the auth instance forwards Set-Cookie correctly.

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
