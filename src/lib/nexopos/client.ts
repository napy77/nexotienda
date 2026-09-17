/**
 * Adapter HTTP contra la API real de NexoPOS.
 *
 * **Tres claves, separadas por capacidad — no por comercio.**
 *
 * La primera versión de esto tenía una clave de plataforma y una por comercio. Estaba
 * mal pensado: NexoTienda es un solo servidor que renderiza la tienda de cualquier
 * comercio, no es cliente de uno. Manejar N claves no tiene forma.
 *
 * | Clave      | Qué abre                                              |
 * |------------|-------------------------------------------------------|
 * | `catalogo` | hosts, stores, pasillos, products, búsqueda del pueblo |
 * | `pedidos`  | crear y leer pedidos, confirmar el cobro              |
 * | `cuentas`  | la cuenta de una persona en un comercio, y su pago    |
 *
 * Y la clave `cuentas` **sola no alcanza**: esos endpoints piden además la sesión que
 * sale del token de un solo uso de ClubPay. La clave dice *qué endpoint*, el token
 * dice *de quién*. Una clave filtrada sin token no puede recorrer las cuentas del
 * pueblo.
 *
 * Las tres viven solo del lado del servidor. Nunca llegan al navegador.
 *
 * ---
 *
 * **Acá vive la traducción, y es a propósito.**
 *
 * La API no habla exactamente la forma de `types.ts`: manda `hours` en vez de
 * `schedule`, un `townSlug` suelto en vez de `regions[]`, y un booleano
 * `acceptsOnlinePayment` en vez de la lista de medios. Eso se resuelve **acá**, que
 * es para lo que existe un adapter — no deformando los tipos del dominio para que
 * calcen con el cable.
 */
