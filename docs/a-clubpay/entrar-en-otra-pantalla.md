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

## Las URLs y el slug

Están en **[libreta.md](libreta.md), sección 3**, que es donde se piden el botón y los
campos de la ficha. Van ahí y no acá para que haya **una sola versión escrita**: el
enredo del `/s/{slug}` salió justamente de que la misma respuesta estaba en dos
documentos distintos.

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

De este documento, uno solo: **"Entrar en otra pantalla"** con el campo para el código
y el endpoint de emparejar.

Lo demás —el slug en la ficha y el botón "Ir a la tienda"— está en
[libreta.md](libreta.md), que es donde vive.
