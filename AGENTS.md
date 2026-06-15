# AGENTS.md

## Purpose of this file

These are the operating instructions for Codex when working in this repository. Treat this file as the primary project guide. Follow it before making architectural, backend, frontend, database, payment, or UI decisions.

This project will be built incrementally over multiple sessions. The ecommerce scope below is long-term context, not permission to implement everything at once. Only implement the specific feature or change requested in the current task.

## Project vision

Build a modern, complete, mobile-first ecommerce web application for a specialized bag manufacturer. The business produces and ships bags at low prices and needs a polished online store with a minimal, clean, high-conversion shopping experience.

The product should feel close to the quality and usability level of major ecommerce platforms such as Digikala, but do not copy Digikala branding, proprietary assets, visual identity, text, or layouts exactly. Use it only as a general UX benchmark.

Core long-term capabilities:

- Public storefront with a homepage introducing the bag manufacturing business.
- Product listing, product details, search/filter/sort, product images, pricing, and availability.
- Shopping cart, checkout, order creation, and payment flow.
- Payment gateway integrations for Zarinpal and Bank Melli.
- Customer account features where needed for orders and profile data.
- Admin role with an admin panel for product management, product image upload, product editing, order status management, and user information management.
- Fully usable and optimized mobile experience.
- Bilingual Persian/English experience separated by `/fa` and `/en` URL prefixes, with RTL flow for Persian and LTR flow for English.

## Bilingual website, locale routing, and text direction

The application must support two complete localized versions from the beginning: Persian and English. Locale routing and text direction are core product requirements, not optional UI polish.

Language versions:

- Persian version: all customer-facing and admin UI flows use Persian language, right-to-left direction, and the `/fa` URL prefix.
- English version: all customer-facing and admin UI flows use English language, left-to-right direction, and the `/en` URL prefix.

Routing rules:

- All frontend routes must be locale-prefixed with either `/fa` or `/en`.
- Persian route examples: `/fa`, `/fa/products`, `/fa/cart`, `/fa/checkout`, `/fa/admin`, `/fa/admin/products`.
- English route examples: `/en`, `/en/products`, `/en/cart`, `/en/checkout`, `/en/admin`, `/en/admin/products`.
- The locale prefix is the source of truth for the active language and direction. Do not rely only on browser language, cookies, or local storage to determine the current locale.
- Avoid creating unprefixed public routes for real pages. The root path `/` may only redirect to an approved default locale or show a locale selector if explicitly requested.
- Keep route definitions and route generation centralized so locale handling is consistent across storefront, cart, checkout, payment result pages, authentication pages, profile pages, and admin pages.
- Do not duplicate business logic for each language. Locale differences should be handled through routing, translations, formatting utilities, metadata, and direction-aware layout primitives.

Direction and layout rules:

- Persian pages must render with `lang="fa"` and `dir="rtl"` on the page/layout root or app container.
- English pages must render with `lang="en"` and `dir="ltr"` on the page/layout root or app container.
- Persian UI must feel fully right-to-left across navigation, menus, breadcrumbs, product cards, forms, cart, checkout, profile pages, payment result pages, tables, dashboards, and admin screens.
- English UI must feel fully left-to-right across the same flows.
- Prefer CSS logical properties and direction-safe utilities such as start/end, inline-start/inline-end, `text-start`, and `text-end` when available. Avoid hard-coded physical layout assumptions such as `left`, `right`, `ml-*`, and `mr-*` when the value should flip between RTL and LTR.
- Directional icons and controls must adapt correctly for both directions, including arrows, chevrons, back/next buttons, breadcrumbs, pagination, carousel controls, drawers, steppers, and checkout step indicators.

Localization rules:

