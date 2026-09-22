# Datos: dónde viven y de quién son

## NexoTienda no tiene base de datos

Verificado en el código: no hay ORM, ni cliente SQL, ni migraciones, ni dependencia de
ningún motor. **NexoTienda no es dueña de ningún dato del negocio.** Lee de NexoPOS y
escribe pedidos y pagos contra NexoPOS.

Esto es deliberado (ver `DECISIONS.md`, DEC-002) y es lo que hace que la tienda sea
desechable: se puede borrar el servidor entero y no se pierde nada.

## Lo único que NexoTienda guarda

| Qué | Dónde | Vida | Alcance |
|---|---|---|---|
| Carrito | `localStorage` del navegador | Hasta que se compre o se borre | Por comercio (`slug`) |
| Historial de compras local | `localStorage` (`nexotienda:comprados:<slug>`) | Últimos 24 productos | Por comercio |
| Sesión de libreta | Cookie `httpOnly` `nt_lib_<slug>` | 30 días | **Por comercio** |
| Pedido de emparejamiento | Cookie `httpOnly` `nt_par_<slug>` | 5 minutos | Por comercio |
| Intentos de cobro (sandbox) | Memoria del proceso | Hasta reiniciar | — |
| Pedidos (modo fixtures) | Memoria del proceso | Hasta reiniciar | — |

**Nada de esto es fuente de verdad.** Si se pierde, se pierde una comodidad.

**La cookie de sesión es por comercio a propósito**: no existe en ningún lado un estado
que diga "esta persona es X". Es P3 metido en el frasco de las galletitas.

## Ownership de los datos compartidos

| Dato | Owner | NexoTienda |
|---|---|---|
| **Producto canónico** (nombre, marca, EAN, fotos, árbol de categorías) | **Nexo B2B** | Lee (vía NexoPOS) |
| **Producto propio** del comercio (pizza, pan) | **NexoPOS** (lo crea el comerciante) | Lee |
| **Precio** | **NexoPOS** | Lee. **Nunca calcula** |
| **Stock / disponibilidad** | **NexoPOS** | Lee |
| **Comercio** (nombre, dirección, horario, franjas, medios de pago) | **NexoPOS** | Lee |
| **Slug de la tienda** (`storefrontSlug`) | `PENDIENTE DE VALIDAR` — lo elige el comerciante y hoy lo sirve NexoPOS; ClubPay pide recibirlo desde **Nexo B2B** en la ficha | Lee |
| **Región / pueblo** y el opt-in a aparecer | **NexoPOS** (el comerciante decide) | Lee |
| **Campaña** (nombre, fechas, descuentos, orden de productos) | **NexoPOS** | Lee. **No reordena** |
| **Mayorista** | **Nexo B2B** | No lo ve |
| **Cliente / persona** | **ClubPay** (identidad) + **NexoPOS** (la ficha del comercio) | No lo ve. Solo recibe un `displayName` al canjear |
| **Cuenta corriente** (saldo, límite, cierre, pausa) | **NexoPOS** — es el libro | Lee |
| **Resúmenes / períodos** | **NexoPOS**, y los muestra **ClubPay** | **No los pide** |
| **Imputación de un pago** | **NexoPOS** | No la emula |
| **Pedido** | **NexoPOS** | Lo crea, lo lee |
| **Totales del pedido** | **NexoPOS** | Muestra los suyos; **valen los de ellos** |
| **Usuario comprador** | **ClubPay** | No tiene usuarios |
| **Token de handoff / código de emparejar** | **ClubPay** | Lo canjea, no lo guarda |

## Identificadores compartidos

| Id | Forma | Quién lo emite | Notas |
|---|---|---|---|
| `storeId` | `"1"` (texto) | NexoPOS | Se manda en casi todas las llamadas |
| `slug` | `"jure-hnos-srl"` | Lo elige el comerciante | **No se deduce del nombre.** Los viejos redirigen |
| `productId` | `"5403"` (texto) | NexoPOS | |
| `accountId` | `"CLI-4231"` | **NexoPOS**, no ClubPay | Es el id **de la relación** persona–comercio |
| `order.code` | `"P-06D042E1"` | NexoPOS | Es lo que ve el comprador |
| `campaign.id` | `"1"` | NexoPOS | |
| id de nodo del árbol | `"r:Aceites"`, `"s:Girasol"` | NexoPOS | Prefijado por nivel: un rubro y un subrubro pueden llamarse igual |
| `requestId` de emparejar | `"pair_…"` | ClubPay | Nunca llega al navegador |

**No existe un id de persona que cruce comercios.** El `accountId` de Juan en el
almacén y el de Juan en la ferretería son distintos y no hay forma de relacionarlos
desde acá. El único que sabe que son la misma persona es ClubPay, y eso es
intencional (P3).
