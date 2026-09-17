/**
 * Adapter de fixtures: implementa el contrato con los datos del prototipo de diseño.
 *
 * Sirve para que la tienda corra hoy, sin esperar a que NexoPOS exponga su API.
 * Cuando la API exista, `index.ts` elige `client.ts` por env y esto no se toca.
 */
import {
  INITIAL_PRODUCTS,
  PASILLOS,
  STORES_MORRISON,
} from './fixtures.data';
import type {
  Campaign,
  CategoryNode,
  Availability,
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
import { arbolDe, productosDe } from '@/lib/arbol';

const TOWN = { slug: 'morrison', name: 'Morrison' };

/** El slug lo asigna un humano en el admin de Nexo B2B: los nombres se repiten. */
const REGION: Region = {
  slug: 'morrison',
  name: 'Morrison',
  province: 'Córdoba',
  label: 'Morrison, Córdoba',
};

const SLUGS: Record<string, string> = {
  'store-supersol': 'supersol',
  'store-sancayetano': 'sancayetano',
  'store-ferreteria': 'elpuente',
  'store-donarosa': 'donarosa',
};

/** Comercios que además tienen tienda publicada. El resto tiene cartel (D16). */
const PUBLISHED = new Set(['store-supersol', 'store-donarosa']);

/**
 * El que apagó "mostrar lo que no tengo". El caso es el del que importó el catálogo
 * mayorista entero y tiene una fracción en la góndola: la ferretería, no el almacén.
 * NexoPOS filtra del lado de ellos; acá se emula para que el modo fixture no mienta.
 */
const HIDES_OUT_OF_STOCK = new Set(['store-ferreteria']);

const money = (pesos: number) => Math.round(pesos * 100);

function mapAvailability(p: (typeof INITIAL_PRODUCTS)[number]): Availability {
  // Producto propio: disponibilidad declarada, nunca inventario (D3).
  if (p.type === 'propio') {
    if (typeof p.dailyQuota === 'number') {
      const remaining = p.quotaRemaining ?? p.dailyQuota;
      return remaining > 0
        ? { policy: 'declared', state: 'available', quota: { total: p.dailyQuota, remaining } }
        : { policy: 'declared', state: 'out' };
    }
    return { policy: 'declared', state: p.stock > 0 ? 'available' : 'out' };
  }
  // Canónico: el POS sabe cuántos hay porque registra las ventas (D2).
  return { policy: 'stock', onHand: p.stock };
}

function mapProduct(p: (typeof INITIAL_PRODUCTS)[number]): Product {
  return {
    id: p.id,
    storeId: p.storeId,
    name: p.name,
    brand: p.brand,
    description: p.description,
    imageUrl: p.imageUrl,
    images: [p.imageUrl, ...(p.extraImages ?? [])].filter(Boolean),
    priceCents: money(p.price),
    listPriceCents: p.originalPrice ? money(p.originalPrice) : undefined,
    unit: p.unit,
    packTag: p.packTag,
    pasilloId: p.pasilloId,
    subCategory: p.subCategory,
    origin: p.type,
    // El default es publicado: la tienda es un subproducto del stock del POS, no
    // algo que el comerciante tenga que curar producto por producto (D1). Los
    // insumos no llegan hasta acá — NexoPOS ya los filtra.
    publishedInStore: true,
    ean: p.ean,
    availability: mapAvailability(p),
  };
}

/**
 * El árbol de tres niveles que le pedimos a NexoPOS, puesto en una góndola para
 * poder verlo funcionar: Despensa → "Aceites y Aderezos" → de oliva / girasol / maíz.
 *
 * El resto de las góndolas sigue con la lista plana, que es el estado real de hoy.
 * Que convivan no es una concesión: es lo que va a pasar de verdad mientras cada
 * comercio ordene su catálogo.
 */
const ARBOLES: Record<string, CategoryNode[]> = {
  despensa: [
    {
      id: 'r:Aceites y Aderezos',
      name: 'Aceites y Aderezos',
      children: [
        { id: 's:Aceites de oliva', name: 'Aceites de oliva' },
        { id: 's:Aceites de girasol', name: 'Aceites de girasol' },
        { id: 's:Aceites de maíz', name: 'Aceites de maíz' },
        { id: 's:Vinagres', name: 'Vinagres' },
        { id: 's:Mayonesa', name: 'Mayonesa, Ketchup y Mostaza' },
      ],
    },
    { id: 'r:Arroz y Legumbres', name: 'Arroz y Legumbres' },
    { id: 'r:Fideos y Pastas', name: 'Fideos y Pastas' },
    { id: 'r:Galletitas y Snacks', name: 'Galletitas y Snacks' },
    { id: 'r:Café, Té y Yerba', name: 'Café, Té y Yerba' },
  ],
};

/**
 * Se poda contra los productos del comercio, igual que hace NexoPOS: un nodo sin
 * nada no llega. Acá se emula para que el modo fixture no muestre una góndola que
 * contra la API real no existiría.
 */
function podar(nodos: CategoryNode[], conProductos: Set<string>): CategoryNode[] {
  return nodos
    .map((n) => ({ ...n, children: podar(n.children ?? [], conProductos) }))
    .filter((n) => conProductos.has(n.name) || (n.children?.length ?? 0) > 0)
    .map((n) => (n.children?.length ? n : { id: n.id, name: n.name }));
}

function conArbol(p: Pasillo, delComercio: Product[]): Pasillo {
  const conProductos = new Set(
    delComercio
      .filter((x) => x.pasilloId === p.id)
      .map((x) => x.subCategory)
      .filter((x): x is string => Boolean(x)),
  );
  const crudo = ARBOLES[p.id];
  if (!crudo) return p;
  return { ...p, children: podar(crudo, conProductos) };
}

/**
 * Dos campañas, para poder ver la home con más de una sección. Los precios de estos
 * productos ya vienen con el descuento puesto —`originalPrice` es el viejo—, que es
 * exactamente lo que le pedimos a NexoPOS: la campaña dice quiénes entran, el precio
 * lo aplica el POS.
 */
const CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-imperdibles',
    storeId: 'store-supersol',
    name: 'Ofertas imperdibles',
    discountPercent: 35,
    productIds: ['prod-stella-x24', 'prod-nescafe-gold', 'prod-skip-3l', 'prod-stella-x6', 'prod-integra-barras', 'prod-leche-laserenisima'],
  },
  {
    id: 'camp-despensa',
    storeId: 'store-supersol',
    name: 'Semana de despensa',
    discountPercent: 20,
    productIds: ['prod-yerba-playadito', 'prod-nescafe-gold', 'prod-campari'],
  },
];

