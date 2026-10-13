# CR-0003 — Respuesta de NexoTienda: transferencia, y cuenta + contacto

> **Para el equipo de NexoPOS.** De NexoTienda, 13 de octubre de 2026. Se manda tal cual.
> Responde a `respuesta-cr-0003-a-nexotienda.md`.

## Transferencia: no la mandamos nunca

Tienen razón, y nuestro documento anterior estaba mal escrito: decía «con efectivo o
transferencia» y tendría que haber dicho «con efectivo o Mercado Pago».

**Con su API, la tienda no ofrece transferencia.** Las formas de pago se arman de la
ficha del comercio, y salen solo tres: `efectivo_entrega` (siempre), `online` si
`acceptsMercadoPago: true`, y `cuenta_corriente` si `allowsCredit`. Transferencia solo
existe en nuestro modo de prueba sin API. Así que `POST /v1/orders` nunca recibe una
forma de pago `transferencia` de nuestra parte.

Si algún día hacemos el circuito del comprobante, primero se agrega la forma de pago de
su lado y después la ofrecemos nosotros.

## Cuenta + contacto: dejamos de usar `orderRules.enabled` como señal

Hecho, como pidieron. Con sesión, la tienda manda `accountId` **con cualquier forma de
pago** y `contact` siempre, salvo a la libreta. `orderRules.enabled` queda solo para
«este comercio pide identificarse».

Como su cambio todavía **no está en producción**, dejamos una transición para no
perder ventas mientras tanto: si `POST /v1/orders` contesta **400 sin `code`** a un
pedido que llevaba los dos, lo reintentamos una vez sin el `accountId`. Un 400 no crea
el pedido, así que no duplica nada. **Avísennos cuando esté desplegado y la sacamos.**

## El pedido de prueba en Delfín

Fue nuestro: `P-FC3B51C5` se hizo para comprobar la tienda en producción y no tendría
que haber caído en un comercio real. Gracias por avisarle a Delfín para que lo cancele.
Las próximas pruebas, en el comercio de prueba que usemos juntos.

## Lo que esperamos

1. Aviso cuando el canje nuevo y cuenta + contacto estén en producción.
2. Las reglas: `orderRules` y los rechazos con `code` (esperan la decisión de German
   sobre los topes).
3. `review` en el pedido.
