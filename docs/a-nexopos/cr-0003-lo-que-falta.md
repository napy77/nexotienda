# CR-0003 — Lo que falta de NexoPOS para que la tienda pida identificarse

> **Para el equipo de NexoPOS.** De NexoTienda, 13 de octubre de 2026. Se manda tal cual.
> Responde a su `respuesta-cr-0003-identidad.md` (con los agregados del 12 y el 13).

## En una línea

NexoTienda ya desplegó su parte (commit `a74d5fd`). Hoy **no se ve nada** porque
NexoPOS todavía no manda `orderRules` ni rechaza pedidos con las reglas nuevas. Lo
probamos en producción: un pedido anónimo «retiro + efectivo» en Supermercado Delfín
(`P-FC3B51C5`) entró derecho, que es lo correcto con las reglas apagadas.

## Lo que necesitamos, en orden

### 1. `orderRules` en `GET /v1/stores/:slug` (y en `/v1/hosts/:sub`)

La forma que propusieron, sin cambios:

```json
"orderRules": { "enabled": true,
  "levels": [ { "level": 0, "pickupCash": false, "deliveryCash": false },
              { "level": 1, "pickupCash": true, "deliveryCash": true, "maxTotalCents": 4500000, "maxItems": 25 } ],
  "deliveryCashRequiresPickups": 1 }
```

Qué hace la tienda con esto:
- Ausente, `{ "enabled": false }` o cualquier forma que no entienda: **apagado**, como hoy.
- Solo mira la fila del **nivel 0**. Si no permite pagar en mano para esa franja (o no
  hay fila de nivel 0), el botón del checkout pasa a «Identificarme con ClubPay».
- Los topes no los adelanta: espera su rechazo.

**Importante:** la tienda manda el `accountId` con efectivo o transferencia **solo
cuando `orderRules.enabled` es `true`**, porque hoy `POST /v1/orders` rechaza cuenta y
contacto juntos («Un pedido va con cuenta corriente o con contacto, no con los dos»).
O sea: `enabled: true` nos dice también que ya aceptan los dos juntos. No lo
manden prendido antes de aceptarlo.

### 2. `POST /v1/orders`: aceptar `accountId` + `contact` juntos, y los rechazos

- Cuenta y contacto juntos con cualquier forma de pago. Con la libreta mandamos solo
  `accountId`; con lo demás, siempre `contact` (nombre y teléfono).
- 409 `{ error, code, …datos }` con los `code` de su tabla. Decidimos por `code`; el
  `error` lo mostramos tal cual, así que escríbanlo para el comprador:

| `code` | Qué hace la tienda | Dato que usamos si no viene `error` |
|---|---|---|
| `requiere_cuenta` | Mensaje + botón «Identificarme con ClubPay» | — |
| `nivel_insuficiente` | Mensaje + el mismo botón | — |
| `excede_tope_monto` | Mensaje, corregible (sacar algo) | `maxTotalCents` |
| `excede_tope_productos` | Mensaje, corregible | `maxItems` |
| `reparto_requiere_historial` | Mensaje, corregible (elegir retiro) | — |
| `libreta_no_activa` (409) / `falta_cuenta` (400) | Elegir otra forma de pago | — |
| `cuenta_bloqueada` | Su mensaje neutro + «Hablar con el comercio» | — |

Si falta el dato extra, nuestro texto va sin número: no lo inventamos.

### 3. El canje de cuentas nacidas en la tienda (`POST /v1/cuentas/canjear`)

Su punto 2: crear el cliente con `libreta_activa = false` en el primer canje y
devolver `{ accountId: "CLI-<n>", storeId, displayName, linkedAt }` como siempre.
**Sin esto, el botón no sirve:** la persona se hace la cuenta en ClubPay, vuelve a la
tienda y el canje falla (hoy sería su 502 por `external_id: null`). La tienda lo
trata como un token vencido —«El enlace dura dos minutos. Volvé a entrar desde
ClubPay»—, que en este caso es falso, y no tiene cómo saber que el problema fue otro.

### 4. `review` en el pedido

`"review": { "reason": "cuenta_nueva_monto_alto" | "identidad_no_disponible" }` en
`GET /v1/orders/:code` y en la respuesta del alta. La tienda muestra «<Comercio> va a
confirmar tu pedido antes de prepararlo» y no muestra el motivo. Sin `review`, el
seguimiento es el de siempre.

### 5. `creditEnabled` en `GET /v1/cuentas/:accountId`

Entendemos que ya salió con `3589a28`. Si no viene, lo tomamos como `true` (como era
antes). Con `false` no ofrecemos anotar en la libreta.

## Lo que no hace falta

- **No mandamos el nivel** ni lo vamos a mandar.
- No necesitamos webhooks para esto: el `review` lo leemos del pedido.

## Para probarlo juntos

Cuando estén 1, 2 y 3, prendan las reglas en un comercio de prueba y avísennos.
Probamos: pedido anónimo con retiro (tiene que pedir identificarse), la ida y vuelta a
ClubPay con una cuenta nueva, el pedido con cuenta y teléfono, uno sobre el tope, y
uno con `review`.
