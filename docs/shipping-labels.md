# A5 parcel shipping labels

## Usage

Order details now offer **Download A5 label** and **Print label**. The existing order list has row selection, current-page selection and bulk download/print. Selections persist across pagination, reset when search/status/payment filters change (including browser Back/Forward), and are limited to 100 unique orders. Each order occupies exactly one portrait A5 page; there is no parcel-count workflow.

Complete the sender name, Persian address and support phone in existing store management first. The current configured store identity is used for the sender; the recipient always comes from the saved **order shipping snapshot**, not the customer's current profile. Missing required sender/recipient fields block the entire PDF with actionable field names and, for recipient/layout failures, the order number.

Labels contain recipient name, province/city/street, plaque/unit when recorded, postal code, recipient phone, sender name/address, support phone, order number and recorded carrier/freight terms. They do not contain products, prices, totals, payment details, customer email, private notes or map coordinates. Unknown or malformed historical shipping terms display “ثبت نشده”; no current shipping default is substituted.

The black-and-white Persian layout uses embedded Vazirmatn, 8 mm margins and at least 10 pt body text. Overlong data is never truncated or continued onto a second page: the complete document retries at 12/11/10 pt and rejects an order that still cannot fit. These are internal address labels, **not carrier waybills or tracking codes**.

## Architecture and interfaces

- `GET /api/admin/orders/{id}/shipping-label/pdf`
- `POST /api/admin/orders/shipping-labels/pdf`, JSON `{ "orderIds": ["..."] }`

Both routes require the existing Admin policy. Batch selection order is preserved and duplicate IDs removed. Empty selections, invalid IDs and more than 100 unique orders are rejected. The batch JSON body has a 32 KiB limit. No output is returned for a partially invalid batch. Successful responses are `application/pdf` with `Cache-Control: no-store`; there is no public URL, server-side PDF storage, document registration or mutation of orders, payments or stock. Printing is allowed regardless of order status and does not represent shipment/payment confirmation.

`ShippingLabels.Query/Handler` is the MediatR read use case. Its logistics-only DTO is passed through `IShippingLabelRenderer` to `QuestShippingLabelRenderer` in Infrastructure. `PdfRenderingResources` now centralizes the same explicit license and four published Vazirmatn weights used by the existing commercial invoice renderer; invoice templates are unchanged. No schema/migration or dependency is added.

The existing shared Axios session and `preparePdfPrintWindow` are reused. Invoice and label downloads now share `downloadPdf`, including blob-error decoding, popup protection, opener isolation and object-URL cleanup. The PDF opens in the browser's viewer; the user selects their own printer and A5/actual-size settings there. No server printer or printer credentials are involved. Blocked popups show an actionable error and the ordinary download remains available.

Stable errors include `LABEL_INVALID_SELECTION` (400), `LABEL_ORDER_NOT_FOUND` (404), `LABEL_SENDER_INCOMPLETE`, `LABEL_RECIPIENT_INCOMPLETE`, `LABEL_CONTENT_TOO_LONG` (422), and the existing PDF-only configuration/render errors (503). Errors/logs never include address content or raw layout exceptions.

## Validation

```bash
dotnet build Vendora.slnx
dotnet test Vendora.slnx
cd admin
npm run lint
npm run build
node --test scripts/pdf-browser.test.mjs scripts/admin-ui.test.mjs
node scripts/check-admin-ui.mjs
```

`ShippingLabelTests` covers actual authorized HTTP/SQLite/PDF behavior, selection deduplication/order, snapshots, missing fields, unknown history, safe data contract, unchanged order/financial/inventory state, oversize layout rejection, cancellation and PDF-only license failures. To generate the three synthetic local QA fixtures:

```powershell
$env:VENDORA_LABEL_TEST_OUTPUT = "$PWD/artifacts/shipping-labels/windows"
dotnet test tests/Vendora.IntegrationTests --filter FullyQualifiedName~ShippingLabelTests
python scripts/verify-shipping-label-pdfs.py artifacts/shipping-labels/windows --render
```

Use the existing Docker probe for the exact production API runtime/native libraries/fonts/non-root user:

```powershell
./scripts/test-commercial-pdf-container.ps1 -OutputDirectory artifacts/shipping-labels/linux
python scripts/verify-shipping-label-pdfs.py artifacts/shipping-labels/linux/shipping-labels --render
python scripts/verify-commercial-pdfs.py artifacts/shipping-labels/linux
```

The probe is offline, read-only, has no DB mount/configuration and never starts the API. It also regenerates all eight existing invoice/proforma variants to guard the shared font-setup refactor. The verifier checks physical A5 dimensions, exact page count/order, Persian text and phone/postal codes, embedded fonts, untruncated long addresses, physical page bounds and absence of financial text. Rendered PNGs support actual visual inspection.

Admin browser fixtures exercise the four 390/768/1024/1440 viewports and English compatibility, cross-page selection/filter reset, download/error retry, touch targets and blocked/successful viewer handoff. Chromium headless can treat PDFs as downloads, so successful print handoff is asserted with a controlled viewer target and the real PDF blob; physical printer output is not certified by automation.

All samples are synthetic. No production data, real shipments, Git commits/pushes or deployments are changed by this task.

## Validation record — 2026-10-26

- Solution build: passed, zero warnings/errors. Full integration suite: **312 passed**, including the six new shipping-label cases and existing commercial PDF tests.
- Admin ESLint, TypeScript/production build and nine existing UI/PDF-viewer unit tests: passed. Existing bundle-size warnings are non-blocking.
- Actual admin browser checks passed at 390/768/1024/1440, including selection across pages, filter reset, retries, popup errors, label downloads and viewer handoff. English routing/pagination compatibility passed. Checkbox/action targets and order controls staying inside their table cells are asserted.
- Three Windows and three Linux label fixtures passed physical-paper, page-count, data/font and bounds verification. Single and long-address rendered pages were visually inspected; RTL joins, number direction and spacing were readable without clipping.
- The offline non-root production-image Docker probe passed. All eight pre-existing A4/A5 invoice/proforma fixtures also passed regression verification after shared font initialization was extracted.
- No new database migration, production database operation, shipment API call, commit, push or deployment occurred. Physical printer output was not tested.

Main implementation files are `Application/Orders/ShippingLabels.cs`, `Application/Interfaces/IShippingLabelRenderer.cs`, `API/Controllers/ShippingLabelsController.cs`, `Infrastructure/Documents/QuestShippingLabelRenderer.cs` and shared `PdfRenderingResources.cs`. Admin additions are `shippingLabelsApi.ts`, `OrderLabelActions.tsx`, `useOrderLabelSelection.ts` and shared `lib/pdf-download.ts`, integrated into existing order list/detail pages. Existing status-control CSS was made wrapping-safe for the selection column. Validation lives in `ShippingLabelTests.cs`, the extended PDF smoke probe, `verify-shipping-label-pdfs.py` and the existing admin browser checker with `shipping-label-fixtures.mjs`.
