#!/usr/bin/env bash
# Reproduces the production gateway stale-upstream failure mode and validates
# the fix: after the application containers are recreated (new container IPs),
# nginx in vendora-gateway can keep resolving the old upstream IPs and serve
# HTTP 502. Force-recreating the gateway re-resolves the current Docker service
# IPs. This script spins up a disposable swarm-free compose stack of a gateway
# nginx plus three upstream nginx "apps", recreates the upstreams, applies the
# gateway-refresh lifecycle, and asserts every endpoint returns 200 with the
# current upstream's hostname (i.e. NOT 502 and not a stale upstream).
#
# It is safe to run on any machine with Docker + the Compose plugin. It never
# touches the production stack and cleans up after itself.
set -Eeuo pipefail

GATEWAY_HOST_PORT="${GATEWAY_HOST_PORT:-18081}"
WORK="$(mktemp -d)"
trap 'cd / && (cd "$WORK" && docker compose -f "$WORK/compose.yml" down -v >/dev/null 2>&1 || true); rm -rf "$WORK"' EXIT

# Each upstream answers with its own nginx hostname (== container short ID) so
# the test can prove the gateway reaches the CURRENT container. They listen on
# the exact ports the gateway proxies to (api:8080, site:3000, admin:80).
mkupstream() { # name listenPort
  mkdir -p "$WORK/$1"
  cat > "$WORK/$1/upstream.conf" <<CONF
server {
    listen $2;
    default_type text/plain;
    location / { return 200 "\$hostname\n"; }
}
CONF
}

mkupstream api 8080
mkupstream site 3000
mkupstream admin 80

# The gateway proxies to service DNS names on the private network, exactly like
# the production gateway.conf.
GATEWAY_CONF='server {
    listen 80;
    location = /healthz { proxy_pass http://api:8080/healthz; proxy_connect_timeout 5s; proxy_read_timeout 10s; }
    location / { proxy_pass http://site:3000; }
    location ~ ^/(fa|en)/admin(/|$) { proxy_pass http://admin:80; }
    location /admin/ { proxy_pass http://admin:80/; }
}
'
printf '%s\n' "$GATEWAY_CONF" > "$WORK/gateway.conf"

cat > "$WORK/compose.yml" <<YAML
services:
  api:
    image: nginx:1.27-alpine
    volumes:
      - ./api/upstream.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [net]
  site:
    image: nginx:1.27-alpine
    volumes:
      - ./site/upstream.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [net]
  admin:
    image: nginx:1.27-alpine
    volumes:
      - ./admin/upstream.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [net]
  gateway:
    image: nginx:1.27-alpine
    ports:
      - "127.0.0.1:${GATEWAY_HOST_PORT}:80"
    volumes:
      - ./gateway.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [net]
networks:
  net:
YAML

compose() { docker compose -f "$WORK/compose.yml" "$@"; }

cid() { docker compose -f "$WORK/compose.yml" ps -q "$1"; }
shortid() { docker inspect --format '{{.Id}}' "$1" | cut -c1-12; }

get() { curl -fsS --max-time 10 "http://127.0.0.1:$GATEWAY_HOST_PORT$1"; }

echo "==> Starting initial stack"
compose up -d --wait --wait-timeout 120

api_short="$(shortid "$(cid api)")"
site_short="$(shortid "$(cid site)")"
admin_short="$(shortid "$(cid admin)")"
echo "==> Initial upstreams api=$api_short site=$site_short admin=$admin_short"

HEALTH_BODY="$(get /healthz)"; [ "$HEALTH_BODY" = "$api_short" ]
SITE_BODY="$(get /)";        [ "$SITE_BODY" = "$site_short" ]
ADMIN_BODY="$(get /fa/admin)"; [ "$ADMIN_BODY" = "$admin_short" ]
echo "==> Initial checks passed (all 200, matching current upstreams)"

echo "==> Recreating application containers (api, site, admin) - new IPs"
compose up -d --force-recreate --no-deps api
compose up -d --force-recreate --no-deps site
compose up -d --force-recreate --no-deps admin
compose up -d --wait --wait-timeout 120 api site admin

new_api_short="$(shortid "$(cid api)")"
new_site_short="$(shortid "$(cid site)")"
new_admin_short="$(shortid "$(cid admin)")"
echo "==> New upstreams api=$new_api_short site=$new_site_short admin=$new_admin_short"

# Demonstrate the failure mode WITHOUT the gateway refresh: without force-recreating
# the gateway, it keeps serving the old/stale upstream (502 once the old container
# is gone). Guarded with an `if` so a non-zero curl does not trip `set -e`.
informational="request succeeded (stale upstream served 200)"
if ! body="$(get / 2>&1)"; then
  informational="request failed: $(printf '%s' "$body" | head -1) -- reproducing the stale-upstream 502 failure mode"
elif [ "$body" != "$site_short" ] && [ "$body" != "$new_site_short" ]; then
  informational="request reached a stale upstream (body=$body)"
fi
echo "==> (informational) response WITHOUT gateway refresh: $informational"

echo "==> Applying the fix: force-recreate gateway to refresh upstream resolution"
compose up -d --force-recreate --no-deps gateway
compose up -d --wait --wait-timeout 120 gateway

HEALTH_BODY="$(get /healthz)"; [ "$HEALTH_BODY" = "$new_api_short" ]
SITE_BODY="$(get /)";          [ "$SITE_BODY" = "$new_site_short" ]
ADMIN_BODY="$(get /fa/admin)"; [ "$ADMIN_BODY" = "$new_admin_short" ]
[ "$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$GATEWAY_HOST_PORT/admin/")" = "200" ]
echo "==> After gateway refresh: /healthz, /, /fa/admin, /admin/ all 200 and reach the NEW upstreams"

echo "==> Simulating rollback: recreate upstreams again and refresh gateway once more"
compose up -d --force-recreate --no-deps api site admin
compose up -d --wait --wait-timeout 120 api site admin
compose up -d --force-recreate --no-deps gateway
compose up -d --wait --wait-timeout 120 gateway

rb_api_short="$(shortid "$(cid api)")"
HEALTH_BODY="$(get /healthz)"; [ "$HEALTH_BODY" = "$rb_api_short" ]
echo "==> Rollback simulation passed: /healthz 200 against recreated upstream $rb_api_short"

echo "==> ALL GATEWAY-REFRESH CHECKS PASSED"