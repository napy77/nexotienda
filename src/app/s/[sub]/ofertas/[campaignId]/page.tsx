import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { StoreShell } from '@/components/StoreShell';
import { OfferGrid } from '@/components/OfferGrid';

type Props = { params: Promise<{ sub: string; campaignId: string }> };

/**
 * Todos los productos de una campaña.
 *
 * Tiene URL propia porque es lo que el comerciante va a mandar por WhatsApp: el
 * link a "Ofertas imperdibles" de su tienda, no a la tienda entera.
 */
export default async function OfertasPage({ params }: Props) {
  const { sub, campaignId } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();

  const [campaigns, products] = await Promise.all([
    nexopos.listCampaigns(store.id),
    nexopos.listProducts(store.id),
  ]);

  const campaign = campaigns.find((c) => c.id === campaignId);
  // Una campaña que se venció mientras el link daba vueltas por WhatsApp no es un
  // error del que entró: es que se terminó.
  if (!campaign) {
    return (
      <StoreShell store={store}>
        <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-neutral-800">Esa promoción ya terminó</p>
          <p className="mt-1 text-sm text-neutral-500">
            {store.name} puede tener otras. Date una vuelta por la tienda.
          </p>
          <Link
            href={`/s/${store.slug}`}
            className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline"
          >
            Ir a la tienda
          </Link>
        </div>
      </StoreShell>
    );
  }

  const porId = new Map(products.map((p) => [p.id, p]));
  const enOferta = campaign.productIds
    .map((id) => porId.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  return (
    <StoreShell store={store}>
      <Link
        href={`/s/${store.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la tienda
      </Link>

      <h1 className="text-2xl font-black tracking-tight text-neutral-900">{campaign.name}</h1>
      <p className="mt-1 mb-5 text-sm text-neutral-500">
        {enOferta.length} {enOferta.length === 1 ? 'producto' : 'productos'} en {store.name}
      </p>

      <OfferGrid store={store} products={enOferta} percent={campaign.discountPercent} />
    </StoreShell>
  );
}
