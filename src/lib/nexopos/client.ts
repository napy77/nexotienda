/**
 * Adapter HTTP contra la API real de NexoPOS.
 *
 * **Tres claves, separadas por capacidad — no por comercio.**
 *
 * La primera versión de esto tenía una clave de plataforma y una por comercio. Estaba
 * mal pensado: NexoTienda es un solo servidor que renderiza la tienda de cualquier
 * comercio, no es cliente de uno. Manejar N claves no tiene forma.
 *
 * Lo que separa bien no es *de qué comercio* sino *qué puede hacer*:
 *
 * | Clave      | Qué abre                                              |
 * |------------|-------------------------------------------------------|
 * | `catalogo` | hosts, stores, pasillos, products, regiones, búsqueda |
 * | `pedidos`  | crear y leer pedidos, confirmar el cobro              |
 * | `cuentas`  | la cuenta de una persona en un comercio, y su pago    |
 *
 * Y la clave `cuentas` **sola no alcanza**: esos endpoints piden además la sesión que
 * sale del token de un solo uso de ClubPay. La clave dice *qué endpoint*, el token
 * dice *de quién*. Una clave filtrada sin token no puede recorrer las cuentas del
 * pueblo.
 *
 * Las tres viven solo del lado del servidor. Nunca llegan al navegador.
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

const KEYS = {
  catalogo: process.env.NEXOPOS_KEY_CATALOGO ?? '',
  pedidos: process.env.NEXOPOS_KEY_PEDIDOS ?? '',
  cuentas: process.env.NEXOPOS_KEY_CUENTAS ?? '',
} as const;

type Capacidad = keyof typeof KEYS;

async function call<T>(cap: Capacidad, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEYS[cap]}`,
      ...init?.headers,
    },
    // El stock cambia con cada venta del mostrador: no lo cacheamos.
    cache: 'no-store',
  });
  if (res.status === 404) return null as T;
  if (!res.ok) throw new Error(`NexoPOS ${res.status} en ${path}`);
  return (await res.json()) as T;
}

const catalogo = <T>(path: string, init?: RequestInit) => call<T>('catalogo', path, init);
const pedidos = <T>(path: string, init?: RequestInit) => call<T>('pedidos', path, init);
const cuentas = <T>(path: string, init?: RequestInit) => call<T>('cuentas', path, init);

export const client: NexoPosPort = {
  // --- catálogo: lo que la tienda le muestra a cualquiera que entre ---
  resolveHost: (sub) => catalogo(`/v1/hosts/${encodeURIComponent(sub)}`),
  listRegions: () => catalogo<Region[]>('/v1/regions'),
  getRegion: (slug) => catalogo<Region | null>(`/v1/regions/${slug}`),
  listTownStores: (townSlug) => catalogo<Store[]>(`/v1/regions/${townSlug}/stores`),
  searchTown: (townSlug, query) =>
    catalogo<TownSearchResult>(`/v1/regions/${townSlug}/search?q=${encodeURIComponent(query)}`),
  getStore: (slug) => catalogo<Store | null>(`/v1/stores/${encodeURIComponent(slug)}`),
  listPasillos: (storeId) => catalogo<Pasillo[]>(`/v1/stores/${storeId}/pasillos`),
  listProducts: (storeId) => catalogo<Product[]>(`/v1/stores/${storeId}/products`),
  getProduct: (storeId, productId) =>
    catalogo<Product | null>(`/v1/stores/${storeId}/products/${productId}`),

  // --- pedidos: escribe, pero no llega a ninguna cuenta ---
  createOrder: (order: NewOrder) =>
    pedidos<Order>('/v1/orders', { method: 'POST', body: JSON.stringify(order) }),
  getOrder: (code) => pedidos<Order | null>(`/v1/orders/${code}`),
  confirmOrderPayment: (code, paymentId) =>
    pedidos<Order | null>(`/v1/orders/${code}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    }),

  // --- cuentas: la sensible. Además de la clave, estos endpoints piden la sesión
  // que sale del token de ClubPay: la clave dice qué endpoint, el token de quién.
  getAccount: (storeId, accountId) =>
    cuentas<MerchantAccount | null>(`/v1/stores/${storeId}/accounts/${accountId}`),

  getStatementEntries: (storeId, accountId, statementId) =>
    cuentas<AccountEntry[]>(
      `/v1/stores/${storeId}/accounts/${accountId}/statements/${statementId}/entries`,
    ),

  registerAccountPayment: (input) =>
    cuentas<MerchantAccount | null>(
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
