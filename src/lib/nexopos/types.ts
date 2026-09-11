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
  /**
   * Si aparece en la tienda online.
   *
   * Distinto de ser insumo. El insumo se compra para usar y no se vende a nadie —el
   * jamón y la muzzarella de la pizza—; esto es un producto que **sí se vende en el
   * mostrador** pero que el comercio no quiere online. NexoPOS no manda los insumos;
   * esto filtra lo que queda.
   */
  publishedInStore: boolean;
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
// Región
// ---------------------------------------------------------------------------

/**
 * Un pueblo o zona con su propia página: `morrison.nexotienda.app`.
 *
 * No sale de la dirección del comercio. Se define por **zona de reparto** (D14): un
 * comercio a 8 km que reparte en Morrison pertenece a Morrison; uno en el centro que
 * solo atiende el mostrador, no. Así la página promete algo verdadero —"lo que te
 * pueden traer"— y los casos de borde se resuelven solos.
 *
 * Los nombres de pueblo se repiten en todo el país, así que el slug **no puede
 * derivarse del nombre**: lo asigna un humano y es único en todo el sistema.
 */
export interface Region {
  slug: string;
  name: string;
  province: string;
  /** Para desambiguar dos pueblos homónimos en la interfaz. */
  label: string;
}

/**
 * La relación comercio–región, que es de muchos a muchos.
 *
 * Son dos cosas distintas y las decide gente distinta (D13, D14):
 * - **Pertenecer** lo decide Nexo, por zona de reparto. Vive en el admin de B2B.
 * - **Aparecer** lo decide el comerciante, con un switch en NexoPOS. Un comercio
 *   puede repartir en dos pueblos y querer figurar solo en uno.
 */
export interface StoreRegion {
  regionSlug: string;
  listedInTownPage: boolean;
}

// ---------------------------------------------------------------------------
// Comercio
// ---------------------------------------------------------------------------

/**
 * Un tramo de atención. Varios por día: el almacén cierra al mediodía.
 *
 * Existe porque de un texto libre no se puede decidir nada. `"Lun a Sáb de 8 a 13 y
 * de 17 a 20:30"` es clarísimo para una persona y no se puede evaluar — y una
 * heurística sobre ese texto acertaría casi siempre y fallaría los domingos, que es
 * cuando importa.
 */
export interface OpeningSlot {
  /** 0 = domingo. */
  day: number;
  /** "08:00" */
  from: string;
  /** "13:00" */
  to: string;
}

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
  /**
   * Lo elige el comerciante en NexoPOS. Es un subdominio, así que comparte espacio
   * de nombres con las regiones y con los reservados — ver `SLUG_RULES`.
   */
  slug: string;
  /**
   * Slugs que este comercio tuvo antes. Cambiar de slug rompe todos los links que
   * ya circularon por WhatsApp, que es por donde viaja todo acá; los viejos siguen
   * funcionando con redirección permanente.
   */
  previousSlugs?: string[];
  name: string;
  category: string;
  /**
   * Etiqueta para mostrar en el encabezado de la tienda: "Súper SOL · Morrison".
   * Es la región principal, y existe solo para no tener que resolver `regions` en
   * cada pantalla.
   */
  town: string;
  /**
   * Dónde reparte de verdad. Muchos a muchos, porque no sale de la dirección sino
   * de la zona de reparto (D14): un comercio puede repartir en dos pueblos.
   */
  regions: StoreRegion[];
  address: string;
  /** Habilita el botón de contacto: la válvula de escape del modelo. */
  phone?: string;
  whatsapp?: string;
  logoUrl?: string;
  /** Texto para mostrar. El comerciante lo escribe mejor que cualquier formateo. */
  openingHours?: string;
  /** La fuente de la decisión. Lo de arriba es para leer, esto es para calcular. */
  schedule?: OpeningSlot[];
  /**
   * Lo calcula NexoPOS con el horario y cualquier pausa manual.
   *
   * **`null` no es `false`: es que no sabemos.** Un comercio sin horario cargado no
   * está cerrado, está sin configurar. Decir "abierto" y que el tipo tenga la
   * persiana baja manda a alguien a un viaje al pedo (P5, P6) — es el mismo caso que
   * `availability: unknown`.
   */
  isOpenNow: boolean | null;
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
  /**
   * Las formas de pago que este comercio acepta. NexoPOS no deja publicar una
   * tienda sin al menos una, ni sin al menos un slot de entrega: una tienda así
   * toma pedidos que después nadie puede cerrar, y el que queda mal con el vecino
   * es el comerciante.
   */
  acceptedPayments: PaymentMethod[];
  /** Obligatorios si acepta transferencia; sin esto el comprador no sabe dónde pagar. */
  transferAlias?: string;
  transferHolder?: string;
  /** Da cuenta corriente en el mostrador. Distinto de habilitarla online (D34). */
  allowsCredit: boolean;
}

