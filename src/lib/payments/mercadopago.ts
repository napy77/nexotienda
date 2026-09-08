/**
 * Adapter de Mercado Pago (modelo marketplace).
 *
 * Todavía no implementado: falta el onboarding del comercio como vendedor y las
 * credenciales. Cuando estén, esto crea una preferencia contra la cuenta del
 * comercio con `marketplace_fee` para nuestra comisión — la plata nunca toca una
 * cuenta de Nexo (P1).
 *
 * La comisión es del riel, no del crédito (D38): se cobra lo mismo si el pago es de
 * una compra de contado o de un resumen de la libreta.
 */
import type { PaymentsPort } from './types';

export const mercadoPagoPayments: PaymentsPort = {
  async createIntent() {
    throw new Error(
      'Mercado Pago todavía no está implementado. Falta el onboarding del comercio ' +
        'como vendedor en el marketplace y las credenciales. Ver docs/contrato-nexopos.md.',
    );
  },
  async getIntent() {
    return null;
  },
};
