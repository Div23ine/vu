# VUNVAULT — Task Catalogue for coder.qwen.ai

## Part 5 of 5 — L11 workers, L12 real-time wiring, L13 DevOps, L14 integration & hardening (Tasks 88b–110)

## What changed in this part (read first)

**Final part.** It contains L11 background workers, L12 real-time wiring, L13 DevOps and L14 integration/hardening. With it the catalogue is complete: **129 tasks** (Part 1: 20 · Part 2: 23 · Part 3: 32 · Part 4: 31 · Part 5: 23). Run order is simply the numeric/alphabetic order inside each part: `88 → 88b → 89 …`.

**Additions the earlier parts implied but did not yet cover**
- **88b — `@vunvault/server-kit`.** The workers need the same secrets, e-mail/SMS, audit and notification code the API has. Rather than duplicate it, Task 88b *moves* those files into a shared package (a mechanical refactor with unchanged tests). Do not skip it: Tasks 89–92 import from it.
- **90 — in-app notifications.** Parts 2–4 enqueue `in_app` notifications but nothing stored them. Task 90 adds the table and two read endpoints. **There is still no notification-bell UI** (no prototype); say so if you want it planned.
- **90 — report PDFs.** Released scan reports now have a generator and a download route; the portal's report page doesn't link to it yet (a one-line follow-up).
- **102 — origin lock.** The edge Worker adds a secret header that the API requires in production, and the API only trusts `cf-connecting-ip` when it is present, so client-IP spoofing and bypassing Cloudflare are both blocked.
- **100 — scan network.** The scan VCN is separate from OKE with no peering. Because OCI firewall rules are allow-lists only, the scan nodes are allowed out to the public IPv4 space only: a script computes the 103 public CIDRs that remain after removing private/reserved ranges.
- **104 — private clusters.** CI reaches both Kubernetes API servers through OCI Bastion port-forwarding; there is no public API endpoint.

**Decisions to confirm**
1. **App secrets are read straight from OCI Vault by each pod** (workload identity). External Secrets Operator is used only for the origin TLS certificate. On the k3s scan cluster, the controller's two secrets are a Kubernetes Secret created by Terraform from Vault values, so the Terraform state contains secrets and must be treated as sensitive (private, versioned, encrypted bucket).
2. **Cloudflare Pages needs `@cloudflare/next-on-pages`**, so every web route that is not static must be edge-compatible (this was a convention from Task 41). Some Node-only code in the web app would fail at build.
3. **Action SHA pinning** is automated in Task 108 (a pinning bot opens a PR); the CI in Task 103 starts on version tags.
4. **E2E uses fake providers**, never real Stripe/Paystack/etc. Real-money verification is a go-live checklist item (Task 110): a live USD transaction, then refunded, and written confirmation from Paystack that USD M-Pesa works on your merchant account.
5. **Nothing in the go-live checklist is pre-ticked**; legal pages, the external penetration test and on-call staffing are human tasks.
6. **Not planned (no prototype supplied):** notification bell UI, Academy course pages, `/team/*`, the floating AI Security Agent button, customer-side scan agent for private networks.

**Operator pre-steps for this part:** create the OCI/Cloudflare accounts and deployment users; run the Terraform stacks in the order documented in `docs/deploy.md` (Task 104); set the Vault secret values; set repository variables for the Docker base-image digests and scan-tool checksums; create GitHub environments (`staging`, `production` with required reviewers).


## Sequence Overview (this part)

| # | Layer | Task title | Depends on | Files touched |
|---|---|---|---|---|
| 88b | L11 | Extract `@vunvault/server-kit`: shared server code for the API and workers (mechanical move, no behaviour change) | Task 22, Task 25, Task 29, Task 37, Task 38, Task 40g, Task 88 | 34 |
| 89 | L11 | Broadcast worker: zero-day advisory delivery (dashboards, e-mail, SMS, retraction) with idempotent deliveries and live progress | Task 20b, Task 38, Task 88b | 18 |
| 90 | L11 | Notify and PDF workers: e-mail / SMS / in-app delivery, invoice and report PDFs | Task 29, Task 32, Task 35, Task 88b, Task 89 | 26 |
| 91 | L11 | Maintenance worker A: scheduler, metrics rollup, node-health sweep, threat level, scheduled publish, outbox re-enqueue | Task 20b, Task 36, Task 37, Task 38, Task 88b, Task 89 | 22 |
| 92 | L11 | Maintenance worker B: retention purges, invitation expiry, dormant accounts, stale signups, upload processing, daily audit snapshot | Task 28, Task 36, Task 40d, Task 91 | 22 |
| 93 | L12 | Audit live stream (SSE): LIVE indicator, live row insertion, pause/resume, chain pill | Task 39, Task 83b | 9 |
| 94 | L12 | Advisory real-time: client push stream and admin broadcast progress stream (API SSE + web consumers) | Task 38, Task 39, Task 45, Task 82, Task 89 | 14 |
| 95 | L12 | Scan WebSocket relay in the API: Redis → WebSocket, replay, whitelisted control messages | Task 25, Task 35, Task 84, Task 88, Task 94 | 12 |
| 96 | L12 | Live scan terminal in the admin Scan Queue (WebSocket client) | Task 77, Task 95, Task 48 | 10 |
| 97 | L13 | Container images: hardened multi-stage Dockerfiles, buildx bake file, and a Dockerfile policy checker | Task 4, Task 25, Task 88, Task 89, Task 91 | 12 |
| 98 | L13 | Helm charts for OKE: shared library chart, API, broadcast worker, maintenance worker (External Secrets from OCI Vault) | Task 97, Task 89, Task 91, Task 23 | 40 |
| 99 | L13 | Helm chart for the k3s scan cluster: controller, isolated scan namespace, RBAC, default-deny policies | Task 86, Task 88, Task 98 | 22 |
| 100 | L13 | Terraform for Oracle Cloud: OKE, isolated k3s scan network, Vault, Registry, IAM, Bastion | Task 97, Task 98, Task 99 | 34 |
| 101 | L13 | Terraform for Cloudflare: Pages, DNS, TLS/origin lock, WAF and rate limits, R2 buckets (with audit lock), Logpush, Turnstile | Task 100, Task 92 | 22 |
| 102 | L13 | Cloudflare edge Worker (`apps/edge`): API reverse proxy, request metrics to Analytics Engine, origin verification | Task 23, Task 91, Task 101 | 20 |
| 103 | L13 | GitHub Actions CI: verify, build, test, and security scanning (SAST, secrets, dependencies, Docker, Helm, Terraform) | Task 97, Task 98, Task 99, Task 100, Task 101 | 14 |
| 104 | L13 | GitHub Actions CD: sign and push images to OCIR, migrate, Helm deploy to OKE and k3s via Bastion, deploy edge and web, smoke tests, rollback | Task 102, Task 103 | 20 |
| 105 | L14 | E2E platform: local stack, fake providers, seed users with MFA, Playwright fixtures, smoke specs | Task 26, Task 27, Task 32, Task 40e, Task 58, Task 62, Task 88, Task 104 | 30 |
| 106 | L14 | E2E: money flows and content pipeline (USD checkout, FX quote, M-Pesa via Paystack, licences, contact → badge → studio → moderation → blog) | Task 66b, Task 70, Task 72, Task 73, Task 83, Task 83e, Task 90, Task 105 | 14 |
| 107 | L14 | E2E: security properties — release lock, review gate, payment lock, scan terminal, audit chain, advisories broadcast, RBAC and CSRF | Task 31, Task 35, Task 39, Task 78, Task 82, Task 83b, Task 93, Task 94, Task 95, Task 96, Task 105 | 16 |
| 108 | L14 | Security hardening: Sentry everywhere, CSP reporting, Semgrep policy rules, action SHA pinning, security.txt, ZAP baseline | Task 43, Task 103, Task 104, Task 107 | 26 |
| 109 | L14 | Observability: Prometheus metrics, OpenTelemetry traces, Grafana Cloud agent, dashboards and alert rules as code | Task 98, Task 99, Task 102, Task 104, Task 108 | 34 |
| 110 | L14 | Closeout: runbooks, key rotation and audit-snapshot verification tools, scan kill switch, load tests, ADR index, go-live checklist | Task 92, Task 104, Task 107, Task 108, Task 109 | 26 |

---

### TASK 88b — Extract `@vunvault/server-kit`: shared server code for the API and workers (mechanical move, no behaviour change)

**Layer:** L11

**Prerequisites:** Task 22, Task 25, Task 29, Task 37, Task 38, Task 40g, Task 88

**Estimated files touched:** 34

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Extract `@vunvault/server-kit`: shared server code for the API and workers (mechanical move, no behaviour change)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create a new workspace package that holds the server code both the API and the background workers need — secrets providers, e-mail/SMS providers, the audit service, the notification dispatcher, client-matching and threat-level logic — by MOVING files from `apps/api` and re-pointing the API's imports.

**Deliverables:**
- `packages/server-kit/package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/index.ts` — new workspace (`name: "@vunvault/server-kit"`, `type: "module"`, JIT TypeScript exports like the other internal packages, scripts `typecheck`/`lint`/`test`; extends the shared configs; `eslint.node.mjs`).
- MOVE `apps/api/src/lib/secrets/provider.ts` → `packages/server-kit/src/secrets/provider.ts` (and its test) and add `createSecretProvider(env)` (returns the OCI Vault or env provider exactly as `apps/api/src/plugins/secrets.ts` chose it).
- MOVE `apps/api/src/providers/email.ts`, `sms.ts` (+ `providers.test.ts`) → `packages/server-kit/src/providers/`.
- MOVE the whole `apps/api/src/audit/` folder EXCEPT `audited.ts` → `packages/server-kit/src/audit/` (`canonical.ts`, `crypto.ts`, `events.ts`, `repo.ts`, `service.ts`, their tests). `audited.ts` stays in the API and imports from the kit.
- MOVE `apps/api/src/lib/notify.ts` (+ test) → `packages/server-kit/src/notify/dispatcher.ts`.
- MOVE `apps/api/src/routes/v1/advisories/matching.ts` (+ test) → `packages/server-kit/src/advisories/matching.ts`.
- MOVE `apps/api/src/routes/v1/dashboard/threat-level.ts` (+ test) → `packages/server-kit/src/threat/threat-level.ts`.
- `packages/server-kit/src/db.ts` — `createDbFromSecrets(secrets)` helper (reads `DATABASE_URL`, calls `createDb`) and `type Tx`.
- `packages/server-kit/src/redis.ts` — `createRedis(url)` with the Upstash/BullMQ options from Task 22 and `queueNames`/default job options re-exported from `@vunvault/contracts`.
- MODIFY every file in `apps/api/src/**` that imported a moved module — change only the import specifier to `@vunvault/server-kit` (no logic edits). List each modified file in your report.
- MODIFY `apps/api/package.json` — add `"@vunvault/server-kit": "workspace:*"`; MODIFY `apps/broadcast-worker/package.json` and `apps/maintenance-worker/package.json` — add the same dependency plus `@vunvault/db` and `@vunvault/contracts` (workspace).
- MODIFY `apps/api/src/conformance/route-table.test.ts` — update the text-scan root so it still scans the moved audit source for update/delete function names (add `packages/server-kit/src/audit`).
- MODIFY `docs/adr/0001-audit-chain.md` — one line recording the new location.

**Dependencies allowed:**
- Move the third-party dependencies (`oci-common`, `oci-secrets`, `ioredis`, `bullmq` types only as needed) from `apps/api/package.json` to `packages/server-kit/package.json` where the moved code uses them; keep them in the API only if the API still imports them directly.
- Nothing new.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI. **This is a refactor: behaviour, public function signatures and tests must be IDENTICAL.** Use `git mv` semantics (create the file at the new path with the same content, delete the old one).

**Package surface (`src/index.ts` re-exports, grouped):** `secrets` (`SecretProvider`, `SECRET_NAMES`, `EnvSecretProvider`, `OciVaultSecretProvider`, `createSecretProvider`), `providers` (`EmailProvider`, `ResendEmailProvider`, `SmsProvider`, `AfricasTalkingSmsProvider`, `TwilioSmsProvider`, `SmsRouter`, `ProviderError`), `audit` (`AuditService`, `AUDIT_EVENTS`, `AuditEventType`, `canonicalJson`, key-ring helpers), `notify` (`NotificationDispatcher`), `advisories` (`matchClients`, estimator), `threat` (`computeThreatLevel`), `db`, `redis`.
**Rules:** the kit may depend on `@vunvault/db` and `@vunvault/contracts` and on third-party libraries, but NEVER on `apps/*` and NEVER on Fastify (`audited()` and every plugin stay in `apps/api`). `AuditService` must not import anything from Fastify. The notification dispatcher takes a `Queue`-like interface (`{ add(name, data, opts): Promise<unknown> }`) rather than the API's `app.queues`; the API adapts it.
**API adaptation:** where the API previously used `app.notify`, keep the decorator but construct it from the kit's dispatcher; `app.audit` wraps the kit's `AuditService`.

**Tests (assert):** `pnpm --filter api test` passes with the same number of tests as before this task (state the count before/after in your report); `pnpm --filter @vunvault/server-kit test` passes; `pnpm -r typecheck` passes; a text test in the kit fails if any file under `packages/server-kit/src` imports `fastify` or a path containing `apps/`; no file remains at the old paths.

---

**Data shape (TypeScript):**
```ts
interface QueueLike { add(name: string, data: unknown, opts?: object): Promise<unknown> }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — no HTTP changes.

---

**Out of scope:**
- Do not change any behaviour, route, schema or test expectation.
- Do not move `audited.ts`, plugins, routes, or billing code.
- Do not add features.
- Do not rename exported symbols.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/server-kit typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/server-kit lint` passes with zero errors.
☐ `pnpm -r typecheck`, `pnpm --filter api test` and `pnpm --filter @vunvault/server-kit test` all pass.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 88b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 89 — Broadcast worker: zero-day advisory delivery (dashboards, e-mail, SMS, retraction) with idempotent deliveries and live progress

**Layer:** L11

**Prerequisites:** Task 20b, Task 38, Task 88b

**Estimated files touched:** 18

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Broadcast worker: zero-day advisory delivery (dashboards, e-mail, SMS, retraction) with idempotent deliveries and live progress**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the `broadcast` queue consumer that delivers an emergency advisory to matched clients over dashboard push, e-mail and SMS, idempotently, with progress counters persisted and published.

**Deliverables:**
- MODIFY `packages/db/src/schema/intel.ts` — add table `advisory_deliveries` (below); MODIFY `packages/db/src/schema/index.ts` only if needed.
- `packages/db/sql/0089_advisory_deliveries.sql` — raw SQL for the unique index and a check.
- `apps/broadcast-worker/src/main.ts` — bootstrap, `HEALTH_PORT` server, shutdown.
- `apps/broadcast-worker/src/config/env.ts`.
- `apps/broadcast-worker/src/broadcast/handler.ts` — `handleBroadcast(job, deps)`.
- `apps/broadcast-worker/src/broadcast/audience.ts` — resolve recipients.
- `apps/broadcast-worker/src/broadcast/templates.ts` — e-mail HTML/text and SMS builders.
- `apps/broadcast-worker/src/broadcast/progress.ts` — counters + Redis publish.
- `apps/broadcast-worker/src/broadcast/throttle.ts` — token-bucket limiter.
- `apps/broadcast-worker/src/broadcast/*.test.ts` — tests.
- `apps/broadcast-worker/.env.example` — names only; `apps/broadcast-worker/README.md` — 20 lines.
- MODIFY `apps/broadcast-worker/package.json` — scripts `dev`, `build`, `start`; dependencies.

**Dependencies allowed:**
- `bullmq`, `ioredis`, `pino`, `zod` (and the workspace packages added in Task 88b).
- `tsx` (dev).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Worker conventions (identical in every worker task — do not deviate):**
- Node.js 22, TypeScript strict. BullMQ workers on Upstash Redis; no web framework. Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets, `console.log` (use `pino`).
- Workers run on OKE and MAY use the database (`@vunvault/db`, Supavisor pooler, `prepare: false`) and secrets from OCI Vault through `@vunvault/server-kit` (`createSecretProvider`, `SECRET_NAMES`). Config via Zod-validated env (`loadEnv()`); secrets are never put in `process.env`.
- Every job handler is **idempotent** (BullMQ may retry or run a job twice): use natural keys / unique constraints / `ON CONFLICT DO NOTHING`, and check state before acting.
- Handlers are small, pure-ish functions taking explicit dependencies (db, redis, providers, clock) so tests use fakes; no live database, Redis or network in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT` (stop fetching, finish active jobs up to 25 s, close connections). Expose a minimal health HTTP endpoint on `HEALTH_PORT` (default 8081) with `GET /healthz` returning `200 ok` only while the worker loop is alive (use `node:http`).
- State-changing handlers append audit entries through `AuditService` from `@vunvault/server-kit` with actor `{ id: null, label: "system" }`.
- Never log recipient addresses, phone numbers, tokens, or message bodies; log ids and counts.

N/A — no UI.

**New table `advisory_deliveries` (Drizzle in `intel.ts`, `.enableRLS()`):** `id` uuid pk; `broadcast_id` → `advisory_broadcasts.id` on delete cascade; `channel` text not null (`dashboard|email|sms`); `recipient_hash` text not null (SHA-256 of lower-cased email / E.164 / org id — NEVER the raw value); `status` text not null default `'sent'` (`sent|failed|skipped`); `provider_id` text null; `error_code` text null; `created_at`. **Unique `(broadcast_id, channel, recipient_hash)`** (idempotency key). Index `(broadcast_id, status)`.

**Handler flow (`handleBroadcast`):** payload `BroadcastJobPayload` (Task 22). 
1. Load the `advisory_broadcasts` row and its advisory; if the row is already `sent` → return (idempotent). Set `status = 'sending'`, `started_at = coalesce(started_at, now())`. A `retraction` kind uses the retraction templates; `initial`/`rebroadcast` use the advisory templates.
2. **Audience:** `matchClients(advisory.scope, client_assets)` (from the kit) → org ids; dashboards = those orgs; recipients = active (`account_status = 'active'`, not deleted) profiles of those orgs. **E-mail** recipients = users whose preference `advisory_broadcast.email` is true (default true when no row); **SMS** recipients = users with a phone number whose `advisory_broadcast.sms` preference is true (default false). Critical severity ALWAYS includes the org's owner contact by e-mail regardless of preference. De-duplicate by `recipient_hash`.
3. **Dashboards:** for each org, publish once to Redis channel `advisory:events` the JSON `{ type: "advisory", action: "published"|"retracted", advisoryId, orgIds: [orgId] }` (batched ≤ 500 org ids per message) and insert one `advisory_deliveries` row per org (`channel = 'dashboard'`). The API's SSE stream (Task 94) turns these into client pushes.
4. **E-mail:** send in batches of 50, concurrency 5, global limit `EMAIL_RATE_PER_SEC` (default 10) using the token bucket; before each send `INSERT … ON CONFLICT DO NOTHING RETURNING id` into `advisory_deliveries` — if no row returned the recipient was already served (skip). On `ProviderError` with `retryable: false` record `failed` with the error code and continue; with `retryable: true` retry that recipient up to 3 times with 500 ms/1 s/2 s backoff, then record `failed`. 
5. **SMS:** same pattern via `SmsRouter`, rate `SMS_RATE_PER_SEC` (default 5), body ≤ 480 chars.
6. **Counters:** after every 25 deliveries and at the end update `sent_dashboards`, `sent_email`, `sent_sms`, `failed` (derived from `COUNT(*)` of delivery rows by status, so retries cannot double count) and publish to Redis `advisory:progress:<broadcastId>` the JSON `{ broadcastId, advisoryId, status, audienceDashboards, emailContacts, smsContacts, sentDashboards, sentEmail, sentSms, failed }`.
7. **Finish:** `status = 'sent'` when `failed ≤ 20 % of attempted` else `'failed'`; `finished_at = now()`; publish the final progress message. The API already wrote the SEV-1 audit entry, so this worker writes NO audit entry; log counts at `info`. 
8. Failures that escape (DB down, etc.) throw so BullMQ retries (job `attempts: 3`, exponential backoff 5 s from Task 22); because deliveries are idempotent the retry resumes without duplicates.

**Message content (planner-authored; plain and factual):**
- E-mail subject: `[VUNVAULT] <SEVERITY> zero-day advisory: <CVE> — <title>`; retraction: `[VUNVAULT] Advisory retracted: <CVE>`. HTML body (escape every interpolated value with a small `escapeHtml`): severity badge, CVE, title, `Affected scope` list, `Summary`, `Recommended remediation`, references as links (https only), a button `View in your portal` → `${WEB_ORIGIN}/portal/advisories`, footer `You receive this because your organisation uses affected products. Manage notification preferences in your account settings.`; plain-text alternative.
- SMS: `VUNVAULT <SEV>: <CVE> <title truncated to 70>. Action: <remediation truncated to 140>. Portal: ${WEB_ORIGIN}/portal/advisories` (hard-truncate to 480 chars).
- Retraction messages: `This advisory was retracted by the VUNVAULT intelligence desk: <note>.`

**Tests (assert):** a second run of the same job sends nothing new (unique index + fake DB enforcing it); a provider failure on one recipient does not stop the others and increments `failed`; retryable errors retry then record failed; counters equal the number of delivery rows; the progress message shape; critical severity includes the owner by e-mail even when the preference is off; SMS body ≤ 480; HTML-escaping of a hostile title (`<script>`); rate limiter never exceeds `EMAIL_RATE_PER_SEC` (fake clock); retraction uses the retraction subject; `status = 'failed'` when > 20 % fail.

---

**Data shape (TypeScript):**
```ts
interface BroadcastProgress { broadcastId: string; advisoryId: string; status: "queued" | "sending" | "sent" | "failed"; audienceDashboards: number; emailContacts: number; smsContacts: number; sentDashboards: number; sentEmail: number; sentSms: number; failed: number }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Queue: broadcast  payload { broadcastId: uuid; advisoryId: uuid; kind: "initial"|"rebroadcast"|"retraction" }
// Redis publish: advisory:events (clients) · advisory:progress:<broadcastId> (admin progress)
```

---

**Out of scope:**
- Do not add HTTP routes (the SSE endpoints are Task 94).
- Do not write audit entries from this worker.
- Do not store raw e-mail addresses or phone numbers in `advisory_deliveries`.
- Do not send marketing content.

---

**Definition of done:**
☐ `pnpm --filter broadcast-worker typecheck` passes with zero errors.
☐ `pnpm --filter broadcast-worker lint` passes with zero errors.
☐ `pnpm --filter broadcast-worker typecheck` and `pnpm --filter broadcast-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 89 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 90 — Notify and PDF workers: e-mail / SMS / in-app delivery, invoice and report PDFs

**Layer:** L11

**Prerequisites:** Task 29, Task 32, Task 35, Task 88b, Task 89

**Estimated files touched:** 26

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Notify and PDF workers: e-mail / SMS / in-app delivery, invoice and report PDFs**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the `notify` queue consumer (e-mail templates, SMS, persisted in-app notifications with an API to read them) and the `pdf` queue consumer that renders invoice and released-report PDFs with `@react-pdf/renderer` into R2.

