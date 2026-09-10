/**
 * Adapter HTTP contra la API real de NexoPOS.
 *
 * **Dos credenciales, no una.** Los endpoints de plataforma (resolver un subdominio,
 * el pueblo) no tienen otra credencial posible. Los del comercio —su catálogo, su
 * stock, las cuentas de sus clientes, sus pedidos— van con la clave de ESE comercio.
 *
 * El motivo lo planteó NexoPOS y es correcto: una clave de plataforma que puede leer
 * y escribir la cuenta corriente de cualquier comercio concentra un daño del tamaño
 * del ecosistema entero. Que la libreta de una persona viaje con la misma llave que
 * el buscador del pueblo no cierra.
 *
 * Las dos claves viven solo del lado del servidor. Nunca llegan al navegador.
 */
import type {
  AccountEntry,
  MerchantAccount,
  NewOrder,
  NexoPosPort,
  Order,
  Pasillo,
  Product,
  Region,
  Store,
  TownSearchResult,
} from './types';

const BASE = process.env.NEXOPOS_API_URL ?? '';
const PLATFORM_KEY = process.env.NEXOPOS_PLATFORM_KEY ?? '';

/**
 * La clave del comercio. Hoy sale de env para el piloto de un solo comercio; cuando
 * sean varios, esto se resuelve por `storeId` contra donde las guardemos.
 */
function merchantKey(_storeId: string): string {
  return process.env.NEXOPOS_MERCHANT_KEY ?? '';
}

async function call<T>(path: string, key: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...init?.headers,
    },
    // El stock cambia con cada venta del mostrador: no lo cacheamos.
    cache: 'no-store',
  });
  if (res.status === 404) return null as T;
  if (!res.ok) throw new Error(`NexoPOS ${res.status} en ${path}`);
  return (await res.json()) as T;
}

const platform = <T>(path: string, init?: RequestInit) => call<T>(path, PLATFORM_KEY, init);
const merchant = <T>(storeId: string, path: string, init?: RequestInit) =>
  call<T>(path, merchantKey(storeId), init);

export const client: NexoPosPort = {
  // --- plataforma ---
  resolveHost: (sub) => platform(`/v1/hosts/${encodeURIComponent(sub)}`),
  listRegions: () => platform<Region[]>('/v1/regions'),
  getRegion: (slug) => platform<Region | null>(`/v1/regions/${slug}`),
  listTownStores: (townSlug) => platform<Store[]>(`/v1/regions/${townSlug}/stores`),
  searchTown: (townSlug, query) =>
    platform<TownSearchResult>(`/v1/regions/${townSlug}/search?q=${encodeURIComponent(query)}`),

  // --- del comercio ---
  getStore: (slug) => platform<Store | null>(`/v1/stores/${encodeURIComponent(slug)}`),
  listPasillos: (storeId) => merchant<Pasillo[]>(storeId, `/v1/stores/${storeId}/pasillos`),
  listProducts: (storeId) => merchant<Product[]>(storeId, `/v1/stores/${storeId}/products`),
  getProduct: (storeId, productId) =>
    merchant<Product | null>(storeId, `/v1/stores/${storeId}/products/${productId}`),

  getAccount: (storeId, accountId) =>
    merchant<MerchantAccount | null>(storeId, `/v1/stores/${storeId}/accounts/${accountId}`),

  getStatementEntries: (storeId, accountId, statementId) =>
    merchant<AccountEntry[]>(
      storeId,
      `/v1/stores/${storeId}/accounts/${accountId}/statements/${statementId}/entries`,
    ),

  createOrder: (order: NewOrder) =>
    merchant<Order>(order.storeId, '/v1/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    }),

  getOrder: (code) => platform<Order | null>(`/v1/orders/${code}`),

  confirmOrderPayment: (code, paymentId) =>
    platform<Order | null>(`/v1/orders/${code}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    }),

  registerAccountPayment: (input) =>
    merchant<MerchantAccount | null>(
      input.storeId,
      `/v1/stores/${input.storeId}/accounts/${input.accountId}/payments`,
      {
        method: 'POST',
        // Importe libre: NexoPOS lo imputa del resumen más viejo al más nuevo (D31).
        body: JSON.stringify({
          amountCents: input.amountCents,
          paymentId: input.paymentId,
        }),
      },
    ),
};