// ---------------------------------------------------------------------------
// Cuenta corriente — una POR COMERCIO
// ---------------------------------------------------------------------------

/**
 * Un resumen es un período congelado (D27): un documento estable, pagable y
 * disputable. El período abierto es otra cosa y nunca se mezcla con estos (D28).
 */
export interface AccountStatement {
  /** NexoPOS lo llama `statement_id`: lo que la persona ve es un resumen. */
  statementId: string;
  /**
   * Lo calcula NexoPOS y se muestra TAL CUAL. Si el comercio cierra el 10, el
   * período no es ningún mes y el label es "11/08 al 10/09". Reescribirlo a nombre
   * de mes sería mentir sobre qué abarca.
   */
  label: string;
  status: 'abierto' | 'cerrado' | 'pagado_parcial' | 'pagado';
  closedAt?: string;
  /** Solo en los cerrados. El abierto es lo que todavía está pasando. */
  dueDate?: string;
  totalCents: number;
  paidCents: number;
  /**
   * Los movimientos. NexoPOS todavía no los anida en el listado: se piden aparte
   * cuando la persona abre el resumen. Sin ellos un resumen es un número y no un
   * documento, y no se puede disputar — que es la mitad de para qué existe (D27).
   */
  entries?: AccountEntry[];
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
 * No existe una cuenta "del pueblo", y tampoco existe una clave que identifique al
 * comprador a través del pueblo: el `accountId` es de la RELACIÓN, distinto para la
 * misma persona en cada comercio. Un id estable por persona compartido entre
 * comercios les permitiría cruzar sus listas y descubrir que es el mismo cliente
 * — que es justo lo que P3 prohíbe, entrando por la puerta de atrás.
 *
 * El total del pueblo lo calcula ClubPay para mostrárselo al deudor, y nada más (P3).
 */
export interface MerchantAccount {
  /** Id de la relación persona–comercio. Solo existe si la vinculación fue aceptada. */
  accountId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  /**
   * Saldo disponible, o `null` cuando el comercio no le puso límite — que es el
   * default y el caso más común, porque así funciona el cuaderno.
   *
   * `null` NO es cero: es exactamente al revés. Y tampoco se muestra como "sin
   * límite", que suena a premio: cuando es `null`, la línea no se muestra.
   *
   * Cuando hay número se dice "Disponible: $18.000", nunca "Tu límite es $20.000"
   * (D32). Mismo dato, dos objetos sociales distintos.
   */
  availableCents: number | null;
  /** Día del mes en que cierra este comercio. Configurable por comercio (D27). */
  closingDay: number;
  /** El comercio pausó el fiado. No bloquea la venta, solo el fiado (D35). */
  creditPaused: boolean;
  /** Compras a cuenta desde la tienda online. Arranca APAGADO (D34). */
  onlineCreditEnabled: boolean;
  /** La pila. Del más viejo al más nuevo (D28, D30). */
  statements: AccountStatement[];
}

/**
 * Por qué la opción de comprar en la libreta está grisada.
 *
 * Son cuatro situaciones distintas y cada una merece su mensaje: no es lo mismo no
 * tener cuenta que tenerla pausada. Y en ningún caso se esconde el botón — se
 * explica, con la puerta al humano al lado (D36).
 */
export type CreditBlockReason =
  | 'sin_cuenta'
  | 'solo_mostrador'
  | 'pausada'
  | 'sin_disponible';

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

export type PaymentMethod =
  /** El camino normal: comprás y pagás cuando lo recibís o lo retirás. */
  | 'efectivo_entrega'
  /** ClubPay, tarjeta. Va por el rail de Mercado Pago del comercio. */
  | 'online'
  /** Transferencia al alias del comercio. Requiere alias y titular en el `Store`. */
  | 'transferencia'
  /** Solo si hay cuenta autorizada en el mostrador y habilitada online (D23, D34). */
  | 'cuenta_corriente';

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
  /** Ausente en la compra anónima, que es el camino normal. */
  accountId?: string;
  contact?: { name: string; phone: string };
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
  /**
   * Por qué se canceló, **en palabras del comercio**.
   *
   * No es un código de error ni una plantilla nuestra: es lo que el comerciante le
   * quiere decir a su cliente. "No me quedan de ananá, tengo de muzzarella y
   * napolitana" mantiene la venta y la relación; un "sin stock" del sistema la
   * corta. La plataforma no arbitra: acerca a las dos personas (D36).
   */
  cancelReason?: string;
  /** Quién canceló: el comercio, el comprador, o el vencimiento automático (D19). */
  cancelledBy?: 'comercio' | 'comprador' | 'vencimiento';
  cancelledAt?: string;
}

