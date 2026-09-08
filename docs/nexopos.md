# Prompt para el equipo de NexoPOS

## Rol

Sos quien va a construir el lado de **NexoPOS** para que funcione NexoTienda: la
tienda online del comerciante. Dos cosas: **funcionalidad nueva dentro del POS** y
**una API** que consumen NexoTienda y ClubPay.

Todo el contexto necesario está acá. Las decisiones de abajo se tomaron en el diseño
del producto y **no son sugerencias**: varias existen para evitar problemas concretos
que ya identificamos. Si alguna choca con cómo está armado NexoPOS hoy, **decilo antes
de construir** en vez de improvisar una salida.

---

## El ecosistema, en cinco líneas

- **Nexo B2B** — marketplace mayorista. Tiene el catálogo maestro (EAN, nombre, foto,
  marca, IVA).
- **NexoPOS** — el punto de venta del comercio. Vende en el mostrador, compra
  reposición, y **lleva la cuenta corriente de sus clientes** (el fiado, hoy en un
  cuaderno). Es la fuente de verdad del stock y de la libreta.
- **NexoTienda** — la tienda online del comercio, en `{slug}.nexotienda.app`, y la
  página del pueblo en `{pueblo}.nexotienda.app`. Ya está construida y corre contra
  fixtures esperando esta API.
- **ClubPay** — la billetera del comprador. Ahí vive su identidad, su libreta y su
  medio de pago. **El comprador no instala una app nueva.**
- El comprador final navega la tienda por web, y la relación (libreta, pagos,
  notificaciones) la ve en ClubPay.

---

## Las seis reglas que no se pueden violar

Estas no son preferencias de diseño. Un POS naturalmente construiría varias de las
cosas prohibidas de abajo, porque desde adentro del POS suenan razonables.

**P1 — Libro y riel, no balance.** Nexo no presta, no adelanta y no garantiza. El
acreedor es siempre el comercio, con su plata y su riesgo. Nosotros registramos y
transportamos el pago. La plata va directo del comprador a la cuenta de Mercado Pago
**del comercio**; nunca pasa por una cuenta de Nexo.

**P2 — No somos cobradores.** El sistema notifica hechos. A quién se le fía, cuánto,
hasta cuándo y qué pasa si no paga **lo decide el comercio**. Nada de avisos de mora,
recordatorios escalados ni marcar a nadie como moroso.

**P3 — La vista agregada es del deudor, no de los acreedores.** El comprador puede ver
todo lo que debe en el pueblo, porque son sus datos. **Ningún comercio puede ver la
deuda de un cliente con otro comercio.** Los comerciantes lo van a pedir —"decime si
este tipo debe en otro lado antes de fiarle"— y va a sonar razonable. La respuesta es
no. El día que lo crucemos somos el Veraz del pueblo y perdemos a los compradores.

**P4 — Describir no es calificar.** Se le puede mostrar al comerciante el historial de
su propio cliente con él: *"pagó 6 de 6 cierres, en promedio el día 9"*. Eso es un
hecho de sus datos y lo ayuda a decidir. **No** se emiten puntajes, scorings ni
recomendaciones de riesgo — eso decide por él.

**P5 — No afirmar lo que no se puede respaldar.** Si un dato no está, se dice que no
está. No se rellena con supuestos ni con ceros.

**P6 — Un número equivocado con autoridad es peor que no tener número.** Si el stock
miente en un rincón, el comerciante deja de creerle al módulo entero, incluida la
parte donde somos exactos.

---

# Parte A — Lo que NexoPOS tiene que construir

## A1. Disponibilidad: una política por producto, no dos tipos de producto

Hoy todo producto tiene stock. Eso funciona para lo que se compra hecho y **no
funciona para lo que el comercio hace**: la pizza, el pan, la milanesa, la copia de
llave del ferretero.

Cada producto se controla de una de dos formas:

| Política | Para qué | Cómo funciona |
|---|---|---|
| `stock` | Lo que se compra hecho | Inventario real. El POS lo sabe porque registra las ventas. |
| `declared` | Lo que el comercio **hace** | Una declaración del comercio. **No descuenta insumos.** |

