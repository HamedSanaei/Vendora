#!/usr/bin/env bash
# Production deployment for Vendora.
#
# Usage: deploy-production.sh <immutable-image-sha>
#
# Flow: lock -> record current version -> pull exact images -> verify images ->
# backup database -> apply migrations -> apply production catalog seed ->
# start/recreate application containers -> wait healthy -> force-recreate the
# gateway so it re-resolves upstream Docker IPs -> wait gateway healthy ->
# internal checks -> public checks via Cloudflare -> record new version.
#
# On any failure the application containers are rolled back to the previous
# known-good image SHA when one is available (also re-resolving the gateway).
# Never prints secrets.
set -Eeuo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "usage: deploy-production.sh <image-sha>" >&2
  exit 2
fi

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vendora}"
ENV_FILE="$DEPLOY_DIR/deploy/env/production.env"
COMPOSE_FILE="$DEPLOY_DIR/deploy/docker-compose.production.yml"
STATE_DIR="$DEPLOY_DIR/state"
CURRENT_FILE="$STATE_DIR/current-version"
PREVIOUS_FILE="$STATE_DIR/previous-version"
LOCK_FILE="$DEPLOY_DIR/.deploy.lock"
LOG_DIR="$DEPLOY_DIR/logs"

mkdir -p "$STATE_DIR" "$LOG_DIR"

log() { echo "[deploy][$(date -u +%H:%M:%SZ)] $*"; }

# --- Preflight -----------------------------------------------------------------
[ -f "$ENV_FILE" ] || { echo "[deploy] Missing $ENV_FILE (copy deploy/env/production.env.example and fill it in)." >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "[deploy] Missing $COMPOSE_FILE." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "[deploy] docker is required." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "[deploy] curl is required." >&2; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "[deploy] sqlite3 CLI is required for database backups." >&2; exit 1; }

# Serialize deployments with a lock file.
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "[deploy] Another deployment is already running; aborting." >&2; exit 1; }

cd "$DEPLOY_DIR"

# Load runtime configuration (registry, public host, API secrets) into the
# environment so docker compose can interpolate ${VENDORA_IMAGE_*}.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

VENDORA_IMAGE_REGISTRY="${VENDORA_IMAGE_REGISTRY:?VENDORA_IMAGE_REGISTRY must be set in $ENV_FILE}"
PUBLIC_HOST="${VENDORA_PUBLIC_HOST:-vendora.tofanservice.ir}"
export VENDORA_IMAGE_TAG="$VERSION"

COMPOSE=(docker compose -f "$COMPOSE_FILE")

CURRENT_VERSION="$(cat "$CURRENT_FILE" 2>/dev/null || echo none)"
log "Current version: $CURRENT_VERSION"
log "Deploying version: $VERSION"
log "Registry: $VENDORA_IMAGE_REGISTRY"

# --- Helpers -------------------------------------------------------------------
wait_for_container_healthy() {
  local container="$1" timeout="${2:-240}" waited=0 status
  while [ "$waited" -lt "$timeout" ]; do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo missing)"
    if [ "$status" = "healthy" ]; then
      log "Container $container healthy (${waited}s)"
      return 0
    fi
    if [ "$status" = "unhealthy" ]; then
      log "Container $container reported unhealthy."
      return 1
    fi
    sleep 5
    waited=$((waited + 5))
  done
  log "Timed out after ${timeout}s waiting for $container to become healthy."
  return 1
}

# Dump only useful non-secret diagnostics so a failure is debuggable without
# leaking environment secrets, connection strings, or stack traces.
dump_internal_diagnostics() {
  log "Dumping non-secret deployment diagnostics"
  echo "--- docker compose ps ---"
  "${COMPOSE[@]}" ps || true
  echo "--- gateway network/IP ---"
  docker inspect --format '{{.Name}} {{range $k,$v := .NetworkSettings.Networks}}{{ $k }}={{.IPAddress}}{{end}}' vendora-gateway 2>/dev/null || true
  echo "--- api network/IP ---"
  docker inspect --format '{{.Name}} {{range $k,$v := .NetworkSettings.Networks}}{{ $k }}={{.IPAddress}}{{end}}' vendora-api 2>/dev/null || true
  echo "--- gateway logs (tail) ---"
  docker logs --tail 100 vendora-gateway 2>&1 || true
}

# Bring the application containers (api/site/admin) up/wait healthy, then
# force-recreate the gateway so it re-resolves their current Docker IPs, then
# run the localhost gateway health checks. Shared by deploy and rollback.
refresh_app_through_gateway() {
  local tag="$1" step="$2"
  log "[$step] Starting application containers"
  VENDORA_IMAGE_TAG="$tag" "${COMPOSE[@]}" up -d --no-deps vendora-api
  VENDORA_IMAGE_TAG="$tag" "${COMPOSE[@]}" up -d --no-deps vendora-site
  VENDORA_IMAGE_TAG="$tag" "${COMPOSE[@]}" up -d --no-deps vendora-admin
  log "[$step] Waiting for API"
  wait_for_container_healthy vendora-api 240
  log "[$step] Waiting for storefront"
  wait_for_container_healthy vendora-site 240
  log "[$step] Waiting for admin"
  wait_for_container_healthy vendora-admin 240
  log "[$step] Recreating gateway to refresh Docker upstream resolution"
  VENDORA_IMAGE_TAG="$tag" "${COMPOSE[@]}" up -d --force-recreate --no-deps vendora-gateway
  log "[$step] Waiting for gateway"
  wait_for_container_healthy vendora-gateway 240
}

