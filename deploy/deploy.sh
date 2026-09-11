#!/usr/bin/env bash
#
# NexoTienda · Deploy / actualización
#
# Baja el código del repo, compila, y deja andando el servicio y el nginx.
# Es idempotente: correrlo de nuevo despliega la versión nueva.
#
# Corre en el MISMO VPS que NexoPOS y ClubPay, así que no toca nada de ellos:
# usuario propio, puerto propio, y su propio archivo en sites-available.
#
# LA PRIMERA VEZ el repo todavía no está en el servidor, así que hay que bajar
# este script suelto. Son dos líneas:
#
#   curl -fsSL -o /tmp/deploy-nexotienda.sh \
#     https://raw.githubusercontent.com/napy77/nexotienda/main/deploy/deploy.sh
#   sudo bash /tmp/deploy-nexotienda.sh
#
# (No hace falta crear /opt/nexotienda: el clone lo crea.)
#
# DE AHÍ EN MÁS el script ya vive en el repo:
#
#   sudo bash /opt/nexotienda/deploy/deploy.sh
#
# Antes de la primera corrida hacen falta dos cosas del lado del DNS:
#   1) el registro comodín   *.nexotienda.app  A  <ip del VPS>
#   2) el certificado        — ver deploy/README.md
#
set -euo pipefail

REPO_URL="https://github.com/napy77/nexotienda.git"
APP_DIR=/opt/nexotienda
APP_USER=nexotienda
DOMAIN=nexotienda.app
PORT=3100

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar como root: sudo bash $0" >&2
  exit 1
fi

fail() { echo "✗ $*" >&2; exit 1; }

echo "══ 1/6 · Requisitos ═════════════════════════════════════════════"

command -v git   >/dev/null || fail "Falta git."
command -v nginx >/dev/null || fail "Falta nginx."
command -v node  >/dev/null || fail "Falta Node.js."
command -v curl  >/dev/null || fail "Falta curl (lo usa la comprobación final)."

NODE_MAJOR=$(node -v | cut -d. -f1 | tr -d v)
# Next 16 no arranca con menos de 20.9.
[[ "$NODE_MAJOR" -ge 20 ]] || fail "Node $(node -v) es viejo para Next 16. Hace falta 20.9 o más."
echo "  node $(node -v) · nginx ok · git ok"

# El puerto 3000 lo usa el frontend de NexoPOS en este mismo servidor.
if ss -lntp 2>/dev/null | grep -q ":${PORT}\b"; then
  if ! systemctl is-active --quiet nexotienda; then
    fail "El puerto ${PORT} está ocupado por otra cosa. Cambialo en deploy/nexotienda.service y acá."
  fi
fi

if ! id "$APP_USER" &>/dev/null; then
  useradd --system --create-home --shell /bin/bash "$APP_USER"
  echo "  usuario de sistema '$APP_USER' creado"
fi

echo "══ 2/6 · Código fuente ══════════════════════════════════════════"
if [[ -d "$APP_DIR/.git" ]]; then
  # git como el dueño del repo: root lo rechaza por "dubious ownership".
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --quiet origin
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi
echo "  $(sudo -u "$APP_USER" git -C "$APP_DIR" log --oneline -1)"

echo "══ 3/6 · Configuración ══════════════════════════════════════════"
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_ROOT_DOMAIN=${DOMAIN}

# API de NexoPOS. Vacío = la tienda corre con los fixtures de diseño.
# Tres claves separadas por capacidad: catálogo, pedidos y cuentas. La de cuentas
# sola no alcanza — esos endpoints piden además la sesión del token de ClubPay.
NEXOPOS_API_URL=
NEXOPOS_KEY_CATALOGO=
NEXOPOS_KEY_PEDIDOS=
NEXOPOS_KEY_CUENTAS=

# Mercado Pago del comercio. Vacío = el cobro corre en sandbox.
MP_ACCESS_TOKEN=
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "  .env generado — está vacío a propósito: arranca con fixtures."
else
  echo "  .env ya existe, no se toca"
  # No se reescribe —puede tener claves de verdad— pero sí se avisa si quedó con
  # nombres de variables que el código ya no lee. Sin esto, el día que peguen las
  # claves reales en la variable vieja no las lee nadie y el síntoma es que la
  # tienda sigue mostrando los fixtures, que no señala la causa por ningún lado.
  for vieja in NEXOPOS_API_KEY NEXOPOS_PLATFORM_KEY NEXOPOS_MERCHANT_KEY; do
    if grep -q "^${vieja}=" "$ENV_FILE"; then
      echo "  ⚠ $ENV_FILE tiene ${vieja}, que ya no se usa."
      echo "    Las de ahora son NEXOPOS_KEY_CATALOGO, NEXOPOS_KEY_PEDIDOS y NEXOPOS_KEY_CUENTAS."
    fi
  done
fi

echo "══ 4/6 · Dependencias y build ═══════════════════════════════════"
# El .env va antes del build: las NEXT_PUBLIC_* se hornean al compilar.
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci && npm run build"

echo "══ 5/6 · Servicio ═══════════════════════════════════════════════"
cp "$APP_DIR/deploy/nexotienda.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --quiet nexotienda
systemctl restart nexotienda

# Que "restart" no falle no quiere decir que el proceso haya levantado.
sleep 3
systemctl is-active --quiet nexotienda || {
  journalctl -u nexotienda -n 30 --no-pager
  fail "El servicio no levantó. El log está arriba."
}
echo "  servicio activo en :${PORT}"

echo "══ 6/6 · nginx ══════════════════════════════════════════════════"
# Solo la primera vez: después el archivo lo administra certbot, y pisarlo
# borraría el bloque SSL. Los sites de NexoPOS y ClubPay no se tocan.
if [[ ! -f /etc/nginx/sites-available/nexotienda ]]; then
  cp "$APP_DIR/deploy/nginx-nexotienda.conf" /etc/nginx/sites-available/nexotienda
  ln -sf /etc/nginx/sites-available/nexotienda /etc/nginx/sites-enabled/nexotienda
  echo "  config instalada"
else
  echo "  config ya existe (la administra certbot), no se toca"
fi

nginx -t || fail "La config de nginx no valida. NO se recargó: los otros sitios siguen andando."
systemctl reload nginx

echo
echo "✔ Deploy completo · $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
echo

# Un deploy que "termina bien" y deja el sitio caído es peor que uno que falla.
LOCAL=$(curl -s -o /dev/null -m 10 -w "%{http_code}" -H "Host: supersol.${DOMAIN}" "http://127.0.0.1:${PORT}/" || echo "000")
if [[ "$LOCAL" == "200" ]]; then
  echo "  Comprobación: supersol.${DOMAIN} responde 200 desde la app."
else
  echo "  ⚠ La app contestó ${LOCAL} para supersol.${DOMAIN}, no 200."
  echo "    Revisar:  journalctl -u nexotienda -n 50 --no-pager"
fi

echo
echo "  Logs:      journalctl -u nexotienda -f"
echo "  Reiniciar: systemctl restart nexotienda"
echo
if [[ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  echo "  Falta el certificado. Ver deploy/README.md — necesita el comodín."
fi
