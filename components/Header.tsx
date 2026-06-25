import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

// App chrome for the protected area. `email` is null when there's no session;
// the page-level requireSession() is what actually gates access (SPEC §7.6).
export function Header({ email }: { email: string | null }) {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          NextNotes
        </Link>
        {email && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-foreground/60">
              <span className="sr-only">Signed in as </span>
              {email}
            </span>
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
