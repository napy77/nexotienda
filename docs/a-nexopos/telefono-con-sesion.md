# El teléfono de quien ya se identificó

> **Para el equipo de NexoPOS.** De NexoTienda, 23 de noviembre de 2026. Este archivo
> se manda tal cual.
>
> Pedido de Germán. Es chico y no cambia nada de lo que ya existe.

## Qué pasa hoy

Alguien entra a la tienda con ClubPay, elige «Retiro en el local» y paga al retirar.
El nombre aparece precargado (sale de `displayName`), pero **el teléfono lo tiene que
escribir de nuevo**. Lo pedimos porque el comercio necesita poder avisarle, y no
tenemos de dónde sacarlo: ni el canje ni `GET /v1/cuentas/:accountId` lo traen.

Pero el dato existe: lo tiene la ficha del cliente en NexoPOS, o el celular que la
persona cargó en ClubPay.

## Qué les pedimos

Un campo más en la respuesta de `GET /v1/cuentas/:accountId?storeId=`:

```jsonc
{
  "accountId": "CLI-4231",
  "displayName": "Germán Yovan",
  "phone": "3537 41-0000",   // nuevo, opcional
  ...
}
```

De dónde sale, en este orden:

1. **El teléfono de la ficha del cliente en este comercio.** Es un dato que el
   comercio ya tiene: no le muestra a nadie nada nuevo.
2. **Si la ficha no tiene**, el celular que la persona cargó en ClubPay. Para eso
   ClubPay tendría que sumarlo a lo que les devuelve en el canje. Se lo piden ustedes:
   nosotros no le hablamos a ClubPay.
3. **Si no hay ninguno, el campo no viene** (o viene `null`). No un string vacío
   inventado. La tienda pide el teléfono, como hoy.

Y algo que lo hace funcionar sin esperar a ClubPay: con sesión, el pedido ya les llega
con `accountId` **y** `contact.phone` juntos (lo acordamos en el CR-0003). **Si la
ficha no tiene teléfono, guárdenlo ahí.** Desde el segundo pedido ya está precargado.
Si la ficha ya tiene uno y el del pedido es distinto, no lo pisen: decide el comercio.

## Lo que hace la tienda con el teléfono

- **Solo precarga el campo, y se puede editar.** Nadie lo verificó: en ClubPay el
  celular es opcional y no se valida. Es una comodidad, no una prueba de nada.
- El pedido sigue mandando el `contact.phone` que quedó escrito, que puede ser otro
  (el de la casa, el del hijo que pasa a buscar).
- No lo guardamos. Se lee de la cuenta cada vez que se abre el carrito, igual que el
  saldo.
- Si no viene, el campo aparece vacío y se pide. Nada se rompe.

## Ya está hecho de nuestro lado

El adapter ya lee `phone` y lo precarga cuando viene. Mientras no venga, el carrito
sigue como hoy. **Pueden desplegarlo cuando quieran, sin coordinar con nosotros.**

## Qué necesitamos de vuelta

- Si van a sacarlo de la ficha, de ClubPay, o de los dos.
- Si el campo se llama `phone` o de otra forma (aceptamos lo que manden: lo traduce el
  adapter).