**El default lo da el origen**: producto que viene del catálogo de Nexo B2B → `stock`.
Producto que creó el comercio → `declared`. **Y el comerciante lo puede dar vuelta**,
porque hay casos cruzados: la panadera que envasa su dulce de leche en frascos tiene
doce frascos reales, y eso es inventario aunque sea producto propio.

Importante: **es una política sobre el mismo producto, no dos tipos de producto.** Si
el comerciante tiene que elegir qué clase de producto está creando, se equivoca.

### Por qué la pizza no descuenta queso

Es la pregunta que va a aparecer, así que la contesto de entrada.

El consumo de cocina es estocástico y una receta lo modela como determinístico: cambia
la marca de jamón, el cocinero usa más queso hoy, se queman dos, el pibe se comió una,
a la noche tiran lo que sobró. La deriva no es un bug, es la naturaleza del asunto. Y
cuando el comerciante ve que el sistema dice 8 kg de queso y en la heladera hay 3,
**deja de creerle al módulo de stock entero** — incluidos los 600 productos canónicos
donde el POS es infalible. Perdemos lo que funciona para sostener lo que nunca iba a
funcionar (P6).

Además, el dato no hace falta: el cocinero abre la heladera y ve. El software agrega
valor donde no podés ver —600 SKUs en góndola—, no en la cocina.

### Los tres estados de `declared`

| Estado | Para qué | Se repone |
|---|---|---|
| Disponible | Empanadas a demanda, copia de llave. Sin contador. | Con el horario de la tienda |
| Cupo del día | "Hoy hago 20 pizzas". Baja con cada pedido. | **Solo, todos los días** |
| Agotado | Se acabó la milanesa a las 14. | Manual |

**El cupo se tiene que reponer solo.** Si el comerciante tiene que resetearlo cada
mañana, a la semana está en cero permanente y la tienda parece cerrada.

### La regla que define si esto vive o muere

**Marcar "se acabó" tiene que costar un gesto desde el teléfono.**

El tipo tiene las manos en la masa. Si son cuatro pantallas de configuración no lo
hace, alguien pide una milanesa que no existe, el comerciante queda mal con su vecino,
y apaga la tienda. Es el modo de falla número uno de toda la pata de comidas y **no lo
resuelve el modelo de datos**: lo resuelve que ese botón esté a un toque.

## A2. La receta existe, pero como calculadora de costo

El comerciante puede declarar de qué está compuesta su pizza para saber cuánto le
cuesta y qué margen tiene, con los últimos precios de compra. **Esa composición nunca
mueve stock.** Si no la carga, pone el costo a mano y sigue.

Es la misma receta de siempre; cambia dónde se conecta. El costo de una pizza no es una
necesidad en tiempo real: se calcula cuando se pone el precio y se recalcula cuando se
fue el tomate a las nubes. Eso es una calculadora, no un motor de inventario.

## A3. El insumo se marca como insumo

Los 20 kg de queso que el pizzero compró por B2B entran al stock y nunca salen por una
venta, así que el número solo crece y ensucia el reporte.

Un flag —**"esto lo compro para usar, no para vender"**— y deja de contaminar: entra
por su costo, alimenta el costeo, no aparece en góndola ni en la tienda online.

## A4. Para insumos, la señal de reposición es la cadencia, no el nivel

Si la pizza no descuenta harina, la harina nunca dispara alerta de stock bajo y el loop
de reposición hacia Nexo B2B se rompe justo en los insumos. Se arregla cambiando la
señal:

> *"Hace 12 días que no comprás harina, tu promedio es cada 7."*

Sale del historial de compras, funciona desde el día uno sin una sola receta, y es más
fiel a cómo compra un pizzero: no compra cuando se le acaba, compra los martes.

Para insumos, la cadencia es mejor señal que el nivel de stock **incluso si tuvieras la
receta perfecta**.

## A5. Cuenta corriente

