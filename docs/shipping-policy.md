# Shipping policy and Postex rates

## Retail pricing and rollout

`ShippingPolicy` defaults to **disabled**, revision `1`, with `UnitAmount = 250000` Toman. Reading default settings does not activate or rewrite products. An administrator explicitly saves the policy in the existing **Online Store → Shipping & retail pricing** panel. Each successful save increments the concurrency-controlled revision.

The persisted `Product.Price` remains the base price. Dollar products retain their existing internal exchange-rate conversion and upward rounding; the included shipping amount is added **after** conversion:

```text
selling unit price = base unit price + (included shipping ? per-unit amount : 0)
discountable amount = base unit price × quantity
payable = sum(selling unit price × quantity) − valid server coupon discount + prepaid postal quote
```

For two units with a base price of 1,000,000 Toman, included shipping of 250,000 per unit and a valid 10% coupon, the payable total is **2,300,000 Toman**. Included shipping is never discounted or added to freight again. Repeatedly enabling the policy cannot compound product prices.

Public catalog responses retain `price` as the effective selling price and add `basePrice`, `embeddedShippingUnitAmount`, `shippingPolicyVersion` and `freeShipping`. Price filtering includes the surcharge. Cart synchronization refreshes public prices and tells the customer to review changed totals. The cart's coupon preview and checkout use the same server calculator, including category scope and caps.

## Delivery options

| Policy | Post | Tipax | Freight |
| --- | --- | --- | --- |
| Included | Free, no carrier rate request | Free | Free, only above ten units |
| Disabled | Valid Postex prepaid quote required | Collect on delivery | Collect on delivery, only above ten units |

The threshold is the sum of **all unit quantities**, not the number of product lines. Reducing an eleven-unit basket to ten removes the freight selection. A zero online collect charge must not be described as free shipping.

## Server configuration and measured data

Set `Shipping__Postex__ApiKey` through the deployment's secure environment/configuration provider. No key belongs in frontend variables, source control, the settings response or logs. The admin panel reports only whether a server key exists; successful catalog loading is the separate connectivity check.

Configure these nonsecret fields in the existing store settings panel:

- Origin city selected from the carrier catalog, and actual origin coordinates when required by the chosen handoff method.
- An `IR_POST` service from the carrier list, payment mode `SENDER`, and a supported collection mode: `courier_drop_off`, `postex_drop_off` or `pick_up`.
- Inclusive, non-overlapping quantity ranges for parcel profiles, actual empty package weight in grams, measured dimensions in centimetres and carrier box type.
- Measured unit weight in grams in each existing product create/edit form. Old products have no fabricated weight. Requests from older editors which omit the weight field preserve the stored value.

A postal quote requires a matching profile and valid weights. Shipment weight is the sum of unit weights multiplied by quantities plus the empty package weight. City matching normalizes Persian letter/whitespace variants, includes province, and rejects ambiguous matches. An explicit destination selection must still match the saved address's city and province.

## Provider contract and failure handling

The read-only adapter uses `https://api.postex.ir/api/v1/`, `x-api-key`, and `POST shipping/quotes`. Its reference contract was inspected in the [vendor-published WordPress plugin 1.6.1](https://downloads.wordpress.org/plugin/postex-advanced-shipping-method.1.6.1.zip). Reference requests are allowlisted to cities, methods, boxes and payment methods. The adapter never creates parcels, books shipments, issues labels or accesses a wallet.

Only one configured postal service result is accepted. Service `totalPrice`, separately enumerated mandatory value-added service `price.totalPrice`, and `pickup_price` are added once. Carrier values are **IRR** and are divided by ten into Toman. Missing/malformed/zero quotes fail closed; no old tariff or zero-cost postal fallback exists.

Carrier HTTP requests time out after ten seconds, do not follow redirects, and redact the key header. An in-process bounded single-flight cache shares concurrent identical requests; carrier rates are cached for ten minutes and reference catalogs for one day. Policy revision is part of the rate cache key. Persisted user-owned quotes also expire after ten minutes and bind exact products, quantities, prices/discounts, weights, address contents, destination code and policy revision. Changed inputs require another quote. Cache coalescing is per application process; no distributed cache dependency was added.

## HTTP endpoints

- `GET /api/shipping/policy`: public nonsecret pricing flags/revision; no carrier request.
- `POST /api/shipping/cart-pricing`: public server-priced coupon preview; no address, carrier request or writes. Browser amounts are comparison values only.
- `GET/PUT /api/admin/store-settings/shipping`: Admin-only versioned settings.
- `GET /api/shipping/reference/{cities|methods|boxes|payments}`: authenticated normalized carrier catalogs.
- `POST /api/shipping/quote`: authenticated cart, owned address, method and optional destination code. Returns server totals, cost, payment mode, policy revision and postal quote ID/UTC expiry where applicable.
- Product create/edit accepts optional `weightGrams` plus `weightGramsSpecified`; the narrow Admin-only `PUT /api/admin/products/{id}/shipping-weight` is also available.

Order creation accepts an optional `shippingQuoteId` and validates it locally against the saved quote and current cart/address/policy. **No external call occurs inside the order transaction.** Shipping costs submitted by the browser are not authoritative. Existing payment verification is unchanged.

## Immutable documents

Migration `20261025235010_AddShippingPolicyQuotesAndPriceSnapshots` adds the policy, parcel configuration JSON, product weights, expiring quotes and nullable historical-compatible financial fields. It does not reprice, delete or reconstruct historical data.

New order lines capture base unit price, embedded shipping and exact line discount; orders capture the policy revision and shipping terms. New customer proformas capture the same financial components and policy terms. No-destination postal proformas explicitly keep freight undetermined. Existing invoice creation uses the saved order price/discount/terms, and the existing PDF renderer prints these snapshots, including collect/free/undetermined terms. Changing store settings cannot alter issued documents. Internal procurement costs remain excluded from customer document DTOs/PDFs.

## Validation and operational limits

Automated tests use isolated SQLite databases and synthetic carrier HTTP responses. Browser tests use local API fixtures only. Live Postex connectivity/rate equivalence requires an actual securely configured key, origin, service, measured products and package profiles; fixture tests do not certify a live carrier account.

Validation commands:

```bash
dotnet build Vendora.slnx
dotnet test Vendora.slnx
cd site
npm run lint
npx tsc --noEmit
npm run build
node scripts/check-shipping-policy.cjs
cd ../admin
npm run lint
npm run build
node --test scripts/admin-ui.test.mjs
node scripts/check-admin-ui.mjs
```

The new migration is applied only as part of an authorized deployment/database update. Development validation does not update production data, commit, push or deploy.

### Recorded local validation (2026-10-26)

- Solution build: passed, zero warnings/errors. Full integration suite: **290 passed**. Focused shipping suite after the final assertions: **11 passed**, including malformed carrier-response recovery and explicit ambiguous-city selection.
- Storefront: lint, TypeScript and production build passed. Local browser regression passed at **390 / 768 / 1024 / 1440 px** for free shipping, base-only coupon discount in cart/shipping/payment, quote failure/retry, quote persistence after refresh, collect charges, the 11-to-10 freight threshold change and explicit carrier-city selection. English LTR smoke passed at 1024 px.
- Admin: lint, TypeScript/production build and **5 shared UI tests** passed. Existing routes plus the shipping-settings form were checked at all four widths; the form submitted the configured amount, revision and measured package fields correctly. English routing smoke passed.
- Screenshots and local-only fixture logs are in `artifacts/shipping-ui/` and `artifacts/admin-ui/after/`. These validate rendered behavior; they do not certify live Postex rates or pixel-perfect Penpot equivalence.
