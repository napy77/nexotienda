/**
 * El contrato con NexoPOS.
 *
 * Estos tipos son la frontera: NexoTienda no sabe nada de cómo NexoPOS guarda las
 * cosas, solo de esta forma. Cambiar algo acá es cambiar el contrato, y hay que
 * avisarle al equipo de NexoPOS y a ClubPay, que consume los mismos datos de cuenta.
 */

// ---------------------------------------------------------------------------
// Disponibilidad — D1, D2, D3, D4
// ---------------------------------------------------------------------------

/**
 * Un producto se controla por stock o por disponibilidad declarada, nunca por los
 * dos. No son dos tipos de producto: es una política sobre el mismo objeto (D1).
 * El default lo da el origen (canónico → stock, propio → declarada) y el comercio
 * lo puede dar vuelta (D2).
 */
export type Availability =
  /** Lo que se compra hecho. El POS sabe cuántos hay porque registra las ventas. */
  | { policy: 'stock'; onHand: number }
  /**
   * Lo que se hace: la pizza, el pan, la copia de llave. No tiene inventario, tiene
   * una declaración del comercio (D3). Nunca descuenta insumos.
   */
  | {
      policy: 'declared';
      state: 'available' | 'out';
      /** Cupo del día, si el comercio lo declaró. Se repone solo (D4). */
      quota?: { total: number; remaining: number };
    }
  /**
   * El POS no reportó disponibilidad para este producto. No es cero, es que no
   * sabemos — y por P5/P6 hay que decirlo, no inventar un número.
   */
  | { policy: 'unknown' };

export type ProductOrigin = 'canonico' | 'propio';

export interface Product {
  id: string;
  storeId: string;
  name: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  /** Precio en centavos, para no arrastrar floats por todo el sistema. */
  priceCents: number;
  listPriceCents?: number;
  unit: string;
  packTag?: string;
  pasilloId: string;
  subCategory?: string;
  /** Canónico hereda el dato de Nexo B2B; propio lo escribió el comercio (D1). */
  origin: ProductOrigin;
  ean?: string;
  availability: Availability;
}

export interface Pasillo {
  id: string;
  name: string;
  iconName?: string;
  imageUrl?: string;
  subCategories: string[];
  productCount: number;
}

// ---------------------------------------------------------------------------
// Comercio
// ---------------------------------------------------------------------------

/** Franja de reparto o de retiro. El default del almacén es programado (D20). */
export interface FulfillmentSlot {
  id: string;
  label: string;
  kind: 'retiro' | 'reparto';
  /** Costo del envío en centavos. Cero o ausente para retiro. */
  feeCents?: number;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  category: string;
  town: string;
  townSlug: string;
  address: string;
  /** Habilita el botón de contacto: la válvula de escape del modelo. */
  phone?: string;
  whatsapp?: string;
  logoUrl?: string;
  openingHours?: string;
  isOpenNow: boolean;
  /**
   * Un comercio que todavía no publicó tienda tiene cartel, no tienda (D16), y se
   * muestra como no verificado hasta que lo reclame (P5).
   */
  verified: boolean;
  storefrontPublished: boolean;
  /** Retiro en local siempre; reparto propio solo si lo habilitó (D21, D22). */
  slots: FulfillmentSlot[];
  /** Mínimo para envío gratis, si el comercio lo configuró. */
  freeDeliveryOverCents?: number;
  /** Si no tiene Mercado Pago, la cuenta corriente igual funciona; solo se cae el pago online. */
  acceptsOnlinePayment: boolean;
  allowsCredit: boolean;
}

// ---------------------------------------------------------------------------
// Cuenta corriente — una POR COMERCIO
// ---------------------------------------------------------------------------

/**
 * Un resumen es un período congelado (D27): un documento estable, pagable y
 * disputable. El período abierto es otra cosa y nunca se mezcla con estos (D28).
 */
export interface AccountPeriod {
  id: string;
  label: string;
  status: 'abierto' | 'cerrado' | 'pagado_parcial' | 'pagado';
  closedAt?: string;
  totalCents: number;
  paidCents: number;
  entries: AccountEntry[];
}

export interface AccountEntry {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  receipt?: string;
  origin: 'mostrador' | 'tienda';
  /** La app deja constancia de una compra desconocida; no arbitra. Eso lo hablan ellos. */
  disputed?: boolean;
}

/**
 * La cuenta corriente de una persona CON UN COMERCIO.
 *
 * No existe una cuenta "del pueblo". Cada comercio es el acreedor de su propia
 * cuenta, con su fecha de cierre, su límite y su política (P1). Sumar las deudas de
 * dos comercios en un solo pagable nos convertiría en el acreedor, y además habría
 * que repartir un pago entre dos Mercado Pago distintos, que es justo lo que P1
 * prohíbe.
 *
 * El total del pueblo existe, pero es una VISTA de solo lectura para el deudor
 * (P3) — ver `townDebtSummary`. Nunca es un objeto que se pueda pagar.
 */
