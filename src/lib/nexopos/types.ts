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
  /** La portada: la que va en la tarjeta, en el carrito y en el link de WhatsApp. */
  imageUrl?: string;
  /**
   * La galería completa, **con la portada primero**, tal como la arma NexoPOS.
   *
   * Nunca es `null` ni `undefined`: un producto sin fotos llega con `[]`. Eso lo
   * garantiza el adapter, no el cable —NexoTienda despliega independiente de
   * NexoPOS y una versión sin el campo no puede romper el catálogo entero—.
   *
   * Que venga ya ordenada es a propósito: si cada pantalla armara
   * `[imageUrl, ...resto]` por su cuenta, la misma decisión se repite hasta que
   * alguna la hace distinto.
   */
  images: string[];
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

// ---------------------------------------------------------------------------
// Campañas
// ---------------------------------------------------------------------------

/**
 * Una tanda de ofertas con nombre, fechas y productos: "Ofertas imperdibles", del
 * 1 al 15, 25% en estos veinte.
 *
 * **El precio no se calcula acá.** La campaña dice qué productos entran y cómo se
 * llama la sección; el `priceCents` de cada producto ya viene con el descuento
 * aplicado por NexoPOS, y el viejo queda en `listPriceCents`. Si lo multiplicáramos
 * nosotros, el changuito diría un número y la nota de venta otro — y de los dos el
 * que vale es el del POS. Un número equivocado con autoridad es peor que no tener
 * número (P6).
 *
 * Por eso `discountPercent` es **para el cartel**, no para la cuenta.
 */
export interface Campaign {
  id: string;
  storeId: string;
  /** Tal cual lo escribió el comerciante. Es el título de la sección. */
  name: string;
  startsAt?: string;
  endsAt?: string;
  /** Lo que configuró el comerciante. Para mostrar; el precio ya viene con él. */
  discountPercent: number;
  /**
   * Los productos de la campaña. Los que no estén en el catálogo —agotados en una
   * tienda que esconde lo agotado— simplemente no aparecen, sin que haya que
   * cruzar nada.
   */
  productIds: string[];
}

/**
 * Lo que el comercio vende más y lo que la gente más busca en su tienda.
 *
 * Son ids, no productos: el catálogo ya lo pedimos aparte y cruzarlo es gratis.
 *
 * **Si no están, no se inventan.** Una estantería que dice "Los más vendidos" con
 * una selección nuestra es exactamente lo que P5 prohíbe — y en un pueblo se nota
 * al instante, porque el almacenero sabe de memoria qué es lo que más vende. El día
 * que no haya estadística, la estantería existe igual pero **con otro título**, uno
 * que no afirme nada.
 */
export interface Highlights {
  bestSellers: string[];
  mostSearched: string[];
}

/**
 * Un nodo del árbol de una góndola.
 *
 * La clave es el **nombre**, no un id, porque es lo que el producto trae en su
 * `subCategory`. Meter ids obligaría a cambiar también el producto, y el nombre ya
 * es único dentro de su rama.
 */
export interface CategoryNode {
  /**
   * El id del nodo, prefijado por nivel (`r:Aceites`, `s:Girasol`).
   *
   * Prefijado porque un rubro y un subrubro se pueden llamar igual —"Aceites"
   * adentro de "Aceites"— y hay que poder pedir uno sin traerse el otro. Cuando
   * NexoPOS manda la forma vieja —una lista plana de nombres— el adapter usa el
   * nombre como id, que en ese mundo alcanza.
   */
  id: string;
  name: string;
  /** Cuántos productos cuelgan de acá abajo. Lo cuenta NexoPOS sobre lo que hay. */
  productCount?: number;
  children?: CategoryNode[];
}

