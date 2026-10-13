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
- `orderRules` (CR-0003) — `{ enabled: false }` o ausente es **apagado**, y cualquier
  forma rara también. Con `enabled: true`, `levels[]` dice por nivel si se puede pagar
  al retirar (`pickupCash`) o al recibir (`deliveryCash`) y los topes. La tienda solo
  lee el nivel 0 (quien no se identificó); **el rechazo con `code` manda**.
- `acceptedPayments` — la tienda **no infiere** medios de pago. `online` sale **solo**
  de `acceptsMercadoPago: true`; `acceptsOnlinePayment` viaja pero no decide nada
  (da `true` también con contra entrega).

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
- `creditEnabled` (CR-0003) — **una sesión no es una libreta.** `false`: se identificó
  pero no tiene libreta con ese comercio; no se ofrece anotar. Ausente es `true`.
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
- `paymentMethod: "online"` **es Mercado Pago** y nada más.
- `accountId` + `contact`: con sesión, `accountId` va con cualquier forma de pago;
  `contact` va siempre salvo a la libreta. **`orderRules.enabled` no es señal de
  nada más que «este comercio pide identificarse»** (lo pidió NexoPOS). Mientras el
  NexoPOS desplegado los rechace juntos (400 sin `code`), el adapter reintenta sin la
  cuenta — transición, se borra cuando confirmen. **El nivel no se manda.**
- **Transferencia no existe en `POST /v1/orders`.** Con la API real nunca se ofrece
  (el adapter arma efectivo, Mercado Pago y libreta); solo aparece en fixtures.
- Rechazos del CR-0003, 409 con `{ error, code }`: `requiere_cuenta` y
  `nivel_insuficiente` (ofrecer identificarse), `excede_tope_monto` (`maxTotalCents`),
  `excede_tope_productos` (`maxItems`), `reparto_requiere_historial`,
  `libreta_no_activa`, `cuenta_bloqueada` (mensaje neutro, nunca decir «bloqueada»).
  `falta_cuenta` es 400. Sin el dato extra, el texto va sin número.
- `review: { reason }` — el comercio lo mira antes de aceptarlo. **No es un estado**:
  sigue en `recibido`. El motivo no se le muestra al comprador.
- `paymentStatus`: `no_aplica | pendiente | pagado | rechazado | reembolsado`. **Un
  estado desconocido no puede tirar la pantalla**: antes `reembolsado` la rompía.
- `paymentError` — el motivo del rechazo, escrito por NexoPOS **para el comprador**.
  Se muestra tal cual.
- **NexoTienda nunca declara un pedido pagado.** No hay método para eso en el port.

## Cobro

```
POST /v1/orders/:code/checkout   { returnUrl }   →  { checkoutUrl, expiresAt }
```

- **El importe no viaja**: lo pone NexoPOS del total. Si viajara, se podría pagar menos
  de lo que se compró.
- Un solo link vivo por pedido. No se guardan links.
- 409 «ya está pagado» **no es un error**: se muestra el pedido.
- **Los errores traen `{ error, code }`. Se decide por `code`, nunca por el texto**:
  `error` es para el comprador y NexoPOS lo puede reescribir. Un error sin `code` no
  pide ninguna decisión: se muestra.

  | `code` | Qué hace la tienda |
  |---|---|
  | `ya_pagado` | Muestra el pedido |
  | `mp_no_disponible` | Al crear el pedido: error **corregible**, elegir otro medio |
  | `no_es_mercadopago`, `pedido_cancelado` | Muestra el mensaje |
  | `link_anterior_vivo` (502) | Que reintente |
  | `pago_lo_confirma_mercadopago` | No debería verse: la tienda no llama a `/payment` |
- El `returnUrl` es la URL pública completa del pedido.
- **La URL de vuelta no es prueba de pago.** Se consulta el pedido.

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
