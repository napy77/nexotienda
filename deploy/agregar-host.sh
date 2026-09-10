#!/usr/bin/env bash
#
# NexoTienda · Agrega un subdominio al certificado
#
# Mientras usemos la opción A (lista explícita de hosts), cada comercio nuevo
# necesita que se reemita el certificado incluyéndolo. Esto lo hace.
#
#   sudo bash agregar-host.sh panaderialaesquina
#
# Con el certificado comodín (opción B) este script deja de hacer falta.
#
set -euo pipefail

DOMAIN=nexotienda.app

if [[ $EUID -ne 0 ]]; then
  echo "Ejecutar como root: sudo bash $0 <slug>" >&2
  exit 1
fi

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Falta el slug del comercio.  Uso: sudo bash $0 supersol" >&2
  exit 1
fi
if ! [[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]]; then
  echo "Slug inválido: solo minúsculas, números y guiones." >&2
  exit 1
fi

NEW_HOST="${SLUG}.${DOMAIN}"
LIVE="/etc/letsencrypt/live/${DOMAIN}"

if [[ ! -d "$LIVE" ]]; then
  echo "Todavía no hay certificado para ${DOMAIN}. Ver deploy/README.md." >&2
  exit 1
fi

# Si ya hay comodín, no hay nada que hacer.
if openssl x509 -in "$LIVE/cert.pem" -noout -text | grep -q "DNS:\*\.${DOMAIN}"; then
  echo "✔ El certificado es comodín: ${NEW_HOST} ya está cubierto."
  exit 0
fi

CURRENT=$(openssl x509 -in "$LIVE/cert.pem" -noout -text \
  | grep -A1 "Subject Alternative Name" | tail -1 \
  | tr -d ' ' | tr ',' '\n' | sed 's/^DNS://')

if grep -qx "$NEW_HOST" <<<"$CURRENT"; then
  echo "✔ ${NEW_HOST} ya está en el certificado."
  exit 0
fi

# El host tiene que resolver antes de pedirlo: si no, el desafío falla y certbot
# aborta la reemisión, dejando el certificado viejo sin tocar.
if ! getent hosts "$NEW_HOST" >/dev/null; then
  echo "✗ ${NEW_HOST} no resuelve. ¿Está el comodín '*.${DOMAIN}' en el DNS?" >&2
  exit 1
fi

ARGS=()
while read -r h; do [[ -n "$h" ]] && ARGS+=(-d "$h"); done <<<"$CURRENT"
ARGS+=(-d "$NEW_HOST")

echo "Reemitiendo el certificado con $(( ${#ARGS[@]} / 2 )) hosts…"
certbot --nginx --cert-name "$DOMAIN" --expand "${ARGS[@]}"

nginx -t && systemctl reload nginx
echo "✔ ${NEW_HOST} agregado."
