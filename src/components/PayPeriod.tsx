'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/lib/format';
import { payAccountPeriodAction } from '@/app/actions';

/**
 * Pagar un resumen cerrado.
 *
 * Admite pago parcial (D31), porque el fiado de pueblo funciona con flexibilidad: si
 * la app solo acepta el total, es peor que el cuaderno.
 */
export function PayPeriod({
  personId,
  storeId,
  storeSlug,
  storeName,
  periodId,
  pendingCents,
}: {
  personId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  periodId: string;
  pendingCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pesos, setPesos] = useState(String(Math.round(pendingCents / 100)));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const amountCents = Math.round(Number(pesos.replace(/[^\d]/g, '')) * 100);
  const partial = amountCents > 0 && amountCents < pendingCents;

  function pay() {
    setError(null);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError('Poné cuánto vas a pagar.');
      return;
    }
    if (amountCents > pendingCents) {
      setError(`No podés pagar más de ${money(pendingCents)}.`);
      return;
    }
    start(async () => {
      const res = await payAccountPeriodAction({
        personId,
        storeId,
        storeSlug,
        storeName,
        periodId,
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
        Pagar {money(pendingCents)}
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
          Pagás una parte. Quedan {money(pendingCents - amountCents)} en este resumen.
        </p>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
