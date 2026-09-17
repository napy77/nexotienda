# NexoPOS → Campañas

Lo que sigue ya está construido del lado de NexoTienda y andando contra fixtures: la
home muestra las secciones de ofertas, la cinta roja sobre la foto, y la página de
"ver todas". Falta el endpoint.

Mientras no exista, `listCampaigns` devuelve `[]` y la tienda se ve exactamente como
hoy. **No hay nada que coordinar para desplegar**: cuando el endpoint aparezca, las
secciones aparecen solas.

---

## 1. Qué es una campaña

Lo que el comerciante configura en el POS:

| Campo | Qué es |
|---|---|
| Nombre | "Ofertas imperdibles". Es el **título de la sección**, se muestra tal cual |
| Desde / Hasta | La ventana de vigencia |
| Descuento | El % que define la tanda |
| Productos | Cuáles entran |

Y lo que viaja:

```ts
GET /v1/stores/:storeId/campaigns      // clave `catalogo`

Campaign[] = [{
  id: string;
  storeId: string;
  name: string;              // "Ofertas imperdibles"
  startsAt?: string;         // ISO
  endsAt?: string;           // ISO
  discountPercent: number;
  productIds: string[];
}]
```

**Solo las vigentes.** Sin campañas es `[]` —no un 404—, y es el caso normal de casi
todo comercio: sin campañas no dibujamos ninguna sección, ni título ni "no hay ofertas
por ahora". Un comercio que no hace ofertas no está incompleto.

**Un solo endpoint.** No hace falta uno de "productos de la campaña": con los
`productIds` los cruzamos contra el catálogo que ya pedimos. Menos superficie para
ustedes y una llamada menos para nosotros.

## 2. Lo único importante de todo este documento

**El precio tiene que llegar con el descuento ya aplicado.**

Es decir: un producto en una campaña del 25% llega con `priceCents` = el precio con
descuento, y `listPriceCents` = el de antes. El `discountPercent` de la campaña es
**para el cartel, no para la cuenta**.

Si lo multiplicáramos nosotros, el changuito diría un número y la nota de venta otro.
Y de los dos, el que vale es el de ustedes: el precio y el stock del momento salen del
POS, como ya acordamos para los totales del pedido. Un número equivocado con autoridad
es peor que no tener número.

Esto además resuelve solo los casos raros sin que nadie tenga que decidir nada en la
pantalla:

- **Un producto en dos campañas.** El precio es uno, el que ustedes hayan resuelto.
  Aparece en las dos secciones, con el mismo precio en las dos.
- **Un producto que ya estaba rebajado y encima entra en la tanda.** Ídem.

De hecho el porcentaje de la cinta lo sacamos **de los precios del producto**, no del
de la campaña: así lo que dice la cinta y lo que dice la etiqueta no pueden
contradecirse. Probándolo con datos reales de prueba, una campaña "del 35%" mostró
18%, 19% y 20% según el producto — y eso es lo correcto, porque es lo que cada uno
efectivamente baja. El `discountPercent` queda de respaldo por si no mandan el precio
viejo.

## 3. Dos cosas que salen gratis, para que no las construyan

**No hace falta que saquen de la campaña lo que se agotó.** Si un producto no viene en
el catálogo —agotado en una tienda con `showsOutOfStock: false`— simplemente no
aparece en la fila. Si no queda ninguno, la sección entera desaparece sola. No hay que
cruzar nada ni mantener las listas sincronizadas.

**El orden en que las mandan es el orden en que se ven.** Si el comerciante quiere
"Ofertas imperdibles" arriba de "Semana de despensa", que sea el orden del arreglo.

## 4. Un caso que conviene tener pensado

Alguien carga el changuito con la promo vigente, se va a comer, vuelve a las nueve y
la campaña terminó a las ocho.

Del lado nuestro el carrito guarda el precio de cuando lo agregó, así que va a mostrar
el viejo hasta que se recargue la tienda. **El pedido va a caer con el precio de
ustedes**, que es el correcto y es lo que ya está acordado —los totales del pedido los
calculan ustedes—, y la pantalla de seguimiento muestra el total que devuelven.

O sea: no se rompe nada. Pero si en `POST /v1/orders` el total les da distinto de lo
que el comprador vio, **díganlo en la respuesta** en vez de solo corregirlo. Preferimos
avisarle "el precio cambió, ahora sale $X" a que se entere cuando lo va a pagar. Si nos
mandan el dato, la pantalla lo dice.

## 5. Para el piloto

Con nombre, fechas, descuento y productos alcanza. No hace falta imagen de campaña,
ni banner, ni orden manual dentro de la tanda: eso lo agregamos cuando algún
comerciante lo pida.
