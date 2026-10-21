# Product discussions

## Behavior

- Public reads are available for active products. All writes require an existing authenticated account.
- Each account has one editable review per product, protected by a unique database index. Text is required; a 1–5 integer rating is optional.
- A verified payment and a delivered order containing the product grant buyer status. Cancelled/refunded orders do not qualify. Eligibility is derived from current server data, never request flags. Historical ratings lose public effect if eligibility is lost.
- Questions accept multiple direct answers, not nested replies. The server marks answers created by an Admin as official.
- Content is immediately visible. Admins can hide/restore entries at `/fa/admin/discussions`; editing a hidden review does not republish it. Hidden questions suppress all their public answers without modifying each answer's own visibility.
- Public payloads contain display names but no email, phone, user ID, or order details. Text is rendered as plain text, never HTML.

## API

- `GET /api/products/{productId}/discussion?kind=review|question|answer&page=1&questionId=...`: ten entries per page, newest first. Answers require a visible matching question.
- `GET .../discussion/me`: authenticated review and rating eligibility.
- `PUT .../discussion/review`: `{content, rating}` upsert for the authenticated author.
- `POST .../discussion/questions`: `{content}`.
- `POST .../discussion/questions/{questionId}/answers`: `{content}`.
- `GET /api/admin/discussions?kind=...&productId=...&hidden=...&page=...`: Admin-only moderation list.
- `PATCH /api/admin/discussions/{kind}/{id}/visibility`: Admin-only `{hidden}`.

Writes share a five-per-minute fixed-window account budget. Errors use 400 for invalid input, 401 for missing identity, 403 for ineligible rating, 404 for unavailable product/question, 409 for conflicting review insertion, and 429 for posting limits. Failed writes preserve client drafts. The current limiter is process-local; a future multi-instance deployment needs a shared limiter or matching gateway policy.

## Deployment and verification

Apply the additive `AddProductDiscussions` migration through the existing backed-up migration deployment workflow before serving the updated API. It only creates discussion tables, constraints and indexes; no existing data is rewritten. No production database was modified during implementation.

Catalog list/search/detail summaries use one grouped database query per catalog batch. Only visible, eligible ratings contribute to averages. Product HTML contains real counters and JSON-LD includes `AggregateRating` only when at least one qualifying rating exists.

Automated HTTP/SQLite coverage lives in `ProductDiscussionTests`. Frontend checks use the existing lint/build scripts, with no added test dependencies. Browser QA uses the isolated article-editor QA database and seeded local test accounts; its sample comments/questions are not production data.

Browser QA covered guest login/return, unrated comments, delivered-buyer badge, keyboard selection and saving of a four-star rating, a question and official admin answer, hide/restore, actual JSON-LD, Persian widths 390/768/1024/1440, and English LTR storefront/admin smoke checks. The existing admin build still reports its non-blocking large-chunk warning.
