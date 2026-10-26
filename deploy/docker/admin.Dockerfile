# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install dependencies and build the admin panel.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time values inlined into the bundle by Vite. The admin SPA is served
# under the /admin/ sub-path in production so its assets do not collide with
# storefront assets on the same origin.
# The gateway exposes /api on every storefront hostname. Do not pin API calls
# to one domain: that breaks browser login from an additional storefront domain.
ARG VITE_API_BASE_URL=/
ARG VITE_STOREFRONT_URL=http://localhost:3000
ARG VITE_BASE_URL=/admin/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_STOREFRONT_URL=$VITE_STOREFRONT_URL \
    VITE_BASE_URL=$VITE_BASE_URL

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: nginx serving the generated static SPA.
# ---------------------------------------------------------------------------
FROM nginx:stable-alpine AS final

COPY <<"EOF" /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Liveness probe used by the container HEALTHCHECK.
    location = /healthz {
        access_log off;
        return 200 "ok\n";
    }

    # Hashed build assets must never fall back to HTML. A stale tab requesting
    # a removed chunk needs a real, non-cacheable 404 rather than cached HTML/200.
    location ^~ /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
        error_page 404 = @missing_asset;
    }

    location @missing_asset {
        add_header Cache-Control "no-store" always;
        return 404;
    }

    # Revalidate the module graph after every deployment, including direct SPA links.
    location = /index.html {
        add_header Cache-Control "no-store" always;
        try_files $uri =404;
    }

    # SPA fallback is only for application routes, never for generated chunks.
    location / {
        add_header Cache-Control "no-store" always;
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
EOF

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
