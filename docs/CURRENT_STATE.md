# Estado actual

Última revisión: **2026-10-13** · commit `05ff5fe` + CR-0003

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
  y vencimiento. **Se paga en ClubPay, no en la tienda.** Se cierra con "Salir".
  Revocación por `linkedAt`.
- **Pago con Mercado Pago** vía NexoPOS (`/checkout`): **probado contra el simulador
  de NexoPOS** (11/10) —rechazo con el motivo de NexoPOS, reintento con link nuevo,
  pago, «ya está pagado», y el comercio apagando Mercado Pago con el checkout
  abierto—. Solo se ofrece con `acceptsMercadoPago: true`. Se decide por `code`, nunca
  por el texto. Procedimiento en `DEPLOYMENT.md`.
- **Página del pueblo**: buscador de existencias, solo con los comercios que hicieron
  opt-in.

## A medio camino

| Qué | Qué falta |
|---|---|
| **Emparejar la libreta en otra pantalla** (PC + código) | Construido y desplegado de este lado. **NexoPOS debe apuntar a `/pos/tienda/emparejar`** (llamaba a `/pos/tienda/pairings`, un nombre inventado). ClubPay tiene su punta y la pantalla de la app sale en la próxima versión |
| **Botón "Ir a la tienda" en ClubPay** | ClubPay necesita `storefrontSlug` y `storefrontPublished` en la ficha del comercio. **Ese dato es de Nexo B2B** y es el único que impide que un comercio nuevo tenga tienda sin carga manual |
| **Mercado Pago con plata real** | Probado contra el simulador. Ningún comercio lo tiene prendido todavía: la primera venta real la hace ClubPay, con plata de verdad, cuando Germán confirme el comercio de prueba |
| **Árbol de góndolas de 3 niveles** | Soportado; falta que NexoPOS mande el nivel del medio. Mientras tanto se derivan las hojas y la fila se corta a 12 chips |
| **Identidad para pagar en mano (CR-0003)** | Construido detrás de «reglas apagadas»: ida a ClubPay, `volver`, `orderRules`, `creditEnabled`, los `code` y `review`. Probado con fixtures (`FIXTURES_REGLAS=on`, `FIXTURES_SIN_LIBRETA=on`). **Desplegado, sin efecto visible**: NexoPOS todavía no manda `orderRules`, no rechaza con los `code` nuevos y no canjea cuentas nacidas en la tienda (probado en Delfín, `P-FC3B51C5`, el 13/10). Pedido en `a-nexopos/cr-0003-lo-que-falta.md`. NexoPOS contestó (13/10): canje de cuentas nuevas y cuenta + contacto juntos **hechos, sin desplegar**; reglas y `review` esperan los topes de Germán. **Transición en `client.createOrder`**: un 400 sin `code` con cuenta y contacto se reintenta sin la cuenta — borrar cuando NexoPOS despliegue; a ClubPay, confirmar el `volver` del carrito en `a-clubpay/cr-0003-volver.md`. Respuesta en `docs/respuesta-cr-0003-identidad.md` |
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
- **NexoTienda no recibe webhooks.** Consulta el pedido. NexoPOS confirmó que no nos
  manda nada: los avisos quedan en su cola.
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

- **`/s/<slug>` desde otro host redirige al subdominio del comercio** (13/10). La
  página del pueblo dejaba comprar en un comercio bajo el host del pueblo: carrito y
  sesión en el origen equivocado, y ClubPay rechazaba el `volver`.
- **CR-0003, identidad para pagar en mano.** Una sesión es una persona identificada,
  no una libreta. Arreglado de paso: con sesión y pago al retirar no se mandaba ni
  cuenta ni contacto, y NexoPOS rechazaba el pedido con 400.

- **El sandbox de pagos corría en producción** hasta el 11/10. Hubo tres pedidos
  marcados pagados sin plata (pruebas de septiembre, nunca entregados — Germán lo
  confirmó). Ningún pago de libreta: ese endpoint nunca existió en NexoPOS.
- **Cobro con Mercado Pago vía NexoPOS** (CR-0002). Se retiró `lib/payments`, el
  sandbox, la pantalla `/pagar`, el pago de la libreta y todo método que marcara algo
  como pagado. `online` sale de `acceptsMercadoPago`, no de `acceptsOnlinePayment`.
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
