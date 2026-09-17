# La libreta: dónde se canja el token

**Registro interno.** Lo que hay que mandarle a cada equipo está partido en
[clubpay-1-libreta.md](clubpay-1-libreta.md) y
[nexopos-7-libreta.md](nexopos-7-libreta.md), cada uno completo por su cuenta. Acá
queda por qué se decidió así.

Las dos respuestas llegaron y son buenas. Pero **proponían dos canjes distintos**, y
había que elegir uno antes de que alguien construyera de más.

```
ClubPay:   NexoTienda → POST /pos/tienda/sessions   (X-API-Key: la clave de ese comercio)
NexoPOS:   NexoTienda → POST /v1/cuentas/canjear    (clave `cuentas`)
```

---

## 1. El canje va contra NexoPOS, y el motivo no es preferencia

**NexoTienda no puede usar el endpoint de ClubPay tal como está**, y no por gusto:
porque pide *la clave de ese comercio*.

NexoTienda tiene **tres claves separadas por capacidad —catálogo, pedidos, cuentas—,
no por comercio**. Esa decisión es vieja y es estructural: NexoTienda es **un solo
servidor que renderiza la tienda de cualquier comercio**, no es cliente de uno.
Mañana son ochenta tiendas y pasado son seiscientas; manejar seiscientas claves de
ClubPay en un proceso que atiende a las seiscientas no tiene forma — y además
concentra en un solo lugar el poder de hablar por cada comercio, que es exactamente lo
que la separación por capacidad evita.

Quien **sí** tiene legítimamente la clave de cada comercio es NexoPOS: una por
comercio, que es como corresponde, porque NexoPOS es el sistema de ese comercio.

## 2. La propuesta: que nadie construya de más

No hace falta que ClubPay tire lo que hizo ni que NexoPOS construya el `handoff` que
propuso. Alcanza con encadenar lo que ya existe:

```
1. La app pide el token          app → ClubPay
                                 POST /me/merchants/:vinculacion_id/tienda
                                 → { token, expires_at }

2. La app abre la tienda         jure.nexotienda.app/entrar?t=…

3. NexoTienda canja              → NexoPOS   POST /v1/cuentas/canjear   (clave `cuentas`)
                                             { token }

4. NexoPOS pregunta              → ClubPay   POST /pos/tienda/sessions
                                             X-API-Key: la clave de ESE comercio
                                             { token }
                                             → { account_id, external_id, persona }

5. NexoPOS contesta              → { accountId, storeId, displayName }
```

**El paso 3 ya está construido de nuestro lado y probado.** Falta el 4, que es un
pase de pelota.

### Por qué preguntar y no que nos avisen

NexoPOS proponía que ClubPay le empuje el token al emitirlo
(`POST /api/clubpay/handoff`) y guardarlo hasheado dos minutos. Funciona, pero deja el
token **en dos sistemas**: se duplica el lugar del que puede filtrarse, y aparece un
estado nuevo —emitido en uno, no llegado al otro— que hay que diagnosticar el día que
alguien no pueda entrar.

Preguntando, el token vive en un solo lado, que es el que lo emitió. Y el que lo
valida es el que lo hasheó. Menos piezas, y ninguna pieza nueva: el endpoint de
ClubPay ya existe y ya está probado.

## 3. Lo único que falta en el contrato: `storeId` de vuelta

ClubPay devuelve `{ account_id, external_id, persona }`. **Falta decir de qué comercio
es.**

Del lado de ClubPay no hace falta, porque la clave del comercio ya dice cuál es. Pero
en la cadena de arriba el que tiene la clave del comercio es NexoPOS, y **NexoTienda
atiende todas las tiendas con la misma clave**. Sin el `storeId` de vuelta, un token
emitido para la libreta de Jure abre sesión en `delfin.nexotienda.app`.

No es teórico: ya lo probamos. La verificación está escrita y funcionando —token de
otra tienda, rechazado— pero **necesita que el canje diga de qué tienda es**. Es el
campo `storeId` que NexoPOS ya había puesto en su propuesta; solo hay que asegurarse
de que sobreviva el paso por ClubPay.

Es la diferencia entre una comprobación que hacemos nosotros y una que tenemos que
creerle a quien trajo el token.

## 4. La URL de la tienda, que es lo que ClubPay pidió

**No hay patrón que puedan armar solos, y no conviene que lo intenten.**

El slug lo **elige el comerciante** y vive en NexoPOS. "Jure Hnos SRL" es `jure`, no
`jure-hnos-srl`. Un patrón adivinado da un 404, y un 404 en el único botón que lleva a
la tienda es peor que no tener el botón.

Necesitan dos campos en la ficha del comercio, donde ya viven el nombre y la
dirección:

| Campo | Qué es |
|---|---|
| `storefrontSlug` | `"jure"`. La URL es `https://<slug>.nexotienda.app` |
| `storefrontPublished` | Si la tienda está publicada |

**Y la respuesta a la otra pregunta es no: no todo comercio tiene tienda.** Es una
decisión del comerciante —hay comercios que usan NexoPOS y no venden online (D16)— así
que el botón aparece solo con `storefrontPublished: true`.

