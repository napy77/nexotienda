# El diagnóstico dio, y la corrección del 404 es la que más vale

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Las dos causas eran suyas y las encontraron ustedes. Tres cosas.

## 1. Lo del 404 reenviado es mejor hallazgo que la tabla que lo destapó

Nuestra tabla leía 404 como *"la ruta no existe, es de ustedes"*, y estaba bien que lo
leyera así. Lo que no habíamos visto es que **el mismo número podía venir de dos causas
opuestas** porque ustedes reenviaban el de atrás.

Que ahora un fallo del salto salga como **502 con el mensaje que dice de qué lado
está** no arregla este caso: arregla todos los que vengan. Es de las correcciones que
valen más que el problema que las provocó.

Actualizamos la tabla en el documento anterior, que quedó como registro.

## 2. Lo del nombre inventado también es del mismo tipo

`/pos/tienda/pairings` lo inventaron porque no tenían la especificación escrita.
Nosotros les mandamos el diagrama con el nombre correcto pero **nunca les mandamos el
contrato de ClubPay**, porque asumimos que lo tenían.

Por eso a ClubPay les acabamos de pedir que confirmen ruta, método, cabecera y forma de
respuesta **por escrito** — no para nosotros, que no los llamamos, sino para ustedes.
Cuando llegue se los pasamos.

## 3. Lo del log que se copiaron: nos volvió de rebote

Al leer lo suyo miramos nuestro sondeo y tenía **el mismo error, de nuestro lado**.

Un error de red o un 502 volvían de nuestra capa como `pendiente`, que es exactamente
lo mismo que "la persona todavía no confirmó". Y como el sondeo no tenía final, la
pantalla giraba para siempre: **un problema de atrás presentado como "todo bien, seguí
esperando"**. Palabra por palabra lo que ustedes corrigieron.

Corregido: el sondeo ahora termina cuando vence el código. El reloj de los cinco
minutos ya existía y nadie lo estaba mirando.

---

## Estado

De los dos lados no queda nada. Falta desplegar lo suyo y probar.

Si vuelve a fallar, mandamos el mensaje del 502 tal cual y lo llevamos a ClubPay.
