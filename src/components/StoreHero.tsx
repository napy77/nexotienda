import { BadgeCheck, ShoppingCart } from 'lucide-react';
import type { Store } from '@/lib/nexopos/types';
import { openLabel, openState } from '@/lib/horario';

/**
 * El encabezado de la tienda. Todo sale de los datos del comercio: nada
 * hardcodeado, porque esto lo van a ver cientos de tiendas distintas.
 *
 * **Con y sin banner son dos diseños, no el mismo con un hueco.** La mayoría de los
 * comercios no va a subir una foto en mucho tiempo, y un rectángulo negro vacío de
 * 240px de alto no es "el banner que falta": es una tienda que parece rota. Sin
 * foto, la barra se achica y muestra lo mismo en una franja clara.
 */
export function StoreHero({ store, coverUrl }: { store: Store; coverUrl?: string }) {
  const abierto = openLabel(openState(store));

  const punto =
    abierto.tone === 'ok'
      ? 'bg-emerald-500'
      : abierto.tone === 'off'
        ? 'bg-neutral-400'
        : 'bg-amber-400';

  const identidad = (
    <div className="flex items-center gap-3">
      {store.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.logoUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
          <ShoppingCart className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {store.category && (
            <span className="truncate rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-neutral-600 uppercase">
              {store.category}
            </span>
          )}
          {store.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
        </div>
        <p className="truncate text-base leading-tight font-extrabold text-neutral-900 sm:text-lg">
          {store.name}
        </p>
      </div>
    </div>
  );

  const estado = (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700">
      <span className={`h-2 w-2 rounded-full ${punto}`} />
      {abierto.text}
    </span>
  );

  // Sin foto: una franja, no un hueco.
  if (!coverUrl) {
    return (
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          {identidad}
          {estado}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-44 w-full overflow-hidden bg-neutral-800 sm:h-56 md:h-60">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUrl} alt="" className="h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      <div className="absolute top-5 left-4 z-10 rounded-xl border border-neutral-100 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-xs sm:left-8">
        {identidad}
      </div>

      <div className="absolute right-4 bottom-4 z-10 sm:right-6">{estado}</div>
    </div>
  );
}
