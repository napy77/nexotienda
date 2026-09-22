# Contratos que no se pueden romper

La fuente de verdad es **`src/lib/nexopos/types.ts`**. Este documento explica **qué
significa** cada cosa y **qué pasa si cambia**. Un cambio acá se avisa a NexoPOS y a
ClubPay antes de hacerlo.

## Identificadores

| Campo | Forma | Si cambia |
|---|---|---|
| `storeId` | texto (`"1"`) | Se rompe todo |
| `slug` | texto elegido por el comerciante | Links muertos. Los viejos van a `previousSlugs` y **no se reasignan nunca** |
| `productId` | texto | Carritos e historiales locales quedan huérfanos |
| `accountId` | texto, **el de NexoPOS** (`"CLI-4231"`) | La sesión abriría y el primer pedido a la libreta fallaría |
| `order.code` | texto | El link de seguimiento que viajó por WhatsApp muere |
| id de nodo del árbol | `r:`/`s:` + nombre | Se rompen las URLs de góndola que la gente compartió |

## Dinero

**Todo en centavos enteros.** Nunca floats.

- `priceCents` — **ya trae el descuento aplicado**. NexoTienda no multiplica nada.
- `listPriceCents` — el precio anterior, **solo cuando hay diferencia**. Es de donde
  sale el porcentaje de la cinta.
- Si no hay `listPriceCents`, **no hay descuento**: no se pinta cinta ni se hereda el
  de la campaña.

## Disponibilidad — unión discriminada

```ts
{ policy: 'stock';    onHand: number }
{ policy: 'declared'; state: 'available'|'out'; quota?: {total, remaining} }
{ policy: 'unknown' }
```

- `unknown` **no es cero y no bloquea nada**. No saber no es saber que no hay (P5).
- `declared` es lo que el comercio declaró **para hoy**: por eso con el comercio
  cerrado no se puede encargar.
- Agregar una cuarta política rompe los `switch` exhaustivos.

## Producto

- `images: string[]` — **con la portada primero**, nunca `null`; sin fotos es `[]`.
  La garantía la da el adapter, no el cable.
- `publishedInStore` — distinto de ser insumo. NexoPOS no manda insumos.
- `origin: 'canonico' | 'propio'` — decide "armando" vs "elaborando" en el pedido.
- `subCategory` — **el nombre es la clave** que une el producto con el árbol.

## Comercio

- `isOpenNow: boolean | null` — **`null` es "no sabemos", no "cerrado"**. Ante la duda
  `null`, nunca `false`: una tienda apagada por defecto pierde todas las ventas y el
  dueño no se entera.
- `showsOutOfStock: boolean` — ausente se asume `true`. En `false` NexoPOS filtra los
  agotados antes de responder, y los `productCount` cuentan después de filtrar.
- `storefrontPublished` — hay comercios que usan NexoPOS y no venden online.
- `schedule: OpeningSlot[]` — lo que decide; `openingHours` es texto para leer.
- `acceptedPayments` — la tienda **no infiere** medios de pago.

## Campaña

- `discountPercent` — **es el techo de la tanda, no "el descuento"**. Cada producto
  tiene el suyo. Se muestra con **"hasta"** y en ningún otro lado.
- `productIds` — **en el orden que eligió el comerciante. No se reordena.** La fila
  muestra los primeros, así que el orden decide qué se ve.
- Solo llegan las vigentes; sin campañas es `[]`, no un 404.

## Cuenta corriente

- `availableCents: number | null` — **`null` es sin límite**, que es el default y el
  caso más común. No es cero. Sin límite, la línea no se muestra.
- `balanceCents` — **cuánto se debe.** No se calcula sumando resúmenes: esa suma deja
  afuera el período abierto.
- `creditPaused` / `onlineCreditEnabled` — **dos cosas distintas** y se cuentan
  distinto: "hablá con el comercio" vs "este comercio no toma libreta online".
- `linkedAt` — se mueve cuando el vínculo cambia, **no en una consulta de rutina**. Si
  se moviera al consultar, cerraría la sesión de todo el mundo cada pocos minutos.
- `closingDay` / `dueDay` — opcionales. Si no vienen, no se muestran.
- **La pila de resúmenes ya no se pide.** Vive en ClubPay.

## Pedido

```
recibido → aceptado → listo → [en_camino] → entregado
                   ↘ cancelado
```

- `recibido` es donde nace. **Que le llegue al comercio no es que lo haya aceptado** (D18).
- `readyEstimate` lo declara el comercio al aceptar. **La plataforma nunca lo inventa.**
- `en_camino` solo existe con reparto.
- `cancelReason` es **texto libre del comerciante**, no un código. "No me quedan de
  ananá, tengo de muzzarella" mantiene la venta; un "sin stock" del sistema la corta.
- `expectedTotalCents` va en el alta; si el precio cambió, `priceChanged` +
  `expectedTotalCents` vuelven y la pantalla lo dice.

## Handoff y emparejamiento

- Token de **un solo uso, dos minutos**, atado a la relación.
- El canje devuelve `{accountId, storeId, displayName, linkedAt}`. El `storeId` se
  **manda** en el pedido y se compara al volver.
- Emparejar: `{requestId, code, expiresAt}` y el sondeo `pendiente|listo|vencido`.
  **El token se entrega una sola vez.**

## Reglas del adapter

1. **Tolerar las dos formas** mientras el otro lado migra (`snake_case`/`camelCase`,
   arreglo pelado vs `{items,total}`).
2. **Traducir en el adapter**, no deformar los tipos del dominio.
3. **Degradar sin caerse**: las ofertas y los destacados son adorno.
4. **Un 404 en un endpoint de acción se loguea**: si no, una ruta inexistente y una
   respuesta vacía se ven iguales.
