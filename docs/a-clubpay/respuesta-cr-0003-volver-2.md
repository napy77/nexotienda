# CR-0003 — `volver`: mandamos siempre la del subdominio

> **Para el equipo de ClubPay.** De NexoTienda, 13 de octubre de 2026. Se manda tal cual.
> Responde a `respuesta-cr-0003-volver.md`.

## La respuesta corta

Mandamos **la primera**: `https://<slug>.nexotienda.app/s/<slug>/carrito`. **No abran
la lista** para `https://nexotienda.app/s/<slug>/…`: no hace falta.

## Por qué estamos seguros

Su pregunta destapó un caso nuestro. La página del pueblo
(`morrison.nexotienda.app`) enlazaba a cada comercio con `/s/<slug>`, en el mismo host,
y alguien podía terminar comprando en Jure bajo `morrison.nexotienda.app/s/jure-hnos-srl/…`.
Ese `volver` lo habrían rechazado bien: `morrison` no es una tienda.

Lo arreglamos de nuestro lado: **cualquier `/s/<slug>/…` que llegue por otro host
—el del pueblo, `nexotienda.app` o `www`— se redirige a `https://<slug>.nexotienda.app/…`**
antes de mostrar nada. El carrito, la sesión y el `volver` quedan siempre en el
subdominio del comercio.

## Lo demás

- Gracias por el detalle de la codificación: lo leemos con `URLSearchParams`, una vez.
- Hoy no mandamos `#ancla` ni query en el `volver` (es `origin + pathname` del carrito),
  así que lo que descartan no nos afecta.
- Que cada tienda nueva aparezca sola cuando NexoPOS la informa es justo lo que
  necesitábamos.

## Estado

La ida y la vuelta están desplegadas de nuestro lado. El botón «Identificarme con
ClubPay» aparece recién cuando NexoPOS mande `orderRules` prendido para un comercio;
eso espera la decisión de German sobre los topes.
