# Arquitectura

## Qué es

Una aplicación **Next.js 16 (App Router)** que renderiza la tienda online de cualquier
comercio de NexoPOS. **Un solo proceso sirve todas las tiendas**: no hay una instancia
por comercio.

**No tiene base de datos.** Todo el estado del negocio vive en NexoPOS y en ClubPay.
Ver `DATABASE.md`.

## Componentes

```
            navegador
                │  https://<slug>.nexotienda.app
                ▼
            nginx (TLS comodín *.nexotienda.app)
                │  proxy_pass 127.0.0.1:3100
                ▼
  ┌─────────────────────────────────────────┐
  │  NexoTienda — Next.js, systemd, :3100   │
  │                                         │
  │  proxy.ts    subdominio → /s/<sub>/…    │
  │  app/        Server Components + acciones│
  │  lib/nexopos port + adapter HTTP/fixtures│
  │  lib/payments port + sandbox/MercadoPago │
  └─────────────────────────────────────────┘
                │ HTTPS, Bearer por capacidad
                ▼
            NexoPOS  ──►  ClubPay
```

NexoTienda **nunca** habla con ClubPay directamente. Ver `INTEGRATIONS.md`.

## Ruteo por subdominio

`src/proxy.ts` (convención de Next 16; reemplaza a `middleware.ts`) toma el host,
extrae el subdominio y **reescribe** a `/s/<sub><ruta>`.

- `jure.nexotienda.app/libreta` → `/s/jure/libreta`
- En desarrollo: `supersol.localhost:3000`
- Subdominios reservados en `src/lib/slug.ts`: `www`, `api`, `admin`, `assets`,
  `static`, y **`acme`, `acme-ns`, `_acme-challenge`** (delegación del certificado —
  perderlos rompe la renovación de todas las tiendas a la vez).
- Un subdominio puede resolver a un **comercio**, a un **pueblo**, o a un slug viejo
  que **redirige** al actual (`previousSlugs`).

**La URL pública es `https://<slug>.nexotienda.app`.** El `/s/<sub>` es interno y no
debe aparecer en nada que salga del repo.

## Rutas

| Ruta (interna) | Qué es |
|---|---|
| `/s/[sub]` | Portada de la tienda, o página del pueblo, según qué resuelva el host |
| `/s/[sub]?p=&s=&q=&n=` | Navegación por góndola, subrubro, búsqueda y paginado |
| `/s/[sub]/producto/[id]` | Ficha de producto |
| `/s/[sub]/ofertas/[campaignId]` | Todos los productos de una campaña |
| `/s/[sub]/carrito` | Checkout |
| `/s/[sub]/pedido/[code]` | Seguimiento del pedido |
| `/s/[sub]/libreta` | Cuenta corriente con ese comercio |
| `/s/[sub]/pagar/[intentId]` | Pantalla de cobro (sandbox) |
| `/s/[sub]/entrar` (route) | Canje del token de ClubPay → abre sesión de libreta |
| `/s/[sub]/salir` (route, POST) | Cierra la sesión de libreta de ese comercio |
| `/s/[sub]/vincular` (route) | **Solo desarrollo.** Simula el vínculo; 404 en producción |

## Puertos y adapters

Toda dependencia externa entra por un **port** (interfaz) con dos implementaciones.
Ningún componente sabe cuál está activa.

| Port | Archivo | Implementaciones | Cómo se elige |
|---|---|---|---|
| `NexoPosPort` | `src/lib/nexopos/types.ts` | `client.ts` (HTTP) · `fixtures.ts` | `NEXOPOS_API_URL` no vacío → HTTP |
| `PaymentsPort` | `src/lib/payments/types.ts` | `mercadopago.ts` · `sandbox.ts` | `MP_ACCESS_TOKEN` no vacío → Mercado Pago |

`src/lib/nexopos/client.ts` es además **la capa de traducción**: la API no habla
exactamente la forma del dominio (`hours`→`schedule`, `townSlug`→`regions[]`,
`paused`→`creditPaused`, `snake_case`→`camelCase`) y eso se resuelve ahí, no
deformando los tipos del dominio.

El adapter HTTP es **tolerante a propósito**: acepta formas viejas y nuevas, y ante un
endpoint ausente degrada sin tirar la tienda. Las ofertas y los destacados son el
adorno; el catálogo es la tienda.

## Flujo de datos

**Renderizado.** Todo se pide en Server Components con `cache: 'no-store'`; las rutas
son dinámicas. Al navegador solo baja **el pedazo que se está mirando** — nunca el
catálogo entero (Delfín tiene ~7.000 productos).

**Escritura.** Server Actions en `src/app/actions.ts`:
`placeOrderAction`, `orderPulseAction`, `productsByIdAction`, `searchTownAction`,
`abrirEmparejamientoAction`, `consultarEmparejamientoAction`.

**Tiempo real.** No hay websockets. La pantalla del pedido sondea con `orderPulseAction`
—una huella de cuatro campos— cada 15s, afloja a 45s tras cinco minutos quieta, no
pregunta con la pestaña oculta y pregunta apenas vuelve. Es un parche declarado hasta
que existan los webhooks de NexoPOS.

## Autenticación

**No hay login.** No existe "estar logueado en NexoTienda".

- El camino normal de compra es **anónimo**: nombre y teléfono, nada más.
- La libreta se abre con un **token de un solo uso de dos minutos** que emite ClubPay
  y se canja del lado del servidor. Ver `INTEGRATIONS.md`.
- La sesión es una cookie **`httpOnly`, por comercio**: `nt_lib_<slug>`, con
  `accountId`, nombre y `linkedAt`, en JSON base64url, 30 días.
- **La sesión no tiene autoridad**: dice qué libreta es y nada más. Todo lo demás
  —saldo, pausa, disponible— se pregunta en cada operación.
- Revocación: si `linkedAt` de la cuenta cambia respecto del guardado, la sesión deja
  de valer (`src/lib/libreta.ts`). Es la única revocación que existe, porque la cookie
  vive en un navegador ajeno que nadie puede cerrar.

## Estado del lado del cliente

| Qué | Dónde | Por qué |
|---|---|---|
| Carrito | `localStorage`, por slug | El camino normal es anónimo |
| "Lo que solés llevar" | `localStorage`, por slug | Ídem: atarlo al `accountId` serviría solo a quien tiene libreta |
| Sesión de libreta | Cookie `httpOnly`, por comercio | Es una credencial |

Nada de esto viaja a ningún servidor salvo los ids que la estantería pide por acción.

## Dependencias externas

- **NexoPOS** (obligatoria en producción). Sin ella la app corre con fixtures.
- **ClubPay** (indirecta, vía NexoPOS). Sin ella no hay libreta online.
- **Mercado Pago** — `PENDIENTE DE VALIDAR`: el adapter existe pero **lanza error**;
  falta el onboarding del comercio como vendedor.
- Fotos de producto: URLs externas servidas por NexoPOS / Nexo B2B.
- `lucide-react` (íconos), `motion`. Sin CDNs en runtime.

## Dependencias con otros productos Nexo

Ver `INTEGRATIONS.md`. En resumen: NexoTienda **consume** y no es fuente de nada
salvo del carrito y del historial local del navegador.
