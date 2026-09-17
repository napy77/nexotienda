# NexoPOS → abrir la libreta en otra pantalla

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.
>
> *Reemplaza a la versión anterior. Tenían razón con el `device`, y al corregirlo
> quedó claro que había que invertir la dirección: sus dos endpoints se vuelven uno.*

El caso: **la tienda abierta en la computadora de casa y ClubPay en el celular.** El
handoff abre la tienda *en el teléfono*, y la computadora no tiene forma de demostrar
quién es.

---

## El endpoint, que es pase de pelota

```
POST /v1/cuentas/emparejar/canjear        (clave `cuentas`)
{ "storeId": "12", "code": "VRCCX" }
→ { "token": "…" }
    ↳ se lo piden a ClubPay con la clave de ESE comercio, la que ya tienen

… y el token lo canjeamos con POST /v1/cuentas/canjear, que ya existe y ya funciona
```

**Uno solo.** Caen el pedido pendiente, el estado y el sondeo: el código lo genera la
app, la computadora lo manda, y vuelve el token o un error.

El `storeId` viaja por lo mismo que en el canje: el código no dice de qué comercio es,
y nosotros siempre lo sabemos porque esto pasa en el subdominio de ese comercio.

## Por qué se invirtió

Por lo que ustedes escribieron. Si el `device` no es prueba de nada —y no lo es, lo
escribe el atacante— la defensa entera era una frase, sobre una acción que **no tiene
ninguna defensa cultural**: *"escribí este código en tu app"* se siente como emparejar
un televisor.

Con el código naciendo en la app, el ataque necesita que la víctima **dicte** su
código. Eso lleva diez años de bancos repitiéndolo, y el aviso va en la misma pantalla
que el código, que es el momento de máxima atención.

No elimina el ataque. Lo muda a un terreno donde la gente ya está parada.

Se pierde la cookie con el `requestId` que ustedes elogiaron, y no duele: protegía de
*"que otro apruebe tu pedido"*, que no es el ataque — en el real el navegador que abrió
el pedido es el del atacante.

## Lo que ya está de este lado

La pantalla de libreta, sin sesión, ofrece un campo para el código y abre la libreta al
tipearlo. Probado contra datos de prueba de punta a punta.

Y de paso apareció un hueco que arreglamos: **en la pantalla de libreta no se podía
salir.** La franja con el nombre y el "Salir" estaba solo en la portada, así que se
podía ver la deuda de alguien en el teléfono de la casa sin ninguna forma de cerrarla
desde la pantalla donde estaba a la vista.

## Sus dos preguntas

**Cinco minutos: de acuerdo**, y el argumento es el correcto. Nosotros teníamos tres y
no defendemos el número.

**Tope de pedidos por persona: sí, y agreguen el otro** — cuántos códigos se pueden
intentar. Ese límite solo puede vivir en ClubPay: nosotros no guardamos estado, y
contar mal sería peor que no contar, porque daría la sensación de que está cubierto.
