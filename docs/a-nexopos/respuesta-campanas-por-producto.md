# Campañas por producto: consumido, y uno de los dos era un número que mentía

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Los dos puntos tomados. El primero no era opcional de nuestro lado: **teníamos el
techo de la campaña usado como si fuera el descuento de un producto.**

---

## 1. El `discountPercent` como respaldo estaba mal, y ahora se nota

La cinta de cada tarjeta salía de los precios del producto —eso estaba bien y sigue
igual— **pero con un respaldo**: si un producto no traía `listPriceCents`, le
poníamos el porcentaje de la campaña.

Con el modelo viejo eso casi nunca se notaba, porque el porcentaje de la campaña era
el de todos. Con el nuevo es una mentira directa: **le pegaría "hasta 41%" a un
producto que no tiene descuento ninguno.**

El respaldo se fue. Ahora la regla es una sola línea: la cinta sale de los precios del
producto, y **si no hay precio viejo no hay cinta**. Que un producto de la tanda no
tenga rebaja es información, no un dato faltante que haya que rellenar.

Dejamos uno así en los datos de prueba a propósito —un fernet sin precio viejo, en el
medio de una campaña— para que el caso se pueda mirar y no se vuelva a colar.

## 2. El techo, con "hasta", en dos lugares

Antes no lo mostrábamos en ningún lado. Ahora sí, porque con la palabra adelante es
verdad y es útil:

- En el título de la sección: **Semana de despensa · `hasta 19%`**
- En la página de la campaña: *"4 productos en Súper SOL, con descuentos de hasta 19%"*

Y en ningún otro lugar. En particular, nunca sobre un producto.

## 3. El orden: no lo tocábamos, y ahora está escrito por qué

No lo reordenábamos —la fila y la grilla recorren `productIds` tal cual— pero eso era
por cómo salió el código, no por una decisión. Ahora está en los comentarios de los dos
componentes, con el motivo que ustedes dieron: **la fila muestra los primeros, así que
el orden decide qué se ve sin tocar "Ver todas"**. Ordenarlo de nuestro lado le borraría
al comerciante una decisión que acaba de tomar arrastrando.

Los datos de prueba ahora traen una campaña con el orden deliberadamente distinto del
alfabético, para que si alguien lo rompe se vea.

## Lo demás

Lo del precio fijo no nos cambia nada, y es por la decisión de la primera tanda: **el
precio llega aplicado**. Un 30% y un precio fijo de $4.000 llegan igual —`priceCents` y
`listPriceCents`— y la pantalla no tiene que saber cuál de los dos configuró el
comerciante. Esa es la prueba de que esa decisión era la correcta: cambiaron el modelo
entero de campañas y de este lado no hubo que tocar el precio.

Que una campaña solo pueda bajar el precio, y que un producto en dos pague el más bajo,
nos llegan resueltos. Nada que hacer.

---

## Estado

Consumido, probado y desplegado. Verificado con una campaña de cuatro productos donde
uno no tiene descuento: tres cintas con tres números distintos y una tarjeta sin cinta.
