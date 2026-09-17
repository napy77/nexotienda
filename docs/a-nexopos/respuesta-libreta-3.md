# `closingDay` consumido, y el argumento de los resúmenes

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

## Los tres campos: tomados, y los dos que no pedimos eran los que faltaban

`closingDay`, `dueDay` y `currentPeriod` ya se consumen.

**`dueDay` tenían razón.** La pantalla decía "Cierra el 10 de cada mes" y ahora dice
"Cierra el 10 de cada mes y vence el 20", que es la frase entera. Si no lo mandaban,
lo pedíamos en dos semanas.

**`currentPeriod` también, y por el motivo que dan.** Un cierre el 31 en febrero es una
cuenta con borde, y el borde se descubre en febrero. Que la haga un solo lugar es lo
correcto. Por ahora la pantalla dice "cada mes" y le alcanza `closingDay`; cuando diga
"vence el 20 de octubre" sale de `currentPeriod`.

## Lo que apareció al consumirlo: faltaba el número por el que la persona entró

Al mirar la pantalla sin los resúmenes quedó a la vista algo que no era obvio con
ellos: **la libreta no decía cuánto se debe.**

Y peor: el número lo estábamos sacando de **sumar los resúmenes cerrados**. Esa suma
deja afuera el período abierto, así que a alguien que compró ayer le decía de menos.
Con los resúmenes presentes el error era chico y se disimulaba; sin ellos, la pantalla
directamente no decía nada.

Ahora usa **`balanceCents`**, que es el único dato que contesta esa pregunta sin
ambigüedad. La pila de períodos sirve para *entender* la deuda; el que sabe cuánto se
debe es el libro.

De paso quedó alineado con D31: el pago va **por importe libre contra la cuenta**, no
contra un resumen elegido. Ahora se paga contra el saldo, que es lo que esa decisión
decía desde el principio y nosotros estábamos contradiciendo sin darnos cuenta.

## Los resúmenes: su argumento es mejor que el nuestro

Nosotros lo planteamos como un intercambio entre mostrar más y arriesgar más. Ustedes
notaron que **no hay tal intercambio, porque la audiencia de las dos pantallas es la
misma por construcción**: la libreta online requiere ClubPay, así que todo el que
puede abrir esa pantalla ya tiene la pila de resúmenes en la app.

Eso convierte la decisión en otra cosa. No es "cuánto mostramos": es si le mostramos lo
mismo dos veces a la misma persona, con dos implementaciones que pueden no coincidir —
y basta que difieran en qué período está abierto para que alguien vea dos deudas
distintas del mismo comercio, que es lo peor que puede pasar acá.

**Coincidimos con su recomendación.** La decisión sigue siendo de Germán y le pasamos
el argumento tal como lo escribieron ustedes, que es más fuerte que como lo teníamos.

Mientras tanto, la pantalla ya funciona con lo mínimo: **cuánto debe, cuánto tiene
disponible, cuándo cierra y cuándo vence**, y una línea que dice que el detalle está en
ClubPay. Si Germán dice que los resúmenes van, el código que los muestra sigue
entero — nunca lo sacamos, solo dejó de tener datos.

## Una última

Nos alegra que se copien lo de comparar el valor y no la fecha. Le agregamos un motivo
que no habíamos dicho: además de sacar los relojes del medio, **funciona igual si el
vínculo va y vuelve**. Si desvinculan y vuelven a vincular a la misma ficha, el valor
cambia dos veces y la sesión vieja muere igual — comparando contra la hora de apertura,
una reconexión rápida podría dejarla viva.

---

## Estado

Nada bloqueado de ningún lado.

- `closingDay`, `dueDay` y `currentPeriod`: consumidos.
- `balanceCents`: consumido, y era el que faltaba.
- Los resúmenes: esperando a Germán, con la recomendación de ustedes y la nuestra, que
  son la misma.
