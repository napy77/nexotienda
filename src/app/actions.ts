'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  sessionCookieName,
  sessionCookieOptions,
  sessionCookieValue,
} from '@/lib/session';
import { nexopos } from '@/lib/nexopos';
import type { NewOrder, TownSearchHit } from '@/lib/nexopos/types';
import { payments } from '@/lib/payments';

export async function searchTownAction(
  townSlug: string,
  query: string,
): Promise<TownSearchHit[]> {
  const result = await nexopos.searchTown(townSlug, query);
  // TODO(D12): registrar las búsquedas sin resultado — son señal de demanda para el
  // comercio, para el mayorista y para el equipo comercial de Nexo B2B.
  return result.hits;
}

type PlaceResult =
  | { ok: true; code: string; checkoutUrl?: string }
  | { ok: false; error: string };

export async function placeOrderAction(input: NewOrder): Promise<PlaceResult> {
  let order;
  try {
    order = await nexopos.createOrder(input);
  } catch (e) {
    // El detalle va al log, no a la pantalla. "NexoPOS respondió 401 en /v1/orders"
    // no le dice nada a alguien que está comprando fideos, y encima cuenta cómo
    // está armado esto por dentro. Lo que sí sirve es que sepa que el pedido no
    // salió y que puede llamar al comercio.
    console.error('[nexotienda] createOrder falló', e);
    return {
      ok: false,
      // Sin prometer que reintentar sirve: si el pedido no salió, puede ser algo
      // que no se arregla solo. La salida real es hablar con el comercio, y el
      // botón para hacerlo está al lado de este mensaje.
      error: 'No pudimos mandar tu pedido.',
    };
  }

  // El efectivo y el fiado no pasan por el rail: no hay nada que cobrar online.
  if (order.paymentMethod !== 'online') {
    return { ok: true, code: order.code };
  }

  try {
    const intent = await payments.createIntent({
      kind: 'orden',
      reference: order.code,
      storeId: order.storeId,
      storeSlug: order.storeSlug,
      storeName: order.storeName,
      amountCents: order.totalCents,
      description: `Pedido ${order.code} en ${order.storeName}`,
      returnUrl: `/s/${order.storeSlug}/pedido/${order.code}`,
    });
    return { ok: true, code: order.code, checkoutUrl: intent.checkoutUrl };
  } catch (e) {
    // El pedido ya existe y le llegó al comercio. Que falle el cobro no lo borra:
    // lo dejamos pendiente y que lo arreglen entre ellos.
    console.error('[nexotienda] createIntent falló', e);
    return { ok: true, code: order.code };
  }
}

/**
 * Cobrar contra la libreta, por un importe libre (D31).
 *
 * NexoTienda no elige qué resumen se paga: manda un monto y NexoPOS lo imputa del
 * más viejo al más nuevo, con lo que sobre a cuenta del período abierto. La
 * imputación es del libro, no de la vidriera.
 */
export async function payAccountAction(input: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  accountId: string;
  amountCents: number;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  if (input.amountCents <= 0) {
    return { ok: false, error: 'El monto tiene que ser mayor a cero.' };
  }
  try {
    const intent = await payments.createIntent({
      kind: 'resumen',
      reference: `${input.storeId}|${input.accountId}`,
      storeId: input.storeId,
      storeSlug: input.storeSlug,
      storeName: input.storeName,
      amountCents: input.amountCents,
      description: `Libreta de ${input.storeName}`,
      returnUrl: `/s/${input.storeSlug}/libreta`,
    });
    return { ok: true, checkoutUrl: intent.checkoutUrl };
  } catch (e) {
    console.error('[nexotienda] payAccount falló', e);
    return { ok: false, error: 'No pudimos iniciar el pago. Probá de nuevo en un momento.' };
  }
}

/**
 * Resuelve un cobro y lo liquida.
 *
 * En sandbox lo dispara el botón de la pantalla de pago; en producción lo dispara el
 * webhook de Mercado Pago. La liquidación —marcar el pedido pagado o imputar contra
 * el resumen— es la misma en los dos casos.
 */
