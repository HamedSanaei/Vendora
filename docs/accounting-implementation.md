# Vendora accounting, inventory and proformas — implementation report

Updated: 2026-10-24. Community licensing/Linux PDF follow-up: see [questpdf-community.md](questpdf-community.md). Implementation is local. No commit, push, PR, deployment, production migration, stock reset, historical adoption or actual financial transaction was performed.

## Delivery by phase

### A — repository and Penpot discovery

Inspected the existing .NET 10 Domain/Application/Persistence/Infrastructure/API solution, EF Core SQLite migrations, MediatR handlers, order/payment/product mutations, admin React/TypeScript/MobX UI, storefront Next/Redux cart/account/checkout and tests. Penpot MCP reads succeeded after the connection was restored: all 28 pages were inventoried, relevant frames/layers/components inspected, and representative desktop/mobile/print frames exported for visual comparison. Penpot was not modified.

The application has no installed AutoMapper. New mappings follow the repository's existing explicit `AdminMappings`/store-settings convention; no mapping dependency was introduced.

Integration map:

```text
Admin accounting UI -> shared authenticated Axios -> AdminOnly controller -> MediatR
 -> AccountingUnitOfWork -> financial documents / inventory / immutable party ledger
Orders.Create -> CartQuotation -> legacy stock mode OR active-accounting reservations
Admin order cancellation -> release reservation OR original-cost unshipped reversal
Verified server payment evidence -> CommercePosting -> stock issue + invoice + receipt
AccountingWorker -> bounded expiry and newly proven payment processing
Existing cart -> customer proforma command -> immutable customer-owned document
Customer/admin PDF endpoint -> ownership/type check -> ICommercialDocumentRenderer
 -> Infrastructure QuestPDF + real Vazirmatn assets
Product editor -> accounting status -> stock movement/adjustment screen
```

Original stock writers were product create/edit, order create and development/catalog seed paths. These now share the persistence write boundary. After activation, direct stock edits are rejected and `Product.StockQuantity` projects available stock. Before explicit activation, legacy behavior is preserved for a controlled transition.

The repository has no real gateway verification implementation. Existing `Verified` flags/demo references alone are not trusted payment evidence. No fake verification endpoint was added.

### B — domain, data and inventory (implemented, automated tests)

- Financial documents/lines, counterparties, immutable party ledger, settlements/allocations, stock balances/movements/reservations, number sequences, accounting activation state and actor-scoped request idempotency.
- Decimal moving weighted average, separate on-hand/reserved/available stock, captured sale cost, residual-value cleanup on full depletion.
- Transactional posting and conditional optimistic versions; serialized database write gate includes legacy quantity writers. Database unique source/request constraints prevent duplicate effects.
- Posted documents and append-only evidence cannot be edited/deleted through EF. Drafts have no stock/ledger effects. USD rates and seller/buyer/line monetary snapshots remain immutable after posting.
- Identical actor/key/payload returns the original operation; a changed payload under the same key conflicts.

### C — financial operations (implemented, automated and selected browser tests)

- Purchase, sale, proforma, purchase return and sales return drafts; save, post and void-draft operations. Numbering uses PUR/SAL/PRO/PRT/SRT without annual reset or reuse.
- Purchase freight allocation by net line value, discounts, explicitly recoverable purchase tax; sales cost captured when goods leave inventory.
- Sales returns restore original COGS. Purchase returns issue at current average and preserve the original commercial credit; valuation differences are reported separately. Server decimal calculations determine original-line return prices/discount/tax.
- Customer/supplier/both and individual/legal counterparties; optional explicit Identity user link, never automatic name/phone merging.
- Cash, bank and card receipts/payments, partial allocations, unallocated advances and immutable party balances. Manual entries cannot impersonate verified gateway payments.
- Overview, document summaries, party balances, inventory valuation, product-level known gross profit and per-invoice price history. Unknown historical cost remains explicit. Tax and freight are not represented as merchandise profit.
- Product history preserves individual line IDs, immutable party names, currency, confirmed rate and prices, including repeated identical product lines. CSV export explicitly covers the currently displayed profit page and neutralizes spreadsheet formula prefixes.

### D — commerce integration (implemented, automated tests)

