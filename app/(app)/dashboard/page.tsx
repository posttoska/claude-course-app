import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-foreground/60">
        Signed in as {session.user.email}. Your notes will appear here.
      </p>
    </main>
  );
}
