# NexoPOS → saber si el comercio está abierto

Los pedidos ya entran (`P-06D042E1`, gracias). Apareció otra cosa probándolo.

Jure Hnos SRL estaba cerrado —abría a las 7:30 de la mañana siguiente— y el pedido se
mandó igual, sin que nada avisara. Del lado nuestro ya está resuelto para lo que
depende de nosotros; esto es la mitad que depende de ustedes.

---

## 1. Qué hicimos de este lado

Con el carrito cerrado y el comercio cerrado, hay dos casos distintos y el que manda
es **la política del producto**, no el rubro del comercio:

| El carrito tiene | Qué pasa |
|---|---|
| Solo productos `stock` | Se puede encargar, pero se pregunta primero: *"Jure Hnos SRL está cerrado. Abre en 9 horas (abre mañana a las 07:30). Si lo dejás encargado, lo van a ver al abrir."* |
| Alguna línea `declared` | **No se puede pedir.** "Comercio cerrado", con la opción de sacar esa línea y seguir con el resto |

El corte sale de D1/D3 y no lo inventamos para esto: `declared` es, textualmente, lo
que el comercio declaró que tiene **hoy**. La harina va a estar mañana; la pizza que se
declaró hoy no dice nada sobre las 7:30 de mañana.

Jure cae de los dos lados según el changuito, que es como tiene que ser: es almacén y
además hace pizzas.

**`unknown` no bloquea nada.** No saber la disponibilidad no es saber que no hay.

## 2. Lo que necesitamos: que `isOpenNow` sepa de la persiana

Hoy `isOpenNow` sale del horario cargado. El horario es una declaración de intención y
la realidad del pueblo no la respeta: se corta la luz, se acabó la mercadería a las
seis, hay velorio, o se quedan atendiendo hasta tarde porque hay gente.

Pedimos un **interruptor manual** que el comerciante pueda tocar desde el teléfono, y
que cuando esté tocado **gane sobre el horario en las dos direcciones**:

- Cerrar dentro del horario (se acabó todo, cerramos antes).
- Abrir fuera del horario (estamos atendiendo igual).

El interruptor **vuelve solo al horario** en el próximo cambio de tramo. Si el tipo
cierra a las seis de la tarde un martes, eso vale por lo que queda del martes, no para
siempre: nadie se acuerda de volver a prenderlo el miércoles, y un comercio que quedó
apagado sin darse cuenta no vende y no se entera de por qué.

### La caja como fuente, no como jefe

La idea de atarlo a la apertura y el cierre de caja nos parece la correcta: es el
gesto que el comerciante ya hace todos los días, y un interruptor más es un interruptor
que se olvida.

Pero **que sea opcional por comercio**. Un comercio que no tiene disciplina de caja
—abre una vez por semana, o nunca la cierra— quedaría permanentemente cerrado en la
tienda sin entender por qué. Si el comercio activa "usar la caja", la caja manda; si
no, manda el horario y el interruptor manual.

## 3. La regla que más nos importa de todo esto

**Ante la duda, `null`, nunca `false`.**

Si no se puede determinar el estado —no hay horario, la caja no se usa, falta el
dato— tiene que llegar `isOpenNow: null`. Nosotros lo mostramos como *"Podés dejar tu
pedido"* y el pedido sigue su camino normal.

Un `false` por defecto es una tienda que dice "cerrado" todo el día sin que nadie le
avise al dueño. Pierde todas las ventas y no hay forma de que se entere: el que entró y
vio "cerrado" no llama para avisar, se va. Un `true` inventado es peor al revés —manda
a alguien a un viaje al pedo—, pero al menos alguien se queja. El silencio no se queja.

## 4. Un detalle chico que suma

Cuando el comerciante cierra a mano, dejarle escribir **una línea**: *"Cerramos por
hoy, mañana desde las 7:30"*. Un campo `closedNote` opcional en el `Store`. Lo mostramos
tal cual, sin tocarle una coma.

## 5. Y la validación que importa

Lo del punto 1 es la pantalla. La que vale es la de ustedes: si entra un
`POST /v1/orders` con el comercio cerrado y alguna línea `declared`, **rechácenlo**, con
un mensaje que se pueda mostrar. El comprador puede tener la pestaña abierta desde hace
dos horas, y el que sabe si se puede hacer esa pizza es el POS, no nosotros.
