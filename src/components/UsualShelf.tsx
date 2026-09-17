'use client';

import { useEffect, useState } from 'react';
import type { Product, Store } from '@/lib/nexopos/types';
import { leerComprados } from '@/lib/historial';
import { productsByIdAction } from '@/app/actions';
import { ProductShelf } from './ProductShelf';

/**
 * "Lo que solés llevar": lo que este teléfono ya compró acá.
 *
 * Los ids los sabe recién el navegador, así que los productos se piden después de
 * montar. No hay esqueleto ni "cargando": la estantería aparece cuando hay algo que
 * poner, y en la primera compra de alguien no aparece nunca — que es lo correcto,
 * porque no hay nada que mostrar y un cartel diciéndolo no le sirve a nadie.
 *
 * Lo que ya no está en el catálogo —se dejó de vender, se agotó en una tienda que
 * esconde lo agotado— simplemente no vuelve, sin que haya que limpiar nada.
 */
export function UsualShelf({ store }: { store: Store }) {
  const [habituales, setHabituales] = useState<Product[]>([]);

  useEffect(() => {
    const ids = leerComprados(store.slug);
    if (ids.length === 0) return;
    let vivo = true;
    productsByIdAction(store.id, ids)
      .then((ps) => {
        if (vivo) setHabituales(ps.slice(0, 12));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [store.id, store.slug]);

  return <ProductShelf title="Lo que solés llevar" store={store} products={habituales} />;
}