import type {
  Campaign,
  CategoryNode,
  Highlights,
  LinkSession,
  MerchantAccount,
  NewOrder,
  NexoPosPort,
  OpeningSlot,
  Order,
  Pasillo,
  PaymentMethod,
  Product,
  ProductPage,
  ProductQuery,
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
  if (!BASE) throw new Error('NEXOPOS_API_URL está vacío pero se eligió el cliente HTTP.');
  if (!KEYS[cap]) {
    throw new Error(
      `Falta la clave de ${cap}: seteá NEXOPOS_KEY_${cap.toUpperCase()} en /opt/nexotienda/.env ` +
        `con el mismo valor que NEXOTIENDA_KEY_${cap.toUpperCase()} en NexoPOS, y volvé a desplegar.`,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
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
  } catch (e) {
    throw new Error(
      `No se pudo llegar a NexoPOS en ${BASE} — ${e instanceof Error ? e.message : e}`,
    );
  }
  if (res.status === 404) return null as T;
  if (!res.ok) {
    // El cuerpo suele decir qué pasó —"Clave inválida para esta parte de la API",
    // "La API de catalogo no está habilitada"— y sin él el 401 y el 503 se ven
    // iguales desde acá. Un error que no dice la causa cuesta una hora de más.
    const detalle = await res.text().catch(() => '');
    throw new Error(
      `NexoPOS respondió ${res.status} en ${path}${detalle ? ` — ${detalle.slice(0, 300)}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

const catalogo = <T>(path: string, init?: RequestInit) => call<T>('catalogo', path, init);
const pedidos = <T>(path: string, init?: RequestInit) => call<T>('pedidos', path, init);
const cuentas = <T>(path: string, init?: RequestInit) => call<T>('cuentas', path, init);

// ---------------------------------------------------------------------------
// Traducción del cable al dominio
// ---------------------------------------------------------------------------

/** Lo que manda NexoPOS, que no es exactamente nuestro `Store`. */
interface StoreWire {
  id: string;
  slug: string | null;
  name: string;
  category: string | null;
  town: string | null;
  townSlug: string | null;
  address: string | null;
  phone?: string;
  whatsapp?: string;
  logoUrl?: string;
  bannerUrl?: string;
  openingHours?: string | null;
  hours?: { dia: number; desde: string; hasta: string }[];
  isOpenNow: boolean | null;
  verified: boolean;
  storefrontPublished: boolean;
  showsOutOfStock?: boolean;
  slots: { id: string; label: string; kind: 'retiro' | 'reparto'; feeCents?: number }[];
  freeDeliveryOverCents?: number;
  acceptsOnlinePayment: boolean;
  allowsCredit: boolean;
}

function mapStore(w: StoreWire): Store {
  const schedule: OpeningSlot[] | undefined = w.hours?.map((h) => ({
    day: h.dia,
    from: h.desde,
    to: h.hasta,
  }));

  /**
   * NexoPOS expone un booleano y no la lista de medios, así que se deriva.
   *
   * Se pierde el detalle de la transferencia, que del lado de ellos existe como
   * campo aparte. Mientras no lo expongan, la tienda no puede mostrar el alias —
   * y ofrecer "transferencia" sin decir a dónde sería peor que no ofrecerla.
   */
  const acceptedPayments: PaymentMethod[] = [
    'efectivo_entrega',
    ...(w.acceptsOnlinePayment ? (['online'] as const) : []),
    ...(w.allowsCredit ? (['cuenta_corriente'] as const) : []),
  ];

  return {
    id: w.id,
    slug: w.slug ?? '',
    name: w.name,
    category: w.category ?? '',
    town: w.town ?? '',
    // Llega solo la región donde el comerciante eligió aparecer: ya viene filtrada
    // por el opt-in, así que si está es porque quiere figurar (D13).
    regions: w.townSlug ? [{ regionSlug: w.townSlug, listedInTownPage: true }] : [],
    address: w.address ?? '',
    phone: w.phone,
    whatsapp: w.whatsapp,
    logoUrl: w.logoUrl,
    bannerUrl: w.bannerUrl,
    openingHours: w.openingHours ?? undefined,
    schedule,
    isOpenNow: w.isOpenNow,
    verified: w.verified,
    storefrontPublished: w.storefrontPublished,
    // Ante la ausencia, mostrar. Es el default de ellos y es el que no esconde
    // mercadería por un campo que no llegó.
    showsOutOfStock: w.showsOutOfStock ?? true,
    slots: w.slots,
    freeDeliveryOverCents: w.freeDeliveryOverCents,
    acceptedPayments,
    allowsCredit: w.allowsCredit,
  };
}

/**
 * Lo que el cable manda de un producto.
 *
 * `images` es opcional **acá y solo acá**. NexoPOS lo agregó y dice que nunca es
 * nulo, y les creemos; pero NexoTienda y NexoPOS se despliegan por separado, y una
 * versión de la API sin el campo no puede tirar abajo el catálogo de todas las
 * tiendas. El dominio recibe la garantía; el adapter se come la duda.
 */
type ProductWire = Omit<Product, 'images'> & { images?: unknown };

/**
 * El árbol viene con ids desde que NexoPOS lo manda, pero un nodo sin id no puede
 * romper la góndola: se cae al nombre, que es lo que se usaba antes de que
 * existieran los ids.
 */
function conIds(nodos: CategoryNode[] | undefined): CategoryNode[] | undefined {
  if (!Array.isArray(nodos)) return undefined;
  return nodos.map((n) => ({ ...n, id: n.id ?? n.name, children: conIds(n.children) }));
}

function mapProduct(w: ProductWire): Product {
  const galeria = Array.isArray(w.images)
    ? w.images.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : [];

  // La portada va primero. Si ya viene en la lista —que es lo que NexoPOS hace— el
  // Set la deja donde está y no la duplica. NexoB2B usa la convención contraria
  // (portada aparte, fuera del arreglo) y este es justo el lugar donde esa
  // diferencia se termina.
  const images = [...new Set(w.imageUrl ? [w.imageUrl, ...galeria] : galeria)];

  // Y al revés: un producto con fotos de catálogo y sin portada propia igual tiene
  // qué mostrar en la tarjeta.
  return { ...w, images, imageUrl: w.imageUrl ?? images[0] };
}

/**
 * La cuenta como la manda NexoPOS.
 *
 * Los nombres no son los del dominio —`paused` contra `creditPaused`,
 * `onlineEnabled` contra `onlineCreditEnabled`— y acá es donde se traducen, que es
 * para lo que existe un adapter. Se aceptan los dos por si queda alguna versión
 * anterior dando vueltas.
 */
interface AccountWire {
  accountId: string;
  storeId: string;
  displayName?: string;
  storeName?: string;
  storeSlug?: string;
  balanceCents?: number;
  limitCents?: number | null;
  availableCents?: number | null;
  paused?: boolean;
  creditPaused?: boolean;
  onlineEnabled?: boolean;
  onlineCreditEnabled?: boolean;
  closingDay?: number;
  dueDay?: number;
  currentPeriod?: { from: string; to: string; dueDate?: string };
  linkedAt?: string;
}

function mapAccount(w: AccountWire): MerchantAccount {
  return {
    accountId: w.accountId,
    storeId: w.storeId,
    displayName: w.displayName,
    storeName: w.storeName ?? '',
    storeSlug: w.storeSlug ?? '',
    // `null` es sin límite, que es el default y el caso más común: así funciona el
    // cuaderno. Mostrar 0 sería exactamente al revés de la verdad, y `?? null`
    // —en vez de `?? 0`— es lo que lo garantiza cuando el campo no viene.
    availableCents: w.availableCents ?? null,
    balanceCents: w.balanceCents,
    closingDay: w.closingDay,
    dueDay: w.dueDay,
    currentPeriod: w.currentPeriod,
    creditPaused: w.creditPaused ?? w.paused ?? false,
    onlineCreditEnabled: w.onlineCreditEnabled ?? w.onlineEnabled ?? false,
    linkedAt: w.linkedAt,
  };
}

// ---------------------------------------------------------------------------

export const client: NexoPosPort = {
  async resolveHost(sub) {
    const r = await catalogo<
      | { kind: 'store'; store: StoreWire }
      | { kind: 'town'; townSlug: string; name: string }
      | { kind: 'moved'; slug: string }
      | null
    >(`/v1/hosts/${encodeURIComponent(sub)}`);
    if (!r) return null;
    if (r.kind === 'store') return { kind: 'store', store: mapStore(r.store) };
    return r;
  },

  async getStore(slug) {
    const w = await catalogo<StoreWire | null>(`/v1/stores/${encodeURIComponent(slug)}`);
    return w ? mapStore(w) : null;
  },

  async listTownStores(townSlug) {
    const ws = await catalogo<StoreWire[]>(`/v1/towns/${townSlug}/stores`);
    return (ws ?? []).map(mapStore);
  },

  searchTown: (townSlug, query) =>
    catalogo<TownSearchResult>(`/v1/towns/${townSlug}/search?q=${encodeURIComponent(query)}`),

  async listPasillos(storeId) {
    const ps = await catalogo<Pasillo[]>(`/v1/stores/${storeId}/pasillos`);
    return (ps ?? []).map((p) => ({ ...p, children: conIds(p.children) }));
  },
  async listProducts(storeId, query = {}) {
    const qs = new URLSearchParams();
    if (query.pasillo) qs.set('pasillo', query.pasillo);
    if (query.sub) qs.set('sub', query.sub);
    if (query.q) qs.set('q', query.q);
    qs.set('limit', String(Math.min(query.limit ?? 60, 200)));
    if (query.offset) qs.set('offset', String(query.offset));

    const r = await catalogo<ProductPage | ProductWire[]>(
      `/v1/stores/${storeId}/products?${qs.toString()}`,
    );
    // La forma vieja —el arreglo pelado— sigue viajando de su lado hasta que
    // confirmemos la migración, y un rollback la devolvería. Se aceptan las dos.
    if (Array.isArray(r)) {
      const items = r.map(mapProduct);
      return { items, total: items.length };
    }
    const items = (r?.items ?? []).map((w) => mapProduct(w as ProductWire));
    return { items, total: typeof r?.total === 'number' ? r.total : items.length };
  },

  async productsByIds(storeId, ids) {
    if (ids.length === 0) return [];
    const r = await catalogo<ProductPage | ProductWire[]>(
      `/v1/stores/${storeId}/products?ids=${ids.map(encodeURIComponent).join(',')}`,
    );
    const items = Array.isArray(r) ? r : (r?.items ?? []);
    const porId = new Map(items.map((w) => [w.id, mapProduct(w as ProductWire)]));
    // En el orden en que se pidieron, que es el que significa algo: la campaña lo
    // eligió, o es lo último que esta persona compró.
    return ids.map((id) => porId.get(id)).filter((p): p is Product => p !== undefined);
  },
  async getProduct(storeId, productId) {
    const w = await catalogo<ProductWire | null>(
      `/v1/stores/${storeId}/products/${productId}`,
    );
    return w ? mapProduct(w) : null;
  },

  async redeemLinkToken(token, storeId) {
    try {
      /*
        El `storeId` va en el **pedido** y no solo en la respuesta.

        El token no dice de qué comercio es —por eso mismo ClubPay puede validarlo
        contra la clave del comercio— así que NexoPOS necesita saber a quién
        preguntarle. Nosotros siempre lo sabemos: el canje ocurre en
        `jure.nexotienda.app` y no hay ambigüedad posible.

        Y ahí se resuelve la verificación cruzada: si el token es de Jure y lo
        canjeamos diciendo "tienda de Delfín", ClubPay lo valida contra la clave de
        Delfín y no coincide.
      */
      const r = await cuentas<LinkSession | null>('/v1/cuentas/canjear', {
        method: 'POST',
        body: JSON.stringify({ token, storeId }),
      });
      if (!r?.accountId || !r.storeId) return null;
      return {
        accountId: r.accountId,
        storeId: r.storeId,
        displayName: r.displayName ?? '',
        linkedAt: r.linkedAt,
      };
    } catch (e) {
      // Un token vencido es un 4xx y es un caso normal —dos minutos pasan rápido—,
      // no una falla que haya que gritar. El que llega con uno viejo ve la pantalla
      // de "volvé a entrar desde ClubPay", no un error del servidor.
      console.error('[nexotienda] canje de token falló', e);
      return null;
    }
  },

  async redeemPairingCode(storeId, code) {
    try {
      const r = await cuentas<{ token?: string } | null>('/v1/cuentas/emparejar/canjear', {
        method: 'POST',
        body: JSON.stringify({ storeId, code: code.trim().toUpperCase() }),
      });
      return r?.token ?? null;
    } catch (e) {
      // Un código mal tipeado es un 4xx y es el caso normal: cinco caracteres se
      // erran. No es una falla que gritar, es "fijate el código".
      console.error('[nexotienda] canje de código falló', e);
      return null;
    }
  },

  async listHighlights(storeId) {
    // Misma tolerancia que las campañas: son estanterías, no la tienda. Y acá hay
    // un motivo de más — una tienda recién abierta no tiene estadística de nada, así
    // que "vacío" es el estado normal del primer mes y no una falla que reportar.
    try {
      const h = await catalogo<Partial<Highlights>>(`/v1/stores/${storeId}/highlights`);
      return {
        bestSellers: Array.isArray(h?.bestSellers) ? h.bestSellers : [],
        mostSearched: Array.isArray(h?.mostSearched) ? h.mostSearched : [],
      };
    } catch (e) {
      console.error('[nexotienda] listHighlights falló', e);
      return { bestSellers: [], mostSearched: [] };
    }
  },

  async listCampaigns(storeId) {
    // Las ofertas son el adorno de la tienda, no la tienda. Si el endpoint todavía
    // no existe —lo estamos pidiendo—, si se cae o si devuelve cualquier cosa, el
    // comercio tiene que seguir vendiendo: se pierde la sección, no el catálogo.
    try {
      const cs = await catalogo<Campaign[]>(`/v1/stores/${storeId}/campaigns`);
      if (!Array.isArray(cs)) return [];
      const ahora = Date.now();
      return cs.filter((c) => {
        if (!c?.id || !c.name || !Array.isArray(c.productIds)) return false;
        // NexoPOS manda solo las vigentes; esto es el cinturón por si una página
        // quedó armada antes de que la campaña se venciera.
        const fin = c.endsAt ? Date.parse(c.endsAt) : NaN;
        return Number.isNaN(fin) || fin >= ahora;
      });
    } catch (e) {
      console.error('[nexotienda] listCampaigns falló', e);
      return [];
    }
  },

  // --- pedidos: escribe, pero no llega a ninguna cuenta ---
  createOrder: (order: NewOrder) =>
    pedidos<Order>('/v1/orders', { method: 'POST', body: JSON.stringify(order) }),
  getOrder: (code) => pedidos<Order | null>(`/v1/orders/${code}`),
  confirmOrderPayment: (code, paymentId) =>
    pedidos<Order | null>(`/v1/orders/${code}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentId }),
    }),

  // --- cuentas: además de la clave, piden la sesión del token de ClubPay ---
  async getAccount(storeId, accountId) {
    const w = await cuentas<AccountWire | null>(
      `/v1/cuentas/${encodeURIComponent(accountId)}?storeId=${encodeURIComponent(storeId)}`,
    );
    return w?.accountId ? mapAccount(w) : null;
  },


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
