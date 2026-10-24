# Account sidebar and public-domain Google login fix

## Confirmed production diagnosis

The user reported Google login failure at `https://vendorashop.ir/fa/account`. Read-only inspection of that page's public compiled Axios chunk found `https://vendora.tofanservice.ir` baked into its base URL. An OPTIONS probe with origin `https://vendorashop.ir` to the token-exchange path on both public hostnames returned 204 without an `Access-Control-Allow-Origin` header. The browser therefore could not read the cross-origin Vendora token-exchange response, even if the Google account selection itself succeeded.

The site build now uses `/api` through its existing same-origin gateway. SSR has a separate private API origin configured in production Compose. Catalog image paths, legacy order calls and newsletter calls share the transport so the relative configuration does not regress existing consumers. JSON-LD/Open Graph image URLs remain absolute through the canonical site origin. Google JWT signature, issuer, expiry and audience validation remain mandatory; neither wildcard CORS nor unsigned Google claims were introduced.

Safe Google error messages now distinguish an unreachable service, missing API configuration, invalid/expired credential and a required explicit link to an existing password account. No credential or provider payload is logged/echoed.

## Sidebar

The shared desktop sidebar had a fixed 700px height and hidden overflow despite ten navigation entries plus an exit action. Its existing exit button and the final entries were clipped. It now grows with its content, resets legacy list bullets/padding, displays the current session's name and keeps the existing route/translation/icon model.

The same mobile drawer keeps a scrollable menu and a separate exit action. Resizing to the desktop breakpoint closes the drawer and releases its body scroll lock. Logout clears auth and RTK query caches, preserves cart state, and returns to the localized login page.

## Validation / release boundary

- Backend: 279 tests passed; no new database changes were needed for these two fixes (the preceding profile-verification feature still has its own pending additive migration).
- Four Node built-in tests verify same-origin aliases, SSR/development API roots, public uploads and safe Google failure copy.
- Site lint/build passed with `NEXT_PUBLIC_API_BASE_URL=/api`.
- Browser QA uses a synthetic account and a dedicated local database behind a loopback reverse proxy. Its public origin is intentionally absent from the API's CORS allowlist: successful login/account requests through the same-origin proxy verify that the fix does not depend on broadening CORS.
- Desktop inspection confirms ten links, an un-clipped exit button and no list markers. Logout is tested through the actual UI. Mobile/tablet and English compatibility are checked using the same components.
- The shared menu was inspected at 390/768/1024/1440 pixels. At 1024px, the exit button remains inside the sidebar and can be reached above the fixed bottom navigation by normal page scrolling. Resizing an open drawer to desktop removes the drawer and restores body scrolling. Both Persian and English logout return to the corresponding login route. QA screenshots are under ignored `artifacts/google-fix/`.

The build/Compose changes require an approved rebuild and deployment before the live site's old JavaScript changes. A real personal Google account was not used for QA. No production configuration/data was changed and no commit, push or deployment was performed for this fix.
