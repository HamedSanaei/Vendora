# SMS authentication, notifications and support

## Activation and server configuration

### Registered Vendorashop texts and branded ParsGreen OTP

`AddParsGreenBrandedOtpMode` adds one non-destructive Boolean setting, default **off**. Existing installations continue using ParsGreen `SendOtp` until an administrator explicitly selects **Use Vendorashop branded OTP text** and saves SMS settings. Enable it only after ParsGreen has approved the submitted WhiteText patterns and the authorized sender has been configured with `Sms__ParsGreen__SenderNumber` alongside `Sms__ParsGreen__Signature`. Configuration readiness does not certify provider approval or actual delivery. No live settings, credentials or production records are changed by this implementation.

In branded mode, the adapter generates a cryptographically random ASCII six-digit code and sends one `SendGroupSMS` request to one validated recipient. There is no retry or fallback to legacy OTP after ambiguous acceptance. Only a positive acceptance receipt returns the ephemeral code to the existing hash-only challenge flow. Plaintext code-bearing messages are never placed in the outbox/audit body. Existing five-minute expiry, shared budgets, one-use verification and account ownership checks remain in force.

The five immutable template previews are returned by the server. The exact first lines are:

```text
کد ورود شما به وندوراشاپ: {code}
کد ثبت‌نام شما در وندوراشاپ: {code}
کد تأیید شماره همراه شما در وندوراشاپ: {code}
کد بازیابی رمز عبور شما در وندوراشاپ: {code}
کد آزمایشی پیامک وندوراشاپ: {code}
```

Each message ends with a blank line and `@vendorashop.ir #{code}`, repeating the same code. No footer may follow this final line. Registration wording is selected server-side for a phone without a verified owner; login/registration retain their shared challenge and the public response does not reveal account existence. Administrator sign-in and nonexistent-account recovery still use decoy responses, with the same six-digit length in branded mode. Kavenegar keeps its approved Lookup template and is unaffected by the ParsGreen-specific setting.

Notification defaults now match the fourteen submitted branded service texts, including the service test. Only exact former default texts are upgraded on read; custom templates, enabled flags, activation times and already-queued message snapshots are preserved. Review customized texts against provider-approved patterns before enabling them. Read-only OTP previews intentionally prevent accidental divergence from the registered templates; adding an arbitrary textarea would not configure provider approval.

The storefront login, recovery and profile forms and the admin verification/test forms support consent-based WebOTP where available. Listeners start before the SMS request, buffer fast arrivals until the challenge is ready and cancel on failure, manual verification, navigation or a two-minute timeout. They fill fields without automatically submitting them. Safari/native suggestions keep `autocomplete="one-time-code"`, including distribution of a complete suggested code across the existing digit inputs. Manual entry remains available when permission is denied or the browser lacks support. The independent frontend build contexts each contain the small dependency-free transport helper; its lifecycle tests exercise both copies. Autofill requires the page hostname to match the SMS domain; legacy storefront hostnames can still use manual entry. Real handset autofill and carrier approval require live testing and are not claimed by browser mocks.

