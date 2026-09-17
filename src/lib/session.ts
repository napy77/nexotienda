import { cookies } from 'next/headers';

/**
 * Quién está comprando.
 *
 * El caso normal es **nadie**: alguien entra a `supersol.nexotienda.app`, pone dos
 * paquetes de harina en el changuito y paga al recibirlos. Sin cuenta, sin ClubPay,
 * sin identificarse. Esa es la venta que va a ser la mayoría.
 *
 * ---
 *
 * **Acá no existe estar logueado, y no es una carencia: es P3 metido en el frasco.**
 *
 * La cookie es por comercio —`nt_acc_jure`— así que no hay, en ningún lado del
 * sistema, un estado que diga "esta persona es Germán Yovan". Hay, como mucho, "en
 * esta tienda está abierta la libreta `acc_jure_4b91`". La sesión en el almacén no
 * es la misma identidad que en la ferretería, y no hay ninguna clave que las una.
 *
 * Por eso NexoTienda **nunca autentica a nadie**. Recibe una prueba que emitió
 * ClubPay, la canjea del lado del servidor y abre una libreta. No hay contraseñas,
 * no hay recuperación de cuenta, no hay usuarios. Un login propio sería una segunda
 * identidad que tendría que coincidir con la de ClubPay, y el uno por ciento en que
 * no coincidan es alguien viendo la deuda de otro.
 *
 * La libreta se sigue autorizando en el mostrador, con el cliente presente y con DNI
 * (D23). Esto es solo la llave de la puerta, no el permiso.
 */
const DIAS = 30;

export function accountCookieName(storeSlug: string): string {
  return `nt_acc_${storeSlug}`;
}

function nameCookieName(storeSlug: string): string {
  return `nt_who_${storeSlug}`;
}

export async function getAccountId(storeSlug: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(accountCookieName(storeSlug))?.value ?? null;
}

/**
 * De quién es la libreta que está abierta.
 *
 * Se muestra siempre que haya sesión. Acá los teléfonos se comparten —el de la casa,
 * el del padre, el que quedó sobre la mesa— y una libreta abierta sin nombre es una
 * puerta que nadie sabe que quedó abierta. Que diga "Germán Yovan" al lado del
 * "Salir" no es cortesía: es lo que hace que el que agarra el teléfono se dé cuenta.
 */
export async function getAccountName(storeSlug: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(nameCookieName(storeSlug))?.value || null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DIAS * 24 * 60 * 60,
};

export const sessionCookies = {
  acc: accountCookieName,
  who: nameCookieName,
};
