# Emparejar: el tramo que falta es el del medio, y es de ustedes

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.
>
> ⚠️ **Resuelto.** Corrieron el diagnóstico y las dos causas eran suyas: reenviaban el
> 404 de ClubPay como propio, y llamaban a `/pos/tienda/pairings` en vez de
> `/pos/tienda/emparejar`. Las dos corregidas. Queda como registro de cómo se ordenó.

Tres equipos diciendo que falta el de al lado. Esto lo ordena con evidencia, no con
opiniones.

---

## El dato que lo resuelve

**La libreta se abre bien desde ClubPay.** Germán lo probó: toca "Ir a la tienda" en
Mis comercios y entra con la libreta abierta.

Ese camino es:

```
NexoTienda  →  NexoPOS /v1/cuentas/canjear  →  ClubPay /pos/tienda/sessions   ✅ anda
```

Si eso funciona, **el enlace entre ustedes y ClubPay ya está probado**: la clave del
comercio es correcta, la URL es correcta, el pase de pelota funciona. No hay nada que
descubrir ahí.

El emparejamiento es **el mismo pase de pelota, otra ruta**:

```
NexoTienda  →  NexoPOS /v1/cuentas/emparejar  →  ClubPay /pos/tienda/emparejar   ❌ no anda
```

ClubPay dice que su punta está construida. Nosotros llamamos y no vuelve nada. **El
tramo que queda en el medio es el suyo.**

## Cómo se comprueba en treinta segundos

Contra su API, con la clave de `cuentas` que ya usan:

```bash
curl -i -X POST "$NEXOPOS_API_URL/v1/cuentas/emparejar" \
  -H "Authorization: Bearer $NEXOPOS_KEY_CUENTAS" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"no-existe","clientHint":"prueba"}'
```

Lo que devuelva dice quién tiene que mover:

| Respuesta | Qué significa |
|---|---|
| **404** | La ruta no existe. Es de ustedes. |
| **400 / 409 / 422** | La ruta existe y rechaza el comercio inventado. **Perfecto** — probá con un `storeId` real |
| **401** | Problema de clave, avísennos |
| **502 / 504** | La ruta existe pero el salto a ClubPay falla. Es de ustedes, y es el caso más probable |

## Lo que les pedimos

1. **Corran ese `curl` y díganos qué da.** Es lo único que hace falta para saber de
   quién es el trabajo, y lo pueden correr solo ustedes.
2. **Si es 404: construyan las dos rutas**, encadenadas contra ClubPay igual que
   `canjear`. Son las mismas que ya habían construido antes de que les pidiéramos
   colapsarlas en una — **ese ida y vuelta fue culpa nuestra** y puede haber quedado
   a mitad de camino.
3. **Si es 502: díganos qué contesta ClubPay**, con status y cuerpo. Se lo llevamos
   nosotros a ellos.

Las dos rutas, para que quede una sola versión escrita:

```
POST /v1/cuentas/emparejar                        (clave `cuentas`)
{ "storeId": "12", "clientHint": "una computadora con Chrome" }
→ { "requestId": "…", "code": "VRCCX", "expiresAt": "…" }

GET  /v1/cuentas/emparejar/:requestId?storeId=12  (clave `cuentas`)
→ { "status": "pendiente" } | { "status": "listo", "token": "…" } | { "status": "vencido" }
```

El `token` de "listo" se canjea con `POST /v1/cuentas/canjear`, que ya existe y ya
funciona.

## Una pregunta

**¿Ya están apuntando a los endpoints de ClubPay o todavía a un simulador?** En su
respuesta anterior decían que probaron "contra un simulador con la forma que le pedimos
a ClubPay". Si quedó apuntando ahí, todo pasa de este lado y nada llega a ClubPay — y
los tres tendríamos razón al mismo tiempo.

## De nuestro lado

Está construido, desplegado y **ya no falla en silencio**: agregamos la línea de log
que faltaba. Un 404 se traducía a `null` sin dejar rastro, así que la pantalla degradaba
correctamente al camino del teléfono y no había forma de saber por qué.
