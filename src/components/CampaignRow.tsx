'use client';

import type { Campaign, Product, Store } from '@/lib/nexopos/types';
import { ProductShelf } from './ProductShelf';

/**
 * Una campaña como estantería de la portada.
 *
 * Los productos van **en el orden de la campaña, sin reordenar**. Ese orden lo
 * arrastró el comerciante: si tiene algo que empieza con Z y quiere que se vea
 * primero, puede. Ordenarlo por nombre o por precio de este lado le borraría la
 * decisión sin que nadie lo note — y la fila muestra los primeros, así que el orden
 * decide qué se ve sin tocar "Ver todas".
 *
 * Son los que la campaña nombra **y** el catálogo trae. El que se agotó en una tienda que esconde lo agotado no llega hasta
 * acá, y si no queda ninguno la sección desaparece sola: nadie tiene que mantener
 * las dos listas sincronizadas.
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
  const porId = new Map(products.map((p) => [p.id, p]));
  const enOferta = campaign.productIds
    .map((id) => porId.get(id))
    .filter((p): p is Product => p !== undefined);

  return (
    <ProductShelf
      title={campaign.name}
      store={store}
      products={enOferta}
      offer
      hasta={campaign.discountPercent}
      href={`/s/${store.slug}/ofertas/${campaign.id}`}
    />
  );
}
