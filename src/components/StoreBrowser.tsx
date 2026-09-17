'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Pasillo, Product, Store } from '@/lib/nexopos/types';
import { ProductCard } from './ProductCard';

/**
 * El buscador y el árbol de la tienda, y la grilla cuando hay algo que mostrar.
 *
 * **Acá no entra el catálogo entero.** Delfín tiene siete mil productos y Rivera
 * cinco mil: mandarlos todos al teléfono para que el navegador filtre en memoria son
 * megabytes de JSON que alguien paga con sus datos y con su batería, para navegar una
 * lista que nadie va a recorrer. El servidor manda el pedazo que se está mirando y
 * nada más.
 *
 * De ahí que la búsqueda se mande en vez de filtrar mientras se tipea: lo que se
 * busca está en el servidor. Es un viaje por búsqueda y no por tecla, que además es
 * lo que hace cualquier supermercado y lo que la gente ya espera.
 *
 * Y el estado vive en la URL, no en el componente: una góndola o una búsqueda se
 * pueden mandar por WhatsApp, que es por donde viaja todo acá.
 */
export function StoreBrowser({
  store,
  pasillos,
  pasilloId,
  subCategory,
  subCategories,
  query,
  products,
  total,
  limit,
  children,
}: {
  store: Store;
  pasillos: Pasillo[];
  pasilloId?: string;
  subCategory?: string;
  /** Los subrubros que existen de verdad en esta góndola. */
  subCategories: string[];
  query: string;
  products: Product[];
  total: number;
  limit: number;
  /** La portada, cuando no se está navegando nada. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(query);
  const navegando = Boolean(pasilloId || query);
  const base = `/s/${store.slug}`;

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
  }

  const pasilloActual = pasillos.find((p) => p.id === pasilloId);

  function chip(activo: boolean) {
    return `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      activo
        ? 'bg-neutral-900 text-white'
        : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
    }`;
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <form onSubmit={buscar} className="relative block">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={`Buscar en ${store.name}…`}
            className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pr-20 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {texto && (
            <button
              type="button"
              onClick={() => {
                setTexto('');
                if (query) router.push(base);
              }}
              aria-label="Borrar la búsqueda"
              className="absolute top-1/2 right-16 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
          >
            Buscar
          </button>
        </form>

        {pasillos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {/*
              No hay chip de "Todo". Era el que abría siete mil productos de una, y es
              justo lo que nadie va a recorrer: el que entra arranca por la portada,
              por una góndola o escribiendo una palabra.
            */}
            {navegando && (
              <Link href={base} className={chip(false)}>
                ← Inicio
              </Link>
            )}
            {pasillos.map((p) => (
              <Link
                key={p.id}
                href={`${base}?p=${encodeURIComponent(p.id)}`}
                className={chip(pasilloId === p.id)}
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}

        {/* Los subrubros de la góndola en la que estoy parado. */}
        {pasilloActual && subCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
            <Link
              href={`${base}?p=${encodeURIComponent(pasilloActual.id)}`}
              className={chip(!subCategory)}
            >
              Todo {pasilloActual.name}
            </Link>
            {subCategories.map((sc) => (
              <Link
                key={sc}
                href={`${base}?p=${encodeURIComponent(pasilloActual.id)}&s=${encodeURIComponent(sc)}`}
                className={chip(subCategory === sc)}
              >
                {sc}
              </Link>
            ))}
          </div>
        )}
      </div>

      {!navegando ? (
        children
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-neutral-800">No encontramos nada con eso</p>
          <p className="mt-1 text-sm text-neutral-500">
            {store.showsOutOfStock
              ? `Puede que ${store.name} lo tenga y todavía no lo haya subido. Preguntale.`
              : `${store.name} muestra en la tienda solo lo que tiene ahora. Puede que lo consiga — preguntale.`}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-500">
            {query ? (
              <>
                {total} {total === 1 ? 'resultado' : 'resultados'} para{' '}
                <span className="font-semibold text-neutral-800">{query}</span>
              </>
            ) : (
              <>
                {total} {total === 1 ? 'producto' : 'productos'} en{' '}
                <span className="font-semibold text-neutral-800">
                  {subCategory ?? pasilloActual?.name}
                </span>
              </>
            )}
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                storeName={store.name}
                storeSlug={store.slug}
              />
            ))}
          </div>

          {total > products.length && (
            <div className="mt-6 text-center">
              <Link
                href={`?${new URLSearchParams({
                  ...(pasilloId ? { p: pasilloId } : {}),
                  ...(subCategory ? { s: subCategory } : {}),
                  ...(query ? { q: query } : {}),
                  n: String(limit + 60),
                }).toString()}`}
                className="inline-block rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-800 hover:bg-neutral-50"
              >
                Ver más ({total - products.length} restantes)
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
