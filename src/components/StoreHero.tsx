import { BadgeCheck, ShoppingCart } from 'lucide-react';
import type { Store } from '@/lib/nexopos/types';

/**
 * El banner de la tienda. Todo sale de los datos del comercio: nada hardcodeado,
 * porque esto lo van a ver cientos de tiendas distintas.
 */
export function StoreHero({ store, coverUrl }: { store: Store; coverUrl?: string }) {
  return (
    <div className="relative h-44 w-full overflow-hidden bg-neutral-800 sm:h-56 md:h-60">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover object-center opacity-80"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      <div className="absolute top-5 left-4 z-10 sm:left-8">
        <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-xs sm:px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-neutral-600 uppercase">
                {store.category}
              </span>
              {store.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />}
            </div>
            <p className="text-base leading-tight font-extrabold text-neutral-900 sm:text-lg">
              {store.name}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute right-6 bottom-4 z-10 hidden items-center gap-2 rounded-full border border-white/15 bg-neutral-900/80 px-3.5 py-1.5 text-xs text-white backdrop-blur-md md:flex">
        <span
          className={`h-2 w-2 rounded-full ${store.isOpenNow ? 'bg-emerald-400' : 'bg-neutral-400'}`}
        />
        <span>{store.isOpenNow ? 'Abierto ahora' : 'Cerrado ahora'}</span>
      </div>
    </div>
  );
}
