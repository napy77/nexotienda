#!/usr/bin/env bash
#
# acme-dns · Instalación en el VPS de la app
#
# Sirve para emitir el certificado comodín de nexotienda.app sin tener shell en el
# servidor DNS, que está detrás de Plesk.
#
# La idea: delegamos UNA subzona (acme.nexotienda.app) a este daemon, y el
# _acme-challenge del dominio real apunta ahí por CNAME. Certbot le pide a este
# daemon —que corre acá al lado— que publique el TXT de validación.
#
# Lo que se gana: la credencial que usa certbot **solo puede escribir TXT en la
# subzona delegada**. No puede tocar nexotienda.app ni queriendo. Y una vez puestos
# los tres registros en Plesk, no se toca el DNS nunca más: ni para renovar, ni para
# dar de alta un comercio nuevo.
#
# Es autocontenido: no necesita el repo clonado ni ningún archivo al lado.
#
# Uso, como root en el VPS de la app (181.111.252.198):
#
#   curl -fsSL -o /tmp/acme-dns-install.sh \
#     https://raw.githubusercontent.com/napy77/nexotienda/main/deploy/acme-dns/install.sh
#   sudo bash /tmp/acme-dns-install.sh
#
set -euo pipefail

VERSION=2.0.2
DOMAIN=nexotienda.app
ACME_ZONE="acme.${DOMAIN}"
NS_NAME="acme-ns.${DOMAIN}"
PUBLIC_IP=181.111.252.198   # la que ve el mundo: va en los registros A
API_PORT=8081

# La IP a la que atarse es la que la máquina TIENE, que no es la misma: este VPS
# está detrás de NAT y su interfaz tiene una IP privada. Atarse a la pública falla
# con EADDRNOTAVAIL, y acme-dns en vez de decirlo se cuelga en un deadlock.
BIND_IP=$(ip -4 -o addr show scope global 2>/dev/null \
  | awk '{print $4}' | cut -d/ -f1 | head -1)
[[ -n "$BIND_IP" ]] || BIND_IP=0.0.0.0

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar como root: sudo bash $0" >&2
  exit 1
fi

fail() { echo "✗ $*" >&2; exit 1; }

