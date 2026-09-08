import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Check, Clock, PackageCheck, Truck } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { money } from '@/lib/format';
import type { OrderStatus } from '@/lib/nexopos/types';
import { ContactButton, StoreShell } from '@/components/StoreShell';

/**
 * D18: la notificación no es una aceptación. El comprador ve en qué estado está, y
 * el tiempo lo declara el comercio al aceptar — nunca lo promete la plataforma.
 */
const STEPS: { key: OrderStatus; label: string; hint: string }[] = [
  { key: 'recibido', label: 'Recibido', hint: 'Le llegó el pedido al comercio' },
  { key: 'aceptado', label: 'Aceptado', hint: 'Lo están preparando' },
  { key: 'listo', label: 'Listo', hint: 'Podés pasar a retirarlo' },
  { key: 'entregado', label: 'Entregado', hint: '' },
];

const PAYMENT_LABEL: Record<string, string> = {
  efectivo_entrega: 'Efectivo al recibir',
  online: 'Pagado online',
  cuenta_corriente: 'Anotado en la libreta',
};

const PAYMENT_STATE: Record<string, { text: string; tone: string }> = {
  pendiente: { text: 'Falta pagarlo', tone: 'bg-amber-100 text-amber-800' },
  pagado: { text: 'Pagado', tone: 'bg-emerald-100 text-emerald-800' },
  rechazado: { text: 'El pago no salió', tone: 'bg-red-100 text-red-800' },
};

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ sub: string; code: string }>;
}) {
  const { sub, code } = await params;
  const [store, order] = await Promise.all([nexopos.getStore(sub), nexopos.getOrder(code)]);
  if (!store || !order) notFound();

  const currentIndex = STEPS.findIndex((s) => s.key === order.status);

  return (
    <StoreShell store={store}>
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <p className="text-xs font-bold tracking-widest text-neutral-400 uppercase">
            Pedido {order.code}
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-neutral-900">
            Le llegó a {store.name}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Todavía no lo aceptaron. Cuando lo hagan te dicen para cuándo lo tienen.
          </p>

          <ol className="mt-6 space-y-3">
            {STEPS.map((s, i) => {
              const done = i <= currentIndex;
              const Icon =
                s.key === 'entregado' ? PackageCheck : s.key === 'listo' ? Truck : Check;
              return (
                <li key={s.key} className="flex items-start gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      done ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}
                  >
                    {done ? <Icon className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                  </span>
                  <span>
                    <span
                      className={`block text-sm font-semibold ${
                        done ? 'text-neutral-900' : 'text-neutral-400'
                      }`}
                    >
                      {s.label}
                    </span>
                    {done && s.hint && (
                      <span className="block text-xs text-neutral-500">{s.hint}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-bold text-neutral-900">Lo que pediste</h2>
          <ul className="divide-y divide-neutral-100">
            {order.lines.map((l) => (
              <li key={l.productId} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-8 shrink-0 font-bold text-neutral-500">{l.quantity}×</span>
                <span className="min-w-0 flex-1 truncate text-neutral-700">{l.name}</span>
                <span className="font-medium text-neutral-900">
                  {money(l.unitPriceCents * l.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">{order.slotLabel}</dt>
              <dd className="font-medium">
                {order.feeCents === 0 ? 'Sin cargo' : money(order.feeCents)}
              </dd>
            </div>
            {order.address && (
              <div className="flex justify-between">
                <dt className="text-neutral-600">Dirección</dt>
                <dd className="font-medium">{order.address}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-neutral-600">Pago</dt>
              <dd className="flex items-center gap-2 font-medium">
                {PAYMENT_LABEL[order.paymentMethod]}
                {order.paymentStatus !== 'no_aplica' && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      PAYMENT_STATE[order.paymentStatus].tone
                    }`}
                  >
                    {PAYMENT_STATE[order.paymentStatus].text}
                  </span>
                )}
              </dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-bold">{money(order.totalCents)}</dd>
            </div>
          </dl>

          {order.paymentStatus === 'pendiente' && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              El pedido ya le llegó a {store.name}, pero el pago quedó sin completar.
              Podés pagarlo cuando lo retires o hablando con ellos.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ContactButton store={store} />
            <Link
              href={`/s/${store.slug}`}
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </StoreShell>
  );
}
