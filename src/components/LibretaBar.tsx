import { BookOpenCheck, TriangleAlert } from 'lucide-react';
import type { Store } from '@/lib/nexopos/types';

/**
 * La franja que dice de quién es la libreta abierta.
 *
 * **Acá los teléfonos se comparten.** El de la casa, el del padre, el que quedó
 * sobre la mesa. Una libreta abierta que no dice de quién es no es un ataque ni una
 * falla del sistema: es una puerta que nadie sabe que quedó abierta, y el hijo que
 * agarra el celular entra a la tienda y ve la deuda.
 *
 * Por eso el nombre va arriba de todo y el "Salir" al lado, no escondido en un menú.
 * Y es un `POST`: con un link bastaría que el prefetch de Next cerrara la sesión al
 * pasar el mouse por encima.
 */
export function LibretaBar({
  store,
  accountName,
  vencio,
  caduca,
}: {
  store: Store;
  accountName: string | null;
  /** Volvió de ClubPay con un token que ya no servía. */
  vencio?: boolean;
  /**
   * La sesión existía pero el vínculo cambió: el comerciante desvinculó al cliente,
   * o lo volvió a vincular a otra ficha. No se dice cuál de las dos —no lo sabemos y
   * tampoco nos corresponde contarlo— se dice qué hacer.
   */
  caduca?: boolean;
}) {
  if (caduca) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-sm text-amber-900">
          <span className="font-bold">Tu libreta se cerró acá.</span> Volvé a entrar
          desde ClubPay, en Mis comercios → {store.name}. Si no te deja, hablá con el
          comercio.
        </p>
      </div>
    );
  }

  if (vencio) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700" />
        <p className="text-sm text-amber-900">
          <span className="font-bold">No pudimos abrir tu libreta.</span> El enlace dura
          dos minutos. Volvé a entrar desde ClubPay, en Mis comercios → {store.name}.
        </p>
      </div>
    );
  }

  if (!accountName) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
      <BookOpenCheck className="h-4 w-4 shrink-0 text-emerald-700" />
      <p className="text-sm text-emerald-900">
        Libreta de <span className="font-bold">{accountName}</span> abierta en {store.name}
      </p>
      <form action={`/s/${store.slug}/salir`} method="post" className="ml-auto">
        <button
          type="submit"
          className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
        >
          Salir
        </button>
      </form>
    </div>
  );
}
