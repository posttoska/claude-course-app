// App header — a Server Component that reflects the current auth state.
//
// It reads the authoritative session on the server via getSession() (SPEC §7.5),
// so the rendered nav always matches reality on first paint: signed-out visitors
// see Log in / Sign up, signed-in users see a Dashboard link and the LogoutButton.
// The app name always links home. Rendered once from the root layout so it sits
// above every page.

import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export async function Header() {
  const session = await getSession();

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Notes
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                Dashboard
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/authenticate"
                className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                Log in
              </Link>
              <Link
                href="/authenticate"
                className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
