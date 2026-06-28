// better-auth browser client (SPEC §7.3) — the auth surface for "use client"
// components (login/signup forms, logout button, reactive session UI).
//
// `createAuthClient` from "better-auth/react" talks to the catch-all handler at
// /api/auth/* (app/api/auth/[...all]/route.ts). The app and its API share an
// origin, so `baseURL` is omitted — the client defaults to the current origin.

import { createAuthClient } from "better-auth/react";

/** The configured better-auth client instance. */
export const authClient = createAuthClient();

// Named re-exports for ergonomic call sites in client components:
//   await signIn.email({ email, password })
//   await signUp.email({ email, password, name })
//   await signOut()
//   const { data: session } = useSession()
export const { signIn, signUp, signOut, useSession } = authClient;
