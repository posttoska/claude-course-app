export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Note editor</h1>
      <p className="text-sm text-gray-500">Placeholder — id: {id}</p>
    </main>
  );
}
