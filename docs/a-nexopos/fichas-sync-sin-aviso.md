# El sync de fichas lleva semanas sin avanzar y no dejó ninguna señal

> **Para el equipo de NexoPOS.** Este archivo se manda tal cual.

Ustedes no rompieron nada: el sync reenvía `siguiente` tal cual, como acordamos en
DEC-008. El que falla es `/api/v1/fichas` en Nexo B2B, que devuelve siempre la misma
página. Ya se lo mandamos a ellos con la prueba.

Lo que les pedimos es otra cosa: **que la próxima vez nos enteremos por el sistema y
no por un nombre viejo en la tienda.**

## Lo que se veía, y nadie miraba

```
sync_cursor  fichas-b2b | fecha 2026-07-06 17:50:05.633+00 | id 023c3e62… | corrida_at 2026-09-23 20:36 | ultimo_error (vacío) | leidos 100000

journalctl: [fichas] 100000 fichas de NexoB2B, 0 líneas del stock actualizadas   ← cada hora, igual
```

Tres señales, y ninguna era un error:

- el cursor no se movió entre corridas,
- `leidos` pegó contra el tope (100.000) en cada una,
- 0 líneas actualizadas, siempre.

`ultimo_error` vacío con todo eso es lo que hizo que pasara desapercibido.

## Lo que pedimos

**Si una corrida terminó con `hay_mas=true` y el cursor quedó donde empezó, eso es un
error**: escribirlo en `ultimo_error` y loguearlo como error, algo como
`"el cursor no avanza: NexoB2B devolvió la misma página"`.

Y conviene cortar la corrida apenas una página trae el mismo `siguiente` que la
anterior, en vez de pedir hasta el tope: hoy son 100.000 lecturas por hora contra B2B
que no sirven para nada.

## Cuando B2B despliegue su arreglo

No hace falta tocar el cursor: sigue guardado en el 6 de julio y con la paginación
arreglada recorre todo desde ahí en la siguiente corrida. Lo que sí les pedimos es
mirar que después de esa corrida **"líneas del stock actualizadas" no sea 0**. Si lo
es con fichas nuevas de verdad, el problema pasa a ser el cruce entre el `id` o las
`presentaciones[].id` de la ficha y `products.nexob2b_id`, y nos avisan.

(Aparte: `docs/DATABASE.md` de ustedes dice que `nexob2b_id` es `pp_…` o `pmp_…`, y
en producción son UUID. Vale corregirlo para que el próximo que diagnostique no
busque el prefijo.)
