'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { settlePaymentAction } from '@/app/actions';

/** Los dos botones que en producción son la pantalla de Mercado Pago. */
export function SandboxCheckout({ intentId }: { intentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function resolve(outcome: 'aprobado' | 'rechazado') {
    start(async () => {
      const res = await settlePaymentAction(intentId, outcome);
      router.push(res.returnUrl);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-2">
      <button
        onClick={() => resolve('aprobado')}
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? 'Procesando…' : 'Pagar'}
      </button>
      <button
        onClick={() => resolve('rechazado')}
        disabled={pending}
        className="w-full rounded-lg border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-60"
      >
        Simular un rechazo
      </button>
    </div>
  );
}
