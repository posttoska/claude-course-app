import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Dedupe getSession across a single request (e.g. a layout + its page both read it).
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

// Per-route auth gate: call at the top of each protected Server Component / Action.
// Redirects to /login when there's no session; otherwise returns the session.
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
