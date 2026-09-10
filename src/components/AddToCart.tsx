'use client';

import { Minus, Plus } from 'lucide-react';
import type { Product } from '@/lib/nexopos/types';
import { isBuyable } from './Availability';
import { useCart } from './CartProvider';

export function AddToCart({ product }: { product: Product }) {
  const cart = useCart();
  const qty = cart.quantityOf(product.id);

  if (!isBuyable(product.availability)) {
    return (
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-center text-sm font-semibold text-neutral-500">
        No disponible por ahora
      </p>
    );
  }

  if (qty === 0) {
    return (
      <button
        onClick={() => cart.add(product)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Agregar al carrito
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-1.5">
        <button
          onClick={() => cart.bump(product.id, -1)}
          aria-label="Sacar uno"
          className="flex h-8 w-8 items-center justify-center rounded bg-white text-blue-700 hover:bg-neutral-100"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-blue-900">{qty} en el carrito</span>
        <button
          onClick={() => cart.bump(product.id, 1)}
          disabled={cart.atMax(product)}
          aria-label="Sumar uno"
          title={cart.atMax(product) ? 'Es todo lo que hay' : undefined}
          className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
    </div>
  );
}
