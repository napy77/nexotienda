import { mercadoPagoPayments } from './mercadopago';
import { sandboxPayments } from './sandbox';
import type { PaymentsPort } from './types';

export const payments: PaymentsPort = process.env.MP_ACCESS_TOKEN
  ? mercadoPagoPayments
  : sandboxPayments;

export * from './types';
