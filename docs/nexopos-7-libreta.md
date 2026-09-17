# NexoPOS → la libreta en la tienda: el canje, y lo que confirmamos

Su respuesta cerró casi todo. Queda **una cosa que cambia respecto de lo que
propusieron**, y las respuestas a lo que nos preguntaron.

---

## 1. El canje es suyo, pero preguntando en vez de que les avisen

Confirmado que `POST /v1/cuentas/canjear` con la clave `cuentas` es el canje. Lo
tenemos construido y probado.

**Lo que cambia es el paso de atrás.** Ustedes proponían que ClubPay les empuje el
token al emitirlo (`POST /api/clubpay/handoff`) y guardarlo hasheado dos minutos.

ClubPay ya tiene construido y probado un endpoint que **valida el token**:

```
POST /pos/tienda/sessions
X-API-Key: la clave de ese comercio          ← la que ustedes ya tienen
{ token }
→ { account_id, external_id, persona }
```

Así que la cadena queda:

```
1. La app pide el token     app → ClubPay        POST /me/merchants/:id/tienda
2. La app abre la tienda    jure.nexotienda.app/entrar?t=…
3. La tienda canjea         NexoTienda → NexoPOS  POST /v1/cuentas/canjear  (clave `cuentas`)
4. Ustedes preguntan        NexoPOS → ClubPay     POST /pos/tienda/sessions
5. Vuelve la sesión         → { accountId, storeId, displayName }
```

**No hace falta que construyan el `handoff`.** Y preguntar es mejor que que les avisen
por dos motivos:

- El token queda **en un solo sistema**, el que lo emitió. Empujarlo duplica el lugar
  del que puede filtrarse.
- Desaparece un estado nuevo: "emitido en ClubPay, no llegado a NexoPOS". Ese es el
  que van a tener que diagnosticar a las once de la noche el día que alguien no pueda
  entrar.

### Por qué no canjeamos directo contra ClubPay

Porque su endpoint pide la clave **del comercio**, y nosotros no la tenemos ni la
podemos tener: NexoTienda tiene tres claves por capacidad —catálogo, pedidos,
cuentas— y ninguna por comercio, porque es *un solo servidor que renderiza la tienda de
cualquier comercio*. El que tiene legítimamente una clave por comercio son ustedes.

## 2. Lo único que bloquea: que `storeId` sobreviva el paso

Ustedes ya lo habían puesto en su propuesta (`{ accountId, storeId, displayName }`).
Solo hay que asegurarse de que no se pierda en el paso 4: ClubPay hoy devuelve
`{ account_id, external_id, persona }` **sin decir de qué comercio es** —no lo
necesita, porque su clave ya lo dice—.

Nosotros sí lo necesitamos: **NexoTienda atiende todas las tiendas con la misma
clave**, así que sin ese dato un token emitido para Jure abre sesión en
`delfin.nexotienda.app`. La comprobación está escrita y funcionando de nuestro lado
—probamos con un token de otra tienda y lo rechaza—, pero necesita el campo.

Ya se lo pedimos a ClubPay. Si de todos modos ustedes lo saben por el `account_id`,
mejor: pónganlo igual, que lo verifiquemos nosotros y no se lo creamos a quien trajo
el token.

## 3. Los duplicados: sí, construyan el detector

**Y el hallazgo es bueno.** Que el documento no cruce por un dígito comido en el medio
y que el teléfono sí normalice era exactamente al revés de lo esperable, y lo probaron
con los cuatro casos que importan. El detector por teléfono primero y documento de
refuerzo es lo correcto.

**Avisar en el alta y la lista de posibles duplicados: las dos, sí.**

**No fusionar solos: correcto y no lo cambien.** Fusionar es sumar saldos y mover
movimientos; si está mal, alguien queda debiendo lo que no debe. Eso lo confirma el
comerciante ficha por ficha o no se hace.

### Si un canje resuelve a más de una ficha

**Error explícito, nunca elijan.** Algo como:

```json
{ "error": "vinculo_ambiguo" }
```

Nosotros mostramos "no pudimos abrir tu libreta" con el botón para hablar con el
comercio. Es la misma válvula de siempre: cuando el sistema no puede, que hablen las
dos personas. Preferimos mil veces eso a mostrarle a alguien la libreta equivocada.

