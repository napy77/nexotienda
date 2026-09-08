export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-4xl font-black tracking-tight text-neutral-900">NexoTienda</h1>
      <p className="text-lg text-neutral-600">
        Cada comercio tiene su tienda en su propia dirección, y cada pueblo la suya.
      </p>
      <p className="text-sm text-neutral-500">
        En desarrollo, probá{' '}
        <a className="font-medium text-blue-700 underline" href="http://supersol.localhost:3000">
          supersol.localhost:3000
        </a>{' '}
        o{' '}
        <a className="font-medium text-blue-700 underline" href="http://morrison.localhost:3000">
          morrison.localhost:3000
        </a>
        .
      </p>
    </main>
  );
}
