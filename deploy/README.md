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

Un comodín solo se emite por **DNS-01** —el desafío donde Let's Encrypt pide un
registro TXT—. El problema es que el DNS de `nexotienda.app` está detrás de un panel
**Plesk sin acceso por shell**, así que no se puede automatizar poniendo el TXT ahí.

La salida es **delegar**: le cedemos una subzona chiquita a un daemon nuestro, y el
`_acme-challenge` del dominio real apunta ahí por CNAME.

```
Let's Encrypt pregunta por:   _acme-challenge.nexotienda.app   TXT
   (en Plesk, estático)        └── CNAME →  <id>.acme.nexotienda.app
   (delegado por NS)                        └── lo sirve acme-dns en el VPS
```

Lo que se gana, y es más de lo que parece:

- **La credencial de certbot no puede tocar `nexotienda.app`.** Solo escribe TXT en
  la subzona delegada. Si se filtra, el daño es un registro de validación. Con una
  clave TSIG o una API key de Plesk el alcance sería la zona entera o el panel entero.
- **Plesk se toca una sola vez.** Tres registros estáticos, y después ni para renovar
  ni para dar de alta un comercio.
- **La API de acme-dns nunca sale de localhost**, porque certbot corre en la misma
  máquina.

### Paso 1 · Instalar acme-dns — en el VPS de la app

```bash
sudo bash /opt/nexotienda/deploy/acme-dns/install.sh
```

Baja el binario, lo deja corriendo como servicio en el puerto 53 (verificado: está
libre en ese VPS), registra la cuenta, y **te imprime los tres registros exactos**
que hay que cargar en Plesk, con el id ya generado.

### Paso 2 · Los tres registros — en el panel de Plesk

Los que imprimió el paso anterior, en la zona `nexotienda.app`:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `acme-ns.nexotienda.app` | `181.111.252.198` |
| NS | `acme.nexotienda.app` | `acme-ns.nexotienda.app.` |
| CNAME | `_acme-challenge.nexotienda.app` | `<lo que imprimió install.sh>` |

Ojo con el CNAME: el valor es un id aleatorio que genera acme-dns al registrarse. Sale
en la salida del paso 1 y también con:

```bash
python3 -c "import json;print(json.load(open('/etc/acme-dns/registro.json'))['fulldomain'])"
```

Verificar que la delegación quedó bien antes de seguir:

```bash
dig +short NS acme.nexotienda.app                    # → acme-ns.nexotienda.app.
dig +short CNAME _acme-challenge.nexotienda.app      # → <id>.acme.nexotienda.app.
```

Si el NS no resuelve, Plesk todavía no propagó o el registro quedó mal. **No sigas**
hasta que las dos consultas contesten: si emitís antes, quemás intentos contra el
límite de Let's Encrypt.

### Paso 3 · Emitir — en el VPS de la app

```bash
certbot certonly \
  --manual --preferred-challenges dns \
  --manual-auth-hook /etc/acme-dns/auth-hook.sh \
  --non-interactive --agree-tos \
  -d nexotienda.app -d '*.nexotienda.app'
```

Antes te advertí que **no** usaras `--manual` porque no renueva solo. Esta es la
excepción y la diferencia es el `--manual-auth-hook`: certbot lo guarda en la config
de renovación y lo vuelve a ejecutar solo. Un `--manual` pelado, sin hook, sí queda
manual para siempre.

### Paso 4 · Que nginx lo use — en el VPS de la app

`certonly` emite el certificado pero **no toca nginx**:

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

### Si algo del comodín no sale

Queda `agregar-host.sh` como salida de emergencia: emite un certificado con lista
explícita de hosts por HTTP-01, sin tocar el DNS. Funciona y renueva solo, pero hay
que correrlo en cada alta de comercio.

```bash
sudo bash /opt/nexotienda/deploy/agregar-host.sh panaderialaesquina
```

### Mantenimiento

acme-dns es un daemon más que tiene que estar vivo. Si se cae, la tienda **no** se
cae — solo fallan las renovaciones, y de eso te enterás 30 días antes del
vencimiento, no el día que pasa.

```bash
systemctl status acme-dns
journalctl -u acme-dns -n 50
```

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
