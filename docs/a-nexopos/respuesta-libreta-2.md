# La libreta: construido de este lado, y dos cosas que faltan del suyo

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Los cinco puntos consumidos y probados de punta a punta. Tenían razón en las dos
correcciones, y las dos eran de las que se asumen al revés.

---

## 1. `storeId` en el pedido: era mejor así

Lo mandamos en el `POST /v1/cuentas/canjear` y **retiramos el pedido a ClubPay** — ya
les avisamos que lo den de baja. Su solución hace que la protección salga del diseño y
no de un campo nuevo: si el token es de Jure y se canjea diciendo "tienda de Delfín",
ClubPay lo valida contra la clave de Delfín y no coincide.

Dejamos igual la comparación de nuestro lado, pero **cambiamos el comentario para que
no mienta**: ya no es la comprobación de seguridad —esa es de ustedes— es el cinturón
que atrapa una respuesta incoherente. Un comentario que dice que protege algo que ya
no protege es peor que no tenerlo.

## 2. `accountId` es `CLI-<id>`: gracias por ponerlo arriba

Es exactamente la clase de cosa que se descubre en el peor lugar. Lo dejamos escrito
en el tipo, pegado al campo, para que el próximo que lo lea no tenga que acordarse:

> El id de la libreta **en NexoPOS**, no el de ClubPay, aunque el canje pase por ahí.
> Si fuera el otro, la sesión abriría bien y el primer pedido a la libreta fallaría.

## 3. El estado: consumido, y `linkedAt` cierra sesiones de verdad

`GET /v1/cuentas/:id?storeId=` ya se llama en cada carga. La sesión dejó de tener
autoridad en serio: la cookie dice qué libreta es y nada más.

**`linkedAt` funciona y lo probamos.** Con la sesión abierta movimos el vínculo, y la
pantalla siguiente dice *"Tu libreta se cerró acá. Volvé a entrar desde ClubPay"*, con
la opción de fiado grisada en el checkout.

Un detalle de cómo lo usamos, por si les sirve: **comparamos el valor, no la fecha.**
Guardamos el `linkedAt` que había al abrir la sesión y lo comparamos contra el actual;
si son distintos, la sesión murió. Así no hay relojes de por medio ni margen que
ajustar — no importa cuánto se corrió, importa que se corrió.

Y gracias por la aclaración de que no se mueve en consultas de rutina. Si se moviera,
esto cerraría la sesión de todo el mundo cada pocos minutos, y habría sido un bug
difícil de ver porque *parecería* que funciona.

**`onlineEnabled` distinto de `paused`: ya estaba así** y coincidimos en el porqué. En
la tienda son dos mensajes distintos: *"Para seguir comprando en la libreta, hablá con
Jure"* contra *"Jure toma la libreta solo en el mostrador"*. El segundo no es un
problema de la persona.

## 4. `vinculo_ambiguo`: no lo implementamos

Convencidos, y por su argumento: una rama que nunca se ejecuta envejece mal. Si
`external_id` es el id de la fila y solo una fila está vinculada, el canje resuelve
siempre a una.

Y tienen razón en que **lo que sí puede pasar es peor**: que esté vinculada la ficha
equivocada y la persona vea $850 en vez de $27.519,20. Eso no lo arregla ningún código
de error — lo arreglan el QR del mostrador y el detector.

## 5. Dos cosas que nos faltan de su respuesta

Las dos salieron al consumir el endpoint nuevo.

### `closingDay` no viene

La tienda dice *"Cierra el 10 de cada mes"* en dos lugares. En el estado nuevo no está
ese dato.

Ya lo pusimos opcional y, **si no viene, no lo decimos** —un "cierra el 1" inventado es
de las cosas que hacen que el comerciante deje de creerle al sistema— pero se pierde
algo que hoy se muestra. ¿Puede ir en el mismo objeto?

### Los resúmenes tampoco

Esta es más grande. El estado trae saldo, límite, disponible, pausa y vínculo, pero no
la **pila de períodos** (D28), que es lo que la pantalla de libreta muestra hoy: el
período abierto arriba y los resúmenes cerrados abajo, sin sumarse nunca entre sí.

Ahora mismo esa pantalla quedaría vacía.

**Pero puede que la respuesta correcta sea que no la manden.** Está abierta la decisión
de cuánto del historial vive en la tienda y cuánto se queda en ClubPay —ustedes mismos
recomendaron "lo mínimo"—, y si la tienda solo dice "podés cargar a la libreta y tenés
tanto disponible", los resúmenes no hacen falta en ningún lado de NexoTienda.

Así que no construyan nada todavía: Germán decide y les avisamos. Lo marcamos para que
no se enteren por una pantalla en blanco.

## 6. Lo del `Referrer-Policy` y el `/salir` por POST

Cópienlo tranquilos. Los dos son bugs que no se encuentran probando: el primero no
falla nunca —simplemente el token se filtra— y el segundo aparece en producción, con
un usuario real, una vez, y cuesta días entender por qué la gente "se desloguea sola".

---

## Estado

**De nuestro lado no queda nada bloqueado.** Canje, sesión, revocación por `linkedAt`,
franja con el nombre y `/salir`: construido y probado contra datos de prueba.

Lo que falta es suyo y de ClubPay:

- El pedido del QR (ustedes → ClubPay).
- `closingDay` en el estado, si puede ser.
- Los resúmenes: **esperando la decisión de Germán, no la construyan todavía.**
