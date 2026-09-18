#!/usr/bin/env bash
# Qué devuelve NexoPOS para las campañas de una tienda, y qué de eso llega a verse.
#
# Corre EN EL VPS de NexoTienda:   sudo bash /opt/nexotienda/deploy/diagnostico-campanas.sh jure-hnos-srl
#
# No imprime ninguna clave.
set -uo pipefail

SLUG="${1:-}"
[ -z "$SLUG" ] && { echo "Uso: $0 <slug-de-la-tienda>"; exit 1; }

ENV_FILE=/opt/nexotienda/.env
[ -f "$ENV_FILE" ] || { echo "No encuentro $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a

API="${NEXOPOS_API_URL:-}"
KEY="${NEXOPOS_KEY_CATALOGO:-}"
[ -z "$API" ] && { echo "NEXOPOS_API_URL vacío: la tienda estaría corriendo con datos de prueba."; exit 1; }
[ -z "$KEY" ] && { echo "NEXOPOS_KEY_CATALOGO vacío."; exit 1; }

get() { curl -s -w $'\n%{http_code}' -H "Authorization: Bearer $KEY" "$API$1"; }
cuerpo() { sed '$d'; }
codigo() { tail -n1; }

echo "== 1. La tienda =========================================="
R=$(get "/v1/stores/$SLUG")
C=$(printf '%s' "$R" | codigo); B=$(printf '%s' "$R" | cuerpo)
echo "HTTP $C"
[ "$C" != "200" ] && { echo "$B" | head -c 400; echo; echo "→ Si no es 200, el resto no tiene sentido."; exit 1; }
SID=$(printf '%s' "$B" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))' 2>/dev/null)
echo "storeId: ${SID:-(no vino)}"
[ -z "$SID" ] && exit 1

echo
echo "== 2. Las campañas, tal como llegan ======================="
R=$(get "/v1/stores/$SID/campaigns")
C=$(printf '%s' "$R" | codigo); B=$(printf '%s' "$R" | cuerpo)
echo "HTTP $C"
printf '%s' "$B" | python3 -m json.tool 2>/dev/null || { echo "$B" | head -c 600; echo; }

echo
echo "== 3. ¿Sobreviven el filtro de la tienda? ================="
printf '%s' "$B" | python3 - <<'PY'
import sys, json, datetime
try:
    cs = json.load(sys.stdin)
except Exception:
    print("No es JSON. Ahí está el problema."); raise SystemExit
if not isinstance(cs, list):
    print("No es un arreglo. La tienda espera una lista."); raise SystemExit
if not cs:
    print("Vacío: NexoPOS dice que este comercio no tiene campañas vigentes."); raise SystemExit
ahora = datetime.datetime.now(datetime.timezone.utc)
for c in cs:
    fallas = []
    if not c.get("id"):   fallas.append("sin id")
    if not c.get("name"): fallas.append("sin name")
    ids = c.get("productIds")
    if not isinstance(ids, list): fallas.append(f"productIds no es lista (es {type(ids).__name__})")
    fin = c.get("endsAt")
    if fin:
        try:
            if datetime.datetime.fromisoformat(fin.replace("Z","+00:00")) < ahora:
                fallas.append(f"endsAt ya pasó ({fin})")
        except Exception:
            fallas.append(f"endsAt no se entiende ({fin})")
    n = len(ids) if isinstance(ids, list) else 0
    estado = "SE DESCARTA → " + ", ".join(fallas) if fallas else "pasa"
    print(f'- "{c.get("name")}"  productos={n}  hasta={c.get("discountPercent")}  → {estado}')
    if isinstance(ids, list) and ids and not all(isinstance(i, str) for i in ids):
        print(f"    ojo: productIds no son textos. Primero: {ids[0]!r}")
PY

echo
echo "== 4. ¿El catálogo devuelve esos productos? ==============="
IDS=$(printf '%s' "$B" | python3 -c '
import sys,json
cs=json.load(sys.stdin)
for c in cs:
    ids=c.get("productIds") or []
    if ids: print(",".join(str(i) for i in ids[:5])); break
' 2>/dev/null)
if [ -z "$IDS" ]; then
  echo "(ninguna campaña trae productos, así que no hay qué pedir)"
else
  echo "pidiendo ids=$IDS"
  R=$(get "/v1/stores/$SID/products?ids=$IDS")
  C=$(printf '%s' "$R" | codigo); B2=$(printf '%s' "$R" | cuerpo)
  echo "HTTP $C"
  printf '%s' "$B2" | python3 - <<'PY'
import sys, json
try: r = json.load(sys.stdin)
except Exception: print("No es JSON."); raise SystemExit
items = r if isinstance(r, list) else (r.get("items") or [])
print(f"devolvió {len(items)} producto(s)")
for p in items[:5]:
    print(f'  - {p.get("id")}  {p.get("name")}  precio={p.get("priceCents")}  lista={p.get("listPriceCents")}')
if not items:
    print("→ ACÁ ESTÁ: la campaña nombra productos que el catálogo no devuelve.")
    print("  O el filtro ?ids= no está soportado, o esos productos están agotados")
    print("  en una tienda con showsOutOfStock en false — y ahí la sección desaparece sola.")
PY
fi

echo
echo "== Listo. El primer paso que dé algo raro es la capa que falla. =="
