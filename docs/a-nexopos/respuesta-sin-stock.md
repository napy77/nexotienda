# Mostrar lo que no hay — respondido

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

`showsOutOfStock` leído y en uso. Los tres puntos, en orden:

**1. No tenemos ese filtro, y nunca lo tuvimos.** No hay un "ver también los
agotados" que esconder, porque nunca escondimos nada: el agotado siempre se mostró
con su cartel —"Sin stock por ahora", "Se acabó por hoy"— que es justo el argumento
del almacén que ustedes hacen. Así que acá no hay nada que hacer.

**2. El texto de búsqueda vacía, cambiado.** Tenían razón y era más fino de lo que
parece: no es el texto lo que estaba mal, es **a quién le echa la culpa**.

Decía *"Puede que lo tenga y todavía no lo haya subido"*. Con el tilde apagado eso es
falso: el producto puede estar perfectamente cargado, y no aparece porque hoy no está
en la góndola. Eso no es un catálogo incompleto, es una decisión del comerciante, y
hacerla pasar por descuido es maltratar al que hizo bien las cosas. Ahora dice que
*el comercio muestra solo lo que tiene ahora*, que es un hecho verificable y no una
afirmación sobre lo que tiene o deja de tener (P5).

En la página del pueblo pasó lo mismo al revés: ahí había un motivo solo y ahora hay
dos, así que quedó en *"puede que algún comercio lo tenga y no lo esté mostrando"*,
que cubre los dos sin afirmar ninguno.

**3. Cacheo: ninguno, desde el primer día.** Todas las llamadas van con
`cache: 'no-store'`, con este comentario en el código desde que existe el adapter:
*"el stock cambia con cada venta del mostrador"*. No hay nada que ajustar.

## El enlace directo: no lo cambien

Coincidimos, y el motivo es más fuerte de lo que dice su documento.

Ese enlace no es una URL cualquiera: es lo que el comerciante mandó por WhatsApp, y
acá **todo viaja por WhatsApp**. Es su publicidad, la pegó en el estado, la reenviaron
cuatro personas. Un 404 mata esa conversación; un "sin stock por ahora" con el botón
de hablar con el comercio al lado la mantiene abierta, y encima le avisa al
comerciante que hay demanda de algo que no tiene. Es la misma razón por la que los
slugs viejos siguen redirigiendo para siempre.

Déjenlo como está.

## Lo único que les preguntamos

**¿`/v1/towns/:slug/search` respeta el mismo filtro?** Su documento nombra
`/products` y `/pasillos`, pero no la búsqueda del pueblo.

Si no lo respeta queda un agujero raro: alguien busca "tornillo" en la página de
Morrison, aparece que Rivera Hogar lo tiene, entra a la tienda y no está — porque el
comerciante justamente pidió no mostrar lo que no hay. La página del pueblo es un
**buscador de existencias**: si algo no debería figurar en la tienda, menos todavía
debería figurar ahí, que es donde la gente va a preguntar quién lo tiene *hoy*.

Si ya lo filtra, ignoren esto y listo.
