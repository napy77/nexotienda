# Despliegue

**Nunca se escriben secretos en este repositorio.** Las claves viven solo en
`/opt/nexotienda/.env` del servidor, con permisos `600`.

## Dónde corre

Un VPS compartido con **NexoPOS** y **ClubPay**, detrás de NAT, en Nubilus (el
datacenter de Linware).

**Nexo B2B corre en otra VM, al lado**, también en Nubilus: raíz del repo
`/var/www/nexob2b/nexob2b`, PM2, Postgres propio (`nexob2b_db`). Un diagnóstico
que toque B2B —su base, sus logs, su código— se corre allá, no en este VPS. Desde
acá sólo se la alcanza por HTTPS, con las claves de NexoPOS.

| Cosa | Valor |
|---|---|
| Directorio | `/opt/nexotienda` |
| Usuario | `nexotienda` |
| Servicio | `nexotienda.service` (systemd) |
| Puerto | **3100** — el 3000 lo usa el frontend de NexoPOS en la misma máquina |
| Proxy | nginx, `server_name *.nexotienda.app` |
| Node | `npx next start -p 3100` |
| Repo | `github.com/napy77/nexotienda` |

## Desplegar

```bash
sudo bash /opt/nexotienda/deploy/deploy.sh
```

Es **idempotente**: clona o hace `pull --ff-only`, genera el `.env` si no existe,
`npm ci && npm run build`, recarga systemd, reinicia y verifica que responda. Corre
`git` como el dueño del repo (root lo rechaza por *dubious ownership*).

Si ve nombres de variables viejos en el `.env` (`NEXOPOS_API_KEY`,
`NEXOPOS_PLATFORM_KEY`, `NEXOPOS_MERCHANT_KEY`) **avisa**: sin eso, pegar las claves
en la variable equivocada hace que la tienda siga mostrando fixtures sin señalar la
causa.

**Pushear no es desplegar.** El comando va explícito después de cada commit.

## Variables

Ninguna tiene valor por defecto útil en producción. **Sin `NEXOPOS_API_URL` la tienda
arranca con datos de prueba**, que es el modo demo.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | Dominio raíz. Se hornea al compilar: va **antes** del build |
| `NEXOPOS_API_URL` | Base de la API. Vacío → fixtures |
| `NEXOPOS_KEY_CATALOGO` | Lo que la tienda le muestra a cualquiera |
| `NEXOPOS_KEY_PEDIDOS` | Escribe pedidos; no llega a ninguna cuenta |
| `NEXOPOS_KEY_CUENTAS` | La sensible. Además pide la sesión del token de ClubPay |

**Tres claves separadas por capacidad, no por comercio**: es un solo servidor que
renderiza cualquier tienda. Ver DEC-003.

## TLS

Certificado **comodín** `*.nexotienda.app` por **acme-dns** con delegación CNAME
(DNS-01), porque el DNS es un panel Plesk sin acceso SSH.

- `deploy/acme-dns/install.sh` — instala y configura acme-dns
- `deploy/acme-dns/verificar.sh` — comprueba la delegación **contra un resolver
  público**: consultar el propio servidor desde adentro da falsos negativos por NAT
  hairpin, y sondear nombres inexistentes envenena la caché negativa
- `deploy/hooks/reload-nginx.sh` — hook de renovación

Con el comodín, **un slug nuevo funciona al instante**: no hay que emitir nada.
`deploy/agregar-host.sh` es de la etapa anterior y **ya no se usa**.

Cuidado: `acme`, `acme-ns` y `_acme-challenge` son la delegación. Perderlos rompe la
renovación de **todas** las tiendas a la vez; están reservados en `src/lib/slug.ts`.

## Verificar y diagnosticar

```bash
systemctl status nexotienda
sudo journalctl -u nexotienda -n 80 --no-pager
sudo bash /opt/nexotienda/deploy/diagnostico-campanas.sh <slug>
sudo certbot renew --dry-run
```

`diagnostico-campanas.sh` recorre la cadena —tienda, campañas, filtro, catálogo, y
**por qué falta cada producto**— y señala la capa que falla. No imprime claves.