/**
 * Lo que la tienda muestra. Con el tilde apagado, lo agotado no viaja —igual que
 * hace NexoPOS antes de responder—. `unknown` nunca se esconde: no saber no es no
 * tener, y esconder por las dudas le tapa la venta a un comercio que lo tiene (P5).
 */
function visibles(storeId: string): Product[] {
  const delComercio = products.filter((p) => p.storeId === storeId && p.publishedInStore);
  if (!HIDES_OUT_OF_STOCK.has(storeId)) return delComercio;

  return delComercio.filter((p) => {
    const a = p.availability;
    if (a.policy === 'stock') return a.onHand > 0;
    // El cupo agotado también se esconde: "quedan 0 de hoy" es no tener.
    if (a.policy === 'declared') return a.state === 'available' && (!a.quota || a.quota.remaining > 0);
    return true;
  });
}

function mapStore(s: (typeof STORES_MORRISON)[number]): Store {
  const published = PUBLISHED.has(s.id);
  const isRotiseria = s.id === 'store-donarosa';
  return {
    id: s.id,
    slug: SLUGS[s.id] ?? s.id,
    name: s.name,
    category: s.category,
    town: TOWN.name,
    regions: [{ regionSlug: TOWN.slug, listedInTownPage: true }],
    address: s.address,
    phone: s.phone,
    whatsapp: s.phone,
    logoUrl: s.logoUrl,
    bannerUrl: isRotiseria
      ? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80'
      : 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80',
    openingHours: s.openingHours,
    // Lo que decide es esto; el texto de arriba es para leer.
    schedule: isRotiseria
      ? [
          ...[2, 3, 4, 5, 6, 0].flatMap((d) => [
            { day: d, from: '11:30', to: '14:00' },
            { day: d, from: '20:00', to: '23:30' },
          ]),
        ]
      : [
          ...[1, 2, 3, 4, 5, 6].flatMap((d) => [
            { day: d, from: '08:30', to: '13:00' },
            { day: d, from: '17:00', to: '21:30' },
          ]),
          { day: 0, from: '09:00', to: '13:00' },
        ],
    isOpenNow: true,
    verified: s.verified,
    storefrontPublished: published,
    showsOutOfStock: !HIDES_OUT_OF_STOCK.has(s.id),
    // Retiro siempre; el reparto va por franjas, que es lo que lo hace rentable (D20, D21).
    slots: [
      { id: 'retiro', label: 'Retirar en el local', kind: 'retiro' },
      ...(s.hasDelivery
        ? isRotiseria
          ? [{ id: 'reparto-noche', label: 'Reparto 20:00 a 23:30', kind: 'reparto' as const, feeCents: money(900) }]
          : [
              { id: 'reparto-mediodia', label: 'Reparto 12:30 a 14:00', kind: 'reparto' as const, feeCents: money(1200) },
              { id: 'reparto-tarde', label: 'Reparto 18:00 a 20:30', kind: 'reparto' as const, feeCents: money(1200) },
            ]
        : []),
    ],
    freeDeliveryOverCents: s.hasDelivery ? money(35000) : undefined,
    // El comerciante las elige en el POS; no se puede publicar sin al menos una.
    // La libreta solo aparece si este comercio la da (Doña Rosa no fía).
    acceptedPayments: [
      'efectivo_entrega',
      'online',
      'transferencia',
      ...(s.allowsCredit ? (['cuenta_corriente'] as const) : []),
    ],
    transferAlias: `${SLUGS[s.id] ?? s.id}.morrison.mp`,
    transferHolder: s.name,
    allowsCredit: s.allowsCredit,
  };
}

