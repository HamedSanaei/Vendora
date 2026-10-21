# Admin asset loading and deployment recovery

## Cause

An already-open Vite application may request a lazy editor chunk from a previous release. The original admin nginx SPA fallback returned `index.html` with HTTP 200 for a missing `/assets/*.js` path. The production edge then cached this HTML under the JavaScript URL. Retrying the same rejected `React.lazy` instance does not load a new module graph.

The reported old editor URL was checked read-only: HTTP 200, `Content-Type: text/html`, `Cache-Control: max-age=14400`. The current HTML referenced a different editor chunk that returned actual JavaScript. No production configuration or data was modified while diagnosing this issue.

## Fix

- The admin container serves HTML with `Cache-Control: no-store`, including localized direct SPA links.
- Existing hashed assets receive immutable cache headers. Missing generated assets return a real HTTP 404 with `Cache-Control: no-store`, never the SPA document.
- Product and category editors share a local error boundary. An editor import failure does not unmount or clear the rest of the form.
- A module-load error offers an explicit full-page reload. The inline confirmation warns about unsaved changes and can be cancelled without losing form state. There is no automatic reload loop.
- Ordinary rendering errors retain in-place retry. Fallback copy follows `/fa` or `/en`; raw module URLs are logged to the console, not shown as the main UI.

## Checks

Run from `admin` with the existing Node runtime:

```bash
node --experimental-strip-types --test scripts/module-load-error.test.mjs
npm run lint
npm run build
docker pull nginx:1.27-alpine
node scripts/check-static-assets.mjs
```

The nginx check reads the real Dockerfile configuration and runs it with the built assets in a disposable, network-isolated nginx container. It checks SPA/HTML cache headers, real JavaScript MIME and cache headers, missing JS/CSS 404 responses, and the health probe, then removes only its own container and temporary configuration.

Browser QA used an isolated local product fixture with a deliberately missing editor chunk. It verified that the form remained available, cancelling reload preserved an edited title, confirming reload recovered the real editor at the same route, and English LTR still worked. No product was saved by this QA flow.

## Rollout

Rebuild and deploy the admin image to apply the nginx change and the frontend recovery UI. Until then, save or copy any unsaved form inputs and refresh the currently affected page to fetch the latest HTML. A source-code fix cannot change an already-loaded old bundle. Existing incorrectly cached old asset URLs are no longer requested after a fresh current document; if CDN rules override origin cache headers, review those rules separately rather than silently changing account-wide caching settings.

Reference: [Vite load error handling](https://vite.dev/guide/build#load-error-handling).