/** Qué pedazo del catálogo se quiere. */
export interface ProductQuery {
  pasillo?: string;
  /** El nodo más profundo elegido. NexoPOS resuelve la rama. */
  sub?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ProductPage {
  items: Product[];
  /** El total **de la consulta**, ya filtrado por stock. No el del catálogo. */
  total: number;
}

export interface Pasillo {
  id: string;
  name: string;
  iconName?: string;
  imageUrl?: string;
  /** Las hojas declaradas, plano. Queda por compatibilidad: lo que se usa es `children`. */
  subCategories: string[];
  /**
   * El árbol de la góndola, con la profundidad que tenga.
   *
   * "Almacén" no se abre en cuarenta subrubros: se abre en rubros —"Aceites y
   * aderezos"— y recién ese en "de oliva", "de girasol", "de maíz". Aplastar los
   * tres niveles en uno es lo que convierte una góndola en un muro de cuarenta
   * botones, que es exactamente lo que nadie lee.
   *
   * Si NexoPOS manda solo `subCategories`, el adapter arma un árbol de un nivel y
   * todo se comporta como antes.
   */
  children?: CategoryNode[];
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
  /** La foto ancha de la tienda. El logo identifica; el banner es su cara. */
  bannerUrl?: string;
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
  /**
   * Si la tienda muestra lo que no tiene.
   *
   * `true` es el default y lo que hace casi todo almacén: mostrar el producto
   * agotado es la venta de pasado mañana —"acá esto se consigue"— y el cartelito
   * de "sin stock por ahora" lo dice sin mentir.
   *
   * `false` lo enciende el que importó tres mil artículos del catálogo mayorista
   * y tiene cuatrocientos en la góndola. Esa tienda abierta es pantallas enteras
   * de "No disponible", y una tienda así parece cerrada.
   *
   * **El filtrado lo hace NexoPOS, no nosotros**: la lista llega ya corta. Acá el
   * campo sirve para no prometer lo que no se puede cumplir — un filtro de
   * "ver los agotados" que no traería nada, o un "no lo encontramos" que le echa
   * la culpa a un catálogo incompleto cuando en realidad es una decisión del
   * comercio.
   */
  showsOutOfStock: boolean;
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
 * **La pila de resúmenes no vive acá.**
 *
 * Existe —es D27 y D28: cada período se congela en un documento estable, pagable y
 * disputable, y el abierto nunca se mezcla con los cerrados— pero la muestra ClubPay,
 * que es la vista agregada del deudor y es donde corresponde (P3).
 *
 * El motivo de que no se duplique en la tienda es que **la audiencia es la misma por
 * construcción**: la libreta online requiere ClubPay, así que todo el que puede abrir
 * la libreta en la tienda ya tiene la pila en la app. No es mostrar menos: es no
 * mostrarle lo mismo dos veces a la misma persona con dos cuentas que pueden no
 * coincidir — y basta que difieran en qué período está abierto para que alguien vea
 * dos deudas distintas del mismo comercio (P6).
 *
 * La tienda contesta "cuánto debo y cuánto puedo cargar", con `balanceCents` y
 * `availableCents`. El detalle está a un toque, en la app de la que vino.
 */

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
/**
 * Lo que devuelve canjear el token del handoff.
 *
 * `storeId` viaja aunque ya sepamos en qué tienda estamos parados, y es a propósito:
 * es lo que deja **verificar** que el token es de esta tienda. Un token emitido para
 * la libreta de Jure no puede abrir una sesión en Delfín, y esa comprobación tiene
 * que poder hacerse sin confiar en el que trajo el token.
 */
export interface LinkSession {
  /**
   * El id de la libreta **en NexoPOS** (`CLI-4231`), no el de ClubPay, aunque el
   * canje pase por ahí. Es el mismo que ya acepta `POST /v1/orders`: si fuera el
   * otro, la sesión abriría bien y el primer pedido a la libreta fallaría, que es
   * el peor lugar para enterarse.
   */
  accountId: string;
  storeId: string;
  /** Cómo se llama la persona, para poder mostrar de quién es la libreta abierta. */
  displayName: string;
  /**
   * Cuándo se estableció este vínculo. Se compara contra el de la cuenta en cada
   * lectura: si cambió, el vínculo cambió y la sesión abierta deja de valer.
   *
   * Es **la única revocación que existe en este diseño**. La sesión es una cookie en
   * un navegador ajeno: si el comerciante desvincula al cliente o la persona pierde
   * el teléfono, nadie puede cerrarla — ni NexoPOS, ni ClubPay, ni nosotros.
   */
  linkedAt?: string;
}

export interface MerchantAccount {
  /** Id de la relación persona–comercio. Solo existe si la vinculación fue aceptada. */
  accountId: string;
  storeId: string;
  /** Cómo se llama la persona. Para poder mostrar de quién es la libreta abierta. */
  displayName?: string;
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
  /**
   * Lo que esta persona le debe a este comercio, hoy.
   *
   * Es **el número que la persona vino a buscar**, y el único que puede contestarlo
   * sin ambigüedad: sumar los resúmenes cerrados da otra cosa —deja afuera el período
   * abierto— y la pila de períodos es para entender la deuda, no para calcularla. El
   * que sabe cuánto se debe es el libro, que es NexoPOS.
   */
  balanceCents?: number;
  /**
   * Día del mes en que cierra este comercio. Configurable por comercio (D27).
   *
   * Opcional porque puede no venir: si no sabemos cuándo cierra, no lo decimos. Un
   * "cierra el 1" inventado es peor que no decir nada (P6).
   */
  closingDay?: number;
  /** El comercio pausó el fiado. No bloquea la venta, solo el fiado (D35). */
  creditPaused: boolean;
  /** Compras a cuenta desde la tienda online. Arranca APAGADO (D34). */
  onlineCreditEnabled: boolean;
  /**
   * Día de vencimiento. "Cierra el 10" sin "vence el 20" es media frase.
   */
  dueDay?: number;
  /**
   * El período en curso, calculado por NexoPOS.
   *
   * La cuenta tiene una trampa que no conviene repetir de este lado: un cierre el 31
   * en febrero es el 28, y el 29 en los bisiestos. Si la pantalla dice "cierra el 10
   * de cada mes" alcanza `closingDay`; si alguna vez dice "cierra el 10 de octubre",
   * el dato sale de acá y la cuenta la hace un solo lugar.
   */
  currentPeriod?: { from: string; to: string; dueDate?: string };
  /** Ver `LinkSession.linkedAt`. Se mueve cuando el vínculo cambia, no al consultar. */
  linkedAt?: string;
  /** La pila. Del más viejo al más nuevo (D28, D30). */
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
  /**
   * El total no es el que el comprador vio al apretar el botón.
   *
   * Pasa cuando una campaña arranca o termina con el changuito cargado: alguien
   * pone cosas a las siete, se va a comer, vuelve a las nueve y la promo venció.
   * El precio que vale es el del POS —siempre lo fue—, pero enterarse en silencio
   * es lo que no puede pasar: si subió, la persona se comprometió a un número y le
   * están cobrando otro.
   *
   * `expectedTotalCents` es lo que había mostrado la pantalla, devuelto tal cual
   * se mandó, para poder decir la diferencia en vez de solo el resultado.
   */
  priceChanged?: boolean;
  expectedTotalCents?: number;
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
  /**
   * El total que la pantalla le mostró al comprador cuando apretó el botón.
   *
   * No es para que NexoPOS lo cobre —el precio que vale es el de ellos, y eso no
   * se discute—: es para que pueda **avisar que cambió**. Sin este dato no hay
   * forma de distinguir un precio que se movió de un comprador que nunca vio un
   * total, y la diferencia se descubriría recién al pagar.
   */
  expectedTotalCents?: number;
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
  /**
   * Qué es este subdominio.
   *
   * `moved` es un slug que el comercio dejó atrás: los links viejos siguen
   * circulando por WhatsApp y no se pueden dejar morir, así que redirigen al
   * actual (D: `previousSlugs`).
   */
  resolveHost(sub: string): Promise<
    | { kind: 'store'; store: Store }
    | { kind: 'town'; townSlug: string; name: string }
    | { kind: 'moved'; slug: string }
    | null
  >;
  /**
   * Todavía no existe del lado de NexoPOS: la región llega dentro del `Store`.
   * Queda declarado porque la página del pueblo lo va a necesitar para su título
   * y para desambiguar homónimos.
   */
  listRegions?(): Promise<Region[]>;
  getRegion?(slug: string): Promise<Region | null>;
  /** Solo los que el comerciante habilitó a figurar (D13). */
  listTownStores(townSlug: string): Promise<Store[]>;
  searchTown(townSlug: string, query: string): Promise<TownSearchResult>;

