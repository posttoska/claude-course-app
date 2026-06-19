export default async function PublicNotePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">Public note</h1>
      <p className="text-sm text-gray-500">Placeholder — publicId: {publicId}</p>
    </main>
  );
}
