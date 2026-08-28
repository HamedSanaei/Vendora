#!/usr/bin/env bash
# Bootstrap a clean Debian/Ubuntu server for Vendora production.
#
# Run as root (or with sudo). Idempotent: safe to re-run.
#   sudo bash scripts/bootstrap-server.sh [path-to-ssh-public-key]
#
# GitHub Actions deploys directly as root using a dedicated SSH key, so no
# separate deployment Linux user is created. The API container still runs as
# the non-root 'app' user (uid 1654); the container runtime user and the SSH
# deployment user are separate concerns.
#
# SSH SAFETY: this script NEVER disables password auth or restarts sshd unless
# a key-based root login is guaranteed to exist. See the SSH hardening section.
#
# NGINX SAFETY: if the Cloudflare origin certificate/key are not present yet,
# nginx and Docker are still installed and /opt/vendora is prepared, but the
# TLS site is NOT enabled/reloaded. It is activated on a later run once the
# certificate files exist.
set -Eeuo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

log() { echo "[bootstrap][$(date -u +%H:%M:%SZ)] $*"; }

export DEBIAN_FRONTEND=noninteractive

# --- Base packages ---------------------------------------------------------------
log "Installing base packages"
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release sqlite3 rsync openssh-server nginx

# --- Docker Engine from the official apt repository -------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine"
  DISTRO="$(. /etc/os-release && echo "$ID")"               # ubuntu | debian
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$DISTRO/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$DISTRO $CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed: $(docker --version)"
else
  log "Docker already installed: $(docker --version)"
fi

# --- SSH hardening for key-based root deployment -----------------------------------
# Deployments connect directly as root with a dedicated key.
#
# LOCKOUT PROTECTION — order matters:
#   1. Make sure a valid root public key exists BEFORE touching sshd config.
#   2. If a key file path is given, install it; otherwise only proceed if one
#      is already in /root/.ssh/authorized_keys.
#   3. Abort BEFORE changing anything if no valid key exists.
#   4. Only with a confirmed key, validate sshd with `sshd -t` and revert the
#      drop-in if validation fails.
#   5. Restart the actual ssh service (handles Ubuntu's `ssh` vs `sshd`).
log "Configuring sshd for key-based root deployment"
install -d -m 700 -o root -g root /root/.ssh

install_deploy_key() {
  local pub="$1"
  [ -f "$pub" ] || { echo "[bootstrap] Public key file not found: $pub" >&2; return 1; }
  # Validate it looks like an SSH public key.
  grep -Eq '^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-nistp)' "$pub" || { echo "[bootstrap] Not a valid SSH public key: $pub" >&2; return 1; }
  touch /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  grep -qxF "$(tr -d '\r\n' < "$pub")" /root/.ssh/authorized_keys \
    || { tr -d '\r\n' < "$pub"; echo; } >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
  log "Deploy public key installed from $1"
}

if [ -n "${1:-}" ]; then
  if install_deploy_key "$1"; then
    log "Deploy key installed; key-based root login is available."
  else
    echo "[bootstrap] ABORTING sshd hardening: the supplied key could not be installed." >&2
    echo "[bootstrap] Fix the key path and re-run, or re-run without a key to use any" >&2
    echo "[bootstrap] key already present in /root/.ssh/authorized_keys." >&2
    exit 1
  fi
elif [ -s /root/.ssh/authorized_keys ]; then
  log "Found existing keys in /root/.ssh/authorized_keys; using them for key-based root login."
else
  echo "[bootstrap] REFUSING to harden SSH: /root/.ssh/authorized_keys is empty and no" >&2
  echo "[bootstrap] public key was supplied as an argument." >&2
  echo "[bootstrap] SSH password authentication and the ssh service were NOT modified." >&2
  echo "[bootstrap] To proceed safely, install a key first, e.g.:" >&2
  echo "[bootstrap]   scp -r deploy scripts root@<server>:/opt/vendora/" >&2
  echo "[bootstrap]   cat ~/.ssh/id_ed25519.pub | ssh root@<server> 'mkdir -p /root/.ssh && chmod 700 /root/.ssh && cat >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys'" >&2
  echo "[bootstrap]   ssh root@<server> 'bash /opt/vendora/scripts/bootstrap-server.sh'" >&2
  echo "[bootstrap] Aborting before any sshd change." >&2
  exit 1
fi

# Only now write the hardening drop-in (a valid root key is confirmed present).
install -m 644 /dev/null /etc/ssh/sshd_config.d/99-vendora-deploy.conf
cat > /etc/ssh/sshd_config.d/99-vendora-deploy.conf <<'SSHD'
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PasswordAuthentication no
SSHD
chmod 600 /etc/ssh/sshd_config.d/99-vendora-deploy.conf

if command -v sshd >/dev/null 2>&1; then
  if ! sshd -t; then
    echo "[bootstrap] sshd -t FAILED. Reverting the hardening drop-in; sshd NOT restarted." >&2
    rm -f /etc/ssh/sshd_config.d/99-vendora-deploy.conf
    exit 1
  fi
  log "sshd -t passed."
fi

# Restart the actual ssh service without relying on a single hardcoded name.
RESTARTED=0
for svc in ssh sshd; do
  if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^$svc.service"; then
    if systemctl is-enabled "$svc" >/dev/null 2>&1; then
      systemctl restart "$svc"
      log "Restarted ssh service: $svc"
      RESTARTED=1
      break
    fi
  fi