export interface MerchantAccount {
  storeId: string;
  storeName: string;
  storeSlug: string;
  /** Saldo disponible. Se muestra como "Disponible", nunca como "tu límite" (D32). */
  availableCents: number;
  /** Día del mes en que cierra este comercio. Configurable por comercio (D27). */
  closingDay: number;
  /** El comercio pausó el fiado. No bloquea la venta, solo el fiado (D35). */
  creditPaused: boolean;
  /** Solo si el comercio habilitó compras a cuenta desde la tienda online (D34). */
  onlineCreditEnabled: boolean;
  /** La pila. Del más viejo al más nuevo (D28, D30). */
  periods: AccountPeriod[];
}

/** La vista agregada. Es del deudor y solo de él (P3). Nunca pagable. */
export interface TownDebtSummary {
  totalOwedCents: number;
  merchantCount: number;
}

export interface Person {
  /** Identificador opaco de Nexo. El DNI nunca es la clave del sistema (D25). */
  personId: string;
  firstName: string;
  town?: string;
  accounts: MerchantAccount[];
}

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cuenta_corriente' | 'online' | 'efectivo_entrega';

/**
 * Estado del cobro, que es otra cosa que el estado del pedido.
 *
 * `no_aplica` es el caso del efectivo y del fiado: no hay nada que cobrar online.
 * El fiado no es un pago — es una anotación que se cobra en el cierre (D27).
 */
export type PaymentStatus = 'no_aplica' | 'pendiente' | 'pagado' | 'rechazado';

/** D18: la notificación no es una aceptación. */
export type OrderStatus =
  | 'recibido'
  | 'aceptado'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'cancelado';

export interface OrderLine {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  code: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storePhone?: string;
  lines: OrderLine[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  slotId: string;
  slotLabel: string;
  slotKind: 'retiro' | 'reparto';
  address?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Id del cobro en el proveedor, cuando hubo uno. */
  paymentId?: string;
  status: OrderStatus;
  createdAt: string;
  /** Lo declara el comercio al aceptar. Nunca lo promete la plataforma (D20). */
  readyEstimate?: string;
  cancelReason?: string;
}

export interface NewOrder {
  storeId: string;
  lines: { productId: string; quantity: number }[];
  slotId: string;
  address?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  personId?: string;
}

// ---------------------------------------------------------------------------
// Resultado de una búsqueda en el pueblo — D11, D12, P5
// ---------------------------------------------------------------------------

export interface TownSearchHit {
  product: Product;
  store: Pick<Store, 'id' | 'slug' | 'name' | 'isOpenNow' | 'storefrontPublished'>;
}

export interface TownSearchResult {
  query: string;
  hits: TownSearchHit[];
  /**
   * Nunca decimos "nadie tiene X" (P5). Decimos que no lo encontramos cargado, y
   * registramos la búsqueda vacía porque es señal de demanda (D12).
   */
  exhaustive: false;
}

// ---------------------------------------------------------------------------
// El puerto. Cualquier adapter (fixtures o API real) implementa esto.
// ---------------------------------------------------------------------------

export interface NexoPosPort {
  /** Resuelve un subdominio: puede ser un comercio o un pueblo. */
  resolveHost(sub: string): Promise<
    { kind: 'store'; store: Store } | { kind: 'town'; townSlug: string; name: string } | null
  >;
  getStore(slug: string): Promise<Store | null>;
  listPasillos(storeId: string): Promise<Pasillo[]>;
  listProducts(storeId: string): Promise<Product[]>;
  getProduct(storeId: string, productId: string): Promise<Product | null>;

  listTownStores(townSlug: string): Promise<Store[]>;
  searchTown(townSlug: string, query: string): Promise<TownSearchResult>;

  getPerson(personId: string): Promise<Person | null>;
  getAccount(personId: string, storeId: string): Promise<MerchantAccount | null>;

  createOrder(order: NewOrder): Promise<Order>;
  getOrder(code: string): Promise<Order | null>;
  /** El cobro se acreditó: el pedido queda pagado. */
  confirmOrderPayment(code: string, paymentId: string): Promise<Order | null>;

  /**
   * Registra un pago contra un resumen del comercio. Admite pago parcial y se imputa
   * del período más viejo al más nuevo (D31).
   */
  registerAccountPayment(input: {
    personId: string;
    storeId: string;
    periodId: string;
    amountCents: number;
    paymentId: string;
  }): Promise<MerchantAccount | null>;
}
