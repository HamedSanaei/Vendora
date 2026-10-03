# Vendora

Vendora is a clean-architecture ecommerce solution for a specialized bag manufacturer. The repository contains an ASP.NET Core Web API, a React admin panel, and a bilingual Next.js storefront.

## Projects

- `API`: ASP.NET Core Web API composition root with Swagger in development.
- `Domain`: ecommerce entities, enums, value objects, and domain rules.
- `Application`: CQRS use cases powered by MediatR.
- `Persistence`: EF Core SQLite DbContext, migrations, repositories, and seed data.
- `Infrastructure`: adapters for external details such as local product image storage.
- `admin`: Vite + React admin panel using MobX and Axios.
- `site`: Next.js storefront with localized shopping UI and API-backed features.

## Architecture

The backend follows a domain-centric flow:

```text
React/Next UI -> API Controller -> MediatR Command/Query -> Application Handler -> Persistence/Domain -> API Response
```

Admin API endpoints are protected with `[Authorize(Policy = "AdminOnly")]` (JWT + Admin role). Development seed users and demo data are only created in Development environments.

## Requirements

- .NET 10 SDK
- Node.js 26 or a compatible modern Node runtime
- npm

## Backend Setup

```bash
dotnet restore
dotnet build Vendora.slnx
dotnet ef database update --project Persistence --startup-project API
dotnet run --project API
```

Swagger is available only in development.

## Admin Panel

```bash
cd admin
npm install
npm run dev
```

Admin routes are locale-prefixed:

- Persian RTL: `https://localhost:3000/fa/admin`
- English LTR: `https://localhost:3000/en/admin`

The admin app uses:

- React + TypeScript
- Vite
- MobX for state
- Axios for API calls

## Storefront Site

```bash
cd site
npm install
npm run dev
```

Storefront routes are locale-prefixed:

- Persian RTL: `http://localhost:3000/fa`
- English LTR: `http://localhost:3000/en`

The homepage slideshow reads its configured photos from the ASP.NET Core API. Set `NEXT_PUBLIC_API_BASE_URL` to the API origin (or its `/api` URL) before starting or building the site; it defaults to `http://localhost:5020`.

### Homepage slideshow

- Manage photos under **Online store** at `/fa/admin/online-store` or `/en/admin/online-store`.
- Upload JPEG, PNG, or WebP images up to **5 MiB**; the API validates the extension, MIME type, byte count, and raster signatures. Uploaded photos use the existing `/uploads/products/` storage.
- Each photo has a nonnegative integer display order and its own **1–120 second** duration. Lower orders appear first; ties are ordered by slide ID. Both languages share the same playlist and keep their localized hero text.
- Edit settings without selecting a file to retain the existing photo, or select a replacement. Removal requires confirmation. Successful replacements/removals clean up the owned upload after saving the database change; IO/permission cleanup failures are best-effort.
- The storefront supports autoplay, previous/next, direct photo selection, RTL-aware arrow keys, and pause/play on mobile and desktop. Hover, focus, and hidden tabs temporarily pause playback; reduced-motion preferences start it paused. A single photo does not autoplay. With no configured photos or an unavailable API, the original hero photo remains and the count reflects one photo.
- `GET /api/slideshow` is public. `GET`/`POST /api/admin/slideshow` and `PUT`/`DELETE /api/admin/slideshow/{id}` require the `AdminOnly` policy. Write forms use `image`, `sortOrder`, and `durationSeconds`; only updates may omit `image`.
- Apply the additive `AddHomepageSlideshow` EF migration before serving the new endpoints. The deployment pipeline already runs migrations; no existing tables or data are changed by this migration's `Up` operation.

## Quality Checks

```bash
dotnet build Vendora.slnx
cd admin && npm run lint && npm run build
cd site && npm run lint && npm run build
```

## Production Deployment

Vendora is deployed to **https://vendora.tofanservice.ir** behind Cloudflare
using Docker Compose and GitHub Actions. Pushing to `main` runs CI, builds
SHA-tagged images to GHCR, and deploys them to the production server with
database backups, migrations, health checks, and automatic rollback.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full architecture,
server bootstrap, Cloudflare/TLS setup, GitHub secrets, and operating
guide (backups, rollback, logs, troubleshooting).

## Notes

- Product prices are displayed and entered as Toman in the UI.
- Category, brand, and coupon deletes are soft deletes.
- Password reset in the admin user page is a safe placeholder until real authentication is implemented.
