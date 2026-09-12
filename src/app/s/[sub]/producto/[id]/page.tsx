import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Barcode, Sparkles } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { money } from '@/lib/format';
import { AvailabilityNote } from '@/components/Availability';
import { AddToCart } from '@/components/AddToCart';
import { StoreShell } from '@/components/StoreShell';
import { ProductGallery } from '@/components/ProductGallery';

type Props = { params: Promise<{ sub: string; id: string }> };

/**
 * El detalle es una ruta y no un modal a propósito: el producto tiene que tener URL
 * propia para poder mandarlo por WhatsApp, que es por donde viaja todo acá.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sub, id } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) return { title: 'NexoTienda' };
  const product = await nexopos.getProduct(store.id, id);
  if (!product) return { title: store.name };

  return {
    title: `${product.name} · ${store.name}`,
    description: product.description ?? `${product.name} en ${store.name}, ${store.town}.`,
    openGraph: {
      title: `${product.name} — ${money(product.priceCents)}`,
      description: `En ${store.name}, ${store.town}`,
      // Todas: WhatsApp toma la primera, pero el resto sirve en otros lados.
      images: product.images.length ? product.images : undefined,
    },
  };
}

export default async function ProductoPage({ params }: Props) {
  const { sub, id } = await params;
  const store = await nexopos.getStore(sub);
  if (!store) notFound();
  const product = await nexopos.getProduct(store.id, id);
  if (!product) notFound();

  return (
    <StoreShell store={store}>
      <Link
        href={`/s/${store.slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la tienda
      </Link>

      <div className="grid gap-6 rounded-xl border border-neutral-200 bg-white p-5 md:grid-cols-2 md:p-8">
        <ProductGallery images={product.images} alt={product.name} />

        <div className="flex flex-col">
          {product.brand && (
            <p className="text-xs font-medium tracking-wider text-neutral-400 uppercase">
              {product.brand}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-900">
            {product.name}
          </h1>

          <div className="mt-4 flex items-baseline gap-2">
            {product.listPriceCents && product.listPriceCents > product.priceCents && (
              <span className="text-base text-neutral-400 line-through">
                {money(product.listPriceCents)}
              </span>
            )}
            <span className="text-3xl font-black text-neutral-900">
              {money(product.priceCents)}
            </span>
            <span className="text-sm text-neutral-500">/ {product.unit}</span>
          </div>

          <AvailabilityNote availability={product.availability} />

          {product.description && (
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">{product.description}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {product.origin === 'canonico' ? (
              <span className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-semibold text-neutral-600">
                <Barcode className="h-3 w-3" />
                Catálogo Nexo B2B
                {product.ean && <span className="ml-1 text-neutral-400">{product.ean}</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                <Sparkles className="h-3 w-3" />
                Hecho en {store.name}
              </span>
            )}
          </div>

          <div className="mt-auto pt-6">
            <AddToCart product={product} />
          </div>
        </div>
      </div>
    </StoreShell>
  );
}
