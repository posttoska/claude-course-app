"use client";

// Logout button (SPEC §7.4) — a self-contained client control that ends the
// session via the better-auth browser client and returns the user to the
// landing page. It lives in the Header (rendered when a session is present) but
// is its own component so the sign-out flow stays isolated and reusable.
//
// On click it calls `signOut()`, then navigates to "/" and `router.refresh()`s
// so Server Components re-read the now-cleared session cookie (better-auth's
// nextCookies() plugin clears it during the call). The button disables itself
// while the request is in flight.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await signOut();
    // Navigate home and refresh so server components pick up the cleared cookie.
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06] disabled:opacity-60"
    >
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
