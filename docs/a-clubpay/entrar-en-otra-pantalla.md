# ClubPay → abrir la libreta en la computadora

> **Para el equipo de ClubPay.** Este archivo se manda tal cual.

Apareció probando: **la tienda abierta en la computadora de casa y ClubPay en el
celular.** El handoff que armamos no sirve ahí —abre la tienda *en el teléfono*— y la
computadora no tiene forma de demostrar quién es.

Hoy, en esa situación, la libreta no se puede usar. Se puede comprar pagando al
recibirlo, nada más.

---

## Lo que proponemos: un código corto, no un QR

Sabemos que el QR estaba sobre la mesa, y que ustedes avisaron que la cámara hoy solo
sirve para cobrar. **Con un código de cinco caracteres no hace falta cámara.** Y hay
una razón mejor que la del costo:

**Un código que hay que leer de tu propia pantalla no se reenvía por WhatsApp.** Una
imagen de QR sí. Para tipear estas cinco letras hay que estar mirando esa computadora.

El QR queda como mejora para después, sobre el mismo mecanismo: sería el mismo pedido,
mostrado de otra forma.

## El circuito

```
1. La compu pide un código    NexoTienda → NexoPOS → ClubPay
                              → { requestId, code: "VRCCX", expiresAt }

2. La persona lee "VRCCX" en la pantalla grande

3. En el teléfono             ClubPay → Mis comercios → Jure Hnos SRL
                              → "Entrar en otra pantalla" → escribe VRCCX → confirma

4. La compu pregunta cada 3s  NexoTienda → NexoPOS → ClubPay
                              → { status: "listo", token: "…" }

5. Se canja                   el MISMO token de un solo uso del handoff que ya existe
```

**El paso 5 es a propósito.** Termina en el canje que ya construimos y ya probamos: una
segunda forma de abrir sesión sería una segunda superficie que auditar, y esta es la
parte del sistema donde eso menos conviene.

De este lado ya está todo construido y andando contra datos de prueba: la pantalla
pide el código, lo muestra, espera, y cuando se aprueba la libreta se abre sola.

## Lo que les toca

**Una pantalla nueva en la app**: "Entrar en otra pantalla", dentro del comercio en Mis
comercios. Un campo para el código y una confirmación.

**Dos endpoints**, que NexoPOS les va a llamar (nosotros no hablamos con ustedes
directo, por lo mismo de siempre: no tenemos ni podemos tener la clave de cada
comercio):

```
POST  …/emparejar            { storeId }        → { requestId, code, expiresAt }
GET   …/emparejar/:requestId                    → { status: "pendiente" }
                                                | { status: "listo", token }
                                                | { status: "vencido" }
POST  …/emparejar/aprobar    { code }           ← lo llama la app, con la sesión de la persona
```

El `token` de "listo" es exactamente el mismo que emite hoy
`POST /me/merchants/:vinculacion_id/tienda`. No hace falta uno nuevo.

## La parte delicada, que es la pantalla de confirmación

Este mecanismo tiene un ataque, y **toda la defensa está en cómo esté redactada esa
pantalla**.

No es que alguien le robe el código a la víctima: el código aparece en la pantalla del
que lo pidió. **El ataque es al revés** — el atacante abre el pedido en *su* compu y
convence a la víctima de que escriba *ese* código en *su* ClubPay. Si la víctima
confirma, la libreta se abre en la computadora del atacante.

Así que la pantalla no puede decir "¿Confirmás?". Tiene que decir qué está pasando:

> **Alguien está abriendo tu libreta de Jure Hnos SRL en otra pantalla.**
> Si no sos vos, no confirmes. Nadie de Jure ni de ClubPay te va a pedir este código.

Y si pueden, **algo de quién lo pidió**: "en una computadora con Chrome". Se lo podemos
mandar en el pedido —es lo que dice el navegador de sí mismo, sin nada personal— y
convierte una confirmación a ciegas en una que se puede contrastar.

Tres cosas más, cortas:

- **Tres minutos de vida** y un solo uso, como el token.
- **Límite de intentos por cuenta.** Cinco caracteres alcanzan si no se puede probar
  mil veces.
- **Sin vocales en el alfabeto del código**, para que no se arme ninguna palabra sola y
  para no confundir 0 con O. Nosotros usamos `34679BCDFGHJKLMNPQRSTVWXZ`; si el código
  lo generan ustedes, va de sugerencia.

## Una que ya hicimos y no necesitan

El `requestId` **no vuelve al navegador**: queda en una cookie `httpOnly` de la
computadora que lo pidió. Aunque alguien apruebe un pedido que no es suyo, **solo el
navegador que lo abrió puede canjearlo**. No hace falta que hagan nada con eso, pero
conviene que lo sepan al pensar los bordes.
