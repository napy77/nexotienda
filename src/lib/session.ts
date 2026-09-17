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
 * La cookie es por comercio —`nt_lib_jure`— así que no hay, en ningún lado del
 * sistema, un estado que diga "esta persona es Germán Yovan". Hay, como mucho, "en
 * esta tienda está abierta la libreta `CLI-4231`". La sesión en el almacén no es la
 * misma identidad que en la ferretería, y no hay ninguna clave que las una.
 *
 * Por eso NexoTienda **nunca autentica a nadie**. Recibe una prueba que emitió
 * ClubPay, la canjea del lado del servidor y abre una libreta. No hay contraseñas, no
 * hay recuperación de cuenta, no hay usuarios. Un login propio sería una segunda
 * identidad que tendría que coincidir con la de ClubPay, y el uno por ciento en que
 * no coincidan es alguien viendo la deuda de otro.
 *
 * La libreta se sigue autorizando en el mostrador, con el cliente presente y con DNI
 * (D23). Esto es solo la llave de la puerta, no el permiso.
 */
const DIAS = 30;

export interface Sesion {
  accountId: string;
  displayName: string;
  /** El `linkedAt` que tenía el vínculo cuando se abrió la sesión. Ver `libreta.ts`. */
  linkedAt?: string;
}

export function sessionCookieName(storeSlug: string): string {
  return `nt_lib_${storeSlug}`;
}

/**
 * Todo en una cookie y no en tres.
 *
 * Una persona puede tener libreta en el almacén, la ferretería y la rotisería; con
 * una cookie por dato serían nueve cabeceras viajando en cada imagen de producto.
 * Va JSON en base64url, que no es cifrado ni pretende serlo: es `httpOnly`, no lo
 * lee el navegador, y lo único que hay adentro es un id de relación.
 */
function empaquetar(s: Sesion): string {
  return Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
}

function desempaquetar(raw: string | undefined): Sesion | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return typeof s?.accountId === 'string'
      ? { accountId: s.accountId, displayName: s.displayName ?? '', linkedAt: s.linkedAt }
      : null;
  } catch {
    // Una cookie de una versión anterior, o basura. Se ignora: comprador anónimo,
    // que es el camino normal igual.
    return null;
  }
}

export async function getSesion(storeSlug: string): Promise<Sesion | null> {
  const jar = await cookies();
  return desempaquetar(jar.get(sessionCookieName(storeSlug))?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DIAS * 24 * 60 * 60,
};

export function sessionCookieValue(s: Sesion): string {
  return empaquetar(s);
}
