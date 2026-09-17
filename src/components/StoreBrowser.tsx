'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { CategoryNode, Pasillo, Product, Store } from '@/lib/nexopos/types';
import { hijosEn, nodoEn } from '@/lib/arbol';
import { ProductCard } from './ProductCard';

/**
 * Una fila de chips que no se desborda.
 *
 * Una góndola de un supermercado real tiene cuarenta ramas. Cuarenta botones
 * apilados no son un índice: son una pared, y la pared se saltea. Se muestran los
 * primeros y el resto queda atrás de un botón, que es una decisión de quien mira y
 * no nuestra.
 */
const A_LA_VISTA = 12;

function ChipRow({
  items,
  className = '',
}: {
  items: { key: string; label: string; href: string; active: boolean }[];
  className?: string;
}) {
  const [todo, setTodo] = useState(false);
  if (items.length === 0) return null;

  const hayDeMas = !todo && items.length > A_LA_VISTA + 2;
  const visibles = hayDeMas ? items.slice(0, A_LA_VISTA) : items;

  const chip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      activo
        ? 'bg-neutral-900 text-white'
        : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
    }`;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {visibles.map((i) => (
        <Link key={i.key} href={i.href} className={chip(i.active)}>
          {i.label}
        </Link>
      ))}
      {hayDeMas && (
        <button
          onClick={() => setTodo(true)}
          className="rounded-full border border-dashed border-neutral-400 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
        >
          Ver los {items.length - A_LA_VISTA} restantes
        </button>
      )}
    </div>
  );
}

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
  ruta,
  arbol,
  query,
  products,
  total,
  limit,
  children,
}: {
  store: Store;
  pasillos: Pasillo[];
  pasilloId?: string;
  /** El camino elegido, por id de nodo: `['r:Aceites', 's:Girasol']`. */
  ruta: string[];
  /** El árbol de la góndola, ya podado a lo que tiene productos. */
  arbol: CategoryNode[];
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

  /** La URL de un camino dentro de la góndola actual. */
  function url(camino: string[]) {
    const qs = new URLSearchParams();
    if (pasilloId) qs.set('p', pasilloId);
    for (const paso of camino) qs.append('s', paso);
    return `${base}?${qs.toString()}`;
  }

  /*
    Un nivel por vez, y solo el del camino elegido.

    "Almacén" no se abre en cuarenta subrubros: se abre en rubros, y recién el rubro
    en sus hojas. Mostrar los tres niveles juntos es lo que convertía la góndola en
    un muro de botones donde "Aceites de oliva" quedaba entre "Alfajores" y "Arroz",
    sin ninguna pista de que los tres no son hermanos.
  */
  const niveles = pasilloActual
    ? Array.from({ length: ruta.length + 1 }, (_, i) => ({
        prefijo: ruta.slice(0, i),
        hijos: hijosEn(arbol, ruta.slice(0, i)),
      })).filter((n) => n.hijos.length > 0)
    : [];

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

        {/*
          No hay chip de "Todo". Era el que abría siete mil productos de una, y es
          justo lo que nadie va a recorrer: el que entra arranca por la portada, por
          una góndola o escribiendo una palabra.
        */}
        <ChipRow
          items={[
            ...(navegando
              ? [{ key: '__inicio', label: '← Inicio', href: base, active: false }]
              : []),
            ...pasillos.map((p) => ({
              key: p.id,
              label: p.name,
              href: `${base}?p=${encodeURIComponent(p.id)}`,
              active: pasilloId === p.id,
            })),
          ]}
        />

        {niveles.map(({ prefijo, hijos }, i) => (
          <ChipRow
            key={i}
            className="border-t border-neutral-200 pt-3"
            items={[
              {
                key: '__todo',
                label: `Todo ${nodoEn(arbol, prefijo)?.name ?? pasilloActual!.name}`,
                href: url(prefijo),
                active: ruta.length === prefijo.length,
              },
              ...hijos.map((h: CategoryNode) => ({
                key: h.id,
                label: h.name,
                href: url([...prefijo, h.id]),
                active: ruta[prefijo.length] === h.id,
              })),
            ]}
          />
        ))}
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
                  {nodoEn(arbol, ruta)?.name ?? pasilloActual?.name}
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
                href={`${query ? `${base}?q=${encodeURIComponent(query)}` : url(ruta)}&n=${limit + 60}`}
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
