#!/usr/bin/env bash
#
# acme-dns · Verifica que la delegación esté bien antes de pedir el certificado
#
# Mira las tres cosas que hay que cargar en Plesk, más dos comprobaciones de punta
# a punta. Vale la pena correrlo: si emitís con la delegación a medias, el intento
# falla igual y se descuenta del límite de Let's Encrypt.
#
#   curl -fsSL -o /tmp/verificar.sh \
#     https://raw.githubusercontent.com/napy77/nexotienda/main/deploy/acme-dns/verificar.sh
#   bash /tmp/verificar.sh
#
set -uo pipefail

DOMAIN=nexotienda.app
ACME_ZONE="acme.${DOMAIN}"
NS_NAME="acme-ns.${DOMAIN}"
PUBLIC_IP=181.111.252.198
CHALLENGE="_acme-challenge.${DOMAIN}"
CREDS=/etc/acme-dns/registro.json

command -v dig >/dev/null || { echo "Falta dig:  apt-get install -y bind9-dnsutils" >&2; exit 1; }

OK=0
FALLA=0
ok()   { echo "  ✔ $*"; OK=$((OK+1)); }
aviso(){ echo "  ⚠ $*"; }
mal()  { echo "  ✗ $*"; FALLA=$((FALLA+1)); }

echo
echo "══ Los tres registros de Plesk ══════════════════════════════════"

# 1 · La dirección del nameserver. Sin esto la delegación queda coja: el NS
#     existe pero apunta a un nombre que no resuelve.
# El comodín *.nexotienda.app contesta por cualquier nombre, así que hay que
# distinguir el registro puesto a propósito del que responde de rebote. Si no, se
# da por configurado algo que no está.
COMODIN=$(dig +short A "zzz-inexistente-$$.${DOMAIN}" | head -1)
A=$(dig +short A "$NS_NAME" | head -1)
if [[ "$A" == "$PUBLIC_IP" && "$COMODIN" == "$PUBLIC_IP" ]]; then
  aviso "1· $NS_NAME resuelve, pero por el comodín *.${DOMAIN} — no hay un A propio."
  aviso "    Funciona igual. Conviene ponerlo explícito: si el comodín cambia, se rompe."
elif [[ "$A" == "$PUBLIC_IP" ]]; then
  ok "1· $NS_NAME  A  $A"
elif [[ -n "$A" ]]; then
  mal "1· $NS_NAME apunta a $A y debería ser $PUBLIC_IP"
else
  mal "1· falta el registro A de $NS_NAME → $PUBLIC_IP"
fi

# 2 · La delegación.
NS=$(dig +short NS "$ACME_ZONE" | head -1)
if [[ "$NS" == "${NS_NAME}." ]]; then
  ok "2· $ACME_ZONE  NS  $NS"
elif [[ -n "$NS" ]]; then
  mal "2· $ACME_ZONE delega en $NS y debería ser ${NS_NAME}."
else
  mal "2· falta el registro NS de $ACME_ZONE → ${NS_NAME}."
fi

# 3 · El puntero. El valor sale del registro que hizo install.sh.
ESPERADO=""
if [[ -f "$CREDS" ]]; then
  ESPERADO=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['fulldomain'])" "$CREDS" 2>/dev/null || true)
fi
CN=$(dig +short CNAME "$CHALLENGE" | head -1)
if [[ -z "$CN" ]]; then
  mal "3· falta el CNAME de $CHALLENGE${ESPERADO:+ → ${ESPERADO}.}"
elif [[ -n "$ESPERADO" && "$CN" != "${ESPERADO}." ]]; then
  mal "3· el CNAME apunta a $CN y debería ser ${ESPERADO}."
else
  ok "3· $CHALLENGE  CNAME  $CN"
fi

echo
echo "══ De punta a punta ═════════════════════════════════════════════"

# ¿El daemon está sirviendo su zona? Se le pregunta directo, sin pasar por Plesk.
if dig @"$PUBLIC_IP" +short SOA "$ACME_ZONE" +time=5 +tries=1 | grep -q .; then
  ok "acme-dns responde por $ACME_ZONE en $PUBLIC_IP"
else
  mal "acme-dns no responde por $ACME_ZONE. ¿Está activo?  systemctl status acme-dns"
fi

# La cadena completa: seguir el CNAME hasta la zona delegada. Todavía no hay TXT
# —lo pone certbot al validar— pero NO tiene que dar SERVFAIL.
# Sin el CNAME esta prueba no dice nada: el comodín hace que el nombre exista y
# la respuesta da NOERROR aunque no haya delegación ninguna.
if [[ -z "$CN" ]]; then
  aviso "la cadena no se puede probar hasta que esté el CNAME del punto 3"
  ESTADO=SKIP
else
  ESTADO=$(dig +noall +comments TXT "$CHALLENGE" 2>/dev/null | grep -o "status: [A-Z]*" | head -1 | cut -d' ' -f2)
fi
case "$ESTADO" in
  SKIP) ;;
  NOERROR) ok "la cadena resuelve (status NOERROR; sin TXT todavía, es lo normal)" ;;
  SERVFAIL) mal "la cadena da SERVFAIL: la delegación está rota o el daemon no contesta" ;;
  NXDOMAIN) mal "la cadena da NXDOMAIN: falta el CNAME o el nombre está mal escrito" ;;
  *) mal "respuesta inesperada consultando $CHALLENGE (${ESTADO:-sin respuesta})" ;;
esac

echo
if (( FALLA == 0 )); then
  cat <<EOF
✔ Todo en orden. Ya podés emitir:

  certbot certonly --manual --preferred-challenges dns \\
    --manual-auth-hook /etc/acme-dns/auth-hook.sh \\
    --non-interactive --agree-tos \\
    -d ${DOMAIN} -d '*.${DOMAIN}'
EOF
else
  echo "✗ ${FALLA} cosa(s) por arreglar. NO emitas todavía: el intento fallido"
  echo "  se descuenta igual del límite de Let's Encrypt."
  echo
  echo "  Si acabás de cargar los registros en Plesk, puede ser propagación."
  echo "  Esperá unos minutos y volvé a correr esto."
  exit 1
fi
