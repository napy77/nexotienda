'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CreditCard, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import type { Order } from '@/lib/nexopos/types';
import { reintentarPagoAction } from '@/app/actions';

/**
 * Cómo va el pago con Mercado Pago de este pedido.
 *
 * **Lo que trae la URL al volver de Mercado Pago no se mira.** Mercado Pago agrega
 * `status=approved` y otros parámetros que cualquiera puede escribir a mano; decidir
 * con eso sería darle un pedido pagado a quien sepa tipear. Lo único que vale es el
 * `paymentStatus` del pedido, que viene de NexoPOS, que se lo dijo Mercado Pago.
 *
 * Y "pendiente" son dos cosas que desde acá no se distinguen: que Mercado Pago todavía
 * esté acreditando, o que la persona haya cerrado la pestaña sin pagar. El primer
 * minuto se asume lo primero —la pantalla pregunta seguido—; pasado el minuto se
 * ofrece pagar, porque si todavía no entró, probablemente no va a entrar solo.
 */
const ESPERA = 60_000;

export function PagoOnline({
  order,
}: {
  order: Pick<Order, 'code' | 'storeSlug' | 'paymentStatus' | 'paymentError'>;
}) {
  const router = useRouter();
  const [esperando, setEsperando] = useState(order.paymentStatus === 'pendiente');
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order.paymentStatus !== 'pendiente') return;
    const t = setTimeout(() => setEsperando(false), ESPERA);
    return () => clearTimeout(t);
  }, [order.paymentStatus]);

  async function pagar() {
    setError(null);
    setYendo(true);
    try {
      const r = await reintentarPagoAction(order.storeSlug, order.code);
      if (r.ok) {
        window.location.assign(r.checkoutUrl);
        return;
      }
      // Ya pagado —a veces con un link anterior que estaba abierto en otra pestaña—
      // no es un error: se muestra el pedido como quedó.
      if (r.yaPagado) router.refresh();
      else setError(r.error);
    } finally {
      setYendo(false);
    }
  }

  const boton = (texto: string, Icon: typeof CreditCard) => (
    <button
      onClick={pagar}
      disabled={yendo}
      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
    >
      {yendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {yendo ? 'Abriendo Mercado Pago…' : texto}
    </button>
  );

  switch (order.paymentStatus) {
    case 'pagado':
      return (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          ¡Listo! Recibimos tu pago.
        </p>
      );

    case 'reembolsado':
      return (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-800">
          <Undo2 className="h-4 w-4 shrink-0" />
          Te devolvimos el pago. Vuelve a la misma cuenta con la que pagaste.
        </p>
      );

    case 'rechazado':
      return (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          {/* Lo redacta NexoPOS para el comprador. Se muestra tal cual. */}
          <p className="text-sm font-medium text-red-900">
            {order.paymentError ?? 'El pago no salió.'}
          </p>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
          {boton('Intentar de nuevo', RotateCcw)}
        </div>
      );

    case 'pendiente':
      if (esperando) {
        return (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Estamos confirmando tu pago…
          </p>
        );
      }
      return (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            Todavía no vemos el pago. El pedido ya le llegó al comercio: podés pagarlo
            ahora con Mercado Pago o arreglarlo con ellos.
          </p>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
          {boton('Pagar con Mercado Pago', CreditCard)}
        </div>
      );

    default:
      return null;
  }
}
