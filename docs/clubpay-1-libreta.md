# ClubPay → lo que necesitamos para la libreta en la tienda

Respuesta a lo que mandaron. El token está perfecto y la acotación a la relación
—persona + comercio, no persona + comercio genérico— es mejor que lo que habíamos
pedido.

Hay **una cosa que cambia** y **dos datos que faltan**.

---

## 1. El canje no puede ir directo de la tienda a ustedes

Su endpoint pide `X-API-Key: <la clave de ese comercio>`. NexoTienda no puede usarlo,
y no es una preferencia:

**NexoTienda tiene tres claves separadas por capacidad —catálogo, pedidos, cuentas—,
ninguna por comercio.** Es *un solo servidor que renderiza la tienda de cualquier
comercio*, no es cliente de uno. Hoy son cuatro tiendas, en un año son cuatrocientas:
cuatrocientas claves de ClubPay adentro del proceso que atiende a las cuatrocientas no
tiene forma, y además concentra en un solo lugar el poder de hablar por cada comercio.

Quien **sí** tiene legítimamente la clave de cada comercio es NexoPOS: una por
comercio, porque NexoPOS es el sistema de ese comercio.

**Lo bueno: no tienen que tocar nada de lo que construyeron.** La propuesta es
encadenar:

```
1. La app pide el token        app → ClubPay
                               POST /me/merchants/:vinculacion_id/tienda
                               → { token, expires_at }

2. La app abre la tienda       jure.nexotienda.app/entrar?t=…

3. La tienda canjea            NexoTienda → NexoPOS
                               POST /v1/cuentas/canjear  (clave `cuentas`)

4. NexoPOS les pregunta        NexoPOS → ClubPay
                               POST /pos/tienda/sessions
                               X-API-Key: la clave de ESE comercio   ← la que ya tienen
                               { token }

5. Vuelve la sesión            → { accountId, storeId, displayName }
```

Su endpoint queda igual. El único que cambia es **quién lo llama**: NexoPOS en vez de
nosotros. Ya lo hablamos con ellos y están de acuerdo.

El paso 3 ya está construido y probado de nuestro lado.

## 2. El `storeId` que les íbamos a pedir: **no hace falta, olvídenlo**

Si ya lo vieron en una versión anterior de este documento, dénlo de baja.

Habíamos pedido que el canje devolviera de qué comercio es la cuenta. NexoPOS lo
resolvió mejor: **NexoTienda le manda el `storeId` en el pedido** —siempre lo sabe,
porque el canje ocurre en `jure.nexotienda.app`— y con eso ellos saben con qué clave
preguntarles a ustedes.

Y ahí la protección sale sola: si el token es de Jure y se canjea diciendo "tienda de
Delfín", **ustedes lo validan contra la clave de Delfín y no coincide**. Lo que les
pedíamos como campo nuevo ya lo hacía su propio diseño.

No agreguen nada. Un campo que nadie lee envejece peor que no tenerlo.

## 3. La URL de la tienda: no hay patrón, y no conviene que lo inventen

Preguntaron si pueden armarla solos con algún dato que ya tengan. **No.**

El slug lo **elige el comerciante** y vive en NexoPOS. "Jure Hnos SRL" es `jure`, no
`jure-hnos-srl` ni `jurehnossrl`. Cualquier patrón adivinado da un 404, y un 404 en el
único botón que lleva a la tienda es peor que no tener el botón.

Necesitan dos campos en la ficha del comercio, donde ya viven el nombre y la
dirección:

| Campo | Qué es |
|---|---|
| `storefrontSlug` | `"jure"`. La URL es `https://<slug>.nexotienda.app` |
| `storefrontPublished` | Si la tienda está publicada |

**Y la respuesta a su otra pregunta es no: no todo comercio tiene tienda.** Hay
comercios que usan NexoPOS y no venden online, y es una decisión del comerciante. El
botón aparece solo con `storefrontPublished: true`.

**Un regalo del diseño: pueden cachear el slug sin miedo.** Si el comerciante lo
cambia, el viejo sigue redirigiendo para siempre, porque acá los links viajan por
WhatsApp y no se pueden dejar morir. Un slug desactualizado en ClubPay llega igual a
la tienda correcta.

## 4. Sobre la vuelta a la app: de acuerdo, no la fuercen

Dijeron que `clubpay://` abre la app pero no tiene rutas, y que una URL de retorno
caería en "Esta pantalla no existe". **Coincidimos en no construirla todavía.**

Eso deja sin resolver un caso: "estoy en el navegador, llegué por WhatsApp, quiero
comprar en la libreta". Por ahora ese camino es **abrí ClubPay → Mis comercios → Ir a
la tienda**: tres toques de rodeo que funcionan, contra una ruta nueva en la app que
hay que mantener para siempre. Cuando haya un build que la justifique, se agrega.

Ya está puesto en la tienda: al que intenta usar la libreta sin sesión le aparece la
opción grisada diciéndole que entre desde ClubPay.

## 5. El QR del mostrador: se lo va a pedir NexoPOS

Van a recibir un pedido de ellos para que la app pueda **iniciar una vinculación
escaneando un QR** (hoy su endpoint recibe un DNI y nada más).

Vale la pena que sepan por qué, porque es más fuerte de lo que parece. En la pantalla
de clientes de Jure hay **dos "German Yovan"**: documentos `2698535` y `26098535`,
saldos $850 y $27.519,20. Es el mismo documento con un dígito comido, el día uno, con
el nombre del fundador.

El QR del mostrador no ata un DNI a una persona: **ata una ficha a una persona.** El
comerciante tiene abierta la ficha de $27.519,20 y muestra el QR *de esa ficha*. El
problema de los datos mal tipeados deja de existir para todo cliente nuevo.

## 6. Preguntas que nos quedaron

1. **Si la persona pierde el teléfono o cierra sesión en ClubPay**, ¿hay forma de que
   nos enteremos? La sesión de la tienda es una cookie en un navegador: **nadie puede
   cerrarla**, ni ustedes ni nosotros. Le pedimos a NexoPOS una marca de
   desvinculación para poder invalidarla; si el evento nace de su lado, avísennos y
   vemos por dónde viaja.
2. **¿El token se puede emitir más de una vez seguida** para la misma relación? Si
   alguien toca "Ir a la tienda" dos veces porque la primera no cargó, ¿el segundo
   pedido invalida al primero o conviven?

---

## En orden

1. Recibir `storefrontSlug` y `storefrontPublished` en la ficha del comercio
2. Agregar "Ir a la tienda" en Mis comercios
3. Aceptar iniciar una vinculación desde un QR escaneado (el pedido viene de NexoPOS)

**Ya no hay nada que los bloquee de nuestro lado.** El canje está construido y probado
de punta a punta contra datos de prueba.

Lo tercero es lo único que espera un build de app, y por eso conviene que sea lo
último: cuando el botón exista, todo el camino de atrás ya va a estar hecho y probado.
