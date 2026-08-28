# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: install dependencies and build the Next.js storefront.
# ---------------------------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time values are inlined into the client bundle by Next.js.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:5020
ARG NEXT_PUBLIC_STRIPE_KEY=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage: Next.js standalone server (node_modules already traced).
# ---------------------------------------------------------------------------
FROM node:24-slim AS final
WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/fa').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