- Checkout and proformas share authoritative server quotation: product IDs/quantities, valid coupon rules and category scope, known shipping methods and current internal product prices. Browser totals/discounts are not authoritative; no exchange API is called per shopper.
- Post 60,000 Toman, Tipax 20,000, freight collect zero online with explicit collect terms; the order records its selected method.
- Active accounting reserves unpaid orders for 30 minutes. Cancellation/expiry releases exactly once. The worker processes bounded batches (100 expiries and 25 newly proven payments per minute).
- Genuine server verification provenance plus matching order/payment amounts is required to finalize. The transaction consumes/rechecks stock, creates one sale invoice, one receipt and allocation; the invoice does not deduct stock twice.
- A second genuine payment for an already invoiced order becomes an unallocated review receipt, not a second sale/stock issue. Late/insufficient/cancelled-order payments also preserve real receipt evidence for review without negative inventory or fabricated refunds.
- Unshipped accounted cancellation creates linked original-cost reversals. Shipped/delivered goods require explicit return receipt. Historical unknown cost is not fabricated.
- Historical reconciliation is explicit, fingerprinted and idempotent; old/demo flags are not upgraded into invented verification evidence.
- Frontend checkout now sends shipping method, coupon and a retry-stable idempotency key while preserving its existing payment UI and cart state.

### E — admin frontend (implemented)

The existing authenticated admin shell/navigation and current design tokens remain. Eight URL-addressable accounting sections, filters and pagination use shared Axios. Tables use the existing responsive card pattern. Accounting-specific desktop/tablet drawer behavior is scoped to this area; unrelated routes keep their prior breakpoints.

New feature components are in `admin/src/features/admin/accounting/`:

- `AccountingPage`, `OverviewPage`, `DocumentList`, `InvoiceEditor`.
- `CounterpartiesPage`/party form/ledger, `PaymentsPage`, `InventoryPage`/stock adjustment/product price report, `ProfitReport`, `SetupPage`, `OrderAccountingContext`.
- `AccountingTable`, summary cards, request/URL hooks, typed API/models/formatting and scoped refresh provider/CSS.

These components are necessary orchestration/forms for the new business workflows, rather than replacement versions of existing products/orders/account screens.

Existing reused primitives include `AdminLayout`, `AdminPageHeader`, `AdminPanel`, `StatCard`, `AdminButton`, `AdminField`, `AdminSelect`, `AdminTextarea`, `AdminCheckbox`, `AdminFilterBar`, `AdminChip`, `AdminConfirmDialog`, `AdminPagination`, `AdminFeedback`, `AdminEmptyState`, `LoadingState`, authentication and Axios. Product editor/order details are extended in place. Existing storefront `AccountScreen`, account chrome/sidebar/dashboard cards, cart summary, localized buttons, Redux/cart and Axios are reused. CheckoutStepper was not rewritten.

Loading, empty, retry, validation/conflict, disabled and confirmation states are connected to actual responses. The return editor remounts separately from its source document, retains original-line constraints after save/refresh and uses unique input IDs for keyboard/label correctness.

### F — customer proformas and PDF (implemented, automated/browser/PDF checks)

- Existing cart has Get proforma; guests are routed to login with return to the preserved cart. Server issuance creates an immutable numbered snapshot without stock, reservation or ledger effects.
- Existing account navigation/dashboard link to `/fa/account/proformas`, with paginated own-document history and repeatable A4/A5 download/print actions. No supplier/internal cost/margin fields enter the customer DTO/PDF renderer contract.
- Unknown shipping is shown as determined at shipping, not free delivery. Selected shipping terms are snapshotted. Quotes explicitly are not payment proof, guaranteed prices or reserved stock.
- `ICommercialDocumentRenderer` is implemented by Infrastructure `QuestCommercialDocumentRenderer` using the explicitly approved QuestPDF 2026.9.1 dependency. No npm or other NuGet dependency was added.
- Real Vazirmatn regular/medium/semibold/bold files publish through API.csproj and Dockerfile. RTL A4/A5 templates repeat headers/table headings, preserve whole rows across page breaks and number pages. Download/print share the authenticated PDF source, never screenshots or public private-document URLs.
- Missing/invalid license or Production Evaluation configuration fails only PDF generation with a clear 503 code. Configure `Accounting__Pdf__License` before deployment using a license for which the business is eligible. Community eligibility is not assumed. Official licensing reference: https://www.questpdf.com/license/guide.html . Following owner eligibility confirmation, startup and tests now use Community, including Production rendering. See the licensing follow-up report.

### G — controlled setup and QA (implemented; production cutover intentionally not executed)

Read-only preview includes current quantities, open orders/reservations and a fingerprint. Explicit selection and `ZERO_SELECTED_DEMO_STOCK` plus confirmation are required; unsafe/open commerce blocks activation, history is not deleted. Audit movements do not invent a purchase, asset or unknown historical cost. Activation retries do not repeat effects; seed respects active inventory authority. Historical review requires its own fingerprint and `RECONCILE_VERIFIED_PAYMENT` confirmation. No real database was activated/reset/reconciled.

## Penpot frame-to-route map

Design file: `502b4555-3f5f-807a-8008-89e387e2c649`.

Admin 10 page: `738244a4-fc88-8016-8008-8879572978d7`. All following desktop frames are FA/1440; reuse existing admin foundations/components.