- Keep user-visible text localizable. Do not hard-code Persian or English UI copy directly inside reusable components when it belongs to a translatable flow.
- Keep translations centralized once an i18n structure exists, and avoid scattering repeated strings across many components.
- Use Persian copy for `/fa` and English copy for `/en`; do not mix languages in the same UI surface unless intentional, such as brand names, technical labels, payment provider names, SKUs, codes, or gateway reference numbers.
- Forms must keep labels, placeholders, validation messages, helper text, error summaries, and success messages localized and direction-aware.
- Format prices, dates, numbers, phone numbers, addresses, and currency labels through shared locale-aware utilities.
- Payment initiation, callback routes, success pages, failure pages, and order result pages must preserve the active `/fa` or `/en` prefix so customers return to the correct language and direction after payment.

Backend and content rules:

- Backend APIs should remain language-neutral where possible. Store stable data, statuses, enum values, payment states, and business records independent of display language, and let the frontend/localization layer render user-facing labels in Persian or English.
- Pass locale to the backend only when localized content, localized validation messages, localized metadata, or explicit language-specific behavior is required.
- Product/catalog content may eventually need Persian and English fields. Do not change the database schema for bilingual content without an explicit EF migration and user approval when the change is significant.
- Where SEO is relevant, prepare pages so canonical links, alternate locale links, titles, descriptions, and Open Graph metadata can distinguish the Persian and English versions cleanly.

Testing expectation:

- After routing, layout, checkout, payment result, form, or admin UI changes, verify representative screens in both `/fa` and `/en` so RTL and LTR flows remain correct.

## Primary technology stack

Backend:

- ASP.NET Core Web API targeting .NET 10.
- Entity Framework Core as the ORM. This is mandatory.
- SQLite as the initial database provider.
- EF Core must be configured through dependency injection so the database provider can be changed later with minimal impact.
- Clean, domain-centric architecture inspired by the Reactivities repository structure.

Frontend:

- React with TypeScript.
- Tailwind CSS for styling.
- Frontend is a separate project that consumes the ASP.NET Core Web API.
- Mobile-first responsive UI.

## Expected repository structure

Use a structure aligned with the Reactivities clean architecture style:

```text
/
  API/
    Controllers/
    DTOs/
    Middleware/
    Properties/
    Program.cs
    appsettings*.json

  Application/
    Core/
    Interfaces/
    <FeatureName>/
      Commands/
      Queries/
      DTOs/
      Validators/

  Domain/
    Entities and domain models
    Value objects
    Enums
    Domain rules

  Infrastructure/
    External service adapters
    Payment gateway implementations
    File/image storage adapters
    Email/SMS adapters if needed

  Persistence/
    AppDbContext.cs
    DbInitializer.cs
    Migrations/
    Entity configurations if needed

  client/
    src/
      app/
      features/
      lib/
      main.tsx
    package.json
    vite.config.ts if Vite is used
```

If the actual repository already contains a different structure, inspect it first and preserve the established structure unless the user explicitly approves changing it.

## Architecture principles

The required architecture is clean, domain-centric, and layered. Follow the dependency rule: inner layers must not depend on outer layers.

### Domain layer

- Contains enterprise/domain business rules.
- Must remain the cleanest and most stable layer.
- Contains entities, value objects, enums, and domain-level behavior.
- Must not depend on ASP.NET Core, EF Core provider details, HTTP, React, DTOs, UI models, payment SDKs, or infrastructure services.
- Prefer meaningful domain models over anemic data containers when business rules exist.
- Use explicit enums or value objects for concepts such as order status, payment status, payment provider, and inventory status. Avoid magic strings.

### Application layer

- Contains application use cases and orchestration.
- Use feature-oriented folders such as Products, Orders, Cart, Payments, Users, and Admin.
- Prefer command/query style handlers for use cases when the project has or approves MediatR or a similar pattern.
- Contains DTOs, validators, use-case-specific models, and interfaces/ports for external services.
- Controllers must delegate business work to this layer.
- Do not place UI concerns, HTTP response formatting, database provider configuration, or concrete payment gateway calls here.

### Persistence layer