## 4. El QR del mostrador: su argumento es mejor que el nuestro

Nosotros dijimos que la vinculación hereda la verificación del mostrador. Ustedes
notaron algo más fuerte: **el QR no ata un DNI a una persona, ata una ficha a una
persona.**

El comerciante tiene abierta la ficha de $27.519,20 y muestra el QR *de esa ficha*. La
persona queda vinculada a ésa, no a "el DNI 26098535" que está mal escrito en el otro
renglón. El problema de los dos German Yovan deja de existir para todo cliente nuevo
sin resolver un solo duplicado viejo.

Eso convierte al QR de comodidad en **la única forma de vincular que no depende de que
los datos estén bien cargados**. Manden el pedido a ClubPay.

## 5. "Ve su cuenta en ClubPay": gracias, los cuatro estados van a la tienda

La tabla que mandaron es justo lo que faltaba, y el motivo de que nazca como
`propuesta` —que un dígito de más haga que el match caiga en otra persona que abre la
app y ve la deuda de un desconocido— es el mismo de nuestra sección de duplicados.

Que solo `vinculada`/`aceptada` tenga `account_id` es lo correcto y simplifica todo de
nuestro lado: **si no hay `account_id`, no hay libreta online**, sin excepciones y sin
casos intermedios que tratar.

## 6. Cortar sesiones: de acuerdo con ustedes, pero igual queremos la marca

**De acuerdo con que la sesión no tenga autoridad.** Ya está así: la cookie dice qué
libreta es y todo lo demás se pregunta en cada operación. Si el comerciante pausa el
fiado, el pedido siguiente se rechaza sin que nadie tenga que revocar nada. Eso
resuelve el 95%.

**Pero sí queremos la marca de desvinculación**, y no es redundante. El caso que no
cubre lo de arriba: si el comerciante desvincula a alguien, o la persona pierde el
teléfono, **nadie puede cerrar esa cookie**. Ni ustedes, ni ClubPay, ni nosotros: vive
en un navegador ajeno hasta que vence.

Un `unlinkedAt` por cuenta —o el `linkedAt` que se mueve— nos deja compararlo contra
cuándo se abrió la sesión y cerrarla sola. **Es la única revocación que existe en este
diseño.** No bloquea nada, pero cuando haga falta va a hacer falta de golpe.

## 7. Lo que ya está construido de nuestro lado

- **`/entrar?t=…`**: el canje, con la verificación de que el token sea de esta tienda,
  y con `Referrer-Policy: no-referrer` — la tienda carga fotos de productos de
  servidores ajenos, y sin eso el navegador le cuenta el token a un CDN de imágenes.
- **`/salir`** por `POST`, no por link: con un link, el prefetch del framework cerraría
  la sesión al pasar el mouse por encima del botón.
- **La franja "Libreta de Germán Yovan abierta · Salir"** arriba de todo. Acá los
  teléfonos se comparten y una libreta abierta sin nombre es una puerta que nadie sabe
  que quedó abierta.
- **Sesión de 30 días**, cookie `httpOnly` y **por comercio**: no existe un "estar
  logueado en NexoTienda". La sesión en el almacén no es la misma identidad que en la
  ferretería, y no hay ninguna clave que las una.

Probado de punta a punta: token válido abre, token inventado manda a "volvé a entrar
desde ClubPay", token de otra tienda rechazado.

## 8. La decisión de Germán

**La libreta online requiere ClubPay, sí o sí.** Sin ClubPay no hay libreta online; el
que no lo tiene sigue comprando fiado en el mostrador como toda la vida.

Ya está implementado. Un detalle de la letra chica que quizá les sirva copiar: sin
sesión **no sabemos** si esa persona tiene libreta, así que el mensaje no lo afirma —
*"Si ya tenés libreta con Jure, entrá desde ClubPay para usarla acá. Si todavía no, se
abre en el mostrador."* Decirle "no tenés libreta" a alguien que sí la tiene es negarle
algo que el comerciante le dio.

---

## En orden

1. **Que `storeId` vuelva en el canje** (sección 2) ← lo único que bloquea
2. **Encadenar el paso 4 contra ClubPay** (sección 1)
3. **El detector de duplicados** (sección 3)
4. **El pedido del QR a ClubPay** (sección 4)
5. **La marca de desvinculación** (sección 6), cuando puedan