Esta es la parte más delicada. Lo que estamos digitalizando no es una deuda, es una
relación: el fiado de pueblo funciona por vergüenza y proximidad, no por contrato. El
almacenero sabe que Juan cobra el 10 y lo espera. **Esa flexibilidad es el producto.**
El riesgo es que la rigidez del software mate la elasticidad social.

La app tiene que darle al comerciante **más instrumentos de flexibilidad, no menos**. Si
no los tiene, es peor que el cuaderno.

### El alta es física

La cuenta se crea **en el mostrador, en NexoPOS, con DNI**. La app nunca otorga
crédito: la cuenta digital es el reflejo de una decisión que se tomó cara a cara, con
el documento en la mano. Nosotros no scoreamos, no aprobamos, no intervenimos.

**Y tiene que funcionar igual sin app.** El cliente sin ClubPay es el caso normal, no el
borde: la enorme mayoría de los que compran fiado no van a tener la app el primer año.
La libreta del comerciante está completa con o sin vinculación.

### El DNI enlaza, pero no revela

En el mostrador se van a tipear DNIs mal — es garantizado. Un dígito de más y o no
matchea con nadie, o matchea con **la persona equivocada**, y ahí alguien abre ClubPay
y ve la deuda de otro. En un pueblo eso no es un bug, es un incidente que no se
desanda.

Por eso el match **propone**, no muestra:

> *"SuperSOL dice que tenés cuenta corriente con ellos. ¿Es tuya?"*

El saldo aparece **después** del toque del cliente. Y el comerciante recibe el aviso de
que se vinculó, así que un match equivocado se detecta enseguida. Hacen falta dos manos.

**El DNI no puede ser el identificador del sistema.** Se usa una vez para proponer la
vinculación; de ahí en más se trabaja con un `person_id` opaco. El DNI es dato personal
y no puede terminar en una URL, en un log ni en el `Referer` de un request.

### El cierre congela un período

El cierre **emite un resumen**: un documento estable, pagable, disputable y auditable.
No es una suma que se mueve todo el tiempo. Es lo que hace que el resumen de una
tarjeta sea entendible por cualquiera.

**La fecha de cierre es configurable por comercio**, y eventualmente por cliente. Hay
pueblos que cierran el 10 porque ahí cobra la gente. El 31 fijo se rompe en la calle.

### No hay "una deuda": hay una pila de períodos

Si Juan no paga agosto y cierra septiembre, tiene **dos resúmenes cerrados más el
período abierto**, cada uno con su propio estado. El consumo del mes en curso **nunca**
se mezcla ni se suma con los resúmenes cerrados.

Y hay que decirlo explícito porque es donde más se resbala: **no existe ni puede existir
un objeto que sume las deudas de dos comercios distintos.** Cada comercio es el acreedor
de su propia cuenta. Sumarlas haría que el acreedor sea Nexo, y un pago único habría que
repartirlo entre dos Mercado Pago distintos. Eso es exactamente lo que P1 prohíbe.

### La ficha del cliente muestra antigüedad, no un total

El cuaderno le daba al comerciante algo que la app puede perder: **él sabía**. Sabía que
Juan venía atrasado dos meses porque lo vivía. Si le mostramos un número solo, le
sacamos la información y le dejamos la responsabilidad.

$87.000 acumulados este mes es un buen cliente con familia grande. $87.000 de hace tres
meses es un problema. **Mismo número, significados opuestos.**

Los períodos van apilados, el más viejo arriba, el corriente aparte. Y se le puede
mostrar el ritmo —*"pagó los últimos 6 cierres, en promedio el día 9"*— que es un hecho
de sus propios datos con su propio cliente. Eso sí; un puntaje no (P4).

### El resto de las reglas de la libreta

- **Pago parcial permitido**, imputado del período más viejo al más nuevo, **con
  override del comerciante** — a veces dice "no, dejá, esto es lo de este mes". Lo que
  no hacemos es que elija el comprador: eso no existe en el cuaderno y genera
  discusiones.
