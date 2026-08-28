# Vendora

Vendora is a clean-architecture ecommerce solution for a specialized bag manufacturer. The repository contains an ASP.NET Core Web API, a React admin panel, and a mock-first Next.js storefront.

## Projects

- `API`: ASP.NET Core Web API composition root with Swagger in development.
- `Domain`: ecommerce entities, enums, value objects, and domain rules.
- `Application`: CQRS use cases powered by MediatR.
- `Persistence`: EF Core SQLite DbContext, migrations, repositories, and seed data.
- `Infrastructure`: adapters for external details such as local product image storage.
- `admin`: Vite + React admin panel using MobX and Axios.
- `site`: Next.js storefront rebuilt from the Harri template with mock data.

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

The storefront is currently mock-only and does not call the ASP.NET Core API. Mock data is copied from the template backend seed files into `site/src/data/template`.

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
