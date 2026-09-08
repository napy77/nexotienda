/**
 * Adapter de sandbox. Simula lo que hace Mercado Pago sin salir del proceso, para
 * que el flujo de comprar y pagar funcione hoy de punta a punta.
 *
 * Guarda en memoria: al reiniciar el server se pierde, igual que los pedidos.
 */
import type {
  NewPaymentIntent,
  PaymentIntent,
  PaymentsPort,
} from './types';

const intents = new Map<string, PaymentIntent>();
let seq = 1;

export const sandboxPayments: PaymentsPort = {
  async createIntent(input: NewPaymentIntent) {
    const id = `pay_sbx_${String(seq++).padStart(5, '0')}`;
    const intent: PaymentIntent = {
      id,
      kind: input.kind,
      reference: input.reference,
      storeId: input.storeId,
      storeSlug: input.storeSlug,
      storeName: input.storeName,
      amountCents: input.amountCents,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
      // En producción esto lo devuelve Mercado Pago. Acá es una pantalla nuestra.
      checkoutUrl: `/s/${input.storeSlug}/pagar/${id}`,
      returnUrl: input.returnUrl,
    };
    intents.set(id, intent);
    return intent;
  },

  async getIntent(id) {
    return intents.get(id) ?? null;
  },

  async simulate(id, outcome) {
    const intent = intents.get(id);
    if (!intent || intent.status !== 'pendiente') return intent ?? null;
    const next: PaymentIntent = {
      ...intent,
      status: outcome,
      failureReason: outcome === 'rechazado' ? 'Rechazado en la simulación' : undefined,
    };
    intents.set(id, next);
    return next;
  },
};
