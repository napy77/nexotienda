# `/api/v1/fichas` devuelve siempre la misma página: ninguna corrección del catálogo llega desde julio

> **Para el equipo de Nexo B2B.** Este archivo se manda tal cual.

Los nombres que corrigieron en el catálogo maestro no llegan a ningún NexoPOS, y por lo
tanto tampoco a ninguna tienda online. Ejemplo en Supermercado Delfín: "Gall. bagley
chocolinas 40x170gr", "Liq. limp. poett 3x4L f.p", etc., siguen con el título viejo.

NexoPOS corre el sync cada hora y está sano. El problema es que **la paginación de
`/api/v1/fichas` no avanza**: pasándole el `siguiente` que ustedes mismos devuelven,
vuelve la misma página. El sync lee 100.000 fichas por corrida (su tope), que son
las mismas cinco páginas repetidas, y el cursor queda clavado en el 6 de julio.

---

## La prueba, del 2026-09-23

Tres llamadas con `limite=5`, reenviando `siguiente` tal cual, como pide DEC-008:

```
desde=2026-07-06T17:50:05.633Z  desde_id=023c3e62-3f79-4249-b957-9a2e49b5cd8a

pág 1 → 000049f3…, 0003af66…, 000419f4…, 0004f797…, 0005361a…   (todas 2026-07-06T17:50:05.633Z)
        siguiente = { desde: 2026-07-06T17:50:05.633Z, desde_id: 0005361a-18a0-44de-988d-6e82f207a7db }
pág 2 → 000049f3…, 0003af66…, 000419f4…, 0004f797…, 0005361a…   ← idéntica
pág 3 → 000049f3…, 0003af66…, 000419f4…, 0004f797…, 0005361a…   ← idéntica
```

Dos cosas se ven ahí:

1. **`desde_id` no filtra.** Con `desde_id=023c3e62…` la página empieza en `000049f3…`,
   que es *menor* que el id del cursor. Tendría que empezar después.
2. **Sin `desde_id` la respuesta es la misma** que con él. El parámetro no está
   cambiando nada.

El 6 de julio a las 17:50:05.633 hubo un UPDATE masivo (el backfill del trigger,
suponemos): miles de fichas comparten esa marca. Es exactamente el caso que ustedes
midieron y que motivó el cursor `(fecha, id)`. La regla está bien; la consulta no la
está aplicando.

## Dónde sospechamos que está

Una de estas dos, o las dos:

- **La condición no usa el id.** Tiene que ser la comparación de tupla:

  ```sql
  WHERE (ficha_actualizada_at, id) > ($desde, $desde_id)
  ORDER BY ficha_actualizada_at, id
  LIMIT $limite
  ```

- **Precisión: la base guarda microsegundos y el cursor viaja en milisegundos.** Si
  la marca real es `17:50:05.633412`, entonces `(…633412, id) > (…633, cualquier_id)`
  es verdadero para *todas* las fichas empatadas, el id nunca llega a desempatar, y
  se devuelve siempre la primera página. Se arregla comparando y ordenando por
  `date_trunc('milliseconds', ficha_actualizada_at)`, o mandando `siguiente.desde`
  con los microsegundos completos.

## Cómo saber que quedó

La misma prueba: tres páginas seguidas con `limite=5`, reenviando `siguiente`, tienen
que traer **quince fichas distintas** y un `desde_id` que cambia. Si quieren la
contraprueba grande: con `desde=2026-07-06T17:50:05.633Z` y `limite=2000`, paginar
hasta `hay_mas=false` tiene que terminar, y la suma no puede pasar el total de fichas.

## Lo que no hace falta que hagan

Nada del lado de NexoPOS: su cursor sigue guardado en el 6 de julio y reenvía
`siguiente` sin tocarlo. Con el arreglo desplegado, en la siguiente corrida horaria
avanza solo y recorre todo lo que cambió desde entonces, incluidas las correcciones
de septiembre.
