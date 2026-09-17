# NexoPOS → el catálogo grande

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Delfín tiene siete mil productos y Rivera cinco mil. Eso rompió dos cosas que
funcionaban bien con un almacén de ochenta.

De este lado ya cambiamos lo que dependía de nosotros. Esto es lo que falta del suyo,
en orden de cuánto duele.

---

## 1. El pedido grande: poder pedir un pedazo del catálogo

Hoy `GET /v1/stores/:id/products` devuelve **todo**. Para mostrar una góndola de
sesenta productos pedimos siete mil y descartamos 6.940 en el servidor.

```
GET /v1/stores/:id/products?pasillo=almacen&sub=Aceites&q=girasol&limit=60&offset=0

{ "items": [...], "total": 214 }
```

- `total` es el de la consulta, no el del catálogo: lo usamos para el "Ver más" y
  para decir "214 productos en Aceites".
- `q` busca sobre nombre, marca y subrubro, que es lo que hacemos hoy en memoria.
- **`?ids=a,b,c`** también, para traer un puñado suelto. Lo usa una estantería que
  sabe qué quiere recién en el navegador (abajo está el porqué).
- El filtro de `showsOutOfStock` sigue aplicando igual, y `total` tiene que contar
  después de filtrar: prometer 214 y entregar 180 es peor que decir 180.

Mientras tanto seguimos pidiendo todo y cortando acá. Funciona, pero es una consulta
de siete mil filas por cada góndola que alguien toca.

## 2. El árbol: nos falta el nivel del medio

Este es el que más se nota. En Delfín, tocar **Almacén** hoy escupe cuarenta y pico de
botones en una pared: "Aceites de girasol", "Aceites de maíz", "Aceites de oliva",
"Acetos, Vinagres y Limón", "Alfajores", "Arroz", "Bizcochuelos", "Bolsas
saborizadoras"…

El aceite de oliva de Delfín está en **Almacén → Aceites y aderezos → Aceites de
oliva**. Nosotros recibimos el primero y el tercero, y el del medio no existe en
ningún campo que nos llegue. Así que los tres niveles terminan aplastados en uno, y
"Aceites de oliva" queda al lado de "Alfajores" sin ninguna pista de que no son
hermanos.

**Mándennos el árbol con la profundidad que tenga:**

```ts
interface CategoryNode { name: string; children?: CategoryNode[] }

GET /v1/stores/:id/pasillos
[{ id: "almacen", name: "Almacén", children: [
    { name: "Aceites y aderezos", children: [
        { name: "Aceites de oliva" },
        { name: "Aceites de girasol" },
        { name: "Aceites de maíz" } ] },
    { name: "Alfajores" } ] }]
```

**La clave es el nombre, no un id**, porque es lo que el producto ya trae en su
`subCategory`. Meter ids obligaría a cambiar también el producto, y el nombre alcanza:
es único dentro de su rama.

Del lado nuestro ya está construido y andando: se muestra **un nivel por vez**. Tocás
Almacén y aparecen los rubros; tocás "Aceites y aderezos" y recién ahí aparecen oliva,
girasol y maíz. Si mandan una lista plana —lo de hoy— se comporta como un árbol de un
nivel y no se rompe nada. Cuando manden el árbol, aparece solo.

Tres cosas más:

**Solo dibujamos lo que tiene mercadería.** Una rama vacía ofrecida en pantalla
promete una góndola y entrega un cartel de "no hay nada": el que la toca no piensa
"qué raro, está vacío", piensa que la tienda anda mal. Manden el árbol completo del
catálogo maestro si es más fácil — lo podamos nosotros.

**Un producto puede colgar del rubro o de la hoja.** Hay comercios que clasifican
fino y otros que dejan todo en "Aceites y aderezos". Aceptamos las dos: al elegir un
rubro entran también los productos que están colgados directamente de él. No hace
falta que normalicen nada.

**Lo que hoy deducimos.** Mientras el árbol no llegue, los subrubros salen de los
`subCategory` de los productos. Funciona, pero es una deducción: si un producto tiene
el subrubro mal escrito, aparece una rama nueva en la tienda.

## 3. Lo más vendido y lo más buscado

```
GET /v1/stores/:id/highlights    (clave `catalogo`)

{ "bestSellers": ["331", "412", ...], "mostSearched": ["77", ...] }
```

Ids, no productos: el catálogo ya lo pedimos aparte. Diez de cada uno alcanza.

**Y lo importante: manden `[]` mientras no haya con qué.** Una tienda que abrió el
martes no tiene estadística de nada, y eso no es una falla — es el estado normal del
primer mes. Ya está contemplado: la portada se acomoda sola.

Más puntiagudo todavía: **no manden "los más vendidos" calculados sobre cuatro
ventas.** Pongan un piso —el que les parezca— y debajo de eso, vacío. Una lista de
cuatro productos que alguien compró una vez no es lo que más se vende; es ruido con
título de dato. Y acá se nota al instante, porque el almacenero sabe de memoria qué es
lo que más vende: una lista que diga otra cosa le enseña en dos segundos que la
pantalla inventa, y después no le cree ninguna otra.

Mientras esté vacío mostramos una muestra de la tienda **sin ponerle ese título**.

## 4. Una que no construyan

"Lo que solés llevar" ya está, y **no necesita nada de ustedes**: lo guarda el
navegador de cada persona al cerrar un pedido.

Es a propósito. El camino normal de compra es anónimo —sin cuenta, sin ClubPay—, así
que una lista atada al `accountId` funcionaría para la minoría que tiene libreta.
Atada al navegador funciona para casi todos. No viaja a ningún lado, no hay nada que
cruzar y es por comercio, como todo acá.

---

## Lo que ya cambió de este lado

- **La portada dejó de ser el catálogo entero.** Ahora son estanterías: campañas, lo
  más vendido, lo más buscado, lo que esa persona suele llevar. La grilla aparece
  cuando alguien elige una góndola o busca una palabra.
- **Se fue el chip de "Todo".** Era el que abría siete mil productos de una, y es
  justo lo que nadie va a recorrer.
- **La búsqueda se manda, no filtra mientras se tipea.** Lo que se busca está en el
  servidor.
- **El estado vive en la URL** (`?p=`, `?s=`, `?q=`): una góndola o una búsqueda se
  pueden mandar por WhatsApp.
