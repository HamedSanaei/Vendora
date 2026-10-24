# Seed data visibility

## Operator control

The existing admin Online Store page (`/fa/admin/online-store`, also compatible with `/en`) contains a persisted sample-data switch. It controls presentation in both admin and storefront. Existing records are visible by default; hiding them is reversible and does not delete data, change stock, remove customer carts, reset accounts or modify posted accounting records.

- Public read: `GET /api/store-settings/seed-visibility`.
- Admin-only explicit write: `PUT /api/admin/store-settings/seed-visibility`, body `{ "showSeedData": false }` (or `true`). An omitted Boolean is rejected.
- The existing public store profile includes the computed `showSeedData` value. Saving branding or SEO settings cannot overwrite this policy.
- Storefront checks the small setting when returning focus to the tab, refreshing its existing queries when changed. There is no polling or per-product request.

## Provenance and migration

`20261024082947_AddSeedDataVisibility` adds `SeoSettings.HideSeedData` and a `SeedRecords` registry keyed by entity type and ID. Normal seed insertion records provenance transactionally. Renaming a seeded product does not change its identity. Pre-existing manually created records are not automatically marked by subsequent seed runs.

The migration contains a frozen, conservative backfill of known reserved sample product slugs and aliases, exact legacy category/brand/color/coupon fingerprints, reserved sample identities, orders and test payment references. Arbitrary names starting with `seed-` are not sufficient. Historical sample rows whose original identifiers and distinguishing fingerprints were completely removed may not be identifiable; this feature does not guess or delete them.

Apply the additive migration through the normal deployment migration workflow before running this code. Development verification applies it only to isolated test databases; no production migration was executed for this task.

## Filtering boundaries

Explicit presentation query filters cover catalog search/detail, navigation, public alias resolution and sitemap, admin catalog/customer/order lists and dashboard counts. Inventory product lists also respect visibility. Cart quotation rejects a hidden sample product, while preserving its underlying record.

Real child categories whose parent is a hidden sample are promoted to display roots on detached read models. Stored relationships are unchanged. Inactive real ancestors continue to suppress their public branches.

Authentication, uniqueness checks, category cycle validation, raw inventory, financial balances and immutable historical order/invoice snapshots are deliberately not globally filtered. Sample hiding is a presentation policy, not an authorization boundary or accounting deletion operation.

Existing demo-only account orders, returns, loyalty information, wallet transactions and recommendations respect the same setting. The legacy quick-pay demo form/result is replaced with an explicit unavailable state when samples are hidden; it cannot display a fabricated successful payment. Disabling demos does not introduce a new real account-order integration. Real Redux wishlist/cart contents remain intact. Unsupported legacy mock API fallbacks are disabled when samples are hidden or the policy cannot be read.

## Verification

- Backend build through `dotnet test Vendora.slnx --no-restore`: 262 passed, zero failed, including seven seed-visibility tests (authorization, validation, migration backfill, reversibility, branding isolation, provenance, stock preservation, hidden cart quotation and category hierarchy).
- Admin and storefront lint/build passed, including TypeScript compilation.
- EF model check reported no pending model changes.
- Browser QA uses an isolated synthetic SQLite database: 46 sample products plus one manual real product. Hiding samples leaves only the real product in both admin and storefront; showing them restores all 47 without recreation. Reload preserves the setting.
- The switch was inspected at 390, 768, 1024 and 1440 pixels, with no horizontal overflow and a 44-pixel minimum button height. The English admin route was smoke-tested in LTR. Screenshots are stored under ignored `artifacts/seed-visibility-qa/`.

No production data, commits, pushes or deployments were performed.