- Contains EF Core DbContext, migrations, database configuration, seed data, and EF-specific mapping.
- SQLite is the initial provider, but code should avoid unnecessary SQLite-specific assumptions.
- Use `DbContextOptions` and dependency injection.
- Use Fluent API for non-trivial mappings.
- Keep database schema changes in EF migrations.
- Do not change schema without creating a migration.
- Do not create destructive migrations, drop tables, or delete columns without explicit user approval.

### Infrastructure layer

- Contains concrete adapters for external systems.
- Payment gateway implementations for Zarinpal and Bank Melli belong here.
- Email, SMS, image storage, and other third-party services belong here.
- Implement interfaces defined in Application.
- Never place domain business rules in Infrastructure.

### API layer

- ASP.NET Core Web API composition root.
- Contains controllers, middleware, authentication/authorization configuration, DI registration, CORS, filters, and request/response handling.
- Controllers must be thin.
- Do not put business rules or EF query-heavy logic directly in controllers.
- Use proper HTTP status codes and structured error responses.
- Protect all admin endpoints with role-based authorization.

### Client layer

- React TypeScript app is separate from the API.
- Consume API through typed client functions/hooks.
- Keep API access in `client/src/lib` or the existing equivalent.
- Keep feature UI in `client/src/features/<featureName>`.
- Keep app-level routing, providers, layout, and global configuration in `client/src/app`.
- Implement locale-aware frontend routing so Persian pages are under `/fa` and English pages are under `/en`.

## Non-negotiable working rules for Codex

Before changing files:

1. Inspect the repository tree.
2. Read the relevant existing files.
3. Identify the current patterns and follow them.
4. Check available scripts and commands before inventing new ones.
5. Make a small plan for the requested change.

While changing files:

- Make small, incremental, focused changes.
- Do not implement unrelated features.
- Do not rewrite the whole project or a whole module unless explicitly asked.
- Do not change the architecture unless explicitly asked.
- Do not delete files unless explicitly asked or clearly safe, and explain why.
- Do not add dependencies without explicit permission.
- Do not rename public APIs, routes, DTOs, entities, or database fields without explaining the impact.
- Do not change database schema without an EF migration.
- Do not hard-code secrets, API keys, payment credentials, callback URLs, or admin credentials.
- Do not commit changes with git unless explicitly asked.

After changing files:

- Summarize what changed.
- List the files changed.
- List tests/checks run and their results.
- If tests could not be run, explain exactly why.
- Mention any risks, assumptions, or follow-up work.

## Backend coding standards

Use standard C# and .NET conventions:

- PascalCase for public types, methods, properties, records, and enums.
- camelCase for local variables and parameters.
- `_camelCase` for private fields when fields are necessary.
- Async methods should end with `Async` unless overriding framework signatures.
- Use nullable reference types correctly.
- Prefer file-scoped namespaces where consistent with the project.
- Prefer constructor injection and dependency injection.
- Use `CancellationToken` for async operations where appropriate.
- Use `decimal` for money. Never use `float` or `double` for prices, totals, discounts, or payment amounts.
- Store and compare dates consistently. Prefer UTC in the backend and localize in the UI.
- Validate input at the boundary and again at use-case level when business rules require it.

Documentation and comments:

- Add XML documentation comments for public classes, public methods, DTOs, important handlers, and non-trivial services when they are introduced.
- Every new function/method should have a concise comment explaining its purpose, important parameters, return value, and side effects when relevant.
- Do not add noisy comments that merely repeat the code.

Entity Framework Core rules:

- EF Core is mandatory as the ORM.
- Use EF Core LINQ queries instead of raw SQL unless there is a strong reason.
- Avoid provider-specific SQL so SQLite can later be replaced.
- Use `AsNoTracking()` for read-only queries where tracking is unnecessary.
- Project to DTOs for API responses. Do not expose EF entities directly when returning public API responses.
- Avoid N+1 queries. Use projection, `Include`, or explicit loading intentionally.
- Add indexes for frequently queried fields when justified.
- Keep migrations descriptive and review generated migrations before accepting them.

