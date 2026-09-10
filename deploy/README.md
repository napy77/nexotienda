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

## La primera vez

En el servidor todavía no hay nada, así que el script hay que bajarlo suelto. Dos
líneas, y **no hace falta crear ningún directorio** — el clone crea `/opt/nexotienda`:

```bash
curl -fsSL -o /tmp/deploy-nexotienda.sh https://raw.githubusercontent.com/napy77/nexotienda/main/deploy/deploy.sh
sudo bash /tmp/deploy-nexotienda.sh
```

Se baja a un archivo en vez de hacer `curl … | sudo bash` para poder leerlo antes de
correrlo, y para que una descarga cortada por la mitad no se ejecute a medias.

## De ahí en más

Ya está el repo en el servidor, así que el script sale de ahí:

```bash
sudo bash /opt/nexotienda/deploy/deploy.sh
```

Idempotente: clona la primera vez, después hace `pull` y reconstruye. Si el build
falla o el servicio no levanta, corta y muestra el log — no deja el sitio a medias.
Y si la config de nginx no valida, **no recarga**, así que NexoPOS y ClubPay siguen
andando.

---

## 1. El comodín de DNS — hecho ✓

Cada comercio es un subdominio (`supersol.nexotienda.app`) y cada pueblo también
(`morrison.nexotienda.app`). Sin el comodín, ninguna tienda abre.

En el DNS de Linware, en la zona `nexotienda.app`:

```
*    IN  A    181.111.252.198
@    IN  A    181.111.252.198
```

Ya está puesto. Se verifica así:

```bash
dig +short cualquiercosa.nexotienda.app A     # → 181.111.252.198
```

Con esto, un comercio nuevo no necesita ningún cambio de DNS: publica su tienda y
su dirección funciona.

## 2. El certificado comodín

Un solo certificado cubre `nexotienda.app` y **todos** los subdominios, presentes y
futuros. Un comercio nuevo no necesita ni DNS ni certificado: publica y anda.

Como un comodín solo se emite por **DNS-01** —el desafío donde Let's Encrypt pide un
registro TXT— y el DNS de `nexotienda.app` lo servimos nosotros, la forma limpia es
**RFC2136**: certbot pone y saca el TXT solo, por update dinámico, autenticándose con
una clave TSIG.

### De dónde sale la clave TSIG

**No se saca de ningún lado: se genera.** Es un secreto compartido que se crea en el
servidor DNS y se le copia a certbot. Nadie más lo emite.

### Paso 1 · En el DNS primario

El primario es el que dice el SOA: **`ns2.nexotienda.app` = 104.248.13.36**, que corre
BIND 9.18 sobre Ubuntu 24.04. Los updates dinámicos van al primario; cualquier otro
los rechaza.

```bash
# Generar la clave
tsig-keygen -a HMAC-SHA512 certbot | tee /etc/bind/keys-certbot.conf
chown root:bind /etc/bind/keys-certbot.conf
chmod 640 /etc/bind/keys-certbot.conf
```

Sale algo así, y **ese `secret` es el que va en el ini de certbot**:

```
key "certbot" {
    algorithm hmac-sha512;
    secret "aBcD…muy largo…==";
};
```

En `/etc/bind/named.conf.local`, incluir la clave y **darle permiso solo al TXT del
desafío**:

```
include "/etc/bind/keys-certbot.conf";

zone "nexotienda.app" {
    type master;
    file "/var/lib/bind/nexotienda.app.zone";

    // Solo ese nombre y solo TXT. Si la clave se filtra, el daño es un registro
    // de validación, no la zona entera.
    update-policy {
        grant certbot name _acme-challenge.nexotienda.app. txt;
    };
};
```

```bash
named-checkconf && rndc reload
```

> **Ojo, esto cambia cómo se edita la zona.** Desde que acepta updates dinámicos,
> BIND lleva un journal (`.jnl`) y **el archivo de zona no se edita más a mano** sin
> congelarlo antes:
> ```bash
> rndc freeze nexotienda.app     # editar el archivo
> rndc thaw   nexotienda.app     # vuelve a aceptar updates
> ```
> Si te olvidás del `freeze`, BIND pisa tus cambios con el journal. Vale la pena
> saberlo antes que descubrirlo.

### Paso 2 · En el VPS de la app

```bash
apt-get install -y python3-certbot-dns-rfc2136

cat > /etc/letsencrypt/rfc2136.ini <<'EOF'
dns_rfc2136_server = 104.248.13.36
dns_rfc2136_port = 53
dns_rfc2136_name = certbot.
dns_rfc2136_secret = <el secret del paso 1>
dns_rfc2136_algorithm = HMAC-SHA512
EOF
chmod 600 /etc/letsencrypt/rfc2136.ini
```

`dns_rfc2136_name` es el **nombre de la clave** (`certbot`, con el punto final), no un
hostname. Es el error más común de este archivo.

Antes de pedir el certificado conviene probar que el update llega:

```bash
nsupdate -k /etc/bind/keys-certbot.conf <<'EOF'
server 104.248.13.36
update add _acme-challenge.nexotienda.app. 60 TXT "prueba"
send
EOF
dig @104.248.13.36 +short TXT _acme-challenge.nexotienda.app     # → "prueba"
```

Si eso anda, certbot va a andar. Si da `REFUSED`, es la `update-policy`; si da
`NOTAUTH`, es la clave o el nombre de la clave.

### Paso 3 · Emitir

```bash
certbot certonly \
  --dns-rfc2136 \
  --dns-rfc2136-credentials /etc/letsencrypt/rfc2136.ini \
  --dns-rfc2136-propagation-seconds 60 \
  -d nexotienda.app -d '*.nexotienda.app'
```

Los 60 segundos de propagación son por los secundarios: Let's Encrypt puede consultar
cualquiera de los tres NS, y si todavía no replicaron el TXT, falla.

### Paso 4 · Que nginx lo use

`certonly` emite el certificado pero **no toca nginx**. Hay que instalar la config con
SSL y el hook que recarga después de cada renovación:

```bash
cp /opt/nexotienda/deploy/nginx-nexotienda-ssl.conf /etc/nginx/sites-available/nexotienda
nginx -t && systemctl reload nginx

install -m 755 /opt/nexotienda/deploy/hooks/reload-nginx.sh \
  /etc/letsencrypt/renewal-hooks/deploy/nexotienda-reload-nginx.sh
```

Sin el hook, certbot renueva y nginx sigue sirviendo el viejo hasta el próximo
reload — y el día que venza se caen todas las tiendas juntas.

### Paso 5 · Probar la renovación ahora, no en 60 días

```bash
certbot renew --dry-run
```

Es el único momento en que te enterás de que algo está mal sin que se caiga nada.

---

### Si algo del comodín no sale

Queda `agregar-host.sh` como salida de emergencia: emite un certificado con lista
explícita de hosts y lo extiende comercio por comercio. Funciona y renueva solo, pero
hay que correrlo en cada alta. Con el comodín andando no hace falta — el script lo
detecta y avisa que ya está cubierto.

```bash
sudo bash /opt/nexotienda/deploy/agregar-host.sh panaderialaesquina
```

### Nota sobre el tercer nameserver

`ns3.nexotienda.app` (200.105.94.80) no contestó cuando lo consultamos desde acá. Si
está caído o filtrado no rompe la emisión —alcanza con que respondan ns1 y ns2— pero
conviene revisarlo, porque un NS que no contesta agrega latencia a cada consulta.

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
