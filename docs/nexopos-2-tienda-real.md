# NexoPOS → segunda tanda: publicar tiendas de verdad

Continuación de `docs/nexopos.md`, con lo que hace falta para pasar de fixtures a
comercios reales. Seis definiciones nuevas.

**Contexto:** NexoTienda ya está en producción con HTTPS en `nexotienda.app`. Corre
contra fixtures esperando la API. El certificado es comodín (`*.nexotienda.app`) y ya
está emitido y renovando solo.

---

## 0. Lo primero, porque les ahorra construir un subsistema

Veníamos pensando que dar de alta un subdominio nuevo iba a requerir generar un
certificado, con un estado de "aplicando cambios" y un cron. **Eso ya no hace falta.**

El certificado es comodín y cubre cualquier subdominio, presente y futuro. El DNS
también es comodín. nginx tiene `server_name *.nexotienda.app`.

Traducido: **un slug nuevo funciona en el instante en que la API lo devuelve.** Sin
cron, sin espera, sin tilde verde. Verificado contra producción con un nombre que
nadie había creado — el handshake TLS resuelve y la app contesta 404 porque el
comercio no existe, que es exactamente lo correcto.

Lo único que gatilla que una tienda exista es que `GET /v1/hosts/{sub}` la devuelva.

---

## 1. El comercio se publica solo desde NexoPOS

Confirmado y ya implementado de nuestro lado: **no hay alta de comercios en
NexoTienda.** Si no tiene cuenta en NexoPOS y no tiene la tienda habilitada, no
existe.

`Store.storefrontPublished` es la única compuerta. Con `false`, NexoTienda muestra un
cartel con los datos del comercio y un botón de contacto — nunca un catálogo vacío.

---

## 2. Quién administra las regiones — **necesita decisión de ustedes**

`morrison.nexotienda.app` es la página de un pueblo. Faltan dos definiciones.

### 2.1 El slug de la región no puede salir del nombre

Los nombres de pueblo se repiten en todo el país. Hay varias Santa Rosa, varios San
Martín, varios Belgrano. Si el slug se derivara del nombre, el segundo pueblo
homónimo que entre al sistema colisiona con el primero.

Proponemos una entidad `Region`:

```ts
interface Region {
  slug: string;      // único en TODO el sistema, asignado por un humano
  name: string;      // "Morrison"
  province: string;  // "Córdoba"
  label: string;     // "Morrison, Córdoba" — para desambiguar en la interfaz
}
```

**Quién crea una región**: proponemos que sea el admin de Nexo, no el comerciante ni
un proceso automático. Es una decisión de una vez por pueblo, es donde se resuelven
las colisiones de nombre, y equivocarse deja una URL pública mal puesta.

### 2.2 Qué comercio pertenece a qué región

Acá hay algo que definimos en el documento fundacional y conviene no perder: **la
región se define por zona de reparto, no por dirección** (D14).

Un comercio a 8 km del centro que reparte en Morrison pertenece a Morrison. Uno
ubicado en el centro que solo atiende el mostrador, no. Así la página promete algo
verdadero —"lo que te pueden traer"— y los casos de borde se resuelven solos: un
comercio que reparte en dos pueblos aparece en los dos.

Consecuencia: **la relación comercio–región es de muchos a muchos**, no un campo en
`commerces`.

Y aparecer en la página del pueblo es **opt-in** (D13). No alcanza con pertenecer a la
región: el comerciante tiene que querer estar. Poner a dos supermercados del mismo
pueblo uno al lado del otro con los precios a la vista es un objeto social distinto en
un pueblo que en Amazon — los dos dueños se conocen.

Entonces son dos cosas separadas:

| | Quién decide |
|---|---|
| El comercio **pertenece** a la región | Se deriva de su zona de reparto |
| El comercio **aparece** en la página del pueblo | El comerciante, con un switch |

**Falta definir**: si la pertenencia la carga el admin de Nexo, o si el comerciante
elige su región de una lista y ustedes la aprueban. Nos da igual el mecanismo; lo que
importa es que alguien sea responsable y que el slug de la región no lo elija el
comerciante.

---

## 3. El slug del comercio, elegido por el comerciante

En el perfil de NexoPOS, con una propuesta que él puede cambiar. Esto es lo que hay
que validar.

### 3.1 Un solo espacio de nombres, y es el error fácil de cometer

**Comercios y regiones comparten subdominio.** Si un comercio pudiera tomar
`morrison`, se quedaría con la página del pueblo.

La unicidad se valida contra los **tres** conjuntos juntos:

1. Slugs de comercios (incluidos los anteriores, ver 3.3)
2. Slugs de regiones
3. Reservados

Los reservados están en `src/lib/slug.ts` del repo de NexoTienda. Dos que importan
especialmente: **`acme` y `acme-ns` no se pueden tomar nunca** — son la delegación del
certificado comodín, y perderlos rompe la renovación de todas las tiendas a la vez.

### 3.2 Reglas de forma

```
3 a 40 caracteres · solo minúsculas, números y guiones
empieza y termina con letra o número · sin guiones dobles
```

Y una que no es estética: **no puede llevar puntos**. El certificado es
`*.nexotienda.app` y un comodín cubre **una sola etiqueta**. `pizzeria.don.pepe` daría
error de certificado en el navegador, que es peor que no existir.

El código de validación está en `src/lib/slug.ts` — `checkSlugShape()` y
`suggestSlug()`. Cópienlo o reimplántenlo, pero que las reglas sean las mismas.

### 3.3 Cambiar el slug rompe links