- **Límite por cliente, requisito de v1.** El mostrador y la cara del almacenero eran el
  control de riesgo del fiado; comprando desde el sillón ese freno no existe. El límite
  lo pone el comerciante, no nosotros.
- **Se muestra "Disponible", nunca "tu límite".** Mismo dato, distinto objeto social:
  uno es un saldo, el otro es una calificación. En un pueblo donde Juan se entera de que
  tiene 20 y su primo tiene 80, la segunda versión trae un problema que no necesitamos.
- **Flag "cuenta corriente solo en el mostrador"**, para el comerciante conservador que
  quiere entrar sin abrir de una la compra fiada desde casa.
- **Pausar el fiado no bloquea la venta.** El cliente puede seguir comprando pagando de
  otra forma. Se pausó el crédito, no el comercio. Si además le cortamos la compra, el
  comerciante pierde la venta de hoy por una deuda de julio, que es justo lo que ningún
  almacenero haría.
- **Decidir tiene que costar un toque.** Un switch en la ficha del cliente. Como mucho,
  una sugerencia que él confirma: *"Juan tiene 2 cierres impagos, ¿querés pausarle la
  cuenta?"*. **Nunca automática.**

## A6. El pedido

### La notificación no es una aceptación

El modo de falla real no es "el comerciante no se entera". Es **"se enteró, no hizo
nada en 40 minutos, y el que pidió no sabe si va o no va"**. Lo que mata el producto es
la ansiedad, no la demora: nadie se enoja porque tarde una hora si se lo dijeron.

El pedido nace en `recibido`. Que le llegue al comercio no es que lo haya aceptado. Los
estados son: `recibido → aceptado → listo → en_camino → entregado`.

**El tiempo estimado lo declara el comercio al aceptar. La plataforma nunca promete un
tiempo.** El prototipo de diseño decía "retiro en 15 minutos" y lo sacamos: es una
promesa nuestra sobre el trabajo de otro, y el día que hay cola quedamos mal los dos.

### El pedido vence — falta construirlo

Si nadie lo acepta en N minutos, **se cancela solo con una disculpa**. Perder el pedido
honestamente es mucho más barato que dejar a alguien esperando algo que no viene.

Hay que definir cuántos minutos y si es configurable por comercio.

### Cómo se entera el comercio — falta construirlo

Hoy el pedido llega a la pantalla del POS. Falta decidir el canal adicional: mail,
WhatsApp a un número declarado, o push.

Un apunte: **WhatsApp puede no ser un parche transitorio sino la respuesta buena.** El
comerciante ya vive ahí y le va a contestar al vecino por ahí igual. La letra chica es
que mandarlo programáticamente es WhatsApp Business API, con plantillas y costo por
conversación — es una cuenta a hacer, no un obstáculo.

Y una buena noticia sobre la interrupción del mostrador, que es el miedo obvio: la
urgencia y la capacidad de atender están correlacionadas al revés de lo que parece. El
almacén es donde el mostrador gana siempre, y es justo donde la urgencia es baja porque
el pedido de aceite y papel higiénico tolera "te lo mando a las 18". La rotisería a las
21 sí tiene urgencia, y es justo donde alguien está mirando una pantalla. **El problema
se acomoda solo, siempre que el default del almacén sea pedido programado y no
inmediato.**

### Franjas, no inmediato

Las franjas de reparto no son una limitación: **son el mecanismo que hace rentable el
reparto propio**, porque permiten salir a las 12 y a las 19 con cinco pedidos de la
misma zona. El reparto inmediato destruye el agrupamiento y convierte cada pedido en un
viaje que pierde plata.

El comercio configura: retiro en local siempre; franjas de reparto con su costo y su
mínimo para envío gratis, si tiene reparto propio.

## A7. Mercado Pago del comercio

Cada comercio da de alta **su propio Mercado Pago** en NexoPOS o Nexo B2B. La plata va
directo del comprador al comercio, con la comisión de la plataforma retenida en la misma
operación (modelo marketplace, el mismo que ya usa ClubPay).

Esto hace que **P1 se cumpla por arquitectura y no por buena conducta**: la plata nunca
toca una cuenta de Nexo.

