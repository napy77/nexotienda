# Una campaña puede quedar invisible, y el comerciante no tiene cómo enterarse

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

No es un error de nadie: es una consecuencia de dos decisiones correctas que se cruzan.
Pero la paga el comerciante, y del lado de ustedes se arregla con un cartel.

---

## Lo que pasó, con datos reales de Jure

```
Comercio 1 — showsOutOfStock: false

"Ofertas Imperdibles"            productos 5403, 5402, 5407
"Ofertas Destacadas en Bebidas"  producto  5403

El catálogo devuelve 5402 y 5407. El 5403 no.
```

Resultado en la tienda:

- **Ofertas Imperdibles** se ve, con dos tarjetas en vez de tres.
- **Ofertas Destacadas en Bebidas** **no se ve en absoluto.** Su único producto no
  está en el catálogo, así que la sección desaparece entera.

Germán armó esa campaña, la vio bien en NexoPOS, entró a la tienda y no había nada.
Tardamos un rato largo en darnos cuenta de que el sistema estaba haciendo exactamente
lo que le pedimos.

## Por qué está bien que la tienda haga eso

Las dos reglas que se cruzan son suyas y nuestras, y las dos son correctas:

- **El comerciante pidió no mostrar lo que no tiene** (`showsOutOfStock: false`). Esa
  fue una decisión suya, deliberada, y la tienda la respeta.
- **Una sección de ofertas vacía no se dibuja.** Un título con un hueco debajo se lee
  como que la tienda está rota.

No queremos cambiar ninguna de las dos. Mostrar el producto agotado contradiría lo que
el comerciante configuró; dibujar la sección vacía es peor que no dibujarla.

**El problema no es el comportamiento: es que nadie se lo cuenta al comerciante.**

## Lo que les pedimos

**Un aviso en la pantalla de campañas de NexoPOS**, que es donde él está parado cuando
la arma:

> ⚠ **Esta campaña no se está viendo en la tienda.**
> Su único producto está agotado, y tenés configurado no mostrar lo que no tenés.

Y para el caso parcial:

> **1 de 3 productos no se está viendo:** *Coca-Cola 2,25L* está agotado.

La cuenta la pueden hacer ustedes enteros y sin preguntarnos nada: son los mismos
productos que el catálogo filtra, con la misma regla —stock en cero, declarado
agotado, cupo del día terminado— más `publishedInStore`. **Es la información que ya
tienen, presentada donde hace falta.**

## Por qué vale la pena

Una campaña es trabajo: el comerciante eligió productos, puso descuentos, arrastró el
orden. Que eso no aparezca y no haya forma de saber por qué es la clase de cosa que
hace que deje de usar la función — no porque falle, sino porque **no confía en que
funcione**.

Y el caso va a ser común, no raro: se arma una tanda, algo se agota a los dos días, y
la sección se achica o desaparece sola. El comerciante tiene que poder verlo desde su
pantalla sin abrir la tienda a controlar.

## Un extra, si les sobra lugar

Avisar **al armarla**: si alguien mete en una campaña un producto que hoy está agotado,
decírselo en el momento en vez de después. Es el mismo chequeo, adelantado.

---

## De nuestro lado

Nada que cambiar: el comportamiento es el correcto. Lo que sí hicimos es un script de
diagnóstico que recorre la cadena y señala la capa exacta —incluido *por qué* falta
cada producto, distinguiendo agotado de no publicado— para no volver a perder una tarde
en esto.
