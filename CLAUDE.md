# NexoTienda

Tienda online del comerciante de pueblo. Se alimenta del stock de **NexoPOS** y del
catálogo maestro de **Nexo B2B**; la identidad, la cuenta corriente y el pago del
comprador viven en **ClubPay**.

El diseño completo está en el documento fundacional (v0.2), con cada decisión numerada
`D1`–`D44`, los principios `P1`–`P6`, los riesgos `R1`–`R9` y lo abierto `A1`–`A7`.
Cuando algo de acá no alcance, la referencia es ese documento.

## Superficies

| Superficie | Qué es |
|---|---|
| `{slug}.nexotienda.app` | La tienda de un comercio. Web pública, sin app. |
| `{pueblo}.nexotienda.app` | La página del pueblo: **buscador de existencias**, no marketplace. |
| ClubPay → "Mis Comercios" | Relación, cuenta corriente y pago. No hay app propia del comprador. |

Un pedido es **de un solo comercio**. No hay carrito combinado entre tiendas (D15).

## Reglas que el código no puede violar

Estas no son preferencias de estilo. Si una PR las cruza, se rechaza.

1. **Libro y riel, no balance (P1).** Nexo no presta, no adelanta, no garantiza. El
   acreedor es siempre el comercio. La plata va directo del comprador al comercio por
   el Mercado Pago del comercio; nunca pasa por una cuenta nuestra.
2. **No somos cobradores (P2).** El sistema notifica hechos. A quién se le fía, cuánto,
   hasta cuándo y qué pasa si no paga lo decide el comercio. Nada de avisos de mora ni
   recordatorios escalados.
3. **La vista agregada es del deudor (P3).** El comprador puede ver todo lo que debe en
   el pueblo. **Ningún comercio puede ver la deuda de un cliente con otro comercio.**
   Nunca, aunque lo pidan.
4. **Describir no es calificar (P4).** Se puede mostrar el historial de un cliente con
   *ese* comercio ("pagó 6 de 6, en promedio el día 9"). No se emiten puntajes,
   scorings ni recomendaciones de riesgo.
5. **No afirmar lo que no se puede respaldar (P5).** El buscador nunca dice "nadie tiene
   X"; dice "no lo encontramos cargado". Un comercio no reclamado se muestra como no
   verificado. Dato ausente se declara ausente.
6. **Un número equivocado con autoridad es peor que no tener número (P6).**

## Modelo de producto

- **Producto canónico** (viene de Nexo B2B): el comercio solo pone precio y stock. Se
  controla **por stock**.
- **Producto propio** (lo crea el comercio: pizza, pan, corte de llave): se controla
  **por disponibilidad declarada**, nunca descontando insumos (D3).
  Tres estados: disponible / cupo del día (se repone solo) / agotado.
- Es una **política sobre el mismo producto**, no dos tipos de producto (D1). El default
  viene del origen y el comercio lo puede dar vuelta (D2).
- La receta existe solo como **calculadora de costo**; nunca mueve stock (D5).
- Marcar "se acabó" tiene que costar **un gesto desde el teléfono** (D4).

## Cuenta corriente

- El alta es **física**: se crea en NexoPOS, en el mostrador, con DNI (D23).
  La app nunca otorga crédito.
- **Funciona igual sin app** (D24). La vinculación es una capa que se enciende.
- **El DNI enlaza, no revela** (D25): el match *propone*, el saldo aparece después de
  que el cliente confirma. El DNI no puede ser el identificador del sistema — para eso
  hay un `person_id` opaco.
- El cierre **congela un período y emite un resumen** (D27). Fecha configurable por
  comercio.
- No hay "una deuda": hay una **pila de períodos** (D28). El período abierto **nunca**
  se mezcla ni se suma con los resúmenes cerrados.
- La ficha del cliente muestra **antigüedad, no un total** (D30).
- Pago parcial permitido; se imputa del período más viejo al más nuevo, con override del
  comerciante (D31).
- Se muestra **"Disponible"**, nunca **"tu límite"** (D32).
- **Límite por cliente es requisito de v1** (D33).
- **Bloquear el fiado no bloquea la venta** (D35). El bloqueo online se comunica suave y
  con salida a un humano (D36).
- La comisión es **del riel, no del crédito** (D38).

## Pedido y reparto

- La notificación **no es una aceptación** (D18). El comprador ve el estado:
  recibido → aceptado (con tiempo) → listo / en camino → entregado.
- El pedido **vence**: si nadie acepta en N minutos se cancela con una disculpa (D19).
- El default del almacén es **pedido programado, no inmediato** (D20). Las franjas de
  reparto son el mecanismo que hace rentable el reparto propio, no una limitación.
- Reparto escalonado: retiro en local → reparto propio con costo → remis del pueblo (D21).
  **No construimos flota.**

## Integración con ClubPay

- Handoff con **`person_id` opaco** + **token firmado, corto y de un solo uso**.
  La API key se queda entre backends; **nunca** viaja al navegador.
- **Nunca** datos personales en query string.
- El pago usa el Mercado Pago del propio comercio (modelo marketplace, split).
- **Degradación sin Mercado Pago**: la cuenta corriente sigue funcionando; solo se pierde
  el pago desde la app.

## Convenciones

- Todo el texto de cara al usuario va en **español rioplatense**, concreto, sin inflar.
  El interlocutor es un almacenero de pueblo o su cliente, no un usuario de fintech.
- No se le dice "crédito" al fiado, ni "moroso" a nadie.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