# Run the localhost gateway checks. On any failure dump non-secret diagnostics
# and return non-zero. This must only be called AFTER the gateway has been
# force-recreated against the current app containers.
#
# run_internal_checks is intended to fail the deployment when an endpoint does
# not respond (curl returns non-zero, e.g. on HTTP 502), which under `set -e`
# triggers the ERR trap (rollback). It must not be wrapped in an `if !` guard
# in the main flow or the failure would be swallowed.
run_internal_checks() {
  local failed=0
  log "Internal /healthz check"
  if ! curl -fsS -o /dev/null "http://127.0.0.1:8080/healthz"; then failed=1; fi
  log "Internal /fa check"
  if ! curl -fsS -o /dev/null "http://127.0.0.1:8080/fa"; then failed=1; fi
  log "Internal /fa/admin check"
  if ! curl -fsS -o /dev/null "http://127.0.0.1:8080/fa/admin"; then failed=1; fi
  if [ "$failed" = "1" ]; then
    dump_internal_diagnostics
    log "Internal checks failed"
    return 1
  fi
  log "Internal checks passed"
}

rollback() {
  local code=$?
  # Prevent the ERR trap from firing again for commands inside this function.
  trap - ERR
  log "Deployment failed (step: ${BASH_COMMAND:-unknown})."
  if [ -n "${CURRENT_VERSION:-}" ] && [ "$CURRENT_VERSION" != "none" ] && [ "$CURRENT_VERSION" != "$VERSION" ]; then
    log "Rolling back application containers to previous version $CURRENT_VERSION"
    if refresh_app_through_gateway "$CURRENT_VERSION" rollback; then
      if run_internal_checks; then
        log "Rollback healthy: $CURRENT_VERSION"
        echo "$CURRENT_VERSION" > "$CURRENT_FILE"
        echo "$VERSION" > "$PREVIOUS_FILE"
      else
        log "Rollback containers were recreated but internal checks failed."
      fi
    else
      dump_internal_diagnostics
      log "Rollback of the application containers did not become healthy."
    fi
  else
    log "No previous known-good version to roll back to (current=$CURRENT_VERSION)."
  fi
  exit "$code"
}
trap rollback ERR

# --- 1. Pull the exact immutable images ----------------------------------------
log "Pulling images for $VERSION"
"${COMPOSE[@]}" pull

# --- 2. Verify images are present locally --------------------------------------
for service in vendora-api vendora-site vendora-admin; do
  image="$VENDORA_IMAGE_REGISTRY/$service:$VERSION"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    log "Image not available: $image" >&2
    exit 1
  fi
  log "Verified image: $image"
done

# --- 3. Backup the database -----------------------------------------------------
log "Backing up the database"
bash "$DEPLOY_DIR/scripts/backup-database.sh" "$DEPLOY_DIR"

# --- 4. Apply migrations in a controlled one-shot step --------------------------
# The API image runs in migration mode: it prints pending migrations, applies
# them, and exits non-zero on failure. The web server never starts here.
log "Applying database migrations"
"${COMPOSE[@]}" --profile migrate run -T --rm --no-deps vendora-api-migrate
log "Migrations applied"

# --- 4b. Apply the production-safe catalog seed --------------------------------
# Runs AFTER migrations and BEFORE the web containers start. The seed is
# idempotent by slug, only creates the storefront catalog (categories, brands,
# colors, products, images, relationships), never creates development identity
# or demo data, prints database-derived counts, and fails if no active products
# exist. Safe to run repeatedly.
log "Applying production catalog seed"
"${COMPOSE[@]}" --profile seed run -T --rm --no-deps vendora-api-seed
log "Catalog seed applied"

# --- 5. Start application containers, THEN recreate the gateway -----------------
# The gateway nginx resolves the Docker service names (vendora-api, vendora-site,
# vendora-admin) when its container/config starts and can retain stale upstream
# container IPs after api/site/admin are recreated. To guarantee it never proxies
# to stale addresses: start the app containers, wait until each is healthy, then
# force-recreate the gateway so it re-resolves the current upstream IPs.
log "Starting application containers"
"${COMPOSE[@]}" up -d --no-deps vendora-api
"${COMPOSE[@]}" up -d --no-deps vendora-site
"${COMPOSE[@]}" up -d --no-deps vendora-admin
log "Starting application containers complete"

log "Waiting for API"
wait_for_container_healthy vendora-api 240
log "Waiting for storefront"
wait_for_container_healthy vendora-site 240
log "Waiting for admin"
wait_for_container_healthy vendora-admin 240

log "Recreating gateway to refresh Docker upstream resolution"
"${COMPOSE[@]}" up -d --force-recreate --no-deps vendora-gateway
log "Waiting for gateway"
wait_for_container_healthy vendora-gateway 240

# --- 6. Internal (localhost gateway) checks -------------------------------------
run_internal_checks

# --- 7. Public checks through Cloudflare ----------------------------------------
log "Public health checks via https://$PUBLIC_HOST"
for url in \
  "https://$PUBLIC_HOST/healthz" \
  "https://$PUBLIC_HOST/" \
  "https://$PUBLIC_HOST/fa/admin"; do
  curl -fsS --retry 10 --retry-delay 5 --retry-connrefused -o /dev/null "$url"
  log "Public check passed: $url"
done

# --- 8. Record the deployed version ---------------------------------------------
echo "$CURRENT_VERSION" > "$PREVIOUS_FILE"
echo "$VERSION" > "$CURRENT_FILE"
log "Deployment successful. current=$VERSION previous=$CURRENT_VERSION"
