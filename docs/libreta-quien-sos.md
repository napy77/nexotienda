# La libreta en la tienda: cómo sabemos que sos vos

Documento para debatir, no para implementar todavía. Al final quedan las preguntas
para ClubPay y para NexoPOS.

---

## 1. La pregunta está mal planteada, y eso importa

La pregunta natural es "¿cómo hacemos el login?". Pero en NexoTienda **no existe estar
logueado**. La sesión se guarda en una cookie por comercio —`nt_acc_jure`— y eso no es
un detalle de implementación: es P3 metido en el frasco de las galletitas. No hay, en
ningún lado del sistema, un estado que diga "esta persona es German Yovan". Hay, como
mucho, "en esta tienda está abierta la libreta `acc_jure_4b91`".

Así que la pregunta real es: **¿cómo se desbloquea la libreta de *este* comercio?**

Puede parecer lo mismo. No lo es: la segunda tiene respuestas que la primera no deja
ver, y descarta sola la mitad de las opciones.

## 2. Lo que ya está decidido y no conviene tocar

- La libreta **se autoriza en el mostrador**, con el cliente presente y con DNI (D23).
  La app no otorga crédito y la tienda tampoco.
- El id es **de la relación, no de la persona** (`accountId`). No existe ninguna clave
  que identifique al comprador a través del pueblo.
- El handoff es un **token de un solo uso y de dos minutos**, que se canjea del lado
  del servidor por el `accountId`. **Nunca un id en la URL**: un id permanente en un
  link es una credencial que no vence nunca.
- La identidad del comprador **vive en ClubPay**. No hay app propia de NexoTienda.

Todo lo que sigue tiene que caber ahí adentro.

## 3. Las tres opciones, y por qué una se cae sola

### A. NexoTienda hace su propio login

Un registro con teléfono y código por SMS, y después lo vinculamos con la cuenta del
comercio.

**Esto hay que descartarlo, y el motivo no es el trabajo que cuesta.**

Un login propio crea una **segunda identidad** que tiene que coincidir con la de
ClubPay. Van a coincidir el 99% de las veces. El 1% restante es alguien viendo la
deuda de otro, que es el peor error posible de este producto: no es un bug, es una
traición. Y no hay forma de que dos sistemas de identidad no se desincronicen nunca.

Además, el teléfono como usuario **es** la clave cross-comercio que nos prohibimos
tener. Hoy el diseño dice que el almacén y la ferretería no pueden descubrir que
Juan es el mismo Juan. Si NexoTienda lo sabe, la protección pasa a ser una promesa de
nuestro código en vez de una propiedad del modelo — y las promesas se rompen con un
`JOIN` distraído.

### B. Consumir el login de ClubPay

ClubPay es el que ya sabe quién es German Yovan, y el que ya le muestra su cuenta en
Jure. Que sea él quien lo diga.

**Esta es la buena**, y es la que el sistema ya estaba pidiendo: NexoTienda **nunca
autentica a nadie**. Recibe una prueba, la canjea del lado del servidor y abre una
libreta. No maneja contraseñas, no tiene recuperación de cuenta, no tiene usuarios.

### C. El QR

Germán lo propuso para la vinculación. Es buena idea, **pero no para donde parece**.

En un teléfono no sirve: la persona está *en* el teléfono, no puede escanear su propia
pantalla. El QR sirve en una compu — que acá es marginal — y sirve, sobre todo, en un
lugar que no estábamos mirando: **el mostrador.**

Ver la sección 5.

## 4. Un mecanismo, tres puertas

Lo importante es que las tres formas terminen en **el mismo canje**: un token de un
solo uso que NexoTienda cambia, del lado del servidor, por un `accountId`. Si cada
puerta tiene su propia lógica, tenemos tres superficies de ataque y tres bugs
distintos.

**Puerta 1 — desde la app.** La persona está en ClubPay, en "Mis comercios", toca Jure
y toca "Ir a la tienda". ClubPay emite el token y abre
`jure.nexotienda.app/entrar?t=…`. Canjeamos, ponemos la cookie, redirigimos.

Es la más fácil y la pantalla ya existe: en la captura de "Mis comercios" falta
únicamente ese botón. **Yo empezaría por acá**, porque cubre un camino real y no
depende de nada nuevo.

**Puerta 2 — desde el navegador, en el teléfono.** Es el caso más común y el que falta:
el link de la tienda llegó por WhatsApp, la persona está en el navegador y quiere
comprar en la libreta.

Toca "Entrar con ClubPay" → se abre la app → confirma → vuelve al navegador. Por
debajo: NexoTienda crea un pedido de vínculo con un nonce, lo guarda en una cookie,
abre el deep link, y cuando ClubPay confirma, la página recibe el token.

**Puerta 3 — el QR.** El mismo pedido de vínculo, mostrado como código. Sirve en una
compu, y sirve en el mostrador.

## 5. Dónde el QR se gana el lugar

**En el mostrador, en el momento en que el comerciante abre la libreta.**

Ese es el instante que D23 y D25 describen: el cliente está parado ahí, el comerciante
acaba de autorizarlo, hay un DNI sobre la mesa y hay dos personas mirándose. Es el
único momento del sistema donde la identidad está verificada por un humano que
responde por ella.

Hoy ese momento se desaprovecha: se crea la cuenta y después, en algún otro momento y
por algún otro camino, la persona "vincula desde ClubPay". Entre esos dos momentos hay
un agujero que se llena con adivinanzas — DNI, teléfono, nombre parecido.

