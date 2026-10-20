# Dollar-based product pricing

## Pricing contract

- Existing products retain fixed Toman pricing. `UsdPrice = null` means fixed pricing.
- Admin product create/edit optionally accepts `usdPrice` (positive, up to 1,000,000, at most four decimal places).
- `Price` remains a Toman amount in all existing catalog, cart, admin, and order responses.
- Dollar pricing ignores a submitted Toman amount and uses the persisted internal rate.
- The server computes each unit as `decimal.Ceiling(usdPrice * tomanPerUsdt / 10_000m) * 10_000m`.
- An exact multiple stays unchanged. For example, `3 * 103_500 = 310_500` becomes `320_000` Toman.
- The admin preview is informational; the transaction on the server is authoritative.

## Refresh and load

`ExchangeRateRefreshService` issues one scheduled command every **30 minutes**. The singleton
`UsdtExchangeRates` row persists the rate, provenance, timestamps, and next attempt. An atomic
database claim prevents a restart or multiple application instances from contacting providers
before the next due time. Each attempt makes at most one bounded request per configured source,
in parallel, with an eight-second timeout, bounded response buffering, and no automatic retry.

No storefront visit, catalog read, cart update, order submission, or admin preview calls an
exchange. Rate publication and materialized dollar-product/cart prices share a transaction.
The existing catalog APIs return those stored prices. Browsers share an RTK Query catalog
subscription and refresh internal prices every 30 minutes; normal page queries reuse its cache.

On failure the last successful internal rate and prices remain in effect, with an admin-visible
refresh warning. The scheduler waits for the next 30-minute slot. There is no invented default
rate: dollar products cannot be saved before the first successful rate fetch. Fixed Toman
products continue to work independently.

## Public providers

- Nobitex: `https://apiv2.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls`,
  `stats.usdt-rls.latest`, explicitly divided by 10 because it is in Rial.
  [Official documentation](https://apidocs.nobitex.ir/).
- Wallex: `https://api.wallex.ir/v1/markets`,
  `result.symbols.USDTTMN.stats.lastPrice`, already in Toman.
  [Official documentation](https://developers.wallex.ir/).
- AbanTether: `https://api.abantether.com/api/v1/manager/otc/ticker?coin=USDT`,
  midpoint of `data.markets.USDTIRT.buy_price` and `sell_price`, already in Toman.
  Inactive markets and inverted/nonpositive quotes are rejected.
  [Official documentation](https://docs.abantether.ir/#coin-price).

All three live public response structures were verified in the browser during implementation.
Direct HTTP requests from the development shell timed out; deployment-server outbound
connectivity still needs to be available. No provider requires credentials for these reads.

The median of valid consistent quotes is used. Nonpositive/out-of-range rates are rejected.
Quotes more than 10% from the median are excluded; a conflicting pair cannot publish a rate.
A single available valid source can be used. Rejected/failed sources never become zero rates.

## Customer-visible price freshness

Catalog and detail responses include optional `priceFreshness` metadata only when:

- The product is dollar-priced and has positive stock.
- A successful internal quote is less than 30 minutes old, has a known source,
  has no refresh error, and is not future-dated.
- The product's materialized exchange rate equals that quote and its stored Toman
  price equals the existing upward-rounded dollar conversion.

`verifiedAtUtc` records when the server confirmed that the displayed price is
current. It is intentionally not the product's last manual edit timestamp: even
an unchanged quote can certify today's price. `expiresAtUtc` is the earlier of
the quote's 30-minute expiry and the next Tehran midnight. Neither value is stored
in the database and no additional exchange requests are made.

The shared storefront component shows "آخرین به‌روزرسانی قیمت محصول" on catalog,
wishlist/related cards, and the product purchase panel. Persian dates use the
Persian calendar, Persian digits, and `Asia/Tehran`, based on the server-confirmed
date. Fixed-price, unavailable, failed/stale-rate, and mismatched-price products
do not show it. A local timer and focus/visibility checks remove expired labels;
they do not poll the API. Refreshing or a normal catalog reload obtains a new
confirmation. English routes retain their existing Gregorian date conventions.

`ProductPriceFreshnessTests` covers fresh/fixed/unavailable prices, missing and
failed quotes, exact expiry, future timestamps, mismatched amounts/rates, Tehran
midnight, and catalog/detail consistency. Manual browser checks covered stocked,
unavailable and fixed-price products, Persian/English routes, and 390/768/1024/1440px
layouts, including an item already in the cart. Dates, prices, quantity controls,
and purchase buttons remained inside their cards. This display feature requires
no new package or database migration and adds no API polling.

## Checkout and historical orders

The storefront submits `expectedUnitPrice` for each line. A dollar-priced line with a missing
or changed expected price returns HTTP 409 with `code = PRICE_CHANGED`; no order, stock change,
or cart clear is committed. The UI updates internal prices and asks the customer to review and
confirm again. Dollar price and exchange rate are snapshotted on each `OrderItem` alongside the
Toman `UnitPrice`. Rate refreshes never modify existing orders or payments.

## Deployment and validation

Apply migration `AddDollarProductPricing` through the existing migration/deployment process.
It adds nullable pricing fields and the singleton rate table; no existing prices are converted.
No packages, exchange credentials, or trading access are required. Live provider connectivity
must be verified from the deployed server; automated tests use controlled quote responses and
real SQLite to verify scheduling, failure handling, rounding, and checkout snapshots.
