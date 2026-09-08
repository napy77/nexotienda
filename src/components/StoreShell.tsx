'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookMarked, MapPin, MessageCircle, Phone, ShoppingCart, Store as StoreIcon } from 'lucide-react';
import type { Store } from '@/lib/nexopos/types';
import { CartDrawer } from './CartDrawer';
import { CartProvider, useCart } from './CartProvider';

function CartButton({ onOpen }: { onOpen: () => void }) {
  const cart = useCart();
  return (
    <button
      onClick={onOpen}
      className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-black/10"
    >
      <ShoppingCart className="h-5 w-5" />
      <span className="hidden sm:inline">Carrito</span>
      {cart.ready && cart.count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold text-white">
          {cart.count}
        </span>
      )}
    </button>
  );
}

function ShellBody({ store, children }: { store: Store; children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <>
      <header className="bg-[var(--nexo-amarillo)]">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href={`/s/${store.slug}`} className="flex items-center gap-2">
            <StoreIcon className="h-6 w-6 text-neutral-900" />
            <div className="leading-tight">
              <p className="text-base font-black tracking-tight text-neutral-900">{store.name}</p>
              <p className="flex items-center gap-1 text-[11px] text-neutral-700">
                <MapPin className="h-3 w-3" />
                {store.town}
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href={`/s/${store.slug}/libreta`}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-black/10"
            >
              <BookMarked className="h-5 w-5" />
              <span className="hidden sm:inline">Mi libreta</span>
            </Link>
            <CartButton onOpen={() => setCartOpen(true)} />
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[12px] text-neutral-600">
          <span className="font-medium text-neutral-800">{store.category}</span>
          <span>{store.address}</span>
          {store.openingHours && <span className="hidden md:inline">{store.openingHours}</span>}
        </div>
      </div>

      {children}

      <CartDrawer store={store} open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

/**
 * Botón de contacto: la válvula de escape del modelo. Cuando algo no cierra, la
 * plataforma no arbitra — pone a las dos personas a hablar.
 */
export function ContactButton({
  store,
  className = '',
}: {
  store: Pick<Store, 'name' | 'phone' | 'whatsapp'>;
  className?: string;
}) {
  const wa = store.whatsapp?.replace(/\D/g, '');
  if (!wa && !store.phone) return null;
  const href = wa ? `https://wa.me/54${wa}` : `tel:${store.phone}`;
  return (
    <a
      href={href}
      target={wa ? '_blank' : undefined}
      rel={wa ? 'noopener noreferrer' : undefined}
      className={`inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 ${className}`}
    >
      {wa ? <MessageCircle className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
      Hablar con {store.name}
    </a>
  );
}

export function StoreShell({
  store,
  children,
  bleed,
}: {
  store: Store;
  children: React.ReactNode;
  /** Contenido que va a ancho completo antes del main (el hero de la tienda). */
  bleed?: React.ReactNode;
}) {
  return (
    <CartProvider slug={store.slug}>
      <ShellBody store={store}>
        {bleed}
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </ShellBody>

      <footer className="mx-auto max-w-7xl px-4 pt-4 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-6">
          <p className="text-xs text-neutral-500">
            {store.name} · {store.address}
          </p>
          <ContactButton store={store} />
        </div>
      </footer>
    </CartProvider>
  );
}
