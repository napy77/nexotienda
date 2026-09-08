/**
 * El rail de cobro.
 *
 * Vale lo mismo que para NexoPOS: esto es un puerto, no un cliente HTTP. Hoy corre
 * el adapter de sandbox; mañana el de Mercado Pago. Nada del resto de la app sabe
 * cuál de los dos está enchufado.
 *
 * P1 — La plata va directo del comprador a la cuenta de Mercado Pago DEL COMERCIO,
 * con nuestra comisión retenida en la misma operación (modelo marketplace). Nunca
 * pasa por una cuenta de Nexo. Ese principio no se cumple por buena conducta: se
 * cumple porque el adapter no tiene a dónde mandar la plata que no sea el comercio.
 */

export type PaymentIntentKind = 'orden' | 'resumen';

export type PaymentIntentStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'expirado';

export interface PaymentIntent {
  id: string;
  kind: PaymentIntentKind;
  /** Código del pedido, o id del período de la libreta. */
  reference: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  amountCents: number;
  status: PaymentIntentStatus;
  createdAt: string;
  /** A dónde mandamos al comprador para que pague. */
  checkoutUrl: string;
  /** A dónde vuelve cuando termina. */
  returnUrl: string;
  failureReason?: string;
}

export interface NewPaymentIntent {
  kind: PaymentIntentKind;
  reference: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  personId?: string;
}

export interface PaymentsPort {
  createIntent(input: NewPaymentIntent): Promise<PaymentIntent>;
  getIntent(id: string): Promise<PaymentIntent | null>;
  /**
   * Solo existe en sandbox: hace lo que en producción hace la persona en la pantalla
   * de Mercado Pago. El adapter real no lo implementa.
   */
  simulate?(id: string, outcome: 'aprobado' | 'rechazado'): Promise<PaymentIntent | null>;
}
