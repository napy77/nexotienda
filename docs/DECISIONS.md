# Decisiones

Por qué el sistema funciona como funciona. Las `D1`–`D44` y `P1`–`P6` del documento
fundacional se citan pero no se repiten; acá van las decisiones **de este repositorio**
tomadas durante la construcción.

---

## DEC-001 — La tienda es una vidriera, no un sistema

**Fecha** 2026-08 · **Estado** vigente

**Decisión.** NexoTienda no es dueña de ningún dato del negocio. Lee de NexoPOS y le
escribe pedidos. No calcula precios, totales, imputaciones ni saldos.

**Motivo.** Si el precio se calculara de los dos lados, el changuito diría un número y
la nota de venta otro — y de los dos el que vale es el del POS (P6).

**Consecuencias.** Se puede borrar el servidor y no se pierde nada. Cada vez que se
duplicó una vista, se duplicó la regla que la calcula y apareció un error: el saldo
salía de sumar resúmenes cerrados (dejando afuera el período abierto) y los fixtures
emulaban la imputación del pago, contradiciendo D31.

**Afecta** NexoTienda, NexoPOS.

## DEC-002 — Sin base de datos

**Fecha** 2026-08 · **Estado** vigente

**Decisión.** Ningún motor de base de datos. El estado propio es cookies `httpOnly` y
`localStorage`.

**Motivo.** Consecuencia de DEC-001. Una base propia sería una segunda copia de datos
ajenos, con la obligación de mantenerla sincronizada.

**Consecuencias.** Despliegue trivial, sin migraciones ni backups. Los pedidos en
modo fixtures viven en memoria y se pierden al reiniciar.

## DEC-003 — Tres claves por capacidad, no una por comercio

**Fecha** 2026-09 · **Estado** vigente

**Decisión.** `catalogo`, `pedidos` y `cuentas`. NexoTienda **nunca** tiene la clave de
un comercio y por lo tanto **nunca llama a ClubPay directo**: la cadena es
NexoTienda → NexoPOS → ClubPay.

**Motivo.** Es un solo servidor que renderiza la tienda de cualquier comercio, no un
cliente de uno. Con cuatrocientas tiendas serían cuatrocientas claves de ClubPay en el
proceso que atiende a las cuatrocientas.

**Consecuencias.** ClubPay tuvo que rediseñar su canje para que lo llame NexoPOS. El
`storeId` viaja en el pedido del canje porque el que tiene la clave del comercio es
NexoPOS.

**Afecta** los tres.

## DEC-004 — Port + adapter para toda dependencia externa

**Fecha** 2026-08 · **Estado** vigente

**Decisión.** `NexoPosPort` y `PaymentsPort`, con implementación real y de prueba.
Se elige por variable de entorno. La traducción vive en el adapter.

**Motivo.** Permitió construir la tienda entera antes de que la API existiera, y
seguir desplegando mientras el otro lado migra.

**Consecuencias.** El adapter es tolerante a las dos formas de cada campo. Cambiaron
el modelo entero de campañas y no hubo que tocar una línea de precio.

## DEC-005 — Subdominio con certificado comodín

**Fecha** 2026-09 · **Estado** vigente

**Decisión.** `{slug}.nexotienda.app`, comodín por acme-dns con delegación CNAME.
`proxy.ts` reescribe a `/s/<sub>`. Los slugs viejos redirigen para siempre.

**Motivo.** Los links viajan por WhatsApp y no se pueden dejar morir. Con el comodín un
slug nuevo funciona al instante.

**Consecuencias.** `acme` y `acme-ns` son intocables. El `/s/<sub>` es interno y no
debe salir del repo — se filtró a un equipo y costó un 404.

## DEC-006 — La libreta online requiere ClubPay

**Fecha** 2026-09-17 · **Estado** vigente · **Decidió** Germán

**Decisión.** Sin ClubPay no hay libreta online. NexoTienda no construye login propio.

**Motivo.** Un login propio sería una segunda identidad que tiene que coincidir con la
de ClubPay, y el uno por ciento en que no coincidan es alguien viendo la deuda de otro.

*Corregido el 2026-10-13 (CR-0003):* el texto original agregaba que el teléfono como
usuario sería «la clave cross-comercio que P3 prohíbe». Era un motivo equivocado: **P3
prohíbe exponer la deuda de un cliente a otros comercios, no identificar a la
persona.** La conclusión no cambia; el motivo es no tener dos identidades que deban
coincidir.

