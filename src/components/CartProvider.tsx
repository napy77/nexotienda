'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Product } from '@/lib/nexopos/types';

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartApi {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  quantityOf: (productId: string) => number;
  add: (product: Product) => void;
  bump: (productId: string, delta: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  ready: boolean;
}

const Ctx = createContext<CartApi | null>(null);

/**
 * Un carrito por comercio (D15): no hay carrito combinado entre tiendas, así que la
 * clave de storage lleva el slug. Cambiar de tienda no arrastra lo de la anterior.
 */
export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const key = `nexotienda:carrito:${slug}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      // Ventana privada o storage bloqueado: se arranca con el carrito vacío.
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      // No poder guardar no puede romper la compra en curso.
    }
  }, [key, lines, ready]);

  const add = useCallback((product: Product) => {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const bump = useCallback((productId: string, delta: number) => {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.product.id !== productId) return [l];
        const q = l.quantity + delta;
        return q > 0 ? [{ ...l, quantity: q }] : [];
      }),
    );
  }, []);

  const remove = useCallback(
    (productId: string) => setLines((prev) => prev.filter((l) => l.product.id !== productId)),
    [],
  );

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartApi>(
    () => ({
      lines,
      ready,
      count: lines.reduce((a, l) => a + l.quantity, 0),
      subtotalCents: lines.reduce((a, l) => a + l.product.priceCents * l.quantity, 0),
      quantityOf: (id) => lines.find((l) => l.product.id === id)?.quantity ?? 0,
      add,
      bump,
      remove,
      clear,
    }),
    [lines, ready, add, bump, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart fuera de CartProvider');
  return ctx;
}
