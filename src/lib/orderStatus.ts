import type { Order } from '@/lib/nexopos/types';

/**
 * Qué le decimos al comprador en cada estado.
 *
 * El texto no sale solo del estado: depende de qué compró y de cómo lo recibe.
 *
 * - **Armar vs. elaborar.** Si el pedido tiene algún producto propio —la pizza, las
 *   empanadas— el comercio lo *elabora*; si es todo de góndola, lo *arma*. Se deriva
 *   de las líneas del pedido y no del rubro del comercio, porque un súper que además
 *   hace prepizzas elabora esa venta y arma las otras.
 * - **En camino solo existe con reparto.** En un retiro, después de "listo" viene
 *   directamente la entrega en el mostrador.
 *
 * El tiempo estimado nunca se inventa acá: lo declara el comercio al aceptar (D18).
 */
export interface StatusStep {
  key: Order['status'];
  label: string;
  hint: string;
}

export function statusSteps(order: Pick<Order, 'slotKind' | 'lines'> & { elaborated?: boolean }): StatusStep[] {
  const elabora = order.elaborated ?? false;
  const reparto = order.slotKind === 'reparto';

  return [
    {
      key: 'recibido',
      label: 'El comercio recibió tu pedido',
      hint: 'Todavía no lo aceptaron',
    },
    {
      key: 'aceptado',
      label: elabora
        ? 'El comercio está elaborando tu pedido'
        : 'El comercio está armando tu pedido',
      hint: '',
    },
    {
      key: 'listo',
      label: 'Tu pedido está listo',
      hint: reparto ? 'Sale para tu casa' : 'Pasá a retirarlo',
    },
    ...(reparto
      ? ([{ key: 'en_camino', label: 'Tu pedido está en camino', hint: '' }] as StatusStep[])
      : []),
    {
      key: 'entregado',
      label: reparto ? 'Tu pedido fue entregado' : 'El comercio entregó tu pedido',
      hint: '',
    },
  ];
}
