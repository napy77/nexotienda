import type { CategoryNode, Pasillo, Product } from '@/lib/nexopos/types';

/**
 * El árbol de una góndola: cómo se recorre.
 *
 * Conviven dos formas de datos y tienen que seguir conviviendo: la vieja
 * —`subCategories`, una lista plana de nombres— y la que pedimos, un árbol con ids
 * y con la profundidad que tenga. Todo lo de acá abajo trabaja sobre el árbol, y la
 * lista plana se convierte en uno de un solo nivel al entrar. Un camino de código,
 * no dos.
 *
 * **Lo que ya no se hace acá es podar.** Antes teníamos el catálogo entero en
 * memoria y descartábamos las ramas sin productos nosotros; ahora NexoPOS cuenta el
 * árbol desde los productos que el comercio tiene, así que una rama que llega es una
 * rama que tiene algo. Deducirlo de nuevo sobre las sesenta fichas que bajamos daría
 * peor: escondería ramas por no haberlas mirado.
 */
export function arbolDe(pasillo: Pasillo | undefined): CategoryNode[] {
  if (!pasillo) return [];
  if (pasillo.children?.length) return pasillo.children;
  return (pasillo.subCategories ?? []).map((name) => ({ id: name, name }));
}

/** Los nodos que cuelgan del camino elegido. `[]` es la raíz de la góndola. */
export function hijosEn(raiz: CategoryNode[], ruta: string[]): CategoryNode[] {
  return nivelYNodo(raiz, ruta).nivel;
}

/** El nodo en el que uno está parado, para poder nombrarlo. */
export function nodoEn(raiz: CategoryNode[], ruta: string[]): CategoryNode | undefined {
  return nivelYNodo(raiz, ruta).nodo;
}

function nivelYNodo(raiz: CategoryNode[], ruta: string[]) {
  let nivel = raiz;
  let nodo: CategoryNode | undefined;
  for (const id of ruta) {
    const hallado = nivel.find((n) => n.id === id);
    if (!hallado) return { nivel: [] as CategoryNode[], nodo: undefined };
    nodo = hallado;
    nivel = hallado.children ?? [];
  }
  return { nivel, nodo };
}

/** Todos los nombres de una rama, ella incluida. */
function nombresDe(nodo: CategoryNode): string[] {
  return [nodo.name, ...(nodo.children ?? []).flatMap(nombresDe)];
}

/**
 * Un nodo por id, esté a la profundidad que esté.
 *
 * Es la semántica del parámetro `sub` de la API: viaja **solo el nodo más profundo
 * elegido**, no el camino. Mandar el camino entero obligaría a que los dos lados
 * coincidan en cómo se llega, cuando lo único que hace falta es saber a dónde.
 */
export function nodoPorId(nodos: CategoryNode[], id: string): CategoryNode | undefined {
  for (const n of nodos) {
    if (n.id === id) return n;
    const hallado = nodoPorId(n.children ?? [], id);
    if (hallado) return hallado;
  }
  return undefined;
}

/**
 * Los productos de una rama. **Solo lo usan los fixtures**: contra la API de verdad
 * esto lo resuelve NexoPOS, que es donde están las filas.
 *
 * Se aceptan la rama y todo lo que cuelga: el producto puede estar clasificado en el
 * rubro ("Aceites y aderezos") o en la hoja ("Aceites de oliva"), según cuán prolijo
 * esté el catálogo de ese comercio. Pedir la hoja exacta escondería la mitad de la
 * góndola de los que cargaron grueso.
 */
export function productosDe(
  productos: Product[],
  raiz: CategoryNode[],
  subId: string | undefined,
): Product[] {
  if (!subId) return productos;
  const nodo = nodoPorId(raiz, subId);
  if (!nodo) return [];
  const nombres = new Set(nombresDe(nodo));
  return productos.filter((p) => p.subCategory && nombres.has(p.subCategory));
}
