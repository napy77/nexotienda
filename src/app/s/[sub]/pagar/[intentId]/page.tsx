import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { nexopos } from '@/lib/nexopos';
import { payments } from '@/lib/payments';
import { money } from '@/lib/format';
import { SandboxCheckout } from '@/components/SandboxCheckout';

/**
 * Pantalla de cobro.
 *
 * En producción esto no existe: Mercado Pago devuelve su propia URL y el comprador
 * paga allá. Esta pantalla es el sandbox, para poder recorrer el flujo completo sin
 * credenciales. Por eso está detrás de `payments.simulate`, que el adapter real no
 * implementa.
 */
export default async function PagarPage({
  params,
}: {
  params: Promise<{ sub: string; intentId: string }>;
}) {
  const { sub, intentId } = await params;
  const [store, intent] = await Promise.all([
    nexopos.getStore(sub),
    payments.getIntent(intentId),
  ]);
  if (!store || !intent) notFound();

  const isSandbox = typeof payments.simulate === 'function';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <header className="border-b border-neutral-100 bg-neutral-50 px-6 py-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            <Lock className="h-3 w-3" />
            Pago seguro
          </p>
        </header>

        <div className="px-6 py-6">
          <p className="text-sm text-neutral-600">Le vas a pagar a</p>
          <p className="text-lg font-bold text-neutral-900">{intent.storeName}</p>

          <p className="mt-5 text-sm text-neutral-600">
            {intent.kind === 'orden' ? `Pedido ${intent.reference}` : 'Resumen de tu libreta'}
          </p>
          <p className="text-4xl font-black tracking-tight text-neutral-900">
            {money(intent.amountCents)}
          </p>

          {/* P1: la plata va directo al comercio, no pasa por una cuenta de Nexo. */}
          <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
            El dinero va directo a la cuenta de {intent.storeName}.
          </p>

          {intent.status !== 'pendiente' ? (
            <p className="mt-6 text-sm font-semibold text-neutral-800">
              {intent.status === 'aprobado'
                ? 'Este pago ya se hizo.'
                : 'Este pago no se completó.'}
            </p>
          ) : isSandbox ? (
            <SandboxCheckout intentId={intent.id} />
          ) : (
            <p className="mt-6 text-sm text-neutral-600">Redirigiendo al medio de pago…</p>
          )}
        </div>
      </div>

      {isSandbox && (
        <p className="mt-4 text-center text-xs text-neutral-500">
          Pantalla de prueba. En producción acá va el checkout de Mercado Pago del
          comercio.
        </p>
      )}
    </main>
  );
}
