'use client';

import type { Campaign, Product, Store } from '@/lib/nexopos/types';
import { ProductShelf } from './ProductShelf';

/**
 * Una campaña como estantería de la portada.
 *
 * Los productos son los que la campaña nombra **y** el catálogo trae, en el orden de
 * la campaña. El que se agotó en una tienda que esconde lo agotado no llega hasta
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
      offer={{ percent: campaign.discountPercent }}
      href={`/s/${store.slug}/ofertas/${campaign.id}`}
    />
  );
}