echo "══ 0/6 · Dependencias ═══════════════════════════════════════════"
MISSING=()
command -v curl    >/dev/null || MISSING+=(curl)
command -v tar     >/dev/null || MISSING+=(tar)
command -v dig     >/dev/null || MISSING+=(bind9-dnsutils)
command -v python3 >/dev/null || MISSING+=(python3)
command -v certbot >/dev/null || MISSING+=(certbot)
if (( ${#MISSING[@]} )); then
  echo "  instalando: ${MISSING[*]}"
  apt-get update -qq
  apt-get install -y -qq "${MISSING[@]}"
fi
echo "  ok"

echo "══ 1/6 · El puerto 53 ═══════════════════════════════════════════"
# En Ubuntu, systemd-resolved escucha en 127.0.0.53:53. Eso NO estorba: acme-dns
# se ata solo a la IP pública, así que conviven. Lo que sí estorba es algo atado
# a 0.0.0.0:53, a [::]:53 o a la IP pública, porque ahí sí chocan.
CONFLICTO=$(ss -lntuHn 2>/dev/null \
  | grep -E "(^|[[:space:]])(0\.0\.0\.0|\[::\]|${BIND_IP//./\\.}):53([[:space:]]|$)" || true)

if [[ -n "$CONFLICTO" ]] && ! systemctl is-active --quiet acme-dns; then
  echo "$CONFLICTO" >&2
  fail "Hay algo atado al puerto 53 en una dirección que necesitamos. Ver arriba."
fi

if ss -lntuHn 2>/dev/null | grep -q '127\.0\.0\.5[34]:53'; then
  echo "  systemd-resolved en loopback — no molesta"
fi
echo "  nos atamos a ${BIND_IP}:53"
if [[ "$BIND_IP" != "$PUBLIC_IP" ]]; then
  echo "  (la máquina está detrás de NAT: ${BIND_IP} adentro, ${PUBLIC_IP} afuera)"
fi

echo "══ 2/6 · Binario ════════════════════════════════════════════════"
id acmedns &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin acmedns
mkdir -p /opt/acme-dns /etc/acme-dns /var/lib/acme-dns

if [[ ! -x /opt/acme-dns/acme-dns ]]; then
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/a.tgz" \
    "https://github.com/acme-dns/acme-dns/releases/download/v${VERSION}/acme-dns_${VERSION}_linux_amd64.tar.gz"
  tar -xzf "$TMP/a.tgz" -C "$TMP"
  install -m 755 "$TMP/acme-dns" /opt/acme-dns/acme-dns
  rm -rf "$TMP"
  echo "  acme-dns ${VERSION} instalado"
else
  echo "  ya estaba instalado"
fi
chown -R acmedns:acmedns /opt/acme-dns /var/lib/acme-dns

echo "══ 3/6 · Configuración ══════════════════════════════════════════"
if [[ ! -f /etc/acme-dns/config.cfg ]]; then
  cat > /etc/acme-dns/config.cfg <<EOF
[general]
# La IP de la interfaz, no la pública: la máquina está detrás de NAT y no tiene
# la pública. Atarse a la de la interfaz además convive con el systemd-resolved
# del sistema, que ocupa 127.0.0.53:53.
listen = "${BIND_IP}:53"
protocol = "both"
domain = "${ACME_ZONE}"
nsname = "${NS_NAME}"
nsadmin = "germanyovan.linware.com.ar"
# Los registros que este daemon sirve de su propia zona.
records = [
    "${ACME_ZONE}. A ${PUBLIC_IP}",
    "${ACME_ZONE}. NS ${NS_NAME}.",
    "${NS_NAME}. A ${PUBLIC_IP}",
]
debug = false

[database]
engine = "sqlite3"
connection = "/var/lib/acme-dns/acme-dns.db"

[api]
# Solo localhost: certbot corre en esta misma máquina, así que la API nunca sale
# del server. Sin TLS porque nunca viaja por la red.
ip = "127.0.0.1"
port = "${API_PORT}"
disable_registration = false
tls = "none"

[logconfig]
loglevel = "info"
logtype = "stdout"
logformat = "text"
EOF
  chown acmedns:acmedns /etc/acme-dns/config.cfg
  chmod 640 /etc/acme-dns/config.cfg
  echo "  config generada"
else
  # La config se preserva —puede tener cambios a mano— salvo la dirección de
  # escucha, que se deriva de la máquina y no puede quedar congelada en un valor
  # viejo. Si no coincide, se corrige: dejarla mal hace que el daemon no arranque
  # y el motivo real quede tapado por un deadlock.
  ACTUAL=$(grep -oP '^listen\s*=\s*"\K[^"]+' /etc/acme-dns/config.cfg || true)
  if [[ "$ACTUAL" != "${BIND_IP}:53" ]]; then
    sed -i "s|^listen = .*|listen = \"${BIND_IP}:53\"|" /etc/acme-dns/config.cfg
    echo "  config ya existía · listen corregido: ${ACTUAL:-vacío} → ${BIND_IP}:53"
  else
    echo "  config ya existe y el listen es correcto, no se toca"
  fi
fi

echo "══ 4/6 · Firewall ═══════════════════════════════════════════════"
# Antes de arrancar el servicio a propósito: si el arranque falla, el puerto
# igual queda abierto y no hay que acordarse de volver.
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 53/udp  >/dev/null
  ufw allow 53/tcp  >/dev/null
  echo "  53/udp y 53/tcp abiertos"
else
  echo "  ufw inactivo, nada que hacer"
fi

echo "══ 5/6 · Servicio ═══════════════════════════════════════════════"
cat > /etc/systemd/system/acme-dns.service <<'UNIT'
[Unit]
Description=acme-dns (solo sirve los TXT de validación de Let's Encrypt)
After=network.target

[Service]
Type=simple
User=acmedns
Group=acmedns
WorkingDirectory=/opt/acme-dns
ExecStart=/opt/acme-dns/acme-dns -c /etc/acme-dns/config.cfg
Restart=always
RestartSec=5
# Para escuchar en el 53 sin correr como root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/var/lib/acme-dns
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --quiet acme-dns
systemctl restart acme-dns
sleep 3
if ! systemctl is-active --quiet acme-dns; then
  journalctl -u acme-dns -n 25 --no-pager
  echo >&2
  echo "Si el log dice 'deadlock', acme-dns se tragó un error de bind." >&2
  echo "Comprobá que ${BIND_IP} sea una IP de esta máquina:" >&2
  echo "  ip -4 -o addr show scope global" >&2
  fail "acme-dns no levantó."
fi

# Que systemd lo dé por activo no prueba que conteste. Le preguntamos.
if ! dig @"$BIND_IP" +short SOA "$ACME_ZONE" +time=5 +tries=1 | grep -q .; then
  fail "acme-dns arrancó pero no contesta en ${BIND_IP}:53."
fi
echo "  activo y respondiendo · DNS en ${BIND_IP}:53 · API en 127.0.0.1:${API_PORT}"

echo "══ 6/6 · Registro de la cuenta ══════════════════════════════════"
CREDS=/etc/acme-dns/registro.json
if [[ ! -f "$CREDS" ]]; then
  curl -sS --retry 3 --retry-delay 2 -X POST \
    "http://127.0.0.1:${API_PORT}/register" -o "$CREDS" \
    || fail "La API de acme-dns no respondió en 127.0.0.1:${API_PORT}."
  chmod 600 "$CREDS"
  echo "  cuenta registrada"
else
  echo "  ya había una cuenta registrada, se reusa"
fi

# Si el registro salió mal, el archivo queda con basura y el CNAME que
# imprimiríamos sería inservible. Mejor cortar acá.
FULL=$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); ks=('username','password','subdomain','fulldomain'); sys.exit(1) if not all(k in d for k in ks) else print(d['fulldomain'])" "$CREDS" 2>/dev/null || true)

if [[ -z "$FULL" ]]; then
  echo "--- contenido de $CREDS ---" >&2
  cat "$CREDS" >&2
  rm -f "$CREDS"
  fail "El registro no devolvió credenciales válidas. Se borró el archivo; volvé a correr el script."
fi

cat > /etc/acme-dns/auth-hook.sh <<'HOOK'
#!/usr/bin/env bash
# Hook de validación para certbot. Publica el TXT en acme-dns, que corre acá al
# lado. No toca el DNS de nexotienda.app: solo la zona delegada.
# Queda guardado en la config de renovación, así que las renovaciones lo reusan.
set -euo pipefail
CREDS=/etc/acme-dns/registro.json
API=http://127.0.0.1:8081
[[ -f "$CREDS" ]] || { echo "Falta $CREDS." >&2; exit 1; }
USER=$(python3 -c "import json;print(json.load(open('$CREDS'))['username'])")
PASS=$(python3 -c "import json;print(json.load(open('$CREDS'))['password'])")
SUB=$(python3  -c "import json;print(json.load(open('$CREDS'))['subdomain'])")
RESP=$(curl -sS -X POST "$API/update" \
  -H "X-Api-User: $USER" -H "X-Api-Key: $PASS" \
  -H "Content-Type: application/json" \
  -d "{\"subdomain\":\"$SUB\",\"txt\":\"$CERTBOT_VALIDATION\"}")
grep -q "$CERTBOT_VALIDATION" <<<"$RESP" || {
  echo "acme-dns no aceptó el TXT: $RESP" >&2; exit 1; }
sleep 5
HOOK
chmod 755 /etc/acme-dns/auth-hook.sh

cat <<EOF

✔ acme-dns andando.

═══════════════════════════════════════════════════════════════════
  AHORA, EN PLESK — tres registros en la zona ${DOMAIN}.
  Se ponen UNA vez y no se tocan nunca más.
═══════════════════════════════════════════════════════════════════

  1)  ${NS_NAME}.        A     ${PUBLIC_IP}
  2)  ${ACME_ZONE}.      NS    ${NS_NAME}.
  3)  _acme-challenge.${DOMAIN}.   CNAME   ${FULL}.

  El tercero es el que hace la magia: Let's Encrypt busca el TXT en
  _acme-challenge.${DOMAIN}, el CNAME lo manda a la zona delegada, y
  esa zona la sirve este daemon. Plesk queda afuera del asunto.

Cuando estén puestos, verificá que la delegación funciona:

  dig +short NS ${ACME_ZONE}
  dig +short CNAME _acme-challenge.${DOMAIN}

Y recién ahí emitís el certificado:

  certbot certonly \\
    --manual --preferred-challenges dns \\
    --manual-auth-hook /etc/acme-dns/auth-hook.sh \\
    --non-interactive --agree-tos \\
    -d ${DOMAIN} -d '*.${DOMAIN}'

EOF
