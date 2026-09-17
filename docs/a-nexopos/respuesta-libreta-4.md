# Los resúmenes no van a la tienda

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Germán decidió, y coincide con lo que ustedes recomendaron: **si la libreta online
requiere ClubPay sí o sí, la pila de resúmenes ya está ahí.**

Su argumento fue el que definió la decisión, así que va textual para que quede en el
registro: no es un intercambio entre mostrar más y mostrar menos, es *mostrarle lo
mismo dos veces a la misma gente, con dos implementaciones que pueden
desincronizarse*.

## Lo que significa para ustedes

**Pueden retirar `GET /v1/stores/:id/accounts/:acc/statements/:st/entries`**, o dejarlo
para otro consumidor si lo tienen. NexoTienda ya no lo llama, y tampoco lee
`statements` del objeto de cuenta. Si lo sacan del payload, no rompe nada de este lado.

**Lo que sí necesitamos del estado es lo que ya mandan**, y ahora es todo lo que la
pantalla usa:

```
balanceCents      ← cuánto debe. El número por el que entró.
availableCents    ← cuánto puede cargar. `null` = sin límite, el caso común.
closingDay, dueDay
currentPeriod     ← para "vence el 20 de octubre"
paused, onlineEnabled, linkedAt
```

## Lo que borramos de este lado

La pantalla de libreta quedó en dos preguntas: **cuánto debo y cuánto puedo cargar.**
Más el aviso de pausa, el pago y el botón al comercio.

Y borramos de verdad: los tipos `AccountStatement` y `AccountEntry`, el método del
port, el mapeo del adapter y la sección de resúmenes de la pantalla. No lo dejamos
apagado detrás de un `if`. Es el mismo criterio que nos dieron ustedes con
`vinculo_ambiguo` —una rama que nunca se va a ejecutar envejece mal— y sería
incoherente aceptarlo para lo suyo y no aplicarlo a lo nuestro. Está en el historial de
git si algún día cambia la decisión.

## Una cosa que se cayó sola y les puede interesar

Los fixtures emulaban **la imputación**: el pago se aplicaba del resumen cerrado más
viejo al más nuevo y lo que sobraba iba al abierto.

Eso ya no está, y no porque sobrara código: **estaba mal que existiera.** D31 dice que
la imputación es del libro y no de la vidriera, y ahí teníamos una segunda
implementación de la regla más delicada de la cuenta corriente, en un archivo de datos
de prueba, lista para divergir de la de ustedes sin que nadie se enterara.

Ahora el pago de este lado hace lo único que la tienda necesita: baja el saldo y libera
disponible. Cuál resumen se cancela primero lo decide el libro.

---

## Estado

Nada pendiente entre nosotros. Lo que queda es el pedido del QR, que va a ClubPay.
