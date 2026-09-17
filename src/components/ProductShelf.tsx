'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Product, Store } from '@/lib/nexopos/types';
import { ProductCard } from './ProductCard';

/**
 * Una estantería: título, una fila de productos y a otra cosa.
 *
 * Es la unidad de la portada. Campañas, lo más vendido, lo más buscado y lo que
 * esta persona suele llevar son la misma forma con distinto contenido, y conviene
 * que se vean igual: el que entra no tiene que aprender cuatro layouts.
 *
 * La fila se corre con el dedo en lugar de cortar a un número fijo de tarjetas —el
 * ancho lo pone la pantalla, no nosotros— y **una estantería sin productos no se
 * dibuja**. Nunca un título con un hueco abajo.
 */
export function ProductShelf({
  title,
  store,
  products,
  offer,
  href,
  hrefLabel = 'Ver todas',
}: {
  title: string;
  store: Store;
  products: Product[];
  offer?: { percent: number };
  href?: string;
  hrefLabel?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-black tracking-tight text-neutral-900">{title}</h2>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-blue-700 hover:underline"
          >
            {hrefLabel}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
        <span className="ml-auto text-xs text-neutral-500">
          {products.length} {products.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0 snap-start sm:w-52">
            <ProductCard
              product={p}
              storeName={store.name}
              storeSlug={store.slug}
              offer={offer}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
