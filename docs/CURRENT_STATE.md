# Estado actual

Última revisión: **2026-09-23** · commit `4bdd4a4`

Leer siempre junto a `CLAUDE.md`. Actualizar este archivo cuando una tarea cambie el
estado del sistema.

## En producción

Desplegado en el VPS compartido con NexoPOS y ClubPay, contra la API real de NexoPOS.
Comercio piloto: **Jure Hnos SRL** (`storeId: "1"`, slug `jure-hnos-srl`). Hay al menos
otro con catálogo grande (**Supermercado Delfín**, ~7.000 productos) y la página de
pueblo de **Morrison**.

## Funciona hoy

- **Ruteo por subdominio** con certificado comodín. Slug nuevo funciona al instante.
  Slugs viejos redirigen para siempre.
- **Catálogo real**: góndolas con árbol de subrubros, búsqueda server-side, paginado.
  La portada no carga el catálogo entero.
- **Ficha de producto** con galería (`images[]`), disponibilidad y compartible por URL.
- **Carrito y checkout anónimo** (nombre + teléfono), con franjas de retiro y reparto.
- **Pedidos**: se crean en NexoPOS y caen como nota de venta. Seguimiento con estados
  contextuales y refresco automático.
- **Comercio cerrado**: lo de góndola se puede encargar con confirmación; si el
  carrito tiene algo `declared`, se bloquea.
- **Campañas**: secciones en la portada, cinta roja por producto, "hasta X%" en el
  título, página propia por campaña.
- **Libreta**: se abre desde ClubPay (`/entrar?t=`), muestra saldo, disponible, cierre
  y vencimiento, y permite pagar. Se cierra con "Salir". Revocación por `linkedAt`.
- **Página del pueblo**: buscador de existencias, solo con los comercios que hicieron
  opt-in.

## A medio camino

| Qué | Qué falta |
|---|---|
| **Emparejar la libreta en otra pantalla** (PC + código) | Construido y desplegado de este lado. **NexoPOS debe apuntar a `/pos/tienda/emparejar`** (llamaba a `/pos/tienda/pairings`, un nombre inventado). ClubPay tiene su punta y la pantalla de la app sale en la próxima versión |
| **Botón "Ir a la tienda" en ClubPay** | ClubPay necesita `storefrontSlug` y `storefrontPublished` en la ficha del comercio. **Ese dato es de Nexo B2B** y es el único que impide que un comercio nuevo tenga tienda sin carga manual |
| **Cobro online** | `mercadopago.ts` **lanza error**: falta el onboarding del comercio como vendedor. Con `MP_ACCESS_TOKEN` vacío corre el sandbox, que guarda en memoria y se pierde al reiniciar |
| **Árbol de góndolas de 3 niveles** | Soportado; falta que NexoPOS mande el nivel del medio. Mientras tanto se derivan las hojas y la fila se corta a 12 chips |
| **Highlights** (más vendidos / más buscados) | Consumido. "Lo más buscado" va a estar vacío hasta que se junten búsquedas |

## Pendiente de otros equipos

**NexoPOS** (ordenado por cuánto duele):

1. **Aviso al comerciante cuando entra un pedido.** Marcado como lo más urgente desde
   la segunda tanda. `PENDIENTE DE VALIDAR` si se construyó.
2. **Vencimiento del pedido (D19).** Ídem. `PENDIENTE DE VALIDAR`.
3. **Webhooks** de cada transición, para dejar de sondear.
4. Apuntar el emparejamiento al nombre correcto de ClubPay.
5. **Aviso de campaña invisible** — ver `a-nexopos/campanas-que-no-se-ven.md`.
6. **Que el sync de fichas avise cuando el cursor no avanza** — ver
   `a-nexopos/fichas-sync-sin-aviso.md`.
7. Nivel del medio del árbol de góndolas.
8. Interruptor manual abierto/cerrado, con la caja como fuente opcional.
9. Marca de desvinculación (`linkedAt` ya llega; confirmar que se mueve al desvincular).

**ClubPay**: `storefrontSlug`/`storefrontPublished`, el botón, la pantalla "Entrar en
otra pantalla", y aceptar vinculación por QR en el mostrador.

**Nexo B2B**:

1. **Arreglar la paginación de `/api/v1/fichas`**, que devuelve siempre la misma
   página — ver `a-nexob2b/fichas-cursor-trabado.md`. Es lo que impide que cualquier
   corrección del catálogo maestro llegue a NexoPOS y a la tienda.
2. El slug en la ficha del comercio. **Nadie le escribió todavía.**

## Problemas conocidos

- **Los nombres corregidos en Nexo B2B no llegan a la tienda.** NexoTienda muestra lo
  que manda NexoPOS sin caché; el que está trabado es el sync de fichas de NexoPOS,
  con el cursor clavado en `2026-07-06 17:50:05.633` porque `/api/v1/fichas` de B2B
  devuelve siempre la misma página: 57.125 fichas comparten `17:50:05.633760` y el
  cursor viaja en milisegundos, así que el id nunca desempata (diagnosticado el
  2026-09-23). Pedido a B2B y a NexoPOS.
- **Una campaña cuyos productos están todos agotados desaparece sin aviso**, en un
  comercio con `showsOutOfStock: false`. El comportamiento es correcto; el problema es
  que el comerciante no se entera. Pedido a NexoPOS. Diagnóstico:
  `deploy/diagnostico-campanas.sh <slug>`.
- **El sandbox de pagos guarda en memoria**: al reiniciar el servicio se pierden los
  intentos de cobro.
- **`registerAccountPayment` sigue apuntando a `/v1/stores/:id/accounts/:acc/payments`**,
  el espacio de nombres viejo, mientras `getAccount` ya migró a
  `/v1/cuentas/:id?storeId=`. `PENDIENTE DE VALIDAR` si ese endpoint sigue vivo.
- **`deploy/agregar-host.sh` es código muerto**: era para la lista explícita de hosts,
  anterior al certificado comodín.

## Deuda técnica

- **Sin tests.** No hay suite de ningún tipo. `npm run lint` es `tsc --noEmit`.
- **`src/lib/nexopos/fixtures.data.ts`** es el volcado del prototipo de diseño. Se
  borra entero el día que no haga falta el modo sin API.
- **La portada pide el catálogo a NexoPOS aunque solo muestre estanterías**: se pide
  por ids, pero el relleno "Para empezar" pide una página de 12.
- **Sin observabilidad**: los errores van a `console.error` y se leen con
  `journalctl -u nexotienda`.

## Cambios recientes

- Campañas con descuento **por producto**; `discountPercent` pasó a ser el techo de la
  tanda y se muestra con "hasta". Se quitó el respaldo que le ponía el porcentaje de la
  campaña a un producto sin rebaja.
- La pila de resúmenes **se quitó de la tienda**: vive en ClubPay. La libreta contesta
  cuánto se debe y cuánto se puede cargar.
- Emparejar por código: construido, revertida la dirección (el código nace en la
  computadora), con candado de consulta única.
- `docs/` reorganizado por destinatario.

## Migraciones pendientes

Ninguna: no hay base de datos.
