'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { BadgeCheck, Search, Store as StoreIcon } from 'lucide-react';
import { money } from '@/lib/format';
import type { Store, TownSearchHit } from '@/lib/nexopos/types';
import { availabilityLabel } from './Availability';
import { openLabel, openState } from '@/lib/horario';
import { searchTownAction } from '@/app/actions';

/**
 * La página del pueblo es un buscador de existencias, no un marketplace (D11).
 * La caja de búsqueda es la pieza central, no un accesorio arriba de una grilla.
 */
export function TownSearch({
  townSlug,
  townName,
  stores,
}: {
  townSlug: string;
  townName: string;
  stores: Store[];
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TownSearchHit[] | null>(null);
  const [pending, start] = useTransition();

  function run(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    start(async () => setHits(await searchTownAction(townSlug, q)));
  }

  // Sin comercios publicados, el buscador promete algo que la página no puede
  // cumplir: cualquier búsqueda va a volver vacía. Es más honesto decir que
  // todavía no hay nada que ofrecer una caja que no sirve.
  if (stores.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6">
        <StoreIcon className="h-10 w-10 text-neutral-300" />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">
            Todavía no hay comercios en {townName}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            Cuando los comercios del pueblo publiquen su tienda, vas a poder buscar acá
            quién tiene lo que necesitás.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <p className="text-sm font-semibold text-neutral-900">Si tenés un comercio acá</p>
          <p className="mt-1 text-sm text-neutral-600">
            Desde NexoPOS podés publicar tu tienda y elegir aparecer en esta página. Tu
            dirección propia funciona igual, aunque no aparezcas acá.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-neutral-900 py-12 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <p className="text-xs font-bold tracking-widest text-neutral-400 uppercase">
            {townName}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            ¿Quién lo tiene en {townName}?
          </h1>
          <p className="mt-2 text-sm text-neutral-300">
            Buscá un producto y te decimos qué comercio lo tiene cargado.
          </p>

          <form onSubmit={run} className="mt-6 flex gap-2">
            <label className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Campari, yerba, tornillos…"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-3 pr-3 pl-10 text-base text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-60"
            >
              {pending ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {hits !== null && (
          <section className="mb-10">
            {hits.length === 0 ? (
              <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
                {/* Nunca afirmamos que nadie lo tiene (P5). */}
                <p className="text-sm font-semibold text-neutral-800">
                  No lo encontramos cargado en {townName}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Puede que algún comercio lo tenga sin subir todavía. Probá preguntando
                  directamente.
                </p>
              </div>
            ) : (
              <>
                <h2 className="mb-3 text-sm font-bold tracking-wide text-neutral-500 uppercase">
                  {hits.length} {hits.length === 1 ? 'resultado' : 'resultados'}
                </h2>
                <ul className="space-y-2">
                  {hits.map(({ product, store }) => {
                    const a = availabilityLabel(product.availability);
                    return (
                      <li
                        key={`${store.id}-${product.id}`}
                        className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
                      >
                        {product.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="h-14 w-14 rounded-lg bg-neutral-50 object-contain"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-neutral-900">
                            {product.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {store.name} · {a.text}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-neutral-900">
                            {money(product.priceCents)}
                          </p>
                          {store.storefrontPublished && (
                            <Link
                              href={`/s/${store.slug}`}
                              className="text-xs font-semibold text-blue-700 hover:underline"
                            >
                              Ir a la tienda
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-neutral-500 uppercase">
            Comercios de {townName}
          </h2>
          {stores.every((s) => !s.storefrontPublished) && (
            <p className="mb-3 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-600">
              Ninguno vende online todavía. Podés pasar por el local o llamarlos.
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {stores.map((s) => (
              <li key={s.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start gap-2">
                  <StoreIcon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-semibold text-neutral-900">
                      {s.name}
                      {s.verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {s.category} · {openLabel(openState(s)).text}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">{s.address}</p>
                    {s.storefrontPublished ? (
                      <Link
                        href={`/s/${s.slug}`}
                        className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Ver tienda
                      </Link>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-400">Todavía no vende online</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
