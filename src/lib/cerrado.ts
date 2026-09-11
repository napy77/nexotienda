import type { Product } from '@/lib/nexopos/types';
import type { OpenState } from '@/lib/horario';

/**
 * Qué pasa cuando alguien cierra el carrito con el comercio cerrado.
 *
 * No es lo mismo encargar dos paquetes de harina a las once de la noche que encargar
 * una pizza. La harina va a estar mañana: el comercio abre, la agarra de la góndola y
 * la manda. La pizza no existe todavía, y lo que el comercio declaró —"hoy hago
 * veinte"— era de hoy; a las 7:30 de mañana esa declaración ya no dice nada.
 *
 * El corte no es el rubro del comercio sino **la política del producto**, y es el
 * mismo corte de D1/D3. `declared` es, textualmente, "lo que el comercio declaró que
 * tiene hoy". `stock` es una existencia que sobrevive a la noche. Por eso Jure, que
 * es almacén y además hace pizzas, cae de los dos lados según el changuito: el corte
 * lo pone el carrito, no el cartel de la puerta.
 *
 * Y `unknown` no bloquea nada. No saber la disponibilidad no es saber que no hay
 * (P5): si el POS no reportó, el pedido sigue su camino normal.
 */
export type ClosedPolicy =
  /** Comercio abierto, o sin horario cargado: no hay nada que preguntar. */
  | { kind: 'libre' }
  /** Se puede encargar para cuando abra, pero que lo sepa antes de mandarlo. */
  | { kind: 'confirmar' }
  /** Hay algo que se hace en el momento. Cerrado es cerrado. */
  | { kind: 'bloqueado'; items: { id: string; name: string }[] };

export function closedPolicy(
  state: OpenState,
  lines: { product: Pick<Product, 'id' | 'name' | 'availability'> }[],
): ClosedPolicy {
  // `desconocido` es el comercio sin horario cargado. Decirle "cerrado" a alguien
  // que está atendiendo le hace perder la venta, así que no se afirma (P5).
  if (state.kind !== 'cerrado') return { kind: 'libre' };

  const delDia = lines
    .filter((l) => l.product.availability.policy === 'declared')
    .map((l) => ({ id: l.product.id, name: l.product.name }));

  if (delDia.length) return { kind: 'bloqueado', items: delDia };
  return { kind: 'confirmar' };
}
