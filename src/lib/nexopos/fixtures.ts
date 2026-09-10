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
  AccountEntry,
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
    openingHours: s.openingHours,
    isOpenNow: true,
    verified: s.verified,
    storefrontPublished: published,
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
  isOpenNow: true,
  verified: true,
  storefrontPublished: false,
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
const accounts: MerchantAccount[] = [
  {
    // Id de la RELACIÓN, no de la persona. En Jure Hnos. es otro distinto, y no hay
    // forma de saber desde acá que son el mismo ser humano — eso solo lo sabe ClubPay.
    accountId: 'acc_sol_4b91',
    storeId: 'store-supersol',
    storeName: 'Súper SOL',
    storeSlug: 'supersol',
    availableCents: money(18500),
    closingDay: 10,
    creditPaused: false,
    onlineCreditEnabled: true,
    statements: [
      {
        statementId: 'st_sol_2608',
        // Cierra el 10, así que el período NO es un mes. El label lo calcula NexoPOS
        // y se muestra tal cual: llamarlo "agosto" sería mentir sobre qué abarca.
        label: '11/07 al 10/08',
        status: 'cerrado',
        closedAt: '2026-08-10',
        dueDate: '2026-08-20',
        totalCents: money(33100),
        paidCents: 0,
      },
      {
        statementId: 'st_sol_2609',
        label: '11/08 al 10/09',
        status: 'abierto',
        totalCents: money(14200),
        paidCents: 0,
      },
    ],
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
    statements: [
      {
        statementId: 'st_jure_2609',
        label: '06/08 al 05/09',
        status: 'abierto',
        totalCents: money(9200),
        paidCents: 0,
      },
    ],
  },
];

/** Los movimientos viven aparte: NexoPOS no los anida en el listado de resúmenes. */
const entriesByStatement: Record<string, AccountEntry[]> = {
  st_sol_2608: [
    { id: 'e1', date: '2026-08-02', description: 'Compra en el mostrador', amountCents: money(18400), receipt: '#1042', origin: 'mostrador' },
    { id: 'e2', date: '2026-08-09', description: 'Compra en el mostrador', amountCents: money(14700), receipt: '#1105', origin: 'mostrador' },
  ],
  st_sol_2609: [
    { id: 'e3', date: '2026-09-02', description: 'Carnicería y lácteos', amountCents: money(8400), receipt: '#1289', origin: 'mostrador' },
    { id: 'e4', date: '2026-09-05', description: 'Despensa', amountCents: money(5800), receipt: '#1340', origin: 'tienda' },
  ],
  st_jure_2609: [
    { id: 'e5', date: '2026-09-04', description: 'Corralón — bolsas de cemento', amountCents: money(9200), receipt: '#0412', origin: 'mostrador' },
  ],
};

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
    const ids = new Set(products.filter((p) => p.storeId === storeId).map((p) => p.pasilloId));
    return (PASILLOS as Pasillo[]).filter((p) => ids.has(p.id));
  },

  async listProducts(storeId) {
    return products.filter((p) => p.storeId === storeId && p.publishedInStore);
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

  async getStatementEntries(storeId, accountId, statementId) {
    const account = accounts.find((a) => a.storeId === storeId && a.accountId === accountId);
    if (!account?.statements.some((st) => st.statementId === statementId)) return [];
    return entriesByStatement[statementId] ?? [];
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
      totalCents: subtotalCents + feeCents,
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

    // Importe libre. Se imputa del resumen cerrado más viejo al más nuevo, y lo que
    // sobra queda a cuenta del período abierto: la plata no queda colgada (D31).
    let left = amountCents;
    for (const st of account.statements) {
      if (left <= 0) break;
      if (st.status === 'abierto' || st.status === 'pagado') continue;
      const owed = st.totalCents - st.paidCents;
      const applied = Math.min(owed, left);
      st.paidCents += applied;
      st.status = st.paidCents >= st.totalCents ? 'pagado' : 'pagado_parcial';
      left -= applied;
    }
    if (left > 0) {
      const open = account.statements.find((st) => st.status === 'abierto');
      if (open) open.paidCents += left;
    }

    // Pagar libera disponible en ESE comercio, que es el único acreedor (P1).
    // Si no tiene límite, no hay disponible que mover.
    if (account.availableCents !== null) {
      account.availableCents += amountCents;
    }
    return account;
  },
};
