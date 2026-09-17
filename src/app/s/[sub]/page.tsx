import type { Metadata } from 'next';
import { arbolDe } from '@/lib/arbol';
import { notFound, permanentRedirect } from 'next/navigation';
import { BadgeCheck, MapPin, Clock } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { libretaDeLaSesion } from '@/lib/libreta';
import { StoreBrowser } from '@/components/StoreBrowser';
import { StoreHome } from '@/components/StoreHome';
import { LibretaBar } from '@/components/LibretaBar';
import { ContactButton, StoreShell } from '@/components/StoreShell';
import { StoreHero } from '@/components/StoreHero';
import { TownSearch } from '@/components/TownSearch';
import { ValueProps } from '@/components/ValueProps';

type Props = {
  params: Promise<{ sub: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** El primero de los valores, cuando la URL trae el parámetro repetido. */
function uno(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x?.trim() ? x.trim() : undefined;
}

/**
 * El camino dentro de la góndola, como `s` repetido:
 * `?p=despensa&s=Aceites+y+Aderezos&s=Aceites+de+oliva`.
 *
 * Repetir el parámetro en vez de inventar `s`, `s2`, `s3` es lo que deja que el
 * árbol tenga la profundidad que tenga sin volver a tocar esto.
 */
function camino(v: string | string[] | undefined): string[] {
  const xs = Array.isArray(v) ? v : v ? [v] : [];
  return xs.map((x) => x.trim()).filter(Boolean).slice(0, 6);
}

const DE_A = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub } = await params;
  const resolved = await nexopos.resolveHost(sub);
  if (!resolved) return { title: 'NexoTienda' };

  // El link de la tienda viaja por WhatsApp: el preview tiene que decir algo útil.
  if (resolved.kind === 'moved') return { title: 'NexoTienda' };
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

export default async function SubdomainPage({ params, searchParams }: Props) {
  const { sub } = await params;
  const resolved = await nexopos.resolveHost(sub);
  if (!resolved) notFound();

  // El comercio cambió de dirección. Los links viejos siguen circulando por
  // WhatsApp —el estado del súper, el grupo del barrio— y dejarlos morir sería
  // matar ventas que ya estaban hechas.
  if (resolved.kind === 'moved') {
    permanentRedirect(`https://${resolved.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'nexotienda.app'}`);
  }

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

  const sp = await searchParams;
  const pasilloId = uno(sp.p);
  const ruta = camino(sp.s);
  const query = uno(sp.q) ?? '';
  const limit = Math.min(Math.max(Number(uno(sp.n)) || DE_A, DE_A), 600);
  const navegando = Boolean(pasilloId || query);

  const [pasillos, campaigns, highlights, libreta] = await Promise.all([
    nexopos.listPasillos(store.id),
    nexopos.listCampaigns(store.id),
    nexopos.listHighlights(store.id),
    libretaDeLaSesion(store),
  ]);
  const { account, displayName: accountName } = libreta;

  const arbol = arbolDe(pasillos.find((p) => p.id === pasilloId));

  /*
    Se pide lo que se va a mostrar y nada más.

    Antes se traía el catálogo completo y se filtraba acá: para una góndola de
    sesenta productos eso eran siete mil filas de Delfín, de las que se descartaban
    6.940. El filtro vive ahora donde están las filas, y del árbol solo viaja el nodo
    más profundo elegido — NexoPOS resuelve la rama entera.
  */
  const pagina = navegando
    ? await nexopos.listProducts(store.id, {
        pasillo: pasilloId,
        sub: ruta[ruta.length - 1],
        q: query || undefined,
        limit,
      })
    : { items: [], total: 0 };

  // Para la portada alcanza con lo que las estanterías nombran. Los ids se juntan
  // en una sola consulta en vez de una por estantería.
  const idsDeEstanterias = navegando
    ? []
    : [
        ...new Set([
          ...campaigns.flatMap((c) => c.productIds),
          ...highlights.bestSellers,
          ...highlights.mostSearched,
        ]),
      ];
  const [deEstanterias, muestra] = navegando
    ? [[], []]
    : await Promise.all([
        nexopos.productsByIds(store.id, idsDeEstanterias),
        // El relleno de la tienda sin campañas ni estadística. Doce, no siete mil.
        idsDeEstanterias.length === 0
          ? nexopos.listProducts(store.id, { limit: 12 }).then((r) => r.items)
          : Promise.resolve([]),
      ]);

  return (
    <StoreShell store={store} bleed={<StoreHero store={store} coverUrl={store.bannerUrl} />}>
      <LibretaBar
        store={store}
        accountName={accountName}
        vencio={uno(sp.libreta) === 'vencio'}
        caduca={libreta.caduca}
      />
      <ValueProps store={store} account={account} campaigns={campaigns} pasillos={pasillos} />
      <StoreBrowser
        store={store}
        pasillos={pasillos}
        pasilloId={pasilloId}
        ruta={ruta}
        arbol={arbol}
        query={query}
        products={pagina.items}
        total={pagina.total}
        limit={limit}
      >
        <StoreHome
          store={store}
          campaigns={campaigns}
          highlights={highlights}
          products={deEstanterias}
          fallback={muestra}
          gondolas={pasillos.length}
        />
      </StoreBrowser>
    </StoreShell>
  );
}
