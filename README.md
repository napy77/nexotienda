# NexoTienda

La tienda online del comerciante de pueblo. Se alimenta del stock de **NexoPOS** y del
catálogo maestro de **Nexo B2B**; la identidad, la cuenta corriente y el pago del
comprador viven en **ClubPay**.

- Las reglas de producto que el código no puede violar están en [CLAUDE.md](CLAUDE.md).
- Todo lo que tiene que construir y exponer NexoPOS está en [docs/nexopos.md](docs/nexopos.md).

## Correr en desarrollo

```bash
npm install
npm run dev
```

El ruteo es por subdominio, así que hay que entrar por uno:

| URL | Qué es |
|---|---|
| http://supersol.localhost:3000 | Tienda de un comercio |
| http://donarosa.localhost:3000 | Rotisería (productos propios con cupo del día) |
| http://jure.localhost:3000 | Comercio con cartel pero sin tienda publicada |
| http://morrison.localhost:3000 | Página del pueblo: buscador de existencias |

## Estado

Corre contra **fixtures** con los datos del prototipo de diseño. El día que exista la
API de NexoPOS se setea `NEXOPOS_API_URL` y el adapter cambia solo — ningún componente
se entera. Ver [.env.example](.env.example).

Lo que ya funciona de punta a punta: catálogo, carrito, checkout con retiro o franja de
reparto, pedido con su estado, libreta por comercio y buscador del pueblo.

Lo que todavía no: el pago (espera el handoff de ClubPay y el Mercado Pago del comercio)
y el vencimiento del pedido (D19, es del lado de NexoPOS).
