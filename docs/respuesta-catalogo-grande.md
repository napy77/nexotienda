# Catálogo grande — migrado

Los tres endpoints están consumidos y **ya podemos confirmar la migración**: se pide
un pedazo, el árbol se recorre por ids y los destacados salen de ustedes.

Pueden sacar las dos formas viejas cuando quieran. De todos modos el adapter sigue
aceptando el arreglo pelado, no por desconfianza sino porque un rollback de ustedes no
tiene que tirar abajo la portada de todos los comercios mientras alguien despliega.
Cuesta cuatro líneas y compra tranquilidad.

## Lo que cambió de este lado

- **`listProducts` devuelve un pedazo.** La portada ya no pide el catálogo: pide los
  ids que sus estanterías nombran, en una sola consulta. Una góndola pide su góndola.
  Una búsqueda, su búsqueda.
- **El árbol se recorre por id.** Tenían razón con los prefijos: el camino vive en la
  URL como `s` repetido —`?p=despensa&s=r:Aceites&s=s:Girasol`— y al pedir el catálogo
  **viaja solo el último**. Mandar el camino entero obligaría a que los dos lados
  coincidan en cómo se llega, cuando lo único que hace falta es a dónde.
- **Dejamos de podar.** Antes teníamos el catálogo en memoria y descartábamos las
  ramas vacías nosotros. Ahora el árbol llega contado desde los productos del
  comercio, así que una rama que llega es una rama que tiene algo. Volver a deducirlo
  sobre las sesenta fichas que bajamos sería peor: escondería ramas por no haberlas
  mirado.

## Sus dos "no son errores" están contemplados

**El `productCount` del pasillo mayor que la suma de los hijos.** Esos productos —los
que están en el pasillo y sin rubro— caen en el chip **"Todo Despensa"**, que ya
existe y es el primero de cada nivel. No quedan huérfanos ni invisibles.

**El nodo "Otros".** Entra como una góndola más y se comporta igual. No lo tratamos
distinto y no hace falta que lo hagan.

## El piso de los destacados

3 unidades por producto y 5 productos por lista es un criterio, y lo importante es que
exista y esté escrito. Que los reembolsos resten no se nos había ocurrido y es
exactamente el mismo razonamiento: lo que se vendió y volvió no es lo que más se
vende.

**Y lo de medir "lo más buscado" en términos y no en productos es mejor que lo que
pedimos.** Nosotros dijimos "un piso" sin decir de qué; ustedes encontraron que
contando productos, cinco búsquedas con evidencia de sobra se volvían cuatro porque
dos términos caían en el mismo aceite. Eso es el piso funcionando al revés: descartando
justo la lista que sí tenía señal.

**Guardar el término y nada más está bien.** No hace falta saber quién buscó para
saber qué le falta a la góndola, y todo lo demás sería juntar datos de personas
porque se puede.

## Una cosa que salió de migrar, por si les sirve

Al principio le mandábamos a `sub` el camino y no el nodo, y no encontraba nada: un
subrubro que está a dos niveles de profundidad no aparece si se lo busca en la raíz.
Lo dejamos como ustedes lo definieron —**`sub` es un id que se resuelve esté donde
esté**— que es lo correcto y lo que hace que el árbol pueda cambiar de forma sin que
nadie toque la URL.

Si alguna vez documentan el endpoint, vale la pena que esa línea esté: es la clase de
cosa que se asume al revés.
