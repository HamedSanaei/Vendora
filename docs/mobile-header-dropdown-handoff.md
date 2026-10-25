# Mobile header dropdown handoff

## Reference and scope

The existing Penpot file `502b4555-3f5f-807a-8008-89e387e2c649` was read through MCP. All four mobile boards were inspected as layer geometry/text/fills and exported images on page `9362b142-eccc-80db-8008-885a189b26ec`:

- Signed-in account: `fe783a92-1919-8035-8008-d753d9278323`.
- Guest account: `fe783a92-1919-8035-8008-d7546aae26f4`.
- Populated wishlist: `fe783a92-1919-8035-8008-d7546bffa3ab`.
- Empty wishlist: `fe783a92-1919-8035-8008-d7546e34ea24`.

The boards are 390 × 844 compositions of the existing header, content and bottom navigation. Their content is implemented as mobile variants of the existing `HeaderAccountDropdown` and `HeaderWishlistDropdown`, rather than new pages. The existing `AccountDrawer` provides the lifecycle and scroll lock with an optional full-width header-content slot. The original account-page drawer is retained.

The existing compact/desktop header breakpoint is still 1280px. New surfaces occupy the area below the actual visible header and above the existing 88px phone / 96px tablet navigation plus safe area. Tablet content is centered and capped at 560px; content scrolls vertically if necessary. No header/navigation SVG, route, API, authentication contract or cart calculation was replaced. Penpot was not edited.

## Components and integration

- Existing header account action: tap the bottom-navigation account icon for signed-in or guest state; a second tap closes it. Signed-in wishlist entry opens the compact summary without replacing the full wishlist route. Back returns to the account summary; Escape returns focus to the initiating bottom-navigation item.
- Existing routes remain `/fa/account`, `/fa/account/profile`, `/fa/account/orders`, `/fa/account/addresses`, `/fa/account/wishlist`, `/fa/account/returns`, `/fa/account/transactions`, `/fa/account/proformas`, `/fa/account/security`, `/fa/login`, `/fa/cart` and `/fa/faq`. English links preserve `/en`.
- Guest Login/Register uses the current safe return-destination helper. Order tracking links to Login with the existing orders route as `returnTo`. No private order/profile request is issued for a guest summary.
- The private `MobileAccountSummary` is the only additional UI helper: it composes the missing profile/order tiles from the existing `/account/me` client and existing `useGetUserOrdersQuery` (`/Orders/me`). It is mounted only for an authenticated mobile account summary. Requests are cancellable and the existing order cache is partitioned by user identity. No polling was added.
- In-progress counts include PendingPayment, Paid, Processing, Packed and Shipped. Delivered and Refunded orders populate the other two tiles. The returned tile counts actual Refunded orders, not invented return requests; the existing separate returns page/API behavior is unchanged. Failures display unavailable counts and Retry, not fabricated zeroes.
- Name and masked phone come from the authenticated account; session name is a loading fallback. Sample profile/order values are never used. Logout reuses `useAccountLogout`, clearing the session/cache while preserving the cart.
- Both wishlist layouts use the same current-catalog lookup, real persisted Redux wishlist, removal actions and stock-limited cart actions. The full wishlist action navigates to the existing account wishlist page. Missing/failed catalog data disables purchase and offers Retry.
- The wishlist still uses the application's browser persistence; it has not been converted to server-side account synchronization. The empty-state footer describes that accurately.
- Existing `CartProductMedia`, `VendoraButton`, shared SVG icons and locale/price/digit helpers are reused. New mobile controls have at least 44px touch targets; the small account chip remains visually compact inside a 44px link.
- The existing `MiniCart` remains the only cart summary, including quantity controls, totals, removal, bottom sheet and checkout links. `CheckoutStickyAction` and the current Cart page are reused unchanged.
- MCP also verified cart-page references: mobile sheet `033beef8-1062-80b8-8008-8ac0ccf04402` and sticky checkout `033beef8-1062-80b8-8008-8ac02d49b9d0` on page `033beef8-1062-80b8-8008-8abf19f30fe3`.

## Interaction and accessibility

One coordinator owns account, wishlist and cart visibility. Switching mobile summaries preserves the original focus-return anchor. Pointer hover does not dismiss mobile summaries. Header/search and bottom navigation remain usable; background main/footer content is inert while the full-width summary is open. The existing modal cart retains focus containment, while the non-modal account/wishlist summaries allow keyboard access to header/navigation. Body scroll lock, inert state and listeners are restored on dismissal, navigation or responsive-layout changes. Horizontal overflow is clipped only while these mobile surfaces are open, protecting them from the existing homepage editorial overflow.

## Changed files

- `site/src/components/vendora/layout/header-dropdowns.tsx`: responsive variants and real account/order summary.
- `site/src/components/vendora/layout/store-chrome.tsx`: wire existing mobile actions and surfaces.
- `site/src/components/vendora/layout/mobile-bottom-navigation.tsx`: active/controlled-surface semantics, unchanged icons and destinations.
- `site/src/components/vendora/layout/use-header-dropdowns.ts`: mobile summary switching and correct modal-only focus containment.
- `site/src/components/vendora/account/account-chrome.tsx`: optional header-content slot in the current drawer.
- `site/src/lib/vendora/header-dropdown-copy.ts`: centralized Persian/English mobile copy.
- `site/src/app/vendora.css`: scoped Penpot geometry and responsive surface styling.
- `site/scripts/check-header-dropdowns.cjs`: extend existing isolated browser regression.
- This document.

## Validation

Browser fixtures are synthetic, local-only data served through the existing real frontend clients. They do not access production. The regression exercises Persian/English desktop at 1440px and real touch contexts at 1024, 768 and 390px. Phone screenshots use the Penpot 844px height.

Coverage includes unchanged desktop trigger geometry and interactions; all four mobile states; authenticated real-response order counts; masked phone; guest return links and no private guest requests; unavailable order counts and successful Retry; current catalog prices versus deliberately stale persisted prices; additions, increments and stock cap; wishlist removal and empty state; navigation to the existing full wishlist and Back; focus return, scroll/inert cleanup; mobile cart sheet/backdrop; the original full-cart sticky checkout above bottom navigation; fonts and 44px controls. English LTR is smoke-tested. Screenshots at the four requested widths were visually inspected against the mobile exports and preserved desktop states; no claim of pixel-perfect equivalence for arbitrary real product content is made.

Passed on the final implementation:

- `node scripts/check-header-dropdowns.cjs`: all eight desktop/mobile/data/error scenario groups passed, with test-owned servers cleaned up.
- `npx --no-install tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (only the two existing Sass import deprecation warnings).
- `git diff --check`: passed.

Logs and screenshots are local under ignored `artifacts/header-dropdowns/`. The mobile surface geometry check confirms a 1024px document/viewport while open and a fully visible centered 560px panel, despite the unrelated underlying homepage overflow.

## Boundaries and limitations

The existing homepage editorial cards have horizontal overflow at 1024px while no overlay is open; they are outside this handoff and remain unchanged. Existing Sass import deprecation warnings are unrelated. No dependencies, backend changes, new routes, replacement pages or production data changes were introduced.

At the user's explicit request, the preceding desktop header implementation was committed first as `a621783`. The mobile implementation and validation were completed locally before the user separately authorized committing and pushing this follow-up. No deployment or production-data operation was performed as part of implementation.
