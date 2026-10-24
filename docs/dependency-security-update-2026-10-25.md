# Dependency security update — 2026-10-25

## Scope and security result

Updated the real `site`, `admin`, API, Application, Persistence and integration-test projects. Existing uncommitted login typography work is preserved. No production configuration, database, migrations, payment behavior, push or deployment was changed.

Public npm and NuGet registries were inspected for stable releases. Direct dependencies were moved to their latest stable releases where the dependency graph supports them; transitive dependencies were refreshed within their supported ranges. No `--force`, `--legacy-peer-deps`, advisory suppression or audit exclusion was used.

- Storefront `npm audit`: **66 findings before** (7 critical, 37 high, 13 moderate, 9 low), **0 after**, including development dependencies.
- Admin `npm audit`: **16 findings before** (12 high, 4 moderate), **0 after**, including development dependencies.
- NuGet audit with transitive packages: **no reported vulnerable packages** after the update.
- NuGet outdated report: **no outdated direct packages** in the solution.
- These results describe the registries' known dependency advisories at the time of testing, not a guarantee that the entire application is vulnerability-free.

## Main upgrades and compatibility work

- Next.js, `@next/env` and `eslint-config-next`: **16.2.9 → 16.4.3**, pinned together.
- React and React DOM: **19.2.7 → 19.3.1** in both frontends.
- Swiper: **8 → 14.3.0**; migrated existing module imports to `swiper/modules`.
- React Toastify: **10 → 11.1.0** in the storefront; removed the deleted `bodyClassName` option and body-wrapper CSS, retaining the existing cart toast component, actions and layout.
- Admin Tailwind: **3 → 4.3.3**, using its dedicated PostCSS adapter. The existing JavaScript design-token configuration is explicitly loaded. Prior border, placeholder and focus-ring defaults are retained. Existing page layouts and Vazirmatn assets remain in use.
- Admin MobX/React bindings: **7.1.1 / 5.1.0**; Vite **8.3.5**, Babel **8.0.9**, Axios **1.20.0**, MUI **9.5.0** and other supported direct dependencies updated.
- Storefront form, schema, tooltip, timer, slider, printing, Stripe SDK and other dependencies upgraded. The Stripe/provider upgrade does not introduce a new payment flow or change verification rules.
- Removed `react-modal-video`: its previous version carried vulnerable tooling dependencies and its newest release still declares React 17/18 peer support. The existing legacy import delegates to a typed video dialog using the already installed React Bootstrap modal; close/Escape/focus management comes from that shared library and the iframe unmounts on close. No replacement package was added.
- ASP.NET Core / EF Core packages aligned on **10.0.13**, including Application's previously older JWT bearer reference. MediatR **14.2.0**, IdentityModel JWT **8.23.0**, Swashbuckle **10.3.1**, test SDK **18.11.0**, xUnit runner **4.0.1** and coverlet **10.1.0** updated. Already-current Google Auth, HtmlSanitizer, QuestPDF and xUnit packages retained.
- Admin Docker runtime moved from the obsolete `nginx:1.27-alpine` line to `nginx:stable-alpine`. The tested image resolved to **1.30.6**. Node 24 LTS and .NET 10 runtime lines remain intact; Docker builds pull current images.

## Explicit compatibility exceptions

The final `npm outdated` reports contain only these deliberate constraints:

- **TypeScript 6.0.3** in both apps: the latest installed `typescript-eslint` tooling explicitly supports TypeScript `<6.1`; 7.0.2 is not installed by overriding that constraint.
- **`@types/node` 24.19.2**: latest Node 24 type definitions, matching the production Node 24 LTS runtime instead of advertising Node 26-only APIs.
- **Storefront ESLint 9.39.5**: the React and accessibility plugins shipped by the latest Next ESLint config still declare ESLint 9 peer support. Admin uses ESLint 10.13.0. ESLint 9 is upstream end-of-support; track Next's plugin compatibility before moving the storefront to ESLint 10. The current audit reports no vulnerability for the retained release.
- **`@hookform/resolvers` 5.9.2**: attempting 6.0.0 produced an `ERESOLVE` conflict between its optional Effect 4 peer and the Effect 3 adapter pulled through its optional typeschema peer. The installed 5.x release supports the current React Hook Form and Yup versions and has no reported advisory. No peer constraint was forcibly bypassed.

## Validation actually performed

- `dotnet restore Vendora.slnx`: passed.
- `dotnet build Vendora.slnx --no-restore`: passed, 0 errors and 0 warnings.
- `dotnet test Vendora.slnx --no-build --no-restore`: **279 passed**, 0 failed/skipped.
- `npm run lint` and `npm run build` in **both** `site` and `admin`: passed, including TypeScript checking during builds.
- `npm ls --all --json` in both apps: passed, without invalid dependency trees.
- Both npm audits and transitive NuGet vulnerability/outdated checks: passed as reported above.
- Existing shared API URL tests: **4 passed**.
- Existing Google UI regression: passed for Persian and English, at **320, 390, 768, 1024 and 1440**. Uses isolated credential/API fixtures; does not log in to a personal Google account.
- Existing store-settings browser regression: passed for Persian and English at **390 and 1440**, exercising MobX state, settings forms, validation failures, branding, drafts, save and reset using an isolated API fixture.
- Linux-container browser smoke: cart removal, removal toast, Undo, restored quantity persistence and absence of page JavaScript errors passed in both locales at **390, 768, 1024 and 1440**. Screenshots captured locally.
- Production Dockerfiles built with `--pull`, normal clean **`npm ci`**, and production builds for both frontends. No production secret was copied into the images.
- Linux standalone runtime: **Next 16.4.3, React 19.3.1, Node 24.22.1, sharp 0.35.5, libvips 8.18.7**. A real sharp PNG resize completed successfully inside the image.
- Both task-owned frontend containers reached **healthy**. HTTP 200 verified for storefront `/fa`, `/fa/login`, `/fa/cart`, `/en/login` and admin `/healthz`, `/fa/admin/dashboard`. Storefront SSR used an isolated public-read API sidecar; this does not claim a live production API or payment test. An unreachable API still produces the existing error response, rather than fake catalog data.
- `git diff --check`: passed.

Local logs, registry inventories and screenshots are under ignored `artifacts/dependency-upgrade/`; store-settings screenshots are under `artifacts/store-settings/`. Task-owned test containers/network are removed after validation. Local build images can remain as build cache.

## Remaining limitations

- Next builds report two Sass `@import` deprecation warnings in the existing legacy stylesheet. Migrating the entire legacy stylesheet to Sass modules is outside a dependency security patch; these are not audit findings or build failures.
- Admin retains the existing large-bundle advisory.
- Full production OAuth, SMS and real payment-provider flows were not exercised. No real SMS, order, payment or customer data was created.
- npm/NuGet audits do not scan OS-image CVEs. Updated base images were pulled and executed, but no OS-level scanner result is claimed.
- The live website receives these fixes only after a separately authorized push and deployment/rebuild. A local commit alone does not patch production.

## Official references

- [Next.js October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
- [Tailwind v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide)
- [Swiper React module imports](https://swiperjs.com/react)
- [React Toastify v11 migration](https://fkhadra.github.io/react-toastify/migration-v11/)
