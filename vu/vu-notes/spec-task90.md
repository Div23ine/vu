### TASK 90 — Notify + PDF worker: notify-queue consumer (e-mail/SMS/in-app), receipts, invoice & report PDFs

**Layer:** L11

**Prerequisites:** Task 25 (queues), Task 32/33 (billing), Task 35 (scans release), Task 40/40c (contact, store e-mails), Task 89 (broadcast worker enqueues `in_app` jobs consumed here).

**Estimated files touched:** 26

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Notify + PDF worker**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

> **Planner note (Part 5 is planner-authored):** Part 2 explicitly deferred this
> worker ("Do not implement push delivery or the notify worker") and the schema
> has NO in-app inbox and NO receipts table — both are created here. The
> reserved scope names two workers (notify + pdf) in one task; **planner
> decision:** they ship as ONE app `apps/notify-worker` with two BullMQ
> consumers (the L13 Helm list gains a `notify-worker` chart — flagged there).
> Push channel: still no provider (Part 2 rule stands) — log and receipt
> `skipped`.

---

**Goal:**
Implement `apps/notify-worker`: consumes the `notify` queue (e-mail via Resend, SMS via the Africa's Talking/Twilio router, `in_app` into a new inbox table, push logged) writing a receipt for every attempt, and consumes the `pdf` queue (invoice PDFs, scan-report PDFs rendered with `@react-pdf/renderer`, uploaded to R2, key stored on the row).

**Deliverables:**

*Shared extractions (workers may not import from `apps/api`; the API keeps working through re-exports):*
- `packages/lib/src/providers/{index.ts,email.ts,sms.ts,error.ts}` — MOVE the contents of `apps/api/src/providers/{email.ts,sms.ts,error.ts}` verbatim (Resend client, SmsRouter, Africa's Talking, Twilio, ProviderError, E.164 helpers). `index.ts` re-exports explicitly (both modules define `PROVIDER_TIMEOUT_MS`; the aliases are `EMAIL_PROVIDER_TIMEOUT_MS` / `SMS_PROVIDER_TIMEOUT_MS`).
- MODIFY `apps/api/src/providers/{email.ts,sms.ts,error.ts}` — become one-line re-exports of `@vunvault/lib/providers`. Existing API tests keep passing untouched.
- MODIFY `packages/lib/src/storage.ts` (MOVED from `apps/api/src/lib/object-storage.ts`) — add `ObjectWriter { put(key, body, contentType) }` as a SEPARATE interface (so the API's `ObjectStorage` fakes do not grow a method) and implement it on `R2ObjectStorage`. MODIFY `apps/api/src/lib/object-storage.ts` → re-export of `@vunvault/lib/storage`.
- MODIFY `packages/lib/package.json` — subpath exports `"./providers"`, `"./storage"`, `"./money"`; deps `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- MODIFY `apps/api/package.json` — add `"@vunvault/lib": "workspace:*"`.
- MODIFY `apps/broadcast-worker/src/adapters/providers.ts` — import from `@vunvault/lib/providers`; DELETE its Task-89 local copies (`adapters/{email,sms,error}.ts`) so provider code exists exactly once.

*Schema (packages/db):*
- MODIFY `packages/db/src/schema/account.ts` — add:
  - `notifications` (in-app inbox): `id` uuid pk default random; `user_id` → profiles ON DELETE CASCADE; `event` notification_event NOT NULL; `title` text NOT NULL check length ≤ 140; `body` text NOT NULL check length ≤ 600; `read_at` timestamptz null; `created_at` (default now). Index `(user_id, created_at DESC)`, partial index `(user_id) WHERE read_at IS NULL`. RLS enabled.
  - `notification_receipts`: `id` uuid pk; `channel` text NOT NULL check IN ('email','sms','in_app','push'); `destination` text NOT NULL (e-mail address, E.164 number or user id); `template` text null (e-mail template name); `status` text NOT NULL check IN ('sent','failed','skipped'); `provider_message_id` text null; `error` text null check length ≤ 300; `created_at`. Index `(created_at DESC)` and `(channel, status)`. RLS enabled. Append-only by convention (no UPDATE anywhere).
- MODIFY `packages/db/src/schema/scans.ts` — `scanJobs` gains `report_object_key` text null (the released-report PDF in R2).
- `packages/db/sql/0090_notifications_inbox.sql` — hand-written migration creating both tables (+ checks/indexes exactly as above) and `ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS report_object_key text`.
- MODIFY `packages/db/src/schema/account.test.ts` (or a new `notifications.test.ts`) — table-shape tests matching existing conventions.

*Worker app (`apps/notify-worker`, scaffolded exactly like `apps/broadcast-worker`: package.json, tsconfig.json, tsconfig.build.json, eslint.config.mjs — copy their shape):*
- `src/config/env.ts` — Zod env: `NODE_ENV`, `LOG_LEVEL`, `REDIS_URL`, `DATABASE_URL`, `RESEND_API_KEY`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (default `''`), `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`, `WEB_ORIGIN` (url), `NOTIFY_CONCURRENCY` (1..32 default 8), `PDF_CONCURRENCY` (1..8 default 2). pino redaction like Task 89 plus `*.R2_SECRET_ACCESS_KEY`.
- `src/ports.ts` — `NotifyRepo` (inbox insert, receipt insert, invoice/report reads + key writes), `EmailSender`, `SmsSender`, `PdfRenderer`, `ObjectStorage` (put only), `Clock`, `Logger`.
- `src/adapters/sql-repo.ts` — drizzle implementation.
- `src/domain/templates.ts` — e-mail template registry + generic fallback (below).
- `src/domain/notify-handler.ts` — per-channel handling, receipts, retryable-vs-permanent classification.
- `src/pdf/theme.ts`, `src/pdf/invoice.tsx`, `src/pdf/report.tsx` — `@react-pdf/renderer` documents (jsx: react-jsx in tsconfig); money rendered with `@vunvault/lib/money` `formatUsd`.
- `src/adapters/renderer.ts` — `ReactPdfRenderer` (`renderToBuffer` behind the `PdfRenderer` port); storage comes from `R2ObjectStorage` (`@vunvault/lib/storage`, which implements `ObjectWriter`).
- `src/domain/pdf-handler.ts` — load → render → upload → store key.
- `src/queue/consumer.ts` — two workers (`notify`, `pdf` queues) sharing one module, scan-worker conventions (malformed payload → permanent fail; graceful close).
- `src/main.ts` — composition root; graceful shutdown (≤ 20 s drain).
- Tests: `src/domain/notify-handler.test.ts`, `src/domain/templates.test.ts`, `src/domain/pdf-handler.test.ts`, `src/queue/consumer.test.ts`, `src/pdf/render.test.ts` (renders both documents with the real renderer to a buffer; asserts `%PDF` header and that no secret/var leaks).

**Dependencies allowed:**
- `apps/notify-worker`: `bullmq`, `ioredis`, `pino`, `zod`, `postgres`, `drizzle-orm`, `@react-pdf/renderer`, `react` (catalog), `@vunvault/contracts`, `@vunvault/db`, `@vunvault/lib` (R2 + providers + money come through lib). Dev: `@types/node`, `@types/react`, `@vunvault/config`, `eslint`, `tsx`, `typescript`, `vitest`.
- `packages/db`, `packages/lib`, `apps/api`: none new.

---

**Notify handling rules:**
1. Parse `NotifyJobPayload` (discriminated union). Malformed → permanent fail, log `error` with jobId only.
2. `email`: render via the template registry → `EmailSender.send`. Success → receipt `{channel:'email', destination:to, template, status:'sent', providerMessageId}`. `ProviderError` with kind `email_invalid_*` (permanent) → receipt `failed` + `UnrecoverableError` (no retry). `email_unavailable`/5xx (transient) → receipt `failed` + throw (BullMQ retries: 3 attempts, exponential backoff — every attempt writes its own receipt row).
3. `sms`: `SmsSender.send` (router picks Africa's Talking vs Twilio). Invalid number (`sms_invalid_number`) → permanent, receipt `failed`. Transient → retryable, receipt `failed`. Success → receipt `sent`.
4. `in_app`: insert `notifications` row (title ≤ 140, body ≤ 600 — truncate with `…` at the limit), receipt `{channel:'in_app', destination:userId, status:'sent'}`. A DB conflict on retry is fine (insert is idempotent per jobId only at queue level; duplicates are acceptable and noted in the file header).
5. `push`: the queue contract has NO push member — the dispatcher logs push opt-ins itself (Part 2 rule) and never enqueues, so the worker cannot receive one. The receipts table still allows `skipped` so the channel can grow a real path later without a migration.
6. Unknown e-mail template: **never dropped** — render the generic fallback, send, log `warn` `unknown_template`.

**Template registry (planner-authored copy; `vars` are the exact keys producers send — verify each against its producer at implementation time and list every template name in the file header comment):** `contact_received`, `contact_acknowledged`, `licence_granted`, `invoice_issued`, `credentials_changed`, `payment_receipt`, `payment_failed`, `threat_level_change`, `content_remind_author`, `content_publish`, `content_schedule`, plus any OTP/verification templates found enqueued by `auth`/`account-security` routes. Each entry: `{ subject(vars), text(vars), html?(vars) }`; subjects are prefixed `[VUNVAULT] `. Fallback: subject `[VUNVAULT] Notification (<template>)`, body = one `key: value` line per var (values truncated to 200 chars), footer `—\nVUNVAULT · Automated notification, do not reply.`

**PDF rules:**
- `invoice`: load invoice (`number`, `title`, `detail`, `status`, `issuedAt`, `dueAt`, `settlementCurrency`), its lines (`description`, `quantity`, `unitUsdCents`) and the org (`name`, `clientCode`). A4 document: header bar brand `#3B99FC` on dark `#0A0D12` with the wordmark VUNVAULT; `INVOICE <number>`; issued/due/status block; bill-to org name + client code; lines table (description, qty, unit USD, total USD — cents rendered via the existing money formatter convention `$X,XXX.XX`); total row; footer `VUNVAULT Ltd · Nairobi · Settlement currency USD · Generated <ISO date>`. Upload to `invoices/<number>.pdf`; set `invoices.pdf_object_key`.
- `report`: load scan job (`jobCode`, `targetHost`, `scanType`, `status`, `releasedAt`), latest run, released findings; same theme; sections: job summary block, findings table (severity, title, host/port or endpoint, remediation short), `Findings: <n> (critical <c>, high <h>, medium <m>, low <l>, info <i>)` line; footer `VUNVAULT Ltd · Report <jobCode> · Generated <ISO date>`. Upload to `reports/<jobCode>.pdf`; set `scan_jobs.report_object_key`.
- Both: content type `application/pdf`; a missing row → permanent fail with log `error`; storage failure → retryable throw. Idempotent by key (overwrite).

**Tests (assert):** every channel writes exactly one receipt per attempt with the right status; transient e-mail failure retries (two attempts → two `failed` receipts then `sent`); invalid SMS number is permanent (bullmq `UnrecoverableError` path via fake job); in-app truncates title/body at the limits; push is `skipped` and never throws; unknown template uses the fallback and logs `warn`; invoice PDF renders (buffer starts `%PDF`), uploads to the exact key and sets the column; report PDF counts findings by severity correctly; malformed payloads permanently fail; graceful shutdown drains in-flight jobs (fake timers).

**Out of scope:** reading the inbox from the API/UI (a later portal task); push provider; changing any producer; API download routes for `report_object_key` (billing's invoice download already exists and keeps working).

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck|lint|test` pass (new tables + migration file present).
☐ `pnpm --filter @vunvault/lib typecheck|lint|test` pass.
☐ `pnpm --filter api typecheck|lint|test` pass (re-exports keep them green).
☐ `pnpm --filter notify-worker typecheck|lint|test` pass with zero errors.
☐ Output: `Task 90 complete. Files created: <list>. Files modified: <list>. Dependencies: <list>`.
