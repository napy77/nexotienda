'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/lib/format';
import { payAccountAction } from '@/app/actions';

/**
 * Pagar contra la libreta, por un importe libre.
 *
 * No se elige qué resumen se paga: se manda un monto y NexoPOS lo imputa del más
 * viejo al más nuevo (D31). El pago parcial es requisito, no comodidad — el fiado de
 * pueblo funciona con flexibilidad, y una app que solo acepta el total es peor que
 * el cuaderno.
 */
export function PayAccount({
  storeId,
  storeSlug,
  storeName,
  accountId,
  owedCents,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  accountId: string;
  owedCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pesos, setPesos] = useState(String(Math.round(owedCents / 100)));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const amountCents = Math.round(Number(pesos.replace(/[^\d]/g, '')) * 100);
  const partial = amountCents > 0 && amountCents < owedCents;

  function pay() {
    setError(null);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Poné cuánto vas a pagar.');
      return;
    }
    if (amountCents > owedCents) {
      setError(`No podés pagar más de ${money(owedCents)}.`);
      return;
    }
    start(async () => {
      const res = await payAccountAction({
        storeId,
        storeSlug,
        storeName,
        accountId,
        amountCents,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(res.checkoutUrl);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
      >
        Pagar {money(owedCents)}
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <label className="block text-xs font-semibold text-emerald-900">
        ¿Cuánto vas a pagar?
      </label>
      <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-neutral-500">
            $
          </span>
          <input
            value={pesos}
            onChange={(e) => setPesos(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-emerald-300 bg-white py-2 pr-3 pl-7 text-sm font-semibold outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={pay}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? 'Yendo…' : 'Pagar'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          Cancelar
        </button>
      </div>

      {partial && (
        <p className="mt-2 text-xs text-emerald-800">
          Pagás una parte. Se imputa a lo más viejo primero; quedan{' '}
          {money(owedCents - amountCents)}.
        </p>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
