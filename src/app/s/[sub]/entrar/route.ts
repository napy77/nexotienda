import { NextResponse, type NextRequest } from 'next/server';
import { nexopos } from '@/lib/nexopos';
import { sessionCookieName, sessionCookieOptions, sessionCookieValue } from '@/lib/session';

/**
 * El canje del handoff: `jure.nexotienda.app/entrar?t=…`
 *
 * La persona tocó "Ir a la tienda" en ClubPay. ClubPay emitió un token de un solo
 * uso y dos minutos, atado a **esa relación** —esa persona en ese comercio— y nos
 * mandó acá. Lo canjeamos del lado del servidor y abrimos la libreta.
 *
 * Cuatro cosas que no son obvias:
 *
 * - **El token viaja en la query string y está bien que así sea.** Un id permanente
 *   en un link es una credencial que no vence nunca; esto vence en dos minutos y
 *   muere al primer uso. Para cuando el navegador guarda la URL en el historial, el
 *   token ya no sirve para nada.
 * - **`Referrer-Policy: no-referrer`.** La tienda carga fotos de productos de
 *   servidores ajenos, y el navegador les manda de qué URL venía. Sin esta línea, el
 *   token se le cuenta a un CDN de imágenes.
 * - **El token no puede abrir la tienda equivocada.** La comprobación de verdad la
 *   hace NexoPOS: le mandamos el `storeId` junto con el token, y ellos lo validan
 *   contra la clave de *ese* comercio en ClubPay — un token de Jure canjeado como
 *   Delfín no valida. La comparación que queda acá abajo ya no es esa comprobación:
 *   es el cinturón que atrapa una respuesta incoherente de NexoPOS, no un ataque.
 * - **Nunca se redirige a una URL que venga de afuera.** Siempre a la raíz de este
 *   mismo host, que además es lo que conserva el carrito: otro host es otro origen y
 *   otro `localStorage`.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ sub: string }> }) {
  const { sub } = await ctx.params;
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const raiz = new URL(`${request.nextUrl.protocol}//${host}/`);

  function irA(url: URL) {
    const res = NextResponse.redirect(url);
    res.headers.set('Referrer-Policy', 'no-referrer');
    return res;
  }

  const token = request.nextUrl.searchParams.get('t');
  const store = await nexopos.getStore(sub);
  if (!token || !store) return irA(raiz);

  // El `storeId` va en el pedido: el token no dice de qué comercio es, y nosotros
  // siempre lo sabemos porque el canje ocurre en el subdominio de ese comercio.
  const sesion = await nexopos.redeemLinkToken(token, store.id);

  // Un token que no sirve —vencido, ya usado, de otra tienda— termina igual: de
  // vuelta en la tienda, con el aviso. No se distingue cuál de los tres fue: al que
  // está parado ahí le da lo mismo, y decirlo le cuenta algo a quien esté probando.
  if (!sesion || sesion.storeId !== store.id) {
    const falla = new URL(raiz);
    falla.searchParams.set('libreta', 'vencio');
    return irA(falla);
  }

  const res = irA(raiz);
  res.cookies.set(
    sessionCookieName(sub),
    sessionCookieValue({
      accountId: sesion.accountId,
      displayName: sesion.displayName,
      // Se guarda para poder detectar después que el vínculo cambió.
      linkedAt: sesion.linkedAt,
    }),
    sessionCookieOptions,
  );
  return res;
}
