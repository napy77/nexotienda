/**
 * Lo que este teléfono ya compró en este comercio.
 *
 * **Vive en el navegador y no en el servidor, y eso es lo que lo hace servir.** El
 * camino normal de compra es anónimo: alguien entra, pone dos paquetes de harina y
 * paga al recibirlos, sin cuenta y sin ClubPay. Un "lo que solés llevar" atado al
 * `accountId` funcionaría para la minoría que tiene libreta; atado al navegador
 * funciona para casi todos, que es de quienes se trata.
 *
 * No viaja a ningún lado. No hay nada que cruzar, nada que filtrar y nada que
 * pedirle a nadie: es la lista de compras de esta persona, en el aparato de esta
 * persona. Si cambia de teléfono la pierde, y está bien que la pierda.
 *
 * Es por comercio, como todo acá: la harina que compra en el almacén no le dice
 * nada a la ferretería (P3).
 */
const TOPE = 24;

function clave(slug: string) {
  return `nexotienda:comprados:${slug}`;
}

export function leerComprados(slug: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const crudo = window.localStorage.getItem(clave(slug));
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // Modo incógnito, almacenamiento bloqueado, JSON de otra versión. Ninguna de
    // esas es razón para que la tienda deje de funcionar.
    return [];
  }
}

/** Lo último comprado va adelante: lo de esta semana pesa más que lo de marzo. */
export function anotarComprados(slug: string, productIds: string[]) {
  if (typeof window === 'undefined' || productIds.length === 0) return;
  try {
    const previos = leerComprados(slug).filter((id) => !productIds.includes(id));
    const lista = [...productIds, ...previos].slice(0, TOPE);
    window.localStorage.setItem(clave(slug), JSON.stringify(lista));
  } catch {
    // Que no se pueda guardar el historial no puede romper un pedido que ya salió.
  }
}
