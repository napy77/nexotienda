import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookies } from '@/lib/session';

/**
 * Cerrar la libreta en este comercio.
 *
 * **Es POST y no un link, a propósito.** Con un `GET` bastaría que alguien pusiera
 * una imagen apuntando acá para desloguear a medio pueblo — y, más probable y más
 * tonto, el prefetch de Next cerraría la sesión con solo pasar el mouse por encima
 * del botón.
 *
 * Cierra solo la de este comercio. No existe un "salir de NexoTienda", porque
 * tampoco existe un "entrar a NexoTienda".
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ sub: string }> }) {
  const { sub } = await ctx.params;
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const res = NextResponse.redirect(new URL(`${request.nextUrl.protocol}//${host}/`), 303);
  res.cookies.delete(sessionCookies.acc(sub));
  res.cookies.delete(sessionCookies.who(sub));
  return res;
}