Y es más grave de lo que parece: acá los links viajan por WhatsApp. El estado del
súper, el grupo del barrio, la señora que reenvía. Un comercio que cambia de slug deja
muertos todos los links que ya circularon.

Por eso `Store` lleva `previousSlugs: string[]`. `GET /v1/hosts/{sub}` tiene que
resolver también los viejos —NexoTienda redirige al actual— y esos slugs quedan
**tomados para siempre**: no se pueden reasignar a otro comercio.

### 3.4 No hay estado intermedio

Guardar el slug y que funcione es lo mismo. Si quieren mostrar un tilde verde, que sea
el resultado de la validación de unicidad, no de un proceso en background.

---

## 4. Qué productos van a la tienda

### 4.1 El stock manda

Si NexoPOS dice 3, se pueden comprar hasta 3. Ya está implementado del lado de la
tienda: el carrito no deja pasar del tope y el botón de sumar se deshabilita.

Con producto propio y cupo del día, el tope es el cupo restante.

**Lo que falta definir de su lado**: qué pasa entre que alguien pone 3 en el carrito y
el comercio acepta el pedido, si el mostrador vendió esos 3 en el medio. Dos caminos:
reservar al confirmar el pedido, o aceptar y que el comerciante ajuste. El mostrador
siempre gana, así que probablemente sea lo segundo — pero hay que decidirlo, porque
define qué le mostramos al comprador cuando pasa.

### 4.2 Dos flags distintos, no uno

El caso que plantearon —compré jamón, muzzarella y harina por Nexo B2B para hacer
pizzas, y vendo pizzas, no jamón— **ya está resuelto con el flag de insumo** que
implementaron (A3 del documento anterior). Eso no aparece en góndola ni en la tienda.

Pero hace falta un segundo flag, distinto:

| Flag | Qué significa | Dónde aparece |
|---|---|---|
| `esInsumo` | Se compra para usar, no para vender | En ningún lado |
| `publishedInStore` | Se vende en el mostrador, pero no online | Solo en el mostrador |

El segundo es para el producto que sí se vende pero que el comercio no quiere publicar:
cigarrillos, algo de peso variable, lo que sea. Son cosas distintas y no se pueden
resolver con un solo campo.

**El default de `publishedInStore` tiene que ser `true`.** La tienda es un subproducto
de la tabla de stock, no algo que el comerciante tenga que curar producto por producto
— ese es el motivo por el que los comercios chicos abandonan las apps de delivery. Que
tenga que apagar los pocos que no quiere, no encender los cientos que sí.

---

## 5. Los pedidos como notas de venta

Confirmado. Dos cosas que se desprenden:

**El pedido online y la venta del mostrador terminan en el mismo lugar.** Eso es lo
correcto: el stock, la caja y la cuenta corriente son los mismos. Si el pago fue "en la
libreta", el movimiento de cuenta corriente sale de esa nota de venta como cualquier
otra.

**El aviso al comercio sigue pendiente**, y es lo más urgente de esta lista. Mail y
WhatsApp al número que declaren, más la pantalla del POS.

Y lo que dijimos antes y sigue valiendo: el modo de falla real no es que el comerciante
no se entere, es que **se entere, no haga nada en 40 minutos, y el comprador no sepa si
va o no va**. Por eso hace falta el vencimiento del pedido (D19), que sigue sin
definirse. Nuestra propuesta: 30 minutos configurables, y **un pedido que entra fuera
del horario de atención no vence** — espera a que el comercio abra y ahí arranca el
reloj. Si alguien pide a las 23:30 para el día siguiente y se lo cancelamos a
medianoche, cancelamos por una regla nuestra un pedido que nadie abandonó.

---

## 6. Los estados del pedido

Ya está implementado del lado de la tienda. Los estados del contrato no cambian:

```
recibido → aceptado → listo → [en_camino] → entregado
```

Lo que cambia es **el texto**, y se deriva de dos cosas que ya tenemos:

| Estado | Producto de góndola | Comida / producto propio |
|---|---|---|
| `recibido` | El comercio recibió tu pedido | El comercio recibió tu pedido |
| `aceptado` | El comercio está **armando** tu pedido | El comercio está **elaborando** tu pedido |
| `listo` | Tu pedido está listo | Tu pedido está listo |
| `en_camino` | *(solo con reparto)* Tu pedido está en camino | ídem |
| `entregado` | El comercio entregó tu pedido *(retiro)* · Tu pedido fue entregado *(reparto)* | ídem |

"Armando" o "elaborando" se decide por **las líneas del pedido**, no por el rubro del
comercio: un súper que además hace prepizzas *elabora* esa venta y *arma* las otras.

**Lo que necesitamos de ustedes** son las transiciones y el `readyEstimate`:

- El comercio acepta y **declara para cuándo lo tiene**. Ese tiempo lo dice él, nunca
  lo inventa la plataforma (D18). Ya está la pantalla del comprador esperando ese dato.
- `en_camino` solo aplica a pedidos con reparto.
- Cada transición tiene que llegarnos por webhook.

---

## Resumen de lo que necesitamos decidido

| | Quién |
|---|---|
| Quién crea las regiones y con qué slug | **Ustedes / producto** |
| Cómo se asigna un comercio a una región (y el opt-in de aparecer) | **Ustedes / producto** |
| Qué pasa si el mostrador vendió el stock mientras el pedido estaba en curso | **Ustedes** |
| Vencimiento del pedido: minutos, y la excepción de fuera de horario | **Ustedes** |
| Canal de aviso al comercio: mail, WhatsApp Business API, push | **Germán** (la cuenta de WhatsApp) |
| Las tres credenciales de la API para que dejemos los fixtures | **Ustedes** |
