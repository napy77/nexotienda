# Integraciones

## El mapa

```
Nexo B2B ──catálogo maestro──► NexoPOS ──todo──► NexoTienda
                                  │
                                  └──clave por comercio──► ClubPay
```

**NexoTienda habla con un solo sistema: NexoPOS.** Nunca llama a ClubPay ni a Nexo
B2B. Ver DEC-003 en `DECISIONS.md`.

---

## 1. NexoTienda ← NexoPOS · catálogo

- **Origen** NexoPOS · **Destino** NexoTienda · **Dirección** lectura
- **Datos** comercios, góndolas y su árbol, productos, precios, stock, campañas,
  destacados, búsqueda del pueblo
- **Owner** NexoPOS (y Nexo B2B detrás, para el producto canónico)
- **Método** HTTPS, `Authorization: Bearer <NEXOPOS_KEY_CATALOGO>`
- **Endpoints** `/v1/hosts/:sub`, `/v1/stores/:slug`, `/v1/stores/:id/pasillos`,
  `/v1/stores/:id/products` (con `pasillo`, `sub`, `q`, `limit`, `offset` o `ids`),
  `/v1/stores/:id/products/:pid`, `/v1/stores/:id/campaigns`,
  `/v1/stores/:id/highlights`, `/v1/towns/:slug/stores`, `/v1/towns/:slug/search`
- **Reglas**
  - Todo con `cache: 'no-store'`: el stock cambia con cada venta del mostrador.
  - **Nunca se pide el catálogo entero.** Delfín tiene ~7.000 productos.
  - Un 404 se traduce a `null`. Para endpoints de acción eso puede esconder una ruta
    que no existe, así que los de emparejar loguean explícitamente.
  - El adapter acepta formas viejas y nuevas para que un rollback del otro lado no
    tire la tienda.

## 2. NexoTienda → NexoPOS · pedidos

- **Dirección** escritura + lectura · **Clave** `NEXOPOS_KEY_PEDIDOS`
- **Endpoints** `POST /v1/orders`, `GET /v1/orders/:code`,
  `POST /v1/orders/:code/payment`
- **Owner del pedido** NexoPOS. Aterriza como nota de venta, mismo stock, misma caja.
- **Reglas**
  - **Los totales los calcula NexoPOS.** Los nuestros son para mostrar.
  - Se manda `expectedTotalCents` —lo que la pantalla mostró— para que puedan avisar
    si el precio cambió. No para cobrar.
  - `contact` sin `accountId` es la mayoría de las ventas.
  - **Falta**: aviso al comerciante, vencimiento del pedido (D19) y webhooks.

## 3. NexoTienda → NexoPOS · cuentas corrientes

- **Dirección** lectura + escritura · **Clave** `NEXOPOS_KEY_CUENTAS`
- **Endpoints**
  - `GET /v1/cuentas/:accountId?storeId=` — estado de la cuenta
  - `POST /v1/cuentas/canjear` `{token, storeId}` — canje del handoff
  - `POST /v1/cuentas/emparejar` `{storeId, clientHint}` — abre un emparejamiento
  - `GET /v1/cuentas/emparejar/:requestId?storeId=` — sondeo
  - `POST /v1/stores/:id/accounts/:acc/payments` — pago. **`PENDIENTE DE VALIDAR`:
    quedó en el espacio de nombres viejo**
- **Regla** la clave dice *qué endpoint*; el token dice *de quién*. La clave de
  `cuentas` sola no alcanza.

## 4. NexoPOS → ClubPay · el tramo que NexoTienda no toca

- **Origen** NexoPOS · **Destino** ClubPay · **Clave** la del comercio (una por
  comercio, que NexoPOS sí tiene y NexoTienda no)
- **Endpoints de ClubPay**
  - `POST /pos/tienda/sessions` `{token}` → `{account_id, external_id, persona}`
  - `POST /pos/tienda/emparejar` `{client_hint}` → `{request_id, code, expires_at}`
  - `GET /pos/tienda/emparejar/:request_id` → `{status, token?}`
- **Reglas**
  - El `GET` entrega el token **una sola vez**; el segundo dice `vencido`. No puede
    haber dos consultas en vuelo por el mismo `request_id`.
  - Un 404 de ClubPay **no debe reenviarse como 404 propio**: acusa al equipo
    equivocado. Va como 502 con mensaje.

## 5. ClubPay → comprador → NexoTienda · handoff

- **Dirección** el usuario trae una prueba
- **Cómo** en ClubPay, "Mis comercios" → el comercio → un botón abre
  `https://<slug>.nexotienda.app/entrar?t=<token>`, con `&ir=libreta` si el botón es
  "ver tu cuenta"
- **Token** un solo uso, dos minutos, atado a **la relación** (persona + comercio)
- **Reglas**
  - **Nunca un id en la URL.** Un id permanente en un link es una credencial que no
    vence nunca.
  - `Referrer-Policy: no-referrer` en `/entrar`: la tienda carga fotos de servidores
    ajenos y el navegador les contaría el token.
  - `ir` es **una llave de una lista fija**, nunca una URL. Aceptar una URL sería un
    redirector abierto con la marca de la tienda.
  - **ClubPay necesita `storefrontSlug` y `storefrontPublished`** para armar ese link.
    Hoy falta y se carga a mano. El dueño de ese dato sería **Nexo B2B**.

## 6. Emparejar dos pantallas (PC + teléfono)

- **Flujo** la computadora pide un código → la persona lo tipea en ClubPay → la
  computadora sondea → recibe el mismo token del handoff → canje normal
- **Dirección del código: nace en la computadora.** Al revés sería un OTP, y los OTP
  se roban por teléfono. Ver DEC-008.
- **`clientHint`** ("una computadora con Chrome") viaja pero **no es prueba de nada**:
  en un ataque lo escribe el atacante.

## 7. NexoTienda → Mercado Pago

- **Estado** `PENDIENTE DE VALIDAR` — el adapter existe y **lanza error**. Falta el
  onboarding del comercio como vendedor.
- **Modelo** marketplace: la preferencia se crea contra la cuenta **del comercio**,
  con `marketplace_fee` para la comisión. **La plata nunca toca una cuenta de Nexo.**
- **Degradación** sin `MP_ACCESS_TOKEN` corre el sandbox en memoria. Sin Mercado Pago
  la cuenta corriente sigue funcionando: solo se pierde el pago desde la app.

## Riesgos

- **Todo depende de NexoPOS.** Si se cae, la tienda no tiene nada que mostrar.
- **Cadena de tres para la libreta.** Un fallo en el medio es difícil de atribuir: ya
  pasó y costó días. Por eso los errores tienen que decir de qué lado están.
- **El slug sin dueño claro** es hoy el único paso manual para publicar una tienda.
