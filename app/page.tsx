import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Notes App</h1>
      <p className="text-sm text-gray-500">Placeholder home — route scaffolding.</p>
      <nav className="flex gap-4 text-sm underline">
        <Link href="/login">Login</Link>
        <Link href="/signup">Sign up</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  );
}
