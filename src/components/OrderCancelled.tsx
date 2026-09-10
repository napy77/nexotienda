import Link from 'next/link';
import { MessageCircleWarning, RotateCcw } from 'lucide-react';
import type { Order, Store } from '@/lib/nexopos/types';
import { ContactButton } from './StoreShell';

/**
 * Cuando el comercio cancela.
 *
 * Lo que se muestra grande es **lo que escribió el comerciante**, no un estado del
 * sistema. Un "pedido cancelado: sin stock" corta la venta y la relación; un "no me
 * quedan de ananá, tengo de muzzarella" es una conversación que probablemente
 * termine en otra compra.
 *
 * Por eso la pantalla ofrece las dos salidas juntas: volver a pedir, y hablar con
 * el comercio.
 */
export function OrderCancelled({ order, store }: { order: Order; store: Store }) {
  const porVencimiento = order.cancelledBy === 'vencimiento';

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-amber-800 uppercase">
        <MessageCircleWarning className="h-4 w-4" />
        Pedido {order.code} · cancelado
      </p>

      {order.cancelReason ? (
        <>
          <p className="mt-3 text-sm text-amber-900">{store.name} te dejó este mensaje:</p>
          <blockquote className="mt-2 border-l-4 border-amber-400 pl-4 text-lg leading-snug font-semibold text-neutral-900">
            {order.cancelReason}
          </blockquote>
        </>
      ) : porVencimiento ? (
        // Vencido sin que nadie lo mirara. La disculpa es del sistema, no un
        // reproche al comercio: el comprador no tiene por qué enterarse de eso.
        <p className="mt-3 text-base text-neutral-900">
          No llegamos a confirmarlo a tiempo y lo dimos de baja. Perdón por la vuelta —
          si querés, hablá directo con {store.name}.
        </p>
      ) : (
        <p className="mt-3 text-base text-neutral-900">
          {store.name} no pudo tomar este pedido.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/s/${store.slug}`}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
        >
          <RotateCcw className="h-4 w-4" />
          Volver a pedir
        </Link>
        <ContactButton store={store} />
      </div>

      {order.paymentStatus === 'pagado' && (
        <p className="mt-4 text-xs text-amber-900">
          Ya habías pagado {order.code}. {store.name} te tiene que devolver ese importe;
          si no lo ves en unos días, hablales.
        </p>
      )}
    </div>
  );
}