| Route relative to `/fa/admin/accounting` | Actual Penpot frame | Frame ID |
|---|---|---|
| index | Accounting / Overview / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c659cf5953 |
| purchases | Accounting / Purchases / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c71e41487c |
| sales | Accounting / Sales / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c7408f858e |
| quotes | Accounting / Quotes / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c765919305 |
| counterparties | Accounting / Counterparties / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c78936265f |
| payments | Accounting / Payments / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c7a83c0c2d |
| movements | Accounting / Movements / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c7be148163 |
| reports | Accounting / Reports / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c7da638b83 |
| documents/new; documents/:id | Accounting / Invoice Editor / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c80525c16c |
| returns?source=:id | Accounting / Returns / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5cbd504ecef |
| counterparties/:id | Accounting / Counterparty Ledger / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5cbf01a0b5a |
| setup | Accounting / Setup / FA / 1440 | 8d76fdde-ab65-80d0-8008-d5c822b793d7 |

Admin 09 responsive page `738244a4-fc88-8016-8008-88795706f958`:

- Overview 390: `8d76fdde-ab65-80d0-8008-d5c976bbdace`.
- Invoice Editor 390: `8d76fdde-ab65-80d0-8008-d5c98aedd021`.
- Overview 768: `8d76fdde-ab65-80d0-8008-d5ccbd20f808`.
- Overview 1024: `8d76fdde-ab65-80d0-8008-d5ccf0af8ec5`.

Customer `/fa/account/proformas`, Vendora 09 page `9362b142-eccc-80db-8008-885a18a86f53`:

- Frame / My Proformas / Desktop: `8d76fdde-ab65-80d0-8008-d5c8bfd4c805`.
- Frame / My Proformas / Mobile: `8d76fdde-ab65-80d0-8008-d5c8e691964b`.

Extended existing Cart 12, account components/dashboard 04/05 and Admin products/orders 04/05 layers in place. Relevant pages were inspected, not replaced. New states without a dedicated frame use the same existing UI primitives.

Admin 10 print frames:

- Proforma A4 `8d76fdde-ab65-80d0-8008-d5c9ea569401`; A5 `8d76fdde-ab65-80d0-8008-d5ca0899141b`.
- Sales Invoice A4 `8d76fdde-ab65-80d0-8008-d5cc3ba7819b`; A5 `8d76fdde-ab65-80d0-8008-d5cc3bd138f6`.

## Migrations

1. `20261023222521_AddAccountingLedgerAndInventory`: additive accounting/inventory tables, indexes and activation state.
2. `20261023224624_AddPaymentVerificationProvenance`: nullable verified-server evidence, not backfilled from old flags.
3. `20261024002734_AllowMultiplePaymentAttemptsPerOrder`: preserves payment rows; replaces unique OrderId index with a non-unique index for real repeated attempts.
4. `20261024003215_AddOrderShippingMethodSnapshot`: nullable selected shipping-method snapshot.

Model snapshot is synchronized. Migrations were applied only to isolated integration/QA databases. Review/backup and an explicit cutover remain deployment responsibilities.

## Endpoints and MediatR use cases

All admin endpoints below are under `/api/admin/accounting`, protected by existing `AdminOnly` authorization. Controllers only adapt HTTP to MediatR and safe errors.

- GET `status`, `overview`, `documents/summary`, `counterparties/summary`, `settlements/summary`, `inventory/summary`: `AccountingQueries` and `AccountingSummaries` read handlers.
- GET `documents`, `documents/:id`, `documents/:id/context`: paginated/filterable queries and return/settlement context.
- POST `documents`, `documents/:id/post`, `documents/:id/void-draft`: `DocumentCommands.SaveDraft/Post/VoidDraft`.
- GET `documents/:id/pdf?size=A4|A5`: `DocumentPdf.Query`, only public-safe sale/proforma types.
- GET/POST `counterparties`, GET `counterparties/:id`, `counterparties/:id/ledger`: `AccountingQueries` and `PartyCommands.Save`.
- GET/POST `settlements`, POST `settlements/:id/allocations`: `PartyCommands.ReceiveOrPay/Allocate`.
- GET `inventory`, `movements`; POST `inventory/:id/adjustments`: inventory queries and `InventoryCommands.Adjust`.
- GET `reports/products/:id/prices`, `reports/product-profit`: actual line history and `AccountingReports.ProductProfit`.
- GET `orders/:id/context`: actual reservation/provenance/linked-invoice/review information.
- GET `setup/preview`, POST `setup/activate`, GET `setup/historical-payments`, POST `setup/historical-payments/:id/reconcile`: controlled setup and explicit `CommercePosting` reconciliation.

Authenticated customer `/api/account/documents`:

