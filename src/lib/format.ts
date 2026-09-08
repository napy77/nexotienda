/** Los montos viajan en centavos por todo el sistema; acá se vuelven pesos. */
export function money(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(
    new Date(iso),
  );
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}