Si NexoPOS muestra un QR al terminar de dar el alta y la persona lo escanea con
ClubPay ahí mismo, **la vinculación hereda la verificación del mostrador**. No hay que
adivinar nada nunca más.

## 6. Por qué no se puede vincular por DNI: la prueba está en la captura

En la pantalla de clientes de Jure hay **dos German Yovan**:

| Documento | Teléfono | Saldo |
|---|---|---|
| 2698535 | 0351155630140 | $850,00 |
| 26098535 | 3515630140 | $27.519,20 |

Es el mismo documento con un dígito comido y el mismo teléfono escrito de dos formas.
Uno solo tiene "Ve su cuenta en ClubPay".

**Esto no es un caso de laboratorio: es el día uno, con el nombre del fundador.** Un
almacén con seiscientos clientes cargados a mano durante quince años va a tener
decenas. Si el vínculo se resolviera solo por DNI, acá hay que elegir entre mostrarle
a alguien una cuenta de $850 o una de $27.519,20, y las dos opciones son incorrectas.

Es exactamente lo que dice D25 y ahora se ve por qué: **el DNI enlaza, no revela.** El
match *propone*; el saldo aparece después de que un humano confirma. Con el QR en el
mostrador, ese humano es el comerciante, en el momento correcto.

## 7. Dos cosas que hay que decidir aparte

### El teléfono compartido

Acá los teléfonos se comparten. Si la cookie de la libreta dura para siempre, el hijo
que agarra el celular del padre entra a la tienda y ve la deuda. No hay ataque, no hay
error del sistema: simplemente dejamos abierta una puerta que nadie cerró.

Propongo: la sesión de libreta **vence por inactividad** —a definir, quince o treinta
días—, y mientras está abierta **se ve de quién es**, con un "Salir" visible. Nunca
se abre la libreta sola: hay que tocarla.

### Cuánto de la libreta vive en la tienda

Hoy NexoTienda tiene una página de libreta que muestra los movimientos. Pero ClubPay
ya los muestra, y mejor: es la vista agregada del deudor, que es donde corresponde
(P3).

Vale preguntarse si en la tienda hace falta algo más que **"podés cargar a la libreta,
y tenés tanto disponible"**. Si el historial se queda en ClubPay, una sesión robada en
la tienda sirve para comprar —malo, pero acotado, y el comerciante lo ve— y no para
pasearse por la historia financiera de alguien.

No lo decido yo, pero es la diferencia entre un incidente y un escándalo.

---

## Preguntas para ClubPay

1. **¿ClubPay puede emitir un token de un solo uso** para "esta persona, en este
   comercio", que NexoTienda canjee del lado del servidor? ¿Contra quién se canjea:
   contra ClubPay o contra NexoPOS?
2. **El token tiene que estar acotado a un comercio.** Un token que abra todas las
   tiendas de la persona es la clave cross-comercio que no queremos que exista.
   ¿Se puede emitir así?
3. **¿La app puede abrir una URL y recibir una de vuelta?** (deep link / universal
   link). ¿Qué esquema usa hoy?
4. **¿La app puede escanear un QR** y confirmarle al backend de ClubPay que ese pedido
   de vínculo es suyo?
5. **En "Mis comercios" → Jure Hnos SRL, ¿podemos agregar "Ir a la tienda"?** Es la
   puerta 1 y es la más barata de todas.
6. **¿Qué pasa si la persona pierde el teléfono o cierra sesión en ClubPay?** ¿Hay
   forma de revocar las sesiones de tienda que se abrieron con su cuenta?
7. **¿ClubPay conoce el `accountId` de la relación**, o conoce un `person_id` y el que
   traduce es NexoPOS?

## Preguntas para NexoPOS

1. **¿Quién valida el token del handoff?** Ya tenemos la clave `cuentas`, y ya
   acordamos que la clave dice *qué endpoint* y el token dice *de quién*. ¿El canje es
   un endpoint suyo —algo como `POST /v1/cuentas/canjear { token }` → `{ accountId,
   storeId, displayName }`— o de ClubPay?
2. **Los clientes duplicados.** ¿Hay alguna deduplicación hoy? ¿El comerciante ve de
   alguna forma que tiene dos fichas del mismo señor? (Los dos German Yovan de la
   captura, con $850 y $27.519,20.)
3. **¿Pueden mostrar un QR de vinculación al dar de alta la cuenta corriente**, en la
   misma pantalla donde hoy dice "Ve su cuenta en ClubPay"? Es el momento donde la
   identidad está verificada por un humano.
4. **¿Qué es exactamente "Ve su cuenta en ClubPay"** en la pantalla de clientes? ¿Es un
   vínculo ya hecho, una invitación, o un permiso del comerciante? Cambia bastante el
   diseño.
5. **¿Quieren poder cortar una sesión de tienda** desde NexoPOS? Si el comerciante
   bloquea el fiado de alguien, ¿la sesión abierta en la tienda debería caerse?

## Lo que decidís vos

- Si la libreta online **requiere ClubPay sí o sí**. Mi recomendación: sí, y sin
  culpa — el que no lo tiene sigue comprando fiado en el mostrador como siempre, que
  es lo que hace hoy. La alternativa es construir identidad propia, y eso es la
  sección 3.A.
- Cuánto del historial vive en la tienda y cuánto se queda en ClubPay (sección 7).
- Cuánto dura una sesión de libreta.
