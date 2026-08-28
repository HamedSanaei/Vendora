#!/usr/bin/env bash
# Consistent SQLite backup with rotation.
#
# Usage: backup-database.sh [deploy-dir]
#
# The SQLite CLI takes a consistent online backup even while the API container
# is running (WAL mode), so this can safely run before every deployment.
set -Eeuo pipefail

DEPLOY_DIR="${1:-/opt/vendora}"
DB_PATH="${VENDORA_DB_PATH:-$DEPLOY_DIR/data/vendora.db}"
BACKUP_DIR="$DEPLOY_DIR/backups"
KEEP="${VENDORA_KEEP_BACKUPS:-10}"

log() { echo "[backup][$(date -u +%H:%M:%SZ)] $*"; }

if [ ! -f "$DB_PATH" ]; then
  log "No database at $DB_PATH; skipping backup."
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  log "sqlite3 CLI is required (apt-get install sqlite3)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/vendora-$TIMESTAMP.db"

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
log "Created backup: $BACKUP_FILE"

# Rotate: keep the newest $KEEP backups.
mapfile -t OLD_BACKUPS < <(ls -1t "$BACKUP_DIR"/vendora-*.db 2>/dev/null | tail -n "+$((KEEP + 1))")
for old in "${OLD_BACKUPS[@]}"; do
  rm -f "$old"
  log "Removed old backup: $old"
done

log "Backup complete ($KEEP most recent kept)."
