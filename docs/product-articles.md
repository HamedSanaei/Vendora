# Product article editing

The product create/edit form uses one lazy-loaded Tiptap editor in
`admin/src/features/admin/components/rich-text/`. Its controlled value is saved
through the existing multipart product API's `description` field. Existing
plain-text descriptions remain editable; no content backfill is required.

## Supported content

- Paragraphs, semantic H2/H3/H4 headings, bold, italic, underline, strikethrough.
- Nested bullet/numbered lists, blockquotes, safe links, alignment, undo/redo,
  and clear formatting.
- Vazirmatn, Tahoma, Arial; finite sizes from 14px through 32px and text color.
- Owned JPG/PNG/WebP article images, with editable alternative text and removal.
- Persian RTL and existing English LTR form labels and rendering.

The limit is 200,000 characters **including HTML markup**, not 200,000 visible
characters. Empty editor markup is normalized to null. Fonts must already be
available locally; the editor does not load third-party font services.

## Image endpoint

`POST /api/admin/products/description-images` accepts one multipart `file` and
requires the existing AdminOnly authorization policy. The CQRS handler checks
the extension, MIME type, binary signature, and 5MB maximum before calling the
existing storage adapter. It returns `{ "url": "/uploads/products/<guid>.jpg" }`.
Images are independent of the ten-image product gallery. Portable relative URLs
are stored; each frontend resolves them against the configured API origin.

Uploads persist immediately. Removing an image from an article or abandoning a
form does **not** delete the physical image: undo, another article, or the gallery
could still reference it. A future reference-aware orphan retention/cleanup job
can reclaim unused uploads; do not delete article files on editor node removal.

## Sanitization and reads

`IProductDescriptionService` is implemented by the scoped HtmlSanitizer adapter
in Infrastructure. Both writes and full article reads use its explicit HTML/CSS
allow list. Scripts, event handlers, embeds, arbitrary layout CSS, remote images,
SVG and data URLs are not allowed. Only supported fonts, sizes, colors and
alignment survive. Links are restricted to HTTP, HTTPS and mailto.

`GET /api/catalog/products` returns a compact plain-text excerpt and no article
body. `GET /api/catalog/products/{identifier}` accepts a GUID or slug, returns only
active products, and includes sanitized `descriptionHtml` alongside the excerpt.
The storefront loads the body only for product details and uses `ProductArticle`
to render it. Full articles are removed from cart/wishlist product snapshots.
Never feed user input, URL parameters, or arbitrary HTML into this renderer.

## Migration and deployment

Apply `20261020120034_ExpandProductDescriptionForRichText` with the existing
deployment migration step before releasing the API/admin/site together. SQLite
already stores descriptions as TEXT, so this migration updates the EF model
annotation without rebuilding tables or modifying existing descriptions. The
Application layer enforces the new maximum because SQLite does not enforce
string maximum-length annotations itself.

No authentication, pricing, payment, gallery, or product route behavior changes.
Existing `/api/products/{slug}` remains compatible and sanitizes its description.

## Validation

`ProductArticleTests` exercises actual authenticated HTTP uploads, signature and
size rejection, long article create/edit/read persistence, compact lists, hidden
drafts, legacy text, sanitizer idempotency, and malicious HTML/CSS/URL removal.
Use the existing solution tests and both frontend lint/build scripts.

Manual browser QA covered article create/edit/save/reload, font and size changes,
undo, pasted headings/lists/links, and stored image rendering in the editor and
storefront. Both surfaces were measured at 390/768/1024/1440px with no horizontal
overflow; toolbar touch targets were at least 44px. English routes were smoke
tested. Browser-automated local file selection was blocked by the browser
extension's file-URL permission; no permission was changed. Image uploads were
instead exercised through real authenticated HTTP requests and integration tests.

Both frontend lint/build checks and the solution build passed; all 130 solution
tests passed (15 article cases). The admin build retains its existing main-chunk
size warning. `npm audit` reports advisories in the admin dependency tree; no
unrelated dependency upgrades or forced fixes were applied. The newly added
Infrastructure package tree had no reported NuGet vulnerabilities at verification.
