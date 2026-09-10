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
# Uso, como root en 181.111.252.198:
#   sudo bash install.sh
#
set -euo pipefail

VERSION=2.0.2
DOMAIN=nexotienda.app
ACME_ZONE="acme.${DOMAIN}"
NS_NAME="acme-ns.${DOMAIN}"
PUBLIC_IP=181.111.252.198
API_PORT=8081

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar como root: sudo bash $0" >&2
  exit 1
fi

fail() { echo "✗ $*" >&2; exit 1; }

echo "══ 1/6 · El puerto 53 tiene que estar libre ═════════════════════"
if ss -lntu 2>/dev/null | grep -qE ':53\s'; then
  systemctl is-active --quiet acme-dns \
    || fail "Algo ya escucha en el 53. Revisar con: ss -lntup | grep :53"
fi
echo "  libre"

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
listen = "0.0.0.0:53"
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
  echo "  config ya existe, no se toca"
fi

echo "══ 4/6 · Servicio ═══════════════════════════════════════════════"
cp "$(dirname "$0")/acme-dns.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --quiet acme-dns
systemctl restart acme-dns
sleep 3
systemctl is-active --quiet acme-dns || {
  journalctl -u acme-dns -n 30 --no-pager
  fail "acme-dns no levantó. El log está arriba."
}
echo "  activo · DNS en :53 · API en 127.0.0.1:${API_PORT}"

echo "══ 5/6 · Firewall ═══════════════════════════════════════════════"
if command -v ufw >/dev/null && ufw status | grep -q "^Status: active"; then
  ufw allow 53/udp  >/dev/null
  ufw allow 53/tcp  >/dev/null
  echo "  53/udp y 53/tcp abiertos"
else
  echo "  ufw inactivo, nada que hacer"
fi

echo "══ 6/6 · Registro de la cuenta ══════════════════════════════════"
CREDS=/etc/acme-dns/registro.json
if [[ ! -f "$CREDS" ]]; then
  curl -sS -X POST "http://127.0.0.1:${API_PORT}/register" -o "$CREDS"
  chmod 600 "$CREDS"
  echo "  cuenta registrada"
else
  echo "  ya había una cuenta registrada, se reusa"
fi

FULL=$(python3 -c "import json;print(json.load(open('$CREDS'))['fulldomain'])")

install -m 755 "$(dirname "$0")/auth-hook.sh" /etc/acme-dns/auth-hook.sh

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