**La comisión es del riel, no del crédito.** Se cobra lo mismo por procesar un pago, sea
de una compra de contado o del resumen de una libreta. Nunca se cobra por el hecho de
que hubo fiado — si le cobramos un extra al comerciante cuando Juan paga el resumen, le
va a decir "pagame en efectivo" y perdemos la trazabilidad, que es lo único que hacía
valioso todo esto.

Un detalle que va a generar una llamada: 30 compras chicas y un pago único de $120.000
tienen la misma comisión porcentual pero se sienten muy distinto. **El resumen que ve el
comerciante tiene que mostrar la comisión desagregada por período**, no como un tajo al
final.

**Degradación sin Mercado Pago.** Muchos almaceneros tienen MP personal pero no una
cuenta onboardeada como vendedor. Eso no puede romper nada: **la cuenta corriente no
depende de Mercado Pago, solo depende de él el pago online.** Sin MP, el comerciante
cobra en efectivo y lo registra en el POS, y todo lo demás sigue funcionando.

---

# Parte B — La API

NexoTienda ya está construida y corre contra fixtures esperando esto. **ClubPay necesita
casi exactamente los mismos datos de cuenta** para su sección "Mis Comercios", así que
construirla una vez sirve para las dos cosas.

La forma exacta de cada objeto está tipada en `src/lib/nexopos/types.ts` del repo de
NexoTienda — ese archivo es la fuente de verdad. El cliente que las llama es
`src/lib/nexopos/client.ts`.

## Autenticación

`Authorization: Bearer <API_KEY>`, servidor a servidor. Esa key **nunca** llega al
navegador.

## Convenciones

- **Todos los montos en centavos, enteros.** Nada de floats.
- Fechas ISO 8601. Ojo con las fechas sin hora: `2026-08-10` tiene que significar el 10
  de agosto en Argentina, no el 9. Ya nos mordió una vez.
- `404` cuando el recurso no existe.
- El stock cambia con cada venta del mostrador: **no se cachea** nada de productos ni de
  cuentas.

## Endpoints

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/v1/hosts/{sub}` | Si `{sub}` es un comercio o un pueblo |
| GET | `/v1/stores/{slug}` | `Store` |
| GET | `/v1/stores/{storeId}/pasillos` | `Pasillo[]` |
| GET | `/v1/stores/{storeId}/products` | `Product[]` |
| GET | `/v1/stores/{storeId}/products/{id}` | `Product` |
| GET | `/v1/towns/{townSlug}/stores` | `Store[]` |
| GET | `/v1/towns/{townSlug}/search?q=` | `TownSearchResult` |
| GET | `/v1/people/{personId}` | `Person` con sus cuentas |
| GET | `/v1/people/{personId}/accounts/{storeId}` | `MerchantAccount` |
| POST | `/v1/orders` | `Order` |
| GET | `/v1/orders/{code}` | `Order` |
| POST | `/v1/orders/{code}/payment` | `Order` — el cobro se acreditó |
| POST | `/v1/people/{personId}/accounts/{storeId}/payments` | `MerchantAccount` — pago contra un resumen |

## Los objetos que importan

### `availability` — el campo que codifica A1

```ts
availability:
  | { policy: 'stock';    onHand: number }
  | { policy: 'declared'; state: 'available' | 'out'; quota?: { total, remaining } }
  | { policy: 'unknown' }
