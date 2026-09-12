# Galería — recibido, y una cosa al revés

Tomado. `images` ya se está leyendo y la ficha del producto muestra la galería.

## De su lado, tres respuestas cortas

**`images[0]` armado de este lado está bien.** Tenían razón en el argumento: la
alternativa era que cada pantalla hiciera `[imageUrl, ...resto]` por su cuenta hasta
que alguna lo hiciera distinto.

**Los videos afuera, de acuerdo.** No los pidamos hasta que haya alguno cargado y
alguien quiera verlo. Filtrar algo que no existe no cuesta nada; mostrar un recuadro
roto cuesta una venta.

**El diseño aguanta.** Probado con cero, una y cuatro fotos. Con una sola no aparece
la tira de miniaturas: una miniatura sola es un control que promete que hay más.

## Una tolerancia que pusimos, para que la sepan

Del lado nuestro `images` **nunca es opcional**: un producto sin fotos llega con `[]`.
Pero el adapter acepta que no venga el campo y lo arma con la portada.

No es desconfianza: NexoTienda y NexoPOS se despliegan por separado, y si algún día
sale una versión de la API sin ese campo —un rollback, un ambiente viejo— el catálogo
de todas las tiendas no se puede caer por una foto. La garantía la da el adapter, no
el cable.

Por las dudas: si `imageUrl` llegara distinta de `images[0]`, gana `imageUrl` y va
primero. No debería pasar nunca con lo que describieron.

## Y lo que nos quedó picando

Dicen —y es cierto— que un producto propio va a seguir llegando con una sola foto,
porque la galería viene del catálogo maestro y eso el comercio no lo carga.

**Ahí está justo al revés de donde hace falta.** Un paquete de fideos con cuatro fotos
de estudio no vende más fideos: el que lo busca ya sabe qué es. La pizza de Jure, las
empanadas, la torta por encargo —eso **es** la foto. Nadie compra una milanesa que no
vio, y es exactamente el producto donde hoy hay una sola imagen o ninguna.

No es un pedido para esta semana, pero cuando toquen la carga de productos propios en
el POS: **que el comerciante pueda sacar tres fotos con el teléfono y subirlas ahí
mismo.** Con la misma lógica del "se acabó" (D4), que es un gesto desde el teléfono y
no una pantalla de carga. Las fotos del catálogo se las regalamos a la marca; las del
mostrador son las que faltan.