/** Jure Hnos. tiene cuenta corriente pero todavía no publicó tienda: cartel, no tienda (D16). */
const jureHnos: Store = {
  id: 'store-jurehnos',
  slug: 'jure',
  name: 'Jure Hnos.',
  category: 'Corralón y Materiales',
  town: TOWN.name,
  regions: [{ regionSlug: TOWN.slug, listedInTownPage: true }],
  address: 'Ruta 9 km 483, Morrison',
  phone: '03537 46-2900',
  whatsapp: '03537 46-2900',
  openingHours: 'Lun a Vie 07:30 a 12:00 y 14:00 a 18:00 | Sáb 08:00 a 12:00',
  // Sin horario estructurado a propósito: así se ve el caso "no sabemos", que es
  // el que va a tener cualquier comercio que todavía no lo cargó.
  isOpenNow: null,
  verified: true,
  storefrontPublished: false,
  showsOutOfStock: true,
  slots: [{ id: 'retiro', label: 'Retirar en el local', kind: 'retiro' }],
  // Sin Mercado Pago: la libreta sigue funcionando, solo se cae el pago online.
  acceptedPayments: ['efectivo_entrega', 'cuenta_corriente'],
  allowsCredit: true,
};

const stores = [...STORES_MORRISON.map(mapStore), jureHnos];
const products = INITIAL_PRODUCTS.map(mapProduct);

