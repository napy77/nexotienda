import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, MapPin, Clock } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { Catalog } from '@/components/Catalog';
import { ContactButton, StoreShell } from '@/components/StoreShell';
import { StoreHero } from '@/components/StoreHero';
import { TownSearch } from '@/components/TownSearch';
import { ValueProps } from '@/components/ValueProps';

/** Mientras no exista el handoff desde ClubPay, la persona de prueba es fija. */
const DEMO_PERSON = 'per_7f3a91c2';

/** Foto de portada por comercio. Cuando NexoPOS la exponga, sale del `Store`. */
const COVERS: Record<string, string> = {
  supersol: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80',
  donarosa: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80',
};

type Props = { params: Promise<{ sub: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub } = await params;
  const resolved = await nexopos.resolveHost(sub);
  if (!resolved) return { title: 'NexoTienda' };

  // El link de la tienda viaja por WhatsApp: el preview tiene que decir algo útil.
  if (resolved.kind === 'town') {
    return {
      title: `Comercios de ${resolved.name}`,
      description: `Buscá qué comercio de ${resolved.name} tiene lo que necesitás.`,
    };
  }
  const s = resolved.store;
  return {
    title: `${s.name} · ${s.town}`,
    description: `${s.category} en ${s.town}. ${s.address}`,
    openGraph: {
      title: `${s.name} · ${s.town}`,
      description: `${s.category} en ${s.town}`,
      images: s.logoUrl ? [s.logoUrl] : undefined,
    },
  };
}

export default async function SubdomainPage({ params }: Props) {
  const { sub } = await params;
  const resolved = await nexopos.resolveHost(sub);
  if (!resolved) notFound();

  if (resolved.kind === 'town') {
    const stores = await nexopos.listTownStores(resolved.townSlug);
    return <TownSearch townSlug={resolved.townSlug} townName={resolved.name} stores={stores} />;
  }

  const store = resolved.store;

  // Comercio con cartel pero sin tienda publicada (D16). No inventamos un catálogo
  // vacío: mostramos lo que sabemos y lo marcamos como no verificado si lo es (P5).
  if (!store.storefrontPublished) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-neutral-900">
            {store.name}
            {store.verified && <BadgeCheck className="h-5 w-5 text-blue-600" />}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{store.category}</p>

          <dl className="mt-6 space-y-2 text-sm text-neutral-700">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <dd>{store.address}</dd>
            </div>
            {store.openingHours && (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <dd>{store.openingHours}</dd>
              </div>
            )}
          </dl>

          <p className="mt-6 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
            {store.name} todavía no publicó su tienda online. Si tenés cuenta corriente con
            ellos, la ves igual desde ClubPay.
          </p>

          <div className="mt-5">
            <ContactButton store={store} />
          </div>

          {!store.verified && (
            <p className="mt-4 text-xs text-neutral-500">
              Estos datos no fueron confirmados por el comercio.
            </p>
          )}
        </div>
      </main>
    );
  }

  const [pasillos, products, account] = await Promise.all([
    nexopos.listPasillos(store.id),
    nexopos.listProducts(store.id),
    nexopos.getAccount(DEMO_PERSON, store.id),
  ]);

  return (
    <StoreShell store={store} bleed={<StoreHero store={store} coverUrl={COVERS[store.slug]} />}>
      <ValueProps store={store} account={account} />
      <Catalog store={store} pasillos={pasillos} products={products} />
    </StoreShell>
  );
}
