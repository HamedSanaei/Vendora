#!/usr/bin/env bash
set -Eeuo pipefail
domain='vendorashop.ir'
webroot='/var/www/letsencrypt/.well-known/acme-challenge'
if [[ -s "/etc/letsencrypt/live/$domain/fullchain.pem" ]]; then
    echo 'Certificate already exists. certbot.timer manages renewal.'
    exit 0
fi
if [[ -z "$(dig +time=3 +tries=1 @m.ns.arvancdn.ir "$domain" A +short)" ]]; then
    echo 'Pending DNS: authoritative Arvan A record is absent.'
    exit 0
fi
probe="vendora-acme-$(openssl rand -hex 8)"
trap 'rm -f "$webroot/$probe"' EXIT
printf '%s\n' "$probe" > "$webroot/$probe"
result="$(curl --noproxy '*' -fsS --max-redirs 0 --connect-timeout 5 --max-time 15 "http://$domain/.well-known/acme-challenge/$probe" || true)"
if [[ "$result" != "$probe" ]]; then
    echo 'Waiting: public HTTP-01 challenge path is not reachable yet. No ACME request made.'
    exit 0
fi
echo 'Public HTTP-01 preflight succeeded; requesting certificate.'
rm -f "$webroot/$probe"
trap - EXIT
exec bash /opt/vendora/scripts/configure-vendorashop-certbot.sh issue
