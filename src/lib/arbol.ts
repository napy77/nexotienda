import type { CategoryNode, Pasillo, Product } from '@/lib/nexopos/types';

/**
 * El árbol de una góndola: cómo se recorre y qué cae en cada rama.
 *
 * Hay dos formas de datos que tienen que convivir. La vieja —`subCategories`, una
 * lista plana— y la que pedimos, un árbol con la profundidad que tenga. Todo lo de
 * acá abajo trabaja sobre el árbol, y la lista plana se convierte en un árbol de un
 * nivel al entrar. Así hay un solo camino de código en vez de dos.
 */
export function arbolDe(pasillo: Pasillo | undefined): CategoryNode[] {
  if (!pasillo) return [];
  if (pasillo.children?.length) return pasillo.children;
  return (pasillo.subCategories ?? []).map((name) => ({ name }));
}

/** Los nodos que cuelgan del camino elegido: `[]` es la raíz de la góndola. */
export function hijosEn(raiz: CategoryNode[], ruta: string[]): CategoryNode[] {
  let nivel = raiz;
  for (const nombre of ruta) {
    const nodo = nivel.find((n) => n.name === nombre);
    if (!nodo) return [];
    nivel = nodo.children ?? [];
  }
  return nivel;
}

function buscar(nivel: CategoryNode[], ruta: string[]): CategoryNode | undefined {
  let nodo: CategoryNode | undefined;
  let actual = nivel;
  for (const nombre of ruta) {
    nodo = actual.find((n) => n.name === nombre);
    if (!nodo) return undefined;
    actual = nodo.children ?? [];
  }
  return nodo;
}

/** Todos los nombres de una rama, ella incluida. */
function nombresDe(nodo: CategoryNode): string[] {
  return [nodo.name, ...(nodo.children ?? []).flatMap(nombresDe)];
}

/**
 * Los productos de una rama.
 *
 * Se aceptan **la rama y todo lo que cuelga**: el producto puede estar clasificado
 * en el rubro ("Aceites y aderezos") o en la hoja ("Aceites de oliva"), según cuán
 * prolijo esté el catálogo de ese comercio. Pedir la hoja exacta escondería la mitad
 * de la góndola de los que cargaron grueso.
 */
export function productosDe(
  productos: Product[],
  raiz: CategoryNode[],
  ruta: string[],
): Product[] {
  if (ruta.length === 0) return productos;
  const nodo = buscar(raiz, ruta);
  if (!nodo) return [];
  const nombres = new Set(nombresDe(nodo));
  return productos.filter((p) => p.subCategory && nombres.has(p.subCategory));
}

/**
 * Poda: solo las ramas que tienen algo.
 *
 * Un rubro vacío ofrecido en pantalla promete una góndola y entrega un cartel de
 * "no hay nada" — y el que lo tocó no piensa "qué raro, está vacío", piensa que la
 * tienda anda mal. El catálogo maestro trae el árbol entero del rubro; el comercio
 * tiene una fracción.
 */
export function podar(nodos: CategoryNode[], conProductos: Set<string>): CategoryNode[] {
  return nodos
    .map((n) => ({ ...n, children: podar(n.children ?? [], conProductos) }))
    .filter((n) => conProductos.has(n.name) || (n.children?.length ?? 0) > 0)
    .map((n) => (n.children?.length ? n : { name: n.name }));
}
