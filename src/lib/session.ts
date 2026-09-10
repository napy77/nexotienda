import { cookies } from 'next/headers';

/**
 * Quién está comprando.
 *
 * El caso normal es **nadie**: alguien entra a `supersol.nexotienda.app`, pone dos
 * paquetes de harina en el changuito y paga al recibirlos. No hace falta cuenta, ni
 * ClubPay, ni identificarse. Esa es la venta que va a ser la mayoría.
 *
 * La cuenta corriente es lo excepcional: se autoriza **en el mostrador, en NexoPOS,
 * con el cliente presente** (D23), y la persona la vincula desde ClubPay (D25). Si
 * eso no pasó, en el checkout la opción se ve pero está grisada.
 *
 * El `accountId` es de la relación persona–comercio, no de la persona: no existe
 * ninguna clave que identifique al comprador a través del pueblo. La sesión en la
 * tienda de SuperSOL no es la misma identidad que en la de la ferretería.
 *
 * TODO: hoy esto lee una cookie que se planta a mano para poder probar. Cuando
 * exista, se reemplaza por el canje del token de un solo uso que emite ClubPay: la
 * app pide el token, NexoTienda lo canjea contra NexoPOS y recibe el `accountId`.
 * **Nunca un id en la query string** — un id permanente en un link es una credencial
 * que no vence nunca.
 */
export async function getAccountId(storeSlug: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(`nt_acc_${storeSlug}`)?.value ?? null;
}

export function accountCookieName(storeSlug: string): string {
  return `nt_acc_${storeSlug}`;
}