Recommended EF commands when schema changes are needed:

```bash
dotnet ef migrations add <DescriptiveMigrationName> --project Persistence --startup-project API
dotnet ef database update --project Persistence --startup-project API
```

Use the actual solution/project names if they differ.

API standards:

- Use RESTful route naming where practical.
- Prefer route groups or controllers consistent with the existing API style.
- Use DTOs for create/update/read operations.
- Return appropriate status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, and 500 when appropriate.
- Do not leak internal exceptions to clients.
- Use structured validation errors.
- Keep admin-only actions protected by authorization policies or roles.

## Frontend coding standards

Use React with TypeScript only:

- All React components must be typed.
- Use `.tsx` for components and pages.
- Use `.ts` for utilities, models, schemas, API clients, and hooks without JSX.
- Prefer function components.
- Define explicit prop types such as `ProductCardProps`.
- Avoid `any`. Use `unknown` with narrowing when needed.
- Keep components small and focused.
- Extract reusable UI pieces when duplication becomes clear.
- Do not introduce global state unless local state, URL state, or server cache is insufficient.

Documentation and comments:

- Add JSDoc comments for exported components, hooks, API client functions, and non-trivial utilities.
- Every new function should explain purpose, parameters, return value, and important side effects.
- Comment business decisions and edge cases, not obvious JSX.

Tailwind and UI rules:

- Use Tailwind CSS for styling.
- Prefer mobile-first classes and progressive breakpoints.
- Avoid inline styles unless the value is truly dynamic.
- Keep spacing, radius, typography, and colors consistent.
- Use semantic HTML elements.
- Ensure keyboard accessibility, visible focus states, labels, alt text, and proper button/link semantics.
- Optimize images for product cards and detail pages.
- Keep layout usable on small mobile screens.

Brand color direction:

- Primary color: dark jade green.
- Supporting colors: white, black, and subtle neutral surfaces.
- Suggested palette when configuring Tailwind:

```text
jade.DEFAULT: #006B4F
jade.light:   #00A86B
jade.dark:    #004D3A
ink.DEFAULT:  #0B0B0B
surface:      #FFFFFF
surfaceSoft:  #F6FAF8
borderSoft:   #E5E7EB
```

Use the darker jade for primary buttons and important contrast-sensitive UI. Do not scatter random greens across the codebase.

Ecommerce UX direction:

- Minimal, clean, premium, and trustworthy.
- Strong mobile usability.
- Clear product cards with image, title, price, availability, and add-to-cart action when appropriate.
- Clear cart and checkout steps.
- Visible order/payment state.
- Admin screens should prioritize clarity, fast editing, and error prevention.

Bilingual UI implementation reminders:

- Follow the dedicated `Bilingual website, locale routing, and text direction` section before changing routing, layouts, copy, formatting, checkout, payment result pages, authentication pages, or admin pages.
- After layout changes, verify representative screens in both `/fa` and `/en` so RTL and LTR flows remain correct.
- Keep currency unit naming explicit and consistent across backend and frontend.
- Keep stable backend statuses/enums independent of display language; render localized labels in the frontend/localization layer unless the requested feature explicitly needs localized API responses.

## Testing and quality rules

Always use the existing test framework and scripts if present.

Backend checks:

```bash
dotnet restore
dotnet build
dotnet test
```

Frontend checks:

```bash
cd client
npm install
npm run lint
npm run build
npm test
```

Use the actual scripts from `client/package.json`. If `npm test` or a frontend test setup does not exist, do not silently add new packages. Explain the gap and ask before adding Vitest, React Testing Library, Playwright, or other test dependencies.

Testing expectations:

- After writing or changing a React component, add or update the relevant test when a test setup exists.
- After writing or changing backend use cases, add or update unit tests when a test setup exists.
- For database changes, verify migrations and run build/tests.
- For payment flows, include tests or at least documented test cases for initiation, callback verification, failed payment, duplicate callback, and order status updates.
- For admin actions, include authorization and validation test coverage when possible.