**Consecuencias.** El que no tiene ClubPay sigue comprando fiado en el mostrador. Sin
sesión no sabemos si la persona tiene libreta, así que el mensaje no lo afirma.

## DEC-007 — Los resúmenes se quedan en ClubPay

**Fecha** 2026-09-18 · **Estado** vigente · **Decidió** Germán

**Decisión.** La tienda contesta *cuánto debo* y *cuánto puedo cargar*. La pila de
períodos no se pide ni se muestra. Los tipos y el endpoint se borraron.

**Motivo.** Por DEC-006, todo el que puede abrir la libreta en la tienda ya tiene la
pila en ClubPay. No es mostrar menos: es no mostrarle lo mismo dos veces con dos
implementaciones que pueden no coincidir. Y acota una sesión robada a comprar, no a
pasearse por la historia financiera de alguien.

**Consecuencias.** Al sacarlo apareció que el saldo se calculaba mal. Se borró de
verdad, no detrás de un `if`: una rama que nunca se ejecuta envejece mal.

## DEC-008 — El código de emparejar nace en la computadora

**Fecha** 2026-09-18 · **Estado** vigente

**Decisión.** Para abrir la libreta en una PC, el código lo genera la computadora y la
persona lo tipea en ClubPay. **Nunca al revés.**

**Motivo.** Al revés es un OTP, y los OTP son la credencial más robada que existe. La
diferencia que decide es **dónde puede intervenir el defensor**: así el ataque pasa por
una pantalla de ClubPay que nombra el comercio y pregunta; invertido, en el momento en
que alguien dicta el código la app no participa.

**Historia.** Se invirtió y se revirtió. El error fue sacar una conclusión demasiado
grande de un hallazgo correcto: que el `clientHint` no fuera una defensa no significaba
que la dirección estuviera mal — lo que defiende es la pantalla de confirmación.

**Consecuencias.** `clientHint` viaja pero **no es prueba de nada**. Solo una consulta
en vuelo por vez: el token se entrega una sola vez.

## DEC-009 — Con el comercio cerrado decide el producto, no el rubro

**Fecha** 2026-09-11 · **Estado** vigente

**Decisión.** Todo `stock` se puede encargar avisando cuánto falta para que abra. Si
hay una línea `declared`, no se puede pedir. `unknown` no bloquea nada.

**Motivo.** Jure es almacén **y** hace pizzas. `declared` es, textualmente, lo que el
comercio declaró que tiene **hoy**. El corte lo pone el changuito.

## DEC-010 — La portada no es el catálogo

**Fecha** 2026-09-16 · **Estado** vigente

**Decisión.** Estanterías en la portada; la grilla aparece al elegir góndola o buscar.
El filtrado es server-side y el estado vive en la URL. Se fue el chip de "Todo".

**Motivo.** Delfín tiene ~7.000 productos. Abrir en "Todo" mandaba siete mil fichas al
teléfono, que paga el que entró con sus datos y su batería.

**Consecuencias.** La búsqueda se manda, no filtra por tecla. Una góndola o una
búsqueda se pueden mandar por WhatsApp.

## DEC-011 — Solo se afirma lo que se puede respaldar

**Fecha** transversal · **Estado** vigente

**Decisión.** "Los más vendidos" solo existe si NexoPOS manda el dato; sin él la
estantería se llama "Para empezar". La barra de la tienda se rellena con hechos
contados —productos en oferta, productos cargados, medios de pago— nunca con
adjetivos. Si `closingDay` no viene, no se dice.

**Motivo.** En un pueblo el almacenero sabe de memoria qué es lo que más vende, y el
que lee conoce al del mostrador. Una lista que diga otra cosa enseña en dos segundos
que la pantalla inventa, y después no le creen ninguna otra.

## DEC-012 — `docs/` tiene una carpeta por destinatario

**Fecha** 2026-09-18 · **Estado** vigente

**Decisión.** `a-nexopos/`, `a-clubpay/`, `interno/`. Cada archivo lo repite en su
primera línea. **Un archivo, un destinatario.**

**Motivo.** Estos documentos se reenvían; un documento para los dos equipos no se puede
reenviar sin editarlo. Y la misma respuesta escrita en dos lados se contradijo sola.

## DEC-013 — Un fallo nunca se presenta como "todo bien"

**Fecha** 2026-09-19 · **Estado** vigente

**Decisión.** Un error de la capa de atrás no se traduce a un estado de éxito ni de
espera. Todo sondeo tiene final. Un 404 en un endpoint de acción se loguea.