/**
 * Cuentas corrientes de la persona de prueba: UNA POR COMERCIO.
 *
 * Cada comercio es el acreedor de la suya, con su propia fecha de cierre y su propio
 * disponible. No hay ningún objeto que sume las dos (P1, D27, D28, D33).
 */
/** El código que la app mostraría. Solo fixtures: en producción lo emite ClubPay. */
const CODIGO_DE_PRUEBA = 'VRCCX';

const accounts: MerchantAccount[] = [
  {
    // Id de la RELACIÓN, no de la persona. En Jure Hnos. es otro distinto, y no hay
    // forma de saber desde acá que son el mismo ser humano — eso solo lo sabe ClubPay.
    accountId: 'acc_sol_4b91',
    storeId: 'store-supersol',
    displayName: 'Germán Yovan',
    linkedAt: '2026-09-17T10:00:00.000Z',
    storeName: 'Súper SOL',
    storeSlug: 'supersol',
    availableCents: money(18500),
    balanceCents: money(27519.20),
    closingDay: 10,
    dueDay: 20,
    currentPeriod: { from: '2026-09-11', to: '2026-10-10', dueDate: '2026-10-20' },
    creditPaused: false,
    onlineCreditEnabled: true,
  },
  {
    accountId: 'acc_jure_7d20',
    storeId: 'store-jurehnos',
    storeName: 'Jure Hnos.',
    storeSlug: 'jure',
    // Sin límite: es el default y el caso más común. No es cero, es al revés.
    availableCents: null,
    closingDay: 5,
    creditPaused: false,
    // Arranca apagado: toma la libreta solo en el mostrador (D34).
    onlineCreditEnabled: false,
  },
];

/** Los movimientos viven aparte: NexoPOS no los anida en el listado de resúmenes. */


const orders = new Map<string, Order>();
let seq = 1;

/** Un pedido cancelado con nota, para poder ver esa pantalla sin esperar a que pase. */
orders.set('ORD-DEMO-CANCEL', {
  code: 'ORD-DEMO-CANCEL',
  storeId: 'store-supersol',
  storeName: 'Súper SOL',
  storeSlug: 'supersol',
  storePhone: '03537 46-2180',
  contact: { name: 'Marta', phone: '3537461122' },
  lines: [
    { productId: 'prod-prepizzas-sol', name: 'Prepizzas Caseras de Ananá (x2)', unit: 'Pack 2 unidades', quantity: 2, unitPriceCents: money(4200) },
  ],
  subtotalCents: money(8400),
  feeCents: 0,
  totalCents: money(8400),
  slotId: 'retiro',
  slotLabel: 'Retirar en el local',
  slotKind: 'retiro',
  paymentMethod: 'efectivo_entrega',
  paymentStatus: 'no_aplica',
  status: 'cancelado',
  cancelledBy: 'comercio',
  cancelReason: 'No me quedan de ananá, tengo de muzzarella y napolitana. Pasá igual y te las hago.',
  cancelledAt: '2026-09-10T19:40:00Z',
  createdAt: '2026-09-10T19:20:00Z',
});

