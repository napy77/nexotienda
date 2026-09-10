import Link from 'next/link';
import { BookOpenCheck, PackageCheck, Truck } from 'lucide-react';
import { money } from '@/lib/format';
import type { MerchantAccount, Store } from '@/lib/nexopos/types';

/**
 * Los tres motivos para comprar acá. Todo sale del comercio: los umbrales de envío,
 * sus franjas reales y si da libreta.
 *
 * Lo que NO hacemos es prometer un tiempo (D20). El prototipo decía "retirá en 15
 * min"; eso es una promesa nuestra sobre el trabajo de otro, y el día que hay cola
 * quedamos mal los dos. El tiempo lo declara el comercio cuando acepta el pedido.
 */
export function ValueProps({
  store,
  account,
}: {
  store: Store;
  account: MerchantAccount | null;
}) {
  const reparto = store.slots.filter((s) => s.kind === 'reparto');

  return (
    <div className="mb-6 grid grid-cols-1 divide-y divide-neutral-100 rounded-lg border border-neutral-200/90 bg-white p-4 shadow-xs sm:p-5 md:grid-cols-3 md:divide-x md:divide-y-0">
      {store.freeDeliveryOverCents !== undefined && (
        <div className="flex items-center gap-4 pt-2 md:pt-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm leading-tight font-bold text-neutral-900">
              Envío sin cargo desde {money(store.freeDeliveryOverCents)}
            </h4>
            <p className="mt-0.5 text-xs text-neutral-600">
              En {store.town} y la zona que reparte {store.name}.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-3 md:pt-0 md:pl-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200/60 bg-blue-50 text-blue-700">
          <PackageCheck className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm leading-tight font-bold text-neutral-900">
            {reparto.length > 0 ? 'Retiralo o te lo llevan' : 'Encargá y pasá a retirarlo'}
          </h4>
          <p className="mt-0.5 text-xs text-neutral-600">
            {reparto.length > 0
              ? `${reparto.map((s) => s.label.replace('Reparto ', '')).join(' o ')}. `
              : ''}
            Te avisamos cuando esté listo, sin hacer cola.
          </p>
        </div>
      </div>

      {store.allowsCredit && (
        <Link
          href={`/s/${store.slug}/libreta`}
          className="group -m-2 flex items-center gap-4 rounded-lg p-2 pt-3 transition-colors hover:bg-neutral-50/70 md:pt-0 md:pl-6"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-50 text-emerald-700 transition-transform group-hover:scale-105">
            <BookOpenCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm leading-tight font-bold text-neutral-900 group-hover:text-emerald-800">
              {account ? 'Tu libreta con este comercio' : 'Acá se puede comprar en la libreta'}
            </h4>
            <p className="mt-0.5 text-xs text-neutral-600">
              {!account
                ? 'El fiado de siempre, anotado y a la vista. Se abre en el mostrador.'
                : account.availableCents !== null
                  ? // "Disponible", nunca "tu límite" (D32). Sin límite no se muestra:
                    // "sin límite" suena a premio y es solo cómo funciona el cuaderno.
                    `Disponible ${money(account.availableCents)}. Cierra el ${account.closingDay}.`
                  : `Cierra el ${account.closingDay} de cada mes.`}
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}
