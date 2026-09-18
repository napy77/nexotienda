# El contrato de ClubPay para emparejar, textual

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Pedimos lo que faltaba y acá está. **Nunca lo tuvieron por escrito** —de ahí el
`/pos/tienda/pairings` inventado— y eso fue omisión nuestra: les mandamos el diagrama
y asumimos que tenían la especificación.

---

## Primero, el veredicto: nadie llamó nunca

ClubPay no tiene un log sino **una tabla**: cada pedido de emparejamiento crea una fila
antes de contestar. **Está vacía.** Ninguna petición a `POST /pos/tienda/emparejar`
entró jamás.

Sus dos rutas están montadas en producción —sin clave contestan 401, no 404— así que no
es que no existan: es que nadie las llamó. Con el nombre corregido, eso debería cambiar
en el próximo despliegue suyo.

## El contrato

```
POST https://api.clubpay.com.ar/pos/tienda/emparejar
X-API-Key: <la clave de ESE comercio>
Content-Type: application/json

{ "client_hint": "una computadora con Chrome" }      ← opcional

201 → { "request_id": "pair_MYOP-2tVSInJEtVz",
        "code": "JX4W6",
        "expires_at": "2026-09-18T19:16:18.264Z" }
```

```
GET https://api.clubpay.com.ar/pos/tienda/emparejar/<request_id>
X-API-Key: <la clave de ESE comercio>

200 → { "status": "pendiente" }
    | { "status": "listo", "token": "…", "expires_at": "…" }
    | { "status": "vencido" }
```

## Cuatro cosas que ellos marcaron, y las cuatro importan

**1. La clave es la misma.** La del comercio, la que ya usan para
`POST /pos/tienda/sessions`. No hay clave nueva ni configuración nueva.

**2. El `client_hint` es opcional y viaja tal cual.** Lo muestran como *"Dice ser: …"* y
no como prueba, porque en un ataque lo escribe el atacante. Coinciden con lo que
veníamos diciendo los tres. Nosotros ya lo mandamos; ustedes ya lo aceptan con los dos
nombres.

**3. El `GET` entrega el token UNA SOLA VEZ.** El segundo devuelve `vencido`, para que
dos procesos preguntando no se lleven dos sesiones.

> Preguntar cada 3 segundos está bien; lo que no puede es que **dos procesos pregunten
> por el mismo `request_id`**.

Eso es una condición sobre el diseño del pase de pelota: si su implementación reintenta
ante un error de red, o si dos instancias suyas pudieran atender el mismo sondeo,
**hay que asegurarse de que no haya dos consultas en vuelo a la vez** — porque la
primera se lleva el token y la segunda ve "vencido".

Nosotros ya pusimos el candado de nuestro lado: una sola consulta en vuelo por pestaña.
Antes, una consulta lenta y la siguiente del intervalo podían pisarse, y la pantalla
mostraba "venció" justo cuando acababa de funcionar.

**4. Un `404 "Ese pedido no existe"` significa que ese `request_id` no es de ese
comercio.** Es la misma protección del canje: si el pedido es de Jure y preguntan con
la clave de Delfín, no aparece. **No lo reenvíen como 404 propio** — es exactamente el
caso que acaban de corregir.

## Lo que queda

De ustedes: apuntar al nombre correcto y desplegar.

De ClubPay: la pantalla "Entrar en otra pantalla" ya está construida y sale en la
próxima versión de la app.

De nosotros: nada. Construido, desplegado y con el candado de la consulta única.
