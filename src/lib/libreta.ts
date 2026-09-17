import { nexopos } from '@/lib/nexopos';
import { getSesion } from '@/lib/session';
import type { MerchantAccount, Store } from '@/lib/nexopos/types';

/**
 * La cuenta de quien está mirando, si la sesión todavía vale.
 *
 * **La sesión no tiene autoridad.** Lo único que dice la cookie es "acá está abierta
 * la libreta `CLI-4231`"; todo lo demás —si está pausada, si el comercio toma fiado
 * online, cuánto queda— se pregunta en cada operación. Si el comerciante pausa el
 * fiado, la consulta siguiente lo dice y el pedido se rechaza, sin que nadie haya
 * tenido que acordarse de revocar nada.
 *
 * Lo que eso **no** cubre es que el vínculo se corte: que el comerciante desvincule
 * al cliente, o que la persona pierda el teléfono. Ahí no alcanza con preguntar el
 * estado, porque la cuenta sigue existiendo y sigue estando al día — simplemente ya
 * no es de quien tiene la cookie.
 *
 * Para eso está `linkedAt`. Se compara el valor guardado al abrir la sesión contra el
 * que tiene la cuenta ahora: **si cambió, el vínculo cambió y la sesión deja de
 * valer.** Se compara el valor y no la fecha, así no hay relojes de por medio.
 *
 * Es la única revocación que existe en este diseño, porque la sesión es una cookie en
 * un navegador ajeno y nadie —ni NexoPOS, ni ClubPay, ni nosotros— puede cerrarla.
 * No hace falta cerrarla: alcanza con que deje de servir.
 */
export interface Libreta {
  account: MerchantAccount | null;
  displayName: string | null;
  /** La sesión existe pero ya no vale. Hay que volver a entrar desde ClubPay. */
  caduca: boolean;
}

export async function libretaDeLaSesion(
  store: Pick<Store, 'id' | 'slug'>,
): Promise<Libreta> {
  const sesion = await getSesion(store.slug);
  if (!sesion) return { account: null, displayName: null, caduca: false };

  let account: MerchantAccount | null = null;
  try {
    account = await nexopos.getAccount(store.id, sesion.accountId);
  } catch (e) {
    // Que la API esté caída no puede convertirse en "no tenés libreta": eso le diría
    // a alguien que perdió algo que no perdió. Se trata como sesión sin cuenta, la
    // opción queda grisada con su motivo, y al rato vuelve sola.
    console.error('[nexotienda] no se pudo leer la cuenta de la sesión', e);
    return { account: null, displayName: sesion.displayName || null, caduca: false };
  }

  if (!account) return { account: null, displayName: null, caduca: true };

  if (sesion.linkedAt && account.linkedAt && sesion.linkedAt !== account.linkedAt) {
    return { account: null, displayName: null, caduca: true };
  }

  return {
    account,
    displayName: account.displayName || sesion.displayName || null,
    caduca: false,
  };
}