**Deliverables:**
- MODIFY `packages/db/src/schema/account.ts` — add table `in_app_notifications` (below); MODIFY `packages/db/src/schema/scans.ts` — add `report_pdf_key text null` to `scan_jobs`.
- `packages/db/sql/0090_notifications_reports.sql` — index SQL.
- `apps/broadcast-worker/src/notify/handler.ts`, `templates.ts`, `layout.ts` — notify consumer + template registry + shared e-mail layout.
- `apps/broadcast-worker/src/pdf/handler.ts`, `invoice-pdf.tsx`, `report-pdf.tsx`, `pdf-theme.ts`, `storage.ts` — PDF consumer and documents.
- MODIFY `apps/broadcast-worker/src/main.ts` — start the `notify` and `pdf` workers alongside `broadcast`.
- `apps/broadcast-worker/src/notify/notify.test.ts`, `apps/broadcast-worker/src/pdf/pdf.test.ts` — tests.
- MODIFY `apps/broadcast-worker/package.json` and `tsconfig.json` — `jsx: "react-jsx"`, add dependencies.
- `apps/api/src/routes/v1/in-app/index.ts`, `service.ts`, `repo.ts` — `GET /api/v1/account/in-app-notifications`, `POST /api/v1/account/in-app-notifications/read`.
- `apps/api/src/routes/v1/scans/report-pdf.ts` — `GET /api/v1/scans/:id/report.pdf` (registered from the scans plugin).
- MODIFY `apps/api/src/routes/v1/index.ts` and `apps/api/src/routes/v1/scans/index.ts` — register them.
- MODIFY `packages/contracts/src/account.ts` — `InAppNotificationView`, `MarkReadBody`; MODIFY `packages/contracts/src/routes-d.ts` — document the three routes.
- MODIFY `apps/api/src/conformance/route-manifest.ts` — extend drift expectations.
- `apps/api/src/routes/v1/in-app/in-app.test.ts` and `apps/api/src/routes/v1/scans/report-pdf.test.ts`.

**Dependencies allowed:**
- `@react-pdf/renderer`, `react` (catalog) in `apps/broadcast-worker`.
- `@aws-sdk/client-s3` (R2 upload), `pino`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Worker conventions (identical in every worker task — do not deviate):**
- Node.js 22, TypeScript strict. BullMQ workers on Upstash Redis; no web framework. Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets, `console.log` (use `pino`).
- Workers run on OKE and MAY use the database (`@vunvault/db`, Supavisor pooler, `prepare: false`) and secrets from OCI Vault through `@vunvault/server-kit` (`createSecretProvider`, `SECRET_NAMES`). Config via Zod-validated env (`loadEnv()`); secrets are never put in `process.env`.
- Every job handler is **idempotent** (BullMQ may retry or run a job twice): use natural keys / unique constraints / `ON CONFLICT DO NOTHING`, and check state before acting.
- Handlers are small, pure-ish functions taking explicit dependencies (db, redis, providers, clock) so tests use fakes; no live database, Redis or network in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT` (stop fetching, finish active jobs up to 25 s, close connections). Expose a minimal health HTTP endpoint on `HEALTH_PORT` (default 8081) with `GET /healthz` returning `200 ok` only while the worker loop is alive (use `node:http`).
- State-changing handlers append audit entries through `AuditService` from `@vunvault/server-kit` with actor `{ id: null, label: "system" }`.
- Never log recipient addresses, phone numbers, tokens, or message bodies; log ids and counts.

N/A — no UI (the web notification bell is NOT in this plan; the API exposes the data so a later task can add it).

**New table `in_app_notifications` (`.enableRLS()`):** `id`; `user_id` → profiles on delete cascade; `event` notification_event not null; `title` text not null (≤ 120); `body` text not null (≤ 500); `critical` boolean not null default false; `created_at`; `read_at` timestamptz null. Index `(user_id, read_at, created_at desc)`. Retention 90 days (the maintenance worker purges in Task 92).

**Notify consumer (`notify` queue; payload `NotifyJobPayload` from Task 22):**
- `channel: "email"` → render `template` with `vars` through the registry (unknown template → permanent failure, log `error`, no retry) and send via the kit's `EmailProvider`; subject/body from the template. Registry (planner-authored; plain, factual, escaped): `credentials_changed` (`Your VUNVAULT credentials were changed` — time, device hint if provided, `If this wasn't you, contact your administrator immediately.`), `payment_receipt` (`Payment received — <invoice number>`, amount in USD, date, link `${WEB_ORIGIN}/portal/billing`), `mfa_enforcement` (`Set up multi-factor authentication`, link `${WEB_ORIGIN}/admin/profile#security`), `entitlement_license` (`Your VUNVAULT licence key`, product, key, updates-until date, link to `/portal/licences`), `pentest_ack` (`We received your penetration test request <ref>` with the ≤ 1 business day sentence), `generic_notice` (title + body). All templates use the shared layout (VUNVAULT wordmark text — NO external images —, content, footer `VUNVAULT · Nairobi, Kenya`).
- `channel: "sms"` → `SmsRouter.send`; invalid numbers are permanent failures.
- `channel: "in_app"` → insert into `in_app_notifications` (idempotent by a deterministic `id` = UUIDv5 of `jobId`; use `ON CONFLICT DO NOTHING`).
- Retries: BullMQ defaults from Task 22; `ProviderError.retryable === false` → mark failed permanently (`job.discard()`/`UnrecoverableError`). Never log addresses/bodies.

**In-app API (`[authenticate]`, own rows only):** `GET /account/in-app-notifications?unread=true&limit=20` → `{ data: InAppNotificationView[]; unread: number }` newest first; `POST /account/in-app-notifications/read` body `{ ids: uuid[] (max 100) | all: true }` → `204`. No audit.

**PDF consumer (`pdf` queue; payload `PdfJobPayload { kind: "invoice"|"report"; refId }`):**
- `invoice`: load invoice + lines + org + balance (`invoice_balances`); render `InvoicePdf` (A4, built-in Helvetica only): header `VUNVAULT` wordmark text and `INVOICE`; meta (`Invoice no.`, `Issued`, `Due`, status); `Billed to` org name + client code; table (`Description`, `Qty`, `Unit (USD)`, `Amount (USD)`), totals block `Total`, `Paid`, `Amount due` in USD (via `formatUsd`), footer `All amounts are in US dollars (USD). VUNVAULT · info@vunvault.com`. Upload to R2 `invoices/<orgId>/<number>.pdf` (`application/pdf`), set `invoices.pdf_object_key`. Idempotent: if the key exists and the invoice has not changed since, skip.
- `report`: only for jobs with `review_gate_state = 'approved_released'` (else permanent failure); render `ReportPdf`: cover (job code, target, scan type, released date, client), executive summary (severity counts), findings sorted critical→low each with title, severity, CVSS/CWE, description, remediation, redacted evidence (monospace, wrapped, ≤ 2,000 chars), closing disclaimer `This report is confidential and intended solely for <client>.`; upload `reports/<orgId>/<jobCode>.pdf`, set `scan_jobs.report_pdf_key`. Never include unreleased jobs or evidence beyond `evidence_redacted`.
- Concurrency 2, memory-aware (a document > 200 pages is truncated with a notice). The worker deployment must set `NODE_OPTIONS=--max-old-space-size=768` (documented for the Helm task).
**Report route (`GET /api/v1/scans/:id/report.pdf`):** visible jobs only via `clientVisibleWhere` (others 404); if `report_pdf_key` is set → stream/redirect to a 300 s presigned GET (`Cache-Control: private, no-store`), else enqueue a `pdf` job and respond `202 { data: { status: "generating" } }`. Staff with `scans:read` may fetch any released job's report.

**Tests (assert):** each email template renders escaped output (hostile input) and includes the required sentences; unknown template is permanent failure; in-app insert is idempotent; invoice PDF buffer starts with `%PDF` and the fake storage receives the right key; report for an unreleased job fails permanently; the report route returns 404 for another org's job and 202 when no PDF exists; in-app routes only touch the caller's rows; `read` with `all: true` marks everything read.

---

**Data shape (TypeScript):**
```ts
interface InAppNotificationView { id: string; event: NotificationEvent; title: string; body: string; critical: boolean; createdAt: string; readAt: string | null }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/account/in-app-notifications?unread=&limit= → 200 { data: InAppNotificationView[]; unread: number }
// POST /api/v1/account/in-app-notifications/read body { ids: string[] } | { all: true } → 204
// GET  /api/v1/scans/:id/report.pdf → 200 application/pdf (or 302 presigned) | 202 { data: { status: "generating" } } | 404 not_found
// Queues: notify (NotifyJobPayload) · pdf (PdfJobPayload)
```

---

**Out of scope:**
- Do not build the notification bell UI.
- Do not embed remote images or fonts in e-mails or PDFs.
- Do not include unreleased scan data in any PDF.
- Do not send SMS to non-E.164 numbers.

---

**Definition of done:**
☐ `pnpm --filter broadcast-worker typecheck` passes with zero errors.
☐ `pnpm --filter broadcast-worker lint` passes with zero errors.
☐ `pnpm --filter broadcast-worker typecheck` and `pnpm --filter broadcast-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 90 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 91 — Maintenance worker A: scheduler, metrics rollup, node-health sweep, threat level, scheduled publish, outbox re-enqueue

**Layer:** L11

**Prerequisites:** Task 20b, Task 36, Task 37, Task 38, Task 88b, Task 89

**Estimated files touched:** 22

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Maintenance worker A: scheduler, metrics rollup, node-health sweep, threat level, scheduled publish, outbox re-enqueue**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Bootstrap the maintenance worker with BullMQ job schedulers and implement the operational jobs that feed the Command Center and keep content and broadcasts flowing.

**Deliverables:**
- MODIFY `packages/contracts/src/queues.ts` — extend `MaintenanceJobPayload.task` with `"scheduled_publish"`, `"outbox_reenqueue"`, `"stale_signups"`, `"purge_misc"`, `"process_image"` (and `key`/`kind` optional fields for `process_image`).
- `apps/maintenance-worker/src/main.ts`, `config/env.ts`, `scheduler.ts` — bootstrap, health, schedule registration.
- `apps/maintenance-worker/src/router.ts` — dispatch by `task`.
- `apps/maintenance-worker/src/jobs/metrics-rollup.ts`, `node-health.ts`, `threat-level.ts`, `scheduled-publish.ts`, `outbox-reenqueue.ts`, `verify-chain.ts`.
- `apps/maintenance-worker/src/sources/cloudflare-metrics.ts` — `MetricsSource` interface + Cloudflare implementation.
- `apps/maintenance-worker/src/jobs/*.test.ts` — tests.
- `apps/maintenance-worker/.env.example`, `README.md`.
- MODIFY `apps/maintenance-worker/package.json`.

**Dependencies allowed:**
- `bullmq`, `ioredis`, `pino`, `zod` (and workspace packages).
- Nothing else (Cloudflare APIs via `fetch`).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Worker conventions (identical in every worker task — do not deviate):**
- Node.js 22, TypeScript strict. BullMQ workers on Upstash Redis; no web framework. Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets, `console.log` (use `pino`).
- Workers run on OKE and MAY use the database (`@vunvault/db`, Supavisor pooler, `prepare: false`) and secrets from OCI Vault through `@vunvault/server-kit` (`createSecretProvider`, `SECRET_NAMES`). Config via Zod-validated env (`loadEnv()`); secrets are never put in `process.env`.
- Every job handler is **idempotent** (BullMQ may retry or run a job twice): use natural keys / unique constraints / `ON CONFLICT DO NOTHING`, and check state before acting.
- Handlers are small, pure-ish functions taking explicit dependencies (db, redis, providers, clock) so tests use fakes; no live database, Redis or network in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT` (stop fetching, finish active jobs up to 25 s, close connections). Expose a minimal health HTTP endpoint on `HEALTH_PORT` (default 8081) with `GET /healthz` returning `200 ok` only while the worker loop is alive (use `node:http`).
- State-changing handlers append audit entries through `AuditService` from `@vunvault/server-kit` with actor `{ id: null, label: "system" }`.
- Never log recipient addresses, phone numbers, tokens, or message bodies; log ids and counts.

N/A — no UI.

**Scheduler (`scheduler.ts`):** on boot call `queue.upsertJobScheduler(id, { pattern|every }, { name: "maintenance", data: { task } })` for: `node_health` every `15 s`; `scheduled_publish` and `outbox_reenqueue` every `60 s`; `metrics_rollup` cron `5 * * * *`; `threat_level` cron `10 * * * *`; `verify_chain` cron `30 * * * *` (incremental). (Tasks added in Task 92: `purge_misc` daily `03:15 UTC`, `expire_invitations` hourly `:20`, `flag_dormant_accounts` daily `03:30`, `stale_signups` hourly `:40`, `audit_snapshot` daily `00:10 UTC`.) Registration is idempotent (same scheduler ids). Only ONE replica runs the schedulers: take a Redis lock `maint:scheduler:lock` (SET NX PX 30000, renewed every 10 s) — workers on every replica still process jobs. Router rejects unknown `task` values.

**`node_health`:** for every `sensor_nodes` row: seconds since `last_heartbeat_at` ≥ 45 (3 missed 15 s heartbeats) → `status = 'offline'`; ≥ 30 (2 missed) → `degraded`; else leave the status the heartbeat route set; set `missed_heartbeats = floor(seconds/15)`; a node coming back is fixed by its next heartbeat (Task 37). Write no audit entry for node status changes; log each transition into `offline` at `warn`.
**`threat_level`:** inputs from the DB: `unpatchedCritical`, `weaponizedInWild`, `activeZeroDays` (published, non-retracted advisories), `patchCoveragePercent` = 100 × patched ÷ published (100 when none); call `computeThreatLevel` (kit) → insert `threat_level_snapshots` (also `critical_cves`, `threats_blocked_ytd` = sum of `platform_metrics_hourly.threats_blocked` since 1 Jan UTC). When the level changed vs the previous snapshot: append audit `THREAT_LEVEL_CHANGED` (system) with message `Global threat level <old> → <new> (<label>)`, and when the new level ≥ `THREAT_ESCALATION_LEVEL` (4) dispatch a CRITICAL notification (`threat_level_change`, `critical: true`) to the incident commander (env `INCIDENT_COMMANDER_ID`) and all `super_admin`s.
**`metrics_rollup` (hourly, for the previous full UTC hour; upsert into `platform_metrics_hourly` by `hour`, and `endpoint_stats` by `(endpoint, window_start)`):** `MetricsSource.hour(hourStart)` returns `{ siteSessions, apiRequests, avgResponseMs, p95ResponseMs, threatsBlocked, endpoints: { endpoint, requests, avgLatencyMs, errorRatio }[] }`. The Cloudflare implementation: (a) site sessions = zone GraphQL `httpRequests1hGroups { uniq { uniques } }` for the hour; (b) threats blocked = zone GraphQL `firewallEventsAdaptiveGroups` count where action ∈ `block`, `challenge`, `managed_challenge`, `jsChallenge`; (c) API metrics from the Analytics Engine dataset written by the edge worker (Task 102) via the SQL API `POST https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/analytics_engine/sql` with `Authorization: Bearer <CF_ANALYTICS_TOKEN>` (secrets `CF_ANALYTICS_TOKEN`, `CF_ACCOUNT_ID` added to `SECRET_NAMES`; `CF_ZONE_ID` is plain env); schema of the dataset `vv_requests`: `index1` = `"api"|"web"`, `blob1` = route template (e.g. `/api/v1/scans/:id`), `blob2` = method, `double1` = latency ms, `double2` = HTTP status; queries use `quantileWeighted(0.95, double1, _sample_interval)` and `sum(_sample_interval)` to account for sampling. Timeouts 10 s; a failed hour is retried on the next run (the job also back-fills up to 6 missing previous hours).
**`scheduled_publish`:** items with `status = 'scheduled'` and `scheduled_for <= now()` → `published`, `published_at = now()`, do NOT insert a `content_reviews` row (it requires a reviewer); append audit `CONTENT_PUBLISHED` (system actor) instead; idempotent via the status filter + `UPDATE … RETURNING`.
**`outbox_reenqueue`:** `advisory_broadcasts` with `status = 'queued'`, `created_at < now() − 2 min` and no live BullMQ job (`queue.getJob('broadcast:<id>')` absent or finished/failed) → re-enqueue with `jobId = 'broadcast:<id>'` (BullMQ de-duplicates by id); same for `scan_jobs` with `status = 'queued'` older than 5 min and no job `scan:<uuid>`; log counts.
**`verify_chain`:** call `AuditService.verify` incrementally from the latest `audit_checkpoints.to_seq + 1`; insert the checkpoint; append audit `CHAIN_VERIFIED` (`ok` / `critical` on mismatch, actor `system`); on mismatch also dispatch a critical notification to the incident commander.

**Tests (assert, fake clock/db/sources):** scheduler registers each id once and only the lock holder registers; node 31 s stale → `degraded`, 46 s → `offline`; threat level change writes one audit entry and escalates only at ≥ 4; rollup upserts (running twice yields one row) and back-fills missing hours; Cloudflare source builds the expected GraphQL/SQL bodies (assert request JSON) and handles an HTTP 500 by throwing; scheduled publish publishes only due items once; outbox re-enqueue skips jobs that exist; verify records a checkpoint and flags a tampered fixture.

---

**Data shape (TypeScript):**
```ts
interface HourMetrics { siteSessions: number; apiRequests: number; avgResponseMs: number; p95ResponseMs: number; threatsBlocked: number; endpoints: { endpoint: string; requests: number; avgLatencyMs: number; errorRatio: number }[] }
interface MetricsSource { hour(hourStartUtc: Date): Promise<HourMetrics> }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Queue: maintenance  payload { task: "node_health"|"metrics_rollup"|"threat_level"|"verify_chain"|"scheduled_publish"|"outbox_reenqueue"|… }
// Outbound: Cloudflare GraphQL (zone analytics, firewall events) and Analytics Engine SQL API
```

---

**Out of scope:**
- Do not add HTTP routes.
- Do not implement the Task 92 jobs (stub their registration only if needed).
- Do not hard-code Cloudflare ids or tokens.

---

**Definition of done:**
☐ `pnpm --filter maintenance-worker typecheck` passes with zero errors.
☐ `pnpm --filter maintenance-worker lint` passes with zero errors.
☐ `pnpm --filter maintenance-worker typecheck` and `pnpm --filter maintenance-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 91 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 92 — Maintenance worker B: retention purges, invitation expiry, dormant accounts, stale signups, upload processing, daily audit snapshot

**Layer:** L11

**Prerequisites:** Task 28, Task 36, Task 40d, Task 91

**Estimated files touched:** 22

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Maintenance worker B: retention purges, invitation expiry, dormant accounts, stale signups, upload processing, daily audit snapshot**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the housekeeping jobs: retention purges, invitation expiry, dormant-account flagging, stale signup cleanup, image/avatar upload processing, and the daily write-once audit snapshot.

**Deliverables:**
- `apps/maintenance-worker/src/jobs/purge-misc.ts`, `expire-invitations.ts`, `flag-dormant.ts`, `stale-signups.ts`, `process-image.ts`, `audit-snapshot.ts`.
- `apps/maintenance-worker/src/lib/image-safety.ts` — magic-byte sniffing, SVG sanitiser, EXIF stripping/re-encode.
- `apps/maintenance-worker/src/lib/supabase-admin.ts` — minimal admin client (`deleteUser`).
- MODIFY `apps/maintenance-worker/src/router.ts` and `scheduler.ts` — register the five schedules named in Task 91.
- MODIFY `apps/api/src/routes/v1/account-settings/service.ts` — after avatar confirm enqueue `maintenance` `{ task: "process_image", key, kind: "avatar", userId }`; MODIFY `apps/api/src/routes/v1/studio/service.ts` — same for studio images (`kind: "studio"`) after the first draft save that references an image key.
- MODIFY `packages/contracts/src/queues.ts` — add `userId` optional to the payload.
- `apps/maintenance-worker/src/jobs/*.test.ts` and `lib/image-safety.test.ts`.
- MODIFY `apps/maintenance-worker/package.json` — add dependencies.
- MODIFY `docs/adr/0001-audit-chain.md` — append a short 'Daily snapshots' paragraph.

**Dependencies allowed:**
- `sharp` (EXIF strip + re-encode), `@aws-sdk/client-s3`, `@supabase/supabase-js`, `pino`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Worker conventions (identical in every worker task — do not deviate):**
- Node.js 22, TypeScript strict. BullMQ workers on Upstash Redis; no web framework. Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets, `console.log` (use `pino`).
- Workers run on OKE and MAY use the database (`@vunvault/db`, Supavisor pooler, `prepare: false`) and secrets from OCI Vault through `@vunvault/server-kit` (`createSecretProvider`, `SECRET_NAMES`). Config via Zod-validated env (`loadEnv()`); secrets are never put in `process.env`.
- Every job handler is **idempotent** (BullMQ may retry or run a job twice): use natural keys / unique constraints / `ON CONFLICT DO NOTHING`, and check state before acting.
- Handlers are small, pure-ish functions taking explicit dependencies (db, redis, providers, clock) so tests use fakes; no live database, Redis or network in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT` (stop fetching, finish active jobs up to 25 s, close connections). Expose a minimal health HTTP endpoint on `HEALTH_PORT` (default 8081) with `GET /healthz` returning `200 ok` only while the worker loop is alive (use `node:http`).
- State-changing handlers append audit entries through `AuditService` from `@vunvault/server-kit` with actor `{ id: null, label: "system" }`.
- Never log recipient addresses, phone numbers, tokens, or message bodies; log ids and counts.

N/A — no UI.

**`purge_misc` (daily):** delete `login_attempts` older than 30 days; `fx_quotes` expired > 7 days and unconsumed; `provider_webhook_events` processed > 90 days ago; `in_app_notifications` older than 90 days; Redis keys are TTL-managed (no work). Delete in batches of 5,000 until fewer rows match; log counts. NEVER touch `audit_*`, `journal_entries`, `ledger_lines`, `review_decisions`, `content_reviews`, `advisory_broadcasts` (immutable/retained).
**`expire_invitations` (hourly):** `staff_invitations` with `status = 'pending'` and `expires_at < now()` → `expired`; one audit entry per batch (`INVITATION_REVOKED`, message `<n> staff invitation(s) expired`, system actor).
**`flag_dormant_accounts` (daily):** active staff profiles with `last_active_at < now() − 60 days` (and `joined_at` older than 60 days) → `account_status = 'dormant'`, set `access_review_due = current_date + 14`; one audit entry (event `PERMISSION_CHANGED`, severity warning) per account with message `<email> flagged dormant after <n> days without sign-in — access review due <date>`; dispatch a non-critical notification to super admins. Do not flag `super_admin`s.
**`stale_signups` (hourly):** profiles with `account_status = 'pending_verification'` created > 24 h ago → delete the Supabase user (admin API `DELETE /auth/v1/admin/users/<id>` with the service role key from the secret provider), then delete profile + organization (only if the org has no other profile) in one transaction; idempotent (a missing Supabase user is fine); audit `ACCOUNT_DELETED` (system; message `<n> unverified signup(s) removed after 24 h`).
**`process_image` (on demand):** payload `{ key, kind: "avatar" | "studio", userId? }`. Download from R2 (max 5 MB), sniff the real type by magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF….WEBP`, GIF `GIF8`, SVG text starting with `<svg`/`<?xml`); mismatch with the stored content type or an unknown type → delete the object and, for avatars, null `profiles.avatar_key` (audit `AVATAR_UPDATED`, message `Avatar rejected by upload scanning`). Raster images: decode with `sharp` (limit pixels 24 MP via `limitInputPixels`), strip metadata, re-encode in the same format (avatars also resized to ≤ 512×512 `fit: "cover"`, studio images ≤ 1920 px wide `fit: "inside"`), overwrite the object (`Cache-Control: public, max-age=31536000, immutable`; the key already contains a UUID). SVG (avatars only): parse with a strict allow-list sanitiser written in `image-safety.ts` — allowed elements `svg g path rect circle ellipse line polyline polygon defs linearGradient radialGradient stop title desc`, allowed attributes geometry/fill/stroke/opacity/transform/viewBox/width/height/id/offset/stop-*/gradient*, remove `script`, `foreignObject`, `style`, `use`, `image`, every `on*` attribute and any attribute value containing `javascript:`, `data:` or `url(` pointing outside `#id`; if the result is empty reject. Idempotent: re-processing an already processed object yields the same bytes.
**`audit_snapshot` (daily at 00:10 UTC):** export the previous UTC day's `audit_entries` (all columns EXCEPT `sealed_details` and `nonce`) as JSONL ordered by `seq` to R2 `audit-snapshots/<YYYY>/<MM>/<DD>.jsonl`, compute `sha256` of the file and write `audit-snapshots/<YYYY>/<MM>/<DD>.sha256` (plus `headHash` and the seq range) — **never overwrite an existing key** (use a conditional put `If-None-Match: *`; if it already exists compare hashes and only log). The bucket has a retention/lock rule (Terraform, Task 101). Append audit `LOG_BACKUP` (ok) with message `Audit snapshot <YYYY-MM-DD> written · <n> entries · sha256 <first 12 chars>`.

