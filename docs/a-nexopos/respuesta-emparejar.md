# Emparejar: tienen razón con el `device`, y quizá con más que eso

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

## Lo del `device` estaba mal y ya está corregido

Escribimos que era "la única defensa del mecanismo". **Es exactamente al revés de lo
que dijimos**: en ese ataque el que abre el pedido es el atacante, así que la cadena la
escribe él y puede poner "tu iPhone".

Corregido en los dos documentos y en el comentario del componente, para que nadie se
apoye en eso. Queda como sirve de verdad: color en el caso honesto —"sí, es mi
compu"— y nada más.

Y su lectura de qué sí es confiable es la correcta: **el nombre del comercio**, porque
ClubPay lo deduce de la clave, y **la pregunta**, que no depende de ningún dato que
nadie controle.

## Pero al corregirlo quedó algo peor a la vista

Si el `device` no vale, la defensa entera es una frase. Y la acción que le estamos
pidiendo a la persona —*"escribí este código en tu app y confirmá"*— es la que **no
tiene ninguna defensa cultural**: se parece a emparejar un televisor o poner la clave
del wifi. Nadie creció escuchando que no hay que hacerlo.

Así que proponemos dar vuelta la dirección.

### Hoy: el código nace en la computadora

```
la compu genera VRCCX  →  la persona lo tipea en la app  →  la app confirma
```
El atacante muestra *su* código y convence a la víctima de tipearlo. La víctima hace
algo que se siente inofensivo.

### Propuesta: el código nace en la app

```
la app genera VRCCX  →  la persona lo tipea en la computadora  →  listo
```

El atacante ahora necesita que la víctima **le dicte** un código que tiene en su app. Y
eso sí tiene diez años de entrenamiento encima: *"nunca le des tu código a nadie"* lo
repiten todos los bancos del país, y el aviso puede ir **en la misma pantalla que el
código**, que es el momento de máxima atención — no en una confirmación que la persona
está tratando de sacarse de encima.

**No elimina el ataque. Lo muda a un terreno donde la gente ya está parada.** Eso es
todo lo que estamos diciendo, y esta vez no queremos exagerar de nuevo.

### Y además es más simple para todos

| | Hoy | Propuesta |
|---|---|---|
| Endpoints suyos | dos | **uno** |
| Sondeo cada 3 segundos | sí | **no** |
| Pedido pendiente en ClubPay | sí | **no** |
| Cookie con el `requestId` | necesaria | no hace falta |

La compu manda `{ code, storeId }` y le contestan el token o un error. Se acabó.

Regalo: como el código nace atado a un comercio y la compu manda en cuál está parada,
**un código de Jure tipeado en la tienda de Delfín falla solo**.

Lo que se pierde es la cookie que ustedes elogiaron. Vale la pena decir por qué no
duele: esa cookie protegía de "que otro apruebe tu pedido", que **no es el ataque**. En
el ataque real el navegador que abrió el pedido es el del atacante y la cookie está de
su lado.

### El costo

Sus dos endpoints se vuelven uno, del mismo tipo: pase de pelota. ClubPay todavía no
construyó nada, así que para ellos no hay nada que tirar. De nuestro lado, la pantalla
pasa de esperar a tener un campo de texto, que es menos código del que ya escribimos.

**Marcamos el pedido a ClubPay como "no construir todavía"** hasta que Germán decida.
Frenarlos un día es barato; que construyan la dirección que después cambiamos, no.

## Lo que no cambia en ninguna de las dos

Conviene tenerlo escrito, porque es lo que define cuánto importa todo esto: **una
sesión robada acá no vacía una cuenta.** Sirve para encargar mercadería a la libreta de
alguien — y ese pedido le aparece a la persona en ClubPay, tiene que aceptarlo el
comerciante, y termina con alguien retirando la mercadería del mostrador de un comercio
de pueblo que lo conoce de la cara.

No es un consuelo: es contención estructural, y no la pusimos nosotros. Está bueno
tenerla en cuenta antes de blindar esto más de lo que da.

## Sus dos preguntas a ClubPay

**Cinco minutos: de acuerdo**, y el argumento es el correcto —lo que se tarda en
caminar del escritorio al teléfono—. Nosotros teníamos tres y no defendemos el número.

**Tope de pedidos por persona: sí, y agreguen el otro.** No alcanza con limitar cuántos
pedidos se abren: hay que limitar **cuántos códigos puede intentar una misma cuenta**,
o cinco caracteres se prueban a mano.

---

## Estado

- Sus dos endpoints: construidos, y si se invierte la dirección se vuelven uno.
- Lo nuestro: andando contra datos de prueba, en cualquiera de las dos direcciones.
- La decisión de la dirección: de Germán, con nuestra recomendación arriba.
- ClubPay: frenado a propósito hasta que eso se resuelva.
