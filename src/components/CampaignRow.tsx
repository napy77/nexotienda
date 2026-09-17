'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Campaign, Product, Store } from '@/lib/nexopos/types';
import { ProductCard } from './ProductCard';

/**
 * Una tanda de ofertas en la home.
 *
 * **Sin campañas no hay sección.** Ni título, ni fila vacía, ni "no hay ofertas por
 * ahora": el comercio que no hace ofertas es el caso normal, y dibujarle un hueco lo
 * hace parecer incompleto. Con dos campañas hay dos secciones, una abajo de la otra.
 *
 * La fila se corre con el dedo en vez de cortar en seco a un número fijo de
 * tarjetas: el ancho lo pone la pantalla y no nosotros, y en un teléfono deslizar es
 * el gesto que la gente ya hace. Lo que no entra igual está atrás de "Ver todas",
 * para el que prefiere la grilla.
 */
export function CampaignRow({
  store,
  campaign,
  products,
}: {
  store: Store;
  campaign: Campaign;
  products: Product[];
}) {
  // Los que la campaña nombra y el catálogo trae, en el orden de la campaña. Un
  // producto agotado en una tienda que esconde lo agotado no llega hasta acá, y no
  // hay que cruzar nada para que desaparezca de la oferta.
  const porId = new Map(products.map((p) => [p.id, p]));
  const enOferta = campaign.productIds
    .map((id) => porId.get(id))
    .filter((p): p is Product => p !== undefined);

  if (enOferta.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-black tracking-tight text-neutral-900">{campaign.name}</h2>
        <Link
          href={`/s/${store.slug}/ofertas/${campaign.id}`}
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-blue-700 hover:underline"
        >
          Ver todas
          <ChevronRight className="h-4 w-4" />
        </Link>
        <span className="ml-auto text-xs text-neutral-500">
          {enOferta.length} {enOferta.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {enOferta.map((p) => (
          <div key={p.id} className="w-44 shrink-0 snap-start sm:w-52">
            <ProductCard
              product={p}
              storeName={store.name}
              storeSlug={store.slug}
              offer={{ percent: campaign.discountPercent }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
