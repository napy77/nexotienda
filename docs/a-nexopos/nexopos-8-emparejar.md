# NexoPOS → abrir la libreta en otra pantalla

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Un caso que apareció probando y que no cubre el handoff: **la tienda abierta en la
computadora de casa y ClubPay en el celular.** El handoff abre la tienda *en el
teléfono*, y la computadora no tiene forma de demostrar quién es.

La solución es emparejar las dos pantallas con un código corto —no un QR: nadie
escanea su propia compu, y el código además no se reenvía por WhatsApp—. **El pedido
grande va para ClubPay**, que es quien tiene la app y la sesión de la persona. A
ustedes les toca ser el paso del medio, como en el canje.

---

## Los dos endpoints, que son pase de pelota

```
POST /v1/cuentas/emparejar              (clave `cuentas`)
{ "storeId": "12" }
→ { "requestId": "…", "code": "VRCCX", "expiresAt": "…" }
    ↳ se lo piden a ClubPay con la clave de ESE comercio, la que ya tienen

GET  /v1/cuentas/emparejar/:requestId?storeId=12     (clave `cuentas`)
→ { "status": "pendiente" }
| { "status": "listo", "token": "…" }
| { "status": "vencido" }
    ↳ el `token` es el mismo de un solo uso del handoff: lo canjeamos con
      POST /v1/cuentas/canjear, que ya existe y ya funciona
```

Es la misma forma que el canje y por el mismo motivo: nosotros no tenemos ni podemos
tener la clave de cada comercio, ustedes sí.

**Y termina en el canje que ya construimos**, no en una sesión nueva. Una segunda
forma de abrir sesión sería una segunda superficie que auditar.

## Lo que ya está de este lado

Construido y probado contra datos de prueba: la pantalla de libreta, cuando no hay
sesión, ofrece **"Abrir mi libreta en esta pantalla"**, muestra el código, espera, y
cuando se aprueba la libreta aparece sola.

El `requestId` no vuelve al navegador: queda en una cookie `httpOnly`. Aunque alguien
apruebe un pedido ajeno, solo el navegador que lo abrió puede canjearlo.

## Una cosa que les puede tocar mirar

El pedido a ClubPay incluye una descripción corta del dispositivo que pide —"una
computadora con Chrome"— para que la pantalla de confirmación de la app pueda mostrarla.

**No es decoración: es la única defensa del mecanismo.** El ataque no es robarle el
código a alguien —el código aparece en la pantalla del que lo pidió— sino al revés:
que el atacante abra el pedido en su compu y convenza a la víctima de escribir *ese*
código en su ClubPay. Una confirmación que solo dice "¿Confirmás?" no le da a la
persona con qué darse cuenta.

Si el dato pasa por ustedes, que pase tal cual y sin agregarle nada: es lo que el
navegador dice de sí mismo, no hace falta nada más.