**Tests (assert, fakes):** each purge deletes only what the rule says and stops when the batch is short; invitations expire once; a super admin is never flagged dormant; stale-signup cleanup is idempotent when the Supabase user is already gone; image processing: a PNG renamed to `.jpg`/wrong content type is rejected; an EXIF-bearing JPEG comes out without EXIF and ≤ 512 px for avatars; an SVG with `<script>`, `onload`, `javascript:` and `<foreignObject>` is cleaned or rejected; the snapshot refuses to overwrite and hashes deterministically; every new schedule is registered exactly once.

---

**Data shape (TypeScript):**
```ts
type ProcessImagePayload = { task: "process_image"; key: string; kind: "avatar" | "studio"; userId?: string };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Queue: maintenance (scheduled jobs + on-demand process_image) · R2 objects: avatars/…, studio/…, audit-snapshots/…
```

---

**Out of scope:**
- Do not delete audit, ledger, review or broadcast records.
- Do not serve images from the worker.
- Do not rasterise or execute SVG content.
- Do not add HTTP routes.

---

**Definition of done:**
☐ `pnpm --filter maintenance-worker typecheck` passes with zero errors.
☐ `pnpm --filter maintenance-worker lint` passes with zero errors.
☐ `pnpm --filter maintenance-worker typecheck` and `pnpm --filter maintenance-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 92 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 93 — Audit live stream (SSE): LIVE indicator, live row insertion, pause/resume, chain pill

**Layer:** L12

**Prerequisites:** Task 39, Task 83b

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Audit live stream (SSE): LIVE indicator, live row insertion, pause/resume, chain pill**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Upgrade the Audit Logs page from polling to the Server-Sent Events stream: live rows, connection states, pause/resume with a buffered-count badge, and the live chain-integrity pill.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/audit/_hooks/use-audit-stream.ts` — EventSource hook.
- `apps/web/src/app/(authed)/admin/audit/_lib/entry-matches-filters.ts` — client mirror of the server filters.
- `apps/web/src/app/(authed)/admin/audit/_components/live-controls.tsx` — LIVE pill, pause/resume, counter.
- MODIFY `apps/web/src/app/(authed)/admin/audit/_components/audit-table.tsx`, `chain-panel.tsx`, `audit-toolbar.tsx` — integrate the stream.
- MODIFY `apps/web/src/app/(authed)/admin/audit/_styles/audit.css` — append the rules below.
- `apps/web/src/test/fake-event-source.ts` — test double.
- `apps/web/src/app/(authed)/admin/audit/audit-stream.test.tsx`

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (the header pills; the chain pill already exists from Task 83b):**

```html
<div class="al-chrome-right">
 <span class="al-chrome-pill al-chrome-pill--live">
  <span class="al-live-dot" aria-hidden="true"></span>
  <span>Live</span>
 </span>
 <span class="al-chrome-pill al-chrome-pill--chain" id="al-chain-pill">
  <svg data-icon="REPLACE-WITH-LUCIDE"/>
  <span>Chain Intact</span>
 </span>
</div>
```
Custom CSS:
```css
.al-chrome-right { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.al-chrome-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.al-chrome-pill--live { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.al-chrome-pill--live .al-live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.al-chrome-pill--chain { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.al-chrome-pill--chain.is-warn { color: #fbbf24; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.42); }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .al-row, .al-toast, .al-modal, .al-modal-window,
        .adm-hamburger-bar, .al-chrome-pill--live .al-live-dot { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .al-toolbar,
        .al-modal, .al-toast-stack, .al-actions-stack, .al-chrome-right { display: none !important; }
}
```

**Hook `useAuditStream({ enabled, filters })`:** `new EventSource(env.NEXT_PUBLIC_API_URL + "/api/v1/admin/audit/stream", { withCredentials: true })` (cookies authenticate; no token in the URL). The server sends `retry: 5000`, an initial `chain` event, `entry` events with `id: <seq>` and a `heartbeat` every 20 s; the browser's automatic reconnect sends `Last-Event-ID`, and the server replays up to 200 missed entries (Task 39). States: `connecting` → `live` (first `chain`/`heartbeat`/`entry` received) → `reconnecting` (EventSource `error` while `readyState === CONNECTING`) → `offline` (readyState `CLOSED`, e.g. 401/403/429 — EventSource exposes no status code). If `offline`, stop the stream, resume the polling of Task 83b (10 s) and retry opening the stream after 60 s with exponential backoff up to 5 min; if the next `GET /auth/session` is 401 the global handler redirects to login. No heartbeat for 45 s while `live` → treat as `reconnecting` and recreate the EventSource.
**Event handling:** `entry` → validate with the `AuditEntryView` Zod schema (drop invalid), de-duplicate by `seq`, and if it matches the active filters (`category`, `severity`, `actor`, `q`, `range`; `matchesFilters(entry, filters)`) prepend it to the first page of the cached list query (`queryClient.setQueryData`), trim to `pageSize`, bump `total`, and flag it `isNew` for 2 s (CSS class `al-row--new`; no flash under reduced motion); only when the user is on page 1 with default sort. `chain` → update the chain pill and panel (`Chain Intact` / `Chain Broken`, `is-warn` when broken). Entries with `severity = critical` also trigger a toast `{ kind: "crit", title: "Critical audit event", message: "<eventType> — <actorLabel>" }` (max one per 10 s).
**Pause/resume:** button `Pause stream` / `Resume stream` (toasts `Stream paused` / `New events are buffered until you resume.` and `Stream resumed` / `Merged <n> buffered event(s).`); while paused the EventSource stays open, events go to an in-memory buffer (cap 500, oldest dropped with a note `Buffer full — oldest events dropped.`), the pill reads `Paused` and a badge shows `<n> new`. Pill labels: `Live` / `Connecting…` / `Reconnecting…` / `Paused` / `Offline`; the dot animation only for `Live` (`aria-live="polite"` announces state changes, not each row).
**Lifecycle:** close the stream on unmount and when the tab is hidden for more than 2 minutes (reopen on visibility); one stream per tab.
**Replaces:** the Task 83b `Stream refreshed` button stays as a manual resync (refetch). No browser storage.

**Tests (with the fake EventSource):** state transitions (connecting → live → reconnecting → live); a matching `entry` appears at the top once even when delivered twice; a non-matching one does not; paused events are buffered and merged on resume in `seq` order; `chain` with `state: "broken"` switches the pill to the warning style; critical entry toast throttling; offline fallback resumes polling and retries with backoff (fake timers); the stream is closed on unmount.

---

**Data shape (TypeScript):**
```ts
// AuditEntryView, AuditStreamEvent, ChainStatus: see contracts (Task 20).
type StreamState = "connecting" | "live" | "reconnecting" | "paused" | "offline";
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/audit/stream (text/event-stream, credentials) events: chain | entry (id: seq) | heartbeat   // Task 39
```

---

**Out of scope:**
- Do not add edit/delete controls.
- Do not put tokens in the URL.
- Do not change the server stream (Task 39).
- Do not use `localStorage`.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 93 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 94 — Advisory real-time: client push stream and admin broadcast progress stream (API SSE + web consumers)

**Layer:** L12

**Prerequisites:** Task 38, Task 39, Task 45, Task 82, Task 89

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Advisory real-time: client push stream and admin broadcast progress stream (API SSE + web consumers)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the two SSE endpoints fed by the broadcast worker's Redis messages — a client advisory push stream and an admin delivery-progress stream — and consume them in the portal and the Emergency Broadcast dialog.

**Deliverables:**
- MOVE `apps/api/src/routes/v1/audit/sse.ts` → `apps/api/src/lib/sse.ts` and update the audit routes' imports (no behaviour change).
- `apps/api/src/routes/v1/advisories/stream.ts` — `GET /api/v1/advisories/stream` and `GET /api/v1/admin/advisories/:id/broadcasts/stream`.
- `apps/api/src/lib/pubsub-hub.ts` — shared single-subscriber Redis hub (also used by Task 95).
- MODIFY `apps/api/src/routes/v1/advisories/index.ts` — register the stream routes.
- MODIFY `packages/contracts/src/intel.ts` — `AdvisoryPushEvent`, `BroadcastProgressEvent`; MODIFY `routes-d.ts` — document both.
- MODIFY `apps/api/src/conformance/route-manifest.ts` — streams are GET, authenticated, `AUDIT_EXEMPT`.
- `apps/api/src/routes/v1/advisories/stream.test.ts`, `apps/api/src/lib/pubsub-hub.test.ts`.
- `apps/web/src/app/(authed)/portal/_components/advisory-listener.tsx` — client listener mounted in the portal layout.
- `apps/web/src/lib/use-event-source.ts` — generic reconnecting EventSource hook (shared with Task 93 if not already extracted).
- `apps/web/src/app/(authed)/admin/zero-day/_hooks/use-broadcast-progress.ts` and MODIFY `broadcast-dialog.tsx` — replace polling with the stream (keep polling as fallback).
- MODIFY `apps/web/src/app/(authed)/portal/layout.tsx` — mount `<AdvisoryListener/>`.
- `apps/web/src/app/(authed)/portal/_components/advisory-listener.test.tsx`, `apps/web/src/app/(authed)/admin/zero-day/broadcast-progress.test.tsx`.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

**Design tokens used by the UI part:** use the existing token classes (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `ease-vv`, `duration-200`); no new colours. Every animation keeps its reduced-motion fallback; icon-only buttons have `aria-label`s.

