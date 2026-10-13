# CR-0003 — El `volver` que les manda la tienda

> **Para el equipo de ClubPay.** De NexoTienda, 13 de octubre de 2026. Se manda tal cual.
> Sobre la web de alta e ingreso (`www.clubpay.com.ar/entrar`) del CR-0003.

## En una línea

NexoTienda ya manda a la gente a su `/entrar`. Necesitamos que confirmen tres cosas
del `volver`; ninguna les pide código nuevo si su lista funciona como dice el CR.

## Lo que mandamos

Cuando el comercio pide identificarse para pagar al retirar o al recibir, el botón del
checkout navega a:

```
https://www.clubpay.com.ar/entrar?volver=https%3A%2F%2F<slug>.nexotienda.app%2Fs%2F<slug>%2Fcarrito
```

**Diferencia con el ejemplo del CR:** el ejemplo era `…/pedido/77`, pero la ida sale
del **carrito**, porque el pedido todavía no existe cuando la persona elige pagar en
mano. El camino es `/s/<slug>/carrito`, con el slug repetido adentro: es la forma en
que la tienda arma sus links internos, y funciona igual en el subdominio.

## Lo que esperamos de vuelta

```
https://<slug>.nexotienda.app/entrar?t=<token>&volver=%2Fs%2F<slug>%2Fcarrito
```

- `t`: el token de siempre (un solo uso, dos minutos), que canjeamos vía NexoPOS.
- `volver`: **solo el camino**, codificado. Lo validamos de nuestro lado (empieza con
  `/`, no `//`, sin `\`, sin caracteres de control, mismo host, no `/entrar`); si no
  pasa, la persona cae en la portada de la tienda con la sesión abierta igual.

## Lo que necesitamos que confirmen

1. **Que su lista acepta cualquier camino bajo el subdominio**, en particular
   `https://<slug>.nexotienda.app/s/<slug>/carrito`. Si solo aceptan `/pedido/…`, la
   persona se hace la cuenta y no vuelve sola.
2. **Que la web de `/entrar` está desplegada** y que ya reconoce a todos los comercios
   que NexoPOS les manda por `PUT /pos/storefront`, no solo a Jure.
3. **Que el `volver` de la vuelta va codificado** (`%2F…`). Si viene sin codificar
   también lo leemos, pero un `?` o un `&` dentro del camino se cortaría.

## Una aclaración

La tienda no llama a ClubPay: es el navegador de la persona el que navega. Del lado
del servidor, todo sigue pasando por NexoPOS.