done
if [ "$RESTARTED" -eq 0 ]; then
  # Fallback: try to restart whatever ssh service is present.
  systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
  log "Attempted to restart the ssh service (no enabled unit detected by name)."
fi
log "sshd hardened with PermitRootLogin prohibit-password (key login REQUIRED)."

# --- Application directories ---------------------------------------------------------
log "Creating /opt/vendora directories"
mkdir -p /opt/vendora/deploy /opt/vendora/scripts /opt/vendora/data /opt/vendora/uploads /opt/vendora/backups /opt/vendora/logs /opt/vendora/state
chown -R root:root /opt/vendora
chmod 750 /opt/vendora

# The API container runs as the non-root 'app' user (uid 1654 in the .NET
# aspnet images). The bind-mounted data and uploads directories must be
# writable by that uid inside the container while remaining traversable and
# readable by the deploy user (root) for backups. Directories are owned by
# uid 1654 with 755 permissions; files created inside (e.g. vendora.db) are
# 644 so root can read them with sqlite3.
chown 1654:1654 /opt/vendora/data /opt/vendora/uploads
chmod 755 /opt/vendora/data /opt/vendora/uploads

# --- Cloudflare origin TLS directory ------------------------------------------------
install -d -m 700 -o root -g root /etc/ssl/cloudflare
CERT_FILE=/etc/ssl/cloudflare/vendora.crt
KEY_FILE=/etc/ssl/cloudflare/vendora.key

# --- Nginx site configuration ---------------------------------------------------------
# The TLS site is only enabled once the Cloudflare origin certificate and key
# exist. Until then nginx (and everything else) is installed but no invalid
# configuration is ever reloaded, so the bootstrap can be re-run safely.
TLS_SITE=/etc/nginx/sites-available/vendora.conf
SITE_LINK=/etc/nginx/sites-enabled/vendora.conf
TLS_PENDING_FILE=/etc/nginx/vendora-tls-pending

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  log "Cloudflare origin certificate/key not found at $CERT_FILE / $KEY_FILE."
  log "Preparing nginx directories but NOT enabling the TLS site this run."
  # Ensure the (port 80 redirect) part does not reference ssl material; only
  # install the site when certs exist to keep nginx -t valid at all times.
  install -d /etc/nginx/sites-available /etc/nginx/sites-enabled
  rm -f "$SITE_LINK"
  : > "$TLS_PENDING_FILE"
  log "TLS activation is PENDING. Continue with the other steps; re-run this"
  log "script after installing:"
  log "  $CERT_FILE (mode 644)"
  log "  $KEY_FILE  (mode 600)"
else
  if [ -f /opt/vendora/deploy/nginx/vendora.conf ]; then
    log "Installing nginx site configuration (certs present)"
    install -m 644 /opt/vendora/deploy/nginx/vendora.conf "$TLS_SITE"
    ln -sf "$TLS_SITE" "$SITE_LINK"
    rm -f /etc/nginx/sites-enabled/default

    # Real visitor IPs from Cloudflare. Fetched to the include file; if this
    # ever fails, DO NOT reload nginx with a broken config.
    if [ -f /opt/vendora/scripts/update-cloudflare-ips.sh ]; then
      if bash /opt/vendora/scripts/update-cloudflare-ips.sh; then
        log "Cloudflare IP ranges refreshed."
      else
        log "WARNING: Cloudflare IP refresh failed. Removing the TLS site entry so"
        log "nginx is not left in a broken state; re-run bootstrap once certificates"
        log "and Cloudflare ranges are available."
        rm -f "$SITE_LINK"
        exit 1
      fi
    else
      log "WARNING: update-cloudflare-ips.sh not found; vendora.conf includes"
      log "/etc/nginx/cloudflare-ips.conf which must exist first."
      rm -f "$SITE_LINK"
      exit 1
    fi

    if ! nginx -t; then
      log "nginx -t FAILED with the Vendora site enabled; disabling it to keep nginx valid."
      rm -f "$SITE_LINK"
      exit 1
    fi
    systemctl enable --now nginx
    systemctl reload nginx
    rm -f "$TLS_PENDING_FILE"
    log "nginx configured and reloaded for vendora.tofanservice.ir"
  else
    log "WARNING: /opt/vendora/deploy/nginx/vendora.conf not found."
    log "Copy the deploy/ and scripts/ directories into /opt/vendora first, then re-run this script:"
  fi
fi

log "Bootstrap complete."
cat <<'NEXT'
Next manual steps (details in docs/DEPLOYMENT.md):
  1. Install the Cloudflare Origin certificate (if not already done):
       sudo install -m 644 -o root -g root /path/to/vendora.pem /etc/ssl/cloudflare/vendora.crt
       sudo install -m 600 -o root -g root /path/to/vendora.key /etc/ssl/cloudflare/vendora.key
     Then re-run the bootstrap to activate the nginx TLS site:
       sudo bash /opt/vendora/scripts/bootstrap-server.sh
  2. Create the production environment file:
       install -m 600 deploy/env/production.env.example deploy/env/production.env
     then fill in Jwt__Key and Auth__AdminInviteCode:
       openssl rand -hex 32
  3. Set Cloudflare DNS AAAA -> server IPv6 (proxied) and TLS mode Full (strict).
  4. Trigger the first deployment from GitHub Actions.
NEXT