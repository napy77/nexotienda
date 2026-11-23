# El correo de quien compra — hecho

> **Para el equipo de NexoPOS.** De NexoTienda, 23 de noviembre de 2026. Este archivo
> se manda tal cual.
>
> Responde a `PEDIDO-EMAIL-EN-PEDIDOS-A-NEXOTIENDA.md` y a
> `RESPUESTA-TELEFONO-CON-SESION-A-NEXOTIENDA.md`.

Gracias por el teléfono: que la ficha se complete sola con el primer pedido es mejor
de lo que pedimos. De nuestro lado no había nada más que hacer: ya leíamos `phone`, y
`null` queda como campo vacío.

## Lo que contestan las preguntas

- **Lo pedimos en el carrito, opcional.** Al lado del teléfono, con el texto «Para que
  {comercio} pueda mandarte el ticket y avisarte cómo va tu pedido».
- **El campo se llama `email`**, como lo mandan, en la cuenta y en `contact.email`.

## Cómo quedó

- **Precargado** con `email` de la cuenta cuando hay sesión, y editable. `null` o
  ausente: el campo aparece vacío.
- **Va en `contact.email`** con sesión o sin ella. Si está vacío, no se manda el campo.
- **Lo validamos en el carrito** con la misma forma que ustedes (`algo@algo.algo`).
  Si no la tiene, la persona ve «Revisá el correo, parece que le falta algo. Si no
  querés dejarlo, borralo.» y lo arregla ahí. No le cerramos el paso: borrándolo,
  el pedido sale.
- **Lo mandamos como lo escribió**; ustedes lo pasan a minúsculas.
- **No lo guardamos.** Solo vive en el borrador de una hora mientras la persona va a
  identificarse a ClubPay, como el teléfono.

## Un caso que tienen que saber

**Los pedidos a la libreta no llevan `contact`**, ni ahora ni antes: el comercio ya
tiene a la persona en su ficha. O sea que un pedido a la libreta **no trae correo**.
Si el aviso de esos pedidos tiene que ir a algún lado, que vaya al correo de la ficha.

## Una cosa del texto

El campo dice «pueda mandarte el ticket», y hoy no se manda ninguno. Lo dejamos así
porque «pueda» no promete una fecha. Pero **avísennos cuando empiecen a mandar
correos**: si en algún momento el comercio puede apagarlo, el texto tiene que
cambiar, o deja de ser cierto.

## Lo que probamos

En local, con nuestros datos de prueba: con sesión, nombre, teléfono y correo
precargados; sin sesión, los tres vacíos; un correo mal escrito frena el envío con el
aviso; corregido, el pedido sale. **No probado contra su API**: espera su deploy.
Como el campo es opcional de los dos lados, pueden desplegar cuando quieran.
