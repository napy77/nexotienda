'use client';

import type { Product, Store } from '@/lib/nexopos/types';
import { ProductCard } from './ProductCard';

/** La grilla de una campaña. Cliente porque las tarjetas tocan el carrito. */
export function OfferGrid({
  store,
  products,
  percent,
}: {
  store: Store;
  products: Product[];
  percent: number;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-neutral-800">
          No quedan productos de esta promoción
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Puede que se hayan agotado. Preguntale a {store.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          storeName={store.name}
          storeSlug={store.slug}
          offer={{ percent }}
        />
      ))}
    </div>
  );
}