Reference: [Chrome WebOTP message format](https://developer.chrome.com/docs/identity/web-apis/web-otp#format-the-sms-message).

The existing Online Store administration page includes **SMS & notifications**, with URL-addressable settings, send/test and history tabs. New phone authentication, password recovery and all notification rules default to **off**. Existing authenticated profile-phone verification remains available. Saving a rule establishes its activation timestamp; historical payments and stock levels do not generate a notification backlog.

Configure the following through the deployment's secure configuration mechanism, never the browser or a committed settings file:

```text
Sms__ParsGreen__Signature
Sms__ParsGreen__SenderNumber
Sms__ParsGreen__DeliveredCodes
Sms__ParsGreen__FailedDeliveryCodes
```

`Signature` enables ParsGreen OTP requests. ParsGreen service messages also need an authorized sender number. The UI exposes configuration booleans, not credentials. Service templates, ParsGreen OTP type/pattern ID, selected verified administrators and low-stock threshold are database settings. Both ParsGreen and Kavenegar adapters are installed. There is no automatic provider fallback.

### Kavenegar

Official contract: [REST API, Send, Lookup and Status](https://kavenegar.com/rest.html).
Set these **server-only** values through the secure deployment configuration:

```text
Sms__Kavenegar__ApiKey
Sms__Kavenegar__OtpTemplate
Sms__Kavenegar__SenderNumber
```

- `ApiKey` is required. Do not put it in source, frontend environment variables, admin fields or chat.
- `OtpTemplate` is the English name of an approved Lookup template containing `%token`.
  Lookup requires the appropriate provider account service and approval. The adapter generates a
  cryptographically random six-digit numeric code, posts it to `verify/lookup.json`, and returns
  it only to the existing server-side hashing flow after a valid acceptance receipt. ParsGreen's
  numeric type/pattern fields do not configure Kavenegar and are hidden when Kavenegar is selected.
- `SenderNumber` is optional; blank uses the sender configured as default in the Kavenegar account.
  Service messages use `sms/send.json` and a maximum of 1800 characters. An account's line permissions,
  recipient blocking, balance and URL restrictions still apply; readiness flags do not prove delivery.
- Delivery uses `sms/status.json`: 1/2/4/5 mean accepted/pending, 10 means delivered,
  6/11/13/14 mean failed, and 100/unrecognized values mean unknown. No delivery failure resends a message.
- Requests use TLS and encoded POST bodies. The API key is in the provider-required URL path;
  the dedicated `SmsKavenegar` HttpClient removes default URL loggers and disables redirects.
  Do not enable external full-URL/body capture on this client without credential/OTP redaction.
  Raw provider messages and exceptions are never included in API errors or the SMS audit history.
- Timeouts, malformed/oversized responses and ambiguous acceptance remain unknown without blind retries.
  Explicit provider rejection codes 409/429/451 may use the existing bounded outbox retry schedule.

After configuring the server, open **Store management → SMS & notifications**, select **Kavenegar**,
save settings explicitly, then use **Test & send** with the administrator's verified phone.
The same selected provider serves customer registration/login, phone confirmation, password recovery,
manual service messages and notification outbox entries. Existing queued messages retain their original
provider snapshot when the selected provider changes. No migration or reactivation of historical events
is needed. The development tests use fake HTTP handlers and do not send real messages or test live credentials.

ParsGreen contract references inspected:

- [Official SOAP service](https://login.parsgreen.com/Api/SendSMS.asmx)
- [SendOtp](https://login.parsgreen.com/Api/SendSMS.asmx?op=SendOtp)
- [SendGroupSMS](https://login.parsgreen.com/Api/SendSMS.asmx?op=SendGroupSMS)
- [GetDelivery](https://login.parsgreen.com/Api/SendSMS.asmx?op=GetDelivery)
- [WSDL](https://login.parsgreen.com/Api/SendSMS.asmx?WSDL)

The public WSDL specifies an integer `GetDelivery` result but does **not** define the integer status meanings. Obtain the documented mapping for the actual ParsGreen account before configuring the two comma-separated status-code lists. No numeric meaning is guessed. Without this mapping, an accepted message stays accepted/unconfirmed, never falsely delivered. Delivery polling is bounded to ten checks. Accepted is not proof of delivery to a handset.

The test buttons use the authenticated administrator's own verified number. A code test cannot create a session. Service-message tests and single-account manual sends require an explicit confirmation and an idempotency key. No scheduled or automated test sends real SMS. Live credentials, sender approval, account balance and handset delivery have not been validated by the local tests.

### Troubleshooting an administrator OTP test

A saved phone number is not necessarily verified. If there is no verified phone on the current administrator, the OTP test returns `SMS_VERIFIED_RECIPIENT_REQUIRED` before contacting a carrier or consuming a send budget. **Store management → SMS & notifications** includes **Verify my mobile number**, available in the settings and test tabs. It shows the current administrator's saved phone, sends its initial ownership code and confirms it entirely inside the admin panel. No storefront sign-in is needed. If the phone is missing, edit the current account in the existing Users screen and reload the number in this section. Enable SMS and profile phone verification and save settings before sending. Do not mark a phone verified through a database edit.

The form reuses `GET /api/account/me` and the existing authenticated `POST /api/account/phone/send` and `/confirm` endpoints with the admin bearer session. It never submits a destination phone, user ID or verified flag. Ownership changes only after a valid code; the current account is re-read before showing success, and administrator recipients refresh without discarding settings drafts. Verification and delivery tests share the resend countdown and server budget. A delivery test still cannot verify ownership or create an administrator session.

An empty SMS history following a rejected test is consistent with pre-send validation; it is not evidence of a carrier delivery failure. ParsGreen OTP needs only the configured Signature plus valid OTP type/pattern settings; the separate service-message test additionally requires `Sms__ParsGreen__SenderNumber`. Missing delivery-status mappings do not block sends. The UI distinguishes these failures, preserves drafts and requires settings to be saved before test/send operations. A provider acceptance error is ambiguous: inspect history before retrying, since a network timeout can occur after an SMS was accepted.

## Data and security

Migration: `20261026080116_AddSmsOutboxPhoneAuthenticationAndSupportTickets`.

It adds SMS policy, shared phone budgets, purpose-bound challenges, unique verified-phone ownership, outbox/audit rows, stock-crossing state and tickets/messages. Identity gains previous verified phone and a token-revocation timestamp. Existing data is not deleted. Duplicate legacy verified numbers are reported (masked plus account identifiers); activation is blocked until ownership is manually corrected. Accounts are never automatically merged or reassigned.

- Codes expire after five minutes, permit five proof attempts, and can be resent after 120 seconds.
- The durable budget allows five sends per phone per 30 minutes across login, recovery, profile verification and tests. An additional IP budget applies to public OTP endpoints.
- OTP hashes use Identity's salted password hasher. The private provider OTP return value never enters API responses, outbox bodies or logs. Code length follows the provider's actual 4–8-digit result.
- Purposes cannot be exchanged. New requests invalidate older codes and outstanding recovery grants for that purpose.
- Phone sign-in creates only a Customer account with a genuinely verified phone. It does not invent an email/name. Required profile completion remains enforced by the existing commerce gates.
- An existing unverified phone does not authorize takeover of the older account. The owner must sign in using the previous method and verify it in the profile.
- Admin accounts cannot use phone sign-in or phone password recovery. Administrative email login is preserved.
- Recovery exchanges a proved code for a short-lived, one-time random grant. Only its hash is stored; the client keeps it in component memory, never a URL or localStorage. Identity's internal reset token is never returned. Legacy token-display/reset endpoints are retired.
- Password changes/reset revoke previous sessions. Current JWTs include a security-stamp claim; legacy JWTs remain compatible until explicitly revoked. Profile changes that rotate Identity's stamp return a fresh JWT, which existing profile clients persist.
- Authenticated downloads/other protected endpoints now also enforce the same session validation. No payment proof is created by this feature.

## Outbox and business events

Business notifications are captured in the same transaction as their source operation, using a unique event/recipient key. Templates, policy revision and provider are frozen per row. The worker claims a short optimistic lease, commits, then performs carrier HTTP outside the business transaction. Queued messages are rechecked against current enabled rules and recipient eligibility. No message body, OTP, key or raw vendor response is exposed in history.

States: Queued, Sending, Accepted, Delivered, Failed, Unknown (and Cancelled for disabled/invalidated work). An expired in-flight lease becomes Unknown. Ambiguous acceptance is never blindly retried. A definitely unsent transient rejection can retry after 1, 5 and 15 minutes, at most four attempts including the original. Switching settings does not rewrite old messages or silently use another provider.

Customer rules cover verified payment, shipment, delivery, cancellation, support reply, password/phone changes and verified payment requiring review. Selected actual Identity administrators can receive paid-order, ticket/customer-reply, low-stock and payment-review alerts. Recipient eligibility is checked against Identity roles and verified ownership, not the separate legacy administration user-list records.

Low-stock detection uses the existing available-stock compatibility projection. First activation/configuration establishes a silent baseline. Alerts require a crossing from above the threshold (default five) and have a 24-hour per-product cooldown. Duplicate ownership suppresses customer notifications rather than aborting a commerce transaction.

**Payment boundary:** this repository has no operational gateway callback/verification adapter. Hooks are attached to the accounting consumer of genuine server-side verification evidence. Pending orders, browser return URLs, manual status edits, seeded orders and test references do not trigger successful-payment notifications. Actual gateway verification is a separate feature; this change does not simulate it.

## API and handlers

All controllers delegate to MediatR. Admin routes require Admin authorization; ticket ownership is checked on every customer read/write.

- `GET/PUT /api/admin/store-settings/sms` — `SmsManagement.Read/Save` with optimistic settings version.
- `GET /api/admin/sms/recipients` — verified account choices, masked phones and real role eligibility.
- `GET /api/admin/sms/messages` — paginated masked history, optional status filter.
- `POST /api/admin/sms/send`, `/test` — one verified recipient or the calling administrator, retry-safe key required.
- `POST /api/admin/sms/test-code`, `/test-code/verify` — receipt-only OTP test.
- `GET /api/account/auth-options` — nonsecret capability flags.
- `POST /api/account/otp/request`, `/verify` — customer login/registration.
- `POST /api/account/password/otp/request`, `/verify`, `/reset` — recovery/grant/reset.
- Existing `/api/account/phone/send` and `/confirm` use the common provider/budget/ownership mechanism.
- `GET/POST /api/account/tickets`, `GET /{id}`, `POST /{id}/messages`, `PATCH /{id}/status` — owned support conversations.
- Corresponding `/api/admin/tickets` reads/replies/status actions use staff authorization.

`SmsAuthentication.RequestHandler/VerifyHandler/ResetHandler`, `SmsManagement` handlers and `SupportTickets` handlers contain the use cases. `SessionValidation` centralizes session validity. `SmsNotifications` captures events; `SmsDispatch` handles leases/retry/delivery/stock watches; `ParsGreenSmsGateway` and `KavenegarSmsGateway` are the concrete Infrastructure adapters.

## Tickets

Existing account navigation now links to `/fa/account/tickets`; administration uses `/fa/admin/tickets`. Optional order links must belong to the customer. Subject length is at most 200 and messages at most 3000 characters. Text is rendered as text, never injected HTML. No attachments or customer-message rewriting are supported.

States are WaitingForSupport, WaitingForCustomer and Closed. The other party's reply changes the waiting state. Closed conversations require an explicit reopen before another reply. Version conflicts preserve drafts. Idempotency protects create/reply/status operations; browser retries retain the same operation key. SMS includes only a short notification and safe account link, never the private conversation.

## Local validation

```bash
dotnet build Vendora.slnx
dotnet test Vendora.slnx
cd site
npm run lint
npx tsc --noEmit
npm run build
node scripts/check-sms-support.cjs
cd ../admin
npm run lint
npm run build
node --test scripts/admin-ui.test.mjs
node scripts/check-admin-ui.mjs
```

Backend tests use ephemeral SQLite and an in-memory carrier, including separate file-backed connections for concurrent proof consumption and billed-operation replay. Adapter tests use captured official SOAP shapes and a fake HTTP transport. Browser tests intercept all API calls and block external origins; screenshots/logs are written under `artifacts/sms-support-ui` and `artifacts/admin-ui/after`. They exercise 390/768/1024/1440 layouts plus English routing, retry drafts, touch-size existing controls, settings, code tests and recovery. These tests establish local application behavior, not live provider delivery or a pixel-perfect Penpot comparison.

No production database updates, real SMS sends, Git commits/pushes or deployments are part of this work.

### Validation record — 2026-10-26

- Solution build: passed, zero warnings/errors.
- Full integration suite: 306 passed, zero failed/skipped. After the last test-only assertion for incomplete profiles, the focused support/auth suite also passed all 12 cases.
- EF pending-model check: no changes since the generated migration. The installed EF CLI is 10.0.11 versus runtime 10.0.13; no tool/package upgrade was performed.
- Storefront ESLint, TypeScript and production build: passed. Browser login/OTP, ticket create/retry/close/reopen, recovery and overflow checks passed at 390/768/1024/1440; English login was checked at 768.
- Admin ESLint, TypeScript/production build and five presentation tests: passed. Existing-route checks plus SMS activation/testing/history and support replies passed at all four widths; English routing was checked at 1440. Existing large-bundle warnings remain non-blocking.
- Latest mobile conversation, mobile SMS history and desktop settings screenshots were inspected. Conversation markers/indentation, duplicate mobile title and select/textarea accessible-name issues found by this check were corrected.
- Browser fixtures intentionally block external Google/Stripe scripts and carrier origins. The expected blocked Stripe script rejection is excluded from application-error assertions; no payment/gateway behavior is certified by these UI tests.

### Main changed implementation files

- Domain/persistence: `Domain/Entities/SmsModels.cs`, `Persistence/SmsConfiguration.cs`, `Persistence/AppDbContext.cs`, `Persistence/Identity/AppUser.cs`, the additive migration and model snapshot.
- Application: `Application/Interfaces/ISmsGateway.cs`, `Application/Sms/*`, `Application/Support/SupportTickets.cs`, `Application/Auth/SessionValidation.cs`, existing `Account.cs`/`PhoneConfirmation.cs`, commerce posting/order-status hooks and DI registration.
- Infrastructure/API: `Infrastructure/Auth/ParsGreenSmsGateway.cs`, infrastructure DI, `API/Controllers/SmsController.cs`, `SupportTicketsController.cs`, existing account-controller recovery actions, session validation in `API/Program.cs` and rate-limit registration.
- Admin: `AdminSmsSettings.tsx`, `AdminSupportTicketsPage.tsx`, `api/smsApi.ts`, `api/supportApi.ts`, existing online-store page, layout/routes/navigation/translations, shared select/textarea accessibility, status badges and legacy recovery guidance.
- Storefront: `lib/sms-client.ts`, `lib/support-client.ts`, `auth/sms-password-recovery.tsx`, existing login/OTP components, owned ticket routes/content, existing account navigation/header actions, profile-token persistence, password-change logout, date formatter and legacy recovery routes.
- Validation: `SmsSupportTests.cs`, `SmsGatewayTests.cs`, `site/scripts/check-sms-support.cjs`, `admin/scripts/sms-support-fixtures.mjs`, and extensions to the existing admin browser checker.

Pre-existing shipping policy, pricing, gallery and admin visual changes in the working tree were preserved. They are not newly attributed to this SMS task.
