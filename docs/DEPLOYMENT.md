# Vendora Production Deployment

This document describes the complete production CI/CD and Docker deployment
system for Vendora. Production hostname:

**https://vendora.tofanservice.ir**

After the initial server setup, the normal workflow is:

```bash
git add .
git commit -m "..."
git push origin main
```

Everything else (CI, image build, deploy, health checks) runs automatically.

---

## 1. Architecture

```
visitor
  |
  | HTTPS
  v
Cloudflare (proxied, AAAA -> server IPv6, TLS mode: Full strict)
  |
  | HTTPS (origin certificate)
  v
Host Nginx  (IPv4 + IPv6 listeners, real visitor IPs from Cloudflare)
  |
  | HTTP
  v
127.0.0.1:8080  (vendora-gateway container, loopback only)
  |
  +-- /api/*, /uploads/*  -> vendora-api   (ASP.NET Core, port 8080 internal)
  |
  +-- /fa/admin*, /en/admin* , /admin/*    -> vendora-admin (nginx static SPA)
  |
  +-- /*                  -> vendora-site  (Next.js standalone, port 3000)
```

- Only the gateway publishes a port, and only on `127.0.0.1`.
- The API, storefront, admin, and database are reachable only through the
  private Docker network `vendora`.
- SQLite lives at `/opt/vendora/data/vendora.db` (bind mount, survives
  container recreation).
- Product uploads live at `/opt/vendora/uploads` (bind mount).
- Application containers run as non-root users; no `--privileged`; no Docker
  socket mounts.

### URL map

| URL | Serves |
|---|---|
| `https://vendora.tofanservice.ir/` | Storefront (redirects to `/fa`) |
| `https://vendora.tofanservice.ir/fa`, `/en` | Storefront locale routes |
| `https://vendora.tofanservice.ir/api/...` | API |
| `https://vendora.tofanservice.ir/uploads/...` | Uploaded product images |
| `https://vendora.tofanservice.ir/fa/admin` | Admin panel (Persian) |
| `https://vendora.tofanservice.ir/en/admin` | Admin panel (English) |
| `https://vendora.tofanservice.ir/healthz` | API health probe (status + DB) |

The storefront and admin apps are built with the API base URL
`https://vendora.tofanservice.ir`, so browsers call the API through the same
origin; no CORS-cross-origin traffic is needed at runtime. Admin assets are
built with Vite `base=/admin/` so they never collide with storefront `/assets`.

---

## 2. Docker services

Defined in `deploy/docker-compose.production.yml`. All images are published to
GitHub Container Registry with immutable Git SHA tags:

```
ghcr.io/<owner>/vendora-api:<sha>
ghcr.io/<owner>/vendora-site:<sha>
ghcr.io/<owner>/vendora-admin:<sha>
```

`latest` is also maintained for convenience but deployment always pins the
exact SHA.

**GHCR package visibility (required for anonymous pulls):**

- This is a **public** repository, and the production server pulls images with
  `docker compose pull` **without any GHCR login** (anonymous pull). All three
  packages must therefore be **Public**.
- Verify/change visibility: GitHub → **Packages** → open each of
  `vendora-api`, `vendora-site`, `vendora-admin` → **Package settings** →
  **Change visibility** → **Public**. URL pattern:
  `https://github.com/<owner>?tab=packages` then open
  `https://ghcr.io/<owner>/vendora-api`,
  `https://ghcr.io/<owner>/vendora-site`, and
  `https://ghcr.io/<owner>/vendora-admin`.