export interface NewOrder {
  storeId: string;
  lines: { productId: string; quantity: number }[];
  slotId: string;
  address?: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  /**
   * Solo cuando la compra va a la libreta. El camino normal es anónimo: alguien
   * entra, compra dos paquetes de harina y paga al recibirlos.
   */
  accountId?: string;
  /** Para poder avisarle del pedido a quien compró sin cuenta. */
  contact?: { name: string; phone: string };
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

/**
 * El puerto. Cualquier adapter (fixtures o API real) implementa esto.
 *
 * Dos credenciales, no una: los endpoints de plataforma (resolver un subdominio,
 * el pueblo) no tienen otra credencial posible; los del comercio —su catálogo, su
 * stock, las cuentas de sus clientes, sus pedidos— van con la clave de ESE
 * comercio. Una clave de plataforma que puede leer y escribir la cuenta corriente
 * de cualquier comercio concentra un daño del tamaño del ecosistema entero.
 */
export interface NexoPosPort {
  // --- plataforma ---
  resolveHost(sub: string): Promise<
    { kind: 'store'; store: Store } | { kind: 'town'; townSlug: string; name: string } | null
  >;
  listRegions(): Promise<Region[]>;
  getRegion(slug: string): Promise<Region | null>;
  /** Solo los que el comerciante habilitó a figurar (D13). */
  listTownStores(townSlug: string): Promise<Store[]>;
  searchTown(townSlug: string, query: string): Promise<TownSearchResult>;

  // --- del comercio ---
  getStore(slug: string): Promise<Store | null>;
  listPasillos(storeId: string): Promise<Pasillo[]>;
  listProducts(storeId: string): Promise<Product[]>;
  getProduct(storeId: string, productId: string): Promise<Product | null>;

  /**
   * La cuenta de una persona EN ESTE COMERCIO. 404 si no tiene.
   *
   * No existe "todas las cuentas de esta persona": ese mapa vive en ClubPay, que es
   * el único que sabe que el Juan del almacén y el de la ferretería son el mismo.
   */
  getAccount(storeId: string, accountId: string): Promise<MerchantAccount | null>;
  /** Los movimientos de un resumen. Se piden cuando la persona lo abre. */
  getStatementEntries(
    storeId: string,
    accountId: string,
    statementId: string,
  ): Promise<AccountEntry[]>;

  createOrder(order: NewOrder): Promise<Order>;
  getOrder(code: string): Promise<Order | null>;
  confirmOrderPayment(code: string, paymentId: string): Promise<Order | null>;

  /**
   * Un pago contra la cuenta, por un importe libre.
   *
   * NexoTienda NO elige qué resumen se paga: manda un monto y NexoPOS lo imputa del
   * más viejo al más nuevo, con lo que sobre a cuenta del período abierto (D31). La
   * imputación es del libro, no de la vidriera.
   */
  registerAccountPayment(input: {
    storeId: string;
    accountId: string;
    amountCents: number;
    paymentId: string;
  }): Promise<MerchantAccount | null>;
}
