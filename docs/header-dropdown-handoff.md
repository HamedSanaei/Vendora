# Vendora header dropdown handoff

## Design reference and boundaries

The existing Penpot file `502b4555-3f5f-807a-8008-89e387e2c649` was inspected through MCP, including shape geometry, typography, fills, shadows and exported visual references. No Penpot design was edited.

Implemented account-component references:

- Signed-in account: `fe783a92-1919-8035-8008-d750b1b60ebc`, **380 × 632**.
- Guest account: `fe783a92-1919-8035-8008-d750b7e575be`, **380 × 360**.
- Wishlist with two products: `fe783a92-1919-8035-8008-d7511ca6f00a`, **440 × 560**.
- Empty wishlist: `fe783a92-1919-8035-8008-d7511d921e01`, **400 × 341**.

The four Persian states were rendered, visually compared with their exported references and measured at those dimensions with the synthetic test content. Long real content and short viewports are allowed to scroll rather than being cropped. Existing icons/media are reused, with only the missing document, shield-check and exit-door paths transcribed from the actual Penpot dropdown assets into the shared SVG icon module. This is not a claim of pixel-perfect equivalence for every possible product/photo/text value.

Preserved header references on `Vendora · 02 Components`: desktop `9362b142-eccc-80db-8008-88563e921bda`, account `9362b142-eccc-80db-8008-88563ccbdcb7`, wishlist `9362b142-eccc-80db-8008-88563cd9fc00`, cart `9362b142-eccc-80db-8008-88563cecb55a`.

Reused mini-cart references on `Vendora · 12 Cart & Mini Cart`: single-item `033beef8-1062-80b8-8008-8ac063218f1f`, multiple-item `033beef8-1062-80b8-8008-8ac064be9065`, mobile sheet `033beef8-1062-80b8-8008-8ac0ccf04402`. Their existing React implementation, line items, totals and Redux mutations remain the sole cart implementation.

## Components, state and routes reused

- `StoreHeader`, desktop/mobile header markup, logo/search/category menu, original trigger sizes/styles/positions and `MobileBottomNavigation` remain in place. Account/wishlist desktop links now act as dropdown buttons; the cart keeps its existing trigger appearance. Wishlist counts use the same existing badge pattern as cart counts, hidden when empty.
- `accountNavItems`, account icons and `isAccountItemActive` supply the dropdown navigation. Its Penpot order selects the existing dashboard, orders, addresses, wishlist, returns, transactions, proformas and security destinations. No account route list is reinvented.
- `AccountDrawer` is exported for header reuse. Its original account-page behavior stays the default. Authenticated bottom-navigation taps open that same drawer at phone/tablet sizes; guest navigation keeps the existing account/login route. The full wishlist stays at `/fa/account/wishlist` (and its existing English counterpart).
- Existing `useAuthCheck` and Redux auth state drive guest/authenticated rendering without fixture/sample names in production. `useAccountLogout` extracts the original logout, auth-storage removal, RTK cache reset and localized login redirect from the account shell; it is shared with the new header action and preserves the cart.
- Guest login uses `/fa/login?returnTo=...` through the existing locale/return-path helpers. When already on an auth page, the existing return destination or account fallback is used instead of returning to Login again. The shopping-guide link reuses the footer's `/faq` destination. Guest cart access links to the existing `/cart` route; the header cart icon opens the existing mini cart.
- Wishlist items come exclusively from the persisted Redux wishlist. Current public prices, stock, slug and metadata come from the already shared/cached `useGetShowingProductsQuery`; no extra polling or exchange-rate requests are added. Failed catalog reads disable purchases and show Retry; locally saved prices are not presented as current prices. Unavailable products remain removable.
- Existing `CartProductMedia`, `VendoraButton`, formatting helpers, `getCartUnitPrice`, `getCartTotals`, cart listener/action workflow and wishlist removal action are reused. Increasing quantities in the dropdown follows the same stock-limited cart mutation flow as catalog cards. The mini-cart financial calculations were not reimplemented.
- New UI is limited to `HeaderAccountDropdown` and `HeaderWishlistDropdown`, each with its own existing Penpot states. `useHeaderDropdowns` coordinates all three surfaces using the already installed Popper package. Localized dropdown copy lives beside the existing dictionaries.

## Interaction contract