**Motivo.** Apareció tres veces en dos días: NexoPOS reenviaba el 404 de ClubPay como
propio y acusaba al equipo equivocado; nuestro sondeo devolvía `pendiente` ante un
error y giraba para siempre; y dos consultas simultáneas mostraban "venció" justo
cuando acababa de funcionar.

**Afecta** NexoTienda, NexoPOS.

## DEC-014 — Mercado Pago se conecta una vez, en ClubPay

**Fecha** 2026-10-11 · **Estado** vigente · **Decidió** Germán (ADR-0001 del ecosistema)

**Decisión.** El comercio hace el OAuth de Mercado Pago **una sola vez, en ClubPay**, y
se reutiliza en el mostrador y en la tienda. NexoTienda **no integra Mercado Pago**: le
pide el link a NexoPOS y consulta el estado del pedido.

**Motivo.** Que un comercio conecte Mercado Pago en tres apps es tres veces la fricción
y tres lugares con credenciales. ClubPay ya lo necesitaba para cobrar con descuentos y
pagar libretas.

**Consecuencias.** Se descartó `lib/payments/mercadopago.ts` antes de terminarlo. No
hay `MP_ACCESS_TOKEN`. La decisión "autorizar vs capturar" dejó de ser nuestra.

**Afecta** los cuatro sistemas.

## DEC-015 — La tienda nunca declara algo como pagado

**Fecha** 2026-10-11 · **Estado** vigente

**Decisión.** El port no tiene ningún método para marcar un pedido o una libreta como
pagados. Quien confirma un pago es quien lo ve: **Mercado Pago** el cobro online, **el
comerciante en NexoPOS** la transferencia (mira su banco) y el efectivo (lo recibe en
la mano), y **ClubPay** la libreta.

**Motivo.** El sandbox de pagos corría en producción —nadie había seteado
`MP_ACCESS_TOKEN`, así que era el adapter elegido— y su botón "Aprobar" marcaba
pedidos y libretas como pagados sin que entrara plata. La tienda no ve el banco ni la
caja: no puede ser la que confirma.

**Consecuencias.** Se borró el sandbox entero en vez de esconderlo: una simulación del
cobro al lado de la API real es exactamente el riesgo. Para desarrollar, la emulación
vive **dentro del adapter de fixtures**, que por construcción no convive con un NexoPOS
real. La tienda puede juntar evidencia —el alias, a futuro el comprobante— nunca el
veredicto.

## DEC-016 — Identificarse con ClubPay para pagar en mano, y la sesión deja de ser libreta

**Fecha** 2026-10-13 · **Estado** vigente · **Decidió** Germán (ADR-0002 del ecosistema, CR-0003)

**Decisión.** Cada comercio puede pedir, desde NexoPOS, que quien paga al retirar o al
recibir se identifique con ClubPay (email verificado) y ponerle topes. Viene **apagado**.
Mercado Pago no pasa por estas reglas. Una sesión pasa a ser **una persona
identificada**; la libreta es un permiso aparte (`creditEnabled`).

**Motivo.** Un pedido falso de 50 productos a nombre de «Lando Landa». Con reparto y
pago al recibir, un pedido así manda un cadete a la casa de alguien que no pidió nada.

**Consecuencias.**
- La tienda manda a `www.clubpay.com.ar/entrar?volver=<URL completa>` y vuelve por
  `/entrar` con `volver`, un camino validado (nunca una URL).
- La vidriera (`orderRules`) dice qué ofrecer; **decide el rechazo con `code`** de
  NexoPOS. La tienda no conoce ni manda el nivel de nadie.
- `accountId` viaja con cualquier forma de pago solo con las reglas prendidas: antes
  NexoPOS no acepta cuenta y contacto juntos.
- Todo pedido que no va a la libreta pide teléfono, haya sesión o no: ClubPay no se lo
  da al comercio. Esto arregló un bug: con sesión y pago al retirar no se mandaba ni
  cuenta ni contacto, y NexoPOS lo rechazaba.
- Un email verificado prueba una casilla, no una persona: lo que protege al comercio
  son sus topes y mirar las cuentas nuevas. La pantalla no dice «por tu seguridad».

---

## Abiertas

| Tema | Estado |
|---|---|
| Quién es dueño del `storefrontSlug` | `PENDIENTE DE VALIDAR`. ClubPay lo pide a Nexo B2B; hoy lo sirve NexoPOS |
| QR de vinculación en el mostrador | Pedido a ClubPay. Ata **una ficha** a una persona, no un DNI — y por eso esquiva los clientes duplicados |