- If you prefer private images, the server must authenticate to GHCR instead;
  that requires installing a deploy token on the server and adding a GHCR
  `docker login` (via a Git ignore'd `.env` / credential helper) before the
  deploy script pulls. Public packages are recommended for this repository.

### Dockerfiles

| Image | Dockerfile | Base | Runtime |
|---|---|---|---|
| vendora-api | `deploy/docker/API.Dockerfile` | SDK `mcr.microsoft.com/dotnet/sdk:10.0` build → `aspnet:10.0` runtime | `dotnet API.dll` as user `app`, port 8080 |
| vendora-site | `deploy/docker/site.Dockerfile` | `node:24-slim` build → `node:24-slim` | Next.js standalone `node server.js` as user `node`, port 3000 |
| vendora-admin | `deploy/docker/admin.Dockerfile` | `node:24-alpine` build → `nginx:1.27-alpine` | static SPA, port 80 |

Build contexts: API = repository root, site = `site/`, admin = `admin/`.
Corresponding `.dockerignore` files keep build contexts clean.

---

## 3. CI/CD flow

Two workflows:

- **`.github/workflows/ci.yml`** — runs on every push and every PR. Backend
  (`dotnet restore/build/test`), admin (`npm ci/lint/build`), site
  (`npm ci/lint/build`). It never builds images and never deploys.
- **`.github/workflows/deploy.yml`** — runs on `main` pushes only. This is a
  **single gated pipeline**;

```
push to main
  -> backend CI  \
  -> admin CI    (all three must pass)
  -> site CI     /
       -> build-images  (only if ALL CI jobs succeeded; needs: [backend, admin, site])
            - Docker Buildx + GHCR caching
            - push <sha> + latest with OCI labels (source, revision, created)
            - validate the pushed artifacts
       -> deploy (only if image build succeeded; needs: build-images)
            - environment: production (optional protection rules in GitHub)
            - scp deploy/ + scripts/ to the server
            - run scripts/deploy-production.sh <sha>
            - verify the public endpoints from the runner
            - write a job summary
```

Because every stage uses `needs:`, a known-broken commit can **never** be
image-built or deployed:

- any CI job fails ⇒ **NO image build** and **NO deploy**
- image build fails ⇒ **NO deploy**
- deploy uses exactly the commit SHA (`actions/checkout` at the triggering
  `GITHUB_SHA`) that passed CI and was baked into the images and scripts
  (`GITHUB_SHA` for tags, the deploy argument, rollback state, and summary all
  refer to the same commit).

Pull requests never trigger a deploy. Production deploys happen only on
`main`. Workflow concurrency groups (`vendora-production`) prevent racing
deployments.

---

## 4. Server preparation (first bootstrap)

Requirements: Debian or Ubuntu, root access, static IPv6 (AAAA record).

### 4.1 Copy the repo deployment files to the server

From your machine. IPv6 literals must be bracketed in scp; IPv4/hostnames are
plain:

```bash
# IPv6
scp -r deploy scripts root@[2001:db8::1]:/opt/vendora/
# IPv4 or hostname
scp -r deploy scripts root@10.0.0.5:/opt/vendora/
```

If `/opt/vendora` does not exist yet, create it first:

```bash
# IPv6
ssh root@2001:db8::1 'mkdir -p /opt/vendora'
# IPv4 or hostname
ssh root@10.0.0.5 'mkdir -p /opt/vendora'
```

### 4.2 Run the bootstrap script

Deployment connects directly as **root** with a dedicated key, so no separate
Linux user is created. The bootstrap is **lockout-safe and idempotent**: it
never disables SSH password auth or restarts sshd until a valid root key login
is confirmed, and it never enables the nginx TLS site until the Cloudflare
origin certificate/key are present.

```bash
# IPv6
ssh root@2001:db8::1 'bash /opt/vendora/scripts/bootstrap-server.sh'
# IPv4 or hostname
ssh root@10.0.0.5 'bash /opt/vendora/scripts/bootstrap-server.sh'
```

You can pass an SSH public key file as the first argument so the script installs
it into `/root/.ssh/authorized_keys` before hardening sshd:

```bash
ssh root@<server> 'bash /opt/vendora/scripts/bootstrap-server.sh /tmp/deploy.pub'
```

If you do **not** pass a key, the bootstrap only proceeds if
`/root/.ssh/authorized_keys` is already non-empty; otherwise it aborts **before**
modifying any sshd configuration. Password-based root SSH is never enabled.

This installs (idempotently):

- Docker Engine + Compose plugin from the official Docker apt repository
- nginx, sqlite3, rsync, curl
- `/opt/vendora/{deploy,scripts,data,uploads,backups,logs,state}` owned by root
- `/etc/ssl/cloudflare` (mode 700)
- sshd hardening (`PermitRootLogin prohibit-password`, `PubkeyAuthentication yes`,
  `PasswordAuthentication no`) — written, validated with `sshd -t`, and applied
  only after a valid root key is confirmed (see below)
- the nginx TLS site config — installed and enabled only once
  `/etc/ssl/cloudflare/vendora.{crt,key}` exist; otherwise reported as PENDING

**SSH lockout protection order (implemented in the script):**

1. If a public key path is supplied, validate the file and install it into
   `/root/.ssh/authorized_keys` (mode 600).
2. Otherwise inspect `/root/.ssh/authorized_keys`; if it has no valid non-empty
   key, **abort before any sshd change** and print clear instructions — password
   auth is left as-is and the ssh service is not restarted.
3. Only after a valid root key is confirmed, write the hardening drop-in, run
   `sshd -t`; if validation fails, revert the drop-in and do **not** restart ssh.
4. Restart the actual ssh service (Ubuntu's `ssh`, `sshd`, or detected unit),
   never `systemctl restart ssh sshd` blindly.

**Nginx / certificate bootstrap order (implemented in the script):**

1. Base packages, Docker, and `/opt/vendora` are installed regardless.
2. `/etc/ssl/cloudflare` is created (mode 700).
3. If `vendora.crt`/`vendora.key` are missing: everything installs, the TLS
   site is **not** enabled and nginx is not reloaded — TLS activation is
   reported as PENDING (safe to re-run later).
4. Once the certificate/key files exist, re-run the bootstrap: it refreshes the
   Cloudflare IP include, runs `nginx -t`, and only reloads nginx on success.
   If the Cloudflare IP fetch or `nginx -t` fails, the site entry is removed so
   nginx is never left broken.

> The SSH deployment user (root) and the container runtime users are separate
> concerns. The API and storefront containers still run as non-root users;
> only the bind-mounted data/uploads directories are owned by the API
> container uid so it can write to them. No Docker socket is mounted into any
> application container.

### 4.3 Add the GitHub Actions deploy key

Generate a dedicated SSH key pair (no passphrase):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vendora_deploy -N ""
```

Install the public key in `/root/.ssh/authorized_keys` (the bootstrap also
accepts it as `$1`):

```bash
# IPv6
cat ~/.ssh/vendora_deploy.pub | ssh root@2001:db8::1 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
# IPv4 or hostname
cat ~/.ssh/vendora_deploy.pub | ssh root@10.0.0.5 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

Root login is key-based only (`PermitRootLogin prohibit-password`);
password-based root SSH is never used. The bootstrap never disables password
auth or restarts sshd unless a valid root key login is already confirmed.

### 4.4 Create the production environment file

On the server:

```bash
cd /opt/vendora
install -m 600 deploy/env/production.env.example deploy/env/production.env
```

Fill in real values:

```bash
openssl rand -hex 32   # -> Jwt__Key
openssl rand -hex 32   # -> Auth__AdminInviteCode
```

Never commit `production.env`; it is gitignored and mode 600.

### 4.5 Firewall notes

Restrict inbound traffic on the origin to Cloudflare networks for ports
80/443 **only after verifying** SSH still works on its own port. For example
with `ufw`:

```bash
sudo ufw default deny incoming
sudo ufw allow OpenSSH                # keep SSH reachable, never behind CF proxy
sudo ufw allow from <cloudflare ipv4> to any port 80 proto tcp
sudo ufw allow from <cloudflare ipv6> to any port 80 proto tcp
sudo ufw allow from <cloudflare ipv4> to any port 443 proto tcp
sudo ufw allow from <cloudflare ipv6> to any port 443 proto tcp
sudo ufw enable
```

Cloudflare ranges are published at `https://www.cloudflare.com/ips-v4` and
`https://www.cloudflare.com/ips-v6`. Test IPv6 reachability after enabling
(`curl -6 https://vendora.tofanservice.ir/healthz`). The bootstrap does not
apply firewall rules automatically to avoid locking you out.

---

## 5. Cloudflare configuration

1. DNS: add an **AAAA** record
   - name: `vendora.tofanservice.ir`
   - content: production server IPv6
   - proxied: **true** (orange cloud)
2. TLS/SSL mode: **Full (strict)** — never Flexible.
3. Optionally enable "Always Use HTTPS" and HSTS.

The record can also be created/updated with the manual workflow
`.github/workflows/cloudflare-dns.yml` (requires `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ZONE_ID` GitHub secrets; the IPv6 address is a manual input). DNS
is intentionally never rewritten during normal deployments.

### Origin certificate (Full strict)

Generate a Cloudflare Origin Certificate in the Cloudflare dashboard
(SSL/TLS → Origin Server → Create Certificate, hostname
`vendora.tofanservice.ir`, validity 15 years). Install on the server:

```bash
sudo install -m 644 -o root -g root vendora.pem /etc/ssl/cloudflare/vendora.crt
sudo install -m 600 -o root -g root vendora.key /etc/ssl/cloudflare/vendora.key
```

Then either re-run the bootstrap (it will detect the certificate/key and
activate the TLS site safely), or activate manually after confirming everything:

```bash
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx
```

The bootstrap does **not** reload nginx while the certificate files are missing,
so a first bootstrap never fails (or leaves nginx broken) because the
certificate has not been installed yet.

Certificate and key files are never stored in Git.

### Real visitor IPs

`deploy/nginx/vendora.conf` trusts `CF-Connecting-IP` only from the official
Cloudflare ranges, maintained by:

```bash
sudo bash /opt/vendora/scripts/update-cloudflare-ips.sh
```

The script fetches `ips-v4`/`ips-v6` from Cloudflare and writes
`/etc/nginx/cloudflare-ips.conf`, then reloads nginx. Re-run it whenever
Cloudflare publishes new ranges.

---

## 6. GitHub secrets

Configure these in **Settings → Secrets and variables → Actions** (or on the
`production` environment):

| Secret | Expected value |
|---|---|
| `PROD_HOST` | Production server IPv6 address (e.g. `2001:db8::1`) |
| `PROD_PORT` | SSH port (usually `22`) |
| `PROD_USER` | SSH deployment user (set to `root`) |
| `PROD_SSH_KEY` | **Private** half of the deploy key, e.g. contents of `~/.ssh/vendora_deploy` |
| `PROD_SSH_KNOWN_HOSTS` | Output of `ssh-keyscan`, see below |
| `CLOUDFLARE_API_TOKEN` | (optional, DNS workflow only) Cloudflare API token with DNS edit permission |
| `CLOUDFLARE_ZONE_ID` | (optional, DNS workflow only) Cloudflare zone ID for the domain |
| `NEXT_PUBLIC_STRIPE_KEY` | (optional) Stripe publishable key baked into the storefront build |

### Obtaining the known-hosts value

For an IPv6 host, use the `-6` flag (IPv4/hostname: `-4` or omit):

```bash
# IPv6
ssh-keyscan -6 -p <PORT> <PROD_HOST>          # e.g. ssh-keyscan -6 -p 22 2001:db8::1
# IPv4 or hostname
ssh-keyscan -4 -p <PORT> <PROD_HOST>          # e.g. ssh-keyscan -4 -p 22 10.0.0.5
```

Paste the full output (one or more `hostname ssh-rsa ...` lines) into
`PROD_SSH_KNOWN_HOSTS`. The workflow uses `StrictHostKeyChecking=yes`; if the
value is wrong the deployment fails safely.

The `production` GitHub Environment can additionally enforce required
reviewers or a manual approval gate before deployment.

---

## 7. First deployment

### Exact safe first-production order

1. **Prepare an SSH key and confirm key-based root login works** (before any
   sshd hardening): generate the deploy key locally and install its public half
   into `/root/.ssh/authorized_keys`, then verify you can log in with it:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/vendora_deploy -N ""
   # IPv6: cat ~/.ssh/vendora_deploy.pub | ssh -p22 'root@[2001:db8::1]' 'mkdir -p /root/.ssh && chmod 700 /root/.ssh && cat >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys'
   # IPv4 : cat ~/.ssh/vendora_deploy.pub | ssh -p22 root@10.0.0.5 'mkdir -p /root/.ssh && chmod 700 /root/.ssh && cat >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys'
   ssh -i ~/.ssh/vendora_deploy root@<server> 'echo key-login-ok'
   ```
2. **Run the bootstrap safely** — copy `deploy/` + `scripts/` to `/opt/vendora`
   and run the bootstrap (pass the deploy public key so it installs a key
   before hardening sshd):

   ```bash
   scp -r deploy scripts root@<server>:/opt/vendora/   # IPv6: root@[IPv6]:/opt/vendora/
   ssh root@<server> 'bash /opt/vendora/scripts/bootstrap-server.sh /root/.ssh/authorized_keys'
   ```

   The bootstrap installs Docker/nginx and prepares `/opt/vendora`. With a
   valid root key confirmed it hardens sshd (`PermitRootLogin
   prohibit-password`) safely. nginx TLS activation stays PENDING until the
   origin certificate is installed.
3. **Generate secrets and create the environment file** on the server:

   ```bash
   cd /opt/vendora
   install -m 600 deploy/env/production.env.example deploy/env/production.env
   # fill in Jwt__Key (openssl rand -hex 32) and Auth__AdminInviteCode (openssl rand -hex 32)
   ```
4. **Install the Cloudflare Origin Certificate** (see §5) into
   `/etc/ssl/cloudflare/vendora.{crt,key}`.
5. **Activate (or re-run) nginx** so the TLS site is enabled:

   ```bash
   ssh root@<server> 'bash /opt/vendora/scripts/bootstrap-server.sh'
   ```
6. **Configure Cloudflare** — DNS AAAA `vendora.tofanservice.ir` → server IPv6
   (`proxied`, orange cloud) and TLS mode set to **Full (strict)**.
7. **Configure GitHub Environment secrets** — create the `production`
   environment and add the secrets from the table in §6 (`PROD_HOST`,
   `PROD_PORT`, `PROD_USER=root`, `PROD_SSH_KEY`, `PROD_SSH_KNOWN_HOSTS`).
8. **Verify GHCR image visibility** — confirm all three packages are Public
   (see §2) so the server can pull anonymously.
9. **Push to `main`** to trigger the first production pipeline.
10. **Verify `/healthz` and the storefront** respond over
    `https://vendora.tofanservice.ir/`.

### Triggering a deployment

After the server is bootstrapped, DNS proxied, TLS verified, and GHCR packages
made Public, push to `main`:

```bash
git push origin main
```

The production pipeline runs in the Actions tab: **CI → build-images → deploy**.
The deploy job shows a summary like:

```
Production Deployment
- Deployment status: Success
- Git SHA: <sha>
- Image tags: ghcr.io/<owner>/vendora-{api,site,admin}:<sha>
- Hostname: https://vendora.tofanservice.ir
```

### Creating the first admin account

Because production databases are never seeded with demo users, register the
first admin manually:

1. Open `https://vendora.tofanservice.ir/fa/admin/register`
2. Enter name, email, password, and the `Auth__AdminInviteCode` you generated
3. Log in at `https://vendora.tofanservice.ir/fa/admin/login`

---

## 8. Database persistence, backups, and migrations

### Persistence

- SQLite: `/opt/vendora/data/vendora.db` (bind mount `/data` in the container)
- Product uploads: `/opt/vendora/uploads` (bind mount
  `/app/wwwroot/uploads` in the container)

Neither lives inside the container filesystem, so `docker compose up -d`,
restarts, and image updates never lose data.

### Migration strategy

On every deployment, before the new containers start:

1. `scripts/backup-database.sh` takes a consistent timestamped SQLite backup
   (`sqlite3 .backup`, safe while the running API holds the WAL database)
   into `/opt/vendora/backups`.
2. The API image runs in one-shot migration mode
   (`docker compose --profile migrate run -T --rm --no-deps vendora-api-migrate`):
   it prints pending migrations, applies them with EF Core, and exits
   non-zero on failure.
3. If migrations fail, the deployment aborts **before** any new container
   starts — the previous version keeps serving.
4. Only after migrations succeed are the new containers started.

The API also applies migrations during normal startup (idempotent), so the
deploy-time step and a manual `docker compose up` are both safe.

Backups rotate automatically: the newest 10 are kept
(`VENDORA_KEEP_BACKUPS`).

Manual backup:

```bash
bash /opt/vendora/scripts/backup-database.sh
```

### Rollback and schema compatibility

`scripts/rollback-production.sh` (or the automatic rollback in the deploy
script) redeploys the **previous image SHA**. Database migrations are never
automatically rolled back because SQLite schema downgrades are destructive.
The previous application version must be compatible with the migrated schema;
EF Core generally tolerates extra tables/columns, so this works for additive
migrations. If a migration is destructive (column removal, data reshapes),
plan a forward-only migration to restore compatibility instead of rolling
back the schema.

---

## 9. Health checks

| Check | Implementation |
|---|---|
| API | `GET /healthz` — process alive + `SELECT 1` against SQLite; returns `{"status":"ok"}` or 503. No internals leaked. |
| vendora-api container | `curl -fsS http://127.0.0.1:8080/healthz` |
| vendora-site container | `node -e "fetch('http://127.0.0.1:3000/fa')..."` |
| vendora-admin container | `wget http://127.0.0.1/healthz` (container nginx liveness) |
| vendora-gateway | `wget http://127.0.0.1/healthz` — proxied to the API, so it also validates DB access |
| Deploy verification | gateway `/healthz`, `/fa`, `/fa/admin` on `127.0.0.1:8080`, then the same URLs via `https://vendora.tofanservice.ir` with retries |

A deployment is only recorded as successful after all internal and public
checks pass. If they fail, containers roll back to the previous version.

---

## 10. Normal operations

### Deploy a new version

```bash
git push origin main
```

### Manual rollback

```bash
# IPv6: ssh root@2001:db8::1 ...; IPv4/hostname: ssh root@<server> ...
ssh root@<server> 'bash /opt/vendora/scripts/rollback-production.sh'
```

Version state is kept in `/opt/vendora/state/{current-version,previous-version}`.

### Logs

```bash
ssh root@<server> 'docker compose -f /opt/vendora/deploy/docker-compose.production.yml logs -f --tail=200'
ssh root@<server> 'journalctl -u nginx -f'
ssh root@<server> 'tail -f /opt/vendora/logs/*'
```

Deployment logs are printed to the GitHub Actions run; the deploy script
writes to `/opt/vendora/logs` if you redirect it:

```bash
bash /opt/vendora/scripts/deploy-production.sh <sha> 2>&1 | tee /opt/vendora/logs/deploy-<timestamp>.log
```

---

## 11. Environment variables

All runtime configuration is documented in `deploy/env/production.env.example`.
Required in production (the API refuses to start without them):

| Variable | Purpose |
|---|---|
| `Jwt__Key` | JWT signing secret (strong random) |
| `Auth__AdminInviteCode` | Invite code for the first admin registration |
| `Cors__AllowedOrigins` | Origin allowed to call the API |
| `VENDORA_IMAGE_REGISTRY` | GHCR registry prefix for image pulls |
| `VENDORA_PUBLIC_HOST` | Public hostname for post-deploy checks |

Build-time variables for the frontends (baked into bundles):

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | storefront → `https://vendora.tofanservice.ir` |
| `NEXT_PUBLIC_STRIPE_KEY` | storefront (optional) |
| `VITE_API_BASE_URL` | admin → `https://vendora.tofanservice.ir` |
| `VITE_STOREFRONT_URL` | admin |
| `VITE_BASE_URL` | admin → `/admin/` |

---

## 12. Security posture

- Admin API endpoints require a JWT with the `Admin` role
  (`[Authorize(Policy = "AdminOnly")]` on `AdminController`).
- Production startup validates that the JWT key and admin invite code are not
  the development defaults; the API exits with a clear error otherwise.
- Development seed data (demo products, `admin@vendora.local`, test users) is
  created only when `ASPNETCORE_ENVIRONMENT=Development`.
- CORS is restricted to configured origins; Swagger is development-only.
- The health endpoint never leaks connection strings, paths, or stack traces.
- Secrets, SSH keys, certificates, and `production.env` are never committed;
  `.dockerignore` and `.gitignore` enforce this.
- No privileged containers, no Docker socket mounts, no remote Docker daemon,
  no mutable-tag-only deployments, no `StrictHostKeyChecking=no`.

---

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy fails at `VENDORA_IMAGE_REGISTRY is required` | Fill in `deploy/env/production.env` on the server |
| API exits with "Jwt:Key must be configured..." | Set a strong `Jwt__Key` in `production.env` |
| nginx 502 | `sudo systemctl status nginx`; gateway may be down — `docker compose -f /opt/vendora/deploy/docker-compose.production.yml ps` |
| Cloudflare 522/523 | Check host nginx listeners `ss -tlnp` (`:443`, `[::]:443`) and the origin certificate |
| Cloudflare 526 | TLS mode not Full strict, or origin certificate/key mismatch |
| Site healthy but admin broken | Confirm admin assets load via `https://vendora.tofanservice.ir/admin/assets/...` (gateway strips `/admin/` for the admin container) |
| Database locked | Only the API container should hold the SQLite file; `docker compose ps` should show exactly one `vendora-api` |
| Rollback needed | `bash /opt/vendora/scripts/rollback-production.sh` |

---

## 14. Reference files

```
.github/workflows/ci.yml                 CI checks for PRs and pushes (images never built here)
.github/workflows/deploy.yml             Gated main pipeline: CI -> build images -> deploy
.github/workflows/cloudflare-dns.yml     Manual AAAA upsert (optional)
deploy/docker-compose.production.yml     Production stack
deploy/docker/API.Dockerfile             API image
deploy/docker/site.Dockerfile            Storefront image
deploy/docker/admin.Dockerfile           Admin image
deploy/nginx/gateway.conf                Internal gateway
deploy/nginx/vendora.conf                Host origin nginx
deploy/env/production.env.example        Documented env template
scripts/deploy-production.sh             Idempotent deploy + rollback on failure
scripts/rollback-production.sh           Manual rollback
scripts/bootstrap-server.sh              Server bootstrap
scripts/backup-database.sh               SQLite backup with rotation
scripts/update-cloudflare-ips.sh         Real visitor IP ranges
docs/DEPLOYMENT.md                       This document
```
