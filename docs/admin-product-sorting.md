# Admin product sorting

The existing product list and grid share a sort control and URL `sort` parameter. Options are newest/oldest creation, latest edit, low/high price, low/high stock and alphabetical name. Newest creation is the default. Sorting applies to the filtered dataset **before** pagination, preserves the existing exact product-code match priority, resets the page on change and survives refresh and view switching. Existing category/status/search query parameters are retained.

The additive admin DTO fields `createdAtUtc` and `updatedAtUtc` come from existing product audit columns, with explicit UTC serialization. No database migration or timestamp rewriting occurs. Latest edit falls back to actual creation for never-edited products. Missing/invalid timestamps remain last for date sorting; ties use descending product code and then stable ID. Name comparison uses the active locale with natural numeric comparison. The store array is never sorted in place.

Validation uses `AdminProductDatesTests`, `admin/scripts/product-sort.test.mjs` and `admin/scripts/check-product-sorting.mjs` (real compiled UI, synthetic/local API fixtures at 390/768/1024/1440 and English compatibility). No new dependencies or new routes are introduced.
