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
- The storefront supports autoplay, previous/next, direct photo selection, RTL-aware arrow keys, and pause/play on mobile and desktop. Hover, focus, and hidden tabs temporarily pause playback; reduced-motion preferences start it paused. A single photo does not autoplay. With no configured photos or an unavailable API, a built-in five-second playlist shows the original hero photo, the original camera-bag artwork, and the original hunting-rifle-bag artwork in that order. Any nonempty admin playlist replaces these defaults.
- `GET /api/slideshow` is public. `GET`/`POST /api/admin/slideshow` and `PUT`/`DELETE /api/admin/slideshow/{id}` require the `AdminOnly` policy. Write forms use `image`, `sortOrder`, and `durationSeconds`; only updates may omit `image`.
- Apply the additive `AddHomepageSlideshow` EF migration before serving the new endpoints. The deployment pipeline already runs migrations; no existing tables or data are changed by this migration's `Up` operation.

### Account addresses and delivery locations

- `/fa/account/addresses` and `/en/account/addresses` read and manage the signed-in customer's real address book. Creating, editing, deleting, and selecting a default address use the account API; editing preserves the address ID in the locale-prefixed URL.
- An address can optionally include paired `latitude` and `longitude` values. The API accepts finite WGS84 coordinates within latitude `[-90, 90]` and longitude `[-180, 180]`, including zero. Both values must be supplied together or both cleared to `null`; legacy requests without coordinates remain valid.
- The location picker lazily loads the official [Neshan Leaflet SDK](https://platform.neshan.org/docs/sdk/web/leaflet/neshan-leaflet-sdk) (Leaflet 1.9.4, Neshan SDK 1.0.8). Click the map, drag the pin, or pan with the keyboard and select the center. Browser geolocation is requested only after clicking **Use my current location**. The initial Tehran viewport is not an automatically selected address.
- Create a **Web map** key in the [Neshan panel](https://platform.neshan.org/panel) and restrict it to the allowed website domains. Set `NESHAN_WEB_API_KEY` in the gitignored `site/.env.local` for local development, or `deploy/env/production.env` on the production server. Restart the site after changing it. This is a browser-visible web-map key, not a private server/service key. Without a key, the picker explains the missing configuration and textual addresses can still be saved.
- Orders snapshot the selected address's coordinates at checkout. Later address edits or deletion do not change an existing order's shipping point; order details expose it to authorized administrators in both languages.
- Apply the additive `AddAddressDeliveryCoordinates` EF migration before deploying. It adds four nullable coordinate columns to customer addresses and order shipping snapshots; existing rows are preserved with no invented location.
- Release smoke checks: create an address without a point; edit it via `?id=`, choose a point, save and reopen; move the pin; try opt-in geolocation and denied permission; clear the point and save. Repeat representative screens in `/fa` and `/en` on mobile and desktop. Place an order with a point, then edit/delete the source address and confirm the order retains its original coordinates. A real authorized Neshan key is required to verify street tiles, not just the SDK's coordinate interactions.

## Quality Checks

```bash
dotnet build Vendora.slnx
dotnet test tests/Vendora.IntegrationTests/Vendora.IntegrationTests.csproj --no-restore
(cd admin && npm run lint && npm run build)
(cd site && npm run lint && npm run build)
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
