#!/usr/bin/env bash
# Bootstrap a clean Debian/Ubuntu server for Vendora production.
#
# Run as root (or with sudo). Idempotent: safe to re-run.
#   sudo bash scripts/bootstrap-server.sh
#
# After bootstrap:
#   1. Add the GitHub Actions deploy key to /home/vendora/.ssh/authorized_keys
#   2. Create /etc/ssl/cloudflare/vendora.crt and vendora.key
#   3. Create deploy/env/production.env from the example
#   4. Run scripts/update-cloudflare-ips.sh
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

# --- Deployment user ---------------------------------------------------------------
if ! id -u vendora >/dev/null 2>&1; then
  log "Creating deployment user 'vendora'"
  useradd -m -s /bin/bash vendora
  log "User created. Add the deploy public key to /home/vendora/.ssh/authorized_keys (see docs/DEPLOYMENT.md)."
else
  log "User 'vendora' already exists"
fi
usermod -aG docker vendora

# --- Application directories ---------------------------------------------------------
log "Creating /opt/vendora directories"
mkdir -p /opt/vendora/deploy /opt/vendora/scripts /opt/vendora/data /opt/vendora/uploads /opt/vendora/backups /opt/vendora/logs /opt/vendora/state
chown -R vendora:docker /opt/vendora
chmod 750 /opt/vendora

# The API container runs as the non-root 'app' user (uid 1654 in the .NET
# aspnet images). The bind-mounted data and uploads directories must be
# writable by that uid inside the container while remaining traversable and
# readable by the deploy user for backups. Directories are owned by uid 1654
# with 755 permissions; files created inside (e.g. vendora.db) are 644 so the
# deploy user can read them with sqlite3.
chown 1654:1654 /opt/vendora/data /opt/vendora/uploads
chmod 755 /opt/vendora/data /opt/vendora/uploads

# --- Cloudflare origin TLS directory ------------------------------------------------
install -d -m 700 -o root -g root /etc/ssl/cloudflare

# --- Nginx site configuration ---------------------------------------------------------
if [ -f /opt/vendora/deploy/nginx/vendora.conf ]; then
  log "Installing nginx site configuration"
  install -m 644 /opt/vendora/deploy/nginx/vendora.conf /etc/nginx/sites-available/vendora.conf
  ln -sf /etc/nginx/sites-available/vendora.conf /etc/nginx/sites-enabled/vendora.conf
  rm -f /etc/nginx/sites-enabled/default

  # Real visitor IPs from Cloudflare (run manually any time the ranges change).
  if [ -f /opt/vendora/scripts/update-cloudflare-ips.sh ]; then
    bash /opt/vendora/scripts/update-cloudflare-ips.sh || log "WARNING: cloudflare-ips refresh failed; nginx may not start until it succeeds."
  fi

  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
  log "nginx configured for vendora.tofanservice.ir"
else
  log "WARNING: /opt/vendora/deploy/nginx/vendora.conf not found."
  log "Copy the deploy/ and scripts/ directories into /opt/vendora first, then re-run this script:"
  log "  scp -r deploy scripts vendora@<server>:/opt/vendora/"
  log "  sudo bash /opt/vendora/scripts/bootstrap-server.sh"
fi

log "Bootstrap complete."
cat <<'NEXT'
Next manual steps (details in docs/DEPLOYMENT.md):
  1. Install the Cloudflare Origin certificate:
       /etc/ssl/cloudflare/vendora.crt  (mode 644)
       /etc/ssl/cloudflare/vendora.key  (mode 600)
  2. Create the deploy key for GitHub Actions and add it to:
       /home/vendora/.ssh/authorized_keys
  3. Create the environment file:
       install -m 600 deploy/env/production.env.example deploy/env/production.env
     then fill in Jwt__Key and Auth__AdminInviteCode:
       openssl rand -hex 32
  4. Set Cloudflare DNS AAAA -> server IPv6 (proxied) and TLS mode Full (strict).
  5. Trigger the first deployment from GitHub Actions.
NEXT
