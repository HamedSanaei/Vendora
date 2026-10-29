# Store presentation settings

The **Online store** admin page (`/fa/admin/online-store` and `/en/admin/online-store`) contains the store settings form. No new packages are required.

## Defaults and publishing

- Until a setting is explicitly saved, the existing Vendora presentation remains in place.
- Empty text/image fields use the existing default for that location. Optional contact details and eNamad have no fabricated fallback.
- **Default settings** clears only the local form, including selected uploads and eNamad. **Save settings** publishes that reset.
- Failed requests preserve the draft and the previously saved presentation. Successful saves update the admin identity immediately; storefront changes appear on the next page load.
- Name, tagline, introduction, address, support hours and copyright have independent Persian/English values. Contact details and images are shared.
- Store defaults do not reset the site origin, indexing policy, SEO title template, redirects, slideshow or catalog.

## API and persistence

- `GET /api/store-settings`: anonymous public presentation overrides; null fields mean use existing defaults.
- `GET /api/admin/store-settings`: same presentation DTO, protected by `AdminOnly`.
- `PUT /api/admin/store-settings`: `AdminOnly`, multipart form containing `settings` (JSON `{ profile, enamadCode }`), optional `logo`, optional `favicon`.
- Validation errors use HTTP 400 and `{ errors: { fieldName: errorCode } }`. Request/model binding errors retain the framework's existing validation format.
- Logo: JPEG/PNG/WebP; browser icon: PNG; each upload is bounded to 5MB and checked against its declared type and byte signatures.
- The existing `SeoSettings` singleton stores new optional presentation fields in `StoreProfileJson`. The existing `SiteName`, `LogoUrl` and `SocialProfiles` columns remain the only source for shared SEO identity; the legacy SEO API contract remains supported.
- The new migration `AddStorePresentationSettings` adds one nullable column. Normal application startup applies migrations through the existing initializer. Review/apply the migration through the normal deployment process before serving the updated application.
- Existing uploads are retained, since legacy SEO/catalog references may still use them. A failed save removes only files created by that failed attempt.
- Mapping follows the repository's explicit DTO mapping convention: AutoMapper is not installed, and no mapping package is added.

## Trust seal

Store management → Trust seal includes a keyboard-accessible **Show eNamad in the footer** switch. Toggle it, then select **Save settings**. Turning it off retains the official code for later re-enabling, but removes the seal and its image request from new storefront page loads in both locales. Already-open pages require a reload. No repeated image retries or third-party requests are made while disabled.

The server parses the supplied eNamad HTML with the existing AngleSharp parser. It retains only one HTTPS link/image pair on exact supported eNamad hosts and paths. Scripts and embedded executable documents are rejected; other attributes, including event handlers, are not copied. Original HTML is never persisted or rendered. The frontend builds the link/image itself with origin referrer policy, without proxying the provider image. No external validation or account registration is performed by saving the badge.

## Verification

Implementation files added or updated for this feature:

- Backend: `API/Controllers/StoreSettingsController.cs`, `Application/StoreSettings/StoreProfile.cs`, `Application/StoreSettings/StoreSettingsUseCases.cs`, `Application/Interfaces/IEnamadCodeParser.cs`, `Infrastructure/Content/EnamadCodeParser.cs`, `Infrastructure/DependencyInjection.cs`, `Domain/Entities/SeoSettings.cs`.
- Database: `Persistence/AppDbContext.cs`, `Persistence/Migrations/20261021070229_AddStorePresentationSettings.cs`, its `.Designer.cs` file, and `Persistence/Migrations/AppDbContextModelSnapshot.cs`.
- Admin form/runtime: `admin/src/features/admin/components/AdminStoreSettingsForm.tsx`, `AdminStoreSettingsProvider.tsx` in the same folder; `admin/src/features/admin/storeSettings.ts`, `store-settings-model.ts`, `storeSettingsCopy.ts`; `admin/src/features/admin/styles/store-settings.css`.
- Admin integration: `admin/src/app/layout/App.tsx`; `admin/src/features/admin/components/AdminLayout.tsx`; `admin/src/features/admin/pages/AdminOnlineStorePage.tsx`, `AdminAuthShellPage.tsx`, `AdminSeoPage.tsx`.
- Storefront runtime: `site/src/lib/store-settings.ts`, `store-settings.server.ts`, `catalog.server.ts`; `site/src/app/layout.js`, `site/src/app/contact/page.js`.
- Storefront presentation: `site/src/components/vendora/layout/store-settings-provider.tsx`, `store-contact-info.tsx`, `store-chrome.tsx`, `store-footer.tsx`; `site/src/components/vendora/auth/login-card.tsx`; `site/src/components/vendora/home/sections.tsx`, `hero-slideshow.tsx`; `site/src/components/vendora/about/about-page.tsx`; `site/src/components/vendora/account/dashboard-cards.tsx`; `site/src/components/vendora/catalog/catalog-page.tsx`.
- Checks: `tests/Vendora.IntegrationTests/StoreSettingsTests.cs`, the parser registration in the existing `ProductArticleTests.cs` fixture, and `site/scripts/check-store-settings.cjs`.

Other pre-existing working-tree changes are outside this feature and have been preserved.

```bash
dotnet restore
dotnet build --no-restore
dotnet test --no-restore
dotnet ef migrations has-pending-model-changes --project Persistence --startup-project API --no-build
cd admin
npm run lint
npm run build
cd ../site
npm run lint
npm run build
node scripts/check-store-settings.cjs
```

The browser check uses the existing Playwright dependency, an isolated API fixture, the built admin app and a task-owned Next development server. It checks defaults, drafts, save failure, publishing, images, icon, badge and reset in both locales at desktop/mobile widths. Screenshots are written to `artifacts/store-settings`. It does not write to a real store database. Ports 5059, 3016 and 3017 must be available.
