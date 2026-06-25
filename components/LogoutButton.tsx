"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      // Recover the button instead of leaving it stuck on "Signing out…".
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="rounded-md border border-black/15 px-3 py-1.5 font-medium transition hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