**Un regalo del diseño: pueden cachear el slug sin miedo.** Si el comerciante lo
cambia, el viejo sigue redirigiendo para siempre (`previousSlugs`) porque acá los links
viajan por WhatsApp y no se pueden dejar morir. Un slug desactualizado en ClubPay
llega igual a la tienda correcta.

## 5. Respuestas cortas a NexoPOS

**El detector de duplicados por teléfono: sí, y el hallazgo es bueno.** Que el
documento no cruce por un dígito comido y el teléfono sí normalice era exactamente al
revés de lo esperable, y lo probaron con los cuatro casos. Que no fusionen solos
también es correcto: fusionar es sumar saldos, y si está mal alguien queda debiendo lo
que no debe.

**Si un canje resuelve a más de una ficha: error explícito, nunca elijan.** Algo como
`vinculo_ambiguo`, y nosotros mostramos "no pudimos abrir tu libreta" con el botón para
hablar con el comercio. Es la misma válvula de siempre: cuando el sistema no puede,
que hablen las dos personas.

Con el QR sobre la ficha eso no debería pasar nunca, que es justo lo que lo hace valer.

**El QR ata una ficha y no un DNI: tienen razón y es más fuerte que nuestro
argumento.** Nosotros dijimos que hereda la verificación del mostrador; ustedes
notaron que además esquiva el dato mal escrito, porque el comerciante muestra el QR de
*la ficha que tiene abierta*. El problema de los dos German Yovan deja de existir para
todo cliente nuevo sin resolver un solo duplicado viejo.

**Sobre cortar sesiones: de acuerdo con que la sesión no tenga autoridad**, y ya está
así: la cookie dice qué libreta es y todo lo demás se pregunta en cada operación.

Pero **sí queremos la marca de desvinculación**, y por un motivo concreto: hoy, si el
comerciante desvincula a alguien o la persona pierde el teléfono, **nadie puede cerrar
esa cookie**. Ni ClubPay ni ustedes ni nosotros: vive en un navegador. La marca es la
única revocación que existe en este diseño. Con un `unlinkedAt` por cuenta comparamos
contra cuándo se abrió la sesión y la cerramos sola.

No bloquea nada, pero no es redundante con lo otro.

## 6. Lo que decidió Germán

**La libreta online requiere ClubPay, sí o sí. Sin ClubPay no hay libreta online.**

Ya está implementado, y con cuidado en la letra chica: sin sesión **no sabemos** si esa
persona tiene libreta o no, así que el mensaje no lo afirma. Dice *"Si ya tenés libreta
con Jure, entrá desde ClubPay para usarla acá. Si todavía no, se abre en el
mostrador."* — sirve para los dos casos, no le niega a nadie algo que el comerciante le
dio, y ahora dice **cómo se entra**, que es lo que faltaba.

El que no tiene ClubPay sigue comprando fiado en el mostrador como toda la vida.

## 7. Lo que ya está construido de este lado

- **`/entrar?t=…`**: el canje, con `Referrer-Policy: no-referrer` —la tienda carga
  fotos de servidores ajenos y sin eso el token se le cuenta a un CDN de imágenes— y
  con la verificación de que el token sea de esta tienda.
- **`/salir`**: por `POST`, no por link. Con un link, el prefetch de Next cerraría la
  sesión al pasar el mouse por encima del botón.
- **La franja de "Libreta de Germán Yovan abierta · Salir"**, arriba de todo. Acá los
  teléfonos se comparten y una libreta abierta sin nombre es una puerta que nadie sabe
  que quedó abierta.
- **Sesión de 30 días**, la cookie `httpOnly` y por comercio.

Probado de punta a punta contra fixtures: token válido abre, token inventado manda a
"volvé a entrar desde ClubPay", token de otra tienda rechazado.

## 8. Lo que falta, en orden

1. **ClubPay devuelve `storeId`** en el canje (sección 3). Es lo único que bloquea.
2. **NexoPOS encadena el paso 4** (sección 2).
3. **Nexo B2B o NexoPOS le mandan a ClubPay `storefrontSlug` y
   `storefrontPublished`** (sección 4).
4. **ClubPay agrega "Ir a la tienda"** en Mis comercios. Es lo único que espera un
   build de app, y por eso conviene que sea lo último.

**Mientras tanto no estamos bloqueados.** El que quiere usar la libreta en la tienda ve
la opción grisada diciéndole que entre desde ClubPay, que es la verdad. Cuando el
botón exista, el camino ya está hecho.

### Y sobre la puerta 2, que no existe todavía

ClubPay avisó que `clubpay://` abre la app pero no tiene rutas, así que una URL de
retorno cae en "Esta pantalla no existe". Entonces el caso "estoy en el navegador,
llegué por WhatsApp, quiero la libreta" no se resuelve con un deep link todavía.

**No lo forcemos.** Por ahora ese camino es: abrí ClubPay, Mis comercios, Ir a la
tienda. Un rodeo de tres toques que funciona, contra una ruta nueva en la app que hay
que mantener para siempre. Cuando haya un build que la justifique, se agrega.
