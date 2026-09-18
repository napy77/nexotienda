# NexoPOS → emparejar: sus dos endpoints eran los correctos

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.
>
> *Reemplaza a las dos versiones anteriores. Perdón por el ida y vuelta: los dos
> endpoints que construyeron vuelven a ser los que van.*

## Lo que pasó, en corto

Ustedes nos mostraron que el `client_hint` no era una defensa. **De ahí sacamos una
conclusión más grande de la que correspondía**: que había que invertir la dirección del
código. Les pedimos colapsar sus dos endpoints en uno.

ClubPay lo frenó con el argumento que faltaba, y tienen razón: lo que defiende no es la
descripción del dispositivo, **es la pantalla de confirmación de la app** — y solo la
dirección original tiene una. Invertido, en el momento en que alguien dicta el código
la app no participa: no hay dónde intervenir.

Así que **no colapsen nada.** Sus dos endpoints, tal como los construyeron, son los que
van:

```
POST /v1/cuentas/emparejar                        (clave `cuentas`)
{ "storeId": "12", "clientHint": "una computadora con Chrome" }
→ { "requestId": "…", "code": "VRCCX", "expiresAt": "…" }

GET  /v1/cuentas/emparejar/:requestId?storeId=12  (clave `cuentas`)
→ { "status": "pendiente" } | { "status": "listo", "token": "…" } | { "status": "vencido" }
```

Nosotros ya revertimos y está probado de punta a punta. Si llegaron a tocar algo, es
volver atrás; si no, mejor.

## El `client_hint` viaja, y sigue sin ser prueba

Lo mandamos —"una computadora con Chrome"— y quedó escrito en nuestro código y en el
pedido a ClubPay que **no es prueba de nada**, con el motivo que ustedes dieron. Sirve
en el caso honesto. La defensa es el nombre del comercio, que ClubPay deduce de la
clave, y la pregunta.

Pasen el campo tal cual, sin agregarle nada.

## Dos números que ClubPay fijó

- **Cinco minutos** de vida del código. Nosotros teníamos tres y no lo defendíamos.
- **10 intentos cada 10 minutos por cuenta.** Ese límite es de ellos: nosotros no
  guardamos estado y contarlo mal sería peor que no contarlo.

Y su pregunta sobre el tope de pedidos por persona quedó contestada: como la app no
tiene bandeja de pendientes —la persona tiene que escribir el código— cincuenta pedidos
abiertos producen cero confirmaciones.

## Una cosa que sí les toca a ustedes: el slug

ClubPay armó el botón "Ir a la tienda" adivinando el slug, y les dio 404. El ejemplo
malo era nuestro —escribimos `jure`, que es el valor de nuestros datos de prueba,
cuando el real es `jure-hnos-srl`— y lo usamos en los documentos sin verificarlo.

**El slug tiene que llegarle a ClubPay como un dato**, en la ficha del comercio junto
al nombre y la dirección, más `storefrontPublished`. Lo elige el comerciante y no hay
ninguna regla que lo derive del nombre. Si eso sale de ustedes o de Nexo B2B, decidan
entre ustedes y avísennos.

Y la URL pública es `https://<slug>.nexotienda.app` — sin el `/s/<slug>`, que es una
reescritura interna nuestra que se nos filtró a la documentación.
