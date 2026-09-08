'use client';

import { Barcode, Check, Minus, Plus, Sparkles } from 'lucide-react';
import { money } from '@/lib/format';
import type { Product } from '@/lib/nexopos/types';
import { AvailabilityNote, isBuyable } from './Availability';
import { useCart } from './CartProvider';

export function ProductCard({ product, storeName }: { product: Product; storeName: string }) {
  const cart = useCart();
  const qty = cart.quantityOf(product.id);
  const buyable = isBuyable(product.availability);

  const discount =
    product.listPriceCents && product.listPriceCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.listPriceCents) * 100)
      : null;

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs transition-all duration-150 hover:shadow-md">
      <div className="relative p-3">
        <div className="pointer-events-none absolute top-3 right-3 left-3 z-10 flex items-center justify-between gap-1">
          {product.packTag && (
            <span className="rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-xs">
              {product.packTag}
            </span>
          )}
          {discount ? (
            <span className="ml-auto rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs">
              -{discount}%
            </span>
          ) : null}
        </div>

        <div className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-50 sm:h-48">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <span className="text-xs text-neutral-400">Sin foto</span>
          )}

          {/* De dónde viene el dato del producto: heredado de B2B o del propio comercio (D1). */}
          <div className="absolute bottom-1.5 left-2">
            {product.origin === 'canonico' ? (
              <span className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500 backdrop-blur-xs">
                <Barcode className="h-2.5 w-2.5" />
                Nexo B2B
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50/95 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                Hecho en {storeName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3 pt-0">
        <div>
          {product.brand && (
            <p className="mb-0.5 text-[11px] font-medium tracking-wider text-neutral-400 uppercase">
              {product.brand}
            </p>
          )}
          <h3 className="line-clamp-2 min-h-[2.5rem] text-xs leading-snug font-semibold text-neutral-800 sm:text-sm">
            {product.name}
          </h3>

          <div className="mt-2">
            {product.listPriceCents && product.listPriceCents > product.priceCents && (
              <span className="mr-1.5 text-xs text-neutral-400 line-through">
                {money(product.listPriceCents)}
              </span>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-lg leading-none font-bold text-neutral-900 sm:text-xl">
                {money(product.priceCents)}
              </span>
              <span className="text-[11px] font-normal text-neutral-500">/ {product.unit}</span>
            </div>
            <AvailabilityNote availability={product.availability} />
          </div>
        </div>

        <div className="mt-3 border-t border-neutral-100 pt-2">
          {!buyable ? (
            <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-500">
              No disponible
            </div>
          ) : qty === 0 ? (
            <button
              onClick={() => cart.add(product)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-1">
              <button
                onClick={() => cart.bump(product.id, -1)}
                aria-label="Sacar uno"
                className="flex h-7 w-7 items-center justify-center rounded bg-white text-blue-700 shadow-2xs transition-colors hover:bg-neutral-100"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="flex items-center gap-1 px-2 text-xs font-bold text-blue-900">
                <Check className="h-3 w-3" />
                {qty} en el carrito
              </span>
              <button
                onClick={() => cart.bump(product.id, 1)}
                aria-label="Sumar uno"
                className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white shadow-2xs transition-colors hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
