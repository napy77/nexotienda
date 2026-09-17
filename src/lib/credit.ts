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
    /*
      Sin sesión no sabemos si esta persona tiene libreta o no, y no podemos
      averiguarlo: el que sabe es ClubPay. Así que el mensaje tiene que servir para
      los dos casos sin afirmar ninguno (P5) — decirle "no tenés libreta" a alguien
      que sí la tiene es negarle algo que el comerciante le dio.

      Y tiene que decir **cómo se entra**, que es lo que faltaba: la libreta online
      se abre desde ClubPay y desde ningún otro lado.
    */
    return {
      ok: false,
      reason: 'sin_cuenta',
      message: `Si ya tenés libreta con ${store.name}, entrá desde ClubPay para usarla acá. Si todavía no, se abre en el mostrador.`,
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
