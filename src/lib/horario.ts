import type { OpeningSlot, Store } from '@/lib/nexopos/types';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Qué le decimos al comprador sobre si el comercio atiende.
 *
 * Tres estados, no dos. `isOpenNow` puede ser `null` —comercio sin horario
 * cargado— y eso **no es "cerrado"**: es que no sabemos. Decir "cerrado" cuando el
 * tipo está atendiendo le hace perder una venta; decir "abierto" cuando tiene la
 * persiana baja manda a alguien a un viaje al pedo. Las dos son afirmar lo que no
 * podemos respaldar (P5).
 */
export type OpenState =
  | { kind: 'abierto' }
  | { kind: 'cerrado'; abreLabel?: string }
  | { kind: 'desconocido' };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** El próximo tramo de atención a partir de ahora, para "abre el lunes a las 8". */
function nextSlot(schedule: OpeningSlot[], now: Date): { slot: OpeningSlot; days: number } | null {
  const today = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 8; offset++) {
    const day = (today + offset) % 7;
    const delSia = schedule
      .filter((s) => s.day === day)
      .filter((s) => offset > 0 || toMinutes(s.from) > minutes)
      .sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
    if (delSia.length) return { slot: delSia[0], days: offset };
  }
  return null;
}

export function openState(
  store: Pick<Store, 'isOpenNow' | 'schedule'>,
  now: Date = new Date(),
): OpenState {
  if (store.isOpenNow === null || store.isOpenNow === undefined) {
    return { kind: 'desconocido' };
  }
  if (store.isOpenNow) return { kind: 'abierto' };

  // Cerrado: si hay horario, se puede decir cuándo abre — que es bastante más útil
  // que un "cerrado" a secas.
  if (!store.schedule?.length) return { kind: 'cerrado' };

  const next = nextSlot(store.schedule, now);
  if (!next) return { kind: 'cerrado' };

  const { slot, days } = next;
  const cuando =
    days === 0 ? 'hoy' : days === 1 ? 'mañana' : `el ${DIAS[slot.day]}`;
  return { kind: 'cerrado', abreLabel: `Abre ${cuando} a las ${slot.from}` };
}

export function openLabel(state: OpenState): { text: string; tone: 'ok' | 'off' | 'unknown' } {
  switch (state.kind) {
    case 'abierto':
      return { text: 'Abierto ahora', tone: 'ok' };
    case 'cerrado':
      return { text: state.abreLabel ?? 'Cerrado ahora', tone: 'off' };
    case 'desconocido':
      // Ni "abierto" ni "cerrado": lo que sabemos es que se puede encargar igual.
      return { text: 'Podés dejar tu pedido', tone: 'unknown' };
  }
}
