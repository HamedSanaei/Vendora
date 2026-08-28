#!/usr/bin/env bash
# Production deployment for Vendora.
#
# Usage: deploy-production.sh <immutable-image-sha>
#
# Flow: lock -> record current version -> pull exact images -> verify images ->
# backup database -> apply migrations -> start containers -> wait for health ->
# internal checks -> public checks via Cloudflare -> record new version.
#
# On any failure the application containers are rolled back to the previous
# known-good image SHA when one is available. Never prints secrets.
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

wait_for_gateway() {
  local timeout="${1:-180}" waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if curl -fsS -o /dev/null "http://127.0.0.1:8080/healthz"; then
      log "Gateway/API health OK (${waited}s)"
      return 0
    fi
    sleep 5
    waited=$((waited + 5))
  done
  log "Timed out waiting for the gateway health endpoint."
  return 1
}

rollback() {
  local code=$?
  # Prevent the ERR trap from firing again for commands inside this function.
  trap - ERR
  log "Deployment failed (step: ${BASH_COMMAND:-unknown})."
  if [ -n "${CURRENT_VERSION:-}" ] && [ "$CURRENT_VERSION" != "none" ] && [ "$CURRENT_VERSION" != "$VERSION" ]; then
    log "Rolling back application containers to previous version $CURRENT_VERSION"
    VENDORA_IMAGE_TAG="$CURRENT_VERSION" "${COMPOSE[@]}" up -d || true
    if wait_for_gateway 180; then
      log "Rollback healthy: $CURRENT_VERSION"
      echo "$CURRENT_VERSION" > "$CURRENT_FILE"
      echo "$VERSION" > "$PREVIOUS_FILE"
    else
      log "Rollback started but the gateway did not become healthy."
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

# --- 5. Start the application containers ----------------------------------------
log "Starting application containers"
"${COMPOSE[@]}" up -d

# --- 6. Wait for Docker health checks -------------------------------------------
for container in vendora-gateway vendora-api vendora-site vendora-admin; do
  wait_for_container_healthy "$container" 240
done

# --- 7. Internal (localhost gateway) checks -------------------------------------
log "Internal health checks"
curl -fsS -o /dev/null "http://127.0.0.1:8080/healthz"
curl -fsS -o /dev/null "http://127.0.0.1:8080/fa"
curl -fsS -o /dev/null "http://127.0.0.1:8080/fa/admin"
log "Internal checks passed"

# --- 8. Public checks through Cloudflare ----------------------------------------
log "Public health checks via https://$PUBLIC_HOST"
for url in \
  "https://$PUBLIC_HOST/healthz" \
  "https://$PUBLIC_HOST/" \
  "https://$PUBLIC_HOST/fa/admin"; do
  curl -fsS --retry 10 --retry-delay 5 --retry-connrefused -o /dev/null "$url"
  log "Public check passed: $url"
done

# --- 9. Record the deployed version ---------------------------------------------
echo "$CURRENT_VERSION" > "$PREVIOUS_FILE"
echo "$VERSION" > "$CURRENT_FILE"
log "Deployment successful. current=$VERSION previous=$CURRENT_VERSION"
