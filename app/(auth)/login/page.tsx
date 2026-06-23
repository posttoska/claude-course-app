import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthForm, type AuthMode } from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  // Authoritative check: already signed in → no reason to be here.
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { mode: rawMode } = await searchParams;
  const mode: AuthMode = rawMode === "signup" ? "signup" : "signin";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* `key` remounts the form when switching modes, clearing inputs + errors. */}
      <AuthForm key={mode} mode={mode} />
    </main>
  );
}
