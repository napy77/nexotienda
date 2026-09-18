# ClubPay → abrir la libreta en la computadora

> **Para el equipo de ClubPay.** Este archivo se manda tal cual.
>
> *Reemplaza a las dos versiones anteriores. La dirección vuelve a ser la del primer
> documento: el código nace en la computadora. Ustedes tenían razón.*

## Tenían razón, y el error fue nuestro

Dieron vuelta la dirección en la implementación, se las pedimos de vuelta, y ahora la
revertimos a la que ustedes defienden. Vale la pena decir **por qué nos equivocamos**,
porque el razonamiento equivocado puede volver:

NexoPOS nos mostró que la descripción del dispositivo no era una defensa —en ese
ataque el que abre el pedido es el atacante, así que esa cadena la escribe él—. De ahí
concluimos que la dirección estaba mal. **La conclusión correcta era más chica:** lo que
defiende no es el `client_hint`, es **la pantalla de confirmación**. Y esta dirección es
la única que tiene una.

Su argumento decisivo es el que no habíamos visto: **dónde puede intervenir el
defensor.** Así, el ataque pasa por una pantalla de ustedes, que puede nombrar el
comercio y preguntar. Invertido, en el momento en que alguien dicta el código la app no
participa: no hay pantalla donde poner nada.

Y la observación de que nuestro propio aviso —*"si alguien te lo pide, no se lo des"*—
era imposible de cumplir en el circuito que habíamos escrito es exacta. El texto y el
mecanismo se contradecían.

Lo de "no son el mismo mecanismo al revés, son dos" también quedó anotado. Un
emparejamiento de dispositivos y un OTP se parecen en la pantalla y no en el modelo de
amenaza.

## Ya está revertido

La pantalla vuelve a pedir el código, mostrarlo y esperar. Probado de punta a punta.

Tomamos los tres ajustes: **cinco minutos**, el alfabeto sin vocales y **10 intentos
cada 10 minutos por cuenta**. Y su respuesta sobre el tope de pedidos cierra: sin
bandeja de pendientes, cincuenta pedidos abiertos producen cero confirmaciones.

**Mandamos el `client_hint`** —"una computadora con Chrome"— y queda escrito en nuestro
código, en el de NexoPOS y en los dos pedidos que **no es prueba de nada**: sirve en el
caso honesto y como color. La defensa es el nombre del comercio, que ustedes deducen de
la clave, y la pregunta.

## La URL: sacando el `/s/`

Su plantilla es `https://{slug}.nexotienda.app/s/{slug}/libreta`, con el slug dos veces.
La correcta es:

```
https://{slug}.nexotienda.app/libreta
```

El `/s/{slug}` **es una reescritura interna nuestra**: un proxy toma el subdominio y lo
convierte en esa ruta. Nunca debió salir de acá, y que ustedes la hayan visto es un
problema de documentación nuestro. Funciona igual si la mandan, pero es una convención
interna que puede cambiar sin avisarles.

Lo mismo para la tienda: `https://{slug}.nexotienda.app`, y nada más.

## El slug: tienen razón y el ejemplo malo era nuestro

**Nosotros escribimos `jure` en los documentos.** Es el valor de nuestros datos de
prueba, y lo usamos como si fuera real. El de verdad es `jure-hnos-srl`. Ese 404 lo
pagaron ustedes por un ejemplo nuestro escrito sin verificar.

Y sí: **el slug tiene que llegarles como un dato**, en la ficha del comercio junto al
nombre y la dirección. Nunca deducido del nombre — lo elige el comerciante y no hay
ninguna regla que lo derive.

Van los dos campos que ya les habíamos pedido, ahora con más motivo:

| Campo | Qué es |
|---|---|
| `storefrontSlug` | `"jure-hnos-srl"`. La URL es `https://<slug>.nexotienda.app` |
| `storefrontPublished` | Si la tienda está publicada. **No todo comercio tiene tienda** |

Y el regalo de siempre: pueden cachearlo sin miedo. Si el comerciante lo cambia, el
viejo sigue redirigiendo para siempre — acá los links viajan por WhatsApp y no se
pueden dejar morir.

## El circuito, para que quede uno solo escrito

```
1. La compu pide el código   NexoTienda → NexoPOS → ClubPay
                             { storeId, clientHint } → { requestId, code, expiresAt }
2. La compu lo muestra
3. La persona lo escribe     ClubPay → Mis comercios → el comercio
                             → «Entrar en otra pantalla» → escribe el código → confirma
4. La compu pregunta cada 3s → { status: "pendiente" | "listo" + token | "vencido" }
5. Se canja                  el MISMO token de un solo uso del handoff
```

Aceptamos sus nombres en `snake_case` y los nuestros en `camelCase`, por si algún día
pasan derecho sin NexoPOS en el medio.

## Lo que sigue esperando

1. `storefrontSlug` y `storefrontPublished` en la ficha del comercio.
2. "Ir a la tienda" en Mis comercios — apuntando a `https://<slug>.nexotienda.app`.
3. "Entrar en otra pantalla" con el campo para el código.
