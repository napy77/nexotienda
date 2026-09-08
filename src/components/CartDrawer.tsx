'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { money } from '@/lib/format';
import type { Store } from '@/lib/nexopos/types';
import { useCart } from './CartProvider';

/**
 * Vista rápida del carrito.
 *
 * Deliberadamente NO es un segundo checkout: mostrar, ajustar cantidades y mandar a
 * `/carrito`, que es donde vive la única implementación de la compra. Dos checkouts
 * es la forma más segura de que uno de los dos quede desactualizado.
 */
export function CartDrawer({
  store,
  open,
  onClose,
}: {
  store: Store;
  open: boolean;
  onClose: () => void;
}) {
  const cart = useCart();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-label="Tu carrito"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-neutral-900">Tu carrito</p>
            <p className="text-xs text-neutral-500">{store.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <ShoppingBag className="h-9 w-9 text-neutral-300" />
            <p className="text-sm font-semibold text-neutral-800">Todavía no pusiste nada</p>
            <button
              onClick={onClose}
              className="mt-1 text-sm font-semibold text-blue-700 hover:underline"
            >
              Seguir mirando
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-neutral-100 overflow-y-auto">
              {cart.lines.map((l) => (
                <li key={l.product.id} className="flex gap-3 px-5 py-3">
                  {l.product.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.product.imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg bg-neutral-50 object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-semibold text-neutral-900">
                      {l.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {money(l.product.priceCents)} / {l.product.unit}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <button
                        onClick={() => cart.bump(l.product.id, -1)}
                        aria-label="Sacar uno"
                        className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 hover:bg-neutral-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold">{l.quantity}</span>
                      <button
                        onClick={() => cart.bump(l.product.id, 1)}
                        aria-label="Sumar uno"
                        className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 hover:bg-neutral-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => cart.remove(l.product.id)}
                        aria-label="Sacar del carrito"
                        className="ml-auto flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="w-20 shrink-0 text-right text-sm font-bold text-neutral-900">
                    {money(l.product.priceCents * l.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <footer className="border-t border-neutral-200 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-neutral-600">Productos</span>
                <span className="text-xl font-black text-neutral-900">
                  {money(cart.subtotalCents)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                El envío y la forma de pago se eligen en el próximo paso.
              </p>
              <Link
                href={`/s/${store.slug}/carrito`}
                onClick={onClose}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Ir al pedido
                <ArrowRight className="h-4 w-4" />
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
