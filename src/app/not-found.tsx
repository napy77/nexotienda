import Link from 'next/link';
import { Store as StoreIcon } from 'lucide-react';

/**
 * Cuando el subdominio no corresponde a ningún comercio ni a ningún pueblo.
 *
 * Le pasa a dos personas y a las dos hay que darles salida: al comerciante que
 * acaba de elegir su dirección y la tipeó distinto, y al cliente que guardó un link
 * de hace meses. La página por defecto de Next dice "This page could not be found"
 * en inglés y no ofrece nada — es peor que no existir.
 *
 * No decimos "esta tienda no existe": no lo sabemos. Puede existir y estar todavía
 * sin publicar (P5).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6">
      <StoreIcon className="h-10 w-10 text-neutral-300" />

      <div>
        <h1 className="text-3xl font-black tracking-tight text-neutral-900">
          No encontramos esta tienda
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Puede que la dirección esté escrita distinto, o que el comercio todavía no
          haya publicado su tienda.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-semibold text-neutral-900">Si sos el comerciante</p>
        <p className="mt-1 text-sm text-neutral-600">
          Revisá en NexoPOS que la dirección de tu tienda esté guardada y que la tienda
          esté publicada. Apenas lo esté, esta página funciona sola — no hay nada que
          esperar.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-semibold text-neutral-900">Si venías a comprar</p>
        <p className="mt-1 text-sm text-neutral-600">
          Preguntale al comercio cuál es su dirección. Si sabés en qué pueblo está,
          podés buscarlo ahí.
        </p>
      </div>

      <p className="text-sm text-neutral-500">
        Por ejemplo:{' '}
        <Link className="font-medium text-blue-700 hover:underline" href="https://morrison.nexotienda.app">
          morrison.nexotienda.app
        </Link>
      </p>
    </main>
  );
}
