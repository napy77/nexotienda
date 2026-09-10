import { NextResponse, type NextRequest } from 'next/server';
import { accountCookieName } from '@/lib/session';

/**
 * Simulador del vínculo con ClubPay. **Solo desarrollo.**
 *
 * En producción esto no existe: la persona vincula su cuenta desde ClubPay, que
 * emite un token de un solo uso de dos minutos; NexoTienda lo canjea contra NexoPOS
 * y recibe el `accountId`. Nunca un id en la query string — un id permanente en un
 * link es una credencial que no vence nunca.
 *
 *   /vincular?acc=acc_sol_4b91   enciende la libreta
 *   /vincular?salir              vuelve a comprador anónimo
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ sub: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('No disponible', { status: 404 });
  }

  const { sub } = await ctx.params;
  const acc = request.nextUrl.searchParams.get('acc');

  // Volver a la raíz del MISMO host. `request.url` no conserva el subdominio, y
  // mandar a otro host es otro origen y otro localStorage: se pierde el carrito.
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const back = new URL(`${request.nextUrl.protocol}//${host}/`);
  const res = NextResponse.redirect(back);

  if (request.nextUrl.searchParams.has('salir')) {
    res.cookies.delete(accountCookieName(sub));
  } else if (acc) {
    res.cookies.set(accountCookieName(sub), acc, { httpOnly: true, sameSite: 'lax', path: '/' });
  }
  return res;
}
