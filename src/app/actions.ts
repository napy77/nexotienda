'use server';

import { revalidatePath } from 'next/cache';
import { nexopos } from '@/lib/nexopos';
import type { NewOrder, TownSearchHit } from '@/lib/nexopos/types';
import { payments } from '@/lib/payments';

export async function searchTownAction(
  townSlug: string,
  query: string,
): Promise<TownSearchHit[]> {
  const result = await nexopos.searchTown(townSlug, query);
  // TODO(D12): registrar las búsquedas sin resultado — son señal de demanda para el
  // comercio, para el mayorista y para el equipo comercial de Nexo B2B.
  return result.hits;
}

type PlaceResult =
  | { ok: true; code: string; checkoutUrl?: string }
  | { ok: false; error: string };

export async function placeOrderAction(input: NewOrder): Promise<PlaceResult> {
  let order;
  try {
    order = await nexopos.createOrder(input);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No pudimos registrar el pedido',
    };
  }

  // El efectivo y el fiado no pasan por el rail: no hay nada que cobrar online.
  if (order.paymentMethod !== 'online') {
    return { ok: true, code: order.code };
  }

  try {
    const intent = await payments.createIntent({
      kind: 'orden',
      reference: order.code,
      storeId: order.storeId,
      storeSlug: order.storeSlug,
      storeName: order.storeName,
      amountCents: order.totalCents,
      description: `Pedido ${order.code} en ${order.storeName}`,
      returnUrl: `/s/${order.storeSlug}/pedido/${order.code}`,
      personId: input.personId,
    });
    return { ok: true, code: order.code, checkoutUrl: intent.checkoutUrl };
  } catch (e) {
    // El pedido ya existe y le llegó al comercio. Que falle el cobro no lo borra:
    // lo dejamos pendiente y que lo arreglen entre ellos.
    return {
      ok: true,
      code: order.code,
    };
  }
}

/** Cobrar un resumen cerrado de la libreta. Admite monto parcial (D31). */
export async function payAccountPeriodAction(input: {
  personId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  periodId: string;
  amountCents: number;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  if (input.amountCents <= 0) {
    return { ok: false, error: 'El monto tiene que ser mayor a cero.' };
  }
  try {
    const intent = await payments.createIntent({
      kind: 'resumen',
      reference: `${input.storeId}|${input.periodId}|${input.personId}`,
      storeId: input.storeId,
      storeSlug: input.storeSlug,
      storeName: input.storeName,
      amountCents: input.amountCents,
      description: `Resumen de ${input.storeName}`,
      returnUrl: `/s/${input.storeSlug}/libreta`,
    });
    return { ok: true, checkoutUrl: intent.checkoutUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No pudimos iniciar el pago',
    };
  }
}

/**
 * Resuelve un cobro y lo liquida.
 *
 * En sandbox lo dispara el botón de la pantalla de pago; en producción lo dispara el
 * webhook de Mercado Pago. La liquidación —marcar el pedido pagado o imputar contra
 * el resumen— es la misma en los dos casos.
 */
export async function settlePaymentAction(
  intentId: string,
  outcome: 'aprobado' | 'rechazado',
): Promise<{ ok: boolean; returnUrl: string }> {
  const intent = payments.simulate
    ? await payments.simulate(intentId, outcome)
    : await payments.getIntent(intentId);

  if (!intent) return { ok: false, returnUrl: '/' };

  if (intent.status === 'aprobado') {
    if (intent.kind === 'orden') {
      await nexopos.confirmOrderPayment(intent.reference, intent.id);
    } else {
      const [storeId, periodId, personId] = intent.reference.split('|');
      await nexopos.registerAccountPayment({
        personId,
        storeId,
        periodId,
        amountCents: intent.amountCents,
        paymentId: intent.id,
      });
    }
  }

  revalidatePath(intent.returnUrl);
  return { ok: intent.status === 'aprobado', returnUrl: intent.returnUrl };
}