**Backend — `PubSubHub`:** ONE shared ioredis subscriber per API process: `hub.subscribe(channel, listener): Promise<() => Promise<void>>`; the first listener on a channel issues `SUBSCRIBE`, the last unsubscribe issues `UNSUBSCRIBE`; messages fan out to the channel's listeners; reconnect re-subscribes all active channels; per-listener errors are isolated.
**Client stream (`GET /api/v1/advisories/stream`, `[authenticate]`, role `client` or staff preview):** SSE using the extracted helper (headers, `retry: 5000`, heartbeat every 20 s, slow-consumer drop at 1 MB, 5 streams per user → 429). Subscribes to `advisory:events` and forwards ONLY messages whose `orgIds` include the caller's `orgId` (staff receive all); each becomes `event: advisory` with `data: AdvisoryPushEvent` = `{ action: "published"|"retracted", advisoryId, cveId, title, severity }` — the API enriches by reading the advisory (cache 60 s) and NEVER forwards drafts. Ends when the session is revoked (check the registry every 30 s).
**Admin stream (`GET /api/v1/admin/advisories/:id/broadcasts/stream`, `[authenticate, requireStaff, requirePermission("intel:read")]`):** subscribes to `advisory:progress:*` filtered by `advisoryId`; first frame is the latest persisted `BroadcastRecord` (`event: progress`), then live `event: progress` frames (`BroadcastProgressEvent` = the worker's JSON); closes itself 15 s after a `sent`/`failed` frame.
**Web — `AdvisoryListener` (client component, renders `null`):** opens the stream while the tab is visible; on `published`: invalidate `queryKeys` for advisories and show a toast — critical: `{ kind: "crit", title: "New zero-day advisory", message: "<CVE> — <title>" }`, others `warn`; on `retracted`: `{ kind: "info", title: "Advisory retracted", message: "<CVE> was withdrawn." }`; de-duplicate by `advisoryId + action` for 60 s. **Broadcast dialog:** `useBroadcastProgress(advisoryId)` drives the delivery strip (`Delivering… <sent>/<audience>` per channel, final `Delivered to <n> dashboards, <n> e-mail and <n> SMS recipients` and, when `failed > 0`, `<n> deliveries failed`), falling back to the 3 s polling of Task 82 when the stream is `offline`.

**Tests (assert):** hub subscribes once for two listeners and unsubscribes on the last; a client only receives events for its org; drafts are never forwarded; admin stream replays the persisted record first and ends after `sent`; slow consumer dropped; web listener toasts critical vs non-critical, dedupes, invalidates the list; progress hook updates counters and falls back to polling on error.

---

**Data shape (TypeScript):**
```ts
interface AdvisoryPushEvent { action: "published" | "retracted"; advisoryId: string; cveId: string; title: string; severity: "critical" | "high" | "medium" | "low" }
interface BroadcastProgressEvent { broadcastId: string; advisoryId: string; status: "queued" | "sending" | "sent" | "failed"; audienceDashboards: number; emailContacts: number; smsContacts: number; sentDashboards: number; sentEmail: number; sentSms: number; failed: number }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/advisories/stream (SSE) → event: advisory data: AdvisoryPushEvent | heartbeat
// GET /api/v1/admin/advisories/:id/broadcasts/stream (SSE) → event: progress data: BroadcastProgressEvent
// Redis in: advisory:events, advisory:progress:<broadcastId>   (published by the broadcast worker, Task 89)
```

---

**Out of scope:**
- Do not change the worker's message shapes.
- Do not forward drafts or other orgs' events.
- Do not use WebSockets here.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` and `pnpm --filter web test` pass; both typechecks pass.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 94 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 95 — Scan WebSocket relay in the API: Redis → WebSocket, replay, whitelisted control messages

**Layer:** L12

**Prerequisites:** Task 25, Task 35, Task 84, Task 88, Task 94

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Scan WebSocket relay in the API: Redis → WebSocket, replay, whitelisted control messages**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement `GET /api/v1/scans/:id/stream` as a WebSocket relay of the scan controller's Redis output to authorised staff, with replay, heartbeats, strict origin/permission checks and a four-message control whitelist.

**Deliverables:**
- `apps/api/src/routes/v1/scan-stream/index.ts` — WebSocket route plugin.
- `apps/api/src/routes/v1/scan-stream/session.ts` — per-socket state machine (replay → live, heartbeat, limits).
- `apps/api/src/routes/v1/scan-stream/service.ts` — authorisation + control publishing.
- MODIFY `packages/contracts/src/scan-stream.ts` — add `{ type: "control_ack"; control: "abort"|"pause"|"resume"|"kill" }` and `{ type: "error"; code: string }` to `ScanStreamMessage`.
- MODIFY `packages/server-kit/src/audit/events.ts` — add `SCAN_CONTROL_SENT` (info, scan_completion); update its test.
- MODIFY `apps/api/src/app.ts` — register `@fastify/websocket` (`maxPayload: 1024`).
- MODIFY `apps/api/src/routes/v1/index.ts` — one `register` line.
- MODIFY `apps/api/src/conformance/route-manifest.ts` and `route-table.test.ts` — WS route is authenticated, `requireStaff`, permission-guarded and `AUDIT_EXEMPT` (the control messages are audited by the service); contract-drift expects `GET /scans/:id/stream`.
- `apps/api/src/routes/v1/scan-stream/scan-stream.test.ts` and `session.test.ts`.
- MODIFY `apps/api/package.json` — add dependency.

**Dependencies allowed:**
- `@fastify/websocket`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Route:** `GET /api/v1/scans/:id/stream?after=<seq>` upgraded to WebSocket. `preHandler: [app.authenticate, app.requireStaff, app.requirePermission("scans:read")]` (these run BEFORE the upgrade; failures return a normal HTTP `401/403`). **Clients (role `client`) are refused (`403`): the release lock means a client may never see live scan output.**
**Origin check (mandatory):** the `Origin` header must equal `env.WEB_ORIGIN` exactly, else HTTP `403 { error: "forbidden" }` and an audit failure `CSRF_REJECTED`. (Cookies authenticate the handshake; CSRF is not applicable to WebSockets, which is why Origin is enforced.)
**Per-socket flow (`session.ts`):**
1. Load the job (404 → HTTP `404` before upgrade). Limits: ≤ 3 sockets per user per job and ≤ 400 sockets per process (`429` HTTP otherwise).
2. After upgrade, FIRST subscribe via the shared `PubSubHub` (Task 94) to `scan:out:<jobId>` and buffer incoming messages; THEN read the replay list `scan:buf:<jobId>` (`LRANGE 0 -1`), send every `line`/`phase`/`status` message with `seq > after` (lines) in order, then flush the buffered live messages with `seq` greater than the last replayed line (progress messages are always forwarded), then continue live. Messages are sent as JSON text frames validated against `ScanStreamMessage` (invalid → dropped and logged).
3. Immediately send a `status` message derived from the DB (`running` / `completed` / `cancelled` / `failed` for `held`/`rejected`); if the job is terminal and the replay buffer is empty, send the status and close with code `1000` and reason `finished`.
4. Heartbeat: server `ping` every 20 s; no `pong` within 45 s → close `4408`. Revoked/expired session (registry check every 30 s) → close `4401`. Backpressure: if `bufferedAmount` > 1 MB drop the socket (`1013`).
5. **Client → server messages:** raw JSON ≤ 1 KB, parsed with `ScanClientMessage` (`.strict()`: `{ type: "abort" | "pause" | "resume" | "kill" }` ONLY — anything else is ignored with an `error` frame `{ type: "error", code: "invalid_message" }`, and 5 invalid messages close the socket `4400`). Rate limit 5 messages/s per socket (excess dropped silently, 20 in a row close `4429`). Control messages require `scans:execute` (else `error` frame `forbidden`); `kill` additionally requires `admin` or `super_admin` role (analysts may `abort` only). Allowed only while the job is `running`. Accepted → publish `{ type }` JSON to Redis `scan:ctl:<jobId>`, append audit `SCAN_CONTROL_SENT` (message `<type> sent to <JOB-code> by <actor>`, details `{ jobId, type }`) and reply `{ type: "control_ack", control }`.
6. Cleanup on close: unsubscribe from the hub, clear timers, decrement the per-user counter (Redis counter with TTL as a leak guard).
**Never** forward anything from a client socket to Redis except the validated control object; never echo raw client input.

**Tests (assert, with a fake Redis/hub and the WS test client):** a client-role user gets HTTP 403; wrong Origin gets 403; replay then live ordering with no gaps or duplicates when a message arrives during replay; `after` skips earlier lines; `{ type: "exec" }`, an extra property and a 2 KB message are rejected; an analyst's `kill` is refused while `abort` is accepted and published exactly once with one audit entry; the 4th socket for the same job/user is refused; no pong closes with 4408; a terminal job closes after the status frame; revoked session closes 4401; unsubscribe happens on close.

---

**Data shape (TypeScript):**
```ts
type ScanStreamMessage = /* Task 88 union */ | { type: "control_ack"; control: "abort" | "pause" | "resume" | "kill" } | { type: "error"; code: string };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/scans/:id/stream?after=<seq>  (WebSocket upgrade; Origin must equal WEB_ORIGIN; staff with scans:read)
//   server→client text frames: ScanStreamMessage  ·  client→server: { type: "abort"|"pause"|"resume"|"kill" } only
//   HTTP before upgrade: 401 unauthorized | 403 forbidden | 404 not_found | 429 rate_limited
//   close codes: 1000 finished · 1013 slow consumer · 4400 invalid · 4401 session ended · 4408 heartbeat · 4429 rate
```

---

**Out of scope:**
- Do not expose scan output to clients (role `client`).
- Do not accept any message type beyond the four.
- Do not connect the browser to Redis or scan infrastructure.
- Do not build the UI (Task 96).

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 95 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 96 — Live scan terminal in the admin Scan Queue (WebSocket client)

**Layer:** L12

**Prerequisites:** Task 77, Task 95, Task 48

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Live scan terminal in the admin Scan Queue (WebSocket client)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the staff-only live terminal dialog that streams a running scan's sanitised output over the WebSocket relay, with replay on reconnect, progress/phase display and abort/kill controls.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/scan-queue/_components/scan-terminal-dialog.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_components/terminal-view.tsx` — log renderer.
- `apps/web/src/app/(authed)/admin/scan-queue/_hooks/use-scan-stream.ts` — WebSocket hook.
- `apps/web/src/app/(authed)/admin/scan-queue/_lib/scan-stream-reducer.ts` — pure reducer.
- `apps/web/src/app/(authed)/admin/scan-queue/_styles/terminal.css`
- MODIFY `apps/web/src/app/(authed)/admin/scan-queue/_components/row-actions.tsx` — add `Live output`.
- `apps/web/src/test/fake-websocket.ts`
- `apps/web/src/app/(authed)/admin/scan-queue/scan-terminal.test.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/scan-stream-reducer.test.ts`

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (the prototype's marketing scanner window — reuse its visual language: title bar with window buttons, monospace log, status chip, progress bar; adapt the classes into `terminal.css` under a `vv-term-` prefix to avoid clashing with the public scanner):**

##### Terminal window (taken from the public Free Scanner; reuse its look for the staff terminal)
```html
<div id="free-scanner-modal" class="vv-scan-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vv-scan-dialog-title">
 <div class="vv-scan-modal-backdrop"></div>
 <div class="vv-scan-window" role="document">
  <div class="vv-scan-titlebar">
   <div class="vv-scan-controls">
    <button type="button" class="vv-dot vv-dot-close" aria-label="Close scanner"></button>
    <button type="button" class="vv-dot vv-dot-min" aria-label="Minimize scanner"></button>
    <button type="button" class="vv-dot vv-dot-max" aria-label="Maximize scanner"></button>
   </div>
   <div class="vv-scan-title" id="vv-scan-dialog-title">vunvault-scanner-cli v2.4.0 — vvscan --interactive</div>
   <div class="vv-scan-status">
    <span class="vv-scan-status-dot" aria-hidden="true"></span>
    <span>IDLE</span>
   </div>
  </div>
  <div class="vv-scan-body">
   <form class="vv-scan-form">
    <label class="sr-only" for="vv-scan-target">Target IP address or domain name</label>
    <div class="vv-scan-input-wrap">
     <span class="vv-scan-prompt" aria-hidden="true">$</span>
     <input id="vv-scan-target" class="vv-scan-input" type="text" name="target" placeholder="example.com   or   192.168.1.1" autocomplete="off"/>
    </div>
    <button type="submit" class="vv-scan-execute">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Execute Scan</span>
    </button>
    <button type="button" class="vv-scan-reset">Clear</button>
   </form>
   <div class="vv-scan-chips">
    <span class="vv-scan-chips-label">Try:</span>
    <button type="button" class="vv-chip">example.com</button>
    <button type="button" class="vv-chip">192.168.1.1</button>
    <button type="button" class="vv-chip">api.vunvault.com</button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vv-scan-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.vv-scan-modal[hidden] { display: none; }
.vv-scan-modal.is-open { opacity: 1; }
.vv-scan-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vv-scan-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(920px, 100%); max-height: 90vh; border-radius: 16px; overflow: hidden; background: #0b0f16; border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease), width 0.28s var(--ease), max-height 0.28s var(--ease); }
.vv-scan-modal.is-open .vv-scan-window { transform: translateY(0) scale(1); }
.vv-scan-window.is-max { width: 100%; max-height: 94vh; }
.vv-scan-titlebar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 11px 14px; background: linear-gradient(180deg, #151b25, #10151d); border-bottom: 1px solid rgba(59, 153, 252, 0.18); }
.vv-scan-controls { display: flex; align-items: center; gap: 8px; }
.vv-scan-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; letter-spacing: 0.02em; color: #8d9aab; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vv-scan-status { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: var(--r-full); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; border: 1px solid transparent; white-space: nowrap; }
.vv-scan-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.vv-scan-status[data-state="idle"] { color: #94a3b8; background: rgba(148, 163, 184, 0.1); border-color: rgba(148, 163, 184, 0.3); }
.vv-scan-status[data-state="scanning"] { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.vv-scan-status[data-state="scanning"] .vv-scan-status-dot { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.vv-scan-status[data-state="done"] { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.vv-scan-body { display: flex; flex-direction: column; gap: 14px; padding: 18px; overflow-y: auto; }
.vv-scan-form { display: flex; flex-wrap: wrap; gap: 10px; }
.vv-scan-input-wrap { position: relative; display: flex; align-items: center; flex: 1 1 260px; min-width: 0; }
.vv-scan-prompt { position: absolute; left: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 700; color: var(--brand); pointer-events: none; }
.vv-scan-input { width: 100%; padding: 13px 14px 13px 34px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #e2e8f0; background: #070b11; border: 1px solid rgba(59, 153, 252, 0.24); border-radius: 10px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.vv-scan-input::placeholder { color: #55637a; }
.vv-scan-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.16); }
.vv-scan-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vv-scan-execute { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 9px; padding: 13px 22px; font-size: 12.5px; font-weight: 800; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: 10px; transition: transform 0.2s var(--ease), filter 0.2s var(--ease), opacity 0.2s var(--ease); }
.vv-scan-execute:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
.vv-scan-execute:disabled { opacity: 0.55; cursor: not-allowed; }
.vv-scan-reset { flex: 0 0 auto; padding: 13px 18px; font-size: 12.5px; font-weight: 700; color: #93a2b5; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-scan-reset:hover { color: #e2e8f0; border-color: rgba(59, 153, 252, 0.4); background: rgba(59, 153, 252, 0.1); }
.vv-scan-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.vv-scan-chips-label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #55637a; }
@media (max-width: 768px) {
.vv-scan-modal { padding: 12px; }
.vv-scan-title { display: none; }
.vv-scan-titlebar { grid-template-columns: auto 1fr; }
.vv-scan-status { justify-self: end; }
.vv-scan-execute,
  .vv-scan-reset { flex: 1 1 auto; justify-content: center; }
}
</style>




.vv-scan-modal-backdrop { background: rgba(5, 7, 10, 0.74); }
.vv-scan-modal[hidden] { display: none !important; }
.vv-scan-modal { pointer-events: auto; }
.vv-scan-screen::-webkit-scrollbar,
.vv-scan-body::-webkit-scrollbar { width: 8px; height: 8px; }
.vv-scan-screen::-webkit-scrollbar-track,
.vv-scan-body::-webkit-scrollbar-track { background: transparent; }
.vv-scan-screen::-webkit-scrollbar-thumb,
.vv-scan-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vv-scan-screen::-webkit-scrollbar-thumb:hover,
.vv-scan-body::-webkit-scrollbar-thumb:hover { background: rgba(59, 153, 252, 0.6); background-clip: padding-box; }
.vv-scan-screen,
.vv-scan-body { scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vv-scan-input:focus-visible { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-scan-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.18); animation: vvShake 0.32s var(--ease); }
@media (max-width: 480px) {
.vv-scan-window { width: 100%; max-height: 94vh; }
.vv-scan-titlebar { padding: 10px 12px; gap: 10px; }
.vv-scan-body { padding: 14px; gap: 10px; }
}
@media (prefers-reduced-motion: reduce) {
.vv-scan-modal,
  .vv-scan-window,
  .vv-line,
  .vv-scan-input.is-invalid { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@keyframes pulse { 50% { opacity: 0.5; } }
@keyframes vvShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
```


**Row action:** `Live output` appears for jobs with `status = running` (and for `completed`/`cancelled` jobs finished within the last hour, which still have a replay buffer) and only when the user has `scans:read` (staff). It opens `ScanTerminalDialog` (`Dialog` primitive, size `lg`, `aria-labelledby`).
**Header:** job code, target, `SCAN_TYPE_LABELS[type]`, status chip (`Connecting`, `Running`, `Completed`, `Cancelled`, `Failed`, `Disconnected`), phase text from the last `phase` message, a `ProgressBar` from `progress` messages with ETA (`formatEta`).
**`useScanStream(jobId)`:** `new WebSocket(wsBase + "/api/v1/scans/" + jobId + "/stream?after=" + lastSeq)` where `wsBase` = `NEXT_PUBLIC_API_URL` with `https` → `wss` (cookies authenticate the handshake; no token in the URL). Parse each frame with `ScanStreamMessage` (Zod, from contracts); invalid frames are ignored. Reducer state: `{ lines: ScanLine[] (cap 5,000, oldest dropped), lastSeq, progress, etaSeconds, phase, status, ended }`; lines are de-duplicated by `seq`. On close: if `ended` (a terminal `status` message or close code `1000`) stop; if code `4401` show `Your session ended — sign in again.`; `4403`/HTTP refusal → `You do not have access to live scan output.`; otherwise reconnect with backoff `1 s, 2 s, 4 s, 8 s, 16 s, 30 s` (reset on a successful open) using `after=lastSeq`; show `Reconnecting…` and keep the log. Close the socket on unmount.
**Terminal view:** each line `<span class="vv-term-ts">[HH:MM:SS]</span> <span class="vv-term-<kind>">{msg}</span>` — **render `msg` as a React text node ONLY (never `innerHTML`)**; colours by `kind` (`sys`, `muted`, `info`, `ok`, `warn`, `crit`) from tokens; `role="log"`, `aria-live="off"` (the log is not announced line-by-line; the status chip is `aria-live="polite"`); auto-scroll to bottom unless the user scrolled up (then show a `Jump to latest` button); toggle `Auto-scroll`; `Copy log` (plain text of the current lines → clipboard; toast `Log copied` / `<n> lines copied to the clipboard.`) and `Download .txt` (`<JOB-code>.log`).
**Controls (send ONLY `{ type }` JSON frames):** `Abort` (confirm dialog `Abort <JOB>?` / `The scan stops and partial results are kept.`) → `{ type: "abort" }`; `Kill` (visible only to `admin`/`super_admin`; confirm `Kill <JOB> immediately?` / `The scan pod is terminated without cleanup.`) → `{ type: "kill" }`; `Pause`/`Resume` buttons are rendered DISABLED with the tooltip `Pause is not supported in this environment.` (the controller cannot pause pods — Task 86). Controls are disabled unless `status = running` and the user has `scans:execute`; on `control_ack` toast `{ kind: "ok", title: "Command sent", message: "<control> sent to <JOB>." }`; on an `error` frame `forbidden` → toast `Your role cannot send this command.`.
**Empty/ended states:** `Waiting for output…` before the first line; on `completed` a final line is NOT invented — show the status chip and the text `Scan finished. Results are awaiting the review gate.` under the log (planner copy); `cancelled`/`failed` similarly (`Scan cancelled.` / `Scan did not complete.`).

**Tests (fake WebSocket, fake timers):** replay then live lines appear once and in order; reconnect uses `after=<lastSeq>`; backoff schedule; terminal status stops reconnecting; code `4401` message; only `{ type }` frames are ever sent (assert every outbound frame parses as the whitelist); `Kill` hidden for analysts; Pause disabled with the tooltip; a message containing `<img onerror=…>` is rendered as text; line cap trims the oldest; copy/download buttons produce the expected text.

---

**Data shape (TypeScript):**
```ts
interface ScanLine { seq: number; ts: string; kind: "sys" | "muted" | "info" | "ok" | "warn" | "crit"; msg: string }
interface StreamState { lines: ScanLine[]; lastSeq: number; progress: number; etaSeconds: number | null; phase: string | null; status: "connecting" | "running" | "completed" | "cancelled" | "failed" | "disconnected"; ended: boolean }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// WebSocket GET /api/v1/scans/:id/stream?after=<seq>  → ScanStreamMessage frames; outbound { type: "abort"|"pause"|"resume"|"kill" } only (Task 95)
```

---

**Out of scope:**
- Do not use `innerHTML`.
- Do not send any message other than the four whitelisted types.
- Do not show the terminal to clients.
- Do not implement pause/resume behaviour.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 96 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 97 — Container images: hardened multi-stage Dockerfiles, buildx bake file, and a Dockerfile policy checker

**Layer:** L13

**Prerequisites:** Task 4, Task 25, Task 88, Task 89, Task 91

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Container images: hardened multi-stage Dockerfiles, buildx bake file, and a Dockerfile policy checker**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create non-root, distroless, multi-stage Dockerfiles for the API, the broadcast and maintenance workers and the scan controller, a `docker-bake.hcl` that builds all images (including the scan runner), and a script that statically enforces the Dockerfile rules.

**Deliverables:**
- `docker/node-service.Dockerfile` — one parametrised Dockerfile (`ARG APP`) used for `api`, `broadcast-worker`, `maintenance-worker`, `scan-worker` (the controller).
- `docker-bake.hcl` — targets `api`, `broadcast-worker`, `maintenance-worker`, `scan-controller`, `scan-runner` and group `default`.
- `.dockerignore` — repo root.
- `scripts/verify-dockerfiles.mjs` — policy checker (rules below).
- `scripts/verify-dockerfiles.test.mjs` — tests for the checker using good/bad fixture strings.
- MODIFY root `package.json` — script `verify:docker` and extend `verify` to include it.
- `docker/README.md` — 25 lines: how to build, required build args, why distroless.
- MODIFY `apps/scan-worker/Dockerfile.runner` — ONLY if the policy checker requires it (e.g. add the OCI labels); the runner image is exempt from the distroless rule.
- MODIFY each of `apps/api`, `apps/broadcast-worker`, `apps/maintenance-worker`, `apps/scan-worker` `package.json` — add `"bin"`-free `"start:prod": "node dist/main.js"` if missing (API: `dist/server.js`).
- `docker/node-service.Dockerfile.test.md` — checklist of manual verification commands (`docker build`, `docker run --read-only --cap-drop ALL …`).

**Dependencies allowed:**
- None — use only existing (the checker is plain Node, no new packages).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI.

**`docker/node-service.Dockerfile` (exact structure):**
```
# syntax=docker/dockerfile:1.7
ARG NODE_BUILD_IMAGE
ARG DISTROLESS_IMAGE            # e.g. gcr.io/distroless/nodejs22-debian12:nonroot@sha256:<supplied by CI>
FROM ${NODE_BUILD_IMAGE} AS base          # node:22-bookworm-slim@sha256:<supplied by CI>
  corepack enable; WORKDIR /repo
FROM base AS fetch    # copy pnpm-lock.yaml, pnpm-workspace.yaml, package.json files only; `pnpm fetch --frozen-lockfile` (BuildKit cache mount for the pnpm store)
FROM fetch AS build   # copy sources; pnpm install --offline --frozen-lockfile; pnpm --filter ${APP}... build
FROM build AS prune   # pnpm --filter ${APP} deploy --prod /out   (production deps only, workspace packages included)
FROM ${DISTROLESS_IMAGE} AS runtime
  COPY --from=prune --chown=65532:65532 /out /app ; WORKDIR /app ; USER 65532:65532
  ENV NODE_ENV=production NODE_OPTIONS=--enable-source-maps
  ARG APP  → ENTRYPOINT ["/nodejs/bin/node"] ; CMD ["dist/main.js"]   (API overrides CMD to dist/server.js through bake `args`)
  LABEL org.opencontainers.image.source, .title=${APP}, .revision, .created   (revision/created supplied as build args)
```
The build args `NODE_BUILD_IMAGE` and `DISTROLESS_IMAGE` have NO defaults (the build fails loudly without them); there is no `latest`, no `apt-get`, no shell in the final stage, no `EXPOSE` beyond documentation comments, no `HEALTHCHECK` (Kubernetes probes are used), no secrets, no `ENV` or `ARG` whose name contains `KEY`, `TOKEN`, `SECRET` or `PASSWORD`. The final image must run with `readOnlyRootFilesystem` (writes only to `/tmp`, which Helm mounts as an `emptyDir`).

**`docker-bake.hcl`:** `variable "REGISTRY"`, `"TAG"`, `"GIT_SHA"`, `"CREATED"`, `"NODE_BUILD_IMAGE"`, `"DISTROLESS_IMAGE"`, `"NMAP_VERSION"`, … (runner build args pass through); a `target "_common"` (platforms `linux/amd64`, `args` for the two images + labels, `cache-from/to` type `gha` placeholders, `provenance = true`, `sbom = true`); targets inherit `_common` and set `dockerfile`, `args = { APP = "…" }`, `tags = ["${REGISTRY}/vv/<name>:${TAG}", "${REGISTRY}/vv/<name>:${GIT_SHA}"]`; `scan-runner` uses `apps/scan-worker/Dockerfile.runner`.

**`scripts/verify-dockerfiles.mjs` — rules (output `OK: verify-dockerfiles` or `FAIL: …` lines + exit 1):** every `*Dockerfile*` under the repo (excluding `node_modules`) must: use `# syntax=` directive; have ≥ 2 `FROM` stages; the final stage declares `USER` with a numeric non-zero uid (`65532`); contain no `:latest` and no `FROM` without a tag or digest or `${ARG}`; no `ADD http`/`ADD https`; no `curl … | sh`/`wget … | sh`; no `ENV`/`ARG` names matching `/KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL/i` (build args that legitimately end in `_CHECKSUM` are allowed); no `--privileged`, `setcap`, `chmod 777`, `chmod +s`; no `sudo`; non-runner Dockerfiles' final `FROM` must reference `${DISTROLESS_IMAGE}` or contain `distroless`. `Dockerfile.runner` is checked for everything except the distroless rule and must contain `sha256sum -c`.

**Tests (assert):** a passing sample; each violation (root user, `latest`, secret-named ARG, `curl|sh`, missing USER) is reported; the real Dockerfiles in the repo pass.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not push images or add workflows (Tasks 103–104).
- Do not invent image digests or checksums.
- Do not add Docker Compose files for production.
- Do not Dockerize the web app (it deploys to Cloudflare Pages).

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify:docker` prints `OK: verify-dockerfiles` and `node --test scripts/verify-dockerfiles.test.mjs` passes.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 97 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 98 — Helm charts for OKE: shared library chart, API, broadcast worker, maintenance worker (External Secrets from OCI Vault)

**Layer:** L13

**Prerequisites:** Task 97, Task 89, Task 91, Task 23

**Estimated files touched:** 40

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Helm charts for OKE: shared library chart, API, broadcast worker, maintenance worker (External Secrets from OCI Vault)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the Helm charts that deploy the API and the two workers to OKE with restricted pod security, probes, autoscaling, disruption budgets, network policies, Cloudflare-only ingress, and secrets delivered by External Secrets Operator from OCI Vault.

**Deliverables:**
- `infra/helm/vv-common/Chart.yaml`, `templates/_helpers.tpl`, `_deployment.tpl`, `_service.tpl`, `_hpa.tpl`, `_pdb.tpl`, `_networkpolicy.tpl`, `_externalsecret.tpl`, `_serviceaccount.tpl` — a **library chart** (`type: library`).
- `infra/helm/api/Chart.yaml`, `values.yaml`, `values-staging.yaml`, `values-production.yaml`, `templates/*.yaml` (deployment, service, ingress, hpa, pdb, networkpolicy, externalsecret, serviceaccount, `NOTES.txt`).
- `infra/helm/broadcast-worker/…` and `infra/helm/maintenance-worker/…` — same layout (no service/ingress; health port only for probes).
- `infra/helm/README.md` — 30 lines: chart map, value conventions, how images are referenced by digest, how secrets flow.
- `scripts/verify-helm.mjs` — renders every chart with `helm template` (skips with a warning if `helm` is not installed) and asserts the policy below on the YAML.
- `scripts/verify-helm.test.mjs` — tests with pre-rendered fixture YAML (good and bad).
- MODIFY root `package.json` — scripts `verify:helm`; extend `verify`.

**Dependencies allowed:**
- None — use only existing (plain Node for the checker; `yaml` may be added as a devDependency of the root if no YAML parser is available).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI.

**Chart design:** each app chart declares the `vv-common` dependency (`repository: "file://../vv-common"`, exact `version: 0.1.0`) and renders through its named templates. Image reference = `{{ .Values.image.repository }}@{{ required "image.digest is required" .Values.image.digest }}` (deploys are by digest; tags are informational). `values.yaml` has NO secret values and NO default digest.

**Pod/Deployment requirements (asserted by `verify-helm`):** `replicas` from values (API default 2, workers 1–2); `strategy.rollingUpdate { maxUnavailable: 0, maxSurge: 1 }`; pod `securityContext { runAsNonRoot: true, runAsUser: 65532, runAsGroup: 65532, fsGroup: 65532, seccompProfile: RuntimeDefault }`; container `securityContext { allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities.drop: ["ALL"] }`; `automountServiceAccountToken: false` (the app SAs need no Kubernetes API access; the External Secrets controller has its own); `/tmp` mounted from an `emptyDir` (`sizeLimit: 256Mi`); resource `requests` AND `limits` set (API requests `cpu 250m / memory 384Mi`, limits `1 / 768Mi`; broadcast worker requests `200m / 384Mi`, limits `1 / 1Gi` with env `NODE_OPTIONS=--max-old-space-size=768 --enable-source-maps`; maintenance worker requests `100m / 256Mi`, limits `500m / 512Mi`); `topologySpreadConstraints` across `topology.kubernetes.io/zone` (maxSkew 1, `ScheduleAnyway`) and `kubernetes.io/hostname`; liveness `GET /healthz` and readiness `GET /readyz` on the API port 8080 (readiness `periodSeconds: 5`, `failureThreshold: 3`), startupProbe `failureThreshold: 30`; workers probe `GET /healthz` on 8081; `terminationGracePeriodSeconds: 35` with a `preStop` is not possible on distroless (no shell) — rely on the app's SIGTERM handling; `imagePullSecrets` name from values (`ocir-pull`, created by Terraform). Env: non-secret plain values from `values.env` (`NODE_ENV`, `LOG_LEVEL`, `WEB_ORIGIN`, `API_PUBLIC_URL`, `COOKIE_DOMAIN`, `SECRETS_PROVIDER=oci-vault`, `OCI_SECRET_MAP` is injected from the ExternalSecret-free ConfigMap-less value `values.ociSecretMap` as a JSON string, `HEALTH_PORT`, Cloudflare ids for the maintenance worker, `WORKER_SLOTS_TOTAL`, `INCIDENT_COMMANDER_ID`…). **No `env.valueFrom.secretKeyRef` is needed** because the apps read secrets from OCI Vault themselves (Task 22 `OciVaultSecretProvider` using workload identity).
**Secrets delivery — decision:** the apps fetch secrets directly from OCI Vault through the pod's workload identity (no Kubernetes Secret objects for app secrets). External Secrets Operator is used ONLY for the **Cloudflare Origin CA TLS certificate and authenticated-origin-pull CA** needed by the ingress: an `ExternalSecret` (`apiVersion: external-secrets.io/v1beta1`) in the API chart creating `Secret/vv-origin-tls` (type `kubernetes.io/tls`) and `Secret/vv-cf-origin-ca` from OCI Vault secrets `ORIGIN_TLS_CERT`, `ORIGIN_TLS_KEY`, `CF_ORIGIN_PULL_CA` via the `ClusterSecretStore` named in `values.secretStore` (created by the Terraform bootstrap, Task 100). Workload identity: ServiceAccount annotated per values (`oci.oraclecloud.com/...` placeholders from values) — document the policy statement that Terraform creates.
**Ingress (API chart):** `ingressClassName: nginx`; host from values; TLS secret `vv-origin-tls`; annotations `nginx.ingress.kubernetes.io/auth-tls-secret: <ns>/vv-cf-origin-ca`, `auth-tls-verify-client: "on"`, `auth-tls-verify-depth: "1"` (only Cloudflare can reach the origin), `proxy-body-size: 2m`, `proxy-read-timeout: "3600"` and `proxy-send-timeout: "3600"` (WebSocket and SSE), `nginx.ingress.kubernetes.io/proxy-buffering: "off"` (SSE), `enable-cors` NOT set (the API handles CORS), `limit-rps`-free. `/docs*` and `/openapi.json` are blocked at the ingress in production via a `server-snippet`-free approach: separate Ingress path rules returning 404 are not possible without snippets — instead the API already hides `/docs` in production (Task 21); add a comment.
**NetworkPolicies (via `vv-common`):** default deny ingress for the namespace pods; API: allow ingress TCP 8080 from namespace `ingress-nginx` only; workers: no ingress except from `monitoring` namespace on the health port; egress for all three: DNS (UDP/TCP 53 to `kube-system`), and TCP 443, 5432, 6379, 6543 to `0.0.0.0/0` EXCEPT `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (SaaS dependencies are public; the cluster network and metadata service are not reachable). The OCI Vault endpoint is public HTTPS (443) — allowed by the same rule.
**HPA:** API `minReplicas 2`, `maxReplicas 6`, CPU 70 %; broadcast worker `1–4` on CPU 70 %; maintenance worker fixed 2 (no HPA; the scheduler lock handles duplicates). **PDB:** `minAvailable: 1` for every Deployment with ≥ 2 replicas. **Labels:** `app.kubernetes.io/name|instance|version|component|part-of: vunvault|managed-by: Helm`. `values-staging.yaml` / `values-production.yaml` set hosts (`api.staging.vunvault.com` / `api.vunvault.com`), replica counts and `WEB_ORIGIN`.

**`verify-helm.mjs` policy (fail lines name the chart/kind/name):** every Deployment/Job pod template has the pod + container security contexts above, resources, probes (API), `automountServiceAccountToken: false`, an `imagePullSecrets` entry, image referenced by `@sha256:`; no `hostNetwork`, `hostPath`, `privileged`, `:latest`; no `Secret` with `stringData`/`data` containing values; no env var named `*KEY*|*TOKEN*|*SECRET*|*PASSWORD*` with a literal value; every namespace-scoped workload has a NetworkPolicy; Ingress has the auth-tls annotations.

**Tests (assert):** the checker passes the rendered charts (when `helm` is available) and fails on fixtures that drop a context field, use a tag instead of a digest, add a literal secret env, or omit the NetworkPolicy.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not deploy anything.
- Do not create Kubernetes Secrets containing application secrets.
- Do not write the scan-controller chart (Task 99).
- Do not add a service mesh.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify:helm` passes (or reports that `helm` is missing without failing) and `node --test scripts/verify-helm.test.mjs` passes.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 98 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 99 — Helm chart for the k3s scan cluster: controller, isolated scan namespace, RBAC, default-deny policies

**Layer:** L13

**Prerequisites:** Task 86, Task 88, Task 98

**Estimated files touched:** 22

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Helm chart for the k3s scan cluster: controller, isolated scan namespace, RBAC, default-deny policies**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Package the scan controller and the `vv-scans` isolation objects as a Helm chart for the self-managed k3s cluster, moving the static manifests from Task 86 into chart templates and keeping the isolation conformance suite green against the rendered output.

**Deliverables:**
- `infra/helm/scan-controller/Chart.yaml`, `values.yaml`, `values-staging.yaml`, `values-production.yaml`.
- `infra/helm/scan-controller/templates/namespace-system.yaml` — namespace `vv-scan-system` (controller) and `namespace-scans.yaml` — namespace `vv-scans`.
- `infra/helm/scan-controller/templates/deployment.yaml`, `serviceaccounts.yaml`, `rbac.yaml`, `networkpolicy-default-deny.yaml`, `networkpolicy-controller.yaml`, `resource-quota.yaml`, `limit-range.yaml`, `NOTES.txt`.
- MOVE `apps/scan-worker/k8s/*.yaml` content into the chart templates (delete the old `k8s/` YAML files; keep `apps/scan-worker/k8s/README.md` pointing to the chart).
- MODIFY `apps/scan-worker/src/conformance/isolation.test.ts` — read the RENDERED chart (`helm template`, skipped with a clear message when `helm` is unavailable) instead of the old YAML; add checks listed below.
- MODIFY `scripts/verify-helm.mjs` — include the scan-controller chart and its extra rules.
- `infra/helm/scan-controller/README.md` — 20 lines: topology and the secret handoff from Terraform.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI.

**Topology:** the controller Deployment runs in namespace `vv-scan-system` on nodes labelled `vv/pool=control`; scan pods run in namespace `vv-scans` on nodes labelled `vv/pool=scan` (tainted `vv/scan=true:NoSchedule`; Task 86 already adds the toleration). The controller's Role/RoleBinding live in `vv-scans` and bind the ServiceAccount `vv-scan-controller` of `vv-scan-system` (RoleBinding subject namespace updated accordingly); ServiceAccount `vv-scan-runner` (no bindings, `automountServiceAccountToken: false`) lives in `vv-scans`. Namespace labels: `pod-security.kubernetes.io/enforce: restricted` on BOTH namespaces.
**Controller Deployment:** `replicas: 2`; image `{{ .Values.image.repository }}@{{ required "image.digest" .Values.image.digest }}`; same pod/container hardening as Task 98 (non-root 65532, read-only root FS, drop ALL, seccomp RuntimeDefault, `/tmp` emptyDir); `automountServiceAccountToken: true` (the controller needs the in-cluster token) for THIS pod only; env (plain values): `NODE_ENV`, `API_BASE_URL`, `WORKER_SLOTS_TOTAL`, `SCAN_DEADLINE_SECONDS: "900"`, `RUNNER_IMAGE` (= `values.runnerImage.repository@digest`, required), `K8S_NAMESPACE: vv-scans`, `LOG_LEVEL`, `HEALTH_PORT`; secret env from the pre-existing Kubernetes Secret named by `values.existingSecret` (`vv-scan-controller-secrets`, created by Terraform from OCI Vault values, Task 100) with keys `UPSTASH_REDIS_URL`, `SCAN_CONTROLLER_HMAC_KEY` via `secretKeyRef` (this is the ONLY place `secretKeyRef` is allowed); `imagePullSecrets: [ocir-pull]`; liveness/readiness on `HEALTH_PORT`; `nodeSelector: { "vv/pool": "control" }`; `terminationGracePeriodSeconds: 40`.
**NetworkPolicies:** `vv-scans`: default-deny ingress + egress (from Task 86); `vv-scan-system`: default-deny, then the controller may egress to DNS (kube-system), the Kubernetes API (the `kubernetes.default` service endpoint: allow TCP 443/6443 to the node/cluster IPs via a values-provided `apiServerCidr`), Upstash (TCP 6379/443) and the API origin (TCP 443) over public addresses EXCLUDING private ranges. The per-job egress policies created at runtime by the controller (Task 86) continue to be the only allow rules for scan pods.
**RBAC:** exactly the rules from Task 86 (jobs create/get/list/watch/delete; pods get/list/watch; pods/log get; networkpolicies create/get/list/delete) — no wildcards, no exec, no secrets, no cluster roles.
**Quota/limits:** from Task 86, values-driven (`quota.pods`, `quota.limitsCpu`, …).
**Isolation test additions:** (a) both namespaces carry the restricted Pod Security labels; (b) the controller Deployment is the only workload with `automountServiceAccountToken: true`; (c) the only `secretKeyRef` in the chart is the controller's two keys; (d) the scan namespace has a default-deny policy for both Ingress and Egress; (e) the RBAC verbs equal the allowed list; (f) no ClusterRole/ClusterRoleBinding exists in the chart.

**Tests (assert):** `helm template` output satisfies the six isolation checks above plus every Task 98 hardening rule that applies; the checker fails on fixtures that add a ClusterRole, a wildcard verb, or remove a label.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not create the node pools or k3s install (Task 100).
- Do not deploy.
- Do not grant the controller `pods/exec`, secrets, or cluster-wide rights.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify:helm` and `pnpm --filter scan-worker test` pass (Helm-dependent tests may skip with a visible message when `helm` is not installed).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 99 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 100 — Terraform for Oracle Cloud: OKE, isolated k3s scan network, Vault, Registry, IAM, Bastion

**Layer:** L13

**Prerequisites:** Task 97, Task 98, Task 99

**Estimated files touched:** 34

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Terraform for Oracle Cloud: OKE, isolated k3s scan network, Vault, Registry, IAM, Bastion**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Provision the OCI side: an OKE cluster for the API and workers, a SEPARATE VCN with k3s nodes for scan workers that can reach the public internet but no private network, OCI Vault with secret placeholders, Container Registry repositories, IAM for workload identity, and Bastion access for CI deployments.

**Deliverables:**
- `infra/terraform/oci/versions.tf`, `providers.tf`, `backend.tf` (S3-compatible OCI Object Storage backend with partial config), `variables.tf`, `outputs.tf`, `main.tf`, `example.tfvars` (placeholders only), `.terraform.lock.hcl` NOT committed by you (CI generates; add a README note), `README.md`.
- `infra/terraform/oci/modules/network-oke/` — VCN `10.10.0.0/16`, subnets (API endpoint, nodes, load balancer, bastion-target), gateways, route tables, NSGs.
- `infra/terraform/oci/modules/oke/` — enhanced OKE cluster (private API endpoint), managed node pool (VM.Standard.E4.Flex, `ocpus` 2, `memory_in_gbs` 16, 3 nodes across ADs, image variable), workload identity enabled, add-on config for `CertManager`-free setup.
- `infra/terraform/oci/modules/network-scan/` — VCN `10.20.0.0/16`, ONE public-egress-only design (below), NAT gateway, NO DRG/LPG/peering to the OKE VCN.
- `infra/terraform/oci/modules/k3s/` — compute instances (1 control, N scan agents), cloud-init templates `cloud-init-server.yaml.tftpl`, `cloud-init-agent.yaml.tftpl`.
- `infra/terraform/oci/modules/vault/` — Vault, master key, one secret per name in `var.secret_names` with placeholder content and `lifecycle { ignore_changes = [secret_content] }`.
- `infra/terraform/oci/modules/registry/` — repositories `vv/api`, `vv/broadcast-worker`, `vv/maintenance-worker`, `vv/scan-controller`, `vv/scan-runner`.
- `infra/terraform/oci/modules/iam/` — dynamic groups/policies (below).
- `infra/terraform/oci/modules/bastion/` — OCI Bastion for each VCN.
- `infra/terraform/oci/modules/k8s-bootstrap/` — Helm releases (via the `helm` provider) for `ingress-nginx` and `external-secrets` on OKE, and the `ClusterSecretStore` for OCI Vault; Kubernetes Secrets `ocir-pull` (both clusters) and `vv-scan-controller-secrets` (k3s) built from Vault values.
- `scripts/gen-scan-egress.mjs` — generates `infra/terraform/oci/modules/network-scan/egress_cidrs.generated.tf` (below) and `scripts/gen-scan-egress.test.mjs`.
- `.tflint.hcl`, `.checkov.yaml` — lint/policy config.
- MODIFY `.gitignore` — ensure `*.tfvars` (except `example.tfvars`), `*.tfstate*`, `.terraform/` are ignored.
- `scripts/verify-terraform.mjs` — static policy checks (below) and `scripts/verify-terraform.test.mjs`.

**Dependencies allowed:**
- None — use only existing (Node scripts without new packages).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI. Terraform ≥ 1.8; providers `oracle/oci ~> 6.0`, `hashicorp/kubernetes ~> 2.30`, `hashicorp/helm ~> 2.14`, `hashicorp/random ~> 3.6`. All names prefixed `vv-<environment>-`. Variables (no defaults for ids): `tenancy_ocid`, `compartment_ocid`, `region`, `environment`, `k3s_ssh_public_key`, `secret_names` (default = the `SECRET_NAMES` list: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `UPSTASH_REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `AUDIT_HMAC_KEY`, `AUDIT_AES_KEY`, `NVD_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SCAN_CONTROLLER_HMAC_KEY`, `TURNSTILE_SECRET_KEY`, `CF_ANALYTICS_TOKEN`, `CF_ACCOUNT_ID`, `ORIGIN_TLS_CERT`, `ORIGIN_TLS_KEY`, `CF_ORIGIN_PULL_CA`, `EDGE_ORIGIN_SECRET`), `oke_k8s_version`, `node_image_id`, `k3s_version`, `scan_agent_count` (default 2), `bastion_allowed_cidrs`.

**OKE:** private Kubernetes API endpoint; node pool in private subnets with NAT egress; load balancer subnet public (reserved flexible LB created by `ingress-nginx` Service annotations `oci.oraclecloud.com/load-balancer-type: lb`, `oci-load-balancer-shape: flexible`, min/max 10/100 Mbps); NSGs allow LB → nodes on NodePort range and nothing else inbound; node NSG egress to `0.0.0.0/0`. CI reaches the private API only through **OCI Bastion port-forwarding sessions** (Task 104).
**Scan network (security-critical, the OCI side of the isolation model):** VCN `10.20.0.0/16` with ONE private subnet for k3s nodes behind a NAT gateway; **no DRG, no local/remote peering, no service gateway to OKE resources, no route to `10.10.0.0/16`**. Because OCI security rules are allow-lists only, outbound access is granted ONLY to public IPv4 space: the NSG `scan-egress` gets one egress rule per CIDR in the generated list `local.scan_egress_cidrs` = the complement of these forbidden ranges (the same list used by the controller's target guard in Task 84): `0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15, 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4`. `scripts/gen-scan-egress.mjs` computes the complement with exact integer arithmetic (no libraries) and writes the `.tf` file; **the script's test asserts: exactly 103 CIDRs, first `1.0.0.0/8`, last `208.0.0.0/4`, the union plus the forbidden list covers all 2^32 addresses, no CIDR overlaps a forbidden range, and the output is sorted and collapsed**. Ingress to k3s nodes: only SSH from the Bastion subnet and the k3s API (6443) from the Bastion subnet; nodes-to-nodes within the subnet (VXLAN 8472/udp, 10250, 6443). cloud-init also adds host firewall rules for DEFENCE IN DEPTH: `iptables -I FORWARD -d 169.254.0.0/16 -j DROP` and `-d 10.0.0.0/8` DROP for pod traffic.
**k3s (`modules/k3s`):** Oracle Linux/Ubuntu image variable; server installs k3s `${var.k3s_version}` with `--disable traefik --disable servicelb --secrets-encryption --write-kubeconfig-mode 600 --node-label vv/pool=control`; agents join with a random token (`random_password`, passed via cloud-init `write_files` mode 0600 — acceptable because it is a cluster-join token and instance metadata is restricted; document); agents labelled `vv/pool=scan` and tainted `vv/scan=true:NoSchedule`; instances use no public IPs; `metadata { block_imds_v1 }` equivalent: `instance_options { are_legacy_imds_endpoints_disabled = true }`.
**Vault:** `oci_kms_vault` (DEFAULT type), AES-256 master key, `oci_vault_secret` per name with `secret_content` = base64 of the literal `CHANGE_ME` and `lifecycle.ignore_changes`; outputs the map name→secret OCID (this is what Helm's `values.ociSecretMap` is built from; output name `secret_ocids` marked sensitive = false since OCIDs are not secrets).
**IAM:** dynamic group/policy statements (comment each): OKE workload identity — `Allow any-user to read secret-bundles in compartment id <c> where all { request.principal.type = 'workload', request.principal.namespace = 'vunvault', request.principal.service_account in ('vv-api','vv-broadcast-worker','vv-maintenance-worker'), request.principal.cluster_id = '<oke id>' }` and the External Secrets service account (`external-secrets`) limited to the three TLS secret OCIDs; CI deploy user (`vv-deployer`) with `manage repos`, `use bastion-session`, `read clusters`/`use cluster-family` in the compartment; **no policy gives any k3s node access to Vault or OCIR beyond pulling images** (`read repos` for the instance principal only).
**Registry:** private repos with image scanning enabled and immutable tags where supported (`is_immutable = true`).
**Bootstrap module:** helm `ingress-nginx` (pinned chart version variable; `controller.service.annotations` for the flexible LB, `controller.config` `use-forwarded-headers: "true"`, `ssl-protocols: "TLSv1.2 TLSv1.3"`) and `external-secrets` (pinned), plus the `ClusterSecretStore` for provider `oracle` (region, vault OCID, workload-identity auth). Kubernetes secrets: `ocir-pull` (docker-registry type) in `vunvault` (OKE) and `vv-scan-system` + `vv-scans`... (k3s) from `var.ocir_auth_token` (sensitive, passed via CI env `TF_VAR_`); `vv-scan-controller-secrets` from OCI Vault data sources (`oci_secrets_secretbundle`). **State contains these values → the backend bucket must be private, versioned, encrypted with a customer-managed key; say so in `README.md`.**

**`verify-terraform.mjs` static rules:** no `*.tfvars` (except `example.tfvars`) in git; every `provider` block pinned; no hard-coded OCIDs (`ocid1.`) in `.tf` files; every `oci_vault_secret` has `ignore_changes`; no `0.0.0.0/0` ingress rule anywhere except the LB subnet's TCP 80/443; the scan module contains no `oci_core_drg*`/`*_peering*` resources; every security rule in `network-scan` egress references only values from `local.scan_egress_cidrs`.

**Tests (assert):** egress generator vectors above; verify script passes on the repo and fails on fixtures (an OCID literal, a missing `ignore_changes`, a DRG in the scan module).

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not run `terraform apply`.
- Do not commit state, tfvars (other than the example), or any secret value.
- Do not peer the scan VCN with the OKE VCN or grant scan nodes Vault access.
- Do not provision Cloudflare resources (Task 101).

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `node --test scripts/gen-scan-egress.test.mjs scripts/verify-terraform.test.mjs` passes, `terraform fmt -check -recursive infra/terraform/oci` passes (when Terraform is installed), and `pnpm verify` includes `verify-terraform`.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 100 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 101 — Terraform for Cloudflare: Pages, DNS, TLS/origin lock, WAF and rate limits, R2 buckets (with audit lock), Logpush, Turnstile

**Layer:** L13

**Prerequisites:** Task 100, Task 92

**Estimated files touched:** 22

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Terraform for Cloudflare: Pages, DNS, TLS/origin lock, WAF and rate limits, R2 buckets (with audit lock), Logpush, Turnstile**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Provision the Cloudflare side: the Pages project for the web app, DNS to the OKE load balancer, strict TLS with authenticated origin pulls, WAF and edge rate limits, R2 buckets with CORS and a locked audit bucket, Logpush to R2, and a Turnstile widget.

**Deliverables:**
- `infra/terraform/cloudflare/versions.tf`, `providers.tf`, `backend.tf`, `variables.tf`, `outputs.tf`, `main.tf`, `example.tfvars`, `README.md`.
- `infra/terraform/cloudflare/dns.tf`, `zone-settings.tf`, `waf.tf`, `rate-limits.tf`, `pages.tf`, `r2.tf`, `logpush.tf`, `turnstile.tf`.
- MODIFY `scripts/verify-terraform.mjs` — include the Cloudflare directory (provider pin, no tokens, required settings below) and extend its tests.
- `infra/terraform/cloudflare/tests/plan-fixtures.md` — a short list of `terraform plan` sanity checks.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI. Provider `cloudflare/cloudflare ~> 4.40` (or the newest 4.x), token from env `CLOUDFLARE_API_TOKEN` (CI secret; never in files). Variables: `account_id`, `zone_name` (`vunvault.com`), `environment`, `api_origin_ip` (the OKE load balancer public IP, output of the OCI stack), `web_origin` (`https://www.vunvault.com`), `assets_hostname` (`assets.vunvault.com`), `pages_branch`, `r2_location_hint`.

**DNS / zone:** proxied (`proxied = true`) `A` record `api` → `var.api_origin_ip`; apex and `www` handled by the Pages custom domains (apex redirects to `www` with a `cloudflare_ruleset` single redirect, 301); `assets` CNAME to the R2 public bucket via the R2 custom domain resource. `cloudflare_zone_settings_override`: `ssl = "strict"`, `min_tls_version = "1.2"`, `tls_1_3 = "on"`, `always_use_https = "on"`, `automatic_https_rewrites = "on"`, `security_header` HSTS `{ enabled = true, max_age = 63072000, include_subdomains = true, preload = true, nosniff = true }`, `browser_check = "on"`, `opportunistic_encryption = "on"`, `http3 = "on"`, `websockets = "on"`. **Authenticated Origin Pulls:** `cloudflare_authenticated_origin_pulls` enabled for the zone (the origin presents the matching CA check configured in Task 98's ingress annotations).
**WAF:** enable the Cloudflare Managed Ruleset and OWASP Core Ruleset via `cloudflare_ruleset` (`kind = "zone"`, `phase = "http_request_firewall_managed"`) with the action `block` for the managed ruleset and OWASP paranoia level 2, anomaly score threshold `40`; custom rules (`phase = "http_request_firewall_custom"`): block requests to `api.<zone>` with paths not matching `^/(api/v1|healthz|readyz|openapi\.json)` (the edge worker also enforces this); managed challenge for requests with threat score > 30 on `/api/v1/auth/*`; block known-bad `User-Agent` empty on `/api/v1/*`; skip the WAF for `POST /api/v1/webhooks/stripe` and `/webhooks/paystack` only when the source IP is in the provider allow-lists passed as variables `stripe_webhook_ips`/`paystack_webhook_ips` (defaults empty = no skip).
**Rate limits (`phase = "http_ratelimit"`; the API has its own Redis limits — these are the outer layer):** `POST /api/v1/auth/login` and `/auth/mfa/verify` 20 req / 1 min per IP → block 10 min; `/api/v1/auth/signup`, `/auth/forgot-password`, `/auth/signup/resend` 10 / 10 min; `/api/v1/contact`, `/api/v1/newsletter`, `/api/v1/consent` 10 / 10 min; `/api/v1/*` general 600 / 1 min per IP → managed challenge. Characteristics `ip.src`.
**Pages (`cloudflare_pages_project`):** name `vunvault-web-<env>`, `production_branch = var.pages_branch`, build config `build_command = "pnpm install --frozen-lockfile && pnpm --filter web pages:build"`, `destination_dir = "apps/web/.vercel/output/static"`, `root_dir = "/"`, env vars (plain, non-secret): `NEXT_PUBLIC_API_URL = https://api.<zone>`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_R2_HOST = <assets hostname>`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (publishable keys are public; pass as a variable), `NODE_VERSION = 22`, `PNPM_VERSION`; compatibility flags `nodejs_compat`; custom domains `www.<zone>` and apex. (Deployments themselves are made by CI with `wrangler pages deploy`, Task 104; Terraform owns the project only. Add `lifecycle { ignore_changes = [deployment_configs] }` where the provider would fight CI.)
**R2 (`cloudflare_r2_bucket`):** `vv-<env>-public` (avatars, studio images; public through the custom domain `assets_hostname` with `cloudflare_r2_custom_domain`; CORS: `GET` from `*`, `PUT` only from `var.web_origin` with headers `Content-Type`, max age 3600), `vv-<env>-private` (authorisations, invoices, reports, scan logs; no public access; CORS `PUT` from `var.web_origin` for presigned uploads), `vv-<env>-audit` (daily audit snapshots; **bucket lock rule: retention 7 years (`2555` days) — `cloudflare_r2_bucket_lock`**, prefix empty; no public access), `vv-<env>-logs` (Logpush destination). Lifecycle: `private/scan-logs/` objects expire after 365 days; `public/` none. API tokens for R2 are created OUT OF BAND (documented); never in Terraform.
**Logpush:** `cloudflare_logpush_job` for datasets `http_requests` and `firewall_events` to the `logs` R2 bucket (`destination_conf = "r2://<bucket>/{DATE}?account-id=…&access-key-id=…&secret-access-key=…"` — the R2 credentials come from sensitive variables supplied by CI env, never committed), fields restricted to a safe list that EXCLUDES cookies, request headers and query strings (`ClientRequestURI` stripped of query is not available — use `ClientRequestPath`), sample rate 100 %.
**Turnstile:** `cloudflare_turnstile_widget` (`mode = "managed"`, domains = `[zone, www, api]`); output `turnstile_sitekey` (public; the secret is read out of band into OCI Vault as `TURNSTILE_SECRET_KEY`).
**Outputs:** assets URL, pages project name, bucket names, turnstile sitekey.

**`verify-terraform` additions:** Cloudflare provider pinned; no literal tokens/keys (`/[A-Za-z0-9_-]{37,}/` near `token`/`secret` words); `ssl = "strict"`, HSTS enabled, authenticated origin pulls enabled, `cloudflare_r2_bucket_lock` present for the audit bucket with ≥ 2555 days.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not run `terraform apply`.
- Do not create R2 API tokens or commit any credentials.
- Do not deploy the web app or the edge worker (Task 104).
- Do not configure Workers routes here (wrangler owns them).

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `node --test scripts/verify-terraform.test.mjs` passes and `terraform fmt -check -recursive infra/terraform/cloudflare` passes (when Terraform is installed).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 101 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 102 — Cloudflare edge Worker (`apps/edge`): API reverse proxy, request metrics to Analytics Engine, origin verification

**Layer:** L13

**Prerequisites:** Task 23, Task 91, Task 101

**Estimated files touched:** 20

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Cloudflare edge Worker (`apps/edge`): API reverse proxy, request metrics to Analytics Engine, origin verification**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the edge Worker that fronts `api.<zone>`: allow-list routing, size limits, an origin-verification header the API enforces, request metrics to the Analytics Engine dataset used by the maintenance worker, and transparent WebSocket/SSE pass-through.

**Deliverables:**
- `apps/edge/package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `wrangler.jsonc`, `README.md` — NEW workspace `@vunvault/edge` (add it to the workspace automatically via the existing `apps/*` glob).
- `apps/edge/src/index.ts` — Worker `fetch` handler.
- `apps/edge/src/route-template.ts` — `routeTemplate(path)`.
- `apps/edge/src/policy.ts` — allow-list, method and size checks.
- `apps/edge/src/metrics.ts` — Analytics Engine writer.
- `apps/edge/src/*.test.ts` — tests (plain Vitest with fakes).
- `apps/api/src/plugins/origin-verify.ts` — API plugin enforcing `x-origin-verify` in production.
- MODIFY `apps/api/src/plugins/rate-limit.ts` (Task 23) — derive the client IP from `cf-connecting-ip` ONLY when the origin-verify check passed.
- MODIFY `apps/api/src/app.ts` and `apps/api/src/config/env.ts` — register the plugin; add `EDGE_ORIGIN_SECRET` to `SECRET_NAMES` usage via the secret provider; add optional `ORIGIN_VERIFY_ENFORCE` (default true in production).
- `apps/api/src/plugins/origin-verify.test.ts`.
- MODIFY `apps/api/src/conformance/route-manifest.ts` — `/healthz` and `/readyz` are exempt from origin verification (cluster probes).

**Dependencies allowed:**
- `@cloudflare/workers-types`, `wrangler` (devDependencies of `apps/edge`).
- `vitest` (catalog).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI.

**Worker behaviour (`index.ts`):** route `api.<zone>/*` (declared in `wrangler.jsonc` as `routes`; the zone/pattern come from `[env.staging]`/`[env.production]` vars). For each request: (1) **allow-list:** path must match `^/(api/v1/|healthz$|readyz$|openapi\.json$)`; anything else → `404 {"error":"not_found"}` (and `/docs*` always 404 at the edge); methods only `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`, else `405`; (2) `Content-Length` > 1,048,576 on non-webhook paths → `413`; webhook paths (`/api/v1/webhooks/*`) allow up to 262,144; (3) construct the upstream request to `https://<ORIGIN_HOST>` (variable, the same hostname the ingress serves, resolved by Cloudflare to the origin IP) copying the method, headers and body, **after removing** any inbound `x-origin-verify`, `x-forwarded-for`, `x-forwarded-host`, `x-real-ip` headers and **adding** `x-origin-verify: <env.EDGE_ORIGIN_SECRET>`, `x-edge-request-id: <crypto.randomUUID()>`; `CF-Connecting-IP` is preserved by Cloudflare; (4) WebSocket upgrade requests (`Upgrade: websocket`) and SSE (`Accept: text/event-stream`) are passed through UNMODIFIED with `fetch(upstream)` returning the response as-is (no buffering, no body reading, no timeouts added); (5) add response headers `x-edge: vv` and `strict-transport-security: max-age=63072000; includeSubDomains; preload`; never add CORS headers (the API owns CORS); (6) metrics: `ctx.waitUntil(writeMetric(...))` after the response headers are available — `env.VV_REQUESTS.writeDataPoint({ indexes: ["api"], blobs: [routeTemplate(path), method], doubles: [latencyMs, status] })` (dataset binding `VV_REQUESTS` → dataset `vv_requests`, matches the maintenance worker's SQL in Task 91); a metrics failure never affects the response; (7) on upstream network error return `502 {"error":"upstream_unavailable"}`.
**`routeTemplate(path)`:** replaces UUIDs (`[0-9a-f]{8}-…`), long hex ids (≥ 16), numeric segments and tokens (any segment ≥ 24 chars of `[A-Za-z0-9_-]`) with `:id` / `:token`; strips the query; known static prefixes kept (`/api/v1/scans/:id/stream`); output max 80 chars. Tests: `/api/v1/scans/6f1c…/stream` → `/api/v1/scans/:id/stream`; `/api/v1/invitations/<43-char token>` → `/api/v1/invitations/:token`; `/api/v1/billing/invoices/123` → `/api/v1/billing/invoices/:id`.
**`wrangler.jsonc`:** `name: "vv-edge"`, `main: "src/index.ts"`, `compatibility_date` (a fixed date string chosen by you), `compatibility_flags: []`, `analytics_engine_datasets: [{ "binding": "VV_REQUESTS", "dataset": "vv_requests" }]`, `vars: { ORIGIN_HOST: "<placeholder>" }`, per-environment `routes`; **`EDGE_ORIGIN_SECRET` is a Worker secret set with `wrangler secret put` by CI from OCI Vault values — never in the file.**
**API plugin (`origin-verify.ts`):** in production (`NODE_ENV=production` and `ORIGIN_VERIFY_ENFORCE !== false`) every request except `GET /healthz` and `GET /readyz` must carry `x-origin-verify` equal (`timingSafeEqual`) to the secret `EDGE_ORIGIN_SECRET` from `app.secrets` (cache 5 min); otherwise `403 { error: "forbidden" }` (log `warn` with the request id, no header values). When valid, set `req.originVerified = true`; the IP-derivation hook of Task 23 takes `cf-connecting-ip` only if `originVerified` (otherwise uses the socket peer). In development/test the check is off.

**Tests (assert):** allow-list (404 for `/admin`, `/docs`); 405 for `TRACE`; 413 for an oversize body; forbidden inbound headers are stripped and the secret header is added; WebSocket/SSE requests are forwarded untouched (the fake `fetch` receives the same `Request`); metrics written with the right blobs/doubles and a failing writer does not change the response; upstream error → 502; API plugin: missing/wrong header → 403 in production, health endpoints exempt, `cf-connecting-ip` ignored without verification.

---

**Data shape (TypeScript):**
```ts
interface Env { VV_REQUESTS: { writeDataPoint(p: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void }; ORIGIN_HOST: string; EDGE_ORIGIN_SECRET: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Edge: https://api.<zone>/* → https://<ORIGIN_HOST>/* with x-origin-verify; Analytics Engine dataset vv_requests (index1 "api", blob1 route template, blob2 method, double1 latency ms, double2 status)
```

---

**Out of scope:**
- Do not read or transform bodies (except size checks via headers).
- Do not add CORS headers.
- Do not deploy (Task 104).
- Do not put the secret in `wrangler.jsonc`.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/edge typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/edge lint` passes with zero errors.
☐ `pnpm --filter @vunvault/edge test`, `pnpm --filter @vunvault/edge typecheck` and `pnpm --filter api test` pass.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 102 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 103 — GitHub Actions CI: verify, build, test, and security scanning (SAST, secrets, dependencies, Docker, Helm, Terraform)

**Layer:** L13

**Prerequisites:** Task 97, Task 98, Task 99, Task 100, Task 101

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **GitHub Actions CI: verify, build, test, and security scanning (SAST, secrets, dependencies, Docker, Helm, Terraform)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the CI workflows that gate every pull request and push to `main` with the repo's verification scripts, tests, builds and security scans, plus Dependabot configuration and code ownership.

**Deliverables:**
- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `.github/workflows/iac.yml`
- `.github/actions/setup/action.yml` — composite action: checkout-independent setup of Node 22, pnpm (via `corepack`), and the pnpm store cache.
- `.github/dependabot.yml` — ecosystems `npm` (root, weekly, grouped minor/patch), `github-actions` (weekly), `docker` (for `docker/` and `apps/scan-worker`), `terraform` (both dirs).
- `.github/CODEOWNERS` — placeholders `@vunvault/platform` for `infra/`, `.github/`, `packages/db/`; `@vunvault/security` for `apps/scan-worker/`, `packages/server-kit/src/audit/`, `apps/api/src/plugins/`.
- `.gitleaks.toml` — allow-list for test fixtures only (documented fake keys).
- `.trivyignore` — empty with a header comment explaining the review process.
- `.hadolint.yaml`, `.kubeconform` notes in `docs/ci.md`.
- `scripts/verify-workflows.mjs` — checks workflow policy (below) + `scripts/verify-workflows.test.mjs`.
- MODIFY root `package.json` — script `verify:workflows`; extend `verify`.
- `docs/ci.md` — 40 lines: what each workflow does, required checks to protect `main`, local equivalents.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI.

**`ci.yml` (on `pull_request` and `push` to `main`; `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`; `permissions: { contents: read }`; every job `timeout-minutes`):** job `verify` — setup, `pnpm install --frozen-lockfile`, `pnpm verify` (all policy scripts), `pnpm lint`, `pnpm typecheck`; job `test` — `pnpm test -- --coverage` (Turbo), upload coverage artifact (7 days); job `build` — `pnpm build` for packages/apps that have a build script and `pnpm --filter web build` with dummy public env; job `contracts` — runs the API conformance suite explicitly (`pnpm --filter api test -- conformance`) and the scan isolation suite (`pnpm --filter scan-worker test -- conformance`) so a regression names itself. Jobs run in parallel after `verify` where independent (`needs: verify` for test/build/contracts).
**`security.yml` (on PR, push to `main`, and a weekly schedule; `permissions` per job):** `gitleaks` (`gitleaks/gitleaks-action`, full history on schedule, PR diff otherwise, `--redact`); `codeql` (`github/codeql-action` languages `javascript-typescript`, `security-events: write`, `queries: security-extended`); `dependency-review` (PR only, `actions/dependency-review-action`, `fail-on-severity: high`, deny licences list `GPL-3.0, AGPL-3.0`); `audit` (`pnpm audit --prod --audit-level high`); `trivy-fs` (`aquasecurity/trivy-action` filesystem scan, `severity: CRITICAL,HIGH`, `ignore-unfixed: true`, exit code 1, SARIF upload); `trivy-config` (misconfig scan of `infra/` and `docker/`).
**`iac.yml` (on PR/push when `infra/**`, `docker/**`, `docker-bake.hcl`, `apps/scan-worker/**` change):** `hadolint` over every Dockerfile; `helm` — `helm lint` + `helm template` for each chart with `--values` staging and a fake digest, `kubeconform -strict -summary` (CRD schemas via the datree catalog `-schema-location` as a documented flag), then `pnpm verify:helm`; `terraform` — matrix over `infra/terraform/oci` and `infra/terraform/cloudflare`: `terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate`, `tflint --config=.tflint.hcl`, `checkov -d <dir> --config-file .checkov.yaml`; `docker-build-smoke` — `docker buildx bake --print` (syntax check only, no push).
**Actions policy (`verify-workflows.mjs` — fails with the file/line):** every workflow declares top-level `permissions` and every job declares `timeout-minutes`; no `pull_request_target` anywhere; no `${{ github.event.* }}` interpolated directly into a `run:` step (must go through `env:`); no secrets echoed (`echo ${{ secrets.` pattern); no `curl … | sh|bash`; third-party actions are referenced with a version tag or SHA (never a branch name like `@main`/`@master`); `actions/checkout` sets `persist-credentials: false` except in release jobs; every `uses:` for third-party actions appears in `docs/ci.md`'s allowed list.
**Tests (assert):** the checker passes the repo's workflows; each violation (missing permissions, `@main`, event interpolation in `run`, `pull_request_target`) is reported.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not add deployment jobs (Task 104).
- Do not store secrets in workflows.
- Do not push images from CI here.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify:workflows` prints `OK: verify-workflows` and `node --test scripts/verify-workflows.test.mjs` passes.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 103 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 104 — GitHub Actions CD: sign and push images to OCIR, migrate, Helm deploy to OKE and k3s via Bastion, deploy edge and web, smoke tests, rollback

**Layer:** L13

**Prerequisites:** Task 102, Task 103

**Estimated files touched:** 20

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **GitHub Actions CD: sign and push images to OCIR, migrate, Helm deploy to OKE and k3s via Bastion, deploy edge and web, smoke tests, rollback**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the deployment workflows: build/scan/sign/push images by digest, run database migrations behind an approval gate, deploy with `helm upgrade --install --atomic` to OKE and the k3s scan cluster through OCI Bastion tunnels, deploy the edge Worker and the Pages site, run smoke tests, and provide a rollback workflow.

**Deliverables:**
- `.github/workflows/release.yml` — build, scan, sign, push (reusable via `workflow_call`).
- `.github/workflows/deploy.yml` — environment deploys (staging automatic on `main`, production manual with approval).
- `.github/workflows/rollback.yml` — `workflow_dispatch` helm rollback.
- `scripts/deploy/oci-bastion-tunnel.sh` — creates a port-forwarding Bastion session, waits for ACTIVE, opens `ssh -N -L`, writes a kubeconfig pointing at `https://127.0.0.1:<port>` (`--tls-server-name` set), prints nothing sensitive; `scripts/deploy/oci-bastion-tunnel.test.md` — manual verification steps.
- `scripts/deploy/helm-deploy.sh` — wrapper around `helm upgrade --install --atomic --wait --timeout 10m` with digests injected via `--set image.digest=…`.
- `scripts/deploy/smoke.mjs` + `scripts/deploy/smoke.test.mjs` — post-deploy checks.
- `scripts/deploy/render-secret-map.mjs` — builds the `OCI_SECRET_MAP` JSON from the Terraform output `secret_ocids` + test.
- MODIFY `apps/web/package.json` — devDependency `@cloudflare/next-on-pages`, `wrangler`; script `pages:build` (`next-on-pages`).
- `apps/web/wrangler.jsonc` — Pages config (`pages_build_output_dir`, `compatibility_flags: ["nodejs_compat"]`).
- MODIFY `apps/web/next.config.ts` — add `setupDevPlatform` import for local dev ONLY if required by next-on-pages (comment why).
- `docs/deploy.md` — 50 lines: environments, required GitHub environment secrets (names only), the deployment sequence, rollback, and the manual first-time bootstrap order (Terraform OCI → Cloudflare → set Vault secret values → first release).
- MODIFY `scripts/verify-workflows.mjs` — add rules: deploy jobs use `environment:`, production requires an environment with reviewers (documented), and no step prints `secrets.*`.
- `scripts/verify-migrations.mjs` and `scripts/verify-migrations.test.mjs` — migration safety checker.

**Dependencies allowed:**
- `@cloudflare/next-on-pages`, `wrangler` (devDependencies of `apps/web`).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**DevOps conventions (identical in every DevOps task — do not deviate):**
- **GitHub Actions + Docker + Helm + Terraform only.** No Jenkins, no GitLab CI, no CircleCI, **no raw `kubectl apply`** (cluster changes go through `helm upgrade --install --atomic`), no Docker Compose for production.
- **No secrets in git, Dockerfiles, Helm values, Terraform variables files or workflow YAML.** Application secrets live in **OCI Vault** and are delivered to pods at runtime (External Secrets Operator on OKE; a Terraform-created Kubernetes Secret on the k3s scan cluster). The only credentials allowed in GitHub (environment secrets) are the *deployment* credentials: OCI API-key/auth-token, Cloudflare API token, Supabase DB direct URL for migrations. Never echo them; mask with `::add-mask::` where scripts handle them.
- Everything pinned: container base images by digest (supplied as build args — never invent digests), Terraform providers with `~>` constraints and a committed `.terraform.lock.hcl`, Helm chart dependencies by exact version, GitHub Actions by version tag (SHA pinning is enforced in Task 108).
- Least privilege: workflow `permissions:` default `contents: read`; jobs request more only where needed (`id-token: write` for cosign, `packages`/`security-events` where used).
- Every file you add is statically checked by the repo's `scripts/verify-*.mjs` policy scripts (created in Tasks 97–99) — keep them green.

N/A — no UI.

**`release.yml` (`workflow_call` + `workflow_dispatch`; inputs `git_sha`):** `permissions: contents: read, id-token: write, security-events: write`. Steps: checkout; log in to OCIR (`<region>.ocir.io`, user `<tenancy-namespace>/<deploy user>`, password = environment secret `OCIR_AUTH_TOKEN`); `docker/setup-buildx-action`; `docker buildx bake --push --metadata-file bake-metadata.json` (variables from repository variables `NODE_BUILD_IMAGE`, `DISTROLESS_IMAGE`, `NMAP_VERSION`, tool versions and checksum args — checksums are repository VARIABLES set by the operator, never committed); parse the pushed **digests** from the metadata into a job output JSON `{ image: digest }`; for each image: `trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed <repo>@<digest>`; `cosign sign --yes <repo>@<digest>` (keyless via GitHub OIDC) and attach the SBOM (`cosign attest --predicate sbom.json --type spdxjson`); upload the digest JSON as an artifact `digests.json` (90 days).
**`deploy.yml` (jobs, in order):** `plan` (reads digests of the commit), `migrate` (environment-gated), `deploy-oke`, `deploy-k3s`, `deploy-edge`, `deploy-web`, `smoke`. `on`: push to `main` → staging; `workflow_dispatch` with `environment` choice and `git_sha` → either. Every job has `environment: ${{ inputs.environment || 'staging' }}`; **production requires the GitHub environment's required reviewers** (documented in `docs/deploy.md`). Concurrency `deploy-${{ environment }}` with `cancel-in-progress: false`.
- `migrate`: `pnpm --filter @vunvault/db db:migrate` with `DIRECT_URL` from the environment secret `DIRECT_DATABASE_URL` (a deployment credential); migrations are additive-only by policy — add a pre-step `node scripts/verify-migrations.mjs` that fails when a SQL file contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `ALTER … TYPE` without a `-- allow-destructive: <ticket>` marker (create this script and test in this task; list it in Deliverables as an addition: `scripts/verify-migrations.mjs`, `scripts/verify-migrations.test.mjs`).
- `deploy-oke`: set up OCI CLI (`oracle-actions/configure-oci-cli` or pinned install with env secrets `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_PRIVATE_KEY`, `OCI_TENANCY_OCID`, `OCI_REGION`); `scripts/deploy/oci-bastion-tunnel.sh oke` opens the tunnel; `helm-deploy.sh` for `api`, `broadcast-worker`, `maintenance-worker` in that order (API first; each `--atomic`), values files `values-<env>.yaml`, digests from `digests.json`, `--set-json ociSecretMap=$(node scripts/deploy/render-secret-map.mjs)`; on failure Helm rolls back automatically.
- `deploy-k3s`: tunnel `k3s`, `helm-deploy.sh scan-controller` with the `image.digest` and `runnerImage.digest`.
- `deploy-edge`: `wrangler deploy --env <environment>` in `apps/edge` with `CLOUDFLARE_API_TOKEN`; set the Worker secret via `wrangler secret put EDGE_ORIGIN_SECRET` reading the value from OCI Vault with `oci secrets secret-bundle get` (never printed; `::add-mask::`).
- `deploy-web`: `pnpm --filter web pages:build` then `wrangler pages deploy apps/web/.vercel/output/static --project-name vunvault-web-<env> --branch <env>` (public build env from repository variables).
- `smoke`: `node scripts/deploy/smoke.mjs --api https://api.<zone> --web https://www.<zone>`: asserts `GET /healthz` 200, `/readyz` 200, `GET /api/v1/auth/csrf` sets `vv_csrf` and the security headers (`strict-transport-security`, `x-content-type-options`, no `server` leak), `/docs` is 404, `/` returns 200 with a CSP header containing `nonce-`, a WebSocket upgrade WITHOUT a session is rejected (HTTP 401/403, never 101), and an unsigned `POST /api/v1/internal/scans/x/claim` is 401. Failure fails the workflow and triggers the documented rollback job in `deploy.yml` (`if: failure()` → `helm rollback` for the three OKE releases only when the smoke failure followed a deploy in the same run).
**`rollback.yml`:** inputs `environment`, `release` (api|broadcast-worker|maintenance-worker|scan-controller), `revision` (optional); opens the right tunnel and runs `helm rollback <release> <revision|0> --wait --timeout 10m`.
**Scripts:** `oci-bastion-tunnel.sh` uses `set -euo pipefail`, never `set -x`, reads ids from env (`BASTION_OCID`, `TARGET_PRIVATE_IP`, `TARGET_PORT`, `SSH_PUBLIC_KEY_PATH`), generates an ephemeral SSH key per run, cleans up the session/tunnel in a `trap`. `helm-deploy.sh` refuses to run without `--set image.digest` and rejects digests not matching `^sha256:[0-9a-f]{64}$`. `smoke.mjs` takes only public URLs and exits non-zero on any failed check, printing check names only.

**Tests (assert):** `smoke.mjs` logic with a stub HTTP server (each failing check detected); `render-secret-map` produces valid JSON for sample Terraform output and refuses empty values; `verify-migrations` flags `DROP COLUMN` without a marker and accepts an additive migration; `verify-workflows` passes the new workflows and fails a fixture deploy job without `environment`.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not store application secrets in GitHub; only the named deployment credentials.
- Do not use `kubectl apply`.
- Do not auto-deploy production without environment approval.
- Do not skip image scanning or signing.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify:workflows` passes and `node --test scripts/deploy/smoke.test.mjs scripts/verify-migrations.test.mjs` passes.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 104 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 105 — E2E platform: local stack, fake providers, seed users with MFA, Playwright fixtures, smoke specs

**Layer:** L14

**Prerequisites:** Task 26, Task 27, Task 32, Task 40e, Task 58, Task 62, Task 88, Task 104

**Estimated files touched:** 30

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **E2E platform: local stack, fake providers, seed users with MFA, Playwright fixtures, smoke specs**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the end-to-end test platform — a one-command local stack with fake third-party providers and seeded role users — plus Playwright fixtures and the first smoke specs (public pages, login for every role including TOTP, signup with e-mail OTP).

**Deliverables:**
- `apps/web/playwright.config.ts`, `apps/web/e2e/global-setup.ts`, `apps/web/e2e/global-teardown.ts`.
- `apps/web/e2e/fixtures/index.ts` — `test` extended with `api`, `mailbox`, `totp`, `asRole(role)` (authenticated page via cookies), `client`, `staff`.
- `apps/web/e2e/helpers/api.ts`, `mailbox.ts`, `totp.ts`, `seed-state.ts`, `a11y.ts` (axe-core wrapper).
- `scripts/e2e/start-stack.mjs` — starts/stops the stack (Supabase CLI, Redis, MinIO, API, broadcast worker, maintenance worker, fake providers, web) and waits for health.
- `scripts/e2e/fake-providers.mjs` — one HTTP server emulating the provider endpoints listed below + `/__test/*` control routes.
- `scripts/e2e/seed.mjs` — creates seed users/orgs/plans/assets and enrols TOTP for staff.
- `scripts/e2e/scan-simulator.mjs` — plays the scan controller against the API's internal callbacks (signed) and Redis (used by Task 107).
- MODIFY `packages/server-kit/src/providers/*.ts`, `apps/api/src/billing/providers/stripe.ts`, `paystack.ts`, `apps/api/src/routes/v1/advisories/nvd.ts`, `apps/api/src/billing/fx-rates.ts`, `apps/api/src/lib/supabase-admin.ts` — base URLs overridable by env (`STRIPE_API_BASE`, `PAYSTACK_API_BASE`, `RESEND_API_BASE`, `AFRICASTALKING_API_BASE`, `TWILIO_API_BASE`, `NVD_API_BASE`, `FX_API_URL`); defaults unchanged. In `NODE_ENV=production` these overrides MUST be ignored (hard-coded real URLs) — add a test.
- MODIFY `apps/api/src/config/env.ts` — optional override variables (ignored in production) and `R2_ENDPOINT_OVERRIDE` for MinIO (also ignored in production).
- `apps/web/e2e/specs/00-public.spec.ts`, `01-auth-login.spec.ts`, `02-auth-signup.spec.ts`.
- `apps/web/e2e/README.md` — how to run (`pnpm e2e:stack`, `pnpm e2e`), debugging.
- MODIFY `apps/web/package.json` — scripts `e2e`, `e2e:stack`, `e2e:ui`; devDependencies.
- MODIFY `.github/workflows/ci.yml` — add job `e2e` (Chromium; services: redis, minio via `services:`; installs Supabase CLI; uploads the Playwright report and traces on failure; required status).
- MODIFY `.gitignore` — `apps/web/e2e/.state/`, `playwright-report/`, `test-results/`.

**Dependencies allowed:**
- `@playwright/test`, `@axe-core/playwright`, `otplib` (devDependencies of `apps/web`).
- Root devDependencies: `supabase` (CLI), `wait-on`, `concurrently`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**E2E conventions (identical in every E2E task):**
- Playwright (`@playwright/test`) in `apps/web/e2e/`, TypeScript strict, Chromium + (nightly) Firefox/WebKit projects. Tests are independent: each test creates the data it needs through helpers (`api.ts`) and never depends on another test's side effects. Use role/label selectors (`getByRole`, `getByLabel`) — they double as accessibility checks; no CSS-class selectors, no fixed sleeps (use `expect.poll`/auto-waiting).
- The tests run against a REAL local stack (Supabase local, Redis, MinIO, the API, workers, the web app) with **fake external providers** (Task 105). They never call real Stripe, Paystack, Resend, Africa's Talking, Twilio, NVD, Cloudflare or Oracle endpoints.
- No test may weaken a production control (no `ORIGIN_VERIFY_ENFORCE=false` shortcuts for the security specs, no disabled CSRF). Specs that assert a security property must FAIL if the property regresses (verify by mutating locally once and noting it in the PR description).
- Every spec file starts with a comment listing the user story and the controls it protects.

N/A — no UI.

**Stack (`start-stack.mjs`):** `supabase start` (local Postgres + GoTrue; use ports from `supabase/config.toml` — create `supabase/config.toml` with email confirmations disabled for the test project only, MFA TOTP enabled, JWT secret fixed to a documented test value, the custom access token hook pointing at `public.vv_custom_access_token_hook`); Redis (docker image `redis:7` started by the script if no `REDIS_URL`), MinIO (`minio/minio` with a bucket per name `vv-test-public|private|audit`); then run migrations (`pnpm --filter @vunvault/db db:migrate` against the local DB), start the API (`SECRETS_PROVIDER=env`, test keys, `NODE_ENV=test`), both workers, the fake providers, and `next start` for the web app built with test env. Everything binds to `127.0.0.1`; `start-stack.mjs --down` stops all. It prints a ready line `E2E stack ready` and exits non-zero when any health check fails within 180 s.
**Fake providers (`fake-providers.mjs`):** (1) **Stripe-like**: `POST /v1/customers`, `/v1/payment_methods/:id/attach`, `GET /v1/payment_methods/:id` (returns brand `visa`, last4 `4242`, exp 12/2030), `POST /v1/payment_intents` (requires `currency=usd`; amount must be the exact integer; test card tokens: `pm_card_ok` → succeeds and, after 200 ms, POSTs a correctly signed `payment_intent.succeeded` webhook (Stripe `t=…,v1=…` HMAC with the test secret) to the API; `pm_card_declined` → `payment_intent.payment_failed`; `pm_card_3ds` → `requires_action`), `POST /v1/refunds`. (2) **Paystack-like**: `POST /transaction/initialize` (returns `authorization_url`, `reference`; requires `currency=USD`), `GET /transaction/verify/:ref`, a control route to complete a reference which sends a signed `charge.success` (HMAC-SHA512). (3) **Resend**: `POST /emails` stores messages in memory. (4) **Africa's Talking / Twilio**: store SMS. (5) **NVD**: `GET /rest/json/cves/2.0?cveId=` returns fixtures for `CVE-2026-21447` (CVSS 9.8) and 404 otherwise. (6) **FX**: `GET /latest/USD` returns fixed rates (`KES 129.5`, `NGN 1550`, `GHS 15.2`, `ZAR 18.4`). (7) **Control API** (test-only, bound to localhost): `GET /__test/mailbox?to=` (last messages), `GET /__test/sms?to=`, `POST /__test/reset`, `GET /__test/webhooks` (log of webhooks sent). The Turnstile verification is disabled in the test stack (`TURNSTILE_ENFORCE` unset).
**Seed (`seed.mjs`):** orgs `Acme Fintech Ltd` (client code `VV-CL-48210`) and `Beta SACCO`; users (all passwords `E2e-Passw0rd!x` with 14+ characters): `jane@acme.test` (client of Acme, onboarding complete), `john@beta.test` (client of Beta), `reed@vunvault.com` (`super_admin`), `admin@vunvault.com` (`admin`), `analyst@vunvault.com` (`security_analyst`), `soc@vunvault.com` (`soc_operator`), `auditor@vunvault.com` (`compliance_auditor`), `support@vunvault.com` (`support_engineer`); plans and ledger accounts (the Task 20b seeds), 6 products, `client_assets` for Acme (a `Struts 2` web asset), a 'released' scan and findings for Acme, a pending invoice for Acme ($2,499.00). For each STAFF user: sign in with the password, call `POST /account/mfa/totp/enroll`, compute the code with `otplib` from the returned secret, call `…/verify`; store the secrets in `apps/web/e2e/.state/seed.json` (git-ignored). The seed is idempotent.
**Fixtures:** `asRole("client"|"super_admin"|…)` logs in through the API (password, then TOTP for staff), copies the cookies into a Playwright `storageState` cached per worker, and returns a page already authenticated; `mailbox.waitFor({ to, subject })` polls the fake mailbox; `totp.code(email)` computes the current code; `a11y.check(page)` runs axe and fails on `serious|critical` violations (documented allow-list file for known third-party issues).
**Config:** projects `chromium` (default), `firefox`, `webkit` (nightly via env), `retries: 1` in CI, `trace: "retain-on-failure"`, `workers: 4`, `expect.timeout: 10_000`, `baseURL` from `E2E_BASE_URL`.

**Specs (this task):**
- `00-public.spec.ts` — `/` shows the hero heading `We Find The Cracks Before They Do`; the preloader disappears; the consent banner appears and `Essential Only` records consent (assert the API call body) and removes it; `/about`, `/services`, `/products` (six products with `$` prices), `/blog`, `/contact` load without console errors and pass `a11y.check`; `/docs` on the API origin is 404.
- `01-auth-login.spec.ts` — invalid credentials show the toast `Sign-in failed`; client login lands on `/portal`; staff login requires the MFA dialog and lands on `/admin` after a valid TOTP code; a wrong code shows `Incorrect code. Please check the digits and try again.`; five wrong codes end the challenge (`Session expired` toast); `support@vunvault.com` lands on `/admin/profile`; unauthenticated `/admin` redirects to `/login?next=%2Fadmin`; a client opening `/admin` lands on `/forbidden`; logout clears the session (reload `/portal` → login).
- `02-auth-signup.spec.ts` — full signup: details → e-mail code read from the fake mailbox → TOTP enrolment using the secret shown on screen → `Account Created & Verified!` → `/onboarding` → complete the three steps → `/portal`; the page never shows a test OTP; an existing e-mail shows the field error `An account with this email already exists.`; a breached password (`Password123!` — fake HIBP responds as breached via a fake range API on the fake-providers server; add `HIBP_API_BASE` override) shows the breach message.
**Tests of the platform itself:** a Vitest test for the env-override logic proving overrides are ignored when `NODE_ENV=production`.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no new endpoints.

---

**Out of scope:**
- Do not call real third-party services.
- Do not disable CSRF, origin verification or rate limits in the test stack (raise rate-limit thresholds only through documented test env values).
- Do not write the billing, scan, advisory or RBAC specs (Tasks 106–107).
- Do not commit the seed state file.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm e2e:stack` reports `E2E stack ready` and `pnpm e2e` passes the three spec files.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 105 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 106 — E2E: money flows and content pipeline (USD checkout, FX quote, M-Pesa via Paystack, licences, contact → badge → studio → moderation → blog)

**Layer:** L14

**Prerequisites:** Task 66b, Task 70, Task 72, Task 73, Task 83, Task 83e, Task 90, Task 105

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **E2E: money flows and content pipeline (USD checkout, FX quote, M-Pesa via Paystack, licences, contact → badge → studio → moderation → blog)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Verify end to end that payments are always USD, ledgers reconcile, entitlements are granted by webhooks, and the editorial pipeline works from contact request to published article.

**Deliverables:**
- `apps/web/e2e/specs/10-billing-checkout.spec.ts`, `11-products-licences.spec.ts`, `12-contact-studio-moderation.spec.ts`, `13-newsletter.spec.ts`.
- `apps/web/e2e/helpers/ledger.ts` — reads ledger/invoice state through admin APIs (`/admin/payments/reconcile`, `/billing/invoices`).
- `apps/web/e2e/helpers/stripe-webhook.ts` — asks the fake provider to replay a webhook (including a TAMPERED one).
- MODIFY `scripts/e2e/fake-providers.mjs` — add `POST /__test/webhooks/replay` and `POST /__test/webhooks/tamper`.
- MODIFY `apps/web/e2e/fixtures/index.ts` — add `billing` and `content` helpers if useful.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**E2E conventions (identical in every E2E task):**
- Playwright (`@playwright/test`) in `apps/web/e2e/`, TypeScript strict, Chromium + (nightly) Firefox/WebKit projects. Tests are independent: each test creates the data it needs through helpers (`api.ts`) and never depends on another test's side effects. Use role/label selectors (`getByRole`, `getByLabel`) — they double as accessibility checks; no CSS-class selectors, no fixed sleeps (use `expect.poll`/auto-waiting).
- The tests run against a REAL local stack (Supabase local, Redis, MinIO, the API, workers, the web app) with **fake external providers** (Task 105). They never call real Stripe, Paystack, Resend, Africa's Talking, Twilio, NVD, Cloudflare or Oracle endpoints.
- No test may weaken a production control (no `ORIGIN_VERIFY_ENFORCE=false` shortcuts for the security specs, no disabled CSRF). Specs that assert a security property must FAIL if the property regresses (verify by mutating locally once and noting it in the PR description).
- Every spec file starts with a comment listing the user story and the controls it protects.

N/A — no UI.

**`10-billing-checkout.spec.ts`:** (1) as `jane@acme.test` open `/portal/billing`; the pending invoice shows `$2,499.00`; `Pay Now` opens the dialog; choose `KES`: the locked quote shows `≈ KES 323,620.50` (the fake FX rate `129.5`) and the sentence `You will be charged $2,499.00 in USD`; pay with the Stripe test card token → the dialog ends at `Payment received`; the invoice status becomes `Paid`; **assert at the fake Stripe provider that exactly one PaymentIntent was created with `amount=249900` and `currency=usd`**; assert the ledger via the admin reconcile endpoint (as `admin@vunvault.com`): zero unbalanced entries, zero attempts without entries. (2) Declined card (`pm_card_declined`): the dialog shows the Stripe error, the invoice stays `Awaiting Payment`, the ledger has no `payment_captured` entry. (3) Quote expiry: the stack for a dedicated Playwright project `short-quote` runs with `FX_QUOTE_TTL_SECONDS=5`; open the dialog in KES, wait until the countdown reaches `Quote expired`, assert `Pay` is disabled, then `Refresh quote` re-enables it. No test-only clock overrides in the API. (4) Double-click `Pay` quickly: exactly one attempt exists (idempotency). (5) M-Pesa: choose `M-Pesa` with a Kenyan phone number; checkout goes to Paystack with `currency=USD`; completing the reference through the fake control route sends a signed `charge.success`; the invoice becomes `Paid`. (6) **Webhook integrity:** POST a tampered webhook (wrong signature) directly to the API → `401 bad_signature`; replay the same valid event twice → exactly one ledger entry. (7) Edit payment method: Stripe.js iframes cannot be driven in the fake stack, so add ONE test seam: when `NEXT_PUBLIC_E2E === "1"`, `StripeCardFields` renders a single text input labelled `Test payment method id` instead of the Stripe Elements (modify `apps/web/src/app/(authed)/portal/billing/_components/stripe-card-fields.tsx`; the seam must be compiled out of production builds — add a unit test proving it is absent when `NEXT_PUBLIC_E2E` is not `1`). The spec enters `pm_card_ok`; after saving, the card shows `•••• •••• •••• 4242`; the request body has no `number`/`cvc` keys (route interception assertion). (8) Invoice CSV export downloads a file starting with the header `Order / Invoice ID,Date,Service Description,Status,Amount (USD)`.
**`11-products-licences.spec.ts`:** `/products` lists six cards; unauthenticated `Buy Now` → `/login?next=/products`; as the client `Buy Now` on ReconVault Pro creates an invoice and lands on `/portal/billing?invoice=…` with the Pay dialog open at `$49.00`; pay → `/portal/licences` shows a key matching `VV-XXXX-XXXX-XXXX-XXXX` and `Download` reports `Download not available yet` (no archive uploaded in the seed) — then upload a file to MinIO via the test helper, and `Download` succeeds with a presigned URL; **a second client (`john@beta.test`) cannot see or download Acme's licence** (API 404).
**`12-contact-studio-moderation.spec.ts`:** (1) public contact form: required validation, then submit a `Journalist / Blogger Profile Request` → success banner `Request received — reference REQ-…`; the honeypot variant creates nothing. (2) As `support@vunvault.com` the admin `/admin/contact` inbox shows the message with the verification banner; as `reed@vunvault.com` find the client in `Clients & Badges` and `Grant badge`. (3) As that client, `/portal/studio` now shows the table (before the grant it showed the denied card — assert both states in order); create an article: title, category, body ≥ 150 words, tags; autosave indicator reaches `Saved`; `Submit for Review` is disabled until the readiness items pass, then succeeds. (4) As `analyst@vunvault.com` (has `content:author`, NOT `content:moderate`) `/admin/content` is not in the navigation; as `admin@vunvault.com` open the queue, `Approve` (needs all five checks) then `Publish`; **the author cannot moderate their own post** (log in as a staff author in a second scenario and assert the `You cannot review your own submission.` toast). (5) The public `/blog` search finds the article and the detail page renders its Markdown safely (seed a body containing `<script>alert(1)</script>` and a `javascript:` link: the script text is shown inert, no dialog fires, the link is not clickable as javascript).
**`13-newsletter.spec.ts`:** subscribing shows the generic toast; the confirmation e-mail arrives in the fake mailbox; the confirm link page shows `Subscription confirmed`; subscribing the same address again sends no second e-mail and shows the same toast.
**Cross-cutting assertions in this task:** no console errors; every spec ends with a call to the admin reconcile endpoint where money moved; screenshots on failure.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no new endpoints.

---

**Out of scope:**
- Do not add production code paths for tests other than the single compiled-out card-field seam.
- Do not call real Stripe/Paystack.
- Do not weaken USD-only enforcement for convenience.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm e2e -- specs/10 specs/11 specs/12 specs/13` passes and `pnpm --filter web test` passes (including the seam-absent unit test).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 106 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 107 — E2E: security properties — release lock, review gate, payment lock, scan terminal, audit chain, advisories broadcast, RBAC and CSRF

**Layer:** L14

**Prerequisites:** Task 31, Task 35, Task 39, Task 78, Task 82, Task 83b, Task 93, Task 94, Task 95, Task 96, Task 105

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **E2E: security properties — release lock, review gate, payment lock, scan terminal, audit chain, advisories broadcast, RBAC and CSRF**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Prove the platform's core security guarantees end to end, so a regression in any of them fails CI by name.

**Deliverables:**
- `apps/web/e2e/specs/20-release-lock-review-gate.spec.ts`, `21-scan-terminal.spec.ts`, `22-audit-chain.spec.ts`, `23-advisory-broadcast.spec.ts`, `24-rbac-csrf.spec.ts`, `25-staff-lifecycle.spec.ts`.
- `apps/web/e2e/helpers/scan.ts` — create/complete a simulated scan through `scripts/e2e/scan-simulator.mjs`.
- `apps/web/e2e/helpers/ws.ts` — raw WebSocket helper (Node `ws`) for protocol-level assertions.
- `apps/web/e2e/helpers/db.ts` — a READ-ONLY SQL helper (psql via the service URL) used ONLY to assert tamper-resistance; plus one deliberate write attempt helper for the immutability test.
- MODIFY `scripts/e2e/scan-simulator.mjs` — scenarios `complete`, `slow`, `hostile-output`, `fail-deadline`.
- MODIFY `apps/web/package.json` — devDependency `ws`, `pg`.

**Dependencies allowed:**
- `ws`, `pg` (devDependencies of `apps/web`).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**E2E conventions (identical in every E2E task):**
- Playwright (`@playwright/test`) in `apps/web/e2e/`, TypeScript strict, Chromium + (nightly) Firefox/WebKit projects. Tests are independent: each test creates the data it needs through helpers (`api.ts`) and never depends on another test's side effects. Use role/label selectors (`getByRole`, `getByLabel`) — they double as accessibility checks; no CSS-class selectors, no fixed sleeps (use `expect.poll`/auto-waiting).
- The tests run against a REAL local stack (Supabase local, Redis, MinIO, the API, workers, the web app) with **fake external providers** (Task 105). They never call real Stripe, Paystack, Resend, Africa's Talking, Twilio, NVD, Cloudflare or Oracle endpoints.
- No test may weaken a production control (no `ORIGIN_VERIFY_ENFORCE=false` shortcuts for the security specs, no disabled CSRF). Specs that assert a security property must FAIL if the property regresses (verify by mutating locally once and noting it in the PR description).
- Every spec file starts with a comment listing the user story and the controls it protects.

N/A — no UI.

**`20-release-lock-review-gate.spec.ts` (the central guarantee):** (1) the client creates a scan request (uploads a PDF authorisation to MinIO through the UI, target `app.example.co.ke` — the fake resolver in the stack returns a public address); the job appears in NO client view (`/portal` list, direct `/api/v1/scans/:id` → 404, the report PDF route → 404). (2) The simulator completes the job (`complete` scenario: 3 findings: 1 critical, 1 high, 1 medium); as `analyst@vunvault.com` the Scan Queue shows it `Awaiting Review`; the client STILL cannot see it. (3) The analyst opens the gate dialog: `Approve & Release` is disabled (`Requires administrator authority.`); the analyst can `Hold for Remediation`. (4) As `admin@vunvault.com` with the client's invoice UNPAID: ticking all five checks + note and clicking `Approve & Release` shows `Release blocked — payment is outstanding.`; the client still sees nothing; the audit log (as `auditor@vunvault.com`) contains a `RELEASE_LOCK_VIOLATION` entry. (5) The client pays (reuse the Task 106 flow helper); the admin approves again → `Client portal access granted. Decision written to the audit log`; the client's `/portal` now lists the job; the report detail shows the 3 findings with REDACTED evidence (the simulator planted `Authorization: Bearer secret123` and a private-key block; assert the strings `secret123` and `BEGIN PRIVATE KEY` appear nowhere in the page or API responses). (6) A second release attempt → `already_released`; **there is no UI or API to un-release**. (7) A different client (`john@beta.test`) cannot fetch the job or its findings (404).
**`21-scan-terminal.spec.ts`:** staff opens `Live output` for a `slow` scenario job: lines arrive in order with timestamps; reload the page mid-scan → the terminal replays and continues without duplicates; `Pause` is disabled with the tooltip; as the analyst `Abort` works (confirm) → status `Cancelled`, the controller simulator receives exactly one control message; **the analyst does not see `Kill`**, and a raw WebSocket (`ws.ts`) sending `{ "type": "kill" }` as the analyst receives an `error` frame `forbidden`; as `admin@vunvault.com` `kill` is accepted; protocol-level: sending `{ "type": "exec", "cmd": "id" }` or a 2 KB frame yields `invalid_message` and never reaches Redis (assert `scan:ctl:<id>` received nothing); a client-role cookie on the WebSocket endpoint gets HTTP 403; a wrong `Origin` is refused; the `hostile-output` scenario (ANSI bombs, 10 MB line, forged `@@VV@@` done event, fake private key) renders only sanitised text, no raw escape sequences, and the job state is unaffected by the forged event.
**`22-audit-chain.spec.ts`:** as `auditor@vunvault.com` open `/admin/audit`: summary tiles, filters and the event detail dialog work; there is no edit/delete control (assert roles/names); `Verify chain` reports `0 mismatches`; **tamper test:** with the SQL helper attempt `UPDATE audit_entries SET message = 'x'` and `DELETE FROM audit_entries` — both must FAIL with the immutability exception (assert the error text `audit records are append-only`); then disable the trigger in a transaction as the superuser (documented test-only action), alter one message, re-enable, and `Verify chain` now reports `1 mismatch` with the correct entry number and the critical banner appears; restore by truncating nothing (the test restores via a DB snapshot taken before — use `pg_dump`/restore of the table in the teardown, documented). Live stream: with the page open, perform an action in a second context (e.g. a failed login) and a new row appears within 5 s with the LIVE pill; pausing buffers it (`1 new`), resuming merges it; the CSV export contains the header and neutralises a `=HYPERLINK(` message (seed one via a contact message).
**`23-advisory-broadcast.spec.ts`:** as `reed@vunvault.com` create an advisory for `CVE-2026-21447` with `Import from NVD` (fake NVD), add scope `Struts 2` (category `Web & API`), save; the Emergency Broadcast dialog keeps `Broadcast Now` disabled until five acknowledgements + `BROADCAST` typed; a wrong phrase keeps it disabled; as `analyst@vunvault.com` the broadcast button is absent; after the broadcast the toast shows the real audience (Acme has the matching asset, Beta does not); the progress strip reaches `Delivered…`; the fake mailbox has the advisory e-mail for Acme users and none for Beta; the audit log has one `ADVISORY_BROADCAST` entry with `SEV-1`; the Acme client (logged in on another page) gets the toast `New zero-day advisory` via SSE within 10 s and the advisory appears in `/portal/advisories`; `Acknowledge` flips to `Acknowledged`; re-running the worker job (replay via the control route) sends NO duplicate e-mails (assert the mailbox count); `Retract` (as admin) removes it from the client feed and sends the retraction notice.
**`24-rbac-csrf.spec.ts`:** a table-driven walk: for each of the 7 roles, visit each `/admin/*` and `/portal/*` route and assert allow/redirect/forbidden according to the permission map (derive the expected table from `ROLE_PERMISSIONS` in `@vunvault/contracts`, not hard-coded); API-level: a state-changing request with the session cookie but WITHOUT `x-csrf-token` → `403 csrf_failed`; with a wrong token → 403; with the right token → success; cookie flags (`HttpOnly`, `Secure` where applicable, `SameSite`) asserted from `Set-Cookie` of the login response; tokens never appear in `localStorage`/`sessionStorage`/response JSON (scan after login); CORS: a request with `Origin: https://evil.example` receives no `access-control-allow-origin`; the origin-verification header is required when the stack runs with `ORIGIN_VERIFY_ENFORCE=true` (a dedicated Playwright project hits the API directly without the header → 403); rate limits: the 6th login attempt for the same email within a minute is `429`.
**`25-staff-lifecycle.spec.ts`:** as `reed@vunvault.com` provision a new analyst (`new.analyst@vunvault.com`) with the checklist → the invitation e-mail arrives → open `/accept-invite?token=…` (token from the e-mail), set a 14+ character password → `Account activated`; the new staff session is `aal1`, so `/admin` shows the MFA-required state until TOTP is enrolled (via `/admin/profile#security`); after enrolment `/admin` works; the same token cannot be reused (`Invitation not valid`); `admin@vunvault.com` cannot suspend anyone (actions hidden) while `reed` can suspend the new analyst → the analyst's open session stops working within the registry TTL (≤ 35 s; poll) and login is refused with `Sign-in failed`; the last super-admin cannot be demoted or suspended (error toast).
**All specs** finish by asserting there are no `console.error` messages, and the audit log contains an entry for every state-changing action performed (spot-check by event type).

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no new endpoints.

---

**Out of scope:**
- Do not weaken immutability or isolation controls to make tests pass.
- Do not leave the audit table modified after the tamper test (restore it).
- Do not use production secrets.
- Do not add test-only routes to the API.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm e2e -- specs/2` passes locally and in CI.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 107 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 108 — Security hardening: Sentry everywhere, CSP reporting, Semgrep policy rules, action SHA pinning, security.txt, ZAP baseline

**Layer:** L14

**Prerequisites:** Task 43, Task 103, Task 104, Task 107

**Estimated files touched:** 26

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Security hardening: Sentry everywhere, CSP reporting, Semgrep policy rules, action SHA pinning, security.txt, ZAP baseline**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add error monitoring with scrubbing, CSP violation reporting, repository-specific static analysis that forbids dangerous patterns, automatic GitHub Action SHA pinning, a `security.txt`, and a scheduled DAST baseline.

**Deliverables:**
- `apps/api/src/plugins/sentry.ts` (MODIFY Task 23) — add release/environment tags and performance sampling from env; `packages/server-kit/src/observability/sentry.ts` — shared `initSentry` for the workers (scrubbing identical to the API).
- MODIFY `apps/broadcast-worker/src/main.ts`, `apps/maintenance-worker/src/main.ts`, `apps/scan-worker/src/main.ts` — initialise Sentry (DSN optional).
- `apps/web/src/lib/sentry-client.ts`, `apps/web/src/lib/sentry-scrub.ts` — `@sentry/browser`-based client init (works on Cloudflare Pages edge), `beforeSend`/`beforeBreadcrumb` scrubbing (drop request bodies, cookies, query strings, `password`/`code`/`token`/`recoveryAnswer` fields, URL fragments).
- MODIFY `apps/web/src/app/providers.tsx` — init Sentry client once when `NEXT_PUBLIC_SENTRY_DSN` is set; MODIFY `apps/web/src/app/error.tsx` and `global-error.tsx` — report errors.
- `apps/web/src/lib/sentry-scrub.test.ts`, `packages/server-kit/src/observability/sentry.test.ts`.
- MODIFY `apps/web/src/lib/csp.ts` (Task 43) — add `report-uri /csp-report` and `report-to csp` + the `Reporting-Endpoints` header from the middleware; `apps/web/src/app/csp-report/route.ts` — edge route handler (`runtime = "edge"`) that accepts `application/csp-report` and `application/reports+json`, validates with Zod, rate limits per IP via a simple in-memory token bucket, and forwards a SANITISED summary to Sentry as a message (no URLs with query strings, truncated fields).
- `apps/web/src/app/csp-report/route.test.ts`.
- `.semgrep/vunvault.yml` — custom rules (below) and `.semgrep/tests/*.ts` annotated test cases; MODIFY `.github/workflows/security.yml` — add a `semgrep` job (`semgrep ci --config .semgrep --error`).
- `renovate.json` — OR `.github/workflows/pin-actions.yml` — pick ONE: use `pinact` in a scheduled workflow that opens a PR pinning every `uses:` to a full commit SHA with the version in a comment; MODIFY `scripts/verify-workflows.mjs` — after the pin PR lands, third-party `uses:` MUST be SHA-pinned (rule becomes an error; first-party `actions/*` may stay on tags).
- `apps/web/public/.well-known/security.txt` — fields below.
- `.github/workflows/dast.yml` — scheduled (weekly) + manual ZAP baseline against STAGING (`zaproxy/action-baseline`), report artifact, fails on HIGH alerts; rules file `.zap/rules.tsv` with documented false-positive suppressions (empty at start).
- `docs/security/hardening-checklist.md` — what was done and what remains (pen test, bug bounty).
- MODIFY `docs/adr/0002-api-conventions.md` — add the Sentry scrubbing rule.

**Dependencies allowed:**
- `@sentry/node` (already present in the API), `@sentry/browser` in `apps/web`, `zod`.
- Semgrep and pinact run in CI as tools — not repo dependencies.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Scrubbing contract (identical for API, workers, browser; test with the same fixture):** drop request/response bodies and cookies entirely; keep only method, route TEMPLATE (never raw URLs with ids/tokens), status; remove headers `cookie`, `authorization`, `x-csrf-token`, `x-origin-verify`, `x-vv-signature`; recursively redact any key matching `/pass|secret|token|code|answer|authorization|cookie|key|signature|otp|cvc|pan|email|phone/i` to `[Filtered]`; truncate strings to 500 chars; set `sendDefaultPii: false`; user context contains ONLY the user id (UUID) and role — no e-mail or name; sample rates from env (`SENTRY_TRACES_SAMPLE_RATE`, default 0.1 production). The fixture test feeds an event containing a password, a JWT, an e-mail and a recovery code and asserts none survive.
**Semgrep rules (`.semgrep/vunvault.yml`, each with `message`, `severity: ERROR`, `languages: [typescript, tsx, javascript]` and a positive and negative test file):** (1) `dangerouslySetInnerHTML` and `.innerHTML =`/`insertAdjacentHTML` anywhere in `apps/web` (allow-list: none); (2) `localStorage`/`sessionStorage` usage in `apps/web` and `packages/ui`; (3) `eval(`, `new Function(`, string-argument `setTimeout/setInterval`; (4) `child_process` `exec`/`execSync`, or `spawn`/`execFile` with `shell: true` anywhere EXCEPT none; (5) `Math.random()` used to produce tokens/ids/codes in `apps/api`, `packages/server-kit` (must use `crypto`); (6) `fetch(` to a variable URL inside `apps/api` without a `// ssrf-ok:` justification comment (SSRF review aid); (7) Drizzle `sql.raw(` with non-literal arguments; (8) imports of `express`, `@prisma/client`, `joi`; (9) `JSON.parse(` of request data without Zod nearby is NOT enforced (too noisy) — skip; (10) `console.log` in `apps/api`, workers (use pino); (11) any `*.update(auditEntries)`/`delete(auditEntries)`/`db.update(` targeting the audit tables; (12) `app.get|post|put|patch|delete(` registered in `apps/api` without `schema:` (route table test already covers; this is a fast-fail).
**CSP reporting:** the `report-uri` endpoint accepts bodies ≤ 8 KB; unknown shapes → `204` and nothing logged; dedupe identical violations per IP for 60 s; never log full URLs, only `violated-directive`, `blocked-uri` origin and `document-uri` path. `Reporting-Endpoints: csp="/csp-report"` set by the middleware; the policy itself stays ENFORCING.
**`security.txt` (RFC 9116):** `Contact: mailto:security@vunvault.com`, `Expires: <one year ahead, ISO 8601 — compute at write time and add a CI check that fails 30 days before expiry>`, `Encryption: https://www.vunvault.com/vunvault-pgp.asc`, `Preferred-Languages: en, sw`, `Canonical: https://www.vunvault.com/.well-known/security.txt`, `Policy: https://www.vunvault.com/contact?category=vulnerability_report#contact-form`. Add `scripts/verify-security-txt.mjs` + test and include in `pnpm verify`.
**DAST:** the ZAP baseline runs unauthenticated against `https://www.staging.<zone>` and `https://api.staging.<zone>/openapi.json` (API scan); never against production.

**Tests (assert):** scrub fixture; CSP report route accepts both content types, rejects oversize, dedupes, and forwards only sanitised fields; each Semgrep rule fires on its positive sample and not on the negative (run `semgrep --test` in CI); `verify-security-txt` fails when `Expires` is < 30 days away.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /csp-report (web edge route) content-type application/csp-report | application/reports+json → 204
```

---

**Out of scope:**
- Do not enable Sentry session replay.
- Do not send any PII to Sentry.
- Do not run DAST against production.
- Do not weaken the enforcing CSP.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify` passes (including `verify-security-txt`), `pnpm --filter web test` and `pnpm --filter @vunvault/server-kit test` pass, and `semgrep --test .semgrep` passes in CI.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 108 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 109 — Observability: Prometheus metrics, OpenTelemetry traces, Grafana Cloud agent, dashboards and alert rules as code

**Layer:** L14

**Prerequisites:** Task 98, Task 99, Task 102, Task 104, Task 108

**Estimated files touched:** 34

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Observability: Prometheus metrics, OpenTelemetry traces, Grafana Cloud agent, dashboards and alert rules as code**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Instrument the API, workers and scan controller with metrics and traces, ship logs/metrics/traces to Grafana Cloud with Grafana Alloy, and manage dashboards, alerts and contact points with Terraform.

**Deliverables:**
- `packages/server-kit/src/observability/metrics.ts` — `createMetrics(app)` using `prom-client` (default metrics + custom).
- `packages/server-kit/src/observability/tracing.ts` — OpenTelemetry bootstrap (`@opentelemetry/sdk-node`, OTLP/HTTP exporter, Fastify/HTTP/ioredis/pg instrumentations, BullMQ job spans).
- `packages/server-kit/src/observability/*.test.ts`.
- `apps/api/src/plugins/metrics.ts` — request metrics hook + internal metrics server on `METRICS_PORT` (9464, bound to the pod IP, NOT exposed through the Service/Ingress).
- MODIFY `apps/broadcast-worker/src/main.ts`, `apps/maintenance-worker/src/main.ts`, `apps/scan-worker/src/main.ts` — metrics server + tracing init + queue/job metrics.
- `apps/api/src/plugins/metrics.test.ts`.
- MODIFY `infra/helm/vv-common/templates/_deployment.tpl` and the three app charts + scan-controller chart — expose container port `metrics` (9464) with scrape annotations `prometheus.io/scrape`, `prometheus.io/port`; NetworkPolicy ingress from the `monitoring` namespace to 9464.
- `infra/helm/monitoring/Chart.yaml`, `values.yaml`, `values-production.yaml`, `templates/alloy-configmap.yaml`, `templates/*` — wrapper chart that installs Grafana Alloy (`k8s-monitoring` or `alloy` chart, pinned version) with a config that scrapes annotated pods, collects pod logs (dropping known-sensitive patterns), and forwards metrics/logs/traces to Grafana Cloud endpoints from values; credentials come from an ExternalSecret (`GRAFANA_CLOUD_API_KEY` in OCI Vault).
- `infra/terraform/grafana/versions.tf`, `providers.tf`, `variables.tf`, `folders.tf`, `dashboards.tf`, `alerts.tf`, `contact-points.tf`, `notification-policy.tf`, `README.md` — provider `grafana/grafana ~> 3.0`.
- `infra/grafana/dashboards/api-red.json`, `queues.json`, `scan-controller.json`, `business.json`, `edge.json`.
- `infra/grafana/alerts/rules.yaml` (rule definitions consumed by `alerts.tf` through `yamldecode`).
- `scripts/verify-grafana.mjs` + `scripts/verify-grafana.test.mjs` — validates dashboard JSON (schema essentials, unique uids) and alert rule fields.
- MODIFY `scripts/verify-terraform.mjs` — include the Grafana directory.
- `docs/observability.md` — 40 lines: signals, naming, cardinality rules, how to add a metric/alert.

**Dependencies allowed:**
- `prom-client`, `@opentelemetry/api`, `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-fastify`, `@opentelemetry/instrumentation-ioredis`, `@opentelemetry/instrumentation-pg` (in `packages/server-kit`).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Metric naming (Prometheus; labels bounded — NEVER user ids, e-mails, URLs, or job ids):** HTTP: `vv_http_requests_total{method,route,status_class}` and `vv_http_request_duration_seconds` histogram (buckets 0.025…10 s) using the ROUTE TEMPLATE; auth: `vv_auth_attempts_total{outcome}` (`success|failure|mfa_failure|rate_limited`); payments: `vv_payments_total{provider,channel,outcome}` and `vv_ledger_unbalanced_total` (incremented by the reconcile job on findings); scans: `vv_scan_jobs_total{outcome}`, `vv_scan_active` gauge, `vv_scan_duration_seconds` histogram, `vv_scan_output_lines_total`; queues (workers/API): `vv_queue_jobs{queue,state}` gauges polled every 15 s from BullMQ (`getJobCounts`), `vv_queue_job_duration_seconds{queue,task}`, `vv_queue_failures_total{queue,task}`; broadcasts: `vv_broadcast_deliveries_total{channel,outcome}`; audit: `vv_audit_append_total{category}`, `vv_audit_chain_mismatches` gauge (from the verify job), `vv_audit_append_latency_seconds`; nodes: `vv_sensor_nodes{status}` gauge; plus `prom-client` default process/GC metrics with the prefix `vv_`. The metrics server serves `GET /metrics` only (404 otherwise), no auth (cluster-internal; the NetworkPolicy restricts it).
**Tracing:** service names `vv-api`, `vv-broadcast-worker`, `vv-maintenance-worker`, `vv-scan-controller`; W3C trace-context propagated from the edge Worker (Task 102 — add `traceparent` pass-through test there only if trivial; otherwise leave); BullMQ: producer injects `traceparent` into job data (`_trace`), consumer continues the trace; sampling `ParentBased(TraceIdRatio(OTEL_TRACES_SAMPLER_ARG))` default 0.1; span attributes allow-list (route template, job queue/task, status) — **no request bodies, headers, SQL parameters or user data** (set `db.statement` capture to off).
**Alloy / Grafana Cloud:** the monitoring chart's Alloy config has blocks for `prometheus.scrape` (pods with the annotation), `loki.source.kubernetes` (stdout/stderr of the `vunvault` and `vv-scan-system` namespaces — NOT `vv-scans` scan pods; their output is already handled by the controller), a `loki.process` stage dropping lines matching the redaction patterns from Task 85 as a last line of defence, `otelcol.receiver.otlp` for traces, exporters with `basic_auth` from the mounted secret. The scan cluster (k3s) gets its own Alloy instance via `values-scan.yaml` scraping only the controller.
**Dashboards (JSON, provisioned as code; each panel has a title, unit, and a `description`):** `api-red` (rate, errors %, p50/p95/p99 by route template, auth outcomes, rate-limit hits), `queues` (depth, failures, durations per queue/task, oldest waiting age), `scan-controller` (active scans vs `WORKER_SLOTS_TOTAL`, outcomes, durations, output volume, control messages), `business` (payments by provider/channel in USD count, failures, advisories broadcast, deliveries, new signups), `edge` (requests, 4xx/5xx, latency by route template from the Analytics Engine export is NOT available here — use the API-side histograms).
**Alert rules (`rules.yaml`: name, expr, for, severity, summary, runbook URL under `docs/runbooks/`):** `ApiHighErrorRate` (5xx > 2 % for 10 m, sev2), `ApiLatencyP95High` (> 1.5 s for 15 m, sev3), `AuthFailureSpike` (failures > 5× baseline for 10 m, sev2), `AuditChainMismatch` (`vv_audit_chain_mismatches > 0`, **sev1**, no `for`), `LedgerUnbalanced` (`increase(vv_ledger_unbalanced_total[1h]) > 0`, sev1), `QueueBacklog` (waiting > 500 for 10 m, sev3), `QueueOldestJobAge` (> 15 m, sev2), `BroadcastFailures` (failed deliveries > 20 % of attempted over 15 m, sev1), `ScanControllerDown` (no active controller pods, sev2), `ScanOutputOrErrorSpike` (scan failures > 50 % over 30 m, sev3), `SensorNodesOffline` (offline nodes ≥ 3, sev2), `WebhookSignatureFailures` (`increase(vv_http_requests_total{route=~"/api/v1/webhooks/.*",status_class="4xx"}[10m]) > 20`, sev2), `PodRestarts`, `DbConnectionsHigh`. Severities map to routes: sev1 → pager (contact point `oncall-pager`), sev2 → `oncall-slack` + email, sev3 → email. Contact points use PLACEHOLDER settings read from sensitive Terraform variables (never committed).

**Tests (assert):** the metrics plugin exposes `/metrics` on the internal port only, counts a request under its route TEMPLATE (not the raw URL), and never emits a label containing a UUID (fixture test); BullMQ gauges update from a fake queue; tracing init is a no-op without an endpoint; `verify-grafana` rejects a dashboard without uid/title, duplicate uids, a panel without a unit, and an alert missing `severity` or a runbook URL; the Helm verify script confirms the metrics port and NetworkPolicy rule exist.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
```ts
// Internal only: GET :9464/metrics (Prometheus exposition); OTLP/HTTP → Grafana Cloud
```

---

**Out of scope:**
- Do not expose `/metrics` through the Service or Ingress.
- Do not put user data, ids or URLs in metric labels or span attributes.
- Do not commit Grafana tokens or webhook URLs.
- Do not instrument the scan pods.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm --filter @vunvault/server-kit test`, `pnpm --filter api test`, `node --test scripts/verify-grafana.test.mjs` and `pnpm verify` pass.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 109 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 110 — Closeout: runbooks, key rotation and audit-snapshot verification tools, scan kill switch, load tests, ADR index, go-live checklist

**Layer:** L14

**Prerequisites:** Task 92, Task 104, Task 107, Task 108, Task 109

**Estimated files touched:** 26

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Closeout: runbooks, key rotation and audit-snapshot verification tools, scan kill switch, load tests, ADR index, go-live checklist**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Finish the platform: operational runbooks, the tooling they rely on (audit key rotation, snapshot verification, scan kill switch), k6 load tests for staging, the ADR index and architecture documentation, and an evidence-based go-live checklist.

**Deliverables:**
- `scripts/ops/rotate-audit-key.mjs` + `scripts/ops/rotate-audit-key.test.mjs` — appends the `KEY_ROTATION` audit entry after the operator updates the Vault secret (procedure in the runbook).
- `scripts/ops/verify-audit-snapshots.mjs` + test — recomputes hash-chain continuity across daily snapshot files (`audit-snapshots/…jsonl` + `.sha256`) and compares the head with the database.
- MODIFY `apps/scan-worker/src/queue/consumer.ts` — **scan kill switch**: before claiming, check Redis key `scan:disabled`; when set, requeue the job with a 60 s delay and log `warn` (no claim, no pods). MODIFY `apps/scan-worker/src/queue/consumer.test.ts` (create if absent).
- `scripts/ops/scan-kill-switch.mjs` — `on`/`off`/`status` CLI (Redis URL from env) + test; also deletes running scan Jobs when run with `--terminate` (through the Kubernetes API with the operator's own kubeconfig).
- `tests/load/api-read.js`, `tests/load/auth.js`, `tests/load/sse-ws.js`, `tests/load/README.md`, `tests/load/thresholds.json` — k6 scripts.
- `.github/workflows/load.yml` — manual workflow running k6 against STAGING only (never production), artifacts uploaded.
- `docs/runbooks/README.md`, `incident-response.md`, `audit-chain-mismatch.md`, `ledger-unbalanced.md`, `key-rotation.md`, `scan-abuse-and-kill-switch.md`, `provider-outage.md`, `database-restore.md`, `broadcast-failure.md`, `secrets-inventory.md`, `oncall.md`.
- `docs/architecture.md` — system diagram (Mermaid), trust zones, data flows, the isolation model, and the money flow.
- `docs/adr/README.md` — index of all ADRs (0001–0003 plus the new ones below) with one-line summaries.
- `docs/adr/0004-usd-settlement.md`, `0005-secrets-and-identity.md`, `0006-release-lock-and-review-gate.md`, `0007-realtime-transports.md` — one-page ADRs.
- `docs/go-live.md` — checklist with an **evidence column** (link/command/owner/date).
- MODIFY root `README.md` — project overview, architecture link, quick start (`pnpm install`, `pnpm dev`, `pnpm verify`, `pnpm e2e`), repo map, and links to runbooks.
- `scripts/verify-docs.mjs` + test — checks that every runbook referenced by alert rules and every ADR is listed in the index, and every relative link in `docs/**/*.md` resolves.
- MODIFY root `package.json` — extend `verify` with `verify-docs`.

**Dependencies allowed:**
- None — use only existing (`k6` runs as a CI tool, not a package).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Runbook format (every file in `docs/runbooks/`):** `Purpose`, `Severity & who is paged`, `Detection (alert name / dashboard link)`, `Immediate actions (numbered, copy-pasteable commands)`, `Diagnosis`, `Recovery`, `Verification (how to know it is fixed)`, `Post-incident (audit entries to write, comms, ticket)`. Required content:
- `incident-response.md`: SEV-1/2/3 definitions matching the platform's audit severities (SEV-1 = confirmed compromise, audit-chain integrity failure, mis-broadcast, unbalanced ledger; SEV-2 = degraded security control or partial outage; SEV-3 = minor), the incident commander role (env `INCIDENT_COMMANDER_ID` rotation), communication templates, evidence preservation (never delete logs; snapshot the audit table), regulatory notification timelines placeholder for Kenya/Nigeria/Ghana/SA data-protection regimes (marked **LEGAL REVIEW REQUIRED** — do not state legal conclusions).
- `audit-chain-mismatch.md`: the chain is append-only, so do NOT freeze or edit it — preserve, compare with the last good snapshot using `verify-audit-snapshots.mjs`, identify the first mismatching `seq`, restore the table from PITR into a side schema for forensic diff, never UPDATE/DELETE audit rows in place; record the investigation as a new audit entry).
- `ledger-unbalanced.md`: use `POST /admin/payments/reconcile`, post REVERSAL entries only (the ledger is immutable), reconcile with provider dashboards.
- `key-rotation.md`: AUDIT_HMAC_KEY / AUDIT_AES_KEY rotation using the key-ring JSON (`{ "current": "<new id>", "keys": { … } }`): add the new key id, deploy, run `rotate-audit-key.mjs` to write `KEY_ROTATION`, keep old keys for verification (7-year retention), then the equivalent for `SUPABASE_JWT_SECRET`, `SCAN_CONTROLLER_HMAC_KEY` (rotate with overlap by accepting two keys during a window — document the manual two-key overlap since the code accepts ONE: add a note that supporting two keys is a future change), `EDGE_ORIGIN_SECRET`, provider keys, and TLS origin certificates.
- `scan-abuse-and-kill-switch.md`: signs of abuse (targets not authorised, request floods, hostile output), `scan-kill-switch.mjs on --terminate`, revoking a client's scan permission (suspend the org's users), preserving evidence, notifying the target owner placeholder.
- `provider-outage.md`: Stripe/Paystack/Resend/Africa's Talking/Twilio/Upstash/Supabase/Cloudflare/OCI — behaviour of the platform in each case (what degrades, what keeps working), manual workarounds, who to call.
- `database-restore.md`: Supabase PITR, restore drill steps, RPO/RTO targets (RPO ≤ 5 min via PITR, RTO ≤ 2 h — state as targets to be validated, not guarantees), verify the audit chain after restore.
- `broadcast-failure.md`: mis-broadcast response (retract advisory path, comms), partial-failure resend (idempotent worker), SMS cost controls.
- `secrets-inventory.md`: table of every secret name (from `SECRET_NAMES` + Cloudflare/Terraform tokens): owner, location (OCI Vault / GitHub environment / Cloudflare), rotation interval, blast radius.
- `oncall.md`: rotation, escalation, handover checklist.
**Tools:** `rotate-audit-key.mjs` connects with the same secret provider as the API, verifies that the NEW key id exists in the Vault key ring JSON and that the previous `current` is still present, then appends `KEY_ROTATION` (info, message `Audit key ring rotated · current <key id>` — key ids only, no key material) via `AuditService`; refuses to run twice for the same key id. `verify-audit-snapshots.mjs --from <date> --to <date>` downloads (R2 S3 API with read-only credentials from env) each snapshot + hash, checks the SHA-256, checks that `entry[n].prev_hash == entry[n-1].hash` within and across days and that `seq` is contiguous, and optionally compares the final `hash` with `SELECT hash FROM audit_entries WHERE seq = …`; exit non-zero on any discrepancy; prints seq numbers only.
**Load tests (k6; thresholds in `thresholds.json`):** `api-read.js` — `GET /healthz`, public `GET /api/v1/content`, `GET /api/v1/products` at 50 VUs for 5 min (p95 < 400 ms, error rate < 0.5 %); `auth.js` — login + session + logout for seeded staging load users at 10 VUs (p95 < 800 ms; verifies rate limits return 429 not 5xx); `sse-ws.js` — 200 concurrent SSE streams on the audit stream with a seeded auditor and 100 WebSocket scan streams on a simulated scan: connection success ≥ 99 %, no process restarts (assert via the Grafana API is out of scope — document). Scripts read the base URL and credentials from env and refuse hosts not ending in `.staging.<zone>` (guard in each script).
**`go-live.md` (checkbox list, each item with `Evidence`):** all tasks' Definition of Done met; CI and E2E green on `main`; Terraform applied in production with reviewed plans; Vault secrets set (inventory complete); Cloudflare WAF/rate limits/Authenticated Origin Pulls verified by `smoke.mjs`; Stripe and Paystack LIVE keys set and a live USD test transaction refunded; Paystack USD/M-Pesa capability confirmed in writing; Turnstile enforcement enabled for `/contact` and signup; MFA mandatory for all staff verified; first audit snapshot exists and verifies; backups/PITR drill performed; alerts routed and test-fired; load test passed on staging; external penetration test completed with all HIGH findings closed; legal pages (terms, privacy, cookie policy) published and `public/vunvault-pgp.asc` + `security.txt` live; incident commander and on-call rotation staffed; DPA/records of processing completed; status communication plan ready. Items requiring a human decision are marked `OWNER: <role>`; nothing is pre-checked.

**Tests (assert):** `rotate-audit-key` refuses a missing/unchanged key id and writes exactly one entry (fake AuditService); `verify-audit-snapshots` passes a valid chain fixture, fails on a flipped byte, a gap in `seq`, a broken `prev_hash`, and a mismatching DB head; the scan consumer — with `scan:disabled` set no claim is made and the job is delayed 60 s; k6 scripts parse (`k6 inspect` in CI) and the staging-host guard aborts for another host; `verify-docs` fails on a broken relative link or an unindexed ADR.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no HTTP API changes.

---

**Out of scope:**
- Do not run load tests against production.
- Do not state legal conclusions or invent regulatory deadlines.
- Do not pre-check any go-live item.
- Do not edit audit records in any runbook procedure.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm verify` passes (including `verify-docs`) and `node --test scripts/ops/*.test.mjs` plus `pnpm --filter scan-worker test` pass.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 110 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


This is Part 5 of 5. The catalogue is complete.
