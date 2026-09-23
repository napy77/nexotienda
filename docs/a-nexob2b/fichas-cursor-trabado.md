# `/api/v1/fichas` devuelve siempre la misma página: ninguna corrección del catálogo llega desde julio

> **Para el equipo de Nexo B2B.** Este archivo se manda tal cual.

Los nombres que corrigieron en el catálogo maestro no llegan a ningún NexoPOS, y por lo
tanto tampoco a ninguna tienda online. Ejemplo en Supermercado Delfín: "Gall. bagley
chocolinas 40x170gr", "Liq. limp. poett 3x4L f.p", etc., siguen con el título viejo.

NexoPOS corre el sync cada hora y reenvía `siguiente` tal cual, como acordamos en
DEC-008. El problema es que **la paginación de `/api/v1/fichas` no avanza**: con el
`siguiente` que ustedes mismos devuelven, vuelve la misma página. El sync lee 100.000
fichas por corrida (su tope), que son la misma página repetida, y el cursor quedó
clavado en el 6 de julio.

**La causa está medida: la base guarda microsegundos y el cursor viaja en
milisegundos.** Abajo, la prueba y el arreglo.

---

## 1. La prueba, del 2026-09-23

Tres llamadas con `limite=5`, reenviando `siguiente` tal cual:

```
desde=2026-07-06T17:50:05.633Z  desde_id=023c3e62-3f79-4249-b957-9a2e49b5cd8a

pág 1 → 000049f3…, 0003af66…, 000419f4…, 0004f797…, 0005361a…   (todas 2026-07-06T17:50:05.633Z)
        siguiente = { desde: 2026-07-06T17:50:05.633Z, desde_id: 0005361a-18a0-44de-988d-6e82f207a7db }
pág 2 → 000049f3…, 0003af66…, 000419f4…, 0004f797…, 0005361a…   ← idéntica
pág 3 → 000049f3…, 0003af66…, 000419f4…, 0004f797…, 0005361a…   ← idéntica
```

Con `desde_id=023c3e62…` la página empieza en `000049f3…`, que es *menor*. Y sin
`desde_id` la respuesta es la misma. El id no está desempatando nada.

## 2. Por qué: 57.125 fichas con la misma marca, en microsegundos

En `nexob2b_db`:

```
      tabla       |        marca_exacta        | count
------------------+----------------------------+-------
 producto_maestro | 2026-07-06 17:50:05.633760 | 57125
```

El UPDATE masivo del 6 de julio dejó **57.125 fichas con `17:50:05.633760`**. Pero
`hasta` / `siguiente.desde` salen de un `Date` de JavaScript, que sólo tiene
milisegundos: viajan como `17:50:05.633`.

En `apps/backend/src/api/v1/fichas/route.ts` (línea 83 en adelante) la comparación de
tupla está bien escrita, pero recibe una fecha recortada:

```
(ficha_actualizada_at, id)  >  ($desde, $desde_id)
(17:50:05.633760,     id)  >  (17:50:05.633, 0005361a…)
```

`.633760 > .633` es verdadero para **las 57.125**, así que el primer elemento de la
tupla ya decide y el id nunca llega a compararse. Resultado: siempre la primera
página. Es el mismo caso que ustedes midieron para DEC-008, entrando por la precisión.

## 3. El arreglo que proponemos

**Que la marca se guarde y se compare en milisegundos**, que es lo único que puede
viajar en JSON sin perder nada. Dos pasos:

**a. El trigger guarda la marca recortada a milisegundos**, en lugar de
`clock_timestamp()` crudo:

```sql
NEW.ficha_actualizada_at := date_trunc('milliseconds', clock_timestamp());
```

**b. Una sola vez, recortar las que ya están:**

```sql
UPDATE producto_maestro
   SET ficha_actualizada_at = date_trunc('milliseconds', ficha_actualizada_at)
 WHERE ficha_actualizada_at <> date_trunc('milliseconds', ficha_actualizada_at);
```

(Si el trigger se dispara por cambios en esa misma columna, que no lo haga en este
UPDATE; según su API_CONTRACTS la marca sólo la mueven título, descripción, marca, etc.,
así que no debería.)

Con eso la marca que viaja y la que se guarda son la misma, la tupla desempata por id
y no hace falta tocar `route.ts`.

**Alternativa**, si prefieren no tocar los datos: en `route.ts`, comparar y ordenar por
`date_trunc('milliseconds', ficha_actualizada_at)` en lugar de la columna cruda, en el
`WHERE` y en el `ORDER BY`. Funciona igual; con ~70.000 fichas el costo de perder el
índice en esa expresión no se nota.

Lo que **no** recomendamos es mandar `siguiente.desde` con microsegundos: NexoPOS
guarda el cursor entre corridas y la próxima vez lo vuelve a leer con un `Date`, que
lo recorta de nuevo. Arreglaría la paginación dentro de una corrida y la dejaría
trabada entre corridas.

## 4. Cómo saber que quedó

Tres páginas seguidas con `limite=5`, reenviando `siguiente`, desde
`desde=2026-07-06T17:50:05.633Z&desde_id=0005361a-18a0-44de-988d-6e82f207a7db`, tienen
que traer **quince fichas distintas**, y la primera tiene que tener un id mayor a
`0005361a…`. Contraprueba grande: con `limite=2000`, paginar hasta `hay_mas=false`
tiene que terminar, y la suma no puede pasar el total de `producto_maestro`.

## 5. Avísennos cuando esté desplegado

Del lado de NexoPOS hay que reiniciar el cursor una vez, a antes del 6 de julio a las
17:50, porque durante estas semanas quedó guardado un id del medio del bloque empatado
y hay fichas de ese bloque que nunca se leyeron. Eso lo hacen ellos; sólo necesitan
saber cuándo.
