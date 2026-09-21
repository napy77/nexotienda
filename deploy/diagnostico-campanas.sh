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

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# Los análisis van a archivo y leen el JSON por argumento.
# No por stdin: un `python3 -` con heredoc ya usa stdin para su propio código, así
# que la tubería se pierde y todo parece "no es JSON". Ese fue el bug de la v1.
cat > "$T/campanas.py" <<'PY'
import sys, json, datetime
cs = json.load(open(sys.argv[1], encoding='utf-8'))
if not isinstance(cs, list):
    print(f"No es un arreglo, es {type(cs).__name__}. La tienda espera una lista."); raise SystemExit
if not cs:
    print("Vacío: NexoPOS dice que este comercio no tiene campañas vigentes."); raise SystemExit
ahora = datetime.datetime.now(datetime.timezone.utc)
vivas = []
for c in cs:
    fallas = []
    if not c.get("id"):   fallas.append("sin id")
    if not c.get("name"): fallas.append("sin name")
    ids = c.get("productIds")
    if not isinstance(ids, list):
        fallas.append(f"productIds no es lista (es {type(ids).__name__})")
    elif ids and not all(isinstance(i, str) for i in ids):
        fallas.append(f"productIds no son textos; el primero es {ids[0]!r}")
    fin = c.get("endsAt")
    if fin:
        try:
            if datetime.datetime.fromisoformat(fin.replace("Z", "+00:00")) < ahora:
                fallas.append(f"endsAt ya pasó ({fin})")
        except Exception:
            fallas.append(f"endsAt no se entiende ({fin})")
    n = len(ids) if isinstance(ids, list) else 0
    if fallas:
        print(f'- "{c.get("name")}"  productos={n}  → SE DESCARTA: {", ".join(fallas)}')
    else:
        print(f'- "{c.get("name")}"  productos={n}  hasta={c.get("discountPercent")}%  → pasa')
        vivas.append(c)
print()
print(f"{len(vivas)} de {len(cs)} campañas llegan a la tienda.")
todos = [i for c in vivas for i in (c.get("productIds") or [])]
open(sys.argv[2], "w").write(",".join(dict.fromkeys(todos)))
PY

cat > "$T/productos.py" <<'PY'
import sys, json
r = json.load(open(sys.argv[1], encoding='utf-8'))
items = r if isinstance(r, list) else (r.get("items") or [])
pedidos = [x for x in sys.argv[2].split(",") if x]
print(f"pedimos {len(pedidos)}, devolvió {len(items)}")
vistos = {str(p.get("id")) for p in items}
for p in items[:8]:
    print(f'  - {p.get("id"):>8}  {str(p.get("name"))[:46]:46}  precio={p.get("priceCents")}  lista={p.get("listPriceCents")}')
faltan = [i for i in pedidos if i not in vistos]
print()
if len(items) > len(pedidos) * 2 and len(items) > 20:
    print("→ Devolvió MUCHO más de lo pedido: parece que ignora ?ids= y manda el catálogo.")
    print("  No rompe la tienda (cruzamos por id), pero es una consulta cara por visita.")
if faltan:
    print(f"→ FALTAN: {', '.join(faltan)}")
    print("  Si falta alguno, esa tarjeta no aparece. Si faltan todos, la sección entera.")
    open(sys.argv[3], "w").write(",".join(faltan))
elif items:
    print("→ El catálogo trae todo lo que las campañas nombran. La sección tiene que verse.")
PY

cat > "$T/uno.py" <<'PY'
import sys, json
p = json.load(open(sys.argv[1], encoding='utf-8'))
a = p.get("availability") or {}
pol = a.get("policy")
if pol == "stock":
    hay = a.get("onHand") or 0
    causa = f"AGOTADO (stock {hay})" if hay <= 0 else f"hay {hay} — no debería faltar"
elif pol == "declared":
    q = a.get("quota")
    if a.get("state") != "available":
        causa = "AGOTADO (se acabó por hoy)"
    elif q and (q.get("remaining") or 0) <= 0:
        causa = "AGOTADO (se acabó el cupo del día)"
    else:
        causa = "disponible — no debería faltar"
elif pol == "unknown":
    causa = "sin dato — no debería faltar: unknown nunca se esconde"
else:
    causa = f"availability rara: {a!r}"
if p.get("publishedInStore") is False:
    causa = "NO PUBLICADO en la tienda"
print(f'{str(p.get("name"))[:40]:40} → {causa}')
PY

get() { curl -s -o "$2" -w "%{http_code}" -H "Authorization: Bearer $KEY" "$API$1"; }

echo "== 1. La tienda =========================================="
C=$(get "/v1/stores/$SLUG" "$T/store.json")
echo "HTTP $C"
[ "$C" != "200" ] && { head -c 400 "$T/store.json"; echo; exit 1; }
SID=$(python3 -c 'import sys,json;print(json.load(open(sys.argv[1])).get("id",""))' "$T/store.json")
echo "storeId: ${SID:-(no vino)}"
[ -z "$SID" ] && exit 1
python3 -c '
import sys, json
s = json.load(open(sys.argv[1]))
print("publicada:", s.get("storefrontPublished"), " | muestra agotados:", s.get("showsOutOfStock", "(no viene → se asume sí)"))
' "$T/store.json"

echo
echo "== 2. Las campañas, tal como llegan ======================="
C=$(get "/v1/stores/$SID/campaigns" "$T/camp.json")
echo "HTTP $C"
python3 -m json.tool "$T/camp.json" 2>/dev/null || { head -c 600 "$T/camp.json"; echo; }

echo
echo "== 3. ¿Sobreviven el filtro de la tienda? ================="
python3 "$T/campanas.py" "$T/camp.json" "$T/ids.txt" || exit 1

IDS=$(cat "$T/ids.txt" 2>/dev/null)
echo
echo "== 4. ¿El catálogo devuelve esos productos? ==============="
if [ -z "$IDS" ]; then
  echo "(ninguna campaña viva trae productos)"
else
  echo "pidiendo ids=$IDS"
  C=$(get "/v1/stores/$SID/products?ids=$IDS" "$T/prods.json")
  echo "HTTP $C"
  python3 "$T/productos.py" "$T/prods.json" "$IDS" "$T/faltan.txt"

  FALTAN=$(cat "$T/faltan.txt" 2>/dev/null)
  if [ -n "$FALTAN" ]; then
    echo
    echo "== 5. ¿Por qué falta cada uno? ============================"
    # El enlace directo devuelve el producto aunque esté escondido de la lista, así
    # que acá se puede distinguir "agotado" de "sin publicar" — dos arreglos
    # distintos que desde la lista se ven idénticos.
    for ID in ${FALTAN//,/ }; do
      C=$(get "/v1/stores/$SID/products/$ID" "$T/p.json")
      printf '  %-8s HTTP %s  ' "$ID" "$C"
      if [ "$C" = "200" ]; then
        python3 "$T/uno.py" "$T/p.json"
      else
        echo "→ no existe, o no es de esta tienda"
      fi
    done
  fi
fi

echo
echo "== Listo. El primer paso que dé algo raro es la capa que falla. =="