export async function settlePaymentAction(
  intentId: string,
  outcome: 'aprobado' | 'rechazado',
): Promise<{ ok: boolean; returnUrl: string }> {
  const intent = payments.simulate
    ? await payments.simulate(intentId, outcome)
    : await payments.getIntent(intentId);

  if (!intent) return { ok: false, returnUrl: '/' };

  if (intent.status === 'aprobado') {
    if (intent.kind === 'orden') {
      await nexopos.confirmOrderPayment(intent.reference, intent.id);
    } else {
      const [storeId, accountId] = intent.reference.split('|');
      await nexopos.registerAccountPayment({
        storeId,
        accountId,
        amountCents: intent.amountCents,
        paymentId: intent.id,
      });
    }
  }

  revalidatePath(intent.returnUrl);
  return { ok: intent.status === 'aprobado', returnUrl: intent.returnUrl };
}

/**
 * El latido del pedido: lo mínimo para saber si algo cambió.
 *
 * La pantalla de seguimiento la consulta cada tanto. Devuelve una huella y no el
 * pedido entero a propósito — esto se llama muchas veces por pedido y lo caro es
 * rearmar la página, no preguntar. Solo cuando la huella cambia se refresca.
 *
 * Es un parche hasta que NexoPOS mande los webhooks que les pedimos: ellos saben
 * cuándo el comerciante toca el botón, nosotros solo podemos preguntar.
 */
export async function orderPulseAction(code: string): Promise<string | null> {
  try {
    const order = await nexopos.getOrder(code);
    if (!order) return null;
    return [
      order.status,
      order.paymentStatus,
      order.readyEstimate ?? '',
      order.cancelReason ?? '',
    ].join('|');
  } catch (e) {
    // Que la API esté caída no es noticia para el que está esperando su pizza: la
    // pantalla se queda como está y se vuelve a preguntar en el próximo turno.
    console.error('[nexotienda] orderPulse falló', e);
    return null;
  }
}

/**
 * Traer productos sueltos por id.
 *
 * Lo usa la estantería de "lo que solés llevar", que sabe qué ids quiere recién en
 * el navegador —el historial vive ahí—. Se acota a lo que esa estantería puede
 * mostrar: es un endpoint abierto y no hay razón para que sirva de volcador del
 * catálogo.
 */
export async function productsByIdAction(storeId: string, ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  try {
    // El orden lo respeta el port: lo último comprado va primero.
    return await nexopos.productsByIds(storeId, ids.slice(0, 24));
  } catch (e) {
    console.error('[nexotienda] productsById falló', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Abrir la libreta en una pantalla que no es la del teléfono
// ---------------------------------------------------------------------------

/**
 * Empareja la pantalla grande con la app.
 *
 * El `requestId` **queda en una cookie `httpOnly` de este navegador y no vuelve al
 * cliente**. Es lo que ata la aprobación a esta pantalla: aunque alguien apruebe un
 * pedido que no es suyo, solo el navegador que lo abrió puede canjearlo. Sin eso, un
 * código dictado por teléfono le abriría la libreta a cualquiera.
 */
export async function abrirEmparejamientoAction(storeId: string, storeSlug: string) {
  const par = await nexopos.openPairing(storeId);
  if (!par) return null;

  const jar = await cookies();
  jar.set(`nt_par_${storeSlug}`, par.requestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 5 * 60,
  });

  // El requestId no se devuelve: la pantalla solo necesita mostrar el código.
  return { code: par.code, expiresAt: par.expiresAt };
}

/**
 * ¿Ya lo aprobaron? Si sí, canjea el token y abre la libreta acá.
 *
 * Termina en el **mismo canje** que el handoff desde la app. Una segunda forma de
 * abrir sesión sería una segunda superficie que auditar, y esta es la parte del
 * sistema donde eso menos conviene.
 */
export async function consultarEmparejamientoAction(
  storeId: string,
  storeSlug: string,
): Promise<'pendiente' | 'listo' | 'vencido'> {
  const jar = await cookies();
  const requestId = jar.get(`nt_par_${storeSlug}`)?.value;
  if (!requestId) return 'vencido';

  const r = await nexopos.pollPairing(storeId, requestId);
  if (r.status !== 'listo') return r.status;

  const sesion = await nexopos.redeemLinkToken(r.token, storeId);
  if (!sesion || sesion.storeId !== storeId) return 'vencido';

  jar.set(
    sessionCookieName(storeSlug),
    sessionCookieValue({
      accountId: sesion.accountId,
      displayName: sesion.displayName,
      linkedAt: sesion.linkedAt,
    }),
    sessionCookieOptions,
  );
  jar.delete(`nt_par_${storeSlug}`);
  return 'listo';
}
