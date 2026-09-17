'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Campaign, Pasillo, Product, Store } from '@/lib/nexopos/types';
import { ProductCard } from './ProductCard';
import { CampaignRow } from './CampaignRow';

export function Catalog({
  store,
  pasillos,
  products,
  campaigns,
}: {
  store: Store;
  pasillos: Pasillo[];
  products: Product[];
  campaigns: Campaign[];
}) {
  const [pasilloId, setPasilloId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (pasilloId && p.pasilloId !== pasilloId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.brand ?? '').toLowerCase().includes(q) ||
        (p.subCategory ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, pasilloId, query]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <label className="relative block">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar en ${store.name}…`}
            className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {pasillos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPasilloId(null)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                pasilloId === null
                  ? 'bg-neutral-900 text-white'
                  : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              Todo
            </button>
            {pasillos.map((p) => (
              <button
                key={p.id}
                onClick={() => setPasilloId(p.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  pasilloId === p.id
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/*
        Las ofertas son la portada, no un acompañante de los resultados. El que
        escribió "fideos" o tocó una góndola ya dijo qué vino a buscar; dejarle las
        promociones arriba es hacerle scrollear por algo que descartó hace dos
        segundos. Vuelven solas cuando limpia la búsqueda.
      */}
      {!query.trim() && !pasilloId &&
        campaigns.map((c) => (
          <CampaignRow key={c.id} store={store} campaign={c} products={products} />
        ))}

      {shown.length === 0 ? (
        /*
          Nunca decimos que el comercio no lo tiene (P5), pero el motivo de que no
          aparezca no es el mismo en los dos casos y echarle la culpa al que no
          corresponde confunde. Con la tienda completa, lo que falta es que lo suba.
          Con "mostrar solo lo que tengo" encendido, el producto puede estar
          perfectamente cargado y no aparecer porque hoy no está en la góndola: eso
          no es un catálogo incompleto, es una decisión del comerciante, y se dice.
        */
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-neutral-800">
            No encontramos nada con eso
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {store.showsOutOfStock
              ? `Puede que ${store.name} lo tenga y todavía no lo haya subido. Preguntale.`
              : `${store.name} muestra en la tienda solo lo que tiene ahora. Puede que lo consiga — preguntale.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} storeName={store.name} storeSlug={store.slug} />
          ))}
        </div>
      )}
    </>
  );
}
