'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Banknote, BookMarked, CreditCard, Landmark, Minus, Plus, Trash2 } from 'lucide-react';
import { money } from '@/lib/format';
import { creditState } from '@/lib/credit';
import type { MerchantAccount, PaymentMethod, Store } from '@/lib/nexopos/types';
import { placeOrderAction } from '@/app/actions';
import { useCart } from './CartProvider';
import { ContactButton } from './StoreShell';

const PAYMENT_UI: Record<
  PaymentMethod,
  { label: string; hint: string; icon: typeof Banknote }
> = {
  efectivo_entrega: {
    label: 'Al recibirlo o retirarlo',
    hint: 'Pagás en mano, sin nada más',
    icon: Banknote,
  },
  online: {
    label: 'Pagar ahora',
    hint: 'Con ClubPay, tarjeta o transferencia',
    icon: CreditCard,
  },
  transferencia: {
    label: 'Transferencia',
    hint: 'Te pasamos el alias del comercio',
    icon: Landmark,
  },
  cuenta_corriente: {
    label: 'Anotar en la libreta',
    hint: '',
    icon: BookMarked,
  },
};

export function Checkout({ store, account }: { store: Store; account: MerchantAccount | null }) {
  const cart = useCart();
  const router = useRouter();
  const [slotId, setSlotId] = useState(store.slots[0]?.id ?? 'retiro');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Dos cosas distintas y no se muestran igual: `error` es algo que el comprador
  // puede arreglar acá mismo —falta la dirección, falta el teléfono— y `falla` es
  // que el pedido no se pudo mandar, que él no puede resolver y necesita salida.
  const [error, setError] = useState<string | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const slot = store.slots.find((s) => s.id === slotId);
  const freeShipping =
    store.freeDeliveryOverCents !== undefined && cart.subtotalCents >= store.freeDeliveryOverCents;
  const feeCents = slot?.kind === 'reparto' && !freeShipping ? (slot.feeCents ?? 0) : 0;
  const totalCents = cart.subtotalCents + feeCents;

  const credit = creditState(store, account, totalCents);

  // El default es el camino normal: comprar y pagar al recibirlo. La libreta nunca
  // viene preseleccionada.
  const methods = store.acceptedPayments.filter((m) => m !== 'cuenta_corriente');
  const [payment, setPayment] = useState<PaymentMethod>(methods[0] ?? 'efectivo_entrega');
  const showCredit = store.acceptedPayments.includes('cuenta_corriente');

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
    setFalla(null);
    if (slot?.kind === 'reparto' && address.trim().length < 5) {
      setError('Necesitamos la dirección para llevártelo.');
      return;
    }
    // Sin cuenta no sabemos quién sos, y el comercio necesita poder avisarte.
    if (!account && (name.trim().length < 2 || phone.trim().length < 6)) {
      setError('Dejanos tu nombre y un teléfono para poder avisarte.');
      return;
    }
    start(async () => {
      const res = await placeOrderAction({
        storeId: store.id,
        lines: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        slotId,
        address: slot?.kind === 'reparto' ? address.trim() : undefined,
        paymentMethod: payment,
        accountId: payment === 'cuenta_corriente' ? account?.accountId : undefined,
        contact: account ? undefined : { name: name.trim(), phone: phone.trim() },
      });
      if (!res.ok) {
        setFalla(res.error);
        return;
      }
      cart.clear();
      router.push(res.checkoutUrl ?? `/s/${store.slug}/pedido/${res.code}`);
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
                      ? // El tiempo lo declara el comercio al aceptar (D18, D20).
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

        {!account && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-1 text-sm font-bold text-neutral-900">¿Quién sos?</h2>
            <p className="mb-3 text-xs text-neutral-500">
              Para que {store.name} pueda avisarte cuando esté listo.
            </p>
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-neutral-900">¿Cómo pagás?</h2>
          <div className="space-y-2">
            {methods.map((m) => {
              const ui = PAYMENT_UI[m];
              const Icon = ui.icon;
              return (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                    payment === m ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={payment === m}
                    onChange={() => setPayment(m)}
                    className="mt-0.5"
                  />
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-neutral-900">
                      {ui.label}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {m === 'transferencia' && store.transferAlias
                        ? `Alias ${store.transferAlias}`
                        : ui.hint}
                    </span>
                  </span>
                </label>
              );
            })}

            {/*
              La libreta se muestra siempre que el comercio la tome — grisada cuando
              no se puede, con el motivo. Esconderla no le enseña a nadie que existe.
            */}
            {showCredit && (
              <label
                className={`flex items-start gap-2 rounded-lg border p-3 ${
                  !credit.ok
                    ? 'border-neutral-200 bg-neutral-50'
                    : payment === 'cuenta_corriente'
                      ? 'cursor-pointer border-blue-500 bg-blue-50'
                      : 'cursor-pointer border-neutral-200'
                }`}
              >
                <input
                  type="radio"
                  name="pay"
                  disabled={!credit.ok}
                  checked={payment === 'cuenta_corriente'}
                  onChange={() => setPayment('cuenta_corriente')}
                  className="mt-0.5"
                />
                <BookMarked
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    credit.ok ? 'text-emerald-600' : 'text-neutral-400'
                  }`}
                />
                <span className="flex-1">
                  <span
                    className={`block text-sm font-semibold ${
                      credit.ok ? 'text-neutral-900' : 'text-neutral-500'
                    }`}
                  >
                    Anotar en la libreta
                  </span>
                  {credit.ok ? (
                    account && account.availableCents !== null ? (
                      // "Disponible", nunca "tu límite" (D32). Sin límite no se
                      // muestra la línea: "sin límite" suena a premio.
                      <span className="block text-xs text-neutral-500">
                        Disponible: {money(account.availableCents)}
                      </span>
                    ) : (
                      <span className="block text-xs text-neutral-500">
                        Lo pagás en el cierre, como siempre
                      </span>
                    )
                  ) : (
                    <span className="mt-0.5 block text-xs text-neutral-600">
                      {credit.message}
                    </span>
                  )}
                </span>
              </label>
            )}
          </div>

          {/*
            Solo cuando hay una libreta bloqueada que explicar. Si el comercio no da
            fiado, no hay nada que explicar y el botón queda suelto: un "hablá con
            el comercio" sin motivo al lado de las formas de pago no se entiende, y
            encima ya hay uno en el pie.
          */}
          {showCredit && !credit.ok && credit.offerContact && (
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

          {/* Algo que falta completar: se dice y ya, el botón está justo abajo. */}
          {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}

          {/*
            El pedido no salió. El carrito ya está armado y el nombre escrito:
            mandarlo a buscar el teléfono en ese momento es perder la venta. El botón
            es la misma válvula de escape de siempre — cuando el sistema no puede,
            que hablen las dos personas.
          */}
          {falla && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">
                {falla} Podés encargárselo directo a {store.name}.
              </p>
              <div className="mt-3">
                <ContactButton store={store} className="w-full justify-center" />
              </div>
            </div>
          )}

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