## Probar el cobro contra el simulador de NexoPOS

El cobro con Mercado Pago **no se puede probar contra producción**: ningún comercio lo
tiene prendido hasta la prueba real de ClubPay. Se prueba levantando un NexoPOS local
con el simulador. Requiere Postgres local y el repo de NexoPOS
(`/Users/german/ClaudeCode/nexo-pos`).

**No escribir su `backend/.env`**: existe y puede apuntar a servicios reales. Su
backend lo carga con `dotenv`, y cualquier variable que no se pise vendría de ahí. Se
aísla con `DOTENV_CONFIG_PATH`:

```bash
# 1. Variables de prueba en un archivo propio, con claves inventadas
cat > /tmp/nexopos-prueba.env <<EOF
DATABASE_URL=postgres://localhost/nexopos_prueba_tienda
NEXOB2B_API_URL=
CLUBPAY_API_URL=
MERCADOPAGO_SIMULADOR=on
PORT=4100
NEXOPOS_PUBLIC_URL=http://localhost:4100
NEXOTIENDA_KEY_CATALOGO=$(openssl rand -hex 16)
NEXOTIENDA_KEY_PEDIDOS=$(openssl rand -hex 16)
NEXOTIENDA_KEY_CUENTAS=$(openssl rand -hex 16)
EOF
createdb nexopos_prueba_tienda

# 2. NexoPOS, solo con esas variables (las migraciones corren solas)
cd /Users/german/ClaudeCode/nexo-pos/backend
set -a; . /tmp/nexopos-prueba.env; set +a
DOTENV_CONFIG_PATH=/tmp/nexopos-prueba.env npx tsx src/index.ts
```

3. Configurar el comercio de demo por su API (`demo@comercio.com` / `demo`):
   `POST /api/auth/login`, `PUT /api/settings/tienda-slug` con un slug,
   `PUT /api/settings/nexotienda` con `{"habilitada":true,"pagos":{"clubpay":true,"contraEntrega":true}}`,
   y un par de productos con `POST /api/stock/producto-propio`.
   `GET /v1/stores/<slug>` tiene que traer `acceptsMercadoPago: true`.

4. NexoTienda contra ese NexoPOS, sin escribir archivos:

```bash
cd /Users/german/nexotienda
set -a; . /tmp/nexopos-prueba.env; set +a
NEXOPOS_API_URL=http://localhost:4100 \
NEXOPOS_KEY_CATALOGO=$NEXOTIENDA_KEY_CATALOGO \
NEXOPOS_KEY_PEDIDOS=$NEXOTIENDA_KEY_PEDIDOS \
NEXOPOS_KEY_CUENTAS=$NEXOTIENDA_KEY_CUENTAS \
npx next dev -p 3199
```

El `checkoutUrl` lleva a una página del simulador con «Pagar» y «Rechazar la
tarjeta». Al terminar: detener los dos procesos, `dropdb nexopos_prueba_tienda` y
borrar `/tmp/nexopos-prueba.env`.

## Rollback

No hay script. A mano:

```bash
sudo -u nexotienda git -C /opt/nexotienda checkout <sha>
sudo -u nexotienda bash -c "cd /opt/nexotienda && npm ci && npm run build"
sudo systemctl restart nexotienda
```

El `.env` no se toca. **No hay migraciones que revertir**: no hay base de datos.

## Desarrollo

```bash
npm install
npm run dev     # :3000
```

El ruteo es por subdominio: `http://supersol.localhost:3000`, `http://morrison.localhost:3000`.

| | Desarrollo | Producción |
|---|---|---|
| Datos | Fixtures, salvo que se setee `NEXOPOS_API_URL` | API real |
| Puerto | 3000 | 3100 |
| Cobro online | Emulado en fixtures (`FIXTURES_PAGO=rechazar` para el rechazo) | NexoPOS → ClubPay → Mercado Pago |
| `/vincular` | Simula el vínculo | **404** |

Antes de pushear: `npm run lint` (es `tsc --noEmit`) y `npx next build`.
