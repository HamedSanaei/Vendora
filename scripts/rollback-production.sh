#!/usr/bin/env bash
# Rolls the application containers back to the previous known-good image SHA.
#
# Usage: rollback-production.sh
#
# Database migrations are NOT rolled back: SQLite schema rollback is
# destructive, so the previous image must remain compatible with the current
# schema (EF Core tolerates extra tables/columns from newer migrations).
set -Eeuo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/vendora}"
ENV_FILE="$DEPLOY_DIR/deploy/env/production.env"
COMPOSE_FILE="$DEPLOY_DIR/deploy/docker-compose.production.yml"
STATE_DIR="$DEPLOY_DIR/state"
CURRENT_FILE="$STATE_DIR/current-version"
PREVIOUS_FILE="$STATE_DIR/previous-version"
LOCK_FILE="$DEPLOY_DIR/.deploy.lock"

mkdir -p "$STATE_DIR"

log() { echo "[rollback][$(date -u +%H:%M:%SZ)] $*"; }

[ -f "$ENV_FILE" ] || { echo "[rollback] Missing $ENV_FILE." >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "[rollback] Missing $COMPOSE_FILE." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "[rollback] docker is required." >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "[rollback] curl is required." >&2; exit 1; }

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "[rollback] Another deployment is running; aborting." >&2; exit 1; }

cd "$DEPLOY_DIR"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

VENDORA_IMAGE_REGISTRY="${VENDORA_IMAGE_REGISTRY:?VENDORA_IMAGE_REGISTRY must be set in $ENV_FILE}"
PUBLIC_HOST="${VENDORA_PUBLIC_HOST:-vendora.tofanservice.ir}"

COMPOSE=(docker compose -f "$COMPOSE_FILE")
CURRENT_VERSION="$(cat "$CURRENT_FILE" 2>/dev/null || echo none)"
PREVIOUS_VERSION="$(cat "$PREVIOUS_FILE" 2>/dev/null || echo none)"

if [ "$PREVIOUS_VERSION" = "none" ] || [ -z "$PREVIOUS_VERSION" ]; then
  log "No previous version recorded; nothing to roll back to."
  exit 1
fi

if [ "$PREVIOUS_VERSION" = "$CURRENT_VERSION" ]; then
  log "Previous version equals current version; nothing to do."
  exit 1
fi

log "Current: $CURRENT_VERSION"
log "Rolling back to previous: $PREVIOUS_VERSION"
export VENDORA_IMAGE_TAG="$PREVIOUS_VERSION"

for service in vendora-api vendora-site vendora-admin; do
  image="$VENDORA_IMAGE_REGISTRY/$service:$PREVIOUS_VERSION"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    log "Previous image not present locally, pulling: $image"
    docker pull "$image"
  fi
done

"${COMPOSE[@]}" up -d

log "Waiting for health..."
waited=0
while [ "$waited" -lt 180 ]; do
  if curl -fsS -o /dev/null "http://127.0.0.1:8080/healthz"; then
    log "Gateway healthy after rollback (${waited}s)"
    break
  fi
  sleep 5
  waited=$((waited + 5))
done

if [ "$waited" -ge 180 ]; then
  log "Rollback did not become healthy within 180s." >&2
  exit 1
fi

for url in "https://$PUBLIC_HOST/" "https://$PUBLIC_HOST/fa/admin"; do
  curl -fsS --retry 5 --retry-delay 5 --retry-connrefused -o /dev/null "$url"
  log "Public check passed: $url"
done

echo "$CURRENT_VERSION" > "$PREVIOUS_FILE"
echo "$PREVIOUS_VERSION" > "$CURRENT_FILE"
log "Rollback complete. current=$PREVIOUS_VERSION previous=$CURRENT_VERSION"
