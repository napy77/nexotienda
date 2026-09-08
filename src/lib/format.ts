/** Los montos viajan en centavos por todo el sistema; acá se vuelven pesos. */
export function money(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Convierte una fecha del contrato a un Date local.
 *
 * `new Date('2026-08-10')` se parsea como medianoche UTC, y al formatearlo en
 * Argentina (UTC−3) sale "9 de agosto". Una fecha corrida un día en una libreta es
 * de las cosas que hacen que el comerciante deje de creerle al sistema (P6), así que
 * las fechas sin hora se arman como locales a mano.
 */
function toLocalDate(iso: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(iso);
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(
    toLocalDate(iso),
  );
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(toLocalDate(iso));
}
