import { ChefHat, HelpCircle } from 'lucide-react';
import type { Availability } from '@/lib/nexopos/types';

/**
 * Cómo se cuenta la disponibilidad al comprador.
 *
 * La regla es P5/P6: no afirmamos lo que no podemos respaldar. Si el POS no reportó
 * disponibilidad, lo decimos — nunca inventamos un "hay stock" ni mostramos cero.
 * Y para el producto propio no hablamos de stock, hablamos del cupo del día (D4).
 */
export function availabilityLabel(a: Availability): {
  text: string;
  tone: 'ok' | 'warn' | 'off' | 'unknown';
} {
  switch (a.policy) {
    case 'stock':
      if (a.onHand <= 0) return { text: 'Sin stock por ahora', tone: 'off' };
      if (a.onHand <= 5) return { text: `Quedan ${a.onHand}`, tone: 'warn' };
      return { text: 'Disponible', tone: 'ok' };
    case 'declared':
      if (a.state === 'out') return { text: 'Se acabó por hoy', tone: 'off' };
      if (a.quota) return { text: `Quedan ${a.quota.remaining} de hoy`, tone: 'warn' };
      return { text: 'Se hace en el momento', tone: 'ok' };
    case 'unknown':
      return { text: 'Consultá disponibilidad', tone: 'unknown' };
  }
}

/**
 * Cuánto se puede pedir de esto.
 *
 * Con stock, el tope es lo que hay: si el POS dice 3, se compran hasta 3. Con cupo
 * del día, lo que queda del cupo. Cuando no sabemos, no ponemos tope — lo confirma
 * el comercio al aceptar, y un límite inventado sería peor que ninguno (P6).
 */
export function maxQuantity(a: Availability): number | null {
  if (a.policy === 'stock') return Math.max(0, a.onHand);
  if (a.policy === 'declared') {
    if (a.state === 'out') return 0;
    return a.quota ? Math.max(0, a.quota.remaining) : null;
  }
  return null;
}

export function isBuyable(a: Availability): boolean {
  if (a.policy === 'stock') return a.onHand > 0;
  if (a.policy === 'declared') return a.state === 'available';
  // Si no sabemos, dejamos pedir: lo confirma el comercio al aceptar (D18).
  return true;
}

const TONE: Record<string, string> = {
  ok: 'text-neutral-500',
  warn: 'text-amber-700 font-medium',
  off: 'text-red-700 font-medium',
  unknown: 'text-neutral-500 italic',
};

export function AvailabilityNote({ availability }: { availability: Availability }) {
  const { text, tone } = availabilityLabel(availability);
  return (
    <p className={`mt-0.5 flex items-center gap-1 text-[10px] ${TONE[tone]}`}>
      {availability.policy === 'declared' && <ChefHat className="h-3 w-3" />}
      {availability.policy === 'unknown' && <HelpCircle className="h-3 w-3" />}
      <span>{text}</span>
    </p>
  );
}
