#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="vendorashop.ir"
ROOT="/var/www/letsencrypt"
HTTP_SITE="/etc/nginx/sites-available/vendorashop.ir.conf"
SSL_TEMPLATE="/etc/nginx/sites-available/vendorashop-ssl.conf.pending"
SSL_SITE="/etc/nginx/sites-available/vendorashop-ssl.conf"
MODE="${1:-prepare}"

if [[ "$MODE" == "prepare" ]]; then
    echo "[1/6] Install Certbot using Ubuntu packages"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq --no-install-recommends certbot

    echo "[2/6] Prepare dedicated HTTP-01 webroot"
    install -d -m 755 "$ROOT/.well-known/acme-challenge"
    if [[ -e "$HTTP_SITE" ]] && ! grep -q 'Managed by configure-vendorashop-certbot.sh' "$HTTP_SITE"; then
        echo "ERROR: $HTTP_SITE exists and is not managed by this script." >&2
        exit 1
    fi
    cat > "$HTTP_SITE" <<'NGINXHTTP'
# Managed by configure-vendorashop-certbot.sh
server {
    listen 80;
    listen [::]:80;
    server_name vendorashop.ir;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
        access_log off;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
NGINXHTTP

    echo "[3/6] Prepare HTTPS vhost on existing nginx 9443 listener"
    cat > "$SSL_TEMPLATE" <<'NGINXSSL'
# Managed by configure-vendorashop-certbot.sh
# Nginx on this shared server uses 9443 (another service owns 443).
server {
    listen 9443 ssl;
    listen [::]:9443 ssl;
    server_name vendorashop.ir;

    ssl_certificate /etc/letsencrypt/live/vendorashop.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vendorashop.ir/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100m;
    # Also serve renewal challenges if the CDN redirects HTTP to HTTPS.
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
        access_log off;
    }
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
NGINXSSL

    echo "[4/6] Install deploy hook and systemd renewal timer"
    install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
    cat > /etc/letsencrypt/renewal-hooks/deploy/50-reload-nginx-vendorashop.sh <<'HOOK'
#!/usr/bin/env bash
set -e
nginx -t
systemctl reload nginx
HOOK
    chmod 755 /etc/letsencrypt/renewal-hooks/deploy/50-reload-nginx-vendorashop.sh
    systemctl enable --now certbot.timer

    echo "[5/6] Enable HTTP ACME site with config validation"
    ln -sfn "$HTTP_SITE" /etc/nginx/sites-enabled/vendorashop.ir.conf
    if ! nginx -t; then
        rm -f /etc/nginx/sites-enabled/vendorashop.ir.conf
        echo "ERROR: nginx config invalid; HTTP vhost disabled." >&2
        exit 1
    fi
    systemctl reload nginx
    printf 'vendora-acme-ok\n' > "$ROOT/.well-known/acme-challenge/vendorashop-selfcheck"
    got=""
    for retry in 1 2 3 4 5; do
        got="$(curl --noproxy '*' -fsS --max-time 5 --header 'Host: vendorashop.ir' http://127.0.0.1/.well-known/acme-challenge/vendorashop-selfcheck || true)"
        [[ "$got" == "vendora-acme-ok" ]] && break
        sleep 1
    done
    rm -f "$ROOT/.well-known/acme-challenge/vendorashop-selfcheck"
    if [[ "$got" != "vendora-acme-ok" ]]; then
        echo "ERROR: local ACME webroot selfcheck failed; check nginx routing." >&2
        exit 1
    fi

    echo "[6/6] Prepared; awaiting public DNS A record and HTTP-01 availability."
    certbot --version
    systemctl is-active certbot.timer
    echo "Once public DNS works: bash $0 issue"
elif [[ "$MODE" == "issue" ]]; then
    echo "[1/4] Check authoritative DNS"
    auth_a="$(dig +time=3 +tries=1 @m.ns.arvancdn.ir "$DOMAIN" A +short)"
    if [[ -z "$auth_a" ]]; then
        echo "BLOCKED: Arvan authoritative DNS currently has no A record for $DOMAIN" >&2
        exit 2
    fi
    printf 'Authoritative A record(s): %s\n' "$auth_a"

    echo "[2/4] Obtain 90-day Let's Encrypt certificate (HTTP-01 webroot)"
    certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
        --webroot -w "$ROOT" --cert-name "$DOMAIN" -d "$DOMAIN" --keep-until-expiring

    echo "[3/4] Enable HTTPS on shared Nginx listener 9443"
    install -m 644 "$SSL_TEMPLATE" "$SSL_SITE"
    ln -sfn "$SSL_SITE" /etc/nginx/sites-enabled/vendorashop-ssl.conf
    if ! nginx -t; then
        rm -f /etc/nginx/sites-enabled/vendorashop-ssl.conf
        echo "ERROR: nginx TLS vhost invalid and was disabled." >&2
        exit 1
    fi
    systemctl reload nginx

    echo "[4/4] Cert details, renewal timer, and local HTTPS probe"
    certbot certificates
    systemctl list-timers --all certbot.timer --no-pager
    curl -fsSk --resolve vendorashop.ir:9443:127.0.0.1 https://vendorashop.ir:9443/healthz
    echo
    echo "Nginx is serving vendorashop.ir on origin port 9443. Arvan CDN must reach that origin port for normal client HTTPS/443."
else
    echo "Usage: $0 prepare|issue" >&2
    exit 64
fi
