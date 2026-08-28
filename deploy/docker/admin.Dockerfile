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
ARG VITE_API_BASE_URL=http://localhost:5020
ARG VITE_STOREFRONT_URL=http://localhost:3000
ARG VITE_BASE_URL=/admin/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_STOREFRONT_URL=$VITE_STOREFRONT_URL \
    VITE_BASE_URL=$VITE_BASE_URL

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: nginx serving the generated static SPA.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS final

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

    # SPA fallback: every non-file path served by the React Router.
    location / {
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
