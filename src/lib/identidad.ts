import type { OrderRules } from '@/lib/nexopos/types';

/**
 * Identificarse con ClubPay para pagar al retirar o al recibir (CR-0003).
 *
 * Alguien cargó un pedido de cincuenta productos "para retirar y pagar al retirar" a
 * nombre de un tal Lando Landa. Con reparto y pago al recibir, un pedido así manda
 * un cadete a la casa de alguien que no pidió nada. Por eso cada comercio puede pedir
 * que quien paga en mano se identifique antes.
 *
 * **NexoTienda no identifica a nadie.** Manda a la persona a ClubPay, que es la única
 * identidad del ecosistema, y ClubPay la devuelve a `/entrar` con el mismo token de
 * un solo uso de siempre. El nivel de la cuenta tampoco lo sabemos ni lo mandamos: lo
 * averigua NexoPOS al crear el pedido. Mercado Pago no pasa por nada de esto: está
 * pago antes de que el comercio arme nada.
 *
 * Y un email verificado prueba que alguien tiene una casilla, no quién es. Lo que de
 * verdad protege al comercio son sus topes y que mire las cuentas nuevas.
 */

/**
 * ¿Hay que identificarse para pagar en mano con esta franja?
 *
 * Solo se puede contestar para quien **no** se identificó —el nivel 0—, porque es el
 * único nivel que se sabe sin preguntarle a nadie. Para el resto decide NexoPOS.
 *
 * Con las reglas prendidas y sin fila para el nivel 0, se pide: prender las reglas
 * es, justamente, cerrar el pago en mano a quien no se identificó. Si la vidriera
 * se equivoca para cualquier lado, el rechazo con `code` lo corrige.
 */
export function pideIdentificarse(rules: OrderRules, slotKind: 'retiro' | 'reparto'): boolean {
  if (!rules.enabled) return false;
  const cero = rules.levels.find((l) => l.level === 0);
  if (!cero) return true;
  return slotKind === 'retiro' ? !cero.pickupCash : !cero.deliveryCash;
}

/**
 * El link a ClubPay. `volver` es la URL **completa** de esta pantalla: ClubPay la
 * compara contra su lista (`https://<slug>.nexotienda.app/…`) y, si no la reconoce,
 * la persona hace su cuenta igual pero no vuelve sola.
 */
export function urlIdentificarse(clubpayWeb: string, volver: string): string {
  const u = new URL('/entrar', clubpayWeb);
  u.searchParams.set('volver', volver);
  return u.toString();
}

/**
 * El `volver` que trae ClubPay de regreso, validado.
 *
 * Es un **camino dentro de esta tienda** —`/s/jure/carrito`—, nunca una URL. Se
 * valida igual que si lo escribiera un atacante, porque puede: `/entrar` es una
 * puerta pública, y un `volver` que acepte otro host convierte la tienda en un
 * redirector con su marca, que es lo que hace creíble una estafa.
 *
 * Devuelve `null` ante cualquier duda, y quien llama cae en la tienda.
 */
export function volverSeguro(raw: string | null): string | null {
  if (!raw) return null;
  // Un solo `/` adelante. `//otro.com` es un host para el navegador, y `/\otro.com`
  // también: algunos navegadores leen la barra invertida como una normal.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  // Nada invisible: un salto de línea o un tab en una URL es siempre un truco.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (raw.length > 500) return null;
  try {
    // La prueba final: resuelto contra un host cualquiera, tiene que seguir siendo
    // ese host. Atrapa lo que se le haya escapado a lo de arriba.
    const base = 'https://tienda.invalid';
    const u = new URL(raw, base);
    if (u.origin !== base) return null;
    // `/..//otro.com` se normaliza a `//otro.com`: se mira el resultado, no la entrada.
    if (u.pathname.startsWith('//')) return null;
    // `/entrar` mandando a `/entrar` sería un rulo: el token ya se usó.
    if (/\/entrar\/?$/.test(u.pathname)) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}
