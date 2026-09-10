# NexoTienda → NexoPOS: aceptado, y las cuatro decisiones

Respuesta a `RESPUESTA-A-NEXOTIENDA.md`. Tres bloques: **lo que aceptamos y ya
refactorizamos**, **las cuatro decisiones que pidieron**, y **una cosa que nos
faltaba a nosotros**.

---

# 1. Lo que aceptamos

## 1.1 `GET /v1/people/{personId}` — tienen razón, y el argumento es mejor que el nuestro

Aceptado. Lo que nos convenció no fue que no puedan emitir el id: fue esto.

> *«Hoy que un comercio no vea la deuda de un cliente con otro no es un permiso que
> podamos equivocar: los datos no están juntos.»*

Nuestro endpoint cambiaba una **imposibilidad estructural** por un **chequeo de
permisos**. Aunque no viole P3 hoy, empeora la garantía: un permiso se puede
configurar mal, un join no existe. Eso es peor aunque el resultado inmediato sea el
mismo.

Ya está implementado `GET /v1/stores/{storeId}/accounts/{accountId}` y **borramos
`Person` del contrato**. NexoTienda nunca pide "todas las cuentas de esta persona".

## 1.2 `account_id` en vez de `person_id` — y era un agujero nuestro

Aceptado, y el argumento de ClubPay es el que nos faltaba: un id estable por persona
compartido entre comercios **les permite cruzar sus listas y descubrir que es el
mismo cliente**. Hoy no pueden.

O sea que nuestro `person_id` habilitaba exactamente lo que P3 prohíbe, entrando por
la puerta de atrás. Lo escribimos nosotros en el prompt y no lo vimos.

`MerchantAccount.accountId` es ahora el id de la **relación**, y en el código está
escrito por qué, para que a nadie se le ocurra "unificarlo" más adelante.

## 1.2b La identidad no viaja en la URL

Aceptado. No construimos la sesión asumiendo un id en la query string.

Hay un `src/lib/session.ts` con `getAccountId(storeSlug)` que hoy lee una cookie
puesta a mano para poder probar, y un `/vincular` que **solo existe en desarrollo**.
Cuando exista el canje, se reemplaza esa única función. Nada más del código sabe de
dónde sale el `accountId`.

## 1.2 (bis) `availableCents: number | null` — el mejor catch de los cinco

Aceptado, y nos cambió la interfaz en tres lugares.

Teníamos asumido que siempre hay límite. Que **sin límite sea el default y el caso
más común** es un dato del negocio que no teníamos, y tienen razón en el porqué:
ponerle tope a todo el mundo el día que se enciende esto sería cambiarle las reglas
a relaciones que ya existen.

Implementado como sugirieron: cuando es `null`, **la línea no se muestra**. Ni
"$0", que sería al revés de la verdad, ni "sin límite", que suena a premio.

## 1.3 Los cuatro estados grisados

Implementado, cada uno con su mensaje, en `src/lib/credit.ts`. Y **no escondemos el
botón**: se ve, grisado, con el motivo, y con el botón de contacto al lado en los
dos casos donde la salida es hablar con una persona.

| Situación | Lo que dice |
|---|---|
| Sin cuenta (404) | "Para comprar en la libreta, hablá con {comercio}. Se abre en el mostrador." + contacto |
| `!onlineCreditEnabled` | "{comercio} toma la libreta solo en el mostrador." |
| `creditPaused` | "Para seguir comprando en la libreta, hablá con {comercio}." + contacto |
| Sin disponible | "Este pedido supera tu disponible. Podés pagarlo de otra forma." |

`onlineCreditEnabled` arranca apagado, como pidieron.

## 1.4 `statement_id` y el `label`

Renombrado en todo el código: `AccountStatement.statementId`. El `label` se muestra
**tal cual viene** y hay un comentario en el tipo explicando por qué no se reescribe
a nombre de mes. En los fixtures Súper SOL cierra el 10 y su resumen se llama
"11/07 al 10/08", justamente para que nadie lo "arregle" a "agosto".

## 1.4b Pagar con importe libre

Aceptado. **NexoTienda ya no elige qué resumen se paga**: manda un monto contra la
cuenta y ustedes lo imputan del más viejo al más nuevo. Es más correcto que lo que
teníamos — la imputación es del libro, no de la vidriera.

La pantalla muestra la pila de resúmenes (viene de ustedes) y un solo cobro por
importe libre, con el total adeudado precargado y editable. El aviso de pago parcial
dice "se imputa a lo más viejo primero".

## 1.5 Fechas

Ya estaba arreglado de nuestro lado antes de que lo escribieran: `src/lib/format.ts`
arma las fechas sin hora como locales a mano en vez de pasarlas por `new Date()`.

---

# 2. Las cuatro decisiones

## 2.1 Credenciales: de acuerdo, dos claves

**Aceptado, y con el mismo argumento que le dieron a ClubPay.** Una clave de
plataforma que puede leer y escribir la cuenta corriente de cualquier comercio
concentra un daño del tamaño del ecosistema. Que la libreta de una persona viaje con
la misma llave que el buscador del pueblo no cierra.

Ya está implementado en `src/lib/nexopos/client.ts`. El corte que proponemos:

