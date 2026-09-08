/**
 * Adapter HTTP contra la API real de NexoPOS.
 *
 * La forma de las rutas está en `docs/nexopos.md`. Mientras el equipo de
 * NexoPOS la construye, `index.ts` sigue eligiendo los fixtures.
 *
 * La API key vive solo acá, del lado del servidor. Nunca viaja al navegador.
 */
import type {
  MerchantAccount,
  NewOrder,
  NexoPosPort,
  Order,
  Pasillo,
  Person,
  Product,
  Store,
  TownSearchResult,
} from './types';

const BASE = process.env.NEXOPOS_API_URL ?? '';
const KEY = process.env.NEXOPOS_API_KEY ?? '';

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      ...init?.headers,
    },
    // El stock cambia con cada venta del mostrador: no lo cacheamos.
    cache: 'no-store',
  });
  if (res.status === 404) return null as T;
  if (!res.ok) {
    throw new Error(`NexoPOS ${res.status} en ${path}`);
  }
  return (await res.json()) as T;
}

export const client: NexoPosPort = {
  resolveHost: (sub) => get(`/v1/hosts/${encodeURIComponent(sub)}`),
  getStore: (slug) => get<Store | null>(`/v1/stores/${encodeURIComponent(slug)}`),
  listPasillos: (storeId) => get<Pasillo[]>(`/v1/stores/${storeId}/pasillos`),
  listProducts: (storeId) => get<Product[]>(`/v1/stores/${storeId}/products`),
  getProduct: (storeId, productId) =>
    get<Product | null>(`/v1/stores/${storeId}/products/${productId}`),

  listTownStores: (townSlug) => get<Store[]>(`/v1/towns/${townSlug}/stores`),
  searchTown: (townSlug, query) =>
    get<TownSearchResult>(`/v1/towns/${townSlug}/search?q=${encodeURIComponent(query)}`),

  getPerson: (personId) => get<Person | null>(`/v1/people/${personId}`),
  getAccount: (personId, storeId) =>
    get<MerchantAccount | null>(`/v1/people/${personId}/accounts/${storeId}`),

  createOrder: (order: NewOrder) =>
    get<Order>('/v1/orders', { method: 'POST', body: JSON.stringify(order) }),
  getOrder: (code) => get<Order | null>(`/v1/orders/${code}`),
  confirmOrderPayment: (code, paymentId) =>
    get<Order | null>(`/v1/orders/${code}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    }),

  registerAccountPayment: (input) =>
    get<MerchantAccount | null>(
      `/v1/people/${input.personId}/accounts/${input.storeId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify({
          periodId: input.periodId,
          amountCents: input.amountCents,
          paymentId: input.paymentId,
        }),
      },
    ),
};
