#!/usr/bin/env bash
#
# Hook de validación para certbot.
#
# certbot lo llama con CERTBOT_DOMAIN y CERTBOT_VALIDATION, y lo único que hace es
# publicar ese TXT en acme-dns, que corre acá al lado. No toca el DNS de
# nexotienda.app: solo escribe en la zona delegada acme.nexotienda.app.
#
# Va guardado en la config de renovación, así que las renovaciones también lo usan.
# (Un `--manual` pelado NO renueva solo; con hook, sí.)
set -euo pipefail

CREDS=/etc/acme-dns/registro.json
API=http://127.0.0.1:8081

[[ -f "$CREDS" ]] || { echo "Falta $CREDS. ¿Corriste install.sh?" >&2; exit 1; }

USER=$(python3 -c "import json;print(json.load(open('$CREDS'))['username'])")
PASS=$(python3 -c "import json;print(json.load(open('$CREDS'))['password'])")
SUB=$(python3  -c "import json;print(json.load(open('$CREDS'))['subdomain'])")

RESP=$(curl -sS -X POST "$API/update" \
  -H "X-Api-User: $USER" \
  -H "X-Api-Key: $PASS" \
  -H "Content-Type: application/json" \
  -d "{\"subdomain\":\"$SUB\",\"txt\":\"$CERTBOT_VALIDATION\"}")

grep -q "$CERTBOT_VALIDATION" <<<"$RESP" || {
  echo "acme-dns no aceptó el TXT: $RESP" >&2
  exit 1
}

# Los secundarios no entran en juego —la zona delegada la sirve solo este daemon—
# pero Let's Encrypt cachea, así que un respiro no viene mal.
sleep 5