If the repository has no test projects yet:

- Run build and lint checks that exist.
- Propose the smallest test setup before adding dependencies or new test projects.
- Do not add test packages without approval.

## Ecommerce domain guidelines

Model the ecommerce domain deliberately. Prefer clear, explicit domain concepts.

Likely core concepts:

- Product
- ProductImage
- Category
- Inventory or Stock
- Cart
- CartItem
- Order
- OrderItem
- Customer/User
- Payment
- PaymentTransaction
- PaymentProvider
- OrderStatus
- PaymentStatus

Important rules:

- Keep product prices and order totals consistent and auditable.
- Persist the price used at checkout on `OrderItem`; do not rely only on the current product price after the order is created.
- Do not mark an order as paid until server-side payment verification succeeds.
- Avoid magic strings for statuses. Use enums or value objects.
- Admin-only state transitions must be validated. Example: not every order can move directly from pending payment to delivered.
- Keep inventory logic explicit. Do not silently oversell unless that is an intentional business rule approved by the user.
- Keep customer-visible order status separate from internal payment gateway status when needed.

## Payment gateway rules

Payment integrations are high-risk. Be conservative and explicit.

General payment flow:

1. Create an order in a pending payment state.
2. Create a payment transaction record.
3. Initiate payment with the selected gateway.
4. Redirect the customer to the gateway.
5. Receive callback from the gateway.
6. Verify payment server-side with the gateway.
7. Update payment transaction and order status atomically.
8. Handle duplicate callbacks idempotently.
9. Show the final result to the customer.

Rules:

- Never trust query string callback data without server-side verification.
- Never mark an order as paid before verification.
- Never store card numbers, CVV, or sensitive card data.
- Store only safe gateway references such as authority, reference id, trace id, transaction id, and status when appropriate.
- Keep gateway credentials in environment variables, user secrets, or secure configuration providers. Never commit them.
- Use an Application interface such as `IPaymentGateway` or `IPaymentService` and implement concrete gateways in Infrastructure.
- Keep Zarinpal and Bank Melli implementations isolated from domain models.
- Make callbacks idempotent so repeated gateway calls do not duplicate state transitions.
- Log payment failures safely without leaking secrets.

## Admin panel rules

Admin functionality must be secure and explicit.

Admin capabilities may include:

- Create product.
- Edit product.
- Upload/manage product images.
- View product list.
- View order list.
- View order details.
- Change order status.
- View/edit user information where authorized.

Rules:

- Protect all admin API endpoints.
- Do not rely only on frontend route hiding for authorization.
- Validate uploaded images: file type, size, extension, and storage path.
- Prevent path traversal and unsafe filenames.
- Keep admin forms strongly typed.
- Confirm or clearly communicate destructive actions.
- Avoid deleting business records if soft-delete or status-based deactivation is more appropriate.

## Security baseline

- Never commit secrets.
- Use HTTPS-oriented assumptions for payment callback URLs and authentication flows.
- Validate all API inputs.
- Protect admin endpoints with role-based authorization.
- Use safe file upload handling.
- Do not expose stack traces or internal exception details in production responses.
- Avoid overly permissive CORS.
- Use parameterized EF Core queries and avoid string-concatenated SQL.
- Treat all client-provided prices, totals, order statuses, user ids, and role flags as untrusted.
- Calculate authoritative totals on the server.
- Do not let customers set payment status, order status, or product price from the client.

## Performance and maintainability

Backend:

- Use pagination for product and order lists.
- Project queries to DTOs for list endpoints.
- Avoid loading large object graphs unnecessarily.
- Add indexes for search, filtering, and admin list operations when justified.
- Keep handlers/services small and focused.

Frontend:

