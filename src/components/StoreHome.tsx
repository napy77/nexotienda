import type { Campaign, Highlights, Product, Store } from '@/lib/nexopos/types';
import { CampaignRow } from './CampaignRow';
import { ProductShelf } from './ProductShelf';
import { UsualShelf } from './UsualShelf';

/**
 * La portada de la tienda.
 *
 * Antes acá se abría el catálogo entero. Con un almacén de ochenta productos eso
 * pasaba por una decisión de diseño; con Delfín, que tiene siete mil, es una pared:
 * nadie recorre siete mil tarjetas, y armarlas cuesta megabytes que paga el que
 * entró. La portada ahora es un puñado de estanterías y la grilla aparece cuando
 * alguien elige una góndola o escribe una palabra.
 *
 * **Las estanterías con nombre propio solo existen si el dato existe.** "Los más
 * vendidos" es una afirmación sobre lo que pasa en ese mostrador, y si la arma una
 * heurística nuestra es una afirmación falsa (P5). Acá se nota más que en cualquier
 * otro lado: el almacenero sabe de memoria qué es lo que más vende, y una lista que
 * diga otra cosa le enseña en dos segundos que la pantalla inventa. Mientras no haya
 * estadística va una muestra, sin título que prometa nada.
 */
export function StoreHome({
  store,
  campaigns,
  highlights,
  products,
  fallback,
}: {
  store: Store;
  campaigns: Campaign[];
  highlights: Highlights;
  products: Product[];
  fallback: Product[];
}) {
  const porId = new Map(products.map((p) => [p.id, p]));
  const traer = (ids: string[]) =>
    ids.map((id) => porId.get(id)).filter((p): p is Product => p !== undefined);

  const masVendidos = traer(highlights.bestSellers).slice(0, 10);
  const masBuscados = traer(highlights.mostSearched).slice(0, 10);

  // Si no hay ni campañas ni estadística, la muestra evita que la portada quede en
  // blanco. Cuando hay algo que decir, no hace falta rellenar.
  const vacia = campaigns.length === 0 && masVendidos.length === 0 && masBuscados.length === 0;

  return (
    <>
      {campaigns.map((c) => (
        <CampaignRow key={c.id} store={store} campaign={c} products={products} />
      ))}

      <ProductShelf title="Los más vendidos" store={store} products={masVendidos} />
      <ProductShelf title="Los más buscados" store={store} products={masBuscados} />

      {/* Del navegador, no del servidor: el comprador anónimo también tiene historia. */}
      <UsualShelf store={store} />

      {vacia && <ProductShelf title="Para empezar" store={store} products={fallback} />}

      <p className="mt-2 text-center text-sm text-neutral-500">
        Buscá lo que necesitás o elegí una góndola de acá arriba.
      </p>
    </>
  );
}