  // --- del comercio ---
  getStore(slug: string): Promise<Store | null>;
  listPasillos(storeId: string): Promise<Pasillo[]>;
  /**
   * Un pedazo del catálogo, no el catálogo.
   *
   * Delfín tiene siete mil productos: pedirlos todos para mostrar sesenta era
   * traer siete mil filas y tirar 6.940. El filtro y el corte viven donde están
   * las filas.
   */
  listProducts(storeId: string, query?: ProductQuery): Promise<ProductPage>;
  /** Un puñado suelto, por id. Para las estanterías, que saben qué quieren. */
  productsByIds(storeId: string, ids: string[]): Promise<Product[]>;
  getProduct(storeId: string, productId: string): Promise<Product | null>;
  /**
   * Las campañas vigentes, en el orden en que el comerciante las quiere ver.
   * Sin campañas es `[]` y la home no muestra ninguna sección: es el caso normal
   * de casi todo comercio, no un estado vacío que haya que dibujar.
   */
  listCampaigns(storeId: string): Promise<Campaign[]>;
  /**
   * Lo más vendido y lo más buscado. Vacío mientras no haya estadística — que es
   * el estado de toda tienda nueva, y no es un error.
   */
  listHighlights(storeId: string): Promise<Highlights>;
  /**
   * Canjea el token de un solo uso del handoff por la sesión de esa libreta.
   *
   * Devuelve `null` cuando el token no sirve —vencido, ya usado, inventado— sin
   * distinguir cuál de las tres: al que está parado en la tienda le da igual, y
   * decir "ya fue usado" le cuenta algo a quien esté probando tokens ajenos.
   */
  redeemLinkToken(token: string, storeId: string): Promise<LinkSession | null>;

  /**
   * La cuenta de una persona EN ESTE COMERCIO. 404 si no tiene.
   *
   * No existe "todas las cuentas de esta persona": ese mapa vive en ClubPay, que es
   * el único que sabe que el Juan del almacén y el de la ferretería son el mismo.
   */
  getAccount(storeId: string, accountId: string): Promise<MerchantAccount | null>;

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
