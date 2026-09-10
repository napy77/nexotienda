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

# Se consulta por un resolver público, no por el del sistema.
#
# El resolver local guarda cachés negativas: si se consultó un nombre antes de
# crearlo —cosa que pasa siempre mientras se configura— se queda con el "no existe"
# hasta que venza el TTL negativo del SOA, que acá son 3 horas. Y lo que importa no
# es lo que ve esta máquina: es lo que va a ver Let's Encrypt.
RESOLVER=""
for r in 1.1.1.1 8.8.8.8 9.9.9.9; do
  if dig @"$r" +short A example.com +time=3 +tries=1 >/dev/null 2>&1; then RESOLVER="@$r"; break; fi
done
if [[ -z "$RESOLVER" ]]; then
  echo "  ⚠ Sin resolver público alcanzable; se usa el del sistema, que puede tener"
  echo "    caché negativa. Si algo sale mal: resolvectl flush-caches"
fi

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
COMODIN=$(dig $RESOLVER +short A "zzz-inexistente-$$.${DOMAIN}" | head -1)
A=$(dig $RESOLVER +short A "$NS_NAME" | head -1)
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
NS=$(dig $RESOLVER +short NS "$ACME_ZONE" | head -1)
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
CN=$(dig $RESOLVER +short CNAME "$CHALLENGE" | head -1)
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
#
# Ojo con dónde se pregunta: si esto corre EN el propio VPS, consultar la IP
# pública es un hairpin de NAT —la máquina preguntándole a su propia IP externa—
# y muchos NAT no lo hacen. Da timeout aunque desde internet funcione perfecto.
# Así que se prueba la pública y, si falla, las IPs locales.
LOCALES=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1)

if dig @"$PUBLIC_IP" +short SOA "$ACME_ZONE" +time=5 +tries=1 | grep -q .; then
  ok "acme-dns responde por $ACME_ZONE en $PUBLIC_IP"
else
  RESPONDE=""
  for ip in $LOCALES; do
    if dig @"$ip" +short SOA "$ACME_ZONE" +time=4 +tries=1 | grep -q .; then
      RESPONDE="$ip"; break
    fi
  done
  if [[ -n "$RESPONDE" ]]; then
    ok "acme-dns responde por $ACME_ZONE en $RESPONDE"
    aviso "desde ${PUBLIC_IP} no contesta, pero es el hairpin de NAT: esta máquina no"
    aviso "    puede consultarse por su propia IP pública. Desde internet sí llega."
  else
    mal "acme-dns no responde por $ACME_ZONE. ¿Está activo?  systemctl status acme-dns"
  fi
fi

# La cadena completa: seguir el CNAME hasta la zona delegada. Todavía no hay TXT
# —lo pone certbot al validar— pero NO tiene que dar SERVFAIL.
# Sin el CNAME esta prueba no dice nada: el comodín hace que el nombre exista y
# la respuesta da NOERROR aunque no haya delegación ninguna.
if [[ -z "$CN" ]]; then
  aviso "la cadena no se puede probar hasta que esté el CNAME del punto 3"
  ESTADO=SKIP
else
  ESTADO=$(dig $RESOLVER +noall +comments TXT "$CHALLENGE" 2>/dev/null | grep -o "status: [A-Z]*" | head -1 | cut -d' ' -f2)
fi
case "$ESTADO" in
  SKIP) ;;
  # Sin desafío publicado todavía, acme-dns puede contestar NOERROR sin datos o
  # NXDOMAIN según el caso. Las dos son normales: lo que importa es que la cadena
  # llegue hasta él, y eso se prueba abajo resolviendo la zona delegada por DNS
  # público, sin preguntarle directo al daemon.
  NOERROR|NXDOMAIN)
    if dig $RESOLVER +short SOA "$ACME_ZONE" +time=5 +tries=2 | grep -q .; then
      ok "la cadena llega a acme-dns a través de la delegación (sin TXT todavía, normal)"
    else
      mal "la delegación no resuelve por DNS público. ¿Propagó el NS del punto 2?"
    fi
    ;;
  SERVFAIL) mal "la cadena da SERVFAIL: la delegación está rota o el daemon no contesta" ;;
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
