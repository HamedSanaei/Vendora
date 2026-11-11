# TabaPay payment gateway

Vendora uses the [TabaPay v1 API](https://tabapay.ir/docs/api). It converts the saved order total from toman to whole rials, enforces the provider's 100,000–500,000,000 rial range, and sends only the amount and callback address at creation. Checkout only advertises the implemented gateway. Pending orders can be resumed from the order page or order history.

## Configuration

Use ASP.NET user secrets in development and the protected server environment file in production. Never put the merchant in a tracked file, a browser variable, or a URL.

| Configuration key | Purpose |
| --- | --- |
| `Payments:TabaPay:Merchant` | Merchant UUID sent in the provider Authorization header |
| `Payments:TabaPay:Sandbox` | Use the sandbox endpoints. Sandbox is available only in Development |
| `Payments:TabaPay:CallbackOrigin` | Trusted public API origin registered for this merchant |
| `Payments:TabaPay:StorefrontOrigin` | Origin for the localized customer order result |

For Docker, replace the colons with double underscores, as shown in `deploy/env/production.env.example`. Deploy the API and storefront together so availability, initiation and callbacks use the same release. The production environment file is consumed when the API container is recreated.

TabaPay checks the callback domain even for sandbox requests. Error `-27` requires the exact approved domain for the merchant. Use an approved HTTPS endpoint that routes the callback to the same API instance and database that created the attempt. A provider POST cannot reach a loopback-only API. Run sandbox payments with a separate development database and test SMS settings.

## Verification and recovery

- Browser return uses GET with the saved attempt ID and provider token. The server ignores browser-supplied amount and status, calls verify with the stored gross amount, and requires matching token, gross amount and Shaparak reference. The net settlement amount is not the order total.
- Provider notifications use POST to the same callback URL. TabaPay's `HTTP_AUTHORIZE` is the PHP name for the `Authorize` header. Vendora compares its documented merchant digest in constant time, checks the payment evidence against the stored attempt, and acknowledges only after the evidence is durable. The audit digest uses SHA-256 and carries no card data.
- A pending claim prevents parallel initiation. A successfully created token is reused for retries until a verified rejection or expiration. A failed or incomplete callback can be checked again by the signed-in order owner.
- A verified payment is recorded once. With accounting active, the existing posting path issues the receipt and invoice and consumes the reservation. The accounting worker can retry posting if a verified payment outlives the request. Before cutover, order creation already deducts stock, so verified payment changes the order state without another stock movement. Historical receipt posting remains an explicit accounting reconciliation. Paid funds requiring review never trigger a fabricated refund.
- Customer checkout data stays in the browser until payment is confirmed for the same order and matching cart.

The existing order summary and print action show the original amounts in toman. TabaPay's separate tax-invoice API is outside this payment flow. Run `dotnet test Vendora.slnx --filter FullyQualifiedName~TabaPayTests` for the isolated adapter and callback scenarios, and `node scripts/check-shipping-policy.cjs` in `site` after building for the browser flow.
