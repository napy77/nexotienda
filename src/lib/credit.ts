import type { CreditBlockReason, MerchantAccount, Store } from '@/lib/nexopos/types';

/**
 * Por qué se puede o no comprar en la libreta.
 *
 * El camino normal de la tienda **no pasa por acá**: alguien entra, compra dos
 * paquetes de harina y paga al recibirlos. La cuenta corriente es lo excepcional —
 * se autoriza en el mostrador con el cliente presente (D23) y la persona la vincula
 * desde ClubPay (D25).
 *
 * Cuando no se puede, la opción **no se esconde: se explica**. Un botón que
 * desaparece no le enseña a nadie que la libreta existe ni cómo conseguirla; y un
 * botón apagado sin explicación, a las once de la noche y sin nadie del otro lado,
 * es una humillación (D36). Por eso cada motivo tiene su propio texto: no es lo
 * mismo no tener cuenta que tenerla pausada.
 */
export type CreditState =
  | { ok: true }
  | { ok: false; reason: CreditBlockReason; message: string; offerContact: boolean };

export function creditState(
  store: Pick<Store, 'name'>,
  account: MerchantAccount | null,
  totalCents: number,
): CreditState {
  if (!account) {
    return {
      ok: false,
      reason: 'sin_cuenta',
      message: `Para comprar en la libreta, hablá con ${store.name}. Se abre en el mostrador.`,
      offerContact: true,
    };
  }

  if (account.creditPaused) {
    return {
      ok: false,
      reason: 'pausada',
      message: `Para seguir comprando en la libreta, hablá con ${store.name}.`,
      offerContact: true,
    };
  }

  if (!account.onlineCreditEnabled) {
    return {
      ok: false,
      reason: 'solo_mostrador',
      message: `${store.name} toma la libreta solo en el mostrador.`,
      offerContact: false,
    };
  }

  // `null` es sin límite, que es el default y el caso más común. No es cero.
  if (account.availableCents !== null && totalCents > account.availableCents) {
    return {
      ok: false,
      reason: 'sin_disponible',
      message:
        account.availableCents <= 0
          ? 'No te queda disponible en la libreta.'
          : 'Este pedido supera tu disponible. Podés pagarlo de otra forma.',
      offerContact: false,
    };
  }

  return { ok: true };
}