```

`unknown` **no es cero**: es que el POS no reportó. La tienda lo muestra tal cual
—"consultá disponibilidad"— y deja pedir igual, porque lo confirma el comercio al
aceptar. Nunca inventamos un número (P5, P6).

### `MerchantAccount` — la cuenta de una persona CON UN COMERCIO

Con su propio `closingDay`, su propio `availableCents`, su `creditPaused`, su
`onlineCreditEnabled` y su pila de `periods`. Ver A5.

Un `Person` trae sus `accounts[]`. **No hay ningún campo que sume las deudas de dos
comercios.** El total del pueblo lo calcula ClubPay para mostrárselo al deudor y nada
más (P3).

### `Store`

Incluye los `slots` de retiro y reparto con sus costos, el `freeDeliveryOverCents`, el
teléfono (habilita el botón de contacto), `acceptsOnlinePayment`, `allowsCredit`, y
`storefrontPublished`.

Ese último importa: un comercio puede estar en el POS y **no** tener tienda publicada.
En ese caso NexoTienda muestra un cartel con sus datos, no un catálogo vacío. Y si los
datos no fueron confirmados por el comercio, se muestran como no verificados (P5).

### `TownSearchResult`

El buscador del pueblo **nunca puede afirmar que nadie tiene algo**. La respuesta vacía
es "no lo encontramos cargado", no "nadie lo tiene" (P5): puede haber un comercio que lo
tenga sin subir.

Y las búsquedas sin resultado hay que **registrarlas**: son señal de demanda para el
comercio ("te están buscando esto"), para el mayorista ("hay demanda no servida en esta
zona") y para el equipo comercial de Nexo B2B.

## Webhooks

NexoTienda y ClubPay necesitan enterarse de:

- pedido aceptado (con el tiempo estimado que declaró el comercio)
- pedido listo / en camino / entregado
- pedido vencido o cancelado
- resumen cerrado
- vinculación de cuenta propuesta
- compra a cuenta registrada en el mostrador

---

# Parte C — El handoff con ClubPay

Cuando alguien toca un comercio en ClubPay, se abre su tienda. La tienda necesita saber
quién es para poder ofrecerle pagar en la libreta y para no pedirle que se identifique
de nuevo.

Son **dos cosas distintas** y conviene no mezclarlas:

**1. Un `person_id` opaco.** Identificador estable emitido por Nexo, que ClubPay mapea a
su usuario y NexoPOS a su ficha de cliente. Opaco, sin significado, tipo UUID. El DNI no
puede ser este identificador (ver A5).

**2. Un token corto, de un solo uso, para autenticar el salto.** **No una API key**: una
API key es un secreto servidor a servidor, y si viaja en el link que abre el navegador
queda expuesta en el historial, en los logs, en el `Referer` y en el WhatsApp donde
alguien reenvíe la URL.

El flujo:

1. La persona toca el comercio en ClubPay.
2. El backend de ClubPay le pide a NexoPOS un token de entrada — **ahí sí** va la API
   key, entre servidores.
3. NexoPOS devuelve un token **firmado, de vida corta y de un solo uso**, atado a ese
   `person_id` y a esa tienda.
4. La app abre la tienda con ese token.
5. La tienda lo canjea por una sesión propia y el token muere.

Es el patrón de un magic link. Si se filtra, ya venció.

**Nunca datos personales por query string** — ni DNI, ni teléfono, ni saldo.

---

# Lo que hay que acordar antes de arrancar

1. **Vencimiento del pedido**: cuántos minutos, y si es configurable por comercio.
2. **Canal de aviso al comercio**: pantalla del POS, mail, WhatsApp Business API (con su
   costo por conversación) o push.
3. **Onboarding de Mercado Pago del comercio**: quién lo acompaña. Es fricción en el peor
   momento posible, que es el de la adopción.
4. **Migración del stock existente**: qué productos quedan en `stock` y cuáles pasan a
   `declared` en los comercios que ya usan el POS. El default por origen resuelve la
   mayoría, pero hay que revisarlo.
5. **Endpoint del token de handoff**: dónde vive y quién lo firma.
6. **Comercios sin tienda publicada**: cómo se marca `storefrontPublished` y quién
   confirma los datos del cartel.

## Y una cosa que va a pasar sí o sí

El primer comerciante con 30 clientes atrasados va a pedir dos cosas, y las dos van a
sonar razonables desde su lado:

- que le mandemos nosotros un mensaje más fuerte al cliente → **rompe P2**
- que le digamos si ese cliente debe en otros comercios → **rompe P3**

La respuesta a las dos es no, y conviene tenerla escrita **antes** de que llegue la
pregunta, o la vamos a improvisar mal.
