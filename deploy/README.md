# Deploy de NexoTienda

Corre en el **mismo VPS** que NexoPOS y ClubPay (`181.111.252.198`). Por eso el
script no toca nada de ellos:

| | NexoPOS | ClubPay | NexoTienda |
|---|---|---|---|
| Usuario | `nexopos` | | `nexotienda` |
| Carpeta | `/opt/nexopos` | | `/opt/nexotienda` |
| Puerto | 3000 (front) · 4000 (api) | | **3100** |
| nginx | `sites-available/nexopos` | | `sites-available/nexotienda` |

El puerto 3100 es a propósito: el 3000 ya lo usa el frontend de NexoPOS.

## Desplegar

```bash
sudo bash /opt/nexotienda/deploy/deploy.sh
```

Idempotente: la primera vez clona, después hace `pull` y reconstruye. Si el build
falla o el servicio no levanta, corta y muestra el log — no deja el sitio a medias.
Y si la config de nginx no valida, **no recarga**, así que NexoPOS y ClubPay siguen
andando.

La primera vez, antes de correrlo, hacen falta las dos cosas de abajo.

---

## 1. El comodín de DNS — obligatorio

Cada comercio es un subdominio (`supersol.nexotienda.app`) y cada pueblo también
(`morrison.nexotienda.app`). Sin el comodín, ninguna tienda abre.

En el DNS de Linware, en la zona `nexotienda.app`:

```
*    IN  A    181.111.252.198
@    IN  A    181.111.252.198
```

Hoy el `@` ya está; **el `*` falta**. Se verifica así:

```bash
dig +short cualquiercosa.nexotienda.app A     # tiene que devolver la IP
```

Con esto, un comercio nuevo no necesita ningún cambio de DNS: publica su tienda y
su dirección funciona.

## 2. El certificado

Acá está la única decisión de infraestructura, y conviene entenderla porque no es
el `certbot --nginx` de siempre.

**Un certificado comodín (`*.nexotienda.app`) solo se puede emitir por DNS-01**, que
es el desafío donde Let's Encrypt pide poner un registro TXT en la zona. El desafío
HTTP-01 —el que usa `certbot --nginx`— no emite comodines.

### Opción A · Lista explícita de hosts (recomendada para arrancar)

Funciona hoy, sin instalar nada nuevo, y **renueva sola**.

```bash
certbot --nginx \
  -d nexotienda.app \
  -d www.nexotienda.app \
  -d morrison.nexotienda.app \
  -d supersol.nexotienda.app \
  -d donarosa.nexotienda.app
```

El costo es que **cada comercio nuevo necesita reemitir el certificado**. Para eso
está `agregar-host.sh`:

```bash
sudo bash /opt/nexotienda/deploy/agregar-host.sh panaderialaesquina
```

Con el piloto de Morrison —un puñado de comercios— esto es un minuto por alta y no
se rompe nada. Cuando la lista pase de unos veinte, pasar a la opción B.

Ojo con el límite de Let's Encrypt: **50 certificados nuevos por dominio por
semana**. Reemitir agregando un host cuenta como uno nuevo, así que no conviene dar
de alta veinte comercios de a uno el mismo día.

### Opción B · Comodín por DNS-01 (el destino)

Un solo certificado cubre todos los comercios, presentes y futuros. Cero trabajo por
alta.

Como el DNS de `nexotienda.app` lo servimos nosotros (`ns1/ns2/ns3.nexotienda.app`),
la forma limpia es **RFC2136**: certbot actualiza el TXT por DNS dinámico con una
clave TSIG.

```bash
apt-get install -y python3-certbot-dns-rfc2136

cat > /etc/letsencrypt/rfc2136.ini <<'EOF'
dns_rfc2136_server = 181.15.244.186
dns_rfc2136_port = 53
dns_rfc2136_name = certbot.
dns_rfc2136_secret = <la clave TSIG>
dns_rfc2136_algorithm = HMAC-SHA512
EOF
chmod 600 /etc/letsencrypt/rfc2136.ini

certbot certonly \
  --dns-rfc2136 \
  --dns-rfc2136-credentials /etc/letsencrypt/rfc2136.ini \
  -d nexotienda.app -d '*.nexotienda.app'
```

Requiere generar la clave TSIG y habilitar `update-policy` en la zona del servidor
DNS. Es media hora de trabajo una vez, y después no se toca más.

**Lo que NO hay que hacer** es el DNS-01 manual (`--manual`). Emite igual, pero
**no renueva solo**: cada 60 días hay que poner un TXT a mano, y el día que nadie se
acuerde se caen todas las tiendas a la vez.

### Cuál elegir

Arrancar con **A**, migrar a **B** antes de que la lista se ponga larga. La A
funciona hoy y renueva sola; la B es la que escala. Migrar de una a la otra no
rompe nada: se emite el comodín y certbot reemplaza el certificado.

---

## Después del deploy

```bash
journalctl -u nexotienda -f        # logs
systemctl restart nexotienda       # reiniciar
systemctl status nexotienda        # estado
```

## Configuración

`/opt/nexotienda/.env`, que el deploy genera vacío la primera vez y **nunca pisa**.

| Variable | Vacío significa |
|---|---|
| `NEXOPOS_API_URL` | La tienda corre con los fixtures de diseño |
| `NEXOPOS_PLATFORM_KEY` | — resuelve subdominio y pueblo |
| `NEXOPOS_MERCHANT_KEY` | — catálogo, cuentas y pedidos del comercio |
| `MP_ACCESS_TOKEN` | El cobro corre en sandbox |

Después de tocarlo: `sudo bash deploy.sh` — las `NEXT_PUBLIC_*` se hornean al
compilar, así que no alcanza con reiniciar.
