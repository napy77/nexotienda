# Contrato: la API que NexoTienda le pide a NexoPOS

Este documento es para el equipo de NexoPOS. Describe los endpoints que NexoTienda
consume. **ClubPay necesita casi exactamente los mismos datos** para su sección "Mis
Comercios", así que construirla una vez sirve para las dos cosas.

La forma exacta de cada objeto está tipada en
[`src/lib/nexopos/types.ts`](../src/lib/nexopos/types.ts) — ese archivo es la fuente
de verdad y este documento su explicación. El cliente HTTP que las llama es
[`src/lib/nexopos/client.ts`](../src/lib/nexopos/client.ts).

Mientras la API no exista, NexoTienda corre con fixtures y no bloquea a nadie.

## Autenticación

`Authorization: Bearer <NEXOPOS_API_KEY>`, servidor a servidor. Esa key **nunca**
llega al navegador: vive solo en el proceso de Next.

## Convenciones

- **Todos los montos van en centavos, enteros.** Nada de floats.
- Fechas ISO 8601.
- `404` cuando el recurso no existe; el cliente lo traduce a `null`.
- El stock cambia con cada venta del mostrador, así que **no cacheamos** nada de
  productos ni de cuentas.

## Endpoints

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/v1/hosts/{sub}` | Si `{sub}` es un comercio o un pueblo |
| GET | `/v1/stores/{slug}` | `Store` |
| GET | `/v1/stores/{storeId}/pasillos` | `Pasillo[]` |
| GET | `/v1/stores/{storeId}/products` | `Product[]` |
| GET | `/v1/stores/{storeId}/products/{id}` | `Product` |
| GET | `/v1/towns/{townSlug}/stores` | `Store[]` |
| GET | `/v1/towns/{townSlug}/search?q=` | `TownSearchResult` |
| GET | `/v1/people/{personId}` | `Person` con sus cuentas |
| GET | `/v1/people/{personId}/accounts/{storeId}` | `MerchantAccount` |
| POST | `/v1/orders` | `Order` |
| GET | `/v1/orders/{code}` | `Order` |

## Las tres cosas que importan del modelo

### 1. Disponibilidad: `stock` o `declared`, nunca las dos

```ts
availability:
  | { policy: 'stock';    onHand: number }
  | { policy: 'declared'; state: 'available' | 'out'; quota?: { total, remaining } }
  | { policy: 'unknown' }
```

Lo que se compra hecho va por `stock`. Lo que **se hace** —la pizza, el pan, la copia
de llave— va por `declared`: es una declaración del comercio, **no descuenta insumos**
(D3). El cupo del día se repone solo (D4).

`unknown` no es cero: es que el POS no reportó. La tienda lo dice tal cual —
"consultá disponibilidad"— porque un número equivocado con autoridad es peor que no
tener número (P6).

### 2. La cuenta corriente es POR COMERCIO

`MerchantAccount` es la cuenta de una persona **con un comercio**. Cada comercio es el
acreedor de la suya, con su propio `closingDay`, su propio `availableCents` y su propia
política.

**No existe ni puede existir un objeto que sume las deudas de dos comercios.** Sumarlas
haría que el acreedor sea Nexo, y un pago único habría que repartirlo entre dos Mercado
Pago distintos. Eso es exactamente lo que P1 prohíbe.

El total del pueblo sí existe, pero es una **vista de solo lectura para el deudor** (P3),
y nunca es pagable. Un comercio jamás ve la deuda de un cliente con otro comercio.

Dentro de cada cuenta hay una **pila de períodos** (D28): los cerrados son documentos
congelados y pagables por separado; el abierto es consumo en curso y **nunca se suma con
los cerrados**.

### 3. El pedido nace en `recibido`, no en `aceptado`

Que al comercio le llegue el pedido no es que lo haya aceptado (D18). El `readyEstimate`
lo declara el comercio **al aceptar** — la plataforma nunca promete un tiempo.

Falta definir del lado de NexoPOS: **el vencimiento del pedido** (D19). Si nadie lo
acepta en N minutos, se cancela solo con una disculpa. Perder el pedido honestamente es
más barato que dejar a alguien esperando algo que no viene.

## Lo que queda por acordar

1. **Vencimiento del pedido**: cuántos minutos, y si es configurable por comercio.
2. **Notificación al comercio**: cómo le avisa NexoPOS del pedido nuevo — pantalla del
   POS, mail, o WhatsApp Business API (tiene costo por conversación).
3. **Handoff desde ClubPay**: el endpoint que emite el token corto de un solo uso, atado
   al `person_id` y a la tienda. Ver la sección correspondiente en el prompt de ClubPay.
4. **Webhooks** para que NexoTienda y ClubPay se enteren de: pedido aceptado, pedido
   listo, resumen cerrado, vinculación propuesta.
5. **Registro de búsquedas sin resultado** (D12): son señal de demanda para el comercio,
   para el mayorista y para el equipo comercial de Nexo B2B.
