# NexoPOS → lo que falta para cerrar un carrito

Corto y concreto: el catálogo anda, la tienda de Jure navega con stock real, y el
carrito no se puede cerrar porque `POST /v1/orders` todavía no existe.

```
$ curl -X POST .../v1/orders
Cannot POST /v1/orders   [404]
```

Es el paso 4 del orden que ustedes mismos propusieron. El contrato ya está tipado en
`src/lib/nexopos/types.ts` del repo de NexoTienda, así que esto solo enumera qué
necesitamos y marca tres cosas que conviene no descubrir sobre la marcha.

---

## 1. Ojo con el guard del router

En `v1-catalogo.ts`, línea 204:

```ts
v1Router.use(requiereClave("catalogo"));
```

Eso aplica a **todo** lo que se registre después. Si las rutas de pedidos se agregan
ahí abajo, van a exigir la clave de catálogo y no la de pedidos — que es justo lo que
separamos.

Nos pasó al diagnosticar esto: mandar la clave de pedidos a `/v1/orders` devolvía
**401 y no 404**, porque el guard de catálogo la rechazaba antes de llegar al ruteo.
Perdimos un rato pensando que la clave estaba mal.

Router aparte, o guard por ruta.

## 2. Los tres endpoints

### `POST /v1/orders` — clave `pedidos`

Le mandamos esto:

```ts
{
  storeId: string;            // el id que devuelve la API, tal cual
  lines: { productId: string; quantity: number }[];
  slotId: string;             // uno de los slots del Store
  address?: string;           // solo si el slot es de reparto
  paymentMethod: 'efectivo_entrega' | 'online' | 'cuenta_corriente';
  notes?: string;

  // Uno de los dos, nunca los dos:
  accountId?: string;                        // compra a la libreta
  contact?: { name: string; phone: string }; // compra anónima — el caso normal
}
```

**`contact` sin `accountId` es la mayoría de las ventas.** Alguien entra, compra dos
paquetes de harina y paga al recibirlos, sin identificarse. Si el modelo asume que
toda venta tiene cliente, hay que aflojarlo: lo único que sabemos de esa persona es
un nombre y un teléfono, y alcanza — el comercio necesita poder avisarle.

Devuelve el `Order` completo, con `code`, `status: 'recibido'` y los totales
calculados **del lado de ustedes**. Los nuestros son para mostrar; los que valen son
los suyos, que salen del precio y el stock del momento.

### `GET /v1/orders/:code` — clave `pedidos`

Lo llama la pantalla de seguimiento. Se lee sin sesión: el comprador anónimo tiene el
link y nada más.

### `POST /v1/orders/:code/payment` — clave `pedidos`

`{ paymentId }`. Marca el pedido como pagado cuando el cobro se acredita.

## 3. Los estados y quién los mueve

```
recibido → aceptado → listo → [en_camino] → entregado
                    ↘ cancelado
```

- **`recibido`** es donde nace. Que le llegue al comercio no es que lo haya aceptado.
- **`aceptado`** lo pone el comerciante, y **ahí declara el `readyEstimate`** — para
  cuándo lo tiene. Ese tiempo lo dice él; la plataforma nunca lo inventa. La pantalla
  del comprador ya está esperando ese dato.
- **`en_camino`** solo existe si el slot es de reparto.
- **`cancelado`** lleva `cancelReason` —texto libre del comerciante— y `cancelledBy`
  con `comercio`, `comprador` o `vencimiento`.

El texto que ve el comprador lo armamos nosotros a partir de esto; no hace falta que
manden copy.

## 4. Lo que el pedido tiene que hacer del lado de ustedes

- Aterrizar como **nota de venta**, igual que una venta del mostrador. Mismo stock,
  misma caja.
- Si el pago fue `cuenta_corriente`, generar el movimiento en la libreta de esa
  cuenta, como cualquier otra venta fiada.
- **Avisarle al comercio.** Es lo más urgente de todo esto: sin aviso, el pedido
  queda esperando y el comprador no sabe si va o no va.
- **Webhooks** de cada transición, para que la pantalla de seguimiento no tenga que
  preguntar en loop.

## 5. Para el piloto alcanza con menos

No hace falta esperar a Mercado Pago. Con **`efectivo_entrega`** un pedido funciona de
punta a punta sin ninguna integración de cobro: se encarga, el comercio lo prepara, y
se paga en mano.

Si priorizan eso, Jure puede estar recibiendo pedidos reales antes de que se decida lo
de autorizar-versus-capturar.

---

## Y una cosa que salió de probarlo

El switch de **aparecer en la página del pueblo** arranca apagado, como habíamos
pedido nosotros. Probando Morrison el resultado fue una página vacía con tres
comercios que no sabían que el switch existía.

El argumento social sigue valiendo —que dos supermercados del mismo pueblo aparezcan
juntos con los precios a la vista es una decisión del comerciante, no un default
nuestro— pero la forma de respetarlo no es el silencio: es **preguntárselo al
publicar la tienda**, con el sí sugerido.

> *¿Querés aparecer también en la página de Morrison?*
> Ahí la gente del pueblo busca quién tiene lo que necesita.

Un default apagado que nadie sabe que existe no es "el comerciante decidió no
aparecer": es que nunca se enteró. Está en la sección 2.3b de
`nexopos-2-tienda-real.md`.