- Use lazy loading or route-level splitting when appropriate.
- Avoid unnecessary rerenders in large product lists.
- Use stable keys and memoization only when it solves a real problem.
- Optimize product images and avoid layout shift.
- Keep bundle size in mind before adding dependencies.

Maintainability:

- Prefer clear, boring code over clever abstractions.
- Do not create generic repositories or abstractions unless they solve a real project need.
- Keep feature boundaries clear.
- Refactor only what is needed for the requested task.
- Avoid speculative features.

## Dependency policy

Do not add new NuGet or npm packages without explicit user approval.

If a dependency seems necessary, first provide:

- Package name.
- Why it is needed.
- Alternatives using existing code/packages.
- Security or maintenance considerations.
- Files that would change.

Then wait for approval before adding it.

## Database and migration policy

- Any entity model change that affects the database requires an EF migration.
- Migration names must be descriptive.
- Review generated migrations before accepting them.
- Do not drop data, drop columns, rename columns, or change relationships destructively without approval.
- Seed data should be safe, minimal, and environment-aware.
- Do not store production-like secrets or real user data in seed files.

## Feature implementation workflow

For a backend feature:

1. Inspect existing Domain, Application, Persistence, API patterns.
2. Add or update Domain model only if the use case requires it.
3. Add Application use case, DTOs, validators, and interfaces as needed.
4. Add Persistence mapping/migration if schema changes are required.
5. Add or update API endpoint/controller.
6. Add or update tests if a test setup exists.
7. Run build/tests.
8. Summarize changes and next steps.

For a frontend feature:

1. Inspect `client/package.json`, `client/src/app`, `client/src/features`, and `client/src/lib`.
2. Add typed models/API client calls first when needed.
3. Add hooks or state only when needed.
4. Add mobile-first UI components/pages using Tailwind.
5. Add or update tests if a test setup exists.
6. Run lint/build/tests.
7. Summarize changes and next steps.

For an end-to-end feature:

1. Define API contract first.
2. Implement backend use case and endpoint.
3. Implement frontend typed client integration.
4. Implement UI.
5. Add validation and error handling on both sides.
6. Run both backend and frontend checks.

## Communication style

- Match the user's language in explanations unless the user asks otherwise.
- Keep code, comments, and this repository's technical documentation in English unless the user explicitly asks for Persian code comments.
- Be direct about uncertainty, missing files, missing scripts, or tests that cannot be run.
- Do not claim a change is complete unless the relevant checks pass or the limitation is clearly stated.
- When asking questions, ask only what is necessary to continue safely.

## Persian / RTL response formatting

When responding in Persian or mixed Persian-English text:

1. Prefer Persian prose, but keep all code, commands, filenames, package names, URLs, variables, and English identifiers inside backticks.
2. Use Markdown structure: headings, bullet points, and fenced code blocks.
3. Never put Persian explanation and long code/commands on the same line.
4. For terminal commands, always use fenced code blocks with `bash`.
5. For code, always use fenced code blocks with the correct language.
6. Keep English technical terms isolated with backticks, for example: `React`, `useEffect`, `package.json`, `npm install`.
7. Avoid inline tables for Persian text.
8. If a response contains both Persian and English, write each item as:
   - Persian explanation first
   - English/code token separately in backticks
9. Do not output raw mixed RTL/LTR paragraphs when code, paths, URLs, or commands are involved.

## Final response format after each task

Use this structure after making changes:

```text
Summary
- What changed and why.

Changed files
- path/to/file: brief description.

Checks run
- command: result.

Notes / risks
- Any assumptions, limitations, or recommended next step.
```

## Hard stop conditions

Stop and ask for approval before proceeding if a task requires:

- Adding a NuGet or npm dependency.
- Changing the overall architecture.
- Rewriting a large module.
- Deleting files or business data.
- Creating destructive migrations.
- Changing authentication or authorization behavior broadly.
- Changing payment flow assumptions.
- Changing public API contracts used by the frontend.
- Storing or handling sensitive secrets.
