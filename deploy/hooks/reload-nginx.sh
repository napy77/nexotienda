#!/usr/bin/env bash
# Se copia a /etc/letsencrypt/renewal-hooks/deploy/ para que nginx tome el
# certificado nuevo. Sin esto, certbot renueva y nginx sigue sirviendo el viejo
# hasta el próximo reload — y el día que venza se caen todas las tiendas juntas.
set -e
nginx -t && systemctl reload nginx
