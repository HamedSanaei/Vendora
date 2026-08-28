#!/usr/bin/env bash
# Bootstrap a clean Debian/Ubuntu server for Vendora production.
#
# Run as root (or with sudo). Idempotent: safe to re-run.
#   sudo bash scripts/bootstrap-server.sh
#
# GitHub Actions deploys directly as root using a dedicated SSH key, so no
# separate deployment Linux user is created. The API container still runs as
# the non-root 'app' user (uid 1654); the container runtime user and the SSH
# deployment user are separate concerns.
#
# After bootstrap:
#   1. Add the GitHub Actions deploy key to /root/.ssh/authorized_keys
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

# --- SSH hardening for key-based root deployment -----------------------------------
# Deployments connect directly as root with a dedicated key. Password
# authentication is always disabled; key authentication is required.
log "Configuring sshd for key-based root deployment"
install -d -m 700 -o root -g root /root/.ssh
{
  echo "PermitRootLogin prohibit-password"
  echo "PubkeyAuthentication yes"
  echo "PasswordAuthentication no"
} > /etc/ssh/sshd_config.d/99-vendora-deploy.conf
chmod 600 /etc/ssh/sshd_config.d/99-vendora-deploy.conf

# Install the deployment public key when provided as "$1" on the command line:
#   sudo bash scripts/bootstrap-server.sh <path-to-ssh-public-key-file>
if [ -n "${1:-}" ] && [ -f "$1" ]; then
  log "Installing deploy public key from $1"
  grep -qxF "$(cat "$1")" /root/.ssh/authorized_keys 2>/dev/null \
    || cat "$1" >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
else
  log "No public key provided as \$1; add the deploy key manually to /root/.ssh/authorized_keys."
fi

systemctl enable --now ssh sshd 2>/dev/null || true
systemctl restart ssh sshd 2>/dev/null || true
log "sshd restarted with PermitRootLogin prohibit-password."

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
  # IPv6 literal: root@[IPv6]; IPv4/hostname: root@host
  log "  scp -r deploy scripts root@<server>:/opt/vendora/"
  log "  (IPv6: scp -r deploy scripts 'root@[2001:db8::1]:/opt/vendora/')"
  log "  sudo bash /opt/vendora/scripts/bootstrap-server.sh"
fi

log "Bootstrap complete."
cat <<'NEXT'
Next manual steps (details in docs/DEPLOYMENT.md):
  1. Install the Cloudflare Origin certificate:
       /etc/ssl/cloudflare/vendora.crt  (mode 644)
       /etc/ssl/cloudflare/vendora.key  (mode 600)
  2. Create the deploy key for GitHub Actions and add it to /root/.ssh/authorized_keys:
       ssh-keygen -t ed25519 -f ~/.ssh/vendora_deploy -N ""
       # IPv6: cat ~/.ssh/vendora_deploy.pub | ssh 'root@[2001:db8::1]' 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
       # IPv4 : cat ~/.ssh/vendora_deploy.pub | ssh root@<server> 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
     sshd is configured with PermitRootLogin prohibit-password.
  3. Create the environment file:
       install -m 600 deploy/env/production.env.example deploy/env/production.env
     then fill in Jwt__Key and Auth__AdminInviteCode:
       openssl rand -hex 32
  4. Set Cloudflare DNS AAAA -> server IPv6 (proxied) and TLS mode Full (strict).
  5. Trigger the first deployment from GitHub Actions.
NEXT