import { getSession } from "@/lib/session";
import { Header } from "@/components/Header";

// Shared chrome for the protected route group. NOTE: this layout is NOT the
// auth gate — each page calls requireSession() itself (SPEC §7.6: layouts are
// not relied on for protection). We read the session here only to render the
// header (user email + sign out).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-screen">
      <Header email={session?.user.email ?? null} />
      {children}
    </div>
  );
}