| Clave | Endpoints |
|---|---|
| **Plataforma** | `/v1/hosts/{sub}`, `/v1/towns/*`, `/v1/stores/{slug}` (la ficha pública), `/v1/orders/{code}` |
| **Del comercio** | `/v1/stores/{storeId}/*` — catálogo, stock, cuentas, resúmenes, pagos — y `POST /v1/orders` |

Dos notas sobre el corte:

- **`GET /v1/stores/{slug}` lo dejamos en plataforma**: es la ficha pública que ve
  cualquiera al entrar al subdominio, y necesitamos resolverla antes de saber de qué
  comercio se trata. Si les parece que ahí va dato sensible, díganlo y lo partimos en
  ficha pública y ficha completa.
- **`GET /v1/orders/{code}`** hoy lo llamamos con la clave de plataforma porque la
  página del pedido se abre desde un link sin sesión. Si prefieren que vaya con la
  del comercio, necesitamos el `storeId` en el código del pedido o un endpoint
  anidado. Nos da igual; elijan.

Cómo resolvemos la clave de cada comercio cuando sean varios queda por definir —
hoy sale de env para el piloto.

## 2.2 `entries[]`: sí, pero no anidado

**Los necesitamos.** Sin los movimientos, un resumen es un número y no un documento,
y **no se puede disputar** — que es la mitad de para qué existe el cierre (D27). La
persona que va a pagar $33.100 tiene derecho a ver de dónde salen.

Pero **no hace falta que vengan anidados en el listado**, que es lo caro. Alcanza con
un endpoint aparte que pedimos cuando la persona abre el resumen:

```
GET /v1/stores/{storeId}/accounts/{accountId}/statements/{statementId}/entries
```

Ya está así en el cliente y en los fixtures. Si el listado nunca los trae, no
cambiamos nada.

Mientras no exista, la pantalla dice *"No pudimos traer el detalle de este resumen,
consultalo con {comercio}"* — no muestra un resumen vacío como si no tuviera
movimientos (P5).

## 2.3 Vencimiento del pedido: 30 minutos, con una excepción

Proponemos **30 minutos, configurable por comercio**, con un default distinto según
el rubro si les resulta fácil: una rotisería a las 21 puede querer 15, un almacén con
reparto programado tolera 60.

**La excepción importa más que el número: un pedido que entra fuera del horario de
atención no vence.** Espera a que el comercio abra y ahí arranca el reloj. Si alguien
pide a las 23:30 para el día siguiente y se lo cancelamos a las 00:00, cancelamos por
una regla nuestra un pedido que nadie abandonó.

Y cuando vence, que el mensaje sea una disculpa del sistema y no un reproche al
comercio. El comprador no tiene por qué enterarse de que alguien no miró la pantalla.

## 2.4 WhatsApp Business API

No es nuestra decisión: la cuenta la tiene que abrir Linware y hay que hacer la
cuenta del costo por conversación. Queda para Germán.

Lo único que agregamos desde el producto: **no lo traten como un parche transitorio
hacia una app del comerciante.** El tipo ya vive en WhatsApp y le va a contestar al
vecino por ahí igual.

---

# 3. Lo que nos faltaba a nosotros

Nos hicieron notar algo sin decirlo, en 1.1: *«No existe que alguien entre a la
tienda de SuperSOL, cargue el changuito y elija cuenta corriente sin acuerdo previo:
esa opción está grisada.»*

Teníamos el checkout demasiado centrado en la libreta, como si fuera la forma normal
de comprar. **No lo es, y no va a serlo.** Alguien entra, compra dos paquetes de
harina y paga al recibirlos: eso va a ser la enorme mayoría de las ventas y no
necesita cuenta, ni ClubPay, ni identificarse.

Ya está corregido:

- El **comprador anónimo es el camino principal**. La forma de pago que viene
  seleccionada es siempre la primera que acepta el comercio, nunca la libreta.
- Como no sabemos quién es, le pedimos **nombre y teléfono** — el comercio necesita
  poder avisarle que está listo. Es lo único que pedimos.
- La libreta aparece grisada con su motivo, como quedó arriba.

Una consecuencia para el contrato: **`Order` puede no tener `accountId`**, y en su
lugar lleva `contact: { name, phone }`. Si en `POST /v1/orders` ustedes hoy asumen
que siempre hay cliente identificado, hay que aflojarlo.

---

# 4. Dos cosas que confirmamos de su lado

**El corte del cupo comparando fechas en vez de una tarea a las 00:00** nos parece
mejor que lo que hubiéramos hecho nosotros. Una tarea que no corre porque el servidor
estaba caído deja la tienda en cero y pareciendo cerrada, y nadie se entera hasta que
un cliente pregunta.

**Que no exista la columna de NexoRider** es la misma disciplina que P5 aplicada a la
base de datos. Una columna que se puede poner en `true` promete un reparto que no
existe. Lo vamos a mostrar como bloqueado con su motivo.

---

# 5. Lo que sigue bloqueado de nuestro lado

Nada. NexoTienda corre hoy contra fixtures con el contrato ya actualizado a todo lo
de arriba: catálogo con disponibilidad, carrito, checkout anónimo y con libreta,
pedido con su estado, cobro por el rail, y la libreta con su pila de resúmenes.

Cuando la API exista se setean `NEXOPOS_API_URL`, `NEXOPOS_PLATFORM_KEY` y la clave
del comercio, y el adapter cambia solo.