- GET list (kind 2 proforma or 1 sale) and GET `/:id`: `AccountingQueries.Mine/MyDocument`, ownership enforced in the query.
- POST `/proformas`: `ProformaCommands.Issue`; no trusted browser totals or caller-selected owner.
- GET `/:id/pdf?size=A4|A5`: `DocumentPdf.Query`; foreign/missing document 404, guest 401, private/no-store response.

Writes use `Idempotency-Key` and optimistic versions where applicable. Expiry and payment finalization are internal commands, not fake verification HTTP APIs.

## Validation evidence

Executed checks:

- `dotnet restore` and `dotnet build Vendora.slnx --no-restore`: passed; build zero errors/warnings.
- `dotnet test Vendora.slnx --no-restore`: **255 passed, 0 failed, 0 skipped** (215 prior tests, 27 accounting tests, 12 PDF cases and one accounting HTTP integration test). Uses real SQLite/HTTP fixtures plus actual QuestPDF rendering.
- Admin `npm run lint`, `npm run build` (includes `tsc -b`): passed. Existing large-bundle advisory remains.
- Site `npm run lint`, `npm run build` (includes TypeScript): passed; account/proformas route included.
- `node --test scripts/*.test.mjs` in admin: 18 passed after the browser PDF helper follow-up.
- `dotnet ef migrations has-pending-model-changes --project Persistence --startup-project API --no-build`: none missing.
- `git diff --check`: passed, LF/CRLF conversion notices only.

Coverage includes moving average/multiple costs, full depletion, partial/full/excess returns, freight/tax/USD snapshots, settlement allocations, duplicate posting/payment/conflicting payloads, immutable evidence, concurrent last-unit sale, expiry/cancellation and late payment, rollback, customer ownership, malicious price/coupon/shipping input, historical retry/setup blockers and provenance, safe PDF authorization/configuration and individual product-history lines. One added regression test exposed an EF ordering/projection translation failure in price history; ordering/pagination now precede DTO construction.

Browser QA used actual local Identity sign-in and real APIs against a dedicated synthetic SQLite fixture under ignored `artifacts/accounting-ui/`. It did not open the real application database. No production sample financial data was added. Local QA fixtures are explicitly test-only.

- Eight accounting sections: desktop/tablet/mobile measured at 390/768/1024/1440. No document/table horizontal overflow found after scoped fixes. Representative rendered screenshots compared with actual inspected Penpot frames; this is not a pixel-perfect certification.
- Editor, return editor, party ledger and setup: measured at all four widths; screenshots retained. Actual draft save/refresh, original-line return limits, partial sales return posting, immutable posted controls and changed party balance were exercised.
- Account proformas: all four widths, actual cart issuance, preservation of cart, refresh, and repeat A4/A5 downloads. FA/EN admin/account smoke checks loaded real data with RTL/LTR respectively.
- Product editor links to the same authorized movement screen. Order detail shows actual reservation and absence/presence of server evidence. Accounting drawer opening/Escape/focus return tested at 1024.
- Screenshot capture occasionally produced stale/cropped compositor output immediately after resize; stable final captures use `*-final-*.jpg`. Geometry was read from the real DOM rather than inferred from a faulty image.
- Print action uses the downloaded PDF source; automatic browser opening of a blob PDF was blocked by the browser automation security policy. OS print-dialog completion was not verified and no workaround was attempted. Authenticated PDF downloads and server rendering were verified independently.

PDF fixtures: actual Proforma/Sale A4/A5 with 2 and 65 lines. Two-line documents fit on one page; 65-line A5 is ten pages. Poppler confirmed physical A4/A5 sizes and rendered Persian text, repeating headers, intact rows, large amounts, summary and final page numbering. Artifacts are under ignored `artifacts/accounting-pdf/`.

## Remaining limits and deployment prerequisites

- Real gateway initiation/verification/callback/refunds remain outside this scope; there is no fabricated successful verification. A future real verifier must supply actual server evidence to the shared finalization command.
- Production accounting activation and historical reconciliation deliberately remain unexecuted. Existing data/provenance must be reviewed by an authorized administrator before cutover.
- Community eligibility was confirmed by the owner and configured at startup. Existing deployment overrides must agree with Community; see the licensing report. PDF configuration failure remains isolated from other accounting functions.
- Follow-up Linux/container verification now passed against the actual production runtime/font/native assets, offline and non-root; see the licensing report and reproducible smoke script.
- Browser QA covers representative business flows, not every OS/browser/assistive-technology combination. Automated API/domain tests cover concurrency/failure cases that were not manually reproduced in each viewport.
- CSV currently exports the visible report page, clearly labelled. This is not a full-history export.
- Full double-entry accounting, manufacturing/BOM, payroll, post-dated cheques, FX revaluation and tax authority integration are excluded by the agreed specification.

No separate alternative layout, screenshot-as-UI, fabricated gateway record, production reset, commit, push, PR or deployment was made.
