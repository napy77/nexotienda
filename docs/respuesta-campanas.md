# Campañas — `expectedTotalCents` está mandado

Lo del punto 4 ya viaja. En `POST /v1/orders` va ahora:

```ts
expectedTotalCents: number   // el total que la pantalla mostró al apretar el botón
```

Cuando devuelvan `priceChanged`, la pantalla del pedido lo dice. Y lo cuenta distinto
según para dónde se movió, que es lo que nos pareció que había que resolver:

- **Bajó**: una línea y nada más. "Te salió más barato: decía $17.000 y quedó en
  $12.750." Es una buena noticia y no merece un cartel de alerta.
- **Subió**: cartel, con la diferencia en pesos —"decía $32.400 y quedó en $36.900,
  $4.500 más"—, la causa probable y, mientras el pedido siga en `recibido`, que el
  comercio todavía no lo aceptó y que lo diga ahora. La persona se comprometió con un
  número y le están cobrando otro: ahí lo único honesto es mostrar la diferencia
  completa y dejar a mano la salida.

Probado en los dos sentidos.

## Lo del precio en tres lugares

Eso que cuentan —que el tercero, el del cálculo del pedido, era el fácil de olvidar y
el único que importa— es exactamente el problema. Sin él, el comprador ve la oferta en
la vidriera y le llega un pedido al precio de lista: no es un bug de números, es la
tienda mintiendo. Que la expresión del precio viva en un archivo y las tres consultas
la importen es la forma correcta, y por el mismo motivo por el que nosotros no la
multiplicamos de este lado.

## Los dos casos que resolvieron

**Gana el más grande y no se suman: sí.** "Un 50% que nadie decidió" es la frase justa.
El descuento es plata del comerciante, y la plataforma no puede inventar cuánta pone.

**Sobre el precio ya rebajado**: también bien. Y como la cinta la sacamos de los dos
precios del producto, del lado nuestro sale sola la cuenta compuesta, sin que nadie
tenga que explicarla.

## La campaña no cambia el mostrador

De acuerdo, y por el motivo que dan: cambiar lo que cobra la caja es tocar el camino
del dinero y nadie lo pidió. No inventen la opción hasta que un comerciante la pida.

Dos cosas para que estén tranquilos y una para que la tengan en el radar.

**El retiro en el local no tiene el problema.** El pedido viaja con su total, así que
el que compró online a $6.375 y va a buscarlo paga $6.375 — la caja cobra el pedido,
no la lista. El desfasaje solo existe para el que entra al mostrador sin haber pedido.

**Pero ese caso es más caro acá que en una cadena.** El pueblo es chico: el que vio
$6.375 en la tienda y paga $8.500 en el mostrador no completa una encuesta, lo cuenta.
Así que el aviso en la pantalla del comerciante no es un detalle de cortesía, es todo
el resguardo que tiene esa decisión. Si pueden, que diga la consecuencia con el número
adentro —"en el mostrador se sigue cobrando $8.500"— y no solo la regla.

## Confirmaciones cortas

- **Las fechas.** El `endsAt` a las 02:59 UTC entra bien: filtramos por instante y el
  borde del día en la zona del comercio es un instante como cualquier otro. Guardar
  días y no instantes es lo correcto — el comerciante piensa "del 1 al 15".
- **`listPriceCents` solo cuando hay descuento.** Sí, y es justo lo que necesita la
  cinta: sin precio viejo no hay porcentaje que mostrar, y tachar un precio contra sí
  mismo sería peor que no tachar nada.
- **El rubro entero que se expande a productos explícitos.** Bien resuelto, y para
  nosotros no cambia nada: seguimos recibiendo una lista de ids. Un comercio con siete
  mil productos armando una tanda de a uno no arma ninguna tanda.
