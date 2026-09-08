'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { money } from '@/lib/format';
import type { MerchantAccount, PaymentMethod, Store } from '@/lib/nexopos/types';
import { placeOrderAction } from '@/app/actions';
import { useCart } from './CartProvider';
import { ContactButton } from './StoreShell';

export function Checkout({ store, account }: { store: Store; account: MerchantAccount | null }) {
  const cart = useCart();
  const router = useRouter();
  const [slotId, setSlotId] = useState(store.slots[0]?.id ?? 'retiro');
  const [payment, setPayment] = useState<PaymentMethod>('efectivo_entrega');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const slot = store.slots.find((s) => s.id === slotId);
  const freeShipping =
    store.freeDeliveryOverCents !== undefined && cart.subtotalCents >= store.freeDeliveryOverCents;
  const feeCents = slot?.kind === 'reparto' && !freeShipping ? (slot.feeCents ?? 0) : 0;
  const totalCents = cart.subtotalCents + feeCents;

  // El fiado desde la tienda online necesita tres cosas: que el comercio dé cuenta
  // corriente, que la haya habilitado online (D34), y que no la haya pausado (D35).
  const creditAvailable =
    !!account && account.onlineCreditEnabled && !account.creditPaused;
  const overLimit = !!account && totalCents > account.availableCents;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-neutral-800">Tu carrito está vacío</p>
        <Link
          href={`/s/${store.slug}`}
          className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
        >
          Volver a la tienda
        </Link>
      </div>
    );
  }

  function submit() {
    setError(null);
    if (slot?.kind === 'reparto' && address.trim().length < 5) {
      setError('Necesitamos la dirección para llevártelo.');
      return;
    }
    start(async () => {
      const res = await placeOrderAction({
        storeId: store.id,
        lines: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        slotId,
        address: slot?.kind === 'reparto' ? address.trim() : undefined,
        paymentMethod: payment,
        personId: account ? 'per_7f3a91c2' : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      cart.clear();
      router.push(`/s/${store.slug}/pedido/${res.code}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-3">
        {cart.lines.map((l) => (
          <div
            key={l.product.id}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
          >
            {l.product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.product.imageUrl}
                alt=""
                className="h-16 w-16 rounded-lg bg-neutral-50 object-contain"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">{l.product.name}</p>
              <p className="text-xs text-neutral-500">
                {money(l.product.priceCents)} / {l.product.unit}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => cart.bump(l.product.id, -1)}
                aria-label="Sacar uno"
                className="flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white hover:bg-neutral-50"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
              <button
                onClick={() => cart.bump(l.product.id, 1)}
                aria-label="Sumar uno"
                className="flex h-7 w-7 items-center justify-center rounded border border-neutral-300 bg-white hover:bg-neutral-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => cart.remove(l.product.id)}
                aria-label="Sacar del carrito"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="w-24 text-right text-sm font-bold text-neutral-900">
              {money(l.product.priceCents * l.quantity)}
            </p>
          </div>
        ))}
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-neutral-900">¿Cómo lo recibís?</h2>
          <div className="space-y-2">
            {store.slots.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                  slotId === s.id ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'
                }`}
              >
                <input
                  type="radio"
                  name="slot"
                  checked={slotId === s.id}
                  onChange={() => setSlotId(s.id)}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-neutral-900">{s.label}</span>
                  <span className="block text-xs text-neutral-500">
                    {s.kind === 'retiro'
                      ? // El tiempo lo declara el comercio al aceptar, no lo promete la
                        // plataforma (D18, D20).
                        'Te avisamos cuando esté listo'
                      : freeShipping
                        ? 'Envío sin cargo'
                        : money(s.feeCents ?? 0)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {slot?.kind === 'reparto' && (
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle y número"
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-neutral-900">¿Cómo pagás?</h2>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 p-3">
              <input
                type="radio"
                name="pay"
                checked={payment === 'efectivo_entrega'}
                onChange={() => setPayment('efectivo_entrega')}
              />
              <span className="text-sm font-semibold text-neutral-900">
                Efectivo al recibir o retirar
              </span>
            </label>

            {store.acceptsOnlinePayment && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 p-3">
                <input
                  type="radio"
                  name="pay"
                  checked={payment === 'clubpay'}
                  onChange={() => setPayment('clubpay')}
                />
                <span className="text-sm font-semibold text-neutral-900">Pagar con ClubPay</span>
              </label>
            )}

            {account && (
              <label
                className={`flex items-start gap-2 rounded-lg border p-3 ${
                  creditAvailable && !overLimit
                    ? 'cursor-pointer border-neutral-200'
                    : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="pay"
                  disabled={!creditAvailable || overLimit}
                  checked={payment === 'cuenta_corriente'}
                  onChange={() => setPayment('cuenta_corriente')}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-neutral-900">
                    Anotar en la libreta
                  </span>
                  {/* "Disponible", nunca "tu límite" (D32). */}
                  <span className="block text-xs text-neutral-500">
                    Disponible: {money(account.availableCents)}
                  </span>
                  {account.creditPaused && (
                    // El bloqueo se comunica suave y deja salida a un humano (D36).
                    <span className="mt-1 block text-xs text-neutral-600">
                      Para seguir comprando en la libreta, hablá con {store.name}.
                    </span>
                  )}
                  {!account.creditPaused && !account.onlineCreditEnabled && (
                    <span className="mt-1 block text-xs text-neutral-600">
                      {store.name} toma la libreta solo en el mostrador.
                    </span>
                  )}
                  {creditAvailable && overLimit && (
                    <span className="mt-1 block text-xs text-neutral-600">
                      Este pedido supera tu disponible. Podés pagarlo de otra forma.
                    </span>
                  )}
                </span>
              </label>
            )}
          </div>

          {account?.creditPaused && (
            <div className="mt-3">
              <ContactButton store={store} className="w-full justify-center" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Productos</dt>
              <dd className="font-medium">{money(cart.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-600">Envío</dt>
              <dd className="font-medium">{feeCents === 0 ? 'Sin cargo' : money(feeCents)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-bold">{money(totalCents)}</dd>
            </div>
          </dl>

          {error && <p className="mt-3 text-xs font-medium text-red-700">{error}</p>}

          <button
            onClick={submit}
            disabled={pending}
            className="mt-4 w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? 'Mandando…' : 'Hacer el pedido'}
          </button>
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            {store.name} tiene que aceptarlo. Te avisamos cuando lo haga.
          </p>
        </div>
      </aside>
    </div>
  );
}
