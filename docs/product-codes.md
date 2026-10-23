# Public product codes

Products have a read-only integer `productCode`, starting at **100**. This is not
the product GUID, URL slug, GTIN, barcode, or a supplier SKU. Existing URLs and
cart/order/wishlist identifiers remain unchanged.

## Allocation and compatibility

- Migration `20261023085737_AddStableNumericProductCodes` assigns existing products
  codes from 100, ordered by creation timestamp then ID. Drafts and archived
  products are included. It preserves their IDs, slugs, content and relations.
- A durable singleton counter reserves batches inside the same database
  transaction as product persistence. Its update takes the database write lock
  before reading the reserved range. No process-local counter or `MAX + 1`
  runtime calculation is used.
- All normal EF `SaveChanges` paths allocate codes, including admin creation,
  imports and catalog seeding. A unique index is the final duplicate safeguard.
- Editing a product cannot change its code. Deleting products does not reset the
  counter, even when the catalog becomes empty. Failed rolled-back insertions do
  not create products or consume a committed reservation.
- Existing create/edit request bodies do not change. Any client-supplied
  `productCode` is ignored; responses add `productCode` to existing product DTOs.
- The admin displays a read-only code (or an auto-assignment hint on creation).
  Product detail/specification UI and Product JSON-LD use the public numeric code
  instead of substituting the slug or GUID.
- Catalog refresh also replaces legacy cart snapshot codes without changing cart
  quantities, order or identifiers.

## Search

The existing paginated catalog search accepts complete ASCII, Persian and
Arabic-Indic codes, for example `100`, `۱۰۰`, and `١٠٠`. Exact code matches rank
before title/slug matches while respecting publication, category, price, stock
and other filters. Admin list/grid share equivalent normalized code matching.
Identifiers and slug resolution are not changed into numeric routes.

## Deployment and checks

Apply the additive EF migration before running the new API. The existing
production pipeline applies pending migrations automatically; creating this
change does not itself deploy it or migrate a real database. Back up the database
as usual. No search service or additional dependency is required.

`ProductCodeTests` exercises real migrated SQLite databases, concurrent contexts,
failed-insert rollback, code immutability/non-reuse, legacy backfill, and HTTP
create/edit/read/search contracts. Run:

```bash
dotnet build Vendora.slnx
dotnet test Vendora.slnx
dotnet ef migrations has-pending-model-changes --project Persistence --startup-project API
```

Run `npm run lint` and `npm run build` in both `admin` and `site` for frontend
contract checks. `node scripts/check-product-codes.cjs` inside `site` verifies
the real mapping, schema, admin search and cart metadata modules with isolated
boundary stubs. No commit, push, or production rollout is implicit.
