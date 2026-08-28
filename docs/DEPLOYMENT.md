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

```
push to main
  -> CI workflow (.github/workflows/ci.yml)
       - backend: dotnet restore/build/test (Release)
       - admin: npm ci, lint, build
       - site: npm ci, lint, build
  -> Build Production Images workflow (.github/workflows/build-images.yml)
       - Docker Buildx with GHCR layer caching
       - push <sha> + latest tags with OCI labels (source, revision, created)
       - validate the pushed artifacts
  -> Deploy Production workflow (.github/workflows/deploy-production.yml)
       (triggered by workflow_run success on the build workflow)
       - environment: production (optional protection rules in GitHub)
       - scp deploy/ + scripts/ to the server
       - run scripts/deploy-production.sh <sha>
       - verify public endpoints from the runner
       - write a job summary
```

Pull requests never trigger a build or deploy. Production deploys happen only
on `main`. Workflow concurrency groups prevent racing deployments.

---

## 4. Server preparation (first bootstrap)

Requirements: Debian or Ubuntu, root access, static IPv6 (AAAA record).

### 4.1 Copy the repo deployment files to the server

From your machine (replace the IPv6 literal):

```bash
scp -r deploy scripts vendora@2001:db8::1:/opt/vendora/
```

If `/opt/vendora` does not exist yet, create it first:

```bash
ssh vendora@2001:db8::1 'sudo mkdir -p /opt/vendora && sudo chown -R $USER /opt/vendora'
```

### 4.2 Run the bootstrap script

```bash
ssh vendora@2001:db8::1 'sudo bash /opt/vendora/scripts/bootstrap-server.sh'
```

This installs (idempotently):

- Docker Engine + Compose plugin from the official Docker apt repository
- nginx, sqlite3, rsync, curl
- deployment user `vendora` (added to the `docker` group)
- `/opt/vendora/{deploy,scripts,data,uploads,backups,logs,state}`
- `/etc/ssl/cloudflare` (mode 700)
- the nginx site config (if `deploy/nginx/vendora.conf` is present)

> The `vendora` user is a member of the `docker` group so the deploy script
> can manage the stack. This is equivalent to root on the host for container
> management; acceptable for a single-application server. The application
> containers themselves never mount the Docker socket.

### 4.3 Add the GitHub Actions deploy key

Generate a dedicated SSH key pair (no passphrase):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vendora_deploy -N ""
```

Install the public key on the server:

```bash
ssh vendora@2001:db8::1 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
cat ~/.ssh/vendora_deploy.pub | ssh vendora@2001:db8::1 'cat >> ~/.ssh/authorized_keys'
```

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
sudo nginx -t && sudo systemctl reload nginx
```

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
| `PROD_USER` | Deployment user (the bootstrap creates `vendora`) |
| `PROD_SSH_KEY` | **Private** half of the deploy key, e.g. contents of `~/.ssh/vendora_deploy` |
| `PROD_SSH_KNOWN_HOSTS` | Output of `ssh-keyscan`, see below |
| `CLOUDFLARE_API_TOKEN` | (optional, DNS workflow only) Cloudflare API token with DNS edit permission |
| `CLOUDFLARE_ZONE_ID` | (optional, DNS workflow only) Cloudflare zone ID for the domain |
| `NEXT_PUBLIC_STRIPE_KEY` | (optional) Stripe publishable key baked into the storefront build |

### Obtaining the known-hosts value

```bash
ssh-keyscan -p <PORT> <PROD_HOST>   # e.g. ssh-keyscan -p 22 2001:db8::1
```

Paste the full output (one or more `hostname ssh-rsa ...` lines) into
`PROD_SSH_KNOWN_HOSTS`. The workflow uses `StrictHostKeyChecking=yes`; if the
value is wrong the deployment fails safely.

The `production` GitHub Environment can additionally enforce required
reviewers or a manual approval gate before deployment.

---

## 7. First deployment

After the server is bootstrapped, DNS proxied, and TLS verified, push to
`main`:

```bash
git push origin main
```

Watch the three workflows in the Actions tab. The deploy workflow shows a
summary like:

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
ssh vendora@<server> 'bash /opt/vendora/scripts/rollback-production.sh'
```

Version state is kept in `/opt/vendora/state/{current-version,previous-version}`.

### Logs

```bash
ssh vendora@<server> 'docker compose -f /opt/vendora/deploy/docker-compose.production.yml logs -f --tail=200'
ssh vendora@<server> 'sudo journalctl -u nginx -f'
ssh vendora@<server> 'tail -f /opt/vendora/logs/*'
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
.github/workflows/ci.yml                 CI checks (PRs and main)
.github/workflows/build-images.yml       Build + push SHA images to GHCR (main)
.github/workflows/deploy-production.yml  SSH deploy + verification (main)
.github/workflows/cloudflare-dns.yml     Manual AAAA upsert
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