export const fixtures: NexoPosPort = {
  async resolveHost(sub) {
    if (sub === TOWN.slug) return { kind: 'town', townSlug: TOWN.slug, name: TOWN.name };
    const store = stores.find((s) => s.slug === sub);
    return store ? { kind: 'store', store } : null;
  },

  async getStore(slug) {
    return stores.find((s) => s.slug === slug) ?? null;
  },

  async listPasillos(storeId) {
    const delComercio = visibles(storeId);
    const ids = new Set(delComercio.map((p) => p.pasilloId));
    return (PASILLOS as Pasillo[])
      .filter((p) => ids.has(p.id))
      .map((p) => ({
        ...conArbol(p, delComercio),
        // Contado, no declarado: es lo que hace NexoPOS y es lo que la tienda usa
        // para decir cuántos productos tiene. Un número inventado ahí sería (P6).
        productCount: delComercio.filter((x) => x.pasilloId === p.id).length,
      }));
  },

  async listProducts(storeId, query = {}) {
    let items = visibles(storeId);

    if (query.pasillo) {
      items = items.filter((p) => p.pasilloId === query.pasillo);
      if (query.sub) {
        const pasillo = (PASILLOS as Pasillo[]).find((p) => p.id === query.pasillo);
        items = productosDe(items, arbolDe(conArbol(pasillo!, visibles(storeId))), query.sub);
      }
    }

    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand ?? '').toLowerCase().includes(q) ||
          (p.subCategory ?? '').toLowerCase().includes(q),
      );
    }

    const offset = query.offset ?? 0;
    return { items: items.slice(offset, offset + Math.min(query.limit ?? 60, 200)), total: items.length };
  },

  async productsByIds(storeId, ids) {
    const porId = new Map(visibles(storeId).map((p) => [p.id, p]));
    return ids.map((id) => porId.get(id)).filter((p): p is Product => p !== undefined);
  },

  async listCampaigns(storeId) {
    return CAMPAIGNS.filter((c) => c.storeId === storeId);
  },

  async redeemPairingCode(storeId, code) {
    // En fixtures no hay app que genere códigos, así que hay uno fijo y visible.
    // En producción lo emite ClubPay y no existe nada de esto.
    if (code.trim().toUpperCase() !== CODIGO_DE_PRUEBA) return null;
    return accounts.find((a) => a.storeId === storeId)?.accountId ?? null;
  },

  async redeemLinkToken(token, storeId) {
    // En fixtures el "token" es el propio accountId, para poder probar el circuito
    // completo sin ClubPay. En producción nada de esto existe.
    const cuenta = accounts.find((a) => a.accountId === token);
    // Igual que NexoPOS: si el token no es de la tienda que lo canjea, no se canjea.
    if (!cuenta || cuenta.storeId !== storeId) return null;
    return {
      accountId: cuenta.accountId,
      storeId: cuenta.storeId,
      displayName: cuenta.displayName ?? 'Germán Yovan',
      linkedAt: cuenta.linkedAt,
    };
  },

  async listHighlights(storeId) {
    // Súper SOL simula tener estadística; el resto no, que es el caso de toda
    // tienda nueva y el que hay que poder ver sin romper nada.
    if (storeId !== 'store-supersol') return { bestSellers: [], mostSearched: [] };
    return {
      bestSellers: ['prod-coca-cola-225', 'prod-aceite-natura', 'prod-fernet-branca', 'prod-pan-criollo'],
      mostSearched: ['prod-yerba-playadito', 'prod-leche-laserenisima', 'prod-shampoo-dove'],
    };
  },

  async getProduct(storeId, productId) {
    const found = products.find((p) => p.storeId === storeId && p.id === productId);
    return found?.publishedInStore ? found : null;
  },

  async listRegions() {
    return [REGION];
  },

  async getRegion(slug) {
    return slug === REGION.slug ? REGION : null;
  },

  async listTownStores(townSlug) {
    // Solo los que el comerciante habilitó a figurar (D13): pertenecer a la región
    // y querer aparecer en su página son decisiones distintas, de gente distinta.
    return stores.filter((s) =>
      s.regions.some((r) => r.regionSlug === townSlug && r.listedInTownPage),
    );
  },

  async searchTown(townSlug, query) {
    const q = query.trim().toLowerCase();
    const hits =
      townSlug === TOWN.slug && q
        ? products
            .filter(
              (p) =>
                p.publishedInStore &&
                (p.name.toLowerCase().includes(q) ||
                (p.brand ?? '').toLowerCase().includes(q) ||
                  (p.subCategory ?? '').toLowerCase().includes(q)),
            )
            .map((p) => {
              const s = stores.find((st) => st.id === p.storeId)!;
              return {
                product: p,
                store: {
                  id: s.id,
                  slug: s.slug,
                  name: s.name,
                  isOpenNow: s.isOpenNow,
                  storefrontPublished: s.storefrontPublished,
                },
              };
            })
        : [];
    // `exhaustive: false` siempre. No podemos afirmar que nadie lo tiene (P5).
    return { query, hits, exhaustive: false } as TownSearchResult;
  },

  async getAccount(storeId, accountId) {
    return accounts.find((a) => a.storeId === storeId && a.accountId === accountId) ?? null;
  },


  async createOrder(input: NewOrder) {
    const store = stores.find((s) => s.id === input.storeId);
    if (!store) throw new Error('Comercio inexistente');
    const slot = store.slots.find((s) => s.id === input.slotId);
    if (!slot) throw new Error('Franja inexistente');

    const lines = input.lines.map((l) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p) throw new Error(`Producto inexistente: ${l.productId}`);
      return {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        quantity: l.quantity,
        unitPriceCents: p.priceCents,
      };
    });

    const subtotalCents = lines.reduce((a, l) => a + l.unitPriceCents * l.quantity, 0);
    const free = store.freeDeliveryOverCents !== undefined && subtotalCents >= store.freeDeliveryOverCents;
    const feeCents = slot.kind === 'reparto' && !free ? (slot.feeCents ?? 0) : 0;

    const totalCents = subtotalCents + feeCents;
    // Igual que NexoPOS: el total que vale es el de acá, pero si no coincide con el
    // que el comprador tenía en pantalla, se avisa en vez de corregir en silencio.
    const priceChanged =
      input.expectedTotalCents !== undefined && input.expectedTotalCents !== totalCents;

    const code = `ORD-${String(seq++).padStart(4, '0')}`;
    const order: Order = {
      code,
      storeId: store.id,
      storeName: store.name,
      storeSlug: store.slug,
      storePhone: store.phone,
      lines,
      subtotalCents,
      feeCents,
      totalCents,
      priceChanged: priceChanged || undefined,
      expectedTotalCents: priceChanged ? input.expectedTotalCents : undefined,
      slotId: slot.id,
      slotLabel: slot.label,
      slotKind: slot.kind,
      address: input.address,
      accountId: input.accountId,
      contact: input.contact,
      paymentMethod: input.paymentMethod,
      // El fiado no es un pago: es una anotación que se cobra en el cierre (D27).
      // El efectivo tampoco pasa por acá. Solo el rail online queda pendiente.
      paymentStatus: input.paymentMethod === 'online' ? 'pendiente' : 'no_aplica',
      // Nace en 'recibido'. Que el comercio se entere no es que haya aceptado (D18).
      status: 'recibido',
      createdAt: new Date().toISOString(),
    };
    orders.set(code, order);
    return order;
  },

  async getOrder(code) {
    return orders.get(code) ?? null;
  },

  async confirmOrderPayment(code, paymentId) {
    const order = orders.get(code);
    if (!order) return null;
    const next = { ...order, paymentStatus: 'pagado' as const, paymentId };
    orders.set(code, next);
    return next;
  },

  async registerAccountPayment({ storeId, accountId, amountCents }) {
    const account = accounts.find((a) => a.storeId === storeId && a.accountId === accountId);
    if (!account) return null;

    // Importe libre contra la cuenta (D31). **La imputación no se emula acá**: cuál
    // resumen se cancela primero lo decide NexoPOS, que es el libro. La imputación es
    // del libro, no de la vidriera — y la vidriera ya no muestra resúmenes.
    account.balanceCents = Math.max(0, (account.balanceCents ?? 0) - amountCents);

    // Pagar libera disponible en ESE comercio, que es el único acreedor (P1).
    // Si no tiene límite, no hay disponible que mover.
    if (account.availableCents !== null) {
      account.availableCents += amountCents;
    }
    return account;
  },
};
