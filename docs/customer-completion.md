# Customer identity completion and verified mobile

## Behavior

The existing Google Identity Services flow is preserved: verified Google subject identifies an account; an initial login creates a Customer, and an existing password account is linked only by an authenticated explicit action. Google sign-in does not confer phone verification or commerce eligibility. Email/password accounts use the same completion policy.

After sign-in/registration, incomplete customers are sent to the existing account profile screen. Required fields are first name, last name, email and Iranian mobile. Shipping continues to validate its own recipient/address/postal-code fields. A Google display name is not silently split into required personal identity fields; supplied given/family names can be used, and missing values must be entered.

The profile screen now reads and saves actual Identity data rather than demo defaults. Users explicitly save details, request a code to the saved mobile, and verify it. Editing a mobile clears `PhoneNumberConfirmed`; an unchanged number retains confirmation. Profile changes also invalidate outstanding challenges through the Identity concurrency stamp. Client-supplied confirmation flags are ignored.

The existing Cart, CheckoutStepper, shipping/payment components and state remain in use. No Penpot changes or layout redesign was performed. The profile return path is restricted to safe locale-local paths; cart/shipping data is preserved.

## Server boundaries

- `GET /api/account/me`, email/Google login, and profile save include additive `completion` facts: first/last name, verified-phone flag and current completion Boolean.
- `PUT /api/account/profile` accepts optional additive `firstName` and `lastName`; omitted new fields do not erase prior names. New UI supplies both explicitly.
- `POST /api/account/phone/send`: authenticated, sends only to the saved phone; no phone/account ID supplied by the browser is trusted.
- `POST /api/account/phone/confirm`: authenticated, accepts only the code.
- New orders, customer proformas and customer discussion writes check current persisted completion facts. `403 PROFILE_INCOMPLETE` cannot be bypassed by editing Redux/localStorage/JWT display fields.
- Existing order/document reads and authenticated PDF downloads remain available. Login, profile, security and address-book management remain available so an incomplete account can recover and finish setup. Official admin answers remain possible without imposing a storefront profile gate on admin operations.
- This change does not replace the separate legacy admin `UserAccounts` directory or implement additional account-directory synchronization.

## ParsGreen configuration

Reference: [official SendOtp documentation](https://www.parsgreen.com/web-service/وب-سرویس-ارسال-کد-پیامکی-api-پیام-کوتاه) and the published HTTPS WSDL at `https://login.parsgreen.com/Api/SendSMS.asmx?WSDL`.

The adapter uses the published SOAP contract over TLS: `SendOtp(signature, mobile, Lang="fa", otpType=1, patternId=3)`. Only provider result `1` and a 4–8 digit numeric OTP are accepted. XML parsing rejects DTDs and is size-bounded. Redirects are disabled; there is no HTTP downgrade, certificate bypass, SDK addition or automatic retry that could duplicate SMS charges.

Set the digital signature from ParsGreen's Web Service panel in secure **API** configuration:

```text
Sms__ParsGreen__Signature=<operator-provided digital signature>
```

Do not put it in the frontend, `NEXT_PUBLIC_*`, Git, chat, or a public settings endpoint. Existing Google Client ID configuration remains as documented in [GOOGLE_LOGIN.md](GOOGLE_LOGIN.md). Real Google consent/client setup and SMS account activation are operator actions; source changes cannot provision vendor accounts.

Missing/invalid SMS configuration or delivery failure never confirms a phone or reports success. Because verified mobile is now mandatory for new commerce actions, configure ParsGreen before enabling this release for customers. No real credentials were configured or real SMS messages sent during development.

## Persistence and limits

Additive migration: `20261024170634_AddCustomerIdentityAndPhoneVerification`. It adds nullable first/last names to Identity users and a separate one-row-per-user verification table. It does not change existing orders/payments or mark old phones verified.

OTP values are held only long enough to derive an ASP.NET Identity salted password hash; plaintext codes/provider payloads are never returned or logged. Challenges expire after five minutes, permit five guesses, impose a two-minute resend cooldown and five sends per account per thirty-minute window. Counters survive restarts. An additional API budget allows twelve calls per account/minute. Failed delivery still consumes its send budget; an old code is invalidated before delivery is attempted. A concurrency token arbitrates racing sends/confirmations. Consuming a code and setting the Identity flag occur in one EF SaveChanges transaction.

## Validation and limits of verification

- Isolated SQLite/HTTP tests verify guest rejection, saved-phone binding, server-owned flags, replay rejection, salted-hash persistence, expiry, attempts/resends, failed/unconfigured SMS, stale concurrent consumption, profile edits and blocked commerce/content writes without mutations.
- The actual ParsGreen XML adapter is tested against an in-memory HTTP handler using the published contract, including negative result/invalid code handling. No real vendor request is sent by the tests.
- Actual Google OAuth and real SMS delivery require operator credentials/consent and were not exercised with a real customer account. No fake production login/token/verified phone was introduced.
- Existing backend suites and both frontend lint/build checks are run; browser checks use only a dedicated synthetic account/database under ignored `artifacts/auth-profile/`.

Final results: `dotnet test Vendora.slnx --no-restore` passed all 278 tests (zero failures), including a leading-zero OTP regression and stale concurrent confirmation. The build succeeded; the EF model has no pending changes. `site` and `admin` lint/build passed (admin retains its existing large-bundle advisory). Browser QA verified a real local email login redirect to profile, persisted profile fields after reload, safe missing-SMS feedback and direct shipping access being redirected until verification. The profile was inspected at 390/768/1024/1440 pixels without horizontal overflow; new action buttons are 48 pixels tall. English profile LTR was smoke-tested. Real Google consent and live ParsGreen delivery remain operator-dependent and were not claimed as tested.

No production migrations, data updates, commit, push or deployment were performed for this feature.
