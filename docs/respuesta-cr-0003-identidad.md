# CR-0003 — Respuesta de NexoTienda: identidad para pagar al retirar o recibir

> De NexoTienda a nexo-ecosystem, 12 de octubre de 2026. Responde a
> `PARA-NEXOTIENDA_de-NEXO-ECOSYSTEM_identidad-cr-0003-completo.md`.
> **Estado: construido detrás de «reglas apagadas».** ClubPay y NexoPOS ya desplegaron; NexoTienda se despliega con este commit.

## En una línea

Sí a todo. Con `orderRules` apagado o ausente la tienda se comporta igual que hoy,
con una excepción a propósito: el arreglo de un bug actual (punto 0).

## 0. Un bug que encontramos de paso

Hoy, con la libreta abierta y pago al retirar, la tienda no mandaba **ni `accountId`
ni `contact`**, y NexoPOS lo rechaza con 400 («Falta el nombre y el teléfono»). Ya
está corregido: todo pedido que no va a la libreta pide nombre y teléfono, haya
sesión o no.

## 1. Ida a ClubPay

Sin sesión, con pago en mano y el nivel 0 sin permiso para esa franja (o sin fila de
nivel 0 con las reglas prendidas), el botón del checkout pasa a «Identificarme con
ClubPay» y manda a `https://www.clubpay.com.ar/entrar?volver=<URL completa>`
(configurable con `CLUBPAY_WEB_URL`). Si el comercio toma Mercado Pago, se ofrece como
alternativa sin cuenta.

**Ojo con el ejemplo del CR:** la ida no sale de `/pedido/77` sino del **carrito**,
porque el pedido todavía no existe. El `volver` es `https://<slug>.nexotienda.app/s/<slug>/carrito`.
Pedimos a ClubPay que su lista acepte cualquier camino bajo el subdominio (el CR dice
`…/…`, entendemos que sí).

## 2. La vuelta y `volver` — VALIDADO

`/entrar` lee `volver` y lo valida: tiene que empezar con `/`, no `//` ni `/\`, sin
caracteres de control, ≤ 500 caracteres, que resuelto no cambie de host ni quede en
`//…`, y que no sea `/entrar`. Si no pasa, se ignora y cae en la tienda. Gana sobre
`ir`. Probado con `//evil.com`, `https://evil.com`, `/\evil.com`, `/..//evil.com`,
saltos de línea y caminos relativos: todos caen en la raíz.

## 3. Conservación del carrito

El carrito ya vivía en `localStorage` del subdominio. La franja, forma de pago,
dirección, nombre y teléfono se guardan en un borrador en `localStorage` (no
`sessionStorage`, porque el email de verificación suele abrirse en otra pestaña) que
vence en una hora y se borra al mandar el pedido. **Si la persona verifica en otro
navegador o en otro teléfono, el carrito no viaja**: no hay cómo sin guardar datos
nuestros.

## 4. Nombre y teléfono con sesión

Aceptamos la propuesta: nombre precargado desde la cuenta (editable), teléfono
obligatorio y editable. Solo la libreta no los pide.

## 5. Pedidos

- `accountId` va con la libreta siempre, y con las demás formas de pago **solo si
  `orderRules.enabled`**: es la señal de que NexoPOS ya acepta cuenta y contacto juntos
  (hoy son excluyentes y rebota con 400).
- No mandamos el nivel.
- Se decide por `code`; el texto de NexoPOS se muestra tal cual y el nuestro es solo
  respaldo:

| `code` | Qué muestra la tienda |
|---|---|
| `requiere_cuenta`, `nivel_insuficiente` | El mensaje + el botón para identificarse (corregible) |
| `excede_tope_monto` / `excede_tope_productos` | «…toma pedidos de hasta $X / N productos distintos. Podés sacar algo.» (corregible) |
| `reparto_requiere_historial` | «…pide que la primera vez lo retires en el local.» (corregible) |
| `libreta_no_activa`, `falta_cuenta` | «No tenés libreta habilitada… Elegí otra forma de pago.» |
| `cuenta_bloqueada` | El mensaje neutro de NexoPOS + botón para hablar con el comercio. Nunca «bloqueada» |

Si falta el dato extra (`maxTotalCents`, `maxItems`) no se inventa: va el texto sin número.

## 6. `creditEnabled`

Ausente se toma como `true` (compatibilidad: hasta hoy toda sesión era libreta). Con
`false`: la opción «Anotar en la libreta» aparece grisada con «La libreta con X se abre
en el mostrador», la franja superior dice «Entraste como X» en vez de «Libreta abierta»,
y `/libreta` dice «Todavía no tenés libreta con X». **Si tiene deuda** (libreta cerrada
con saldo), `/libreta` sigue mostrando cuánto debe y cómo se paga, sin disponible.

## 7. `review`

En `recibido` con `review`, el seguimiento dice «X va a confirmar tu pedido antes de
prepararlo». El motivo no se muestra al comprador.

## 8. DEC-006

De acuerdo con la corrección. Corregida en `docs/DECISIONS.md` (DEC-006), y la
decisión nueva quedó como DEC-016.

## Cómo lo probamos

Con fixtures, sin NexoPOS ni ClubPay: con reglas prendidas, el botón arma
`https://www.clubpay.com.ar/entrar?volver=<carrito>`; la vuelta por `/entrar` con
`volver` restaura el carrito y lo cargado, abre la sesión, y el pedido sale con cuenta
y contacto y con el aviso de `review`. Con reglas apagadas y sesión, el pedido sale con
contacto solo, como espera el NexoPOS de hoy. `tsc` y `next build` pasan.

## Pendiente

- Probarlo contra el NexoPOS y el ClubPay reales, con un comercio de prueba y las
  reglas prendidas.
- Que ClubPay confirme que su lista de `volver` acepta `…/s/<slug>/carrito`.