- Desktop mouse hover and keyboard-visible focus open the corresponding surface; click/Enter/Space toggle it. Arrow-down enters the first action; native Tab navigation is retained.
- Only one account/wishlist/cart surface is active. Opening it closes the existing category overlays; opening the category menu closes header dropdowns.
- A 220 ms close delay bridges the trigger/panel gap. Pointer entry cancels dismissal; focused content remains usable until focus leaves.
- Escape closes and restores focus without reopening the surface. Outside pointer events and focus leaving the interaction area dismiss it. Focus events from a previously active trigger cannot close a newly opened menu.
- Desktop popovers are non-modal, do not lock body scroll or steal hover focus, and are anchored below existing controls. Popper keeps horizontal bounds inside the viewport; tall content scrolls and viewport-height changes update the available space. Scrolling the header anchor out of view dismisses the surface.
- The existing header breakpoint remains **1280px**. At 1024/768/390 the original compact header and bottom navigation remain; account uses the existing drawer and cart uses the existing bottom sheet. Their body-scroll lock, focus containment, Escape dismissal and cart safe-area padding are retained/coordinated. The bottom-nav cart link still opens the existing cart page.
- Trigger/surface relationships include labels, `aria-expanded`, `aria-controls` and dialog semantics; product actions retain native link/button keyboard behavior.

## Changed files

- `site/src/components/vendora/layout/store-chrome.tsx`: connect the existing header controls and state.
- `site/src/components/vendora/layout/header-dropdowns.tsx`: missing account/wishlist Penpot UI.
- `site/src/components/vendora/layout/use-header-dropdowns.ts`: shared interaction, focus and positioning coordination.
- `site/src/components/vendora/layout/mobile-bottom-navigation.tsx`: optional existing-account-drawer action, with unchanged appearance/routes.
- `site/src/components/vendora/account/account-chrome.tsx`: reuse drawer/icons and shared logout.
- `site/src/components/vendora/cart/mini-cart.tsx`: expose current surfaces to the coordinator; preserve cart UI and calculations.
- `site/src/components/vendora/icons.tsx`: only the three missing Penpot SVG assets; existing icons unchanged.
- `site/src/lib/auth/use-account-logout.ts`: extract the existing logout workflow.
- `site/src/lib/vendora/header-dropdown-copy.ts`: localized dropdown strings.
- `site/src/app/vendora.css`: scoped popover/row/media styles and legacy-style isolation.
- `site/scripts/check-header-dropdowns.cjs`: isolated browser regression.
- This handoff document.

## Validation

The browser regression uses only local synthetic API/session/product fixtures and never authenticates to or mutates production. It checks:

- Persian and English desktop at **1440px**: unchanged trigger geometry; account routes and actual session name; hover bridge, toggle, real Tab/Shift+Tab entry, arrow entry, Escape, focus return, outside click, single active surface and short-viewport clamping.
- Wishlist current price versus deliberately stale saved price; actual cart additions/increments, stock limit, wishlist removal/empty state and synchronized state.
- Existing mini-cart quantity increase/decrease and corresponding totals; logout/cache/session cleanup while preserving the cart.
- **1024, 768 and 390px** with real touch input: unchanged compact navigation, cart sheet, reuse of all ten account-drawer destinations, backdrop taps, Escape, focus restoration/containment, scroll lock and header/panel bounds.
- Wide touch-screen tap toggles remain open without accidental emulated-hover dismissal.
- Catalog loading, failed reads, disabled stale-price actions and successful retry.

Passed: `node scripts/check-header-dropdowns.cjs`, `npm run lint`, `npm run build`, `npx --no-install tsc --noEmit` and `git diff --check`. Final results and screenshots are retained locally under ignored `artifacts/header-dropdowns/`. Test-owned servers were shut down after completion.

## Limits and unrelated observations

- At 1024px the existing homepage editorial promo cards extend horizontally beyond the viewport; the measured header itself remains within 1024px. Those untouched homepage cards are outside this strict header handoff and were not redesigned. At 390px the document width check also matches the viewport.
- The two existing Sass `@import` deprecation warnings remain; they do not fail the build and are unrelated to the dropdown implementation.
- Authentication enforcement and authoritative checkout prices remain backend responsibilities; no API contracts, permissions, dependencies or database schema were changed.
- No new header/page/account navigation family/cart implementation was created. No commit, push or deployment was performed for this task.
