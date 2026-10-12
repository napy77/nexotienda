'use server';

import { cookies, headers } from 'next/headers';
import {
  sessionCookieName,
  sessionCookieOptions,
  sessionCookieValue,
} from '@/lib/session';
import { nexopos } from '@/lib/nexopos';
import { NexoPosError } from '@/lib/nexopos/client';
import type { NewOrder, TownSearchHit } from '@/lib/nexopos/types';

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
  /**
   * `corregible`: el comprador lo arregla ahí mismo —elegir otro medio de pago—. Lo
   * demás es una falla que no puede resolver y necesita la salida de hablar con el
   * comercio. Las dos se muestran distinto.
   */
  | { ok: false; error: string; corregible?: boolean };

export async function placeOrderAction(input: NewOrder): Promise<PlaceResult> {
  let order;
  try {
    order = await nexopos.createOrder(input);
  } catch (e) {
    // El comercio apagó Mercado Pago entre que se cargó la página y el clic. No es una
    // falla: el comprador elige otro medio y listo. El mensaje lo redacta NexoPOS.
    if (e instanceof NexoPosError && e.code === 'mp_no_disponible') {
      return {
        ok: false,
        corregible: true,
        error: e.mensaje ?? 'Este comercio no está cobrando con Mercado Pago por ahora. Elegí otra forma de pago.',
      };
    }
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

  // Solo Mercado Pago se cobra acá. El efectivo y la transferencia los confirma el
  // comerciante en NexoPOS —es el que ve su banco y recibe la plata en la mano— y el
  // fiado se anota en la libreta.
  if (order.paymentMethod !== 'online') {
    return { ok: true, code: order.code };
  }

  const pago = await nexopos.createCheckout(
    order.code,
    await urlDelPedido(order.storeSlug, order.code),
  );
  // Si el link no salió, el pedido igual existe y le llegó al comercio. La pantalla
  // del pedido ofrece pagarlo de nuevo; no se borra una compra por un cobro fallido.
  return { ok: true, code: order.code, checkoutUrl: pago.ok ? pago.checkoutUrl : undefined };
}

/**
 * La URL pública del pedido, completa: Mercado Pago vuelve ahí cuando termina.
 *
 * En producción es la del subdominio —`https://jure-hnos-srl.nexotienda.app/pedido/P-…`—
 * y no la ruta interna `/s/<sub>/…`, que es una reescritura nuestra y no sale del repo.
 *
 * Si se entró sin subdominio —en desarrollo, `localhost:3000/s/supersol/…`— la ruta
 * corta no tiene cómo saber de qué tienda es y la vuelta cae en "no encontramos esta
 * tienda". Ahí se usa la ruta con el slug adentro.
 */
async function urlDelPedido(slug: string, code: string): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const enSuSubdominio = host.toLowerCase().startsWith(`${slug.toLowerCase()}.`);
  const ruta = enSuSubdominio ? '' : `/s/${encodeURIComponent(slug)}`;
  return `${proto}://${host}${ruta}/pedido/${encodeURIComponent(code)}`;
}

/**
 * Pedir el link de pago otra vez: rechazó la tarjeta, venció, o nunca llegó a pagar.
 *
 * Cada link nuevo da de baja el anterior en NexoPOS, así que no hace falta acordarse
 * de ninguno.
 */
export async function reintentarPagoAction(
  slug: string,
  code: string,
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; yaPagado: boolean; error: string }> {
  const pago = await nexopos.createCheckout(code, await urlDelPedido(slug, code));
  if (pago.ok) return { ok: true, checkoutUrl: pago.checkoutUrl };
  if (pago.motivo === 'ya_pagado') {
    return { ok: false, yaPagado: true, error: pago.mensaje ?? 'Este pedido ya está pagado.' };
  }
  return {
    ok: false,
    yaPagado: false,
    error:
      pago.mensaje ??
      (pago.motivo === 'reintentar'
        ? 'No pudimos abrir Mercado Pago. Probá de nuevo en un momento.'
        : 'Este pedido no se puede pagar online.'),
  };
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
      order.paymentError ?? '',
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
  /*
    Una descripción corta de quién pide, para la pantalla de confirmación de la app.

    **No es prueba de nada** —en el ataque el que abre el pedido es el atacante, así
    que esta cadena la escribe él y puede poner "tu iPhone"— y así se lo dijimos a los
    dos equipos. Sirve en el caso honesto: "sí, es mi compu". La defensa es el nombre
    del comercio, que ClubPay deduce de la clave, y la pregunta.
  */
  const ua = (await headers()).get('user-agent') ?? '';
  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const aparato = /Mobile|Android|iPhone/.test(ua) ? 'un teléfono' : 'una computadora';
  const pista = navegador ? `${aparato} con ${navegador}` : aparato;

  const par = await nexopos.openPairing(storeId, pista);
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
