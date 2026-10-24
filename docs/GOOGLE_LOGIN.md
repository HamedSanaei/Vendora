# Google sign-in (Vendora storefront)

Google Identity Services (GIS) supplies a short-lived ID token in popup mode. The frontend exchanges it at `POST /api/account/google`; the API **validates Google's signature, audience, issuer, expiry and verified email** before issuing its own Vendora JWT. No Google client secret is used or stored in the browser.

Google sign-in does not bypass customer identity completion: required personal fields and a separately verified mobile are required before new purchases/services. See [customer-completion.md](customer-completion.md) for ParsGreen configuration and the shared server policy.

## Google Cloud configuration (operator action required)

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Configure the OAuth consent/branding screen and set publishing status appropriately.
2. Create an **OAuth Client ID** of type **Web application** (or use a client you control).
3. Add the exact **Authorized JavaScript origins** for the storefront domains you serve, e.g.
   - `https://vendorashop.ir`
   - `https://vendora.tofanservice.ir` (only if login is offered there)
   - `http://localhost:3000` (only for local development)
4. **No Authorized Redirect URI is needed**: GIS `popup` mode returns an ID token to the JavaScript callback, not to a Google redirect endpoint.
5. Set the **same Client ID** in both runtimes:

   - Storefront build: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com`
   - API runtime: `Google__ClientId=...apps.googleusercontent.com` (ASP.NET configuration `Google:ClientId`)

   Do not put private keys, service account credentials, or a Google client secret in `NEXT_PUBLIC_*` variables. The Client ID is public.

6. Production: set repository Actions variable `VENDORA_GOOGLE_CLIENT_ID`, which the image-build workflow passes as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Keep `Google__ClientId` in `/opt/vendora/deploy/env/production.env` with root-only permissions (`0600`) for the API runtime. Local development: set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `site/.env.local` and set `Google:ClientId` with .NET user-secrets for the API. Rebuild and redeploy the **site** to embed the `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and restart/redeploy the **API** to load `Google__ClientId`. Test via the actual public HTTPS origin; changing an already built Next.js container's environment is insufficient.
7. Verify `POST /api/account/google` rejects random credentials, that a first-time Google login creates only a Customer, and that subsequent logins resolve to the same account.

## Same-origin API routing after a public domain change

The public `vendorashop.ir` build previously contained `https://vendora.tofanservice.ir` as its Axios base URL. An OPTIONS probe from `Origin: https://vendorashop.ir` received no `Access-Control-Allow-Origin` from either public API hostname. Thus the Google callback could succeed at Google while the browser could not read Vendora's token-exchange response.

Production site builds now use `NEXT_PUBLIC_API_BASE_URL=/api`. Requests go through the current storefront hostname and the existing gateway `/api/` proxy; no permissive CORS change is needed. Next server rendering separately uses `API_INTERNAL_BASE_URL=http://vendora-api:8080`, set in production Compose. Upload paths remain public root-relative paths, and metadata/Schema resolve them against the configured canonical site origin. Development may continue using an absolute `http://localhost:5020` API base.

Rebuild/redeploy the site and apply the updated Compose environment through the normal approved deployment process. Merely restarting an old site image does not remove the old hostname baked into its JavaScript. The Google OAuth client's Authorized JavaScript origins must also include the actual HTTPS storefront origin; token signature/audience verification is unchanged.

Safe error codes distinguish missing server configuration (`GOOGLE_NOT_CONFIGURED`), invalid/expired credentials (`GOOGLE_TOKEN_INVALID`) and provider network failure (`GOOGLE_UNAVAILABLE`). Neither credentials nor provider response bodies are echoed to customers.

## Existing password accounts

Google sign-in never silently merges accounts based only on a matching email. For an existing email/password account:

1. Sign in using the existing password.
2. Open **Account → Security → Connect Google account**.
3. Pick the matching Google account and approve. Google `sub` is stored using ASP.NET Identity's existing `AspNetUserLogins` table, so no schema migration is required.
4. After linking, subsequent Google logins use the existing account and existing role.

If the Google email differs from the Vendora account email, linking is rejected. Admin privileges are never granted during a new Google registration.

## Validation and troubleshooting

- If the Google button does not appear, check that `NEXT_PUBLIC_GOOGLE_CLIENT_ID` was included **at build time** and that the site's build was deployed.
- If Google reports `The given origin is not allowed for the given client ID`, add the exact HTTPS hostname in Authorized JavaScript origins.
- If the frontend receives an HTTP 400, ensure the backend Client ID is **identical** and deployed, and verify CSP, CORS, and the token expiry.
- The browser sends the ID token to Vendora's API only. Never log raw credentials or include them in error messages.
- Keep the email/password flow as a fallback. Test Persian and English layouts and both desktop and mobile.
