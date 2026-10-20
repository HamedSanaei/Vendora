# Category hierarchy, canonical catalog and editorial SEO

## Data and compatibility

- One optional category parent; product assignments stay explicit and many-to-many. The existing `CategoryId` is the primary assigned category.
- The shared cycle-safe hierarchy expands parent filters, OR-combines category selections, and hides branches with an inactive ancestor. Products are not unpublished by taxonomy changes.
- `GET /api/catalog/products/search` accepts repeated `category`, `brand`, `color`; `baseCategory` constrains a category landing page; `search` (title/slug, up to 200 characters), `priceMin`, `priceMax`, `inStock`, `sort=newest|oldest|priceAsc|priceDesc`, `page`, `pageSize` (1–48).
- Counts/pagination operate on unique products, not join rows. SQLite cannot order decimal money; price sorting projects only matching IDs/prices and sorts those exact decimals in memory before loading the page. No floating-point money cast is used. A very large catalog may need a separately indexed integer minor-unit sort key in a future additive migration.
- The old list endpoint remains compatible. Optional omitted SEO/image-alt fields do not erase saved values.
- Migration `20261020205517_AddCategoryContentAndSeo` adds nullable editorial columns, settings, alias history and redirect tables. It does not rebuild identifiers or remove existing relationships/data. Back up the database before applying deployment migrations.

## URLs and crawl output

- Current Persian URLs: `/fa/product/{slug}`, `/fa/category/{slug}`.
- Product GUIDs in cart, wishlist and orders do not change. Old identifier and renamed-slug URLs resolve directly to the current URL with HTTP 301.
- Historical slugs remain reserved for their original entity. Administrator redirects are local public Persian paths only, 301/302, with manual/alias loop detection. The resolver flattens chains into one HTTP hop.
- Product/category pages and the paginated shop are server-rendered from the API through the shared Axios transport. Missing content produces 404; API outages produce errors, never synthetic product/pricing data. Inactive article tabs keep their sanitized article HTML in the initial document.
- Product/Offer, breadcrumbs, category collection/items and Organization JSON-LD use actual data. Offers multiply persisted Toman prices by ten for IRR; no crawler request contacts an exchange. No fabricated review aggregates are emitted.
- Social metadata uses explicit editorial fields, then actual product/category imagery or the configured logo.
- English routes remain functional but noindex. They are not in the sitemap. Private pages, search and filter combinations are noindex and absent from the sitemap; filters remain crawlable after launch so robots can see noindex/canonical metadata.

## Launch settings

Open `/fa/admin/seo` to configure site name, canonical origin, title pattern, logo, social profiles and optional default description. Keep `{title}` in the title pattern; `{siteName}` is available.

**Indexing is OFF by default.** Before explicit activation, public pages are noindex, `robots.txt` disallows crawling and `sitemap.xml` is empty. Set the real public origin and review published content, uploads, metadata and redirects before enabling indexing. No production settings are enabled by this implementation.

## Assessment rules

`vendora-fa-1` uses fixed groups: metadata 30, focus phrase 30, content structure 15, images/alt 10, internal link 5, metadata uniqueness 10.

Analysis sanitizes HTML and normalizes Persian/Arabic yeh/kaf, diacritics and half spaces for phrase comparison. Readability reports word/sentence/long-paragraph counts separately, not an English Flesch score. Warnings do not prevent publication and the score does not guarantee search ranking.

Draft analysis is cancelled/debounced after one second of idle typing. Save recomputes the score/version on the server; lists show the last saved assessment. Site-wide title changes can change a new assessment without automatically rewriting all historical product scores.

## Optional 9Router suggestions

The server-only adapter uses the documented OpenAI-compatible [9Router API](https://github.com/decolua/9router#-api-reference): `GET models` and `POST chat/completions`, relative to a configured base ending in `/v1`.

Configure through deployment secrets/user secrets, never a tracked environment file:

```text
SeoAi__BaseUrl=https://your-router.example/v1
SeoAi__ApiKey=<server-managed secret>
SeoAi__Model=<one explicitly approved model ID>
```

- No credential/configuration secret is returned to a browser or stored in public settings.
- No inference occurs on typing, analysis, saving, storefront visits or crawling. Model discovery does not generate content.
- Explicit administrator clicks are limited to five attempts/admin/minute per application process; timeout is 60 seconds, input content 24,000 characters, response buffer 1 MiB.
- Only this item's public name/article/focus phrases are submitted. No customer/order data, private attributes, product identity or image URLs are sent.
- The app pins the configured model and does not choose a paid fallback. The operator must also review the router's own provider/routing/fallback configuration; this app cannot override policies configured inside a third-party router.
- Structured suggestions are bounded and content is sanitized. Failures do not change editor data. Preview and selective explicit apply are separate from explicit save/publication. AI has no tool or product-write capability.
- Missing configuration produces a clear unavailable state while normal SEO remains usable. Real-provider credential/inference verification requires the operator's own configured service; automated tests use fake transports only.
- For multiple API replicas, the in-process inference rate gate is per replica. Use a shared deployment-level rate limiter before scaling if one cross-replica budget is required.

## Shopping search services

This work prepares stable crawlable URLs, public imagery and clear actual pricing/stock. Store registration, identity/business verification and activation with [Torob](https://github.com/torob/Torob-Sync) or [Emalls](https://emalls.ir/ShopRequest) are separate operator actions. No unapproved partner-specific integration was added.

## Verification

- Backend: `dotnet build Vendora.slnx`, `dotnet test Vendora.slnx`.
- Admin/site: existing `npm run lint` and `npm run build` scripts.
- Integration tests cover four-level trees, cycles, inactive branches, unique pagination/decimal sorting, primary categories, metadata/alt preservation, aliases/reservation/redirects, Persian assessment, launch/sitemap rules, admin authorization, malformed AI responses and the inference rate gate.
- Browser checks use an isolated local SQLite fixture, never production: 390/768/1024/1440 layouts, tree search, product save, slug navigation, URL filters, no-JavaScript HTML and locale smoke checks.
