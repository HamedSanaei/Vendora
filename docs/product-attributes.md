# Product attributes

Product specifications follow the global/custom attribute workflow: reusable definitions and terms,
product-local name/value rows, ordered rows and a per-row storefront visibility flag. They are not
SKU variations and do not change price, inventory or cart identity. Existing brand and color selectors
remain their own authoritative shared catalogs.

## Administration

- `/fa/admin/attributes` (and the existing English locale shell) manages global names, slugs and values.
- Use the product create/edit **Product attributes** section to select global values or add a custom row.
- Custom values are separated by `|`; names and values are plain text, never executable HTML.
- Move up/down changes display order. Unchecking visibility keeps a private admin specification.
- Shared values created from the product editor are saved immediately; their product assignment is
  persisted only when the product itself is saved. The editor states this explicitly.
- Global renames are reflected in every assigned product. Archive by clearing the active checkbox;
  this is reversible and does not delete existing assignments. Archived entries cannot be newly assigned.
- An explicit **Refresh list** loads definitions created in another tab without resetting product edits.

## Data and compatibility

An additive EF migration `AddGlobalAndCustomProductAttributes` creates `CatalogAttributes`,
`CatalogAttributeTerms`, `ProductAttributes` and `ProductAttributeValues`; no existing tables/data change.
Apply the normal migration deployment workflow before using the feature. Rollbacks of this migration
would drop the new feature's data and must not be used to revert an installation containing attributes.

All registry endpoints require the existing `AdminOnly` policy:

- `GET /api/admin/attributes`
- `POST /api/admin/attributes`, `PUT /api/admin/attributes/{id}`
- `POST /api/admin/attributes/{id}/terms`, `PUT /api/admin/attributes/{id}/terms/{termId}`

Registry input is `{ name, slug?, isActive }`. Terms are uniquely scoped to one definition. There is
no destructive delete endpoint. The established mediator handlers and shared authenticated Axios
client are used; no new dependencies or parallel transport layers were added.

Product multipart requests accept the optional `attributesJson` field, a JSON array:

```json
[
  { "catalogAttributeId": "<definition-guid>", "termIds": ["<term-guid>"], "isVisible": true },
  { "name": "Dimensions", "values": ["40 × 30 × 12 cm"], "isVisible": true }
]
```

Omitting the field preserves old-client update behavior; `[]` deliberately clears product attributes.
Array order determines display order. Global rows must not send copied names/custom values. All rows
are validated before image/product writes, within the existing transaction. Limits: 30 attributes per
product, 30 values per attribute, 100-character custom names, 500-character custom values. Definitions
have 100-character names and 120-character slugs; terms have 200-character names and 220-character slugs.

Admin detail includes all rows. Public catalog detail resolves names/values and includes **only visible**
rows, even for assigned archived definitions. Catalog lists omit specifications to avoid multiplying
payload sizes. Storefront specifications reuse the existing details tab, including human-readable color
names; they do not copy detail-only attributes into cart/wishlist localStorage snapshots.

The purchase panel and return benefit state the new condition: returns within seven days **if unused**.
This is storefront policy copy; it does not change the separate return-request backend workflow.

## Verification

`ProductAttributeTests` covers round-trip ordering, custom multi-values, public privacy, registry renames,
archival, legacy omission/explicit clearing, ownership spoofing, duplicates, input limits, authorization,
transaction preservation on invalid edits and upgrade of an existing product database. Browser checks
cover the product editor, registry, public specification rows, refresh and RTL/LTR responsive layouts.
