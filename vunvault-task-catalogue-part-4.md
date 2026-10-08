# VUNVAULT — Task Catalogue for coder.qwen.ai

## Part 4 of 5 — Backend addenda (40f–40g), L8 client portal, L9 admin surface, L10 scan worker

## What changed in this part (read first)

**Two more backend addenda run first** (after Task 40e, before Task 41; order `40e → 40f → 40g → 41`):
- **40f** — an admin **contact inbox** and **client directory**. The public Contact form (Task 40) stored messages but nothing let an administrator read them, and the Verified-Blogger badge had no way to find a client.
- **40g** — **HMAC-signed internal callbacks** so the scan controller reports to the API instead of holding database credentials. This is a deliberate hardening of your isolation model: the k3s zone (which touches untrusted targets) has no DB access at all.

**Frontend:** L8 (client portal, Tasks 66–74) and L9 (admin, Tasks 75–83e). Pages with a prototype embed its markup and CSS (extracted from your files); pages **without** a prototype are marked *planner-authored* and use the shared primitives: portal scans (69), advisories (70), licences (73), pay-invoice dialog (66b), placeholders (74), admin contact inbox (83e). Admin pages import one shared stylesheet (Task 75) so each page prompt carries only its own CSS.

**Splits (size limit):** Billing → 66 + 66b; Users → 79 + 79b (+80 dialogs); Zero-Day → 81 + 82 (broadcast dialog); Profile Settings → 83c + 83d; Audit Logs is 83b.

**L10 scan worker (84–88).** Controller on k3s → one unprivileged pod per scan. Controls encoded as tests: non-root 65532, no privilege escalation, read-only root FS, all capabilities dropped, no service-account token, 900 s deadline, 1 GiB tmpfs scratch, egress only to the pinned target IPs, output sanitised (ANSI stripped, credentials redacted, 8 KB lines), WebSocket messages limited to abort/pause/resume/kill.

**Decisions and deviations — please review:**
1. **Raw card fields removed.** The prototype's Edit Payment dialog collected card number/expiry/CVC in plain inputs. The prompts require Stripe-hosted fields (Task 66); VUNVAULT never sees card data. Stored payment methods are **Stripe-only in v1**; Paystack (M-Pesa, African cards, bank) is per-invoice at checkout (66b).
2. **No per-user permission overrides.** The prototype's permission dialog implies per-capability overrides; the API has role-based permissions only. Task 80 turns it into a role-change UI with a permission diff.
3. **Internal-network scans are not possible in v1.** The scan cluster is in the cloud and cannot reach customers' private networks, so private/internal targets are rejected (Task 84). An `internal`/`network` scan type works only for public addresses. A customer-side agent would be a later project.
4. **Pause/resume are no-ops.** Pausing a pod needs `pods/exec`, which the controller's RBAC deliberately lacks (Task 86); the UI will say so.
5. **Some prototype actions have no API** and are rendered disabled with a tooltip: content review-log export, WORM snapshot, profile editor for staff, report preview.
6. **Scan tools (Task 87):** nmap (connect scans only), httpx, nuclei, testssl.sh with pinned versions; checksums are build args that CI must supply (they are not invented here). Nuclei templates are baked into the image; no runtime updates.
7. A scan that fails or times out is stored as status `held` (the status enum has no `failed`).
8. "Incident Commander" appears in the admin profile prototype but has no data source; it is not shown.

**Operator steps:** set `SCAN_CONTROLLER_HMAC_KEY` (API and controller), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and the dedicated `vv/pool=scan` node label/taint on the k3s scan nodes (DevOps layer).

## Reserved numbering for remaining parts

| Reserved | Layer | Scope | Part |
|---|---|---|---|
| 89–92 | L11 | Background workers: **89** broadcast worker (advisory delivery: dashboards, e-mail, SMS, progress counters, retraction), **90** notify worker (e-mail / SMS / in-app queue consumer, receipts, OTP mails) + pdf worker (invoice PDFs via @react-pdf/renderer), **91** maintenance worker A (hourly metrics rollup, node heartbeat sweep, threat-level snapshot, scheduled publish), **92** maintenance worker B (purge login attempts, expire invitations, flag dormant accounts, stale signups, outbox re-enqueue, avatar/image scan, audit snapshot) | 5 |
| 93–96 | L12 | Real-time wiring: **93** audit SSE client + live ticker, **94** broadcast delivery progress (SSE), **95** scan WebSocket relay in the API (Redis → WS, whitelist abort/pause/resume/kill), **96** scan terminal UI in the client portal and admin queue | 5 |
| 97–104 | L13 | DevOps: Dockerfiles (api, workers, controller; distroless), Terraform (OCI OKE, k3s, Vault, Registry; Cloudflare Pages/Workers/R2/Logpush), Helm charts (api, scan-worker, broadcast-worker, maintenance-worker), GitHub Actions (CI, CD, security scan) | 5 |
| 105–110 | L14 | Integration, Playwright E2E, load/security hardening, final ADRs | 5 |

**Plan total:** ≈ 125 tasks including lettered additions (all strictly forward-ordered).

## Sequence Overview (this part)

| # | Layer | Task title | Depends on | Files touched |
|---|---|---|---|---|
| 40f | L4 | Backend addendum C: admin contact inbox and client directory | Task 18, Task 20, Task 24, Task 25, Task 31, Task 40 | 9 |
| 40g | L4 | Backend addendum D: HMAC-signed internal scan-controller callbacks (claim, progress, findings, log URL, complete, fail) | Task 25, Task 34, Task 35, Task 29, Task 22, Task 40 | 14 |
| 66 | L8 | Billing & Invoices page: subscription, payment method (provider-hosted card fields), invoice history, CSV, PDF | Task 32, Task 45, Task 42, Task 12, Task 11 | 14 |
| 66b | L8 | Pay invoice dialog: currency selection with locked FX quote, provider/channel choice, USD checkout | Task 33, Task 34, Task 66 | 10 |
| 67 | L8 | Password Manager & Security page: password change, TOTP, security key, recovery codes | Task 27, Task 45, Task 42, Task 10 | 14 |
| 68 | L8 | Client profile page | Task 30, Task 45, Task 42, Task 10 | 8 |
| 69 | L8 | Portal home: released scans list and report detail (planner-authored — no prototype) | Task 35, Task 12, Task 9, Task 45 | 11 |
| 70 | L8 | Portal advisories feed with acknowledge (planner-authored — no prototype) | Task 38, Task 45, Task 9 | 7 |
| 71 | L8 | Content Studio A: badge gate and my-submissions list | Task 36, Task 45, Task 12 | 9 |
| 72 | L8 | Content Studio B: article editor with autosave, tags, featured image, readiness and submit | Task 36, Task 71, Task 40c | 16 |
| 73 | L8 | Licences & downloads page (planner-authored — no prototype) | Task 40c, Task 66, Task 45 | 7 |
| 74 | L8 | Reserved portal and academy routes (coming-soon pages) | Task 41, Task 44, Task 45 | 8 |
| 75 | L9 | Admin shared stylesheet and PageHead component | Task 5, Task 8, Task 9, Task 46 | 5 |
| 76 | L9 | Admin Command Center dashboard | Task 37, Task 46, Task 75, Task 12 | 15 |
| 77 | L9 | Admin Scan Queue: summary, filters, table, bulk actions | Task 35, Task 46, Task 75, Task 12 | 14 |
| 78 | L9 | Admin Mandatory Review Gate dialog | Task 35, Task 77, Task 11 | 8 |
| 79 | L9 | Admin User & Access Management A: summary, filters, roster, row actions | Task 31, Task 46, Task 75, Task 12 | 12 |
| 79b | L9 | Admin User & Access Management B: invitations panel and role/permission matrix | Task 31, Task 79 | 6 |
| 80 | L9 | Admin User & Access Management B: Provision New Team Member and permission override dialogs | Task 31, Task 79, Task 11, Task 10 | 10 |
| 81 | L9 | Admin Zero-Day Intel A: summary, advisory editor, NVD import, drafts, recent advisories | Task 38, Task 46, Task 75 | 15 |
| 82 | L9 | Admin Zero-Day Intel B: irreversible Emergency Broadcast dialog | Task 38, Task 81, Task 11 | 8 |
| 83 | L9 | Admin Content Moderation: queue, filters and editorial review dialog | Task 36, Task 46, Task 75, Task 12, Task 11 | 14 |
| 83b | L9 | Admin Audit Logs: summary, filters, chain status, verification, export, event detail | Task 39, Task 46, Task 75, Task 12 | 14 |
| 83c | L9 | Admin Profile Settings A: identity, personal details, avatar | Task 28, Task 46, Task 75, Task 10 | 11 |
| 83d | L9 | Admin Profile Settings B: security & credentials, active sessions, notification preferences | Task 27, Task 29, Task 67, Task 83c | 13 |
| 83e | L9 | Admin Contact inbox and Verified-Blogger badge management (planner-authored — no prototype) | Task 40f, Task 46, Task 75, Task 12 | 10 |
| 84 | L10 | Scan controller foundation: env, queue consumer, target guard, signed API client, control channel | Task 3, Task 4, Task 22, Task 35, Task 40g | 15 |
| 85 | L10 | Scan output pipeline: ANSI stripping, credential redaction, line caps, finding normalisation | Task 84, Task 40g | 9 |
| 86 | L10 | Kubernetes pod runner: unprivileged per-scan Job, per-job NetworkPolicy, log streaming, deadline, control | Task 84, Task 85 | 17 |
| 87 | L10 | Scan runner (inside the pod): tool adapters, argument allow-lists, protocol output, hardened image | Task 85 | 18 |
| 88 | L10 | Controller wiring: live output to Redis, findings and progress to the API, log archive, isolation conformance suite | Task 84, Task 85, Task 86, Task 87, Task 40g | 11 |

---

### TASK 40f — Backend addendum C: admin contact inbox and client directory

**Layer:** L4

**Prerequisites:** Task 18, Task 20, Task 24, Task 25, Task 31, Task 40

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Backend addendum C: admin contact inbox and client directory**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Give administrators a way to read and triage public contact messages (including Verified-Blogger requests) and to search client accounts for the badge grant.

**Deliverables:**
- MODIFY `packages/contracts/src/contact.ts` — add `ContactMessageView`, `ContactListQuery`, `ContactTriageBody`, `ClientDirectoryItem`, `ClientDirectoryQuery`.
- MODIFY `packages/contracts/src/routes-b.ts` — document the four routes.
- `apps/api/src/routes/v1/contact-admin/index.ts`, `service.ts`, `repo.ts`.
- MODIFY `apps/api/src/routes/v1/index.ts` — one `register` line.
- MODIFY `apps/api/src/audit/events.ts` — add `CONTACT_TRIAGED` (info, administrative).
- MODIFY `apps/api/src/conformance/route-manifest.ts` — nothing to exempt; extend the contract-drift expectations.
- `apps/api/src/routes/v1/contact-admin/contact-admin.test.ts`.
- MODIFY `apps/api/src/audit/events.test.ts`.
- MODIFY `packages/contracts/fixtures/index.ts` and add `packages/contracts/fixtures/contact.ts` — six fixture messages and four client directory rows.

**Dependencies allowed:**
- None — use only existing.

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

**Permissions:** reads and triage need `support:handle` (held by `support_engineer`, `admin`, `super_admin`). Client directory needs `users:read`. All routes use `[authenticate, requireStaff, requirePermission(...)]`.

**Contracts:**
- `ContactMessageView = { id, name, email, organization: string | null, category: ContactCategory, categoryLabel: string, subject, message, status: "new"|"triaged"|"closed", assignedTo: { id: string; label: string } | null, createdAt: IsoDateTime }`.
- `ContactListQuery = PageQuery & { status?: ContactStatus, category?: ContactCategory }` (`q` searches name, email, organization, subject).
- `ContactTriageBody = { status?: ContactStatus, assignedTo?: Uuid | null }` with a refine that at least one is present.
- `ClientDirectoryItem = { id, fullName, email, company: string | null, clientCode: string | null, verifiedBlogger: boolean }`; `ClientDirectoryQuery = PageQuery & { verifiedBlogger?: boolean }`.

**Routes:**
- `GET /api/v1/admin/contact` (query `ContactListQuery`) → `{ data: ContactMessageView[]; total }` newest first. `message` is returned in full only to users with `support:handle`.
- `PATCH /api/v1/admin/contact/:id` body `ContactTriageBody` → `200 { data: ContactMessageView }`; `assignedTo` must be an active staff user; audited `CONTACT_TRIAGED` (details `{ status, assignedTo }`).
- `GET /api/v1/admin/clients` (query `ClientDirectoryQuery`, `users:read`) → `{ data: ClientDirectoryItem[]; total }`: profiles with `role = 'client'`, not deleted; `q` ILIKE on name, email, organization name, client code.
- The existing `POST/DELETE /admin/users/:id/blogger-badge` (Task 40) is used from the UI; no change.

**Tests (assert):** support engineer can list and triage but gets 403 on `/admin/clients`; assigning a client account as handler → `422 { error: "invalid_assignee" }`; list `q` filter; audit entry written on triage; the conformance suite passes.

---

**Data shape (TypeScript):**
```ts
interface ContactMessageView { id: string; name: string; email: string; organization: string | null; category: ContactCategory; categoryLabel: string; subject: string; message: string; status: "new" | "triaged" | "closed"; assignedTo: { id: string; label: string } | null; createdAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET   /api/v1/admin/contact query { page; pageSize; q?; status?; category? } → 200 { data: ContactMessageView[]; total }
// PATCH /api/v1/admin/contact/:id body { status?; assignedTo?: string | null } → 200 { data: ContactMessageView } | 404 | 422 invalid_assignee
// GET   /api/v1/admin/clients query { page; pageSize; q?; verifiedBlogger? } → 200 { data: ClientDirectoryItem[]; total }
```

---

**Out of scope:**
- Do not add reply/email-sending from the inbox.
- Do not expose raw IP hashes.
- Do not write UI.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40f complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 40g — Backend addendum D: HMAC-signed internal scan-controller callbacks (claim, progress, findings, log URL, complete, fail)

**Layer:** L4

**Prerequisites:** Task 25, Task 34, Task 35, Task 29, Task 22, Task 40

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Backend addendum D: HMAC-signed internal scan-controller callbacks (claim, progress, findings, log URL, complete, fail)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Give the scan controller a narrow, authenticated way to report job state and findings to the API (so it needs no database credentials), including audit entries, review-gate hand-off and reviewer notifications.

**Deliverables:**
- `apps/api/src/routes/v1/internal-scans/index.ts` — route plugin.
- `apps/api/src/routes/v1/internal-scans/service.ts` — `InternalScansService`.
- `apps/api/src/routes/v1/internal-scans/repo.ts` — repos.
- `apps/api/src/routes/v1/internal-scans/hmac-auth.ts` — `verifyInternalSignature` preHandler.
- MODIFY `packages/contracts/src/scans.ts` — add `InternalClaimResponse`, `InternalProgressBody`, `InternalFindingsBody`, `InternalCompleteBody`, `InternalFailBody`.
- MODIFY `packages/contracts/src/routes-d.ts` — document the routes.
- MODIFY `apps/api/src/lib/secrets/provider.ts` — add `SCAN_CONTROLLER_HMAC_KEY` to `SECRET_NAMES`.
- MODIFY `apps/api/src/config/env.ts` — add optional `SCAN_CONTROLLER_CIDRS: string` (comma-separated CIDR allow-list; empty = no IP restriction).
- MODIFY `apps/api/src/routes/v1/index.ts` — one `register` line.
- MODIFY `apps/api/src/conformance/route-manifest.ts` — add `/api/v1/internal/*` to `PUBLIC_ROUTES` (session-less), `CSRF_EXEMPT`, and `AUDIT_EXEMPT` ONLY for `progress`, `findings`, `log-url`; the others are audited by the service with the system actor.
- MODIFY `.env.example` — add the names `SCAN_CONTROLLER_HMAC_KEY=` and `SCAN_CONTROLLER_CIDRS=`.
- `apps/api/src/routes/v1/internal-scans/internal-scans.test.ts` and `hmac-auth.test.ts`.
- `packages/db/sql/0040g_scan_findings_dedupe.sql` — `CREATE UNIQUE INDEX IF NOT EXISTS scan_findings_dedupe ON scan_findings (job_id, md5(title || coalesce(cwe,'')));`.

**Dependencies allowed:**
- None — use only existing.

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

**Authentication (no session, no cookies, rate policy `webhook`-like but keyed per source IP: 600/min):** every request carries `x-vv-timestamp` (unix ms) and `x-vv-signature` = hex `HMAC-SHA256(key, timestamp + "." + method + "." + path + "." + sha256hex(rawBody))` where `key = SCAN_CONTROLLER_HMAC_KEY` (secret, ≥ 32 bytes base64). Verify with `timingSafeEqual`; reject `|now − timestamp| > 60 s` (`401 stale`); reject a signature already seen (Redis `internal:nonce:<signature>` SET NX EX 120 → `401 replay`); when `SCAN_CONTROLLER_CIDRS` is set reject other source addresses (`403 forbidden`). Use `config: { rawBody: true, csrf: false }`. Failures → `401 { error: "bad_signature" | "stale" | "replay" }` and `auditFailure` event `WEBHOOK_SIGNATURE_INVALID` (rate-limited to one entry per minute per IP). The audit actor for state changes is `{ id: null, label: "scan-controller" }`.

**Routes (all `POST`, JSON, responses `{ data }`):**
1. `/api/v1/internal/scans/:id/claim` body `{ queueJobId: string, podName?: string }`: in one transaction (row lock) require `status = 'queued'` (else `409 { error: "not_claimable" }`), authorisation present and not expired (`authorisation_doc_key` not null, `authorisation_expires_at` null or in the future, else `422 { error: "authorisation_invalid" }` and set status `held`), then set `status = 'running'`, `started_at = now()`, `progress = 0`; insert `scan_runs` (`attempt` = previous max + 1, `queue_job_id`, `started_at`); audit `SCAN_STARTED`; respond `{ jobId, jobCode, targetHost, scanType, priority, environment, attempt, deadlineSeconds: 900 }`.
2. `…/progress` body `{ progress: int 0..99, etaSeconds: int | null }`: monotonic (ignore lower values), only while `running`; no audit.
3. `…/findings` body `{ findings: { severity, title (≤200), description (≤4000), evidenceRedacted? (≤2000), cvss? (0..10, 1 decimal), cwe? (^CWE-\d+$), remediationGuidance? (≤2000) }[] (max 100 per call) }`: only while `running`; insert with `ON CONFLICT (job_id, md5(title || coalesce(cwe,''))) DO NOTHING`; cap 500 findings per job (`422 { error: "too_many_findings" }`); text fields pass through a server-side redaction (re-apply the credential patterns of the audit redactor — a second line of defence).
4. `…/log-url` body `{ contentType: "text/plain", sizeBytes ≤ 5 MB }` → presigned PUT for `scan-logs/<jobId>/<attempt>.log` via `app.storage`; `{ uploadUrl, objectKey, expiresAt }`.
5. `…/complete` body `{ exitCode: int, lineCount: int, bytesStreamed: int, redactedLogKey?: string }`: only from `running`; set `status = 'completed'`, `progress = 100`, `completed_at`, `eta_seconds = null`, `review_gate_state = 'in_review'`; update the `scan_runs` row (`finished_at`, `exit_code`, `line_count`, `bytes_streamed`, `redacted_log_key`); audit `SCAN_COMPLETE` — message exactly `<JOB-code> against <target> finished in <m> m <ss> s · <n> findings (<c> critical, <h> high, <m> medium)` (omit zero-count severities; `0 findings` when none); notify reviewers (users with `scans:review`, status active) via `app.notify.dispatch` event `job_awaiting_review` (non-critical) and, when any critical finding exists, `critical_finding` with `critical: true` to every `admin`/`super_admin`; respond `{ jobCode, findings: { critical, high, medium, low } }`. The payment lock is NOT applied here (it is enforced at the review gate, Task 35).
6. `…/fail` body `{ reason: string ≤ 300, abortReason: "abort" | "kill" | "deadline" | "error" }`: from `running` (or `queued`); `abort`/`kill` → `status = 'cancelled'`, `cancelled_at`; `deadline`/`error` → `status = 'held'`, `review_gate_state = 'not_eligible'`; update `scan_runs.abort_reason`; audit `SCAN_CANCELLED` or `SCAN_FAILED` (warning); notify the requesting user with a plain in-app notification titled `Scan could not be completed` (use `dispatch` with event `scan_completed` and that title).
All routes: unknown job → `404 { error: "not_found" }`; wrong state → `409 { error: "invalid_state" }`; bodies validated by the contract schemas.

**Tests (assert):** a correctly signed claim succeeds and a second claim is `409`; wrong signature, stale timestamp and replayed signature are `401`; expired authorisation → `422` and the job becomes `held`; findings dedupe and the 500 cap; secrets in a finding's evidence (`Authorization: Bearer abc…`) come back redacted; `complete` moves the job to `completed` + gate `in_review`, appends exactly one `SCAN_COMPLETE` entry with the formatted message, and dispatches reviewer notifications; `fail` with `deadline` → `held`; the conformance suite passes.

---

**Data shape (TypeScript):**
```ts
interface InternalClaimResponse { jobId: string; jobCode: string; targetHost: string; scanType: ScanType; priority: ScanPriority; environment: "production" | "staging" | null; attempt: number; deadlineSeconds: 900 }
interface InternalFinding { severity: "critical" | "high" | "medium" | "low"; title: string; description: string; evidenceRedacted?: string; cvss?: number; cwe?: string; remediationGuidance?: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// All require headers x-vv-timestamp + x-vv-signature (HMAC-SHA256). No cookies.
// POST /api/v1/internal/scans/:id/claim body { queueJobId; podName? } → 200 { data: InternalClaimResponse } | 409 not_claimable | 422 authorisation_invalid
// POST …/progress body { progress; etaSeconds } → 204 · POST …/findings body { findings: InternalFinding[] } → 204 | 422 too_many_findings
// POST …/log-url body { contentType: "text/plain"; sizeBytes } → 200 { data: { uploadUrl; objectKey; expiresAt } }
// POST …/complete body { exitCode; lineCount; bytesStreamed; redactedLogKey? } → 200 { data: { jobCode; findings: {critical;high;medium;low} } }
// POST …/fail body { reason; abortReason: "abort"|"kill"|"deadline"|"error" } → 204
// Errors: 401 { error: "bad_signature"|"stale"|"replay" } · 403 forbidden · 404 not_found · 409 invalid_state
```

---

**Out of scope:**
- Do not give the controller database access.
- Do not release or approve anything from these routes.
- Do not add a session-based path to them.
- Do not write scan-worker code.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40g complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 66 — Billing & Invoices page: subscription, payment method (provider-hosted card fields), invoice history, CSV, PDF

**Layer:** L8

**Prerequisites:** Task 32, Task 45, Task 42, Task 12, Task 11

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Billing & Invoices page: subscription, payment method (provider-hosted card fields), invoice history, CSV, PDF**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/billing`: current subscription card, payment-method card with an Edit dialog that uses Stripe-hosted card fields, a TanStack Table of invoices with status, PDF download and CSV export.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/billing/page.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/billing-hero.tsx`, `subscription-card.tsx`, `payment-method-card.tsx`, `invoice-table.tsx`, `edit-payment-dialog.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/stripe-card-fields.tsx` — Stripe Elements wrapper.
- `apps/web/src/app/(authed)/portal/billing/_hooks/use-billing.ts`
- `apps/web/src/app/(authed)/portal/billing/_styles/billing.css`
- `apps/web/src/lib/stripe.ts` — lazy `loadStripe` singleton.
- `apps/web/src/mocks/handlers/billing.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- MODIFY `apps/web/.env.example` — add the name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=`.
- MODIFY `apps/web/src/env.ts` — add optional `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `apps/web/src/app/(authed)/portal/billing/billing.test.tsx`

**Dependencies allowed:**
- `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- `@tanstack/react-table` is already provided through `@vunvault/ui`.

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

**Reference markup:**

##### Billing page body
```html
<main class="flex-1">
 <section class="pt-10 md:pt-14">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="max-w-3xl space-y-4">
    <span class="vbb-eyebrow">Billing & Account</span>
    <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">Billing & Invoices</h1>
    <p class="text-neutral-500 text-base sm:text-lg leading-relaxed">Manage your subscription, update your payment method and download historical invoices for every VUNVAULT engagement.</p>
   </div>
  </div>
 </section>
 <section class="pt-10 md:pt-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="vbb-grid-2">
    <div class="vbb-plan">
     <div class="vbb-plan-glow" aria-hidden="true"></div>
     <div class="vbb-plan-head">
      <span class="vbb-plan-eyebrow">Current Subscription</span>
      <h2 class="vbb-plan-name">
       Enterprise Client
       <span class="vbb-plan-badge">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Active
       </span>
      </h2>
      <p class="vbb-plan-desc">Full-scope retainer protection with 24/7 attack-surface monitoring, quarterly penetration testing and a dedicated security architect.</p>
     </div>
     <div class="vbb-plan-metrics">
      <div>
       <div class="vbb-metric-label">Renews On</div>
       <div class="vbb-metric-value vbb-metric-value--light">14 Oct 2026</div>
      </div>
      [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Billing Cycle ¦ Monthly || Amount ¦ $2,499]
     </div>
     <div class="vbb-upgrade">
      <div class="vbb-upgrade-text">
       <div class="vbb-upgrade-title">Need more coverage?</div>
       <div class="vbb-upgrade-sub">Add continuous red-team emulation or expand your monitored asset count.</div>
      </div>
      <button type="button" class="vbb-btn vbb-btn--primary vbb-btn--sm">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Upgrade Plan</span>
      </button>
     </div>
    </div>
    <div class="vbb-card">
     <div class="vbb-card-head">
      <div class="vbb-card-title-row">
       <span class="vbb-card-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <div>
        <h2 class="vbb-card-title">Payment Method</h2>
        <p class="vbb-card-sub">Used for all recurring charges and one-off engagements.</p>
       </div>
      </div>
     </div>
     <div class="vbb-pay">
      <div class="vbb-credit-card">
       <div class="vbb-cc-top">
        <span class="vbb-cc-chip" aria-hidden="true"></span>
        <div class="vbb-cc-brand">
         <span class="vbb-cc-brand-name">Mastercard</span>
         <span class="vbb-cc-brand-dots" aria-hidden="true">
          <span></span>
          <span></span>
         </span>
        </div>
       </div>
       <div class="vbb-cc-number" id="vbb-cc-number">5412 •••• •••• 4290</div>
       <div class="vbb-cc-foot">
        <div class="vbb-cc-block">
         <div class="vbb-cc-block-label">Card Holder</div>
         <div class="vbb-cc-block-value" id="vbb-cc-holder">JANE WANJIRU</div>
        </div>
        <div class="vbb-cc-block">
         <div class="vbb-cc-block-label">Expires</div>
         <div class="vbb-cc-block-value" id="vbb-cc-expiry">09 / 2028</div>
        </div>
       </div>
      </div>
      <div class="vbb-pay-actions">
       <button type="button" class="vbb-btn vbb-btn--dark" aria-controls="editPaymentModal">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Edit Payment Method</span>
       </button>
      </div>
      <p class="vbb-pay-note">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Card details are tokenised and stored by our PCI-DSS compliant payment processor.
      </p>
     </div>
    </div>
   </div>
  </div>
 </section>
 <section class="pt-12 md:pt-16 pb-16 md:pb-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="vbb-section-head">
    <div>
     <h2 class="vbb-section-title">Invoice History</h2>
     <p class="vbb-section-sub">Every engagement, subscription charge and Academy purchase. All invoices are available as signed PDFs for your finance and audit records.</p>
    </div>
    <button type="button" class="vbb-btn vbb-btn--ghost" id="vbb-export-all">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Export All (CSV)</span>
    </button>
   </div>
   <div class="vbb-table-wrap">
    <table class="vbb-table">
     <caption class="sr-only">Invoice history for Acme Fintech Ltd</caption>
     <thead>
      <tr>
       <th>Order / Invoice ID</th>
       <th>Date</th>
       <th>Service Description</th>
       <th>Amount</th>
       <th>Status</th>
       <th>Action</th>
      </tr>
     </thead>
     <tbody id="vbb-invoice-body">
      <tr class="vbb-row">
       <td>
        <span class="vbb-inv-id">VV-INV-2026-0841</span>
       </td>
       <td>
        <span class="vbb-inv-date">18 Aug 2026</span>
       </td>
       <td>
        <span class="vbb-inv-service">Full Scope API PenTest</span>
        <span class="vbb-inv-service-detail">Enterprise Retainer · 12 endpoints · retest included</span>
       </td>
       <td>
        <span class="vbb-inv-amount">$2,499.00</span>
       </td>
       <td>
        <span class="vbb-status vbb-status--paid">
         <span class="vbb-status-dot" aria-hidden="true"></span>
         Paid
        </span>
       </td>
       <td class="vbb-cell-actions">
        <button type="button" class="vbb-dl">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
         <span>Download PDF</span>
        </button>
       </td>
      </tr>
      [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: VV-INV-2026-0720 ¦ 18 Jul 2026 ¦ Enterprise Retainer — Monthly ¦ 24/7 attack surface monitoring · quarterly pentest credit ¦ $2,499.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0613 ¦ 18 Jun 2026 ¦ Enterprise Retainer — Monthly ¦ 24/7 attack surface monitoring · quarterly pentest credit ¦ $2,499.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0511 ¦ 12 May 2026 ¦ VUNVAULT Academy — Team Subscription ¦ 12 seats · SOC Analyst & Red Team tracks · annual ¦ $1,440.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0488 ¦ 02 May 2026 ¦ Mobile App PenTest — iOS & Android ¦ M-Pesa gateway integration review · one-off engagement ¦ $899.00 ¦ Paid ¦ Download PDF || VV-INV-2026-0902 ¦ 18 Sep 2026 ¦ Enterprise Retainer — Monthly ¦ 24/7 attack surface monitoring · quarterly pentest credit ¦ $2,499.00 ¦ Pending ¦ Awaiting Payment]
     </tbody>
    </table>
   </div>
   <div class="vbb-table-foot">
    <p class="vbb-table-foot-note">
     Showing the last 6 transactions. Invoices are retained for 7 years for audit purposes. For billing queries contact
     <strong>billing@vunvault.com</strong>
     .
    </p>
    <div class="vbb-pay-actions">
     <a href="/contact" class="vbb-btn vbb-btn--ghost vbb-btn--sm">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Billing Support</span>
     </a>
    </div>
   </div>
  </div>
 </section>
</main>
```
Custom CSS for this markup (reference):
```css
.vbb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vbb-btn svg { transition: transform 0.22s var(--ease); }
.vbb-btn:active { transform: translateY(0) scale(0.98); }
.vbb-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vbb-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vbb-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vbb-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vbb-btn--dark { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 16px 34px -18px var(--brand-glow); }
.vbb-btn--dark:hover { transform: translateY(-2px); filter: brightness(1.07); }
.vbb-btn--sm { padding: 9px 16px; font-size: 0.72rem; }
.vbb-eyebrow { display: inline-block; padding: 6px 14px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.vbb-section-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.vbb-section-title { font-size: clamp(1.4rem, 2.8vw, 1.85rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: var(--ink); }
.vbb-section-sub { margin-top: 6px; max-width: 62ch; font-size: 0.82rem; line-height: 1.7; color: var(--ink-muted); }
.vbb-card { position: relative; padding: 28px 30px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); transition: border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vbb-card:hover { border-color: var(--brand-line); box-shadow: 0 22px 50px -36px rgba(10, 13, 18, 0.45); }
.vbb-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vbb-card-title-row { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
.vbb-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vbb-card-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.35; }
.vbb-card-sub { margin-top: 4px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-muted); }
.vbb-grid-2 { display: grid; grid-template-columns: 1.15fr 1fr; gap: 22px; align-items: stretch; }
.vbb-plan { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 24px; padding: 30px 32px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vbb-plan-glow { position: absolute; top: -45%; right: -8%; width: 46%; height: 190%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.5; pointer-events: none; }
.vbb-plan-head { position: relative; z-index: 1; }
.vbb-plan-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.vbb-plan-name { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: clamp(1.4rem, 3vw, 1.95rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: #ffffff; }
.vbb-plan-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); box-shadow: 0 10px 22px -14px var(--brand-glow); }
.vbb-plan-desc { margin-top: 12px; max-width: 52ch; font-size: 0.82rem; line-height: 1.7; color: #9aa8ba; }
.vbb-plan-metrics { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding-top: 22px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.vbb-metric-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8b9e; white-space: nowrap; }
.vbb-metric-value { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; color: var(--brand); text-shadow: 0 0 22px var(--brand-glow); line-height: 1; }
.vbb-metric-value--light { color: #ffffff; text-shadow: none; }
.vbb-upgrade { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: var(--r-lg); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); }
.vbb-upgrade-text { min-width: 0; }
.vbb-upgrade-title { font-size: 0.82rem; font-weight: 800; color: #ffffff; }
.vbb-upgrade-sub { margin-top: 4px; font-size: 0.72rem; line-height: 1.55; color: #93a2b5; }
.vbb-pay { display: flex; flex-direction: column; gap: 18px; }
.vbb-credit-card { position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; min-height: 200px; padding: 24px 26px; border-radius: var(--r-xl); color: #ffffff; background: radial-gradient(120% 120% at 90% 0%, rgba(59, 153, 252, 0.35), transparent 58%), linear-gradient(150deg, #10151d 0%, #05070a 100%); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 22px 46px -30px rgba(0, 0, 0, 0.65); }
.vbb-credit-card::after { content: ""; position: absolute; right: -40px; bottom: -60px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(closest-side, rgba(59, 153, 252, 0.25), transparent 70%); pointer-events: none; }
.vbb-cc-top { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.vbb-cc-chip { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, #d4a24c, #a97c2e); border: 1px solid rgba(255, 255, 255, 0.25); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15); }
.vbb-cc-chip::before { content: ""; width: 18px; height: 12px; border-radius: 3px; background: repeating-linear-gradient( 90deg, rgba(0, 0, 0, 0.35) 0 2px, transparent 2px 5px ); }
.vbb-cc-brand { display: flex; align-items: center; gap: 10px; }
.vbb-cc-brand-name { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #d6dde8; }
.vbb-cc-brand-dots { display: inline-flex; }
.vbb-cc-brand-dots span { width: 16px; height: 16px; border-radius: 50%; display: block; }
.vbb-cc-brand-dots span:first-child { background: rgba(244, 63, 94, 0.85); }
.vbb-cc-brand-dots span:last-child { background: rgba(245, 158, 11, 0.85); margin-left: -8px; mix-blend-mode: screen; }
.vbb-cc-number { position: relative; z-index: 1; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.05rem; font-weight: 700; letter-spacing: 0.14em; color: #ffffff; white-space: nowrap; }
.vbb-cc-foot { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
.vbb-cc-block { min-width: 0; }
.vbb-cc-block-label { font-size: 9px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #7d8b9e; }
.vbb-cc-block-value { margin-top: 4px; font-size: 0.8rem; font-weight: 700; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vbb-pay-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.vbb-pay-note { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; line-height: 1.55; color: var(--ink-faint); }
.vbb-pay-note svg { color: var(--ok); flex: 0 0 auto; }
.vbb-table-wrap { margin-top: 0; border-radius: var(--r-xl); border: 1px solid var(--line-soft); background: #ffffff; box-shadow: 0 22px 50px -40px rgba(10, 13, 18, 0.45); overflow-x: auto; -webkit-overflow-scrolling: touch; }
.vbb-table { width: 100%; min-width: 820px; border-collapse: collapse; font-size: 0.8rem; }
.vbb-table thead th { padding: 15px 18px; text-align: left; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #b7c4d4; background: linear-gradient(180deg, var(--dark), #070b11); border-bottom: 1px solid rgba(59, 153, 252, 0.24); white-space: nowrap; }
.vbb-table thead th:last-child { text-align: right; }
.vbb-table tbody td { padding: 16px 18px; vertical-align: middle; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.vbb-row { transition: background-color var(--dur) var(--ease); }
.vbb-row:nth-child(even) { background: #fbfcfd; }
.vbb-row:hover { background: var(--brand-tint); }
.vbb-row:last-child td { border-bottom: 0; }
.vbb-inv-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; font-weight: 700; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 7px; padding: 4px 9px; white-space: nowrap; }
.vbb-inv-date { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; color: var(--ink-soft); white-space: nowrap; }
.vbb-inv-service { display: block; font-weight: 700; color: var(--ink); font-size: 0.82rem; line-height: 1.4; }
.vbb-inv-service-detail { display: block; margin-top: 3px; font-size: 0.72rem; color: var(--ink-muted); line-height: 1.5; }
.vbb-inv-amount { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem; font-weight: 800; color: var(--ink); white-space: nowrap; }
.vbb-status { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.vbb-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.vbb-status--paid { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.vbb-status--pending .vbb-status-dot { animation: pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.vbb-dl { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; font-size: 0.72rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); cursor: pointer; white-space: nowrap; transition: background-color 0.22s var(--ease), color 0.22s var(--ease), border-color 0.22s var(--ease), transform 0.22s var(--ease), box-shadow 0.22s var(--ease); }
.vbb-dl:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; transform: translateY(-1px); box-shadow: 0 12px 24px -14px var(--brand-glow); }
.vbb-dl:ac
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Edit Payment Method dialog (the prototype collects raw card fields — see the REQUIRED CHANGE below)
```html
<div id="editPaymentModal" class="vbb-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vbb-payment-title">
 <div class="vbb-modal-backdrop"></div>
 <div class="vbb-modal-card" role="document">
  <div class="vbb-modal-head">
   <div>
    <span class="vbb-eyebrow">Secure card update</span>
    <h2 id="vbb-payment-title" class="vbb-modal-title">Edit Payment Method</h2>
    <p class="vbb-modal-text">Update the card used for your Enterprise retainer and one-off engagements. Changes take effect on your next billing cycle.</p>
   </div>
   <button type="button" class="vbb-modal-close" aria-label="Close dialog">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <form id="vbb-payment-form">
   <div class="vbb-grid-form">
    <div class="vbb-field vbb-col-span-2">
     <label for="pm-holder">Cardholder Name</label>
     <input id="pm-holder" name="holder" class="vbb-input" type="text" value="Jane Wanjiru" autocomplete="cc-name" required/>
    </div>
    <div class="vbb-field vbb-col-span-2">
     <label for="pm-number">Card Number</label>
     <input id="pm-number" name="number" class="vbb-input" type="text" value="5412 3456 7890 4290" inputmode="numeric" autocomplete="cc-number" required/>
    </div>
    <div class="vbb-field">
     <label for="pm-expiry">Expiry (MM / YY)</label>
     <input id="pm-expiry" name="expiry" class="vbb-input" type="text" value="09 / 28" placeholder="MM / YY" inputmode="numeric" autocomplete="cc-exp" required/>
    </div>
    <div class="vbb-field">
     <label for="pm-cvc">CVC</label>
     <input id="pm-cvc" name="cvc" class="vbb-input" type="text" placeholder="•••" inputmode="numeric" autocomplete="cc-csc" maxlength="4" required/>
    </div>
    <div class="vbb-field vbb-col-span-2">
     <label for="pm-country">Billing Country</label>
     <select id="pm-country" name="country" class="vbb-select">
      <option>Kenya</option>
      <option>Nigeria</option>
      <option>Ghana</option>
      <option>South Africa</option>
      <option>Uganda</option>
      <option>Tanzania</option>
      <option>Rwanda</option>
      <option>United Kingdom</option>
      <option>United States</option>
      <option>Other</option>
     </select>
    </div>
   </div>
   <div class="vbb-modal-actions">
    <p class="vbb-modal-note">Your card is tokenised immediately — VUNVAULT never stores raw card numbers.</p>
    <button type="button" class="vbb-btn vbb-btn--ghost">Cancel</button>
    <button type="submit" class="vbb-btn vbb-btn--primary" id="vbb-payment-save">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Save Card</span>
    </button>
   </div>
  </form>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vbb-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.22s var(--ease); }
.vbb-modal[hidden] { display: none !important; }
.vbb-modal.is-open { opacity: 1; }
.vbb-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vbb-modal-card { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(640px, 100%); max-height: 90vh; overflow-y: auto; padding: 30px 32px 32px; border-radius: var(--r-2xl); background: radial-gradient(120% 90% at 100% 0%, rgba(59, 153, 252, 0.08), transparent 55%), #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vbb-modal.is-open .vbb-modal-card { transform: translateY(0) scale(1); }
.vbb-modal-card::-webkit-scrollbar { width: 8px; }
.vbb-modal-card::-webkit-scrollbar-track { background: transparent; }
.vbb-modal-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vbb-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vbb-modal-title { margin-top: 12px; font-size: clamp(1.2rem, 2.6vw, 1.55rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; color: var(--ink); }
.vbb-modal-text { margin-top: 8px; max-width: 52ch; font-size: 0.8rem; line-height: 1.7; color: var(--ink-muted); }
.vbb-modal-close { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); cursor: pointer; transition: color 0.22s var(--ease), border-color 0.22s var(--ease), background-color 0.22s var(--ease), transform 0.22s var(--ease); }
.vbb-modal-close:hover { color: var(--critical); border-color: rgba(244, 63, 94, 0.35); background: rgba(244, 63, 94, 0.08); transform: rotate(90deg); }
.vbb-modal-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.vbb-modal-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.vbb-modal-note { margin-right: auto; font-size: 0.7rem; line-height: 1.5; color: var(--ink-faint); max-width: 32ch; }
.vbb-grid-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.vbb-col-span-2 { grid-column: span 2; }
.vbb-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vbb-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vbb-input,
    .vbb-select { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vbb-input::placeholder { color: var(--ink-faint); }
.vbb-input:focus,
    .vbb-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vbb-input.is-invalid,
    .vbb-select.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vbb-select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 38px; cursor: pointer; }
@media (max-width: 768px) {
.vbb-modal-card { padding: 24px 20px 26px; }
.vbb-modal-actions { flex-direction: column-reverse; align-items: stretch; }
.vbb-modal-actions .vbb-btn { width: 100%; }
.vbb-modal-note { max-width: none; text-align: center; margin-right: 0; }
}
@media (max-width: 640px) {
.vbb-grid-form { grid-template-columns: 1fr; }
.vbb-col-span-2 { grid-column: a
```

**REQUIRED CHANGE — no raw card data touches VUNVAULT:** the prototype dialog has plain inputs for card number, expiry and CVC. Replace those three fields with Stripe Elements (`CardNumberElement`, `CardExpiryElement`, `CardCvcElement` from `@stripe/react-stripe-js`) styled to look like `.vbb-input` (pass `style`/`classes` using token colours read from `tokens` in `@vunvault/ui`). Keep `Cardholder Name` and `Billing Country` as normal fields (country options verbatim: Kenya, Nigeria, Ghana, South Africa, Uganda, Tanzania, Rwanda, United Kingdom, United States, Other → ISO codes KE NG GH ZA UG TZ RW GB US XX). The dialog note stays verbatim: `Your card is tokenised immediately — VUNVAULT never stores raw card numbers.` Submit (`Save Card`): `stripe.createPaymentMethod({ type: "card", card: cardNumberElement, billing_details: { name, address: { country } } })` → `PUT /api/v1/billing/payment-method { provider: "stripe", providerPaymentMethodToken: pm.id, cardholderName, billingCountry }`. Errors from Stripe are shown inline under the fields (Stripe's `error.message`); the prototype's `Please complete all card fields` becomes the inline message when the Element reports `complete: false`. Success toast verbatim: `Payment method updated` (+ message `Changes take effect on your next billing cycle.`). If `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing the dialog shows `Card updates are temporarily unavailable.` (planner copy) and disables Save. **v1 scope note:** payment-method storage supports Stripe cards only; Paystack (M-Pesa, African cards, bank) is used per invoice at checkout (Task 66b), not as a stored method.

**Data:** `useSubscription()` (`GET /billing/subscription`, 404 → show the card state `No active subscription` with a link `Browse plans` → `/services#pricing`), `usePaymentMethod()` (`GET /billing/payment-method`; 404 → `No payment method on file` + `Add Payment Method` button opening the same dialog), `useInvoices({ page, pageSize: 10 })`. Subscription card: `Renews On` formatted `14 Oct 2026` (`formatLongDate`-style `DD Mon YYYY`), `Billing Cycle` `Monthly`/`Annual`, `Amount` via `formatUsdWhole` (e.g. `$2,499`). The `Upgrade Plan` button → toast `{ kind: "ok", title: "Upgrade requested", message: "Upgrade options will be emailed to you shortly" }` (message verbatim from the prototype; there is no upgrade endpoint — add `// TODO(backend-contract)`; do not call the API). Card number display: `<first digit group> •••• •••• <last4>` is not derivable (we only store last4) → render `•••• •••• •••• <last4>`; brand name from the API; expiry `MM / YYYY`; holder uppercase.
**Invoice table (TanStack Table via `DataTable`, Task 12):** columns `Order / Invoice ID`, `Date`, `Service Description` (title + detail line), `Amount` (`formatUsd`), `Status`, `Action`. Status chips: `paid` → `Paid` (`vbb-status--paid`), `pending` → `Awaiting Payment` (`vbb-status--pending`), `overdue` → `Overdue`, `void` → `Void`. Action: `Download PDF` for every invoice (`GET /billing/invoices/:id/pdf`; on `202 generating` show toast `Preparing your invoice…` (planner) and retry after 3 s up to 5 times; use a hidden `<a download>` with the blob URL, revoke it after) and, for `pending`/`overdue`, an extra `Pay Now` button that opens the Pay dialog of Task 66b (this task only dispatches `usePayDialog().open(invoice)`; create the tiny store in `apps/web/src/lib/pay-dialog-store.ts`). Query `?invoice=<id>` opens the Pay dialog for that invoice automatically (used by the Products purchase hand-off). `Export All (CSV)` → `GET /billing/invoices.csv` as a download named `vunvault-invoices.csv`; when the table is empty toast `{ kind: "warn", title: "No invoices to export", message: "There are no invoices on this account yet." }`; success toast title `Invoice history exported as CSV`. Empty table: `EmptyState` `No invoices yet` / `Invoices appear here after your first engagement or purchase.` (planner). Caption `Invoice history for <company name>`.

**Tests:** subscription card values and `$2,499`; payment card shows `•••• •••• •••• 4290`; table renders six invoices with the right chips and `$` formatting; `Download PDF` calls the endpoint; CSV export triggers a download; dialog: Stripe Elements are mocked (`vi.mock("@stripe/react-stripe-js")`), save calls `createPaymentMethod` then the PUT with the token and NEVER with a card number (assert the request body has no `number`/`cvc` keys).

---

**Data shape (TypeScript):**
```ts
// Subscription, PaymentMethodView, Invoice: see contracts (Task 20/32).
interface PayDialogState { invoice: Invoice | null; open(i: Invoice): void; close(): void }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/billing/subscription → 200 { data: Subscription } | 404 | 403 no_org
// GET  /api/v1/billing/payment-method → 200 { data: PaymentMethodView } | 404
// PUT  /api/v1/billing/payment-method body { provider: "stripe"; providerPaymentMethodToken: string; cardholderName: string; billingCountry: string(2) } → 200 { data: PaymentMethodView } | 422 payment_method_rejected
// GET  /api/v1/billing/invoices?page=&pageSize= → 200 { data: Invoice[]; total }
// GET  /api/v1/billing/invoices/:id/pdf → 200 application/pdf | 202 { data: { status: "generating" } } | 404
// GET  /api/v1/billing/invoices.csv → 200 text/csv
```

---

**Out of scope:**
- Do not collect or transmit raw card numbers, expiry or CVC.
- Do not build the Pay dialog (Task 66b).
- Do not implement Paystack stored methods.
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
☐ Report at the end: `Task 66 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 66b — Pay invoice dialog: currency selection with locked FX quote, provider/channel choice, USD checkout

**Layer:** L8

**Prerequisites:** Task 33, Task 34, Task 66

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Pay invoice dialog: currency selection with locked FX quote, provider/channel choice, USD checkout**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Pay Now dialog that quotes a display currency, shows the locked local amount with a countdown, lets the client choose card (Stripe) or Paystack (M-Pesa / bank / African card), and charges the invoice in USD.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/billing/_components/pay-invoice-dialog.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/fx-quote-panel.tsx`
- `apps/web/src/app/(authed)/portal/billing/_components/payment-channel-picker.tsx`
- `apps/web/src/app/(authed)/portal/billing/_hooks/use-checkout.ts` — `useFxQuote`, `useCheckout`, `usePaymentAttempt`.
- `apps/web/src/app/(authed)/portal/billing/_styles/pay-dialog.css`
- MODIFY `apps/web/src/app/(authed)/portal/billing/page.tsx` — mount the dialog.
- MODIFY `apps/web/src/mocks/handlers/billing.ts` — add handlers.
- `apps/web/src/app/(authed)/portal/billing/pay-dialog.test.tsx`

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

**This dialog has no prototype; all copy below is planner-authored. Use the `Dialog` primitive (Task 11) and the styling language of the billing page (`vbb-modal`, `vbb-btn`, `vbb-input`, `vbb-status` — reuse the CSS already in `billing.css`).**

**Layout:** header eyebrow `Secure payment`, title `Pay invoice <number>`, text `Charged in US dollars (USD). Local currency is shown for reference only.` Body (top→bottom): (1) invoice summary row (service title, `Amount due` in USD via `formatUsd(outstandingUsdCents)`); (2) `Display currency` select: `USD — US Dollar`, `KES — Kenyan Shilling`, `NGN — Nigerian Naira`, `GHS — Ghanaian Cedi`, `ZAR — South African Rand` (default from the profile country: KE→KES, NG→NGN, GH→GHS, ZA→ZAR, else USD); (3) the **FX quote panel** (only when currency ≠ USD): shows `≈ <formatLocalDisplay(localMinor, currency)>`, the line `Rate locked: 1 USD = <rate> <CCY>` and a countdown `Quote valid for mm:ss`; at expiry it turns into `Quote expired` with a `Refresh quote` button; below it, always: `You will be charged <formatUsd> in USD. The local amount is an estimate based on the locked rate; your bank may apply its own conversion.`; (4) **channel picker** (radio cards, real radios): `Card` / `Visa, Mastercard — processed by Stripe`; `M-Pesa` / `Pay from your phone — processed by Paystack`; `Bank transfer` / `Pay by transfer — processed by Paystack`; (5) channel-specific area: Card → Stripe Elements (as in Task 66) or the saved default card choice (`Use saved Mastercard •••• 4290` radio); M-Pesa → phone number field (`Phone number`, placeholder `+254 7XX XXX XXX`, validated E.164) used only for the Paystack prompt; Bank transfer → no extra field; (6) footer: `Cancel`, primary `Pay <formatUsd>` (spinner while pending, disabled when a quote is required but expired).

**Flow:** `POST /billing/fx-quotes { invoiceId, displayCurrency }` on open and whenever the currency changes (skip for USD); `POST /billing/checkout { invoiceId, fxQuoteId?, provider, channel, providerPaymentMethodToken?, idempotencyKey }` where `idempotencyKey = crypto.randomUUID()` generated ONCE per dialog open (reuse it on retry so a double-click cannot double-charge). Provider/channel mapping: Card → `stripe`/`card`; M-Pesa → `paystack`/`mpesa`; Bank transfer → `paystack`/`bank_transfer`. Result handling: `status: "succeeded"` or `requires_action` with Stripe `clientSecret` → `stripe.confirmCardPayment(clientSecret)` then poll; `redirectUrl` (Paystack) → `window.location.assign(redirectUrl)` (the return URL is `/portal/billing?invoice=<id>&paid=1`); M-Pesa shows a waiting state `Check your phone and enter your M-Pesa PIN to approve the payment.` with a spinner. **Never trust the synchronous result for ledger state:** after any success path poll `GET /billing/invoices?page=1&pageSize=10` every 3 s for up to 60 s until the invoice is `paid`, then show the success state: title `Payment received`, text `Invoice <number> is paid. A receipt has been emailed to you.`, button `Done`; timeout → `We're confirming your payment. This can take a minute — you'll receive an email when it completes.` and close. Errors: `409 quote_expired` → refresh the quote and show `Your quote expired. We refreshed it — please review and pay again.`; `409 amount_changed` → same with `The amount due changed. Please review the new amount.`; `409 already_paid` → close + invalidate invoices; `422 channel_unavailable` → inline `This payment method is not available for this invoice right now. Choose another method.`; Stripe card errors → Stripe's message; network failure → toast `{ kind: "crit", title: "Payment not completed", message: "You have not been charged. Please try again." }` (only if no attempt id was returned).

**Hard rules:** the amount sent to any provider is always the server-derived USD amount; the UI never sends an amount. Local currency is display-only. No cryptocurrency. After success invalidate `queryKeys.billing.invoices(...)` and `queryKeys.billing.subscription()`.

**Tests (mock providers):** switching to KES requests a quote and shows the locked amount and the USD charge sentence; countdown reaching zero disables Pay and shows `Quote expired`; Card path calls checkout with `provider: "stripe", channel: "card"`; M-Pesa requires a valid phone and sends `paystack`/`mpesa`; the idempotency key is identical across two submit attempts in one dialog session; success polling flips to `Payment received`; 409 `quote_expired` refreshes the quote; the checkout request body contains NO amount field.

---

**Data shape (TypeScript):**
```ts
interface FxQuote { id: string; invoiceId: string; displayCurrency: "USD"|"KES"|"NGN"|"GHS"|"ZAR"; rateLocalPerUsd: string; usdCents: number; localMinor: number; lockedAt: string; expiresAt: string; settlementCurrency: "USD" }
interface CheckoutBody { invoiceId: string; fxQuoteId?: string; provider: "stripe" | "paystack"; channel: "card" | "mpesa" | "bank_transfer"; providerPaymentMethodToken?: string; idempotencyKey: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/billing/fx-quotes body { invoiceId; displayCurrency } → 201 { data: FxQuote } | 409 already_paid | 422 unsupported_currency | 502 fx_unavailable
// POST /api/v1/billing/checkout body CheckoutBody → 201|200 { data: { paymentAttemptId; status: "created"|"requires_action"|"succeeded"|"failed"; usdCents; settlementCurrency: "USD"; clientSecret?; redirectUrl? } } | 409 { error: "quote_expired"|"amount_changed"|"already_paid" } | 422 channel_unavailable
```

---

**Out of scope:**
- Do not charge or display any non-USD charge amount.
- Do not compute amounts client-side.
- Do not store card data.
- Do not build webhook handling (server side).

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
☐ Report at the end: `Task 66b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 67 — Password Manager & Security page: password change, TOTP, security key, recovery codes

**Layer:** L8

**Prerequisites:** Task 27, Task 45, Task 42, Task 10

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Password Manager & Security page: password change, TOTP, security key, recovery codes**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/security` on the real credentials API: change password with live rules and strength, authenticator-app enrolment with QR, WebAuthn key registration, and one-time recovery codes.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/security/page.tsx`
- `apps/web/src/app/(authed)/portal/security/_components/security-hero.tsx`, `change-password-card.tsx`, `two-factor-card.tsx`, `totp-panel.tsx`, `security-key-panel.tsx`, `recovery-keys-card.tsx`, `regenerate-dialog.tsx`
- `apps/web/src/app/(authed)/portal/security/_hooks/use-security.ts`
- `apps/web/src/app/(authed)/portal/security/_lib/webauthn-register.ts`
- `apps/web/src/app/(authed)/portal/security/_styles/security.css`
- `apps/web/src/components/password-strength.tsx` — MOVE target: create the shared component here only if Task 61 placed it elsewhere; otherwise import it.
- `apps/web/src/mocks/handlers/security.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/security/security.test.tsx`

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

**Reference markup:**

##### Password Manager page body (security cards are compressed; the bracketed notes list every string)
```html
<main class="flex-1">
 <section class="pt-10 md:pt-14">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="max-w-3xl space-y-4">
    <span class="vpm-eyebrow">Security & Account Protection</span>
    <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">Password Manager & Security</h1>
    <p class="text-neutral-500 text-base sm:text-lg leading-relaxed">Rotate your credentials, harden your account with two-factor authentication and generate offline recovery keys you can trust when everything else fails.</p>
   </div>
  </div>
 </section>
 <section class="pt-10 md:pt-12 pb-16 md:pb-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="vpm-stack">
    <div class="vpm-card">
     <div class="vpm-card-head">
      <span class="vpm-card-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div>
       <h2 class="vpm-card-title">Change Password</h2>
       <p class="vpm-card-sub">Choose a strong, unique passphrase. VUNVAULT stores only a salted hash — we can never read your password.</p>
      </div>
     </div>
     <form id="vpm-password-form">
      <div class="vpm-field">
       <label for="pw-current">Current Password</label>
       <div class="vpm-pw-wrap">
        <input id="pw-current" name="currentPassword" class="vpm-input" type="password" placeholder="Enter your current password" autocomplete="current-password" required/>
        <button type="button" class="vpm-pw-toggle" aria-label="Show current password">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </div>
      [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: New Password ¦ Awaiting input ¦ Use 12+ characters with mixed cases, numbers and symbols. ¦ At least 12 characters ¦ One uppercase letter ¦ One lowercase letter ¦ One number ¦ One symbol (!@#$…) || Confirm New Password ¦ Both entries must match exactly.]
      <div class="vpm-modal-actions">
       <button type="button" class="vpm-btn vpm-btn--ghost" id="vpm-pw-reset">Clear Fields</button>
       <button type="submit" class="vpm-btn vpm-btn--primary" id="vpm-pw-submit">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Update Password</span>
       </button>
      </div>
     </form>
    </div>
    [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Two-Factor Authentication ¦ Add a second proof of identity. We recommend enabling at least one method — an authenticator app or a hardware token. ¦ Authenticator App (TOTP) ¦ Not enabled ¦ Use Google Authenticator, Authy, 1Password or any TOTP-compatible app. Generates a fresh 6-digit code every 30 seconds. ¦ Off ¦ 1 ¦ Open your authenticator app and choose ¦ “Add account” ¦ → ¦ “Scan QR code” ¦ . ¦ 2 ¦ Point your camera at the QR code on the left. Can’t scan? Enter the setup key manually below. ¦ 3 ¦ Enter the ¦ 6-digit code ¦ your app generates to confirm setup. ¦ JBSWY3DPEHPK3PXP ¦ Copy ¦ Verification Code ¦ Verify & Enable ¦ Cancel ¦ Hardware Security Key (FIDO2 / WebAuthn) ¦ No keys registered ¦ YubiKey, Google Titan, Feitian and any FIDO2-certified key. Phishing-resistant — the strongest factor available today. ¦ Register Key || Recovery Keys ¦ Single-use backup codes for when you lose your phone, token or network access. Print them and store them offline. ¦ No recovery keys generated yet ¦ Generate a set of 10 single-use emergency codes. Each code can be used exactly once to regain access to your account. ¦ Generate Recovery Keys ¦ Emergency Backup Codes ¦ Generated just now · 10 of 10 unused ¦ These codes are shown once. Print them, store them in a safe, and never share them — anyone with a code can bypass your two-factor authentication. ¦ Hide Codes ¦ Print Codes ¦ Regenerate]
   </div>
  </div>
 </section>
</main>
```
Custom CSS for this markup (reference):
```css
.vpm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vpm-btn svg { transition: transform 0.22s var(--ease); }
.vpm-btn:active { transform: translateY(0) scale(0.98); }
.vpm-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vpm-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vpm-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vpm-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vpm-btn[disabled] { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; }
.vpm-eyebrow { display: inline-block; padding: 6px 14px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.vpm-card { position: relative; padding: 28px 30px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); transition: border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vpm-card:hover { border-color: var(--brand-line); box-shadow: 0 22px 50px -36px rgba(10, 13, 18, 0.45); }
.vpm-card-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vpm-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vpm-card-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.35; }
.vpm-card-sub { margin-top: 4px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-muted); }
.vpm-stack { display: flex; flex-direction: column; gap: 22px; max-width: 900px; margin-inline: auto; }
.vpm-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vpm-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vpm-input { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vpm-input::placeholder { color: var(--ink-faint); }
.vpm-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vpm-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vpm-pw-wrap { position: relative; display: flex; align-items: center; }
.vpm-pw-wrap .vpm-input { padding-right: 46px; }
.vpm-pw-toggle { position: absolute; right: 6px; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; color: var(--ink-faint); background: transparent; border: 0; cursor: pointer; transition: color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vpm-pw-toggle:hover { color: var(--brand-strong); background: var(--brand-tint); }
.vpm-pw-toggle:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.vpm-verify .vpm-field { flex: 1 1 200px; }
.vpm-verify .vpm-input { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1rem; font-weight: 700; letter-spacing: 0.32em; text-align: center; text-indent: 0.32em; }
.vpm-modal-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
@media (max-width: 768px) {
.vpm-card { padding: 22px 20px; }
.vpm-card-head { gap: 12px; }
.vpm-modal-actions { flex-direction: column-reverse; align-items: stretch; }
.vpm-modal-actions .vpm-btn { width: 100%; }
.vpm-verify .vpm-btn { width: 100%; }
}
@media (max-width: 640px) {
.vpm-keys-actions .vpm-btn { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) {
.vpm-modal,
      .vpm-modal-card,
      .vpm-toast,
      .vpm-btn,
      .vpm-switch-track,
      .vpm-switch-track::after,
      .vpm-strength-bar { transition-duration: 0.001ms !important; }
}
```

##### Regenerate recovery keys confirmation dialog
```html
<div id="regenerateKeysModal" class="vpm-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vpm-regen-title">
 <div class="vpm-modal-backdrop"></div>
 <div class="vpm-modal-card" role="document">
  <div class="vpm-modal-head">
   <div>
    <span class="vpm-eyebrow">Irreversible action</span>
    <h2 id="vpm-regen-title" class="vpm-modal-title">Regenerate Recovery Keys?</h2>
    <p class="vpm-modal-text">Your existing 10 recovery codes will be permanently invalidated the moment new ones are created. Any printed copies you hold will stop working.</p>
   </div>
   <button type="button" class="vpm-modal-close" aria-label="Close dialog">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="vpm-modal-actions">
   <p class="vpm-modal-note">Confirm only if you have lost your codes or suspect they may have leaked.</p>
   <button type="button" class="vpm-btn vpm-btn--ghost">Keep Existing Codes</button>
   <button type="button" class="vpm-btn vpm-btn--danger" id="vpm-regen-confirm">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Yes, Regenerate</span>
   </button>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vpm-btn--danger { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.vpm-btn--danger:hover { color: #ffffff; background: linear-gradient(135deg, var(--critical), #be123c); border-color: transparent; transform: translateY(-1px); box-shadow: 0 14px 30px -16px rgba(244, 63, 94, 0.7); }
.vpm-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.22s var(--ease); }
.vpm-modal[hidden] { display: none !important; }
.vpm-modal.is-open { opacity: 1; }
.vpm-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vpm-modal-card { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(620px, 100%); max-height: 90vh; overflow-y: auto; padding: 30px 32px 32px; border-radius: var(--r-2xl); background: radial-gradient(120% 90% at 100% 0%, rgba(59, 153, 252, 0.08), transparent 55%), #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vpm-modal.is-open .vpm-modal-card { transform: translateY(0) scale(1); }
.vpm-modal-card::-webkit-scrollbar { width: 8px; }
.vpm-modal-card::-webkit-scrollbar-track { background: transparent; }
.vpm-modal-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vpm-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px;
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `Awaiting input`
- `Use 12+ characters with mixed cases, numbers and symbols.`
- `Too easy to guess — add length and variety.`
- `Add uppercase letters, numbers and symbols.`
- `Almost there — a few more characters would help.`
- `Excellent. This password resists brute-force well.`
- `Both entries must match exactly.`
- `✓ Passwords match.`
- `Passwords do not match yet.`
- `Enter your current password`
- `New password does not meet the requirements`
- `Choose a stronger password`
- `Passwords do not match`
- `New password must differ from current`
- `Password updated successfully`
- `Authenticator app disabled`
- `Enter the 6-digit code`
- `Authenticator app enabled`
- `Hardware key removed`
- `Hardware security key registered`
- `Copy recovery code`
- `Recovery code copied`
- `Generated just now · 10 of 10 unused`
- `10 recovery keys generated`
- `Preparing printable sheet…`
- `Regenerated just now · 10 of 10 unused`
- `New recovery keys generated`
- `Copied to clipboard`
**Change password (RHF + Zod `ChangePasswordBody`):** live rule checklist (`PASSWORD_RULES` from contracts: `At least 12 characters`, `One uppercase letter`, `One lowercase letter`, `One number`, `One symbol (!@#$…)` — each row gets `is-met` when satisfied, with a visually hidden `met`/`not met` text), strength meter + label from `scorePassword` (`Awaiting input`, `Weak`, `Fair`, `Good`, `Strong`) with the hint strings from the script list above mapped by score (0 `Use 12+ characters with mixed cases, numbers and symbols.`, 1 `Too easy to guess — add length and variety.`, 2 `Add uppercase letters, numbers and symbols.`, 3 `Almost there — a few more characters would help.`, 4 `Excellent. This password resists brute-force well.`), match text `✓ Passwords match.` / `Passwords do not match yet.`; field errors `Enter your current password`, `New password does not meet the requirements`, `Passwords do not match`, `New password must differ from current`. Show/hide buttons on all three fields. Submit → `POST /account/password`; `401 invalid_credentials` → field error on current password `Current password is incorrect.`; `422 breached_password` → `This password has appeared in a data breach. Choose a different one.`; success → toast `Password updated successfully` + `All other sessions were signed out.` and reset the form. Staff roles show the helper `Staff accounts require at least 14 characters.` and enforce 14 client-side. `Clear Fields` resets the form. Keep the card subtitle exactly as in the markup (it says VUNVAULT stores only a salted hash; Supabase Auth stores a salted one-way hash).
**Two-factor card:** `GET /account/security` supplies `MfaStatus` + posture. **Authenticator app:** status chip `Not enabled`/`Enabled` (+ `Off`/`On` toggle); enabling calls `POST /account/mfa/totp/enroll`, shows the numbered steps from the markup with the QR rendered as an `<img src="data:image/svg+xml;utf8,…">` (never `innerHTML`) and the setup key (`secret`, grouped by 4, `Copy` → toast `Copied to clipboard`), a `Verification Code` input and `Verify & Enable` → `POST /account/mfa/totp/verify` (errors: `Enter the 6-digit code`, `Incorrect code.`); success toast `Authenticator app enabled`; disabling → `DELETE /account/mfa/totp` with a confirm dialog (`Disable authenticator app?` / `You will rely on your other methods to sign in.`), toast `Authenticator app disabled`; `422 last_factor` → `You cannot remove your only second factor.`. **Hardware key:** `Register Key` → `POST …/webauthn/register/options` → `navigator.credentials.create` → `POST …/register/verify { deviceName, credential }`; list registered keys (device name, added date) each with `Remove` (`DELETE …/webauthn/:id`); toasts `Hardware security key registered` / `Hardware key removed`; user cancel → `Security key registration was cancelled.`.
**Recovery keys:** state `No recovery keys generated yet`; `Generate Recovery Keys` → `POST /account/recovery-codes` shows the ten codes ONCE in the panel (`XXXX-XXXX-XXXX`, per-code `Copy recovery code <n>` buttons with toast `Recovery code copied`, `Hide Codes`, `Print Codes` (opens `window.print()` on a print-only stylesheet listing the codes; toast `Preparing printable sheet…`), `Regenerate` opens the confirm dialog from the markup then `POST /account/recovery-codes/regenerate`, toast `New recovery keys generated`); once hidden/reloaded the codes are NOT retrievable — show `Generated <relative time> · <remaining> of 10 unused` from `RecoveryCodesStatus`. Codes live only in component state while visible; clear on unmount/Hide.

**Tests:** rule checklist and strength transitions; mismatch and same-as-current errors; 401 and 422 mapping; TOTP enrol shows an `<img>` QR and verifies; disabling last factor error; WebAuthn register calls both endpoints (mock `navigator.credentials`); recovery codes: ten codes displayed once, `Print Codes` calls `window.print`, remaining count text after reload comes from the API.

---

**Data shape (TypeScript):**
```ts
// MfaStatus, SecurityPosture, ChangePasswordBody, RecoveryCodesResponse: see contracts (Tasks 20d, 27).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/account/password body { currentPassword; newPassword; confirmPassword } → 204 | 401 | 422 breached_password
// GET  /api/v1/account/security → 200 { data: MfaStatus & { posture: SecurityPosture } }
// POST /api/v1/account/mfa/totp/enroll → 201 { data: { factorId; qrCodeSvg; secret; uri } } · POST …/totp/verify { factorId; code } → 204 | 401 mfa_failed · DELETE …/totp → 204 | 422 last_factor
// POST /api/v1/account/mfa/webauthn/register/options → 200 · POST …/register/verify { deviceName?; credential } → 201 { data: WebauthnKey } · DELETE …/webauthn/:id → 204
// POST /api/v1/account/recovery-codes → 201 { data: { codes: string[10]; batchId; generatedAt } } | 409 already_generated · POST …/regenerate → 201
```

---

**Out of scope:**
- Do not store or log recovery codes or the TOTP secret outside component state.
- Do not use `innerHTML`.
- Do not build the admin security tab (Task 83).

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
☐ Report at the end: `Task 67 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 68 — Client profile page

**Layer:** L8

**Prerequisites:** Task 30, Task 45, Task 42, Task 10

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client profile page**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/profile`: identity header with account stats and an editable personal/company details form saved through the profile API.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/profile/page.tsx`
- `apps/web/src/app/(authed)/portal/profile/_components/profile-hero.tsx`, `profile-form.tsx`, `account-stats.tsx`
- `apps/web/src/app/(authed)/portal/profile/_hooks/use-client-profile.ts`
- `apps/web/src/app/(authed)/portal/profile/_styles/profile.css`
- `apps/web/src/mocks/handlers/profile.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/profile/profile.test.tsx`

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

**Reference markup:**

##### Client profile page body
```html
<main class="flex-1">
 <section class="pt-10 pb-16 md:pt-14 md:pb-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
   <div class="vvp-identity">
    <div class="vvp-identity-glow" aria-hidden="true"></div>
    <div class="vvp-avatar" aria-hidden="true">JW</div>
    <div class="vvp-identity-body">
     <h1 class="vvp-identity-name">Jane Wanjiru</h1>
     <p class="vvp-identity-company">Acme Fintech Ltd · Head of Information Security</p>
     <div class="vvp-chip-row">
      <span class="vvp-chip vvp-chip--mono">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       CLIENT ID VV-CL-48210
      </span>
      [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: Enterprise Client || Subscription Active]
     </div>
    </div>
    <div class="vvp-identity-stats" aria-label="Account summary">
     <div>
      <div class="vvp-stat-label">Engagements</div>
      <div class="vvp-stat-value">07</div>
     </div>
     <div>
      <div class="vvp-stat-label">Open Findings</div>
      <div class="vvp-stat-value">12</div>
     </div>
     <div>
      <div class="vvp-stat-label">Next Assessment</div>
      <div class="vvp-stat-value">14d</div>
     </div>
    </div>
   </div>
   <div class="vvp-tiles">
    <a href="/portal/academy" class="vvp-tile">
     <span class="vvp-tile-icon">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="vvp-tile-title">Academy Progress</span>
     <span class="vvp-tile-text">Track your learning tracks and certificates.</span>
    </a>
    [+3 more sibling <a> elements with the SAME structure as the one above; their text content in order: Free Vulnerability Scanner ¦ Run a live reconnaissance sweep on your perimeter. || Billing & Invoices ¦ Review statements, plans and payment history. || Password Manager ¦ Audit credentials and vault hygiene.]
   </div>
   <form id="vvp-profile-form">
    <div class="vvp-card">
     <div class="vvp-card-head">
      <span class="vvp-card-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div>
       <h2 class="vvp-card-title">Personal Details</h2>
       <p class="vvp-card-sub">Used for engagement correspondence, report delivery and emergency contact.</p>
      </div>
     </div>
     <div class="vvp-grid">
      <div class="vvp-field">
       <label for="pf-fullname">Full Name</label>
       <input id="pf-fullname" name="fullName" class="vvp-input" type="text" value="Jane Wanjiru" autocomplete="name"/>
      </div>
      [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Role / Title || Work Email || Phone Number]
     </div>
     <div class="vvp-actions">
      <p class="vvp-actions-meta" id="vvp-personal-meta">Saves your name, role and contact details, then refreshes your profile header.</p>
      <div class="vvp-actions-buttons">
       <button type="button" class="vvp-btn vvp-btn--primary" id="vvp-save-personal-btn">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Save Personal Details</span>
       </button>
      </div>
     </div>
    </div>
    !-- ---------------- company details ---------------- -->
    <div class="vvp-card">
     <div class="vvp-card-head">
      <span class="vvp-card-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div>
       <h2 class="vvp-card-title">Company Details</h2>
       <p class="vvp-card-sub">Defines the authorised scope boundary for all VUNVAULT testing activity.</p>
      </div>
     </div>
     <div class="vvp-grid">
      <div class="vvp-field">
       <label for="pf-company">Organization / Company Name</label>
       <input id="pf-company" name="company" class="vvp-input" type="text" value="Acme Fintech Ltd" autocomplete="organization"/>
      </div>
      <div class="vvp-field">
       <label for="pf-domain">Primary Target Domain / URL</label>
       <input id="pf-domain" name="domain" class="vvp-input" type="text" value="https://app.acmefintech.co.ke" autocomplete="off"/>
       <span class="vvp-hint">Only assets you own or are authorised to test.</span>
      </div>
      <div class="vvp-field vvp-col-span-2">
       <label for="pf-industry">Industry</label>
       <select id="pf-industry" name="industry" class="vvp-select">
        <option>Financial Services / Fintech</option>
        <option>SACCO / Microfinance</option>
        <option>Banking</option>
        <option>Insurance</option>
        <option>Healthcare</option>
        <option>Telecommunications</option>
        <option>Government / Public Sector</option>
        <option>Education</option>
        <option>Retail & E-Commerce</option>
        <option>Technology / SaaS</option>
        <option>Other</option>
       </select>
      </div>
     </div>
     <div class="vvp-actions">
      <p class="vvp-actions-meta">
       Last updated
       <span id="vvp-last-updated">18 Aug 2026, 09:14 UTC</span>
      </p>
      <div class="vvp-actions-buttons">
       <button type="reset" class="vvp-btn vvp-btn--ghost" id="vvp-reset-btn">Discard Changes</button>
       <button type="submit" class="vvp-btn vvp-btn--primary" id="vvp-save-btn">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Save Profile Settings</span>
       </button>
      </div>
     </div>
    </div>
   </form>
  </div>
 </section>
</main>
```
Custom CSS for this markup (reference):
```css
.vvp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vvp-btn svg { transition: transform 0.22s var(--ease); }
.vvp-btn:hover svg { transform: translateX(3px); }
.vvp-btn:active { transform: translateY(0) scale(0.98); }
.vvp-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vvp-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vvp-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vvp-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vvp-btn[disabled] { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; }
.vvp-card { position: relative; padding: 28px 30px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); transition: border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vvp-card:hover { border-color: var(--brand-line); box-shadow: 0 22px 50px -36px rgba(10, 13, 18, 0.45); }
.vvp-card-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vvp-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vvp-card-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.35; }
.vvp-card-sub { margin-top: 4px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-muted); }
.vvp-identity { position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; gap: 26px; padding: 30px 32px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vvp-identity-glow { position: absolute; top: -45%; right: -8%; width: 46%; height: 190%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.5; pointer-events: none; }
.vvp-avatar { position: relative; z-index: 1; flex: 0 0 auto; display: grid; place-items: center; width: 88px; height: 88px; border-radius: 50%; font-size: 1.85rem; font-weight: 800; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 0 0 6px rgba(59, 153, 252, 0.12), 0 22px 44px -22px var(--brand-glow); }
.vvp-identity-body { position: relative; z-index: 1; flex: 1 1 320px; min-width: 0; }
.vvp-identity-name { font-size: clamp(1.35rem, 3vw, 1.85rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: #ffffff; }
.vvp-identity-company { margin-top: 6px; font-size: 0.86rem; font-weight: 600; color: #9aa8ba; }
.vvp-chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin-top: 16px; }
.vvp-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; border-radius: var(--r-full); white-space: nowrap; color: #8d9aab; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); }
.vvp-chip--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.04em; color: var(--brand-soft); background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.35); }
.vvp-identity-stats { position: relative; z-index: 1; flex: 0 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding-left: 26px; border-left: 1px solid rgba(255, 255, 255, 0.1); }
.vvp-stat-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8b9e; white-space: nowrap; }
.vvp-stat-value { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; color: var(--brand); text-shadow: 0 0 22px var(--brand-glow); line-height: 1; }
.vvp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.vvp-col-span-2 { grid-column: span 2; }
.vvp-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vvp-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vvp-input,
    .vvp-select,
    .vvp-textarea { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background-color var(--dur) var(--ease); }
.vvp-input::placeholder,
    .vvp-textarea::placeholder { color: var(--ink-faint); }
.vvp-input:hover,
    .vvp-select:hover,
    .vvp-textarea:hover { border-color: #d4d4d4; }
.vvp-input:focus,
    .vvp-select:focus,
    .vvp-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vvp-input.is-invalid,
    .vvp-select.is-invalid,
    .vvp-textarea.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vvp-select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 38px; cursor: pointer; }
.vvp-hint { font-size: 0.7rem; line-height: 1.5; color: var(--ink-faint); }
.vvp-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.vvp-actions-meta { font-size: 0.72rem; color: var(--ink-faint); line-height: 1.5; }
.vvp-actions-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.vvp-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.vvp-tile { display: flex; flex-direction: column; gap: 12px; padding: 20px 20px 22px; border-radius: var(--r-xl); background: #ffffff; border: 1px solid var(--line); text-decoration: none; transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vvp-tile:hover,
    .vvp-tile:focus-visible { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 46px -34px rgba(10, 13, 18, 0.45); outline: none; }
.vvp-tile-icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vvp-tile-title { font-size: 0.86rem; font-weight: 800; letter-spacing: -0.005em; color: var(--ink); transition: color 0.25s var(--ease); }
.vvp-tile:hover .vvp-tile-title { color: var(--brand-strong); }
.vvp-tile-text { font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); }
@media (max-width: 1024px) {
.vvp-identity-stats { flex: 1 1 100%; padding-left: 0; padding-top: 22px; border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.vvp-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
.vvp-identity { padding: 24px 22px; gap: 20px; }
.vvp-avatar { width: 74px; height: 74px; font-size: 1.5rem; }
.vvp-card { padding: 22px 20px; }
.vvp-actions { flex-direction: column; align-items: stretch; }
.vvp-actions-buttons { width: 100%; }
.vvp-actions-buttons .vvp-btn { flex: 1 1 auto; }
.vvp-modal-actions .vvp-btn { width: 100%; }
}
@media (max-width: 640px) {
.vvp-grid { grid-template-columns: 1fr; }
.vvp-col-span-2 { grid-column: auto; }
.vvp-tiles { grid-template-columns: 1fr; }
.vvp-identity-stats { grid-t
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `Last updated`
- `— VUNVAULT Client Profile`
- `Please complete name, role and email`
- `Personal details saved`
- `Could not save — storage unavailable`
**Behaviour (replaces the prototype's local storage persistence):** load `GET /api/v1/profile` (`ClientProfile`); the hero shows initials avatar, full name, `jobTitle`, company, `Client ID` = `clientCode` (`VV-CL-48210`), the plan chip (`plan.name` + status) and the three stats (`engagements`, `openFindings`, `nextAssessmentInDays` formatted `<n> days`, or `—` when null). Form fields (RHF + Zod `UpdateProfileBody`): `Full Name`, `Job Title`, `Email` (read-only, `aria-readonly`), `Phone`, `Company Name`, `Primary Domain` (accepts `https://example.co.ke` or `example.co.ke`; the API normalises), `Industry` (select with the 11 `INDUSTRY_LABELS`, first option `Select industry…`). Validation message verbatim: `Please complete name, role and email` is split into per-field messages: `Please enter your full name.`, `Please enter your job title.`. Save → `PATCH /api/v1/profile`; success toast title `Personal details saved` (message `Your profile has been updated.`) and the footer line `Last saved just now` (drop `· stored locally on this device` — it is no longer true); failure toast `{ kind: "crit", title: "Could not save", message: "Please try again." }`. Dirty-state guard: `Save` disabled until the form is dirty; `beforeunload` warning while dirty (`useEffect`, remove on save).

**Tests:** header shows `VV-CL-48210` and the stats from MSW; read-only email; PATCH body shape; success toast; the dirty guard disables Save; a 400 maps `details` to fields.

---

**Data shape (TypeScript):**
```ts
// ClientProfile, UpdateProfileBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/profile → 200 { data: ClientProfile } | 403 no_org
// PATCH /api/v1/profile body UpdateProfileBody → 200 { data: ClientProfile } | 400 validation_failed
```

---

**Out of scope:**
- Do not use browser storage.
- Do not add avatar upload for clients.
- Do not implement password or MFA controls here.

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
☐ Report at the end: `Task 68 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 69 — Portal home: released scans list and report detail (planner-authored — no prototype)

**Layer:** L8

**Prerequisites:** Task 35, Task 12, Task 9, Task 45

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Portal home: released scans list and report detail (planner-authored — no prototype)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal` (the client's scans) and `/portal/scans/[id]` (released report detail with redacted findings) on the release-locked scans API.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/page.tsx`
- `apps/web/src/app/(authed)/portal/scans/[id]/page.tsx`
- `apps/web/src/app/(authed)/portal/_components/scans-table.tsx`, `scan-summary-cards.tsx`, `new-scan-dialog.tsx`, `findings-list.tsx`, `severity-bar.tsx`
- `apps/web/src/app/(authed)/portal/_hooks/use-scans.ts`
- `apps/web/src/app/(authed)/portal/_styles/scans.css`
- `apps/web/src/mocks/handlers/scans.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/scans.test.tsx`

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

**No prototype exists for this page; build it from the shared primitives and the billing page's visual language (`vbb-*` card/table/chip styles live in `billing.css` — copy the needed rules into `scans.css`; do not import across features). All copy below is planner-authored.**

**`/portal` layout:** hero (eyebrow `Client Portal`, h1 `Your Security Reports`, p `Released penetration test and vulnerability assessment reports for your organisation.`) → three summary cards (`Reports released` count, `Open findings` count (critical+high highlighted), `Next assessment` days from profile stats) → `Request PenTest` hint card linking to the header dialog → the scans table (`DataTable`): columns `Job` (`JOB-4466`), `Target`, `Type` (`SCAN_TYPE_LABELS`), `Released` (date), `Findings` (compact severity bar with counts), `Action` (`View report`). Empty state: `No released reports yet` / `Reports appear here after the VUNVAULT team completes the mandatory review.` A secondary button `New scan request` opens `NewScanDialog`.
**Release lock (critical):** the list shows ONLY what `GET /api/v1/scans` returns (the API already excludes unreleased jobs). The UI must not infer or display unreleased jobs, review state, or gate state anywhere. A `404` on the detail page → the standard not-found page.
**NewScanDialog:** fields (RHF + Zod `CreateScanBody` minus `orgId`): `Target` (hostname, URL, IPv4 or CIDR; placeholder `app.example.co.ke`), `Scan type` (`SCAN_TYPE_LABELS`), `Priority` (`Low`…`Critical`, default `Medium`), `Environment` (`Production`/`Staging`), `Scope notes`, and `Signed authorisation (PDF, max 10 MB)` file input (required). Flow: `POST /scans/authorisation-url` → `PUT` the file to the presigned URL (`fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file })`) → `POST /scans { …, authorisationDocKey }`. Messages: `422 authorisation_missing` → `The signed authorisation could not be verified. Upload it again.`; `422 target_not_allowed` → `That target cannot be scanned. Internal and private addresses require an engagement lead.`; success toast `{ kind: "ok", title: "Scan requested", message: "Job <JOB-code> is queued. You will be notified when the report is released." }`. Dialog note: `Only scan systems you own or are authorised in writing to test.` The new job does NOT appear in the table until released (explain in the toast text above).
**Detail page:** header (job code, target, type, released date), severity summary (`Critical`/`High`/`Medium`/`Low` counts as `Badge`s), the findings list from `GET /scans/:id/findings` — each finding a collapsible `<details>` with title, severity badge, CVSS and CWE when present, description, `Remediation` text (`remediationGuidance`) and `Evidence (redacted)` in a monospace block (React text node only). No export in v1 (`// TODO(backend-contract): report PDF`).

**Tests:** table renders MSW rows and links to detail; empty state; New scan dialog requires the PDF and runs the three requests in order (assert order); 422 mappings; detail renders findings sorted critical→low; evidence is rendered as text (an `<img onerror>` string stays inert).

---

**Data shape (TypeScript):**
```ts
// ScanJob, ScanFinding, CreateScanBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/scans?page=&pageSize= → 200 { data: ScanJob[]; total }   (released jobs of own org only)
// GET  /api/v1/scans/:id → 200 { data: ScanJob } | 404 · GET /api/v1/scans/:id/findings → 200 { data: ScanFinding[] }
// POST /api/v1/scans/authorisation-url body { contentType: "application/pdf"; sizeBytes } → 200 { data: { uploadUrl; objectKey; expiresAt } }
// POST /api/v1/scans body { targetHost; scanType; priority?; environment?; scopeNotes?; authorisationDocKey } → 201 { data: ScanJob } | 422 authorisation_missing | 422 target_not_allowed
```

---

**Out of scope:**
- Do not show unreleased jobs or any review/gate/payment state.
- Do not connect to scan infrastructure.
- Do not implement report PDF export.

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
☐ Report at the end: `Task 69 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 70 — Portal advisories feed with acknowledge (planner-authored — no prototype)

**Layer:** L8

**Prerequisites:** Task 38, Task 45, Task 9

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Portal advisories feed with acknowledge (planner-authored — no prototype)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/advisories`: the client's zero-day advisory feed with severity, scope, remediation and an Acknowledge action.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/advisories/page.tsx`
- `apps/web/src/app/(authed)/portal/advisories/_components/advisory-card.tsx`, `advisories-hero.tsx`
- `apps/web/src/app/(authed)/portal/advisories/_hooks/use-advisories.ts`
- `apps/web/src/app/(authed)/portal/advisories/_styles/advisories.css`
- `apps/web/src/mocks/handlers/advisories.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/advisories/advisories.test.tsx`

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

**No prototype; planner-authored copy. Reuse the card/chip visual language (`Card`, `Badge` tones `critical|high|medium|low`, `StatusPill` not needed).**
Hero: eyebrow `Threat Intelligence`, h1 `Security Advisories`, p `Emergency zero-day advisories from the VUNVAULT intelligence desk, matched to your environment.`
Card (per `ClientAdvisory`): severity `Badge` (`CRITICAL`/`HIGH`/…), CVE id in monospace, title, `source` line `VUNVAULT Intelligence`, published date (`DD Mon YYYY, HH:MM UTC`), scope chips (`label`, plus the `SCOPE_CATEGORY_LABELS` category when present), `Summary` paragraph, `Recommended remediation` paragraph, references as external links (`rel="noopener noreferrer"`, `target="_blank"`), patch-status chip (`PATCH_STATUS_LABELS`), and a button `Acknowledge` (becomes a disabled `Acknowledged` with a check icon). Order newest first. Unacknowledged critical advisories are visually pinned to the top with a left border in `critical`. Empty state: `No active advisories` / `We will notify you here and by email when a new zero-day affects your environment.`
`Acknowledge` → `POST /advisories/:id/acknowledge` (optimistic update; roll back on error with toast `{ kind: "crit", title: "Could not acknowledge", message: "Please try again." }`). A retracted advisory never appears (the API omits it).
Poll `GET /advisories` every 60 s while the tab is visible (`refetchInterval` with `refetchIntervalInBackground: false`); the real-time push comes in Layer L12.

**Tests:** cards render fields from MSW; acknowledge is optimistic and idempotent; critical pinned first; references are safe links; empty state.

---

**Data shape (TypeScript):**
```ts
// ClientAdvisory: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/advisories → 200 { data: ClientAdvisory[]; total }
// POST /api/v1/advisories/:id/acknowledge → 204
```

---

**Out of scope:**
- Do not build the SSE push (Layer L12).
- Do not expose drafts or broadcast internals.
- Do not use `dangerouslySetInnerHTML` for summary text.

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
☐ Report at the end: `Task 70 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 71 — Content Studio A: badge gate and my-submissions list

**Layer:** L8

**Prerequisites:** Task 36, Task 45, Task 12

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Content Studio A: badge gate and my-submissions list**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Studio shell at `/portal/studio`: the Verified-Blogger gate and the list of the author's posts with status and reviewer notes, linking to the editor.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/studio/page.tsx`
- `apps/web/src/app/(authed)/portal/studio/_components/studio-gate.tsx`, `submissions-table.tsx`, `studio-header.tsx`
- `apps/web/src/app/(authed)/portal/studio/_hooks/use-studio.ts`
- `apps/web/src/app/(authed)/portal/studio/_styles/studio.css`
- `apps/web/src/mocks/handlers/studio.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/studio/studio-a.test.tsx`

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

**Reference markup (denied card):**

##### Access-denied card (shown when the user lacks the Verified Blogger badge)
```html
<main class="vbg-denied" id="vbgDenied" hidden>
 <div class="vbg-denied-card">
  <div class="vbg-denied-glow" aria-hidden="true"></div>
  <span class="vbg-denied-icon" aria-hidden="true">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </span>
  <span class="vbg-denied-eyebrow">Access Restricted</span>
  <h1 class="vbg-denied-title">Verified Journalist / Blogger badge required</h1>
  <p class="vbg-denied-text">
   You need a
   <strong>Verified Journalist / Blogger Badge</strong>
   to publish content on VUNVAULT. This studio lets approved writers draft articles, attach media and submit posts into the pre-publication moderation queue. Unverified accounts cannot open it.
  </p>
  <ul class="vbg-denied-list">
   <li>
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>
     Submit a verification request through the Contact page using the
     <strong>Journalist / Blogger Profile Request</strong>
     category.
    </span>
   </li>
   [+2 more sibling <li> elements with the SAME structure as the one above; their text content in order: Our editorial team verifies your identity and publication history manually. || Once approved, this studio unlocks and your posts enter admin moderation before publishing.]
  </ul>
  <div class="vbg-denied-actions">
   <a href="/contact" class="vbg-btn vbg-btn--primary">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Request Verification</span>
   </a>
   <a href="/" class="vbg-btn vbg-btn--ghost">Back to Home</a>
   <button type="button" class="vbg-btn vbg-btn--quiet" id="vbgDemoGrant">Enable demo verification</button>
  </div>
  <p class="vbg-demo-note">
   Demo control — writes
   <code>isVerifiedBlogger = "true"</code>
   to this browser’s localStorage so the studio can be evaluated without a backend.
  </p>
 </div>
</main>
```
Custom CSS for this markup (reference):
```css
.vbg-denied { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; padding: 60px 20px 90px; }
.vbg-denied-card { position: relative; overflow: hidden; width: min(720px, 100%); padding: 44px 40px 40px; text-align: center; border-radius: var(--vg-r-2xl); background: radial-gradient(120% 90% at 100% 0%, rgba(59, 153, 252, 0.10), transparent 58%), #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 40px 90px -50px rgba(10, 13, 18, 0.55); }
.vbg-denied-glow { position: absolute; top: -55%; right: -12%; width: 48%; height: 200%; background: radial-gradient(closest-side, var(--vg-brand-glow), transparent 72%); filter: blur(72px); opacity: 0.35; pointer-events: none; }
.vbg-denied-icon { position: relative; z-index: 1; display: inline-grid; place-items: center; width: 76px; height: 76px; margin-bottom: 22px; border-radius: 50%; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); box-shadow: 0 0 0 10px rgba(59, 153, 252, 0.06); }
.vbg-denied-eyebrow { position: relative; z-index: 1; display: inline-block; padding: 6px 14px; font-size: 0.64rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); border-radius: var(--vg-r-full); }
.vbg-denied-title { position: relative; z-index: 1; margin: 18px 0 0; font-size: clamp(1.5rem, 3.4vw, 2.05rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; color: var(--vg-ink); }
.vbg-denied-text { position: relative; z-index: 1; margin: 14px auto 0; max-width: 54ch; font-size: 0.9rem; line-height: 1.75; color: var(--vg-ink-muted); }
.vbg-denied-list { position: relative; z-index: 1; display: grid; gap: 10px; margin: 26px 0 0; padding: 0; list-style: none; text-align: left; }
.vbg-denied-list li { display: flex; align-items: flex-start; gap: 11px; padding: 13px 15px; font-size: 0.79rem; line-height: 1.65; color: var(--vg-ink-soft); background: #f8fafc; border: 1px solid var(--vg-line-soft); border-radius: var(--vg-r-md); }
.vbg-denied-list svg { flex: 0 0 auto; margin-top: 2px; color: var(--vg-brand); }
.vbg-denied-actions { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; margin-top: 30px; }
.vbg-demo-note { position: relative; z-index: 1; margin: 22px 0 0; font-size: 0.68rem; line-height: 1.6; color: var(--vg-ink-faint); }
.vbg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 22px; font-size: 0.79rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--vg-r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.2s var(--vg-ease), filter 0.2s var(--vg-ease), box-shadow 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), border-color 0.2s var(--vg-ease), color 0.2s var(--vg-ease); }
.vbg-btn svg { flex: 0 0 auto; }
.vbg-btn:active { transform: translateY(1px) scale(0.985); }
.vbg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.vbg-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--vg-brand) 0%, var(--vg-brand-strong) 100%); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 14px 30px -16px var(--vg-brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.24); }
.vbg-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 40px -18px var(--vg-brand-glow); }
.vbg-btn--ghost { color: var(--vg-ink); background: #ffffff; border-color: var(--vg-line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.vbg-btn--ghost:hover { transform: translateY(-2px); color: var(--vg-brand-strong); border-color: var(--vg-brand-line); box-shadow: 0 14px 30px -20px var(--vg-brand-glow); }
.vbg-btn--quiet { color: var(--vg-ink-muted); background: transparent; border-color: var(--vg-line); font-weight: 700; }
.vbg-btn--quiet:hover { color: var(--vg-ink); background: #f8fafc; border-color: #d4d7dd; }
@media (max-width: 760px) {
.vbg-actionbar .vbg-btn { flex: 1 1 auto; }
.vbg-modal-foot .vbg-btn { width: 100%; }
}
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `Verified Blogger`
- `Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.`
- `Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.`
- `Investigative technology journalist covering East African cyber policy and digital rights.`
- `Demo verification granted`
- `Reloading the Content Studio…`
- `Industry Updates`
- `Slug locked — click to resume auto-updates`
- `Lock slug to stop auto-updates`
- `The URL will no longer follow the title.`
- `The URL will now follow the title again.`
- `Nothing selected`
- `Highlight some text first, then clear its formatting.`
- `Tag limit reached`
**Gate:** `GET /api/v1/studio/status` → if `verified` is false render the denied card with copy verbatim from the markup and REMOVE the prototype's `Demo verification` button (it faked the badge with `localStorage`; the badge is granted by an administrator after a Contact-page verification request — the card's call-to-action link goes to `/contact?category=journalist_blogger_profile_request#contact-form`). Verified users see the header chip `Verified Blogger` with the tooltip text `Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.`.
**My submissions:** `GET /studio/submissions` → `DataTable` with columns `Title` (or `Untitled article`), `Category` (`BLOG_CATEGORY_LABELS`), `Status` (`CONTENT_STATUS_LABELS` chips: draft/pending review/changes requested/approved/rejected/published/scheduled), `Updated`, `Action` (`Edit` for `draft`/`changes_requested`, `View` otherwise → editor in read-only mode). When `status = changes_requested` or `rejected` show the reviewer note under the title (`Reviewer note:` prefix, planner copy). Buttons: `New article` → `/portal/studio/edit/new`; empty state `No articles yet` / `Start a draft — it is saved to your account and reviewed before publication.`

**Tests:** unverified user sees the denied copy and no demo button; verified user sees the table; reviewer note shown for `changes_requested`; New article navigates.

---

**Data shape (TypeScript):**
```ts
// StudioItem, StudioStatus: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/studio/status → 200 { data: { verified; verifiedAt; displayName } }
// GET /api/v1/studio/submissions → 200 { data: StudioItem[]; total } | 403 badge_required
```

---

**Out of scope:**
- Do not build the editor (Task 72).
- Do not use `localStorage` or any demo-grant control.
- Do not grant badges from the UI.

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
☐ Report at the end: `Task 71 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 72 — Content Studio B: article editor with autosave, tags, featured image, readiness and submit

**Layer:** L8

**Prerequisites:** Task 36, Task 71, Task 40c

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Content Studio B: article editor with autosave, tags, featured image, readiness and submit**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/studio/edit/[id]`: the full article editor with title/slug, rich-text-lite body, subtitle list, featured image upload, tags, author card, readiness checklist, preview dialog and submit for review — all persisted through the studio API.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/studio/edit/[id]/page.tsx`
- `apps/web/src/app/(authed)/portal/studio/_components/editor/title-slug.tsx`, `body-editor.tsx`, `toolbar.tsx`, `subheading-list.tsx`, `featured-image.tsx`, `tag-input.tsx`, `author-card.tsx`, `readiness-checklist.tsx`, `preview-dialog.tsx`, `save-indicator.tsx`
- `apps/web/src/app/(authed)/portal/studio/_lib/markdown.ts` — `htmlToMarkdown`/`markdownToBlocks` for the editor value, and `countWords`/`readMinutes` re-exported from contracts.
- `apps/web/src/app/(authed)/portal/studio/_hooks/use-draft.ts` — autosave + submit hooks.
- `apps/web/src/app/(authed)/portal/studio/_styles/editor.css`
- MODIFY `apps/web/src/mocks/handlers/studio.ts`.
- `apps/web/src/app/(authed)/portal/studio/studio-b.test.tsx`
- `apps/web/src/app/(authed)/portal/studio/_lib/markdown.test.ts`

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

**Reference markup:**

##### Studio editor (full page)
```html
<main class="vbg-main" id="vbgStudio" hidden>
 <div class="vbg-shell">
  <div class="vbg-page-head">
   <div>
    <span class="vbg-eyebrow">User Content Creation Studio</span>
    <h1 class="vbg-page-title">Write & submit an article</h1>
    <p class="vbg-page-sub">
     Draft your story, attach media and preview it exactly as readers will see it. Publishing submits the article to the admin moderation queue — nothing goes live until an editor approves it.
    </p>
   </div>
   <div class="vbg-actionbar">
    <button type="button" class="vbg-btn vbg-btn--ghost" id="vbgSaveDraft">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Save Draft</span>
    </button>
    [+2 more sibling <button> elements with the SAME structure as the one above; their text content in order: Preview Article || Publish Post]
    <div class="vbg-actionbar-note">
     <span class="vbg-save-dot" id="vbgSaveDot" aria-hidden="true"></span>
     <span id="vbgSaveLabel">Working copy saved locally</span>
    </div>
   </div>
  </div>
  <div class="vbg-editor-grid">
   <div class="vbg-col">
    <section class="vbg-card" aria-labelledby="vbgContentHeading">
     <div class="vbg-card-head">
      <div>
       <span class="vbg-card-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <div>
        <h2 class="vbg-card-title" id="vbgContentHeading">Article Content</h2>
        <p class="vbg-card-note">Write the full piece. Formatting uses lightweight markup that renders into clean HTML in the reader view.</p>
       </div>
      </div>
     </div>
     <div class="vbg-card-body">
      <div class="vbg-field">
       <label class="vbg-label" for="post-title">
        <span>
         Post Title
         <span class="vbg-label-req" aria-hidden="true">*</span>
        </span>
        <span class="vbg-label-hint" id="titleCount">0 / 120</span>
       </label>
       <input id="post-title" class="vbg-input vbg-input--title" type="text" maxlength="120" placeholder="Give your story a headline…" autocomplete="off"/>
      </div>
      [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: URL Slug ¦ Auto-generated from the title ¦ /blog/ ¦ Public URL: /blog/your-article-slug || Category ¦ * ¦ Select a category… ¦ News ¦ Threat Intel ¦ Blog ¦ Industry Updates ¦ Tutorials || Excerpt / Summary ¦ 0 / 240 || Main Body ¦ * ¦ Markdown-style formatting supported ¦ B ¦ I ¦ H2 ¦ H3 ¦ Words ¦ 0 ¦ Characters ¦ 0 ¦ Read time ¦ 0 min ¦ Target ≥ ¦ 150 ¦ words ¦ Autosaved locally ¦ The moderation team reads the raw text and the rendered preview. Keep claims sourced.]
     </div>
    </section>
    <section class="vbg-card" id="submissions" aria-labelledby="vbgSubHeading">
     <div class="vbg-card-head">
      <div>
       <h2 class="vbg-card-title" id="vbgSubHeading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Your Submissions
       </h2>
       <p class="vbg-card-note">Drafts and posts you have submitted, with their current moderation status.</p>
      </div>
      <span class="vbg-pill vbg-pill--info" id="vbgSubCount">0 items</span>
     </div>
     <div class="vbg-card-body">
      <div class="vbg-sub-list" id="vbgSubList"></div>
     </div>
    </section>
   </div>
   <aside class="vbg-col" aria-label="Publishing options">
    <section class="vbg-card" aria-labelledby="vbgImageHeading">
     <div class="vbg-card-head">
      <div>
       <h2 class="vbg-card-title" id="vbgImageHeading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Featured Image
       </h2>
       <p class="vbg-card-note">Upload from this device or paste a hosted image URL. The image is stored with the post.</p>
      </div>
     </div>
     <div class="vbg-card-body">
      <div class="vbg-drop" id="vbgDropZone" role="button" tabindex="0" aria-label="Upload a featured image from your device">
       <span class="vbg-drop-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <span class="vbg-drop-title">Drop an image here</span>
       <span class="vbg-drop-text">or click to browse · JPG, PNG, WebP, GIF · max 5 MB</span>
       <input type="file" id="vbgFileInput" hidden/>
      </div>
      <div class="vbg-divider-or" aria-hidden="true">or</div>
      <div class="vbg-field">
       <label class="vbg-label" for="post-cover-url">
        <span>Image URL</span>
       </label>
       <input id="post-cover-url" class="vbg-input" type="url" placeholder="https://cdn.example.com/cover.jpg" autocomplete="off"/>
      </div>
      <div class="vbg-img-preview" id="vbgImgPreview" hidden>
       <img id="vbgImgEl" src alt/>
       <button type="button" class="vbg-img-remove" id="vbgImgRemove" aria-label="Remove featured image">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </button>
       <div class="vbg-img-meta">
        <span id="vbgImgMeta">—</span>
        <span id="vbgImgSource">—</span>
       </div>
      </div>
      <div class="vbg-field">
       <label class="vbg-label" for="post-cover-alt">
        <span>Image Alt Text</span>
        <span class="vbg-label-hint">Accessibility</span>
       </label>
       <input id="post-cover-alt" class="vbg-input" type="text" maxlength="160" placeholder="Describe the image for screen readers…" autocomplete="off"/>
      </div>
     </div>
    </section>
    [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Hashtags / Tags ¦ Press ¦ Enter ¦ or ¦ comma ¦ to add a tag. Backspace removes the last one. ¦ 0 tags ¦ Suggestions ¦ #security ¦ #threatintel ¦ #fintech ¦ #africa ¦ #compliance ¦ #research ¦ Maximum 8 tags. Tags drive related-article feeds and topic pages. || Author ¦ V ¦ Verified Blogger ¦ Journalist ¦ Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit. ¦ Verified ¦ Pre-publication review ¦ Edit profile & byline]
    <section class="vbg-card vbg-card--dark" aria-labelledby="vbgReadyHeading">
     <div class="vbg-card-head">
      <div>
       <h2 class="vbg-card-title" id="vbgReadyHeading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Publication Readiness
       </h2>
       <p class="vbg-card-note">Everything marked required must be complete before the post can be submitted.</p>
      </div>
     </div>
     <div class="vbg-card-body">
      <ul class="vbg-checklist" id="vbgChecklist">
       <li class="vbg-check-item">
        <span class="vbg-check-mark" aria-hidden="true">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </span>
        <span>Title added</span>
        <span class="vbg-check-req">Required</span>
       </li>
       [+5 more sibling <li> elements with the SAME structure as the one above; their text content in order: Category selected ¦ Required || Body ≥ 150 words ¦ Required || Excerpt written || Featured image attached || At least 2 tags]
      </ul>
     </div>
    </section>
   </aside>
  </div>
 </div>
</main>
```
Custom CSS for this markup (reference):
```css
.vbg-shell { width: 100%; max-width: 88rem; margin-inline: auto; padding-inline: 16px; }
@media (min-width: 640px) {
.vbg-shell { padding-inline: 24px; }
}
@media (min-width: 1024px) {
.vbg-shell { padding-inline: 32px; }
}
.vbg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 22px; font-size: 0.79rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--vg-r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.2s var(--vg-ease), filter 0.2s var(--vg-ease), box-shadow 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), border-color 0.2s var(--vg-ease), color 0.2s var(--vg-ease); }
.vbg-btn svg { flex: 0 0 auto; }
.vbg-btn:active { transform: translateY(1px) scale(0.985); }
.vbg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.vbg-btn--ghost { color: var(--vg-ink); background: #ffffff; border-color: var(--vg-line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.vbg-btn--ghost:hover { transform: translateY(-2px); color: var(--vg-brand-strong); border-color: var(--vg-brand-line); box-shadow: 0 14px 30px -20px var(--vg-brand-glow); }
.vbg-main { flex: 1 1 auto; padding: 30px 0 70px; }
.vbg-page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 22px; padding-bottom: 22px; margin-bottom: 24px; border-bottom: 1px solid var(--vg-line-soft); }
.vbg-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--vg-brand-strong); }
.vbg-eyebrow::before { content: ""; width: 22px; height: 2px; border-radius: 2px; background: var(--vg-brand); }
.vbg-page-title { margin: 10px 0 0; font-size: clamp(1.6rem, 3.2vw, 2.3rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--vg-ink); }
.vbg-page-sub { margin: 8px 0 0; max-width: 72ch; font-size: 0.85rem; line-height: 1.7; color: var(--vg-ink-muted); }
.vbg-actionbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.vbg-actionbar-note { width: 100%; display: flex; align-items: center; justify-content: flex-end; gap: 7px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: var(--vg-ink-faint); }
.vbg-save-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--vg-ink-faint); transition: background-color var(--vg-dur) var(--vg-ease); }
.vbg-save-dot.is-dirty { background: var(--vg-high); }
.vbg-save-dot.is-saved { background: var(--vg-ok); }
.vbg-editor-grid { display: grid; grid-template-columns: minmax(0, 1.62fr) minmax(0, 1fr); gap: 22px; align-items: start; }
@media (max-width: 1180px) {
.vbg-editor-grid { grid-template-columns: 1fr; }
}
.vbg-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.vbg-card { display: flex; flex-direction: column; border-radius: var(--vg-r-xl); background: #ffffff; border: 1px solid var(--vg-line); box-shadow: 0 18px 44px -40px rgba(10, 13, 18, 0.55); overflow: hidden; }
.vbg-card--dark { background: radial-gradient(80% 120% at 100% 0%, rgba(59, 153, 252, 0.16), transparent 62%), linear-gradient(160deg, var(--vg-dark) 0%, #070b11 100%); border-color: rgba(59, 153, 252, 0.26); box-shadow: 0 26px 56px -34px rgba(0, 0, 0, 0.7); color: #ffffff; }
.vbg-card-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 18px 22px 15px; border-bottom: 1px solid var(--vg-line-soft); }
.vbg-card--dark .vbg-card-head { border-bottom-color: rgba(255, 255, 255, 0.08); }
.vbg-card-title { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 0.98rem; font-weight: 800; letter-spacing: -0.01em; color: var(--vg-ink); }
.vbg-card--dark .vbg-card-title { color: #ffffff; }
.vbg-card-title svg { color: var(--vg-brand); flex: 0 0 auto; }
.vbg-card-note { margin: 5px 0 0; font-size: 0.73rem; line-height: 1.6; color: var(--vg-ink-muted); max-width: 68ch; }
.vbg-card--dark .vbg-card-note { color: #93a2b5; }
.vbg-card-body { flex: 1 1 auto; padding: 20px 22px 24px; }
.vbg-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); }
.vbg-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vbg-field + .vbg-field { margin-top: 18px; }
.vbg-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--vg-ink-muted); }
.vbg-label-req { color: var(--vg-critical); }
.vbg-label-hint { font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: none; color: var(--vg-ink-faint); }
.vbg-input,
  .vbg-select,
  .vbg-textarea { width: 100%; padding: 12px 14px; font-size: 0.85rem; font-family: inherit; color: var(--vg-ink); background: #ffffff; border: 1px solid var(--vg-line); border-radius: var(--vg-r-md); outline: none; transition: border-color var(--vg-dur) var(--vg-ease), box-shadow var(--vg-dur) var(--vg-ease), background-color var(--vg-dur) var(--vg-ease); }
.vbg-input::placeholder,
  .vbg-textarea::placeholder { color: var(--vg-ink-faint); }
.vbg-input:hover,
  .vbg-select:hover,
  .vbg-textarea:hover { border-color: #d4d7dd; }
.vbg-input:focus,
  .vbg-select:focus,
  .vbg-textarea:focus { border-color: var(--vg-brand); box-shadow: 0 0 0 3px var(--vg-brand-tint); }
.vbg-input.is-invalid,
  .vbg-select.is-invalid,
  .vbg-textarea.is-invalid { border-color: var(--vg-critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vbg-input--title { padding: 16px 18px; font-size: clamp(1.15rem, 2.4vw, 1.45rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.3; }
.vbg-slug-wrap .vbg-input { border: 0; border-radius: 0; box-shadow: none !important; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.78rem; }
.vbg-drop { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 26px 18px; text-align: center; border: 1.5px dashed var(--vg-line); border-radius: var(--vg-r-md); background: #fbfcfd; cursor: pointer; transition: border-color 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), transform 0.2s var(--vg-ease); }
.vbg-drop:hover,
  .vbg-drop:focus-visible { border-color: var(--vg-brand-line); background: var(--vg-brand-tint); outline: none; }
.vbg-drop.is-dragover { border-color: var(--vg-brand); background: rgba(59, 153, 252, 0.14); transform: scale(1.01); }
.vbg-drop-icon { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; color: var(--vg-brand-strong); background: var(--vg-brand-tint); border: 1px solid var(--vg-brand-line); }
.vbg-drop-title { font-size: 0.78rem; font-weight: 800; color: var(--vg-ink); }
.vbg-drop-text { font-size: 0.7rem; line-height: 1.55; color: var(--vg-ink-muted); }
.vbg-img-preview { position: relative; border-radius: var(--vg-r-md); overflow: hidden; border: 1px solid var(--vg-line); background: var(--dark); }
.vbg-img-preview img { width: 100%; max-height: 260px; object-fit: cover; }
.vbg-img-remove { position: absolute; top: 10px; right: 10px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; color: #ffffff; background: rgba(10, 13, 18, 0.72); border: 1px solid rgba(255, 255, 255, 0.22); cursor: pointer; backdrop-filter: blur(6px); transition: background-color 0.2s var(--vg-ease), transform 0.2s var(--vg-ease); }
.vbg-img-remove:hover { background: rgba(244, 63, 94, 0.9); transform: rotate(90deg); }
.vbg-img-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; font-weight: 700; color: #93a2b5; background: var(--dark); border-top: 1px solid rgba(59, 153, 252, 0.22); }
.vbg-divider-or { display: flex; align-items: center; gap: 12px; margin: 16px 0; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--vg-ink-faint); }
.vbg-divider-or::before,
  .vbg-divider-or::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--vg-line); }
.vbg-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: var(--vg-r-full); white-space: nowrap; border: 1px solid transparent; }
.vbg-pill--info { color: var(--vg-brand-strong); background: var(--vg-brand-tint); border-color: var(--vg-brand-line); }
.vbg-checklist { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.vbg-check-item { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; font-size: 0.76rem; font-weight: 600; color: var(--vg-ink-soft); transition: background-color 0.2s var(--vg-ease); }
.vbg-check-item.is-done { color: var(--vg-ink); background: rgba(16, 185, 129, 0.07); }
.vbg-check-mark { flex: 0 0 auto; display: inline-grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; color: var(--vg-ink-faint); background: #f1f2f4; border: 1px solid var(--vg-line); transition: all 0.2s var(--vg-ease); }
.vbg-check-item.is-done .vbg-check-mark { color: #ffffff; background: linear-gradient(135deg, var(--ok), #047857); border-color: transparent; }
.vbg-check-mark svg { opacity: 0; transition: opacity 0.2s var(--vg-ease); }
.vbg-check-item.is-done .vbg-check-mark svg { opacity: 1; }
.vbg-check-req { margin-left: auto; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vg-critical); }
.vbg-check-item.is-done .vbg-check-req { display: none; }
.vbg-sub-list { display: flex; flex-direction: column; gap: 10px; }
@media (max-width: 760px) {
.vbg-page-head { flex-direction: column; align-items: stretch; }
.vbg-actionbar { width: 100%; }
.vbg-actionbar .vbg-btn { flex: 1 1 auto; }
.vbg-actionbar-note { justify-content: flex-start; }
.vbg-card-body { padding: 18px 16px 20px; }
.vbg-card-head { padding: 16px 16px 14px; }
.vbg-modal-foot .vbg-btn { width: 100%; }
}
```

##### Preview dialog
```html
<div id="vbgPreviewModal" class="vbg-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vbgModalTitle">
 <div class="vbg-modal-backdrop"></div>
 <div class="vbg-modal-window" role="document">
  <div class="vbg-modal-head">
   <div>
    <span class="vbg-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Reader Preview
    </span>
    <h2 class="vbg-modal-title" id="vbgModalTitle">Untitled article</h2>
    <p class="vbg-modal-sub" id="vbgModalSlug">/blog/</p>
   </div>
   <button type="button" class="vbg-modal-close" aria-label="Close preview">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="vbg-modal-body" id="vbgModalBody"></div>
  <div class="vbg-modal-foot">
   <span class="vbg-modal-foot-note">This is a local preview rendered from your device only. Nothing has been published or submitted yet.</span>
   <div class="vbg-modal-foot-actions">
    <button type="button" class="vbg-btn vbg-btn--ghost">Close</button>
    <button type="button" class="vbg-btn vbg-btn--primary" id="vbgModalPublish">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Publish Post</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vbg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 22px; font-size: 0.79rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--vg-r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.2s var(--vg-ease), filter 0.2s var(--vg-ease), box-shadow 0.2s var(--vg-ease), background-color 0.2s var(--vg-ease), border-color 0.2s var(--vg-ease), color 0.2s var(--vg-ease); }
.vbg-btn svg { flex: 0 0 auto; }
.vbg-btn:active { transform: translateY(1px) scale(0.985); }
.vbg-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.vbg-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--vg-brand) 0%, var(--vg-brand-strong) 100%); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 14px 30px -16px var(--vg-brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.24); }
.vbg-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 40px -18px var(--vg-brand-glow); }
.vbg-btn--ghost { color: var(--vg-ink); background: #ffffff; border-color: var(--vg-line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.vbg-btn--ghost:hover { transform: translateY(-2px); color: var(--vg-brand-strong); border-color: var(--vg-brand-line); box-shadow: 0 14px 30px -20px var(--vg-brand-glow); }
.vbg-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 22px; opacity: 0; transition: opacity 0.22s var(--vg-ease); }
.vbg-modal[hidden] { display: none !important; }
.vbg-modal.is-open { opacity: 1; }
.vbg-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vbg-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(940px, 100%); max-height: 92vh; border-radius: var(--vg-r-xl); overflow: hidden; background: #ffffff; border: 1px solid var(--vg-line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--vg-ease); }
.vbg-modal.is-open .vbg-modal-window { transform: translateY(0) scale(1); }
.vbg-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 24px 17px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 62%), linear-gradient(160deg, var(--vg-dark), #070b11); color: #ffffff; }
.vbg-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--vg-brand); }
.vbg-modal-title { margin: 8px 0 0; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.35; color: #ffffff; }
.vbg-modal-sub { margin: 6px 0 0; font-family: ui-monospace, SFMono-Regula
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `Verified Blogger`
- `Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.`
- `Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.`
- `Investigative technology journalist covering East African cyber policy and digital rights.`
- `Demo verification granted`
- `Reloading the Content Studio…`
- `Industry Updates`
- `Slug locked — click to resume auto-updates`
- `Lock slug to stop auto-updates`
- `The URL will no longer follow the title.`
- `The URL will now follow the title again.`
- `Nothing selected`
- `Highlight some text first, then clear its formatting.`
- `Tag limit reached`
- `is already attached to this post.`
- `Featured image removed`
- `The post no longer has a cover image.`
- `Unsupported file`
- `Please choose a JPG, PNG, WebP or GIF image.`
- `File too large`
- `Images must be 5 MB or smaller. This one is`
- `The image could not be read. Try a different file.`
- `The processed image is`
- `Image attached`
- `is now the featured image.`
- `Unsaved changes`
- `Working copy saved locally`
- `Local storage unavailable`
- `Your working copy is stored on this device.`
- `Restored saved working copy`
- `Untitled article`
- `Nothing to preview`
- `Write a title or some body content first.`
- `Preview Article`
- `Cover image dropped`
- `Local storage was full, so the post was saved without the featured image.`
- `New blank draft`
- `a title of at least 4 characters`
- `article body content`
- `Cannot publish yet`
- `before submitting.`
- `Storage unavailable`
- `Your post could not be saved locally. Check your browser storage settings and try again.`
- `Post submitted successfully!`
- `Sent to the admin moderation queue as`
- `Nothing to save`
- `Untitled draft`
- `Could not save draft`
- `Local storage is full or unavailable. Try removing the featured image.`
- `Pending Moderation`
- `Changes Requested`
- `" title="Load into editor" aria-label="Load into editor">`
- `That item is no longer available in local storage.`
- `Loaded into editor`
**Storage change (critical):** the prototype saved a working copy in `localStorage`, embedded the cover image as a data URL, and had a fake `Publish`. In this build: the draft lives on the server. First edit creates it (`POST /studio/drafts`), later edits `PUT /studio/drafts/:id`; **autosave** debounced 1.5 s after the last change when the draft has a title of ≥ 4 characters (title rule message verbatim from the prototype: `a title of at least 4 characters`); the save indicator shows `Unsaved changes` → `Saving…` → `Saved` (labels from the markup/strings). No browser storage. `/portal/studio/edit/new` creates the draft on first autosave and then `router.replace` to `/portal/studio/edit/<id>`.
**Fields → `StudioDraftBody`:** `title` (max 120), slug (auto from title, lock/unlock toggle with the verbatim toasts `Slug locked — click to resume auto-updates`, `Lock slug to stop auto-updates`, `The URL will no longer follow the title.`, `The URL will now follow the title again.`; regex from the contract), `category` (select with the five `BLOG_CATEGORY_LABELS`), `excerpt` (max 240, live counter), body, tags (max 8, chips, suggestions from `STUDIO_TAG_SUGGESTIONS`; messages `Tag limit reached`, `<tag> is already attached to this post.`), featured image + `imageAlt`.
**Body editor:** a `contentEditable`-lite editor is NOT allowed (XSS/IME risk); use a plain `<textarea>`-based Markdown editor with the toolbar buttons from the markup acting on the selection (`bold`, `italic`, `h2`, `h3`, `list`, `quote`, `link`, `code`, `clear formatting` → toast `Nothing selected` / `Highlight some text first, then clear its formatting.` when empty). The editor value IS `bodyMd` (sanitised again by the API). Word count + `Target <strong>met</strong>` indicator at 150 words (`STUDIO_LIMITS.minWords`); read time via `readMinutes`.
**Featured image:** drag-drop zone and file input (JPG/PNG/WebP/GIF, ≤ 5 MB; toasts `Unsupported file` / `Please choose a JPG, PNG, WebP or GIF image.`, `File too large` / `Images must be 5 MB or smaller.`); upload flow: `POST /studio/images/upload-url` → `PUT` file to the presigned URL → set `featuredImageUrl = publicUrl`; toasts `Image attached` / `Featured image removed` / `The post no longer has a cover image.`. Never embed data URLs in the body.
**Readiness checklist (`StudioSubmitReadiness`):** items verbatim `Title added`, `Category selected`, `Body ≥ 150 words`, `Excerpt written`, `Featured image attached`, `At least 2 tags`; the first three are required (marked), the rest optional. **Submit for review** (the prototype's `Publish` button becomes `Submit for Review`) is enabled only when the required items pass → `POST /studio/drafts/:id/submit`; `422 not_ready` → highlight failing items; success toast `{ kind: "ok", title: "Submitted for review", message: "An editor will review your article before it is published." }` and navigate to `/portal/studio`. After submit the editor is read-only unless the status returns to `changes_requested`. `Save Draft` button saves immediately. `Preview` opens the preview dialog rendering the Markdown with `SafeMarkdown` (Task 56; import from the marketing blog components via a shared path — if not exported there, copy the component into `apps/web/src/components/safe-markdown.tsx` and note it).
**Author card:** from the session (`displayName`, role label `Verified Blogger`, initials avatar, the verbatim line `Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.`).

**Tests:** autosave fires once after the debounce and only for titles ≥ 4 chars; the slug follows the title until locked; tag limit and duplicate messages; image type/size rejections; the upload flow order (url → PUT → state); readiness gating of Submit; 422 highlights items; no `localStorage` usage (spy); markdown helpers round-trip a sample.

---

**Data shape (TypeScript):**
```ts
// StudioDraftBody, StudioItem, StudioSubmitReadiness: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/studio/drafts body StudioDraftBody → 201 { data: StudioItem } · PUT /api/v1/studio/drafts/:id → 200 | 409 not_editable · DELETE → 204
// POST /api/v1/studio/drafts/:id/submit → 200 { data: StudioItem } | 422 { error: "not_ready"; details: StudioSubmitReadiness }
// POST /api/v1/studio/images/upload-url body { contentType; sizeBytes } → 200 { data: { uploadUrl; objectKey; publicUrl; expiresAt } }
```

---

**Out of scope:**
- Do not use `localStorage`, `contentEditable`, or data-URL images.
- Do not implement publishing (admin moderation does).
- Do not grant the blogger badge.

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
☐ Report at the end: `Task 72 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 73 — Licences & downloads page (planner-authored — no prototype)

**Layer:** L8

**Prerequisites:** Task 40c, Task 66, Task 45

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Licences & downloads page (planner-authored — no prototype)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/licences`: the client's purchased product licences with key copy, update window and secure download.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/licences/page.tsx`
- `apps/web/src/app/(authed)/portal/licences/_components/licences-table.tsx`
- `apps/web/src/app/(authed)/portal/licences/_hooks/use-entitlements.ts`
- `apps/web/src/app/(authed)/portal/licences/_styles/licences.css`
- `apps/web/src/mocks/handlers/store.ts` — MODIFY.
- `apps/web/src/app/(authed)/portal/licences/licences.test.tsx`
- MODIFY `apps/web/src/app/(authed)/portal/billing/_components/billing-hero.tsx` — add a `My licences` link button to `/portal/licences`.

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

**Planner-authored copy; reuse billing table/chip styling (copy the needed rules into `licences.css`).**
Hero: eyebrow `Products`, h1 `Your Licences`, p `Licence keys and downloads for the tools you have purchased. Updates are included for twelve months from purchase.`
Table (`DataTable`): `Product`, `Licence key` (monospace, masked as `VV-XXXX-••••-••••-XXXX` with a `Reveal` toggle and `Copy` button → toast `Licence key copied`), `Granted`, `Updates until` (chip `Active` or `Expired` by date), `Action` (`Download` → `POST /entitlements/:id/download-url`, then `window.location.assign(url)`; `409 not_available` → toast `{ kind: "warn", title: "Download not available yet", message: "The archive for this product has not been published. We will email you when it is ready." }`). Empty state: `No licences yet` / `Purchase a tool from the Products page to see it here.` with a `Browse products` button → `/products`.
**Tests:** rows render; reveal/copy; expired chip; download flow; 409 toast.

---

**Data shape (TypeScript):**
```ts
// EntitlementView: see contracts (Task 40b).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/entitlements → 200 { data: EntitlementView[] }
// POST /api/v1/entitlements/:id/download-url → 200 { data: { url; expiresAt } } | 404 | 409 { error: "not_available" }
```

---

**Out of scope:**
- Do not proxy file bytes.
- Do not edit the portal header/nav.
- Do not show licence keys of other organisations.

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
☐ Report at the end: `Task 73 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 74 — Reserved portal and academy routes (coming-soon pages)

**Layer:** L8

**Prerequisites:** Task 41, Task 44, Task 45

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Reserved portal and academy routes (coming-soon pages)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create minimal, honest placeholder routes for the pages that the navigation links to but that have no prototype yet.

**Deliverables:**
- `apps/web/src/components/coming-soon.tsx` — shared component.
- `apps/web/src/app/(authed)/portal/academy/page.tsx`
- `apps/web/src/app/(authed)/portal/scanner/page.tsx`
- `apps/web/src/app/(marketing)/academy/page.tsx`
- `apps/web/src/app/(marketing)/cookie-policy/page.tsx`, `privacy/page.tsx`, `terms/page.tsx` — legal placeholders.
- `apps/web/src/components/coming-soon.test.tsx`

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

**Planner-authored copy.** `ComingSoon({ eyebrow, title, body, cta? })` renders a centred card (`Eyebrow`, `h1 text-3xl font-extrabold tracking-tight text-ink`, body `text-ink-muted max-w-md`, optional `Button`). Pages:
- `/portal/academy`: eyebrow `Academy`, title `Academy Progress`, body `Your learning tracks and certificates will appear here.`, cta `Browse tracks` → `/academy`.
- `/portal/scanner`: eyebrow `Tools`, title `Free Vulnerability Scanner`, body `Run a quick reconnaissance simulation from the public site, or request a full authorised assessment.`, cta `Open the scanner` → link to `/#free-scanner` (the scanner dialog is mounted in the marketing layout only).
- `/academy` (marketing): eyebrow `Academy`, title `VUNVAULT Academy`, body `Structured, hands-on cyber training with free certificates. Course pages are coming soon.`, cta `Back to home` → `/`.
- `/cookie-policy`, `/privacy`, `/terms`: eyebrow `Legal`, titles `Cookie Policy`, `Privacy Policy`, `Terms of Service`, body `This document is being finalised. Contact info@vunvault.com for a copy.`.
All pages set `metadata` titles accordingly and `robots: { index: false }` for the legal placeholders.
**Tests:** each route renders its title and CTA.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not invent course, scanner or legal content.
- Do not edit headers/footers.

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
☐ Report at the end: `Task 74 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 75 — Admin shared stylesheet and PageHead component

**Layer:** L9

**Prerequisites:** Task 5, Task 8, Task 9, Task 46

**Estimated files touched:** 5

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin shared stylesheet and PageHead component**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the admin surface's shared stylesheet (cards, KPI tiles, tables, badges, buttons, tags, form fields, toasts, modals) and the `AdminPageHead` component every admin page opens with.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/_styles/admin-shared.css` — the reference CSS below, converted to token `var()`s.
- `apps/web/src/app/(authed)/admin/_components/admin-page-head.tsx` — `AdminPageHead`.
- `apps/web/src/app/(authed)/admin/_components/admin-page-head.test.tsx`
- `apps/web/src/app/(authed)/admin/_components/kpi-strip.tsx` — thin wrappers `AdmKpiStrip` / `AdmKpi` that render the reference `adm-kpi*` markup.
- MODIFY `apps/web/src/app/(authed)/admin/layout.tsx` — add `import "./_styles/admin-shared.css";`.

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

**Reference markup (page head + KPI strip as they open every admin page — taken from the Command Center page):**

##### Page head and KPI strip
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Data Analytics Dashboard Overview</span>
   <h1 class="adm-page-title">Administrative Command Center</h1>
   <p class="adm-page-sub">Consolidated operational intelligence across revenue, network load, job throughput and threat posture. All figures refresh from the VUNVAULT sensor mesh and billing ledger.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="adm-initiate-scan">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Initiate System Scan</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="adm-export-audit">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Audit Logs</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="adm-refresh-dashboard">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Metrics</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="adm-kpi-heading">
  <h2 id="adm-kpi-heading" class="sr-only">Key performance indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Total Paid Clients</span>
    <span class="adm-kpi-value">312</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 18 new this month</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Total Revenue ¦ $184,720 ¦ ▲ 12.4% vs. last quarter || Completed Jobs ¦ 1,842 ¦ ▲ 96 closed this week || Pending Review ¦ 37 ¦ ● Awaiting mandatory admin review || Active Running Scans ¦ 12 ¦ ● 12 of 24 worker slots in use || Critical CVEs Tracked ¦ 46 ¦ ▲ 9 unpatched · escalation advised]
  </div>
 </section>
 <section aria-labelledby="adm-revenue-heading" class="adm-grid">
  <div class="adm-card adm-span-4">
   <div class="adm-card-head">
    <div>
     <h2 class="adm-card-title" id="adm-revenue-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Revenue & Paid Scans
     </h2>
     <p class="adm-card-note">Billing ledger rollup for penetration testing packages, retainers and compliance assessments.</p>
    </div>
    <span class="adm-tag adm-tag--ok">Ledger Synced</span>
   </div>
   <div class="adm-card-body">
    <dl class="adm-dl">
     <div class="adm-dl-item">
      <dt>Gross Revenue (YTD)</dt>
      <dd>
       $184,720
       <small>All packages, net of refunds</small>
      </dd>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Revenue This Month ¦ $22,450 ¦ 01 – 24 Sep 2026 || Paid Clients ¦ 312 ¦ 284 SME · 22 SACCO · 6 Enterprise || Average Order Value ¦ $592 ¦ Across all plan tiers]
    </dl>
    <hr class="adm-divider"/>
    <h3 class="adm-kpi-label">Revenue by Package Tier</h3>
    <div class="adm-progress-row">
     <span class="adm-progress-name">
      Starter Scan
      <small>$299 / scan</small>
     </span>
     <progress class="adm-progress" value="41">41%</progress>
     <span class="adm-progress-value">41%</span>
    </div>
    [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: SACCO & Fintech ¦ $899 / assessment ¦ 34% ¦ 34% || Enterprise Retainer ¦ $2,499 / month ¦ 25% ¦ 25%]
    <p class="adm-note">Tier shares are computed on gross revenue for the trailing 90 days.</p>
   </div>
  </div>
  <div class="adm-card adm-span-8">
   <div class="adm-card-head">
    <div>
     <h2 class="adm-card-title">Recent Payment Transactions</h2>
     <p class="adm-card-note">Latest six settled, pending and refunded transactions across M-Pesa, card and bank transfer.</p>
    </div>
    <span class="adm-tag">Last 48 hours</span>
   </div>
   <div class="adm-card-body">
    <div class="adm-table-wrap">
     <table class="adm-table">
      <caption class="sr-only">Recent payment transactions for penetration testing packages</caption>
      <thead>
       <tr>
        <th>Txn ID</th>
        <th>Date (UTC)</th>
        <th>Client</th>
        <th>Package</th>
        <th>Method</th>
        <th class="adm-num">Amount</th>
        <th>Status</th>
       </tr>
      </thead>
      <tbody>
       <tr>
        <td class="adm-mono">VX-90241</td>
        <td class="adm-mono">24 Sep · 09:14</td>
        <td class="adm-strong">Horizon SACCO</td>
        <td>Enterprise Retainer</td>
        <td>M-Pesa</td>
        <td class="adm-num adm-strong">$2,499</td>
        <td>
         <span class="adm-badge adm-badge--settled">Settled</span>
        </td>
       </tr>
       [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: VX-90240 ¦ 24 Sep · 08:02 ¦ Nairobi Fintech Group ¦ SACCO & Fintech Compliance ¦ Card ¦ $899 ¦ Settled || VX-90239 ¦ 23 Sep · 17:41 ¦ Kijani Agri Co-op ¦ Starter Scan ¦ M-Pesa ¦ $299 ¦ Settled || VX-90238 ¦ 23 Sep · 14:20 ¦ Lakeview Logistics ¦ Enterprise Retainer ¦ Bank Transfer ¦ $2,499 ¦ Pending || VX-90237 ¦ 23 Sep · 11:05 ¦ Mwananchi Microfinance ¦ SACCO & Fintech Compliance ¦ M-Pesa ¦ $899 ¦ Settled || VX-90236 ¦ 22 Sep · 19:33 ¦ TechBridge Solutions ¦ Starter Scan ¦ Card ¦ $299 ¦ Refunded]
      </tbody>
      <tfoot>
       <tr>
        <td>Total across displayed transactions</td>
        <td class="adm-num">$7,394</td>
        <td>5 settled · 1 pending · 1 refunded</td>
       </tr>
      </tfoot>
     </table>
    </div>
    <div class="adm-card-body">
     <div class="adm-inline-actions">
      <button type="button" class="adm-mini-btn">Reconcile Ledger</button>
      <button type="button" class="adm-mini-btn">Download CSV</button>
      <button type="button" class="adm-mini-btn">Issue Refund</button>
     </div>
    </div>
   </div>
  </div>
 </section>
 [+3 more sibling <section> elements with the SAME structure as the one above; their text content in order: Traffic & Network Load ¦ Incoming site sessions, API request volume and per-endpoint latency across the edge tier. ¦ Rolling 24h ¦ Site Sessions ¦ 48,392 ¦ ▲ 6.2% day over day ¦ API Requests ¦ 2.14M ¦ Across 41 endpoints ¦ Avg. Response ¦ 142 ¦ ms · p95 384 ms ¦ Hourly API Request Volume (millions) ¦ Peak 00:00 UTC · 0.31M ¦ 0.31 ¦ 00h ¦ [+6 more sibling <div> elements with the SAME structure as the one above; their text content in order: 0.22 ¦ 04h || 0.29 ¦ 08h || 0.27 ¦ 12h || 0.24 ¦ 16h || 0.21 ¦ 20h || 0.30 ¦ 24h] ¦ Top Endpoints by Load ¦ Request distribution, mean latency and error ratio. ¦ Top API endpoints by request volume ¦ Endpoint ¦ Requests ¦ Latency ¦ Errors ¦ /api/v1/scan/submit ¦ 412,880 ¦ 168 ms ¦ 0.21% ¦ [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: /api/v1/auth/token ¦ 388,214 ¦ 92 ms ¦ 0.08% || /api/v1/report/export ¦ 121,540 ¦ 431 ms ¦ 0.64% || /api/v1/cve/feed ¦ 96,772 ¦ 74 ms ¦ 0.02% || /api/v1/nodes/heartbeat ¦ 84,318 ¦ 41 ms ¦ 0.01% || /admin (dashboard) ¦ 51,204 ¦ 210 ms ¦ 0.33%] ¦ Aggregate ¦ 1,154,928 ¦ 169 ms ¦ 0.22% ¦ Sensor Node Load Distribution ¦ Real-time worker saturation per regional reconnaissance node. Values above 85% trigger autoscaling. ¦ 412 / 412 online ¦ node-nbo-01 ¦ Nairobi Core · 41,200 req/min ¦ 62% ¦ 62% ¦ [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: node-nbo-02 ¦ Nairobi Edge · 28,940 req/min ¦ 48% ¦ 48% || node-acc-01 ¦ Accra Relay · 36,410 req/min ¦ 88% ¦ 88% || node-lag-01 ¦ Lagos Relay · 31,880 req/min ¦ 55% ¦ 55% || node-jnb-01 ¦ Johannesburg Vault · 19,220 req/min ¦ 33% ¦ 33% || node-fra-01 ¦ Frankfurt Mirror · 44,600 req/min ¦ 79% ¦ 79%] ¦ Node load is sampled every 15 seconds from the heartbeat mesh and averaged over a 5-minute window. || Job Progress & Status ¦ Throughput barometer across the scan pipeline, including jobs blocked on mandatory admin review. ¦ 37 Awaiting Review ¦ Completed Jobs ¦ 1,842 ¦ 96 closed in the last 7 days ¦ Pending Jobs ¦ 96 ¦ Queued, not yet assigned ¦ Unreviewed Jobs ¦ 37 ¦ Admin review required before release ¦ Active Running Scans ¦ 12 ¦ 12 of 24 worker slots occupied ¦ Pipeline Distribution ¦ Completed ¦ 1,842 jobs ¦ 93% ¦ 93% ¦ [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Pending ¦ 96 jobs ¦ 5% ¦ 5% || Unreviewed ¦ 37 jobs ¦ 2% ¦ 2% || Running ¦ 12 jobs ¦ 1% ¦ 1%] ¦ Unreviewed jobs are held for a maximum of 72 hours before automatic escalation to the on-call lead. ¦ Active Running Scans Monitor ¦ Live worker telemetry for every scan currently executing on the VUNVAULT engine. ¦ 12 Active ¦ Currently running penetration test scans ¦ Job ID ¦ Target ¦ Type ¦ Analyst ¦ Progress ¦ ETA ¦ JOB-4471 ¦ api.horizonsacco.co.ke ¦ External ¦ e.reed ¦ 78% ¦ 4m 12s ¦ [+4 more sibling <tr> elements with the SAME structure as the one above; their text content in order: JOB-4470 ¦ pay.nairobifintech.com ¦ API ¦ a.njoroge ¦ 64% ¦ 7m 38s || JOB-4469 ¦ vault.lakeviewlogistics.com ¦ Internal ¦ d.mwangi ¦ 41% ¦ 13m 05s || JOB-4468 ¦ 10.24.8.0/24 ¦ Network ¦ b.otieno ¦ 89% ¦ 1m 47s || JOB-4467 ¦ mobile.mwananchi.co.ke ¦ Mobile ¦ f.hassan ¦ 22% ¦ 18m 30s] ¦ Showing 5 of 12 active jobs · 7 more running on the secondary worker pool ¦ Open Scan Queue ¦ Pause All Workers ¦ Assign Reviewer || Zero-Day Threat Level ¦ Composite index derived from weaponisation status, exploit availability and patch coverage. ¦ Elevated ¦ Current Level ¦ LEVEL 4 / 5 ¦ Low ¦ Guarded ¦ Elevated ¦ High ¦ Severe ¦ Critical CVEs Tracked ¦ 46 ¦ 9 currently unpatched ¦ Total Active Zero-Days ¦ 1,284 ¦ ▲ 62 this week ¦ Weaponized in the Wild ¦ 37 ¦ Active exploitation confirmed ¦ Threats Blocked (YTD) ¦ 12,904 ¦ Perimeter + endpoint sensors ¦ Threat level is recalculated hourly. A level of 4 or above triggers automatic escalation to the incident commander on duty. ¦ Sensor Node Network Connectivity ¦ Connectivity, heartbeat latency and clock drift for each regional sensor node in the mesh. ¦ 412 / 412 Online ¦ node-nbo-01 ¦ Nairobi Core · Kenya ¦ Heartbeat ¦ 18 ms ¦ Clock Drift ¦ ±2 ms ¦ Operational ¦ [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: node-nbo-02 ¦ Nairobi Edge · Kenya ¦ Heartbeat ¦ 24 ms ¦ Clock Drift ¦ ±3 ms ¦ Operational || node-acc-01 ¦ Accra Relay · Ghana ¦ Heartbeat ¦ 142 ms ¦ Clock Drift ¦ ±11 ms ¦ High Load || node-lag-01 ¦ Lagos Relay · Nigeria ¦ Heartbeat ¦ 96 ms ¦ Clock Drift ¦ ±5 ms ¦ Operational || node-jnb-01 ¦ Johannesburg Vault · South Africa ¦ Heartbeat ¦ 112 ms ¦ Clock Drift ¦ ±4 ms ¦ Operational || node-fra-01 ¦ Frankfurt Mirror · Germany ¦ Heartbeat ¦ 38 ms ¦ Clock Drift ¦ ±19 ms ¦ Drift Warning] ¦ Threats Blocked — Last 7 Days ¦ Total 12,904 ¦ 1,640 ¦ Mon ¦ [+6 more sibling <div> elements with the SAME structure as the one above; their text content in order: 1,982 ¦ Tue || 1,410 ¦ Wed || 2,240 ¦ Thu || 1,880 ¦ Fri || 1,502 ¦ Sat || 2,250 ¦ Sun] ¦ Connectivity is confirmed by a signed heartbeat every 15 seconds. Two consecutive misses mark a node as degraded; three mark it offline.]
</div>
```

`AdminPageHead({ eyebrow, title, description, actions })` renders `.adm-page-head` with the eyebrow (`Eyebrow`), `h1.adm-h1`, description `p.adm-lede` and a right-aligned actions slot. `AdmKpi({ label, value, unit?, delta?: { tone: "up"|"dot"|"down"|"warn"; text } })` renders the `adm-kpi` tile (value in monospace; same visual as `KpiCard` of Task 9 — if the markup's classes differ, the CSS below wins).

**Shared CSS (complete; every class the admin pages use that is not part of the Task 46 chrome). Convert to `var(--token)` where a token exists; keep the rest:**
```css
body.adm-body { background: radial-gradient(90% 42% at 50% 0%, rgba(59, 153, 252, 0.07), transparent 62%), var(--paper); }
.adm-main { flex: 1 1 auto; padding: 28px 0 64px; }
.adm-page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; padding-bottom: 22px; margin-bottom: 26px; border-bottom: 1px solid var(--line-soft); }
.adm-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); }
.adm-eyebrow::before { content: ""; width: 22px; height: 2px; border-radius: 2px; background: var(--brand); }
.adm-page-title { margin-top: 10px; font-size: clamp(1.6rem, 3.2vw, 2.3rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--ink); }
.adm-page-sub { margin-top: 8px; max-width: 70ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.adm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 20px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; transition: transform 0.2s var(--ease), filter 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease), border-color 0.2s var(--ease), color 0.2s var(--ease); }
.adm-btn:active { transform: translateY(1px) scale(0.985); }
.adm-btn-primary { color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.24); }
.adm-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 40px -18px var(--brand-glow); }
.adm-btn-ghost { color: var(--ink); background: #ffffff; border-color: var(--line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.adm-btn-ghost:hover { transform: translateY(-2px); border-color: var(--brand-line); color: var(--brand-strong); box-shadow: 0 14px 30px -20px var(--brand-glow); }
.adm-btn-dark { color: #ffffff; background: linear-gradient(135deg, var(--dark), #05070a); border-color: rgba(59, 153, 252, 0.32); }
.adm-btn-dark:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: 0 18px 34px -20px var(--brand-glow); }
.adm-btn svg { flex: 0 0 auto; }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 30px; }
@media (max-width: 1380px) {
.adm-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
.adm-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 460px) {
.adm-kpi-grid { grid-template-columns: 1fr; }
}
.adm-kpi { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 7px; padding: 18px 18px 16px; border-radius: 16px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 12px 30px -26px rgba(10, 13, 18, 0.5); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.adm-kpi::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.75; }
.adm-kpi:hover { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 44px -30px var(--brand-glow); }
.adm-kpi-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.adm-kpi-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: clamp(1.5rem, 2.6vw, 1.95rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1; color: var(--ink); }
.adm-kpi-value small { font-size: 0.62em; font-weight: 700; color: var(--ink-muted); margin-left: 2px; }
.adm-kpi-delta { font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.adm-kpi-delta--up { color: #047857; }
.adm-kpi-delta--down { color: #be123c; }
.adm-kpi-delta--warn { color: #b45309; }
.adm-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; margin-bottom: 20px; }
.adm-card { grid-column: span 12; display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card--dark { background: radial-gradient(80% 120% at 100% 0%, rgba(59, 153, 252, 0.16), transparent 62%), linear-gradient(160deg, var(--dark) 0%, #070b11 100%); border-color: rgba(59, 153, 252, 0.26); box-shadow: 0 26px 56px -34px rgba(0, 0, 0, 0.7); color: #ffffff; }
@media (min-width: 1080px) {
.adm-span-4 { grid-column: span 4; }
.adm-span-5 { grid-column: span 5; }
.adm-span-6 { grid-column: span 6; }
.adm-span-7 { grid-column: span 7; }
.adm-span-8 { grid-column: span 8; }
.adm-span-12 { grid-column: span 12; }
}
.adm-card-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 20px 22px 16px; border-bottom: 1px solid var(--line-soft); }
.adm-card--dark .adm-card-head { border-bottom-color: rgba(255, 255, 255, 0.08); }
.adm-card-title { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); }
.adm-card--dark .adm-card-title { color: #ffffff; }
.adm-card-title svg { color: var(--brand); flex: 0 0 auto; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 62ch; }
.adm-card--dark .adm-card-note { color: #93a2b5; }
.adm-card-body { flex: 1 1 auto; padding: 20px 22px 24px; }
.adm-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.adm-tag--ok { color: #047857; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.35); }
.adm-tag--warn { color: #b45309; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.35); }
.adm-tag--crit { color: #be123c; background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.35); }
.adm-card--dark .adm-tag { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
.adm-dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; margin: 0; }
.adm-dl--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 700px) {
.adm-dl, .adm-dl--3 { grid-template-columns: 1fr; }
}
.adm-dl-item { padding: 14px 16px; border-radius: 13px; background: #f8fafc; border: 1px solid var(--line-soft); }
.adm-card--dark .adm-dl-item { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.08); }
.adm-dl dt { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .adm-dl dt { color: #7d8b9e; }
.adm-dl dd { margin: 7px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.28rem; font-weight: 800; letter-spacing: -0.03em; color: var(--ink); }
.adm-card--dark .adm-dl dd { color: #ffffff; }
.adm-dl dd small { display: block; margin-top: 4px; font-family: "Inter", system-ui, sans-serif; font-size: 10.5px; font-weight: 600; letter-spacing: 0; color: var(--ink-muted); }
.adm-card--dark .adm-dl dd small { color: #8b98a9; }
.adm-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.adm-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 0.78rem; }
.adm-table thead th { position: sticky; top: 0; z-index: 2; padding: 12px 16px; text-align: left; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); background: #f6f8fb; border-bottom: 1px solid var(--line); white-space: nowrap; }
.adm-card--dark .adm-table thead th { color: #b7c4d4; background: rgba(255, 255, 255, 0.04); border-bottom-color: rgba(59, 153, 252, 0.22); }
.adm-table tbody td { padding: 13px 16px; vertical-align: middle; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.adm-card--dark .adm-table tbody td { color: #cbd5e1; border-bottom-color: rgba(255, 255, 255, 0.07); }
.adm-table tbody tr:nth-child(even) { background: #fbfcfd; }
.adm-card--dark .adm-table tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
.adm-table tbody tr { transition: background-color var(--dur) var(--ease); }
.adm-table tbody tr:hover { background: var(--brand-tint); }
.adm-card--dark .adm-table tbody tr:hover { background: rgba(59, 153, 252, 0.12); }
.adm-table tfoot td { padding: 13px 16px; font-size: 0.76rem; font-weight: 800; color: var(--ink); background: #f6f8fb; border-top: 1px solid var(--line); }
.adm-card--dark .adm-table tfoot td { color: #ffffff; background: rgba(255, 255, 255, 0.05); border-top-color: rgba(59, 153, 252, 0.22); }
.adm-num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.adm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 700; letter-spacing: -0.01em; }
.adm-strong { font-weight: 800; }
.adm-badge { display: inline-block; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.adm-badge--settled { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.adm-badge--pending { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.adm-badge--refunded { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.adm-badge--ok { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.adm-badge--warn { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.adm-badge--crit { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.adm-badge--info { color: var(--brand-strong); background: var(--brand-tint); border-color: var(--brand-line); }
.adm-card--dark .adm-badge--info { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
.adm-figure { margin: 0; padding: 18px 18px 14px; border-radius: 14px; background: #f8fafc; border: 1px solid var(--line-soft); }
.adm-card--dark .adm-figure { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.08); }
.adm-figcaption { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.adm-card--dark .adm-figcaption { color: #93a2b5; }
.adm-figcaption span:last-child { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.04em; color: var(--brand-strong); }
.adm-card--dark .adm-figcaption span:last-child { color: var(--brand-soft); }
.adm-bars { display: flex; align-items: flex-end; gap: clamp(6px, 1.4vw, 14px); height: 190px; padding-top: 6px; }
.adm-bar-col { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; height: 100%; min-width: 0; }
.adm-bar-track { position: relative; width: 100%; height: 100%; display: flex; align-items: flex-end; border-radius: 8px 8px 4px 4px; background: rgba(59, 153, 252, 0.06); overflow: hidden; }
.adm-card--dark .adm-bar-track { background: rgba(255, 255, 255, 0.05); }
.adm-bar-fill { display: block; width: 100%; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, var(--brand-soft), var(--brand-strong)); box-shadow: 0 0 18px -6px var(--brand-glow); transition: height 0.6s var(--ease); }
.adm-bar-fill--alt { background: linear-gradient(180deg, #34d399, #059669); box-shadow: 0 0 18px -6px rgba(16, 185, 129, 0.5); }
.adm-bar-label { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; font-weight: 700; color: var(--ink-muted); white-space: nowrap; }
.adm-card--dark .adm-bar-label { color: #7d8b9e; }
.adm-bar-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; color: var(--ink); }
.adm-card--dark .adm-bar-value { color: #ffffff; }
.adm-progress-row { display: grid; grid-template-columns: minmax(120px, 1.4fr) minmax(80px, 3fr) auto; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px dashed var(--line-soft); }
.adm-progress-row:last-child { border-bottom: 0; }
.adm-card--dark .adm-progress-row { border-bottom-color: rgba(255, 255, 255, 0.08); }
.adm-progress-name { font-size: 0.76rem; font-weight: 700; color: var(--ink); }
.adm-card--dark .adm-progress-name { color: #e2e8f0; }
.adm-progress-name small { display: block; margin-top: 2px; font-size: 9.5px; font-weight: 600; color: var(--ink-faint); }
.adm-card--dark .adm-progress-name small { color: #7d8b9e; }
.adm-progress-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 800; color: var(--brand-strong); min-width: 44px; text-align: right; }
.adm-card--dark .adm-progress-value { color: var(--brand-soft); }
progress.adm-progress { appearance: none; -webkit-appearance: none; width: 100%; height: 8px; border: 0; border-radius: var(--r-full); overflow: hidden; background: rgba(59, 153, 252, 0.12); display: block; }
progress.adm-progress::-webkit-progress-bar { background: rgba(59, 153, 252, 0.12); border-radius: var(--r-full); }
progress.adm-progress::-webkit-progress-value { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
progress.adm-progress::-moz-progress-bar { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
progress.adm-progress--warn::-webkit-progress-value { background: linear-gradient(90deg, #d97706, #fbbf24); }
progress.adm-progress--warn::-moz-progress-bar { background: linear-gradient(90deg, #d97706, #fbbf24); }
progress.adm-progress--crit::-webkit-progress-value { background: linear-gradient(90deg, #be123c, #fb7185); }
progress.adm-progress--crit::-moz-progress-bar { background: linear-gradient(90deg, #be123c, #fb7185); }
progress.adm-progress--ok::-webkit-progress-value { background: linear-gradient(90deg, #047857, #34d399); }
progress.adm-progress--ok::-moz-progress-bar { background: linear-gradient(90deg, #047857, #34d399); }
.adm-card--dark progress.adm-progress,
      .adm-card--dark progress.adm-progress::-webkit-progress-bar { background: rgba(255, 255, 255, 0.09); }
.adm-threat { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 14px; background: linear-gradient(160deg, rgba(244, 63, 94, 0.08), rgba(245, 158, 11, 0.05)); border: 1px solid rgba(244, 63, 94, 0.22); }
.adm-threat-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.adm-threat-level { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.06em; color: #be123c; }
.adm-threat-scale { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.adm-threat-step { height: 10px; border-radius: var(--r-full); background: var(--line); transition: background-color var(--dur) var(--ease); }
.adm-threat-step.is-1 { background: #34d399; }
.adm-threat-step.is-2 { background: #a3e635; }
.adm-threat-step.is-3 { background: #fbbf24; }
.adm-threat-step.is-4 { background: #f97316; }
.adm-threat-step.is-5 { background: var(--critical); box-shadow: 0 0 14px -4px rgba(244, 63, 94, 0.8); }
.adm-threat-legend { display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
.adm-node-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 900px) {
.adm-node-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
.adm-node-grid { grid-template-columns: 1fr; }
}
.adm-node { display: flex; flex-direction: column; gap: 8px; padding: 14px 15px; border-radius: 13px; background: #f8fafc; border: 1px solid var(--line-soft); transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease); }
.adm-node:hover { transform: translateY(-2px); border-color: var(--brand-line); }
.adm-card--dark .adm-node { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.08); }
.adm-card--dark .adm-node:hover { border-color: rgba(59, 153, 252, 0.45); }
.adm-node-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.adm-node-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .adm-node-id { color: #e2e8f0; }
.adm-node-region { font-size: 10px; font-weight: 600; color: var(--ink-muted); }
.adm-card--dark .adm-node-region { color: #8b98a9; }
.adm-node-metric { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); }
.adm-card--dark .adm-node-metric { color: #93a2b5; }
.adm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.adm-dot--ok { background: var(--ok); box-shadow: 0 0 10px -2px rgba(16, 185, 129, 0.9); }
.adm-dot--warn { background: var(--high); box-shadow: 0 0 10px -2px rgba(245, 158, 11, 0.9); }
.adm-dot--crit { background: var(--critical); box-shadow: 0 0 10px -2px rgba(244, 63, 94, 0.9); }
.adm-divider { height: 1px; margin: 18px 0; background: var(--line-soft); border: 0; }
.adm-card--dark .adm-divider { background: rgba(255, 255, 255, 0.08); }
.adm-note { margin-top: 16px; font-size: 10.5px; line-height: 1.7; color: var(--ink-faint); }
.adm-card--dark .adm-note { color: #64748b; }
.adm-inline-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.adm-mini-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; font-size: 0.72rem; font-weight: 800; border-radius: var(--r-full); cursor: pointer; color: var(--ink); background: #ffffff; border: 1px solid var(--line); transition: all 0.2s var(--ease); }
.adm-mini-btn:hover { transform: translateY(-1px); color: var(--brand-strong); border-color: var(--brand-line); box-shadow: 0 12px 24px -18px var(--brand-glow); }
.adm-card--dark .adm-mini-btn { color: #cbd5e1; background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.12); }
.adm-card--dark .adm-mini-btn:hover { color: #ffffff; border-color: rgba(59, 153, 252, 0.5); background: rgba(59, 153, 252, 0.12); }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .adm-node, .adm-mini-btn, .adm-bar-fill { transition-duration: 0.001ms !important; transform: none !important; }
}
@media print {
body.adm-body { background: #ffffff; }
.adm-card, .adm-kpi { box-shadow: none; border-color: #cccccc; }
}
```
**Tests:** page head renders eyebrow/title/description verbatim and an actions slot; KPI tile renders a value with a unit and delta tone classes.

---

**Data shape (TypeScript):**
N/A — presentational.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not build any page.
- Do not edit the Task 46 chrome stylesheet.

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
☐ Report at the end: `Task 75 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 76 — Admin Command Center dashboard

**Layer:** L9

**Prerequisites:** Task 37, Task 46, Task 75, Task 12

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Command Center dashboard**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin`: KPI strip, revenue and transactions, platform traffic, sensor nodes, pipeline and running scans, and the zero-day threat level — all on the dashboard API with a Refresh Metrics control.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/page.tsx`
- `apps/web/src/app/(authed)/admin/_dashboard/kpis.tsx`, `revenue-panel.tsx`, `transactions-table.tsx`, `traffic-panel.tsx`, `endpoints-table.tsx`, `nodes-panel.tsx`, `pipeline-panel.tsx`, `running-scans.tsx`, `threat-level.tsx`
- `apps/web/src/app/(authed)/admin/_dashboard/use-dashboard.ts`
- `apps/web/src/app/(authed)/admin/_dashboard/dashboard.css`
- `apps/web/src/mocks/handlers/dashboard.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/_dashboard/dashboard.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:**

##### Command Center page body (grids compressed; the bracketed notes list repeated rows)
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Data Analytics Dashboard Overview</span>
   <h1 class="adm-page-title">Administrative Command Center</h1>
   <p class="adm-page-sub">Consolidated operational intelligence across revenue, network load, job throughput and threat posture. All figures refresh from the VUNVAULT sensor mesh and billing ledger.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="adm-initiate-scan">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Initiate System Scan</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="adm-export-audit">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Audit Logs</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="adm-refresh-dashboard">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Metrics</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="adm-kpi-heading">
  <h2 id="adm-kpi-heading" class="sr-only">Key performance indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Total Paid Clients</span>
    <span class="adm-kpi-value">312</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 18 new this month</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Total Revenue ¦ $184,720 ¦ ▲ 12.4% vs. last quarter || Completed Jobs ¦ 1,842 ¦ ▲ 96 closed this week || Pending Review ¦ 37 ¦ ● Awaiting mandatory admin review || Active Running Scans ¦ 12 ¦ ● 12 of 24 worker slots in use || Critical CVEs Tracked ¦ 46 ¦ ▲ 9 unpatched · escalation advised]
  </div>
 </section>
 <section aria-labelledby="adm-revenue-heading" class="adm-grid">
  <div class="adm-card adm-span-4">
   <div class="adm-card-head">
    <div>
     <h2 class="adm-card-title" id="adm-revenue-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Revenue & Paid Scans
     </h2>
     <p class="adm-card-note">Billing ledger rollup for penetration testing packages, retainers and compliance assessments.</p>
    </div>
    <span class="adm-tag adm-tag--ok">Ledger Synced</span>
   </div>
   <div class="adm-card-body">
    <dl class="adm-dl">
     <div class="adm-dl-item">
      <dt>Gross Revenue (YTD)</dt>
      <dd>
       $184,720
       <small>All packages, net of refunds</small>
      </dd>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Revenue This Month ¦ $22,450 ¦ 01 – 24 Sep 2026 || Paid Clients ¦ 312 ¦ 284 SME · 22 SACCO · 6 Enterprise || Average Order Value ¦ $592 ¦ Across all plan tiers]
    </dl>
    <hr class="adm-divider"/>
    <h3 class="adm-kpi-label">Revenue by Package Tier</h3>
    <div class="adm-progress-row">
     <span class="adm-progress-name">
      Starter Scan
      <small>$299 / scan</small>
     </span>
     <progress class="adm-progress" value="41">41%</progress>
     <span class="adm-progress-value">41%</span>
    </div>
    [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: SACCO & Fintech ¦ $899 / assessment ¦ 34% ¦ 34% || Enterprise Retainer ¦ $2,499 / month ¦ 25% ¦ 25%]
    <p class="adm-note">Tier shares are computed on gross revenue for the trailing 90 days.</p>
   </div>
  </div>
  <div class="adm-card adm-span-8">
   <div class="adm-card-head">
    <div>
     <h2 class="adm-card-title">Recent Payment Transactions</h2>
     <p class="adm-card-note">Latest six settled, pending and refunded transactions across M-Pesa, card and bank transfer.</p>
    </div>
    <span class="adm-tag">Last 48 hours</span>
   </div>
   <div class="adm-card-body">
    <div class="adm-table-wrap">
     <table class="adm-table">
      <caption class="sr-only">Recent payment transactions for penetration testing packages</caption>
      <thead>
       <tr>
        <th>Txn ID</th>
        <th>Date (UTC)</th>
        <th>Client</th>
        <th>Package</th>
        <th>Method</th>
        <th class="adm-num">Amount</th>
        <th>Status</th>
       </tr>
      </thead>
      <tbody>
       <tr>
        <td class="adm-mono">VX-90241</td>
        <td class="adm-mono">24 Sep · 09:14</td>
        <td class="adm-strong">Horizon SACCO</td>
        <td>Enterprise Retainer</td>
        <td>M-Pesa</td>
        <td class="adm-num adm-strong">$2,499</td>
        <td>
         <span class="adm-badge adm-badge--settled">Settled</span>
        </td>
       </tr>
       [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: VX-90240 ¦ 24 Sep · 08:02 ¦ Nairobi Fintech Group ¦ SACCO & Fintech Compliance ¦ Card ¦ $899 ¦ Settled || VX-90239 ¦ 23 Sep · 17:41 ¦ Kijani Agri Co-op ¦ Starter Scan ¦ M-Pesa ¦ $299 ¦ Settled || VX-90238 ¦ 23 Sep · 14:20 ¦ Lakeview Logistics ¦ Enterprise Retainer ¦ Bank Transfer ¦ $2,499 ¦ Pending || VX-90237 ¦ 23 Sep · 11:05 ¦ Mwananchi Microfinance ¦ SACCO & Fintech Compliance ¦ M-Pesa ¦ $899 ¦ Settled || VX-90236 ¦ 22 Sep · 19:33 ¦ TechBridge Solutions ¦ Starter Scan ¦ Card ¦ $299 ¦ Refunded]
      </tbody>
      <tfoot>
       <tr>
        <td>Total across displayed transactions</td>
        <td class="adm-num">$7,394</td>
        <td>5 settled · 1 pending · 1 refunded</td>
       </tr>
      </tfoot>
     </table>
    </div>
    <div class="adm-card-body">
     <div class="adm-inline-actions">
      <button type="button" class="adm-mini-btn">Reconcile Ledger</button>
      <button type="button" class="adm-mini-btn">Download CSV</button>
      <button type="button" class="adm-mini-btn">Issue Refund</button>
     </div>
    </div>
   </div>
  </div>
 </section>
 [+3 more sibling <section> elements with the SAME structure as the one above; their text content in order: Traffic & Network Load ¦ Incoming site sessions, API request volume and per-endpoint latency across the edge tier. ¦ Rolling 24h ¦ Site Sessions ¦ 48,392 ¦ ▲ 6.2% day over day ¦ API Requests ¦ 2.14M ¦ Across 41 endpoints ¦ Avg. Response ¦ 142 ¦ ms · p95 384 ms ¦ Hourly API Request Volume (millions) ¦ Peak 00:00 UTC · 0.31M ¦ 0.31 ¦ 00h ¦ [+6 more sibling <div> elements with the SAME structure as the one above; their text content in order: 0.22 ¦ 04h || 0.29 ¦ 08h || 0.27 ¦ 12h || 0.24 ¦ 16h || 0.21 ¦ 20h || 0.30 ¦ 24h] ¦ Top Endpoints by Load ¦ Request distribution, mean latency and error ratio. ¦ Top API endpoints by request volume ¦ Endpoint ¦ Requests ¦ Latency ¦ Errors ¦ /api/v1/scan/submit ¦ 412,880 ¦ 168 ms ¦ 0.21% ¦ [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: /api/v1/auth/token ¦ 388,214 ¦ 92 ms ¦ 0.08% || /api/v1/report/export ¦ 121,540 ¦ 431 ms ¦ 0.64% || /api/v1/cve/feed ¦ 96,772 ¦ 74 ms ¦ 0.02% || /api/v1/nodes/heartbeat ¦ 84,318 ¦ 41 ms ¦ 0.01% || /admin (dashboard) ¦ 51,204 ¦ 210 ms ¦ 0.33%] ¦ Aggregate ¦ 1,154,928 ¦ 169 ms ¦ 0.22% ¦ Sensor Node Load Distribution ¦ Real-time worker saturation per regional reconnaissance node. Values above 85% trigger autoscaling. ¦ 412 / 412 online ¦ node-nbo-01 ¦ Nairobi Core · 41,200 req/min ¦ 62% ¦ 62% ¦ [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: node-nbo-02 ¦ Nairobi Edge · 28,940 req/min ¦ 48% ¦ 48% || node-acc-01 ¦ Accra Relay · 36,410 req/min ¦ 88% ¦ 88% || node-lag-01 ¦ Lagos Relay · 31,880 req/min ¦ 55% ¦ 55% || node-jnb-01 ¦ Johannesburg Vault · 19,220 req/min ¦ 33% ¦ 33% || node-fra-01 ¦ Frankfurt Mirror · 44,600 req/min ¦ 79% ¦ 79%] ¦ Node load is sampled every 15 seconds from the heartbeat mesh and averaged over a 5-minute window. || Job Progress & Status ¦ Throughput barometer across the scan pipeline, including jobs blocked on mandatory admin review. ¦ 37 Awaiting Review ¦ Completed Jobs ¦ 1,842 ¦ 96 closed in the last 7 days ¦ Pending Jobs ¦ 96 ¦ Queued, not yet assigned ¦ Unreviewed Jobs ¦ 37 ¦ Admin review required before release ¦ Active Running Scans ¦ 12 ¦ 12 of 24 worker slots occupied ¦ Pipeline Distribution ¦ Completed ¦ 1,842 jobs ¦ 93% ¦ 93% ¦ [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Pending ¦ 96 jobs ¦ 5% ¦ 5% || Unreviewed ¦ 37 jobs ¦ 2% ¦ 2% || Running ¦ 12 jobs ¦ 1% ¦ 1%] ¦ Unreviewed jobs are held for a maximum of 72 hours before automatic escalation to the on-call lead. ¦ Active Running Scans Monitor ¦ Live worker telemetry for every scan currently executing on the VUNVAULT engine. ¦ 12 Active ¦ Currently running penetration test scans ¦ Job ID ¦ Target ¦ Type ¦ Analyst ¦ Progress ¦ ETA ¦ JOB-4471 ¦ api.horizonsacco.co.ke ¦ External ¦ e.reed ¦ 78% ¦ 4m 12s ¦ [+4 more sibling <tr> elements with the SAME structure as the one above; their text content in order: JOB-4470 ¦ pay.nairobifintech.com ¦ API ¦ a.njoroge ¦ 64% ¦ 7m 38s || JOB-4469 ¦ vault.lakeviewlogistics.com ¦ Internal ¦ d.mwangi ¦ 41% ¦ 13m 05s || JOB-4468 ¦ 10.24.8.0/24 ¦ Network ¦ b.otieno ¦ 89% ¦ 1m 47s || JOB-4467 ¦ mobile.mwananchi.co.ke ¦ Mobile ¦ f.hassan ¦ 22% ¦ 18m 30s] ¦ Showing 5 of 12 active jobs · 7 more running on the secondary worker pool ¦ Open Scan Queue ¦ Pause All Workers ¦ Assign Reviewer || Zero-Day Threat Level ¦ Composite index derived from weaponisation status, exploit availability and patch coverage. ¦ Elevated ¦ Current Level ¦ LEVEL 4 / 5 ¦ Low ¦ Guarded ¦ Elevated ¦ High ¦ Severe ¦ Critical CVEs Tracked ¦ 46 ¦ 9 currently unpatched ¦ Total Active Zero-Days ¦ 1,284 ¦ ▲ 62 this week ¦ Weaponized in the Wild ¦ 37 ¦ Active exploitation confirmed ¦ Threats Blocked (YTD) ¦ 12,904 ¦ Perimeter + endpoint sensors ¦ Threat level is recalculated hourly. A level of 4 or above triggers automatic escalation to the incident commander on duty. ¦ Sensor Node Network Connectivity ¦ Connectivity, heartbeat latency and clock drift for each regional sensor node in the mesh. ¦ 412 / 412 Online ¦ node-nbo-01 ¦ Nairobi Core · Kenya ¦ Heartbeat ¦ 18 ms ¦ Clock Drift ¦ ±2 ms ¦ Operational ¦ [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: node-nbo-02 ¦ Nairobi Edge · Kenya ¦ Heartbeat ¦ 24 ms ¦ Clock Drift ¦ ±3 ms ¦ Operational || node-acc-01 ¦ Accra Relay · Ghana ¦ Heartbeat ¦ 142 ms ¦ Clock Drift ¦ ±11 ms ¦ High Load || node-lag-01 ¦ Lagos Relay · Nigeria ¦ Heartbeat ¦ 96 ms ¦ Clock Drift ¦ ±5 ms ¦ Operational || node-jnb-01 ¦ Johannesburg Vault · South Africa ¦ Heartbeat ¦ 112 ms ¦ Clock Drift ¦ ±4 ms ¦ Operational || node-fra-01 ¦ Frankfurt Mirror · Germany ¦ Heartbeat ¦ 38 ms ¦ Clock Drift ¦ ±19 ms ¦ Drift Warning] ¦ Threats Blocked — Last 7 Days ¦ Total 12,904 ¦ 1,640 ¦ Mon ¦ [+6 more sibling <div> elements with the SAME structure as the one above; their text content in order: 1,982 ¦ Tue || 1,410 ¦ Wed || 2,240 ¦ Thu || 1,880 ¦ Fri || 1,502 ¦ Sat || 2,250 ¦ Sun] ¦ Connectivity is confirmed by a signed heartbeat every 15 seconds. Two consecutive misses mark a node as degraded; three mark it offline.]
</div>
```

**Data (all `GET`, permission `dashboard:read`; each section has its own query so a failure degrades only that card, showing `EmptyState` `Metrics unavailable` + a `Retry` button):** `kpis`, `revenue`, `transactions?limit=6`, `traffic`, `endpoints`, `nodes`, `pipeline`, `running-scans?limit=5`, `threat-level` (see contracts Task 20d). Map fields to the markup exactly as the fixtures document: KPI tiles (`Total Paid Clients`, `Total Revenue` via `formatUsd`, `Completed Jobs`, `Pending Review`, `Active Running Scans` with `workerSlotsUsed/workerSlotsTotal`, `Critical CVEs Tracked` + `unpatchedCritical`); revenue breakdown (`paidClients` SME/SACCO/Enterprise, `tiers` bars with `sharePercent`, AOV); transactions table (`txnCode` `VX-90241`, client, package, method chip `M-Pesa|Card|Bank transfer`, amount, status chip `Settled|Pending|Refunded`, timestamps in UTC `DD Mon HH:MM`); traffic (sessions, API requests, avg/p95 ms, the 7-point hourly bar chart drawn with CSS/SVG — NO charting library); endpoints table; node cards with status chips (`NODE_STATUS_LABELS`), load bar and heartbeat/drift; pipeline donut/segments from `distribution`; running scans with `ProgressBar` and ETA `formatEta`; threat level meter (`level` 1–5, label from `THREAT_LEVEL_LABELS`, escalation note when `level >= 4`: `Escalated to the incident commander on duty.`). Money is USD.
**Refresh Metrics:** button re-fetches every query with `?refresh=1` (the API bypasses its 15 s cache) and toasts `{ kind: "ok", title: "Metrics refreshed", message: "Dashboard data updated at <HH:MM:SS UTC>." }`. Auto-refresh every 30 s while visible.
**Permissions:** a section whose data returns `403` is hidden (not an error). Static fixture values from the prototype (e.g. `$184,720`) must NOT appear in code — everything is API-driven; fixtures live only in MSW handlers.

**Tests:** KPI values and USD formatting from MSW; each panel renders its rows; a 403 hides a panel; Refresh Metrics sends `refresh=1` on all queries; no chart library is imported.

---

**Data shape (TypeScript):**
```ts
// DashboardKpis, RevenueSummary, TransactionsResponse, TrafficSummary, EndpointStat, NodesResponse, PipelineSummary, RunningScansResponse, ThreatLevel: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/dashboard/{kpis|revenue|transactions|traffic|endpoints|nodes|pipeline|running-scans|threat-level}[?refresh=1] → 200 { data } | 403
```

---

**Out of scope:**
- Do not add a charting library.
- Do not hard-code prototype numbers.
- Do not implement alerts or writes.

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
☐ Report at the end: `Task 76 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 77 — Admin Scan Queue: summary, filters, table, bulk actions

**Layer:** L9

**Prerequisites:** Task 35, Task 46, Task 75, Task 12

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Scan Queue: summary, filters, table, bulk actions**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/scan-queue` on the admin scans API: summary tiles, search/filter toolbar, sortable selectable table with ETA/progress/gate/payment state, bulk action bar and the row action menu.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/scan-queue/page.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_components/queue-summary.tsx`, `queue-toolbar.tsx`, `queue-table.tsx`, `bulk-bar.tsx`, `row-actions.tsx`, `gate-badge.tsx`, `payment-chip.tsx`, `queue-footer-card.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_hooks/use-scan-queue.ts`
- `apps/web/src/app/(authed)/admin/scan-queue/_styles/scan-queue.css`
- `apps/web/src/mocks/handlers/admin-scans.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/scan-queue/scan-queue.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup (the review-gate dialog inside this file is Task 78):**

##### Scan Queue page body
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Vulnerability Assessment & Job Queue</span>
   <h1 class="adm-page-title">Scan Queue & Job Assessment</h1>
   <p class="adm-page-sub">Every penetration test, external scan and internal assessment in one queue. Client release is blocked until an administrator clears the Mandatory Admin Review Gate.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="sq-new-job">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>New Scan Request</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="sq-export-queue">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Queue</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="sq-refresh">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="sq-kpi-heading">
  <h2 id="sq-kpi-heading" class="sr-only">Queue summary indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Jobs In Queue</span>
    <span class="adm-kpi-value">96</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 14 added today</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Running Scans ¦ 12 ¦ ● 12 of 24 worker slots || Awaiting Admin Review ¦ 37 ¦ ● Client release blocked || Approved & Released ¦ 1,842 ¦ ▲ 96 released this week || Payment Outstanding ¦ 9 ¦ ▲ 3 overdue > 14 days || Held / Rejected ¦ 5 ¦ ● Pending remediation]
  </div>
 </section>
 <section class="sq-toolbar" aria-labelledby="sq-filter-heading">
  <div class="sq-toolbar-head">
   <h2 class="sq-toolbar-title" id="sq-filter-heading">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Filter & Search Queue
   </h2>
   <span class="sq-results" role="status" aria-live="polite">
    Showing
    <strong id="sq-visible-count">10</strong>
    of
    <strong id="sq-total-count">10</strong>
    jobs
   </span>
  </div>
  <div class="sq-toolbar-grid">
   <div class="sq-field">
    <label class="sq-field-label" for="sq-search">Search</label>
    <div class="sq-input-wrap">
     <span class="sq-input-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <input id="sq-search" class="sq-input" type="search" placeholder="Job ID, target host, client or requester…" autocomplete="off"/>
    </div>
   </div>
   [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Job Status ¦ All statuses ¦ Running ¦ Awaiting Review ¦ Completed ¦ Queued ¦ Held || Review Gate ¦ All gate states ¦ Awaiting Review ¦ In Review ¦ Approved — Released ¦ Held — Blocked ¦ Blocked — Payment || Payment ¦ All payments ¦ Paid ¦ Pending ¦ Overdue || Scan Type ¦ All types ¦ External ¦ API ¦ Internal ¦ Network ¦ Mobile]
   <div class="sq-toolbar-actions">
    <button type="button" class="sq-clear-btn" id="sq-clear-filters">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Reset</span>
    </button>
   </div>
  </div>
 </section>
 <div class="sq-bulkbar" id="sq-bulkbar" role="region" aria-label="Bulk job actions">
  <span class="sq-bulk-count">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <strong id="sq-selected-count">0</strong>
   job(s) selected
  </span>
  <div class="sq-bulk-actions">
   <button type="button" class="sq-bulk-btn sq-bulk-btn--primary">Open Review Gate</button>
   <button type="button" class="sq-bulk-btn">Assign Reviewer</button>
   <button type="button" class="sq-bulk-btn">Place On Hold</button>
   <button type="button" class="sq-bulk-btn sq-bulk-btn--danger">Reject Batch</button>
   <button type="button" class="sq-bulk-btn">Clear Selection</button>
  </div>
 </div>
 <section class="adm-card sq-table-card" aria-labelledby="sq-table-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="sq-table-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Vulnerability Assessment & Job Queue
    </h2>
    <p class="adm-card-note">Target host details, client request information, payment status and per-job review-gate state. Results remain locked until an administrator approves release.</p>
   </div>
   <span class="adm-tag adm-tag--warn">37 Awaiting Review</span>
  </div>
  <div class="adm-table-wrap">
   <table class="adm-table sq-table">
    <caption class="sr-only">Vulnerability assessment job queue with target host, client request, payment status and mandatory admin review gate</caption>
    <thead>
     <tr>
      <th>
       <input type="checkbox" class="sq-check" id="sq-select-all" aria-label="Select all visible jobs"/>
      </th>
      <th>Job / Requested</th>
      <th>Target Host</th>
      <th>Client Request Info</th>
      <th>Type</th>
      <th>Payment</th>
      <th>Priority</th>
      <th>Status / Progress</th>
      <th>Review Gate</th>
      <th>Actions</th>
     </tr>
    </thead>
    <tbody id="sq-tbody">
     <tr class="sq-row">
      <td>
       <input type="checkbox" class="sq-check sq-row-check" aria-label="Select JOB-4471"/>
      </td>
      <td>
       <span class="sq-job">JOB-4471</span>
       <span class="sq-sub sq-sub--mono">24 Sep · 06:12 UTC</span>
      </td>
      <td>
       <span class="sq-host">api.horizonsacco.co.ke</span>
       <span class="sq-sub sq-sub--mono">41.90.64.12</span>
       <span class="sq-env sq-env--prod">Production</span>
      </td>
      <td>
       <span class="sq-client">Horizon SACCO</span>
       <span class="sq-sub">grace@horizonsacco.co.ke</span>
       <span class="sq-sub">Scope: external API + auth flow</span>
      </td>
      <td>
       <span class="adm-badge adm-badge--info">External</span>
      </td>
      <td>
       <span class="adm-badge adm-badge--settled">Paid</span>
      </td>
      <td>
       <span class="sq-prio sq-prio--critical">Critical</span>
      </td>
      <td>
       <div class="sq-progress">
        <progress class="adm-progress" value="78" aria-label="JOB-4471 progress">78%</progress>
        <span class="sq-progress-val">78%</span>
       </div>
       <span class="sq-sub">Running · ETA 4m 12s</span>
      </td>
      <td>
       <div class="sq-gate">
        <span class="sq-gate-badge sq-gate-badge--awaiting">Awaiting Review</span>
        <span class="sq-gate-lock sq-gate-lock--locked">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
         Client release blocked
        </span>
       </div>
      </td>
      <td>
       <div class="sq-actions">
        <button type="button" class="sq-act sq-act--primary">Review Findings</button>
        <button type="button" class="sq-act">Hold</button>
        <button type="button" class="sq-icon-btn" aria-label="View report preview for JOB-4471">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </td>
     </tr>
     [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: JOB-4470 ¦ 24 Sep · 05:48 UTC ¦ pay.nairobifintech.com ¦ 102.68.77.14 ¦ Production ¦ Nairobi Fintech Group ¦ devops@nairobifintech.com ¦ Scope: payment gateway API ¦ API ¦ Paid ¦ High ¦ 64% ¦ 64% ¦ Running · ETA 7m 38s ¦ Awaiting Review ¦ Client release blocked ¦ Review Findings ¦ Hold || JOB-4469 ¦ 23 Sep · 21:30 UTC ¦ vault.lakeviewlogistics.com ¦ 10.24.8.11 ¦ Internal ¦ Lakeview Logistics ¦ security@lakeviewlogistics.com ¦ Scope: internal credential vault ¦ Internal ¦ Paid ¦ High ¦ 41% ¦ 41% ¦ Running · ETA 13m 05s ¦ In Review ¦ Client release blocked ¦ Continue Review ¦ Reassign || JOB-4468 ¦ 23 Sep · 18:05 UTC ¦ 10.24.8.0/24 ¦ Internal subnet · 254 hosts ¦ Internal ¦ Lakeview Logistics ¦ security@lakeviewlogistics.com ¦ Scope: internal network sweep ¦ Network ¦ Paid ¦ Medium ¦ 89% ¦ 89% ¦ Running · ETA 1m 47s ¦ Awaiting Review ¦ Client release blocked ¦ Review Findings ¦ Hold || JOB-4467 ¦ 23 Sep · 15:22 UTC ¦ mobile.mwananchi.co.ke ¦ 41.90.12.88 ¦ Production ¦ Mwananchi Microfinance ¦ mobile@mwananchi.co.ke ¦ Scope: Android + iOS API surface ¦ Mobile ¦ Pending ¦ Critical ¦ 0% ¦ 0% ¦ Queued · not yet assigned ¦ Blocked — Payment ¦ Not eligible for review ¦ Request Payment ¦ Cancel Job || JOB-4466 ¦ 22 Sep · 11:14 UTC ¦ core.kijaniagri.co.ke ¦ 41.90.55.21 ¦ Production ¦ Kijani Agri Co-op ¦ it@kijaniagri.co.ke ¦ Scope: public web perimeter ¦ External ¦ Paid ¦ Medium ¦ 100% ¦ 100% ¦ Completed · 22 Sep 14:02 UTC ¦ Approved — Released ¦ Client access granted ¦ Download Report ¦ Revoke Release || JOB-4465 ¦ 21 Sep · 09:47 UTC ¦ portal.techbridge.co.ke ¦ 197.248.10.4 ¦ Staging ¦ TechBridge Solutions ¦ admin@techbridge.co.ke ¦ Scope: customer portal + SSO ¦ External ¦ Overdue ¦ High ¦ 100% ¦ 100% ¦ Completed · held for remediation ¦ Held — Blocked ¦ Client release blocked ¦ Reopen Review ¦ Reassign || JOB-4464 ¦ 21 Sep · 07:03 UTC ¦ auth.mwananchi.co.ke ¦ 41.90.12.90 ¦ Production ¦ Mwananchi Microfinance ¦ security@mwananchi.co.ke ¦ Scope: authentication & token service ¦ API ¦ Paid ¦ Critical ¦ 100% ¦ 100% ¦ Completed · 21 Sep 09:41 UTC ¦ Awaiting Review ¦ Client release blocked ¦ Review Findings ¦ Hold || JOB-4463 ¦ 20 Sep · 13:26 UTC ¦ vpn.nairobifintech.com ¦ 102.68.77.20 ¦ Production ¦ Nairobi Fintech Group ¦ devops@nairobifintech.com ¦ Scope: VPN concentrator & MFA ¦ Internal ¦ Paid ¦ High ¦ 100% ¦ 100% ¦ Completed · 20 Sep 16:12 UTC ¦ Approved — Released ¦ Client access granted ¦ Download Report ¦ Revoke Release || JOB-4462 ¦ 19 Sep · 10:58 UTC ¦ shop.kijaniagri.co.ke ¦ 41.90.55.30 ¦ Production ¦ Kijani Agri Co-op ¦ it@kijaniagri.co.ke ¦ Scope: e-commerce storefront ¦ External ¦ Paid ¦ Low ¦ 100% ¦ 100% ¦ Completed · 19 Sep 12:44 UTC ¦ Approved — Released ¦ Client access granted ¦ Download Report ¦ Revoke Release]
    </tbody>
    <tfoot>
     <tr>
      <td>Client release is locked until the Mandatory Admin Review Gate is cleared by an administrator.</td>
     </tr>
    </tfoot>
   </table>
  </div>
  <div class="sq-empty" id="sq-empty">
   <span class="sq-empty-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="sq-empty-title">No jobs match the current filters</span>
   <span class="sq-empty-text">Adjust your search terms or reset the filters to see the full vulnerability assessment queue.</span>
   <button type="button" class="adm-btn adm-btn-ghost" id="sq-empty-reset">Reset Filters</button>
  </div>
 </section>
 <section class="adm-card adm-card--dark sq-gate-card" aria-labelledby="sq-gate-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="sq-gate-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Mandatory Admin Review Gate
    </h2>
    <p class="adm-card-note">No penetration test result leaves the platform without a human administrator clearing four mandatory verification steps. This gate cannot be bypassed, delegated or automated.</p>
   </div>
   <span class="adm-tag adm-tag--crit">Enforced</span>
  </div>
  <div class="adm-card-body">
   <ol class="sq-gate-steps">
    <li class="sq-gate-step">
     <span class="sq-gate-step-num">01</span>
     <span class="sq-gate-step-title">Scope Authorisation Verified</span>
     <span class="sq-gate-step-text">Confirm the signed authorisation document covers every host in the target list and that the testing window has not expired.</span>
    </li>
    [+3 more sibling <li> elements with the SAME structure as the one above; their text content in order: 02 ¦ Evidence Sanitised ¦ Ensure no live client production data, credentials or personal information is embedded in screenshots, payloads or proof-of-concept output. || 03 ¦ Findings Manually Validated ¦ Every critical and high severity finding must be independently reproduced and confirmed by the reviewing administrator before it reaches the client. || 04 ¦ Remediation Guidance Attached ¦ The report must ship with prioritised, actionable remediation steps and a re-test window before the release flag can be flipped.]
   </ol>
   <div class="sq-gate-alert">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span class="sq-gate-alert-text">
     <strong>Release lock:</strong>
     Jobs sitting in
     <em>Awaiting Review</em>
     ,
     <em>In Review</em>
     ,
     <em>Held</em>
     or
     <em>Blocked — Payment</em>
     are invisible to the client portal. Attempting to release a locked job raises a
     <strong>SEV-2 audit event</strong>
     and notifies the incident commander on duty.
    </span>
   </div>
  </div>
 </section>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 74ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 66ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: top; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.sq-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.sq-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.sq-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.sq-toolbar-title svg { color: var(--brand); }
.sq-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.sq-results strong { color: var(--brand-strong); }
.sq-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(4, minmax(140px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1280px) {
.sq-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)); }
}
@media (max-width: 720px) {
.sq-toolbar-grid { grid-template-columns: 1fr; }
}
.sq-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.sq-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.sq-input-wrap { position: relative; display: flex; align-items: center; }
.sq-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.sq-input,
      .sq-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.sq-input { padding-left: 38px; }
.sq-input::placeholder { color: var(--ink-faint); }
.sq-input:focus,
      .sq-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.sq-toolbar-actions { display: flex; gap: 8px; }
.sq-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.sq-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.sq-bulkbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; padding: 12px 18px; border-radius: 14px; background: linear-gradient(135deg, var(--dark), #070b11); border: 1px solid rgba(59, 153, 252, 0.3); box-shadow: 0 18px 40px -30px rgba(0, 0, 0, 0.8); color: #ffffff; opacity: 0; max-height: 0; padding-block: 0; overflow: hidden; transform: translateY(-6px); transition: opacity 0.25s var(--ease), max-height 0.3s var(--ease), padding 0.3s var(--ease), transform 0.25s var(--ease); }
.sq-bulkbar.is-active { opacity: 1; max-height: 160px; padding-block: 12px; transform: translateY(0); }
.sq-bulk-count { display: inline-flex; align-items: center; gap: 9px; font-size: 0.78rem; font-weight: 700; color: #cbd5e1; }
.sq-bulk-count strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1rem; font-weight: 800; color: var(--brand-soft); }
.sq-bulk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.sq-bulk-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; font-size: 0.72rem; font-weight: 800; border-radius: var(--r-full); cursor: pointer; color: #cbd5e1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); }
.sq-bulk-btn:hover { color: #ffffff; border-color: rgba(59, 153, 252, 0.5); background: rgba(59, 153, 252, 0.16); transform: translateY(-1px); }
.sq-bulk-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: transparent; }
.sq-bulk-btn--primary:hover { filter: brightness(1.06); color: #04121f; }
.sq-bulk-btn--danger { color: #fda4af; border-color: rgba(244, 63, 94, 0.35); }
.sq-bulk-btn--danger:hover { color: #ffffff; background: rgba(244, 63, 94, 0.25); border-color: rgba(244, 63, 94, 0.6); }
.sq-table-card { overflow: hidden; }
.sq-table { min-width: 1240px; }
.sq-table tbody td { vertical-align: middle; }
.sq-table thead th:first-child,
      .sq-table tbody td:first-child { width: 42px; padding-right: 4px; }
.sq-check { appearance: none; -webkit-appearance: none; width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--line); background: #ffffff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.18s var(--ease); flex: 0 0 auto; }
.sq-check:hover { border-color: var(--brand-line); }
.sq-check:checked { background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; }
.sq-check:checked::after { content: ""; width: 5px; height: 9px; border: solid #ffffff; border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }
.sq-check:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.sq-job { display: block; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 7px; padding: 4px 9px; white-space: nowrap; width: max-content; }
.sq-sub { display: block; margin-top: 5px; font-size: 10.5px; line-height: 1.5; color: var(--ink-muted); }
.sq-sub--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; letter-spacing: 0.01em; }
.sq-host { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; font-weight: 800; color: var(--ink); word-break: break-all; max-width: 22ch; }
.sq-client { display: block; font-size: 0.78rem; font-weight: 800; color: var(--ink); }
.sq-env { display: inline-block; margin-top: 6px; padding: 3px 9px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: var(--r-full); border: 1px solid transparent; }
.sq-env--prod { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.sq-prio { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.sq-prio::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.sq-prio--critical { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.sq-progress { display: flex; align-items: center; gap: 10px; min-width: 150px; }
.sq-progress .adm-progress { flex: 1 1 auto; }
.sq-progress-val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; color: var(--brand-strong); min-width: 36px; text-align: right; }
.sq-gate { display: flex; flex-direction: column; gap: 6px; min-width: 165px; }
.sq-gate-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; font-size: 9.5px; fo
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full vulnerability assessment queue.`
- `Selection cleared`
- `No jobs are selected.`
- `No jobs selected`
- `Select at least one job from the queue first.`
- `Nothing to review`
- `None of the selected jobs are eligible for the review gate.`
- `Review gate opened`
- `eligible job(s) in the current selection.`
- `Reviewer assigned`
- `job(s) reassigned to a.njoroge.`
- `Jobs placed on hold`
- `job(s) locked pending remediation.`
- `Batch rejected`
- `job(s) returned to the analyst for rework.`
- `Awaiting Review`
- `Complete all five verification steps and select a decision to enable the gate action.`
- `Pending — awaiting settlement`
- `Overdue — collection required`
- `verification step(s) still outstanding before the gate can be cleared.`
- `All verification steps complete — select a gate decision to continue.`
- `All checks complete. Confirming will write this decision to the immutable audit log.`
- `Client portal access granted. Decision written to the audit log`
- `with reviewer note.`
- `held for remediation`
- `Report remains locked. The client has been notified of outstanding findings.`
- `Job returned to the assigned analyst for rework and re-submission.`
**Data:** `GET /admin/scans/summary` → tiles (`Jobs in Queue`, `Added today`, `Running Scans` + worker slots, `Awaiting Admin Review`, `Approved & Released` + `Released this week`, `Payment Outstanding` + `Overdue > 14 days`, `Held / Rejected`) — copy for labels from the markup. `GET /admin/scans` with `q`, `status`, `gate`, `payment`, `type`, `page`, `pageSize`, sort; filters live in the URL query (`useSearchParams`) so views are linkable; `Clear filters` resets and toasts `Filters cleared` / `Showing the full vulnerability assessment queue.`. Table via `DataTable` (Task 12) with `enableRowSelection`; columns exactly as the markup (select, `Job ID`/`Requested`, `Target`/`Client`, `Type`, `Priority`, `Status` with progress bar and ETA (`formatEta`, completed shows the completed timestamp), `Review Gate`, `Payment`, `Actions`). Timestamps `DD Mon · HH:MM UTC` (`formatQueueStamp`). Gate and payment chip text from `REVIEW_GATE_LABELS` / `PAYMENT_STATUS_LABELS`.
**Bulk bar (appears when ≥ 1 row selected; `aria-live="polite"` count `<n> selected`):** `Open Review Gate`, `Assign Reviewer` (reviewer select listing active staff with `scans:review`; default = current user), `Place on Hold`, `Reject Batch`, `Clear` → `POST /admin/scans/bulk`; response `{ updated, skippedIds }` → toast with the matching prototype titles (`Review gate opened` / `Reviewer assigned` / `Jobs placed on hold` / `Batch rejected`) and message `<updated> job(s) …` using the verbatim tails from the strings list; when nothing is selected the toast is `No jobs selected` / `Select at least one job from the queue first.`; when all skipped → `Nothing to review` / `None of the selected jobs are eligible for the review gate.`. Bulk can never release.
**Row actions menu (per row; items depend on state):** `Review gate` (opens the Task 78 dialog for jobs with gate `in_review`), `Preview report` (read-only toast `Opening report preview` / `<JOB> — client-facing copy (redacted).`; no endpoint — `// TODO(backend-contract)`), `Request payment` (`POST …/request-payment`; toast `Payment reminder sent` / `<JOB> — invoice re-issued to the client billing contact.`), `Cancel job` (`POST …/cancel`, confirm dialog; toast `Job removed from the queue and archived to the audit trail.`), `Assign analyst` is out of scope (no endpoint) — omit it. Items the user lacks permission for are hidden (`scans:review`, `scans:release`).
Poll the list every 15 s while visible; the real-time push comes in Layer L12.

**Tests:** summary tiles from MSW; URL-driven filters; selection shows the bulk bar and count; bulk call body shape; skipped-all toast; row menu items by state; permission-hidden actions; timestamps formatted in UTC.

---

**Data shape (TypeScript):**
```ts
// ScanJob, ScanQueueSummary, BulkScanActionBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/scans?… → 200 { data: ScanJob[]; total } · GET …/summary → { data: ScanQueueSummary }
// POST /api/v1/admin/scans/bulk body { action; ids; reviewerId? } → 200 { data: { updated; skippedIds } }
// POST /api/v1/admin/scans/:id/request-payment | /cancel → 200 { data: ScanJob }
```

---

**Out of scope:**
- Do not build the review-gate dialog (Task 78).
- Do not release anything from the bulk bar.
- Do not show scan output (Layer L12).

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
☐ Report at the end: `Task 77 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 78 — Admin Mandatory Review Gate dialog

**Layer:** L9

**Prerequisites:** Task 35, Task 77, Task 11

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Mandatory Review Gate dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the review-gate dialog: five verification checks, the three decisions, the payment lock and the immutable-audit confirmation.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/scan-queue/_components/review-gate-dialog.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_components/gate-checklist.tsx`, `gate-decision-picker.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_hooks/use-gate-decision.ts`
- MODIFY `apps/web/src/app/(authed)/admin/scan-queue/_styles/scan-queue.css` — append rules.
- MODIFY `apps/web/src/app/(authed)/admin/scan-queue/_components/row-actions.tsx` — open the dialog.
- `apps/web/src/app/(authed)/admin/scan-queue/review-gate.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:**

##### Review gate dialog
```html
<div id="sq-review-modal" class="sq-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="sq-review-title">
 <div class="sq-modal-backdrop"></div>
 <div class="sq-modal-window" role="document">
  <div class="sq-modal-head">
   <div>
    <span class="sq-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Mandatory Admin Review Gate
    </span>
    <h2 class="sq-modal-title" id="sq-review-title">Review findings before client release</h2>
    <p class="sq-modal-sub">
     <span id="sq-modal-job">JOB-0000</span>
     ·
     <span id="sq-modal-target">target.example.com</span>
    </p>
   </div>
   <button type="button" class="sq-modal-close" aria-label="Close review gate">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="sq-modal-body">
   <div>
    <div class="sq-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Findings Summary
    </div>
    <div class="sq-findings">
     <div class="sq-finding sq-finding--crit">
      <span class="sq-finding-count" id="sq-crit-count">0</span>
      <span class="sq-finding-label">Critical</span>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: 0 ¦ High || 0 ¦ Medium || 0 ¦ Low]
    </div>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Client Request Context ¦ Client ¦ — ¦ Target Host ¦ — ¦ Payment ¦ — || Mandatory Verification Checklist ¦ Scope authorisation verified ¦ Signed authorisation on file covers every host in the target list. ¦ Evidence sanitised ¦ No production data, credentials or personal information in the report. ¦ Critical & high findings manually validated ¦ Each severe finding independently reproduced by the reviewer. ¦ Remediation guidance attached ¦ Prioritised fixes and a re-test window are included in the report. ¦ Client-ready redaction approved ¦ Exploit payloads are safely truncated for the client-facing copy. || Gate Decision ¦ Approve & Release ¦ Clears the gate and grants the client portal access to the report. ¦ Hold for Remediation ¦ Keeps the report locked while the client remediates findings. ¦ Reject & Archive ¦ Marks the job invalid and returns it to the analyst for rework.]
   <div class="sq-note-field">
    <label class="sq-field-label" for="sq-review-note">Reviewer Note (recorded in the audit log)</label>
    <textarea id="sq-review-note" class="sq-textarea" placeholder="Summarise what was verified, any residual risk accepted, and the rationale for this decision…"></textarea>
   </div>
   <div class="sq-reviewer">
    <span>
     <span class="sq-reviewer-label">Reviewer</span>
     <br/>
     <span class="sq-reviewer-value">e.reed@vunvault.com</span>
    </span>
    [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: Role ¦ Super Administrator || Gate Timestamp ¦ —]
   </div>
  </div>
  <div class="sq-modal-foot">
   <span class="sq-modal-foot-note" id="sq-gate-hint">Complete all five verification steps and select a decision to enable the gate action.</span>
   <div class="sq-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-primary" id="sq-confirm-gate" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Confirm Gate Decision</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.sq-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.sq-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.sq-modal[hidden] { display: none !important; }
.sq-modal.is-open { opacity: 1; }
.sq-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.76); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.sq-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(760px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.85); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.sq-modal.is-open .sq-modal-window { transform: translateY(0) scale(1); }
.sq-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.18), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.sq-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.sq-modal-title { margin-top: 8px; font-size: 1.16rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
.sq-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-word; }
.sq-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.sq-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.sq-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.sq-modal-body::-webkit-scrollbar { width: 8px; }
.sq-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.sq-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.sq-findings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.sq-findings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.sq-finding { padding: 14px 14px 12px; border-radius: 12px; border: 1px solid var(--line-soft); background: #f8fafc; text-align: center; }
.sq-finding-count { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.sq-finding-label { display: block; margin-top: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
.sq-finding--crit .sq-finding-count { color: #be123c; }
.sq-finding--high .sq-finding-count { color: #b45309; }
.sq-finding--med  .sq-finding-count { color: #1d4ed8; }
.sq-finding--low  .sq-finding-count { color: #047857; }
.sq-note-field { display: flex; flex-direction: column; gap: 8px; }
.sq-textarea { width: 100%; min-height: 96px; padding: 13px 15px; font-size: 0.8rem; line-height: 1.6; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; resize: vertical; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.sq-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.sq-reviewer { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 13px; background: #f8fafc; border: 1px solid var(--line-soft); }
.sq-reviewer-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.sq-reviewer-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; font-weight: 700; color: var(--ink); }
.sq-modal-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 22px; background: #f8fafc; border-top: 1px solid var(--line-soft); }
.sq-modal-foot-note { font-size: 10.5px; color: var(--ink-muted); max-width: 44ch; line-height: 1.6; }
.sq-modal-foot-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.sq-modal-foot .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .sq-act, .sq-icon-btn, .sq-bulk-btn, .sq-clear-btn,
        .sq-modal, .sq-modal-window, .sq-toast, .sq-bulkbar, .adm-hamburger-bar { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .sq-toolbar, .sq-bulkbar,
        .sq-actions, .sq-modal, .sq-toast-stack { display: none !important; }
}
```

**Behaviour:** built on the `Dialog` primitive (focus trap, Escape, `aria-labelledby`). Header shows the job (`JOB-4471`), target, client, and a gate badge (`Awaiting Review`). Body: `REVIEW_CHECK_LABELS` five checkboxes (titles + descriptions verbatim from contracts), the three decision radio cards (`GATE_DECISION_LABELS` titles/descriptions), a required reviewer note (`Reviewer note` textarea, min 10 characters, error `Add a reviewer note of at least 10 characters.` (planner)), payment panel showing the job's payment state — `Pending — awaiting settlement` / `Overdue — collection required` (verbatim) in a warning panel when not paid, with the line `Release is blocked until payment is settled.` (planner) — and a status line that updates live: `Complete all five verification steps and select a decision to enable the gate action.` → `<n> verification step(s) still outstanding before the gate can be cleared.` → `All verification steps complete — select a decision to continue.` → `All checks complete. Confirming will write this decision to the immutable audit log.`. The confirm button label follows the decision (`Approve & Release` / `Hold for Remediation` / `Reject & Archive`) and is disabled until the contract rule holds (`approve_release` needs all five checks; others do not) and the note is valid.
**Submit:** `POST /admin/scans/:id/gate-decision { decision, checks, note }`. Success toasts (verbatim): approve → `Client portal access granted. Decision written to the audit log` + `<JOB> released with reviewer note.`; hold → `<JOB> held for remediation` + `Report remains locked. The client has been notified of outstanding findings.`; reject → `<JOB> rejected` + `Job returned to the assigned analyst for rework and re-submission.`. **`409 payment_outstanding`** (the API recorded the attempt and set `blocked_payment`): do NOT show success — show the inline critical panel `Release blocked — payment is outstanding. The decision was recorded and the job is locked until the invoice is paid.` and refresh the queue. `403 forbidden` → `Your role cannot release reports. Ask an administrator.`; `409 already_released` → close + refresh. Users without `scans:release` see the `Approve & Release` card disabled with the tooltip `Requires administrator authority.`.
**Tests:** confirm disabled until five checks + note for approve; hold allowed with unchecked checks; the three success toasts; 409 payment shows the blocked panel and no success toast; analyst sees approve disabled; keyboard: Escape closes, focus returns to the row action.

---

**Data shape (TypeScript):**
```ts
// GateDecisionBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/scans/:id/gate-decision body { decision; checks: Record<ReviewCheckKey, boolean>; note: string(min10) } → 200 { data: ScanJob } | 403 forbidden | 409 { error: "payment_outstanding" | "not_reviewable" | "already_released" }
```

---

**Out of scope:**
- Do not add any way to undo a release.
- Do not skip the audit confirmation line.
- Do not bypass the payment lock.

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
☐ Report at the end: `Task 78 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 79 — Admin User & Access Management A: summary, filters, roster, row actions

**Layer:** L9

**Prerequisites:** Task 31, Task 46, Task 75, Task 12

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin User & Access Management A: summary, filters, roster, row actions**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/users`: staff summary tiles, the searchable/filterable roster with MFA and status chips, and per-row suspend/reactivate/enforce-MFA/role/delete actions.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/users/page.tsx` — route; also renders `<InvitationsPanel/>` and `<RoleMatrix/>` (null stubs created here; Task 79b overwrites).
- `apps/web/src/app/(authed)/admin/users/_components/users-summary.tsx`, `users-toolbar.tsx`, `roster-table.tsx`, `row-actions.tsx`, `confirm-action-dialog.tsx`
- `apps/web/src/app/(authed)/admin/users/_components/invitations-panel.tsx`, `role-matrix.tsx` — null stubs.
- `apps/web/src/app/(authed)/admin/users/_hooks/use-users.ts`
- `apps/web/src/app/(authed)/admin/users/_styles/users.css`
- `apps/web/src/mocks/handlers/admin-users.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/users/users-a.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup (the `Provision New Member` button/dialog is Task 80; the invitations aside and the role matrix are Task 79b):**

##### Page head and summary tiles
```html
<div class="adm-page-head">
 <div>
  <span class="adm-eyebrow">Identity, Access & Provisioning</span>
  <h1 class="adm-page-title">User & Access Management</h1>
  <p class="adm-page-sub">Maintain the active staff roster of security analysts and operators, review role assignments and provision new team members with least-privilege access.</p>
 </div>
 <div class="adm-head-actions">
  <button type="button" class="adm-btn adm-btn-primary" id="um-invite-btn">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Provision New Member</span>
  </button>
  <button type="button" class="adm-btn adm-btn-dark" id="um-export-roster">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Export Roster</span>
  </button>
  <button type="button" class="adm-btn adm-btn-ghost" id="um-review-access">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Quarterly Access Review</span>
  </button>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.um-actions-stack .adm-btn { width: 100%; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .um-act, .um-icon-btn, .um-invite, .um-toast,
        .um-modal, .um-modal-window, .adm-hamburger-bar,
        .um-input, .um-select, .um-textarea { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .um-toolbar,
        .um-actions, .um-modal, .um-toast-stack, .um-actions-stack { display: none !important; }
}
```

##### Summary tiles
```html
<section aria-labelledby="um-kpi-heading">
 <h2 id="um-kpi-heading" class="sr-only">Team and access indicators</h2>
 <div class="adm-kpi-grid">
  <article class="adm-kpi">
   <span class="adm-kpi-label">Active Team Members</span>
   <span class="adm-kpi-value">24</span>
   <span class="adm-kpi-delta adm-kpi-delta--up">▲ 3 onboarded this month</span>
  </article>
  [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Security Analysts ¦ 11 ¦ ● Pentest & red team || Operators ¦ 7 ¦ ● SOC & scan operations || Pending Invitations ¦ 4 ¦ ● Awaiting acceptance || MFA Enrolment ¦ 92 ¦ % ¦ 2 accounts without MFA || Dormant Accounts ¦ 2 ¦ ▲ 60+ days inactive · review]
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
@media (prefers-reduced-motion: reduce) {
}
```

##### Roster column (toolbar + table)
```html
<div class="um-col">
 <section class="um-toolbar" aria-labelledby="um-filter-heading">
  <div class="um-toolbar-head">
   <h2 class="um-toolbar-title" id="um-filter-heading">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Search & Filter Roster
   </h2>
   <span class="um-results" role="status" aria-live="polite">
    Showing
    <strong id="um-visible-count">10</strong>
    of
    <strong id="um-total-count">10</strong>
    members
   </span>
  </div>
  <div class="um-toolbar-grid">
   <div class="um-field">
    <label class="um-field-label" for="um-search">Search</label>
    <div class="um-input-wrap">
     <span class="um-input-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <input id="um-search" class="um-input" type="search" placeholder="Name, email, team or scope…" autocomplete="off"/>
    </div>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Role ¦ All roles ¦ Super Administrator ¦ Administrator ¦ Security Analyst ¦ SOC Operator ¦ Compliance Auditor ¦ Support Engineer || Account Status ¦ All statuses ¦ Active ¦ Pending Invite ¦ Suspended ¦ Dormant || MFA ¦ MFA — any ¦ Enrolled ¦ Not enrolled]
   <div class="um-toolbar-actions">
    <button type="button" class="um-clear-btn" id="um-clear-filters">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Reset</span>
    </button>
   </div>
  </div>
 </section>
 <section class="adm-card" aria-labelledby="um-roster-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-roster-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Active Staff Roster — Security Analysts & Operators
    </h2>
    <p class="adm-card-note">Every account with platform access, its assigned role, permitted scope and authentication posture.</p>
   </div>
   <span class="adm-tag adm-tag--ok">24 Active</span>
  </div>
  <div class="adm-table-wrap">
   <table class="adm-table um-table">
    <caption class="sr-only">Active staff roster of security analysts and operators with role, scope, MFA status and account state</caption>
    <thead>
     <tr>
      <th>Member</th>
      <th>Role</th>
      <th>Scope & Team</th>
      <th>MFA / Access</th>
      <th>Last Active</th>
      <th>Status</th>
      <th>Actions</th>
     </tr>
    </thead>
    <tbody id="um-tbody">
     <tr class="um-row">
      <td>
       <div class="um-identity">
        <span class="um-avatar" aria-hidden="true">ER</span>
        <span class="um-identity-body">
         <span class="um-name">Dr. Evelyn Reed</span>
         <span class="um-email">e.reed@vunvault.com</span>
         <span class="um-meta-line">Joined Mar 2024 · Nairobi HQ</span>
        </span>
       </div>
      </td>
      [+3 more sibling <td> elements with the SAME structure as the one above; their text content in order: Super Administrator || Full platform · All modules ¦ Incident commander · Final approval || MFA enrolled ¦ Hardware key]
      <td class="adm-mono">Now · 09:41</td>
      <td>
       <span class="adm-badge adm-badge--ok">Active</span>
      </td>
      <td>
       <div class="um-actions">
        <button type="button" class="um-act um-act--primary">Permissions</button>
        <button type="button" class="um-icon-btn" aria-label="Edit profile for Dr. Evelyn Reed">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
        <button type="button" class="um-icon-btn" aria-label="Suspend account for Dr. Evelyn Reed">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </td>
     </tr>
     [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: AN ¦ Amara Njoroge ¦ a.njoroge@vunvault.com ¦ Joined Jun 2024 · Nairobi HQ ¦ Administrator ¦ Offensive Security · Pentest queue ¦ Red team lead · Review authority ¦ MFA enrolled ¦ TOTP ¦ 12 min ago ¦ Active ¦ Permissions || DM ¦ Daniel Mwangi ¦ d.mwangi@vunvault.com ¦ Joined Aug 2024 · Nairobi HQ ¦ Security Analyst ¦ Security Automation · Scan queue ¦ Enumeration agents · Patch validation ¦ MFA enrolled ¦ TOTP ¦ 38 min ago ¦ Active ¦ Permissions || FH ¦ Fatima Hassan ¦ f.hassan@vunvault.com ¦ Joined Jan 2025 · Remote — Mombasa ¦ Security Analyst ¦ Threat Intelligence · Zero-Day desk ¦ CVE curation · Advisory drafting ¦ MFA enrolled ¦ TOTP ¦ 1 h ago ¦ Active ¦ Permissions || BO ¦ Brian Otieno ¦ b.otieno@vunvault.com ¦ Joined Feb 2025 · Nairobi HQ ¦ SOC Operator ¦ SOC · Detection & triage ¦ Shift lead · Alert queue ¦ MFA enrolled ¦ TOTP ¦ 5 min ago ¦ Active ¦ Permissions || GW ¦ Grace Wanjiru ¦ g.wanjiru@vunvault.com ¦ Joined Apr 2025 · Nairobi HQ ¦ Compliance Auditor ¦ Audit Logs · Compliance reporting ¦ Read-only · No scan execution ¦ MFA enrolled ¦ TOTP ¦ Yesterday · 17:22 ¦ Active ¦ Permissions || KK ¦ Kevin Kimani ¦ k.kimani@vunvault.com ¦ Joined Jul 2025 · Remote — Kisumu ¦ SOC Operator ¦ SOC · Night shift monitoring ¦ Alert triage · Escalation ¦ MFA not enrolled ¦ Enrolment required ¦ 2 h ago ¦ Active ¦ Permissions ¦ Enforce MFA || AM ¦ Aisha Mohamed ¦ a.mohamed@vunvault.com ¦ Invited 22 Sep 2026 · Not yet accepted ¦ Security Analyst ¦ Offensive Security · Pentest queue ¦ Onboarding in progress ¦ Awaiting enrolment ¦ — ¦ Pending Invite ¦ Resend Invite ¦ Revoke || PN ¦ Peter Ndegwa ¦ p.ndegwa@vunvault.com ¦ Suspended 12 Sep 2026 · Offboarding ¦ Support Engineer ¦ Client Support · Ticketing only ¦ No scan or dashboard access ¦ MFA enrolled ¦ Tokens revoked ¦ 12 Sep · 08:10 ¦ Suspended ¦ Reactivate ¦ Delete || LA ¦ Lucy Achieng ¦ l.achieng@vunvault.com ¦ Last login 68 days ago ¦ SOC Operator ¦ SOC · Detection & triage ¦ Dormant · Access review due ¦ MFA enrolled ¦ Review required ¦ 68 days ago ¦ Dormant ¦ Permissions ¦ Suspend]
    </tbody>
    <tfoot>
     <tr>
      <td>Role changes, suspensions and permission edits are written to the immutable audit log with your administrator identity.</td>
     </tr>
    </tfoot>
   </table>
  </div>
  <div class="um-empty" id="um-empty">
   <span class="um-empty-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="um-empty-title">No team members match the current filters</span>
   <span class="um-empty-text">Adjust your search terms or reset the filters to see the full staff roster.</span>
   <button type="button" class="adm-btn adm-btn-ghost" id="um-empty-reset">Reset Filters</button>
  </div>
 </section>
 <section class="adm-card" aria-labelledby="um-provision-heading" id="um-provision-anchor">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-provision-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Provision New Team Member
    </h2>
    <p class="adm-card-note">Issue a scoped invitation to a security analyst, operator or auditor. Permissions are applied only after the invitee completes MFA enrolment and accepts the invitation.</p>
   </div>
   <span class="adm-tag adm-tag--warn">Least Privilege Enforced</span>
  </div>
  <div class="adm-card-body">
   <form class="um-form" id="um-form">
    <fieldset class="um-fieldset">
     <legend class="um-legend">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Identity
     </legend>
     <div class="um-row">
      <div class="um-field">
       <label class="um-label" for="um-fullname">
        <span>
         Full Name
         <span class="um-label-req" aria-hidden="true">*</span>
        </span>
       </label>
       <input id="um-fullname" class="um-input" type="text" name="fullname" placeholder="Aisha Mohamed" autocomplete="off" required/>
      </div>
      <div class="um-field">
       <label class="um-label" for="um-email">
        <span>
         Work Email
         <span class="um-label-req" aria-hidden="true">*</span>
        </span>
        <span class="um-hint">@vunvault.com domain</span>
       </label>
       <input id="um-email" class="um-input um-mono" type="email" name="email" placeholder="a.mohamed@vunvault.com" autocomplete="off" required/>
      </div>
     </div>
     <div class="um-row">
      <div class="um-field">
       <label class="um-label" for="um-title">
        <span>Job Title</span>
       </label>
       <input id="um-title" class="um-input" type="text" name="title" placeholder="Security Analyst — Offensive Security" autocomplete="off"/>
      </div>
      <div class="um-field">
       <label class="um-label" for="um-location">
        <span>Base / Location</span>
       </label>
       <input id="um-location" class="um-input" type="text" name="location" placeholder="Nairobi HQ / Remote — Kenya" autocomplete="off"/>
      </div>
     </div>
    </fieldset>
    [+3 more sibling <fieldset> elements with the SAME structure as the one above; their text content in order: Role Assignment ¦ Security Analyst ¦ Run scans, review findings and author advisories within an assigned scope. ¦ SOC Operator ¦ Monitor live feeds, triage alerts and escalate incidents. No client release authority. ¦ Compliance Auditor ¦ Read-only access to audit logs, reports and regulatory evidence. No execution rights. ¦ Administrator ¦ Full operational control including review-gate approval and client release. ¦ Support Engineer ¦ Client ticketing and triage only. No access to scan data or dashboards. ¦ Super Administrator ¦ Unrestricted platform control. Reserved for the security leadership team only. ¦ Roles are additive. Grant the minimum role required for the member's responsibilities. || Scope & Team ¦ Team / Unit ¦ Offensive Security ¦ SOC — Detection & Response ¦ Threat Intelligence ¦ Security Automation ¦ Compliance & Audit ¦ Client Support ¦ Access Tier ¦ Standard — assigned scope only ¦ Elevated — cross-client read ¦ Restricted — single client ¦ Access Review Due ¦ Scope Notes ¦ Visible to reviewers only || Security Requirements ¦ MFA enrolment mandatory ¦ Enforced for all roles. Invitation expires if not enrolled within 72 hours. ¦ Signed NDA and confidentiality agreement on file ¦ Required before any client scope is granted. ¦ Background verification completed ¦ Mandatory for roles with client data access. ¦ Security awareness training acknowledged ¦ VUNVAULT internal policy and incident reporting procedure.]
   </form>
  </div>
 </section>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: middle; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.um-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.um-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.um-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.um-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.um-toolbar-title svg { color: var(--brand); }
.um-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.um-results strong { color: var(--brand-strong); }
.um-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(3, minmax(140px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1180px) {
.um-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)); }
}
@media (max-width: 720px) {
.um-toolbar-grid { grid-template-columns: 1fr; }
}
.um-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.um-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.um-input-wrap { position: relative; display: flex; align-items: center; }
.um-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.um-input,
      .um-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.um-input { padding-left: 38px; }
.um-input::placeholder { color: var(--ink-faint); }
.um-input:focus,
      .um-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.um-toolbar-actions { display: flex; gap: 8px; }
.um-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.um-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.um-table { min-width: 1100px; }
.um-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.um-avatar { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 2px solid #ffffff; box-shadow: 0 6px 16px -10px var(--brand-glow); flex: 0 0 auto; }
.um-identity-body { min-width: 0; }
.um-name { display: block; font-size: 0.82rem; font-weight: 800; color: var(--ink); line-height: 1.3; }
.um-email { display: block; margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: var(--ink-muted); word-break: break-all; }
.um-meta-line { display: block; margin-top: 4px; font-size: 10px; color: var(--ink-faint); }
.um-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 190px; }
.um-act { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; font-size: 0.7rem; font-weight: 800; border-radius: var(--r-full); cursor: pointer; white-space: nowrap; color: var(--ink); background: #ffffff; border: 1px solid var(--line); transition: all 0.2s var(--ease); }
.um-act:hover { transform: translateY(-1px); color: var(--brand-strong); border-color: var(--brand-line); box-shadow: 0 12px 24px -18px var(--brand-glow); }
.um-act--primary { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 12px 26px -16px var(--brand-glow); }
.um-act--primary:hover { color: #ffffff; filter: brightness(1.06); }
.um-act:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
.um-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: var(--ink-soft); background: #f4f6f9; border: 1px solid var(--line); transition: all 0.2s var(--ease); }
.um-icon-btn:hover { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; transform: translateY(-1px); }
.um-empty { display: none; flex-direction: column; align-items: center; gap: 10px; padding: 54px 22px; text-align: center; }
.um-empty.is-visible { display: flex; }
.um-empty-icon { width: 54px; height: 54px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--brand); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.um-empty-title { font-size: 1rem; font-weight: 800; color: var(--ink); }
.um-empty-text { font-size: 0.8rem; color: var(--ink-muted); max-width: 44ch; line-height: 1.65; }
.um-form { display: flex; flex-direction: column; gap: 22px; }
.um-fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.um-legend { display: flex; align-items: center; gap: 9px; padding: 0; margin-bottom: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.um-legend::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line-soft); }
.um-legend svg { color: var(--brand); flex: 0 0 auto; }
.um-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 760px) {
.um-row, .um-row--3 { grid-template-columns: 1fr; }
}
.um-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.um-label-req { color: #be123c; font-size: 11px; line-height: 1; }
.um-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
      .um-select,
      .um-textarea { width: 100%; padding: 12px 14px; font-size: 0.82rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.um-input::placeholder,
      .um-textarea::placeholder { color: var(--ink-faint); }
      .um-select:focus,
      .um-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.um-input.is-invalid,
      .um-select.is-invalid,
      .um-textarea.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); animation: umShake 0.32s var(--ease); }
@media (prefers-reduced-motion: reduce) {
        .um-input, .um-select, .u
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full staff roster.`
- `Super Administrator`
- `Security Analyst`
- `SOC Operator`
- `Compliance Auditor`
- `Support Engineer`
- `Tick at least one capability override and confirm authorisation to save.`
- `Select at least one capability override to apply to this member.`
- `Confirm that this access change is authorised before saving.`
- `Ready to save. The change is written to the immutable audit log.`
- `Permissions updated`
- `Profile editor`
- `— editing name, title, team and scope assignment.`
- `Account suspended`
- `— all active session tokens revoked immediately.`
- `Account reactivated`
- `— new invitation issued for MFA re-enrolment.`
- `MFA enforcement`
- `— enrolment challenge re-issued with 24-hour deadline.`
- `Invitation resent`
- `— secure invitation email re-dispatched.`
- `Invitation revoked`
- `— pending invitation invalidated.`
- `Account deletion queued`
- `— permanent removal scheduled after 30-day retention window.`
- `Action recorded`
- `— expires in 72 hours.`
- `— access link invalidated.`
- `All invitations`
- `Opening the full invitation workspace — 4 pending.`
- `Offensive Security`
- `Threat Intelligence`
- `Security Automation`
**Data:** `GET /admin/users/summary` → tiles (`Active Team Members`, `Security Analysts`, `Operators`, `Pending Invitations`, `MFA Enrolment` %, `Dormant Accounts`; delta lines as in the markup, derived: `▲ <onboardedThisMonth> onboarded this month`, `<accountsWithoutMfa> accounts without MFA`). `GET /admin/users` (query `q`, `role`, `status`, `mfa`, `page`, `pageSize`) → roster via `DataTable`: `Member` (initials avatar + name + email), `Scope & Team`, `MFA / Access` (chip `Enrolled · TOTP` / `Enrolled · Hardware key` / `NOT enrolled` / `Tokens revoked` / `Review required` from `mfa`, `accountStatus`, `accessReviewDue`), `Last Active` (`formatRelativeActive`), `Status` (`ACCOUNT_STATUS_LABELS` badge), `Actions`. `Showing 10 of 24 members` via `ResultCount`; filters in the URL; `Reset Filters` empty state (verbatim).
**Row actions (menu; hidden unless the caller has `users:manage` — everyone else gets a read-only roster):** `Edit profile` (toast `Profile editor` / `<name> — editing name, title, team and scope assignment.` — no endpoint; `// TODO(backend-contract)`), `Adjust permissions` (opens Task 80's dialog), `Suspend` (confirm dialog with an optional reason → `POST …/suspend`; toast `Account suspended` / `<email> — all active session tokens revoked immediately.`), `Reactivate` (toast `Account reactivated` / `<email> — new invitation issued for MFA re-enrolment.`), `Enforce MFA` (toast `MFA enforcement` / `<email> — enrolment challenge re-issued with 24-hour deadline.`), `Change role` (select + confirm → `PATCH …/role`), `Delete` (destructive confirm; toast `Account deletion queued` / `<email> — permanent removal scheduled after 30-day retention window.`). Self-targeting and last-super-admin errors from the API (`self_action`, `last_super_admin`) → toast `{ kind: "crit", title: "Action not allowed", message: "You cannot do this to your own account or the last Super Administrator." }`. Every state-changing action refreshes the roster and summary.

**Tests:** summary tiles; roster columns and chips for the ten fixture members; filters/URL; action menu visibility by permission; suspend confirm → API call → toast; last-super-admin error mapping.

---

**Data shape (TypeScript):**
```ts
// StaffMember, StaffSummary: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/users?… → 200 { data: StaffMember[]; total } · GET …/summary → 200 { data: StaffSummary }
// POST /api/v1/admin/users/:id/suspend | /reactivate | /enforce-mfa body { reason? } → 200 { data: StaffMember } | 409 { error: "self_action"|"last_super_admin"|"invalid_state" }
// PATCH /api/v1/admin/users/:id/role body { role } → 200 · DELETE /api/v1/admin/users/:id → 204
```

---

**Out of scope:**
- Do not build the provision/permission dialogs (Task 80) or the invitations/matrix (Task 79b).
- Do not build the profile editor.
- Do not show actions to users without `users:manage`.

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
☐ Report at the end: `Task 79 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 79b — Admin User & Access Management B: invitations panel and role/permission matrix

**Layer:** L9

**Prerequisites:** Task 31, Task 79

**Estimated files touched:** 6

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin User & Access Management B: invitations panel and role/permission matrix**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the invitations panel and the role/permission matrix, replacing the Task 79 stubs.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/users/_components/invitations-panel.tsx`, `role-matrix.tsx` — overwrite the stubs.
- MODIFY `apps/web/src/app/(authed)/admin/users/_styles/users.css` — append.
- `apps/web/src/app/(authed)/admin/users/users-b.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:**

##### Invitations column
```html
<aside class="um-col" aria-label="Team provisioning controls">
 <section class="adm-card adm-card--dark">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Provisioning Controls
    </h2>
    <p class="adm-card-note">Review the invitation summary and issue scoped access. All provisioning events are audited.</p>
   </div>
  </div>
  <div class="adm-card-body um-panel">
   <div class="um-panel-section">
    <span class="um-panel-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Invitation Summary
    </span>
    <div class="um-status-row">
     <span>Invitee</span>
     <strong id="um-summary-name">Not set</strong>
    </div>
    <div class="um-status-row">
     <span>Email</span>
     <strong id="um-summary-email">Not set</strong>
    </div>
    <div class="um-status-row">
     <span>Role</span>
     <strong id="um-summary-role">Security Analyst</strong>
    </div>
    <div class="um-status-row">
     <span>Team</span>
     <strong id="um-summary-team">Offensive Security</strong>
    </div>
    <div class="um-status-row">
     <span>Access tier</span>
     <strong id="um-summary-tier">Standard</strong>
    </div>
    <div class="um-status-row">
     <span>Checklist</span>
     <strong id="um-summary-checks">1 / 4</strong>
    </div>
   </div>
   <div class="um-panel-section">
    <span class="um-panel-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Actions
    </span>
    <div class="um-actions-stack">
     <button type="button" class="adm-btn adm-btn-ghost" id="um-save-draft">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Save Draft</span>
     </button>
     <button type="button" class="adm-btn adm-btn-dark" id="um-open-matrix">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Preview Permission Matrix</span>
     </button>
     <button type="button" class="adm-btn adm-btn-primary" id="um-send-invite">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Send Secure Invitation</span>
     </button>
    </div>
    <p class="um-action-note">Invitations expire after 72 hours if MFA enrolment is not completed.</p>
   </div>
  </div>
 </section>
 <section class="adm-card adm-card--dark" aria-labelledby="um-dist-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-dist-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Role Distribution
    </h2>
    <p class="adm-card-note">Active accounts per role across the platform.</p>
   </div>
   <span class="adm-tag">24 Active</span>
  </div>
  <div class="adm-card-body">
   <div class="um-dist">
    <div class="um-dist-row">
     <span class="um-dist-name">Security Analyst</span>
     <progress class="um-progress" value="11">11</progress>
     <span class="um-dist-count">11</span>
    </div>
    [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: SOC Operator ¦ 7 ¦ 7 || Administrator ¦ 3 ¦ 3 || Compliance Auditor ¦ 2 ¦ 2 || Support Engineer ¦ 1 ¦ 1 || Super Admin ¦ 1 ¦ 1]
   </div>
  </div>
 </section>
 <section class="adm-card" aria-labelledby="um-invites-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-invites-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Pending Invitations
    </h2>
    <p class="adm-card-note">Awaiting acceptance and MFA enrolment.</p>
   </div>
   <span class="adm-tag adm-tag--warn">4</span>
  </div>
  <div class="adm-card-body">
   <div class="um-invites">
    <article class="um-invite">
     <div class="um-invite-top">
      <span class="um-invite-email">a.mohamed@vunvault.com</span>
      <span class="um-role um-role--analyst">Analyst</span>
     </div>
     <div class="um-invite-meta">
      <span>Invited 22 Sep 2026</span>
      <span>Expires in 18 h</span>
     </div>
     <div class="um-invite-actions">
      <button type="button" class="um-mini-act">Resend</button>
      <button type="button" class="um-mini-act um-mini-act--danger">Revoke</button>
     </div>
    </article>
    [+2 more sibling <article> elements with the SAME structure as the one above; their text content in order: j.kariuki@vunvault.com ¦ Operator ¦ Invited 23 Sep 2026 ¦ Expires in 41 h ¦ Resend ¦ Revoke || m.ochieng@vunvault.com ¦ Auditor ¦ Invited 23 Sep 2026 ¦ Expires in 55 h ¦ Resend ¦ Revoke]
   </div>
   <div>
    <button type="button" class="adm-mini-btn" id="um-view-all-invites">View all 4 invitations</button>
   </div>
  </div>
 </section>
 <section class="adm-card adm-card--dark" aria-labelledby="um-activity-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-activity-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Recent Access Activity
    </h2>
    <p class="adm-card-note">Last six identity and permission events.</p>
   </div>
   <span class="adm-tag">Live</span>
  </div>
  <div class="adm-card-body">
   <div class="um-activity">
    <div class="um-activity-item">
     <span class="um-activity-dot um-activity-dot--ok"></span>
     <span class="um-activity-body">
      <span class="um-activity-text">
       <strong>a.njoroge</strong>
       signed in with hardware-key MFA.
      </span>
      <span class="um-activity-time">Today · 09:12 UTC</span>
     </span>
    </div>
    [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: k.kimani ¦ failed MFA enrolment challenge — third attempt. ¦ Today · 08:04 UTC || Role changed: ¦ d.mwangi ¦ elevated to Security Analyst — Automation. ¦ Today · 07:41 UTC || Account ¦ p.ndegwa ¦ suspended and all session tokens revoked. ¦ 12 Sep · 08:10 UTC || f.hassan ¦ completed quarterly access review attestation. ¦ 11 Sep · 15:26 UTC || Invitation issued to ¦ a.mohamed@vunvault.com ¦ — Security Analyst. ¦ 22 Sep · 11:02 UTC]
   </div>
  </div>
 </section>
</aside>
```
Custom CSS for this markup (reference):
```css
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.um-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.um-role { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.um-role::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.um-role--analyst { color: var(--brand-strong); background: var(--brand-tint); border-color: var(--brand-line); }
.um-panel { display: flex; flex-direction: column; gap: 16px; }
.um-panel-section { display: flex; flex-direction: column; gap: 12px; }
.um-panel-section + .um-panel-section { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.adm-card--dark .um-panel-section + .um-panel-section { border-top-color: rgba(255, 255, 255, 0.08); }
.um-panel-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .um-panel-title { color: #7d8b9e; }
.um-panel-title svg { color: var(--brand); flex: 0 0 auto; }
.um-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.74rem; font-weight: 600; color: var(--ink-soft); }
.adm-card--dark .um-status-row { color: #93a2b5; }
.um-status-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .um-status-row strong { color: #ffffff; }
.um-actions-stack { display: flex; flex-direction: column; gap: 10px; }
.um-actions-stack .adm-btn { width: 100%; }
.um-action-note { font-size: 10px; line-height: 1.6; color: var(--ink-faint); text-align: center; }
.adm-card--dark .um-action-note { color: #64748b; }
.um-dist { display: flex; flex-direction: column; gap: 10px; }
.um-dist-row { display: grid; grid-template-columns: minmax(96px, 1.2fr) minmax(60px, 2.6fr) auto; align-items: center; gap: 10px; }
.um-dist-name { font-size: 0.72rem; font-weight: 700; color: var(--ink); }
.adm-card--dark .um-dist-name { color: #e2e8f0; }
.um-dist-count { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; color: var(--brand-soft); min-width: 28px; text-align: right; }
progress.um-progress { appearance: none; -webkit-appearance: none; width: 100%; height: 7px; border: 0; border-radius: var(--r-full); overflow: hidden; background: rgba(255, 255, 255, 0.09); display: block; }
progress.um-progress::-webkit-progress-bar { background: rgba(255, 255, 255, 0.09); border-radius: var(--r-full); }
progress.um-progress::-webkit-progress-value { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
progress.um-progress::-moz-progress-bar { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
.um-activity { display: flex; flex-direction: column; gap: 12px; }
.um-activity-item { display: flex; align-items: flex-start; gap: 11px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255, 255, 255, 0.08); }
.um-activity-item:last-child { border-bottom: 0; padding-bottom: 0; }
.um-activity-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: 0 0 auto; background: var(--brand); box-shadow: 0 0 10px -2px var(--brand-glow); }
.um-activity-dot--ok { background: var(--ok); box-shadow: 0 0 10px -2px rgba(16, 185, 129, 0.9); }
.um-activity-body { min-width: 0; }
.um-activity-text { display: block; font-size: 0.72rem; line-height: 1.6; color: #cbd5e1; }
.um-activity-text strong { color: #ffffff; }
.um-activity-time { display: block; margin-top: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; color: #64748b; }
.um-invites { display: flex; flex-direction: column; gap: 10px; }
.um-invite { display: flex; flex-direction: column; gap: 6px; padding: 13px 14px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line-soft); transition: all 0.2s var(--ease); }
.um-invite:hover { transform: translateY(-2px); border-color: var(--brand-line); box-shadow: 0 14px 30px -22px var(--brand-glow); }
.um-invite-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.um-invite-email { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 80
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Role & permission matrix (+ intro card)
```html
<section class="adm-card" aria-labelledby="um-matrix-heading" id="um-matrix-anchor">
 <div class="adm-card-head">
  <div>
   <h2 class="adm-card-title" id="um-matrix-heading">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Role Permission Matrix
   </h2>
   <p class="adm-card-note">Toggle capability grants per role. Changes apply to every member holding that role after saving. Super Administrator permissions are immutable.</p>
  </div>
  <span class="adm-tag adm-tag--crit">Privileged Action</span>
 </div>
 <div class="adm-table-wrap">
  <table class="um-perm-matrix">
   <caption class="sr-only">Capability grants per role</caption>
   <thead>
    <tr>
     <th>Capability</th>
     <th>Super Admin</th>
     <th>Admin</th>
     <th>Analyst</th>
     <th>Operator</th>
     <th>Auditor</th>
     <th>Support</th>
    </tr>
   </thead>
   <tbody>
    <tr>
     <td class="um-perm-cat">Scan Operations</td>
    </tr>
    <tr>
     <td>Initiate system scan</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot initiate system scan"/>
     </td>
    </tr>
    <tr>
     <td>Manage scan queue</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot manage scan queue"/>
     </td>
    </tr>
    <tr>
     <td>Pause all workers</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot pause workers"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Review & Release</td>
    </tr>
    <tr>
     <td>Clear review gate</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot clear review gate"/>
     </td>
    </tr>
    <tr>
     <td>Release report to client</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot release report"/>
     </td>
    </tr>
    <tr>
     <td>Revoke released report</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot revoke report"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Zero-Day Advisory</td>
    </tr>
    <tr>
     <td>Draft advisory</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot draft advisory"/>
     </td>
    </tr>
    <tr>
     <td>Emergency broadcast</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot broadcast"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Identity & Administration</td>
    </tr>
    <tr>
     <td>Provision new members</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot provision"/>
     </td>
    </tr>
    <tr>
     <td>Edit role permissions</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot edit permissions"/>
     </td>
    </tr>
    <tr>
     <td>Read audit logs</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Auditor can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot read audit logs"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Client Data</td>
    </tr>
    <tr>
     <td>View client assets</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Auditor can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Support can view client assets"/>
     </td>
    </tr>
    <tr>
     <td>Export client evidence</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Auditor can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot export evidence"/>
     </td>
    </tr>
   </tbody>
   <tfoot>
    <tr>
     <td>Super Administrator capabilities are locked and cannot be modified. All other changes are audited.</td>
    </tr>
   </tfoot>
  </table>
 </div>
 <div class="adm-card-body">
  <span class="um-hint">Changes to the permission matrix apply globally to every member holding the affected role.</span>
  <div>
   <button type="button" class="adm-mini-btn" id="um-matrix-reset">Discard Changes</button>
   <button type="button" class="adm-btn adm-btn-primary" id="um-matrix-save">Save Permission Matrix</button>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.um-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.um-perm-matrix { width: 100%; border-collapse: collapse; font-size: 0.74rem; }
.um-perm-matrix thead th { padding: 10px 12px; text-align: center; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); background: #f6f8fb; border-bottom: 1px solid var(--line); white-space: nowrap; }
.um-perm-matrix thead th:first-child { text-align: left; min-width: 190px; }
.um-perm-matrix tbody td { padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--line-soft); }
.um-perm-matrix tbody td:first-child { text-align: left; font-weight: 700; color: var(--ink); }
.um-perm-matrix tbody tr:hover { background: var(--brand-tint); }
.um-perm-cat { background: #fbfcfd !important; font-size: 9px !important; font-weight: 800 !important; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint) !important; }
.um-perm-matrix .sq-check,
      .um-perm-matrix .um-check { appearance: none; -webkit-appearance: none; width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--line); background: #ffffff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.18s var(--ease); vertical-align: middle; }
.um-perm-matrix .um-check:hover { border-color: var(--brand-line); }
.um-perm-matrix .um-check:checked { background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; }
.um-perm-matrix .um-check:checked::after { content: ""; width: 5px; height: 9px; border: solid #ffffff; border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }
.um-perm-matrix .um-check:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.um-perm-matrix .um-check:disabled { opacity: 0.4; cursor: not-allowed; background: #f4f4f5; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .um-act, .um-icon-btn, .um-invite, .um-toast,
        .um-modal, .um-modal-window, .adm-hamburger-bar,
        .um-input, .um-select, .um-textarea { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
```

**Invitations panel:** pending invitations come from `GET /admin/users?status=pending_invite` (name, email, role label, `expires <relative>`); buttons `Resend` (`POST …/invitations/:id/resend`; toast `Invitation resent` / `<email> — secure invitation email re-dispatched.`), `Revoke` (`DELETE …/invitations/:id`; toast `Invitation revoked` / `<email> — pending invitation invalidated.`), link `All invitations` (informational toast `Opening the full invitation workspace — <n> pending.`). Both actions need `users:manage`; `409 resend_limit` → toast `Resend limit reached. Revoke and invite again.` (planner).
**Role matrix:** a table generated from `ROLE_PERMISSIONS` / `ROLE_LABELS` / `ROLE_DESCRIPTIONS` / `PERMISSIONS` (rows = capabilities, columns = roles, ✓ cells) — NOT hard-coded; keep the markup's column order and headings; the intro copy is verbatim.

**Tests:** panel lists pending invitations and calls the right endpoints; matrix derives from contracts (change a permission in a test double and see the cell change).

---

**Data shape (TypeScript):**
```ts
// Invitation: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/users/invitations/:id/resend → 200 { data: Invitation } | 409 resend_limit · DELETE …/invitations/:id → 204
```

---

**Out of scope:**
- Do not hard-code permission cells.
- Do not edit roster components.

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
☐ Report at the end: `Task 79b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 80 — Admin User & Access Management B: Provision New Team Member and permission override dialogs

**Layer:** L9

**Prerequisites:** Task 31, Task 79, Task 11, Task 10

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin User & Access Management B: Provision New Team Member and permission override dialogs**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the two dialogs of the users page: the scoped invitation form with the onboarding checklist, and the capability-override dialog.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/users/_components/provision-dialog.tsx`
- `apps/web/src/app/(authed)/admin/users/_components/permission-dialog.tsx`
- `apps/web/src/app/(authed)/admin/users/_hooks/use-provision.ts`
- MODIFY `apps/web/src/app/(authed)/admin/users/_styles/users.css` — append.
- MODIFY `apps/web/src/app/(authed)/admin/users/page.tsx` — mount the dialogs and the `Provision New Member` button.
- `apps/web/src/app/(authed)/admin/users/users-b.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup (search the first block for the `Provision New Team Member` dialog — it is part of the page body; the second block is the permission dialog):**

##### Provision New Member dialog (inside the page markup) — extracted by id
```html
<main class="adm-main">
 <div class="adm-shell">
  <div class="adm-page-head">
   <div>
    <span class="adm-eyebrow">Identity, Access & Provisioning</span>
    <h1 class="adm-page-title">User & Access Management</h1>
    <p class="adm-page-sub">Maintain the active staff roster of security analysts and operators, review role assignments and provision new team members with least-privilege access.</p>
   </div>
   <div class="adm-head-actions">
    <button type="button" class="adm-btn adm-btn-primary" id="um-invite-btn">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Provision New Member</span>
    </button>
    <button type="button" class="adm-btn adm-btn-dark" id="um-export-roster">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Export Roster</span>
    </button>
    <button type="button" class="adm-btn adm-btn-ghost" id="um-review-access">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Quarterly Access Review</span>
    </button>
   </div>
  </div>
  <section aria-labelledby="um-kpi-heading">
   <h2 id="um-kpi-heading" class="sr-only">Team and access indicators</h2>
   <div class="adm-kpi-grid">
    <article class="adm-kpi">
     <span class="adm-kpi-label">Active Team Members</span>
     <span class="adm-kpi-value">24</span>
     <span class="adm-kpi-delta adm-kpi-delta--up">▲ 3 onboarded this month</span>
    </article>
    [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Security Analysts ¦ 11 ¦ ● Pentest & red team || Operators ¦ 7 ¦ ● SOC & scan operations || Pending Invitations ¦ 4 ¦ ● Awaiting acceptance || MFA Enrolment ¦ 92 ¦ % ¦ 2 accounts without MFA || Dormant Accounts ¦ 2 ¦ ▲ 60+ days inactive · review]
   </div>
  </section>
  <div class="um-layout">
   <div class="um-col">
    <section class="um-toolbar" aria-labelledby="um-filter-heading">
     <div class="um-toolbar-head">
      <h2 class="um-toolbar-title" id="um-filter-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Search & Filter Roster
      </h2>
      <span class="um-results" role="status" aria-live="polite">
       Showing
       <strong id="um-visible-count">10</strong>
       of
       <strong id="um-total-count">10</strong>
       members
      </span>
     </div>
     <div class="um-toolbar-grid">
      <div class="um-field">
       <label class="um-field-label" for="um-search">Search</label>
       <div class="um-input-wrap">
        <span class="um-input-icon" aria-hidden="true">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </span>
        <input id="um-search" class="um-input" type="search" placeholder="Name, email, team or scope…" autocomplete="off"/>
       </div>
      </div>
      [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Role ¦ All roles ¦ Super Administrator ¦ Administrator ¦ Security Analyst ¦ SOC Operator ¦ Compliance Auditor ¦ Support Engineer || Account Status ¦ All statuses ¦ Active ¦ Pending Invite ¦ Suspended ¦ Dormant || MFA ¦ MFA — any ¦ Enrolled ¦ Not enrolled]
      <div class="um-toolbar-actions">
       <button type="button" class="um-clear-btn" id="um-clear-filters">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Reset</span>
       </button>
      </div>
     </div>
    </section>
    <section class="adm-card" aria-labelledby="um-roster-heading">
     <div class="adm-card-head">
      <div>
       <h2 class="adm-card-title" id="um-roster-heading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Active Staff Roster — Security Analysts & Operators
       </h2>
       <p class="adm-card-note">Every account with platform access, its assigned role, permitted scope and authentication posture.</p>
      </div>
      <span class="adm-tag adm-tag--ok">24 Active</span>
     </div>
     <div class="adm-table-wrap">
      <table class="adm-table um-table">
       <caption class="sr-only">Active staff roster of security analysts and operators with role, scope, MFA status and account state</caption>
       <thead>
        <tr>
         <th>Member</th>
         <th>Role</th>
         <th>Scope & Team</th>
         <th>MFA / Access</th>
         <th>Last Active</th>
         <th>Status</th>
         <th>Actions</th>
        </tr>
       </thead>
       <tbody id="um-tbody">
        <tr class="um-row">
         <td>
          <div class="um-identity">
           <span class="um-avatar" aria-hidden="true">ER</span>
           <span class="um-identity-body">
            <span class="um-name">Dr. Evelyn Reed</span>
            <span class="um-email">e.reed@vunvault.com</span>
            <span class="um-meta-line">Joined Mar 2024 · Nairobi HQ</span>
           </span>
          </div>
         </td>
         [+3 more sibling <td> elements with the SAME structure as the one above; their text content in order: Super Administrator || Full platform · All modules ¦ Incident commander · Final approval || MFA enrolled ¦ Hardware key]
         <td class="adm-mono">Now · 09:41</td>
         <td>
          <span class="adm-badge adm-badge--ok">Active</span>
         </td>
         <td>
          <div class="um-actions">
           <button type="button" class="um-act um-act--primary">Permissions</button>
           <button type="button" class="um-icon-btn" aria-label="Edit profile for Dr. Evelyn Reed">
            <svg data-icon="REPLACE-WITH-LUCIDE"/>
           </button>
           <button type="button" class="um-icon-btn" aria-label="Suspend account for Dr. Evelyn Reed">
            <svg data-icon="REPLACE-WITH-LUCIDE"/>
           </button>
          </div>
         </td>
        </tr>
        [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: AN ¦ Amara Njoroge ¦ a.njoroge@vunvault.com ¦ Joined Jun 2024 · Nairobi HQ ¦ Administrator ¦ Offensive Security · Pentest queue ¦ Red team lead · Review authority ¦ MFA enrolled ¦ TOTP ¦ 12 min ago ¦ Active ¦ Permissions || DM ¦ Daniel Mwangi ¦ d.mwangi@vunvault.com ¦ Joined Aug 2024 · Nairobi HQ ¦ Security Analyst ¦ Security Automation · Scan queue ¦ Enumeration agents · Patch validation ¦ MFA enrolled ¦ TOTP ¦ 38 min ago ¦ Active ¦ Permissions || FH ¦ Fatima Hassan ¦ f.hassan@vunvault.com ¦ Joined Jan 2025 · Remote — Mombasa ¦ Security Analyst ¦ Threat Intelligence · Zero-Day desk ¦ CVE curation · Advisory drafting ¦ MFA enrolled ¦ TOTP ¦ 1 h ago ¦ Active ¦ Permissions || BO ¦ Brian Otieno ¦ b.otieno@vunvault.com ¦ Joined Feb 2025 · Nairobi HQ ¦ SOC Operator ¦ SOC · Detection & triage ¦ Shift lead · Alert queue ¦ MFA enrolled ¦ TOTP ¦ 5 min ago ¦ Active ¦ Permissions || GW ¦ Grace Wanjiru ¦ g.wanjiru@vunvault.com ¦ Joined Apr 2025 · Nairobi HQ ¦ Compliance Auditor ¦ Audit Logs · Compliance reporting ¦ Read-only · No scan execution ¦ MFA enrolled ¦ TOTP ¦ Yesterday · 17:22 ¦ Active ¦ Permissions || KK ¦ Kevin Kimani ¦ k.kimani@vunvault.com ¦ Joined Jul 2025 · Remote — Kisumu ¦ SOC Operator ¦ SOC · Night shift monitoring ¦ Alert triage · Escalation ¦ MFA not enrolled ¦ Enrolment required ¦ 2 h ago ¦ Active ¦ Permissions ¦ Enforce MFA || AM ¦ Aisha Mohamed ¦ a.mohamed@vunvault.com ¦ Invited 22 Sep 2026 · Not yet accepted ¦ Security Analyst ¦ Offensive Security · Pentest queue ¦ Onboarding in progress ¦ Awaiting enrolment ¦ — ¦ Pending Invite ¦ Resend Invite ¦ Revoke || PN ¦ Peter Ndegwa ¦ p.ndegwa@vunvault.com ¦ Suspended 12 Sep 2026 · Offboarding ¦ Support Engineer ¦ Client Support · Ticketing only ¦ No scan or dashboard access ¦ MFA enrolled ¦ Tokens revoked ¦ 12 Sep · 08:10 ¦ Suspended ¦ Reactivate ¦ Delete || LA ¦ Lucy Achieng ¦ l.achieng@vunvault.com ¦ Last login 68 days ago ¦ SOC Operator ¦ SOC · Detection & triage ¦ Dormant · Access review due ¦ MFA enrolled ¦ Review required ¦ 68 days ago ¦ Dormant ¦ Permissions ¦ Suspend]
       </tbody>
       <tfoot>
        <tr>
         <td>Role changes, suspensions and permission edits are written to the immutable audit log with your administrator identity.</td>
        </tr>
       </tfoot>
      </table>
     </div>
     <div class="um-empty" id="um-empty">
      <span class="um-empty-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <span class="um-empty-title">No team members match the current filters</span>
      <span class="um-empty-text">Adjust your search terms or reset the filters to see the full staff roster.</span>
      <button type="button" class="adm-btn adm-btn-ghost" id="um-empty-reset">Reset Filters</button>
     </div>
    </section>
    <section class="adm-card" aria-labelledby="um-provision-heading" id="um-provision-anchor">
     <div class="adm-card-head">
      <div>
       <h2 class="adm-card-title" id="um-provision-heading">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Provision New Team Member
       </h2>
       <p class="adm-card-note">Issue a scoped invitation to a se
##### Permission override dialog
```html
<div id="um-perm-modal" class="um-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="um-perm-title">
 <div class="um-modal-backdrop"></div>
 <div class="um-modal-window" role="document">
  <div class="um-modal-head">
   <div>
    <span class="um-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Access Control — Privileged Action
    </span>
    <h2 class="um-modal-title" id="um-perm-title">Update member permissions</h2>
    <p class="um-modal-sub">
     <span id="um-perm-member">—</span>
     ·
     <span id="um-perm-role">—</span>
    </p>
   </div>
   <button type="button" class="um-modal-close" aria-label="Close permission editor">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="um-modal-body">
   <div>
    <div class="um-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Member Summary
    </div>
    <div class="um-modal-summary">
     <div class="um-modal-summary-item">
      <span class="um-modal-summary-label">Member</span>
      <span class="um-modal-summary-value" id="um-modal-name">—</span>
     </div>
     [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Current Role ¦ — || Assigned Scope ¦ —]
    </div>
   </div>
   <div>
    <div class="um-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Capability Overrides
    </div>
    <div class="um-ack-list">
     <label class="um-ack-item">
      <input type="checkbox" class="um-ovr"/>
      <span class="um-ack-text">
       <span class="um-ack-title">Initiate scans</span>
       <span class="um-ack-hint">Allow this member to submit new targets to the scan queue.</span>
      </span>
     </label>
     [+4 more sibling <label> elements with the SAME structure as the one above; their text content in order: Clear review gate ¦ Permit approval of penetration test results for client release. || Emergency broadcast ¦ Allow zero-day advisories to be dispatched to client dashboards. || Export client evidence ¦ Permit downloading of raw scan output and evidence packages. || Read audit logs ¦ Grant read-only visibility into the immutable audit trail.]
    </div>
   </div>
   <div class="um-ack-list">
    <label class="um-ack-item">
     <input type="checkbox" id="um-perm-ack"/>
     <span class="um-ack-text">
      <span class="um-ack-title">I confirm this access change is authorised</span>
      <span class="um-ack-hint">The change is written to the immutable audit log against your administrator identity.</span>
     </span>
    </label>
   </div>
  </div>
  <div class="um-modal-foot">
   <span class="um-modal-foot-note" id="um-perm-hint">Tick at least one capability override and confirm authorisation to save.</span>
   <div class="um-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-primary" id="um-perm-save" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Save Permission Change</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.um-actions-stack .adm-btn { width: 100%; }
.um-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.um-modal[hidden] { display: none !important; }
.um-modal.is-open { opacity: 1; }
.um-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.76); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.um-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(640px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.um-modal.is-open .um-modal-window { transform: translateY(0) scale(1); }
.um-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.2), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.um-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.um-modal-title { margin-top: 8px; font-size: 1.14rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
.um-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-word; }
.um-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.um-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.um-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.um-modal-body::-webkit-scrollbar { width: 8px; }
.um-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.um-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.um-modal-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.um-modal-summary { grid-template-columns: 1fr; }
}
.u
```

**Provision dialog (RHF + Zod `ProvisionInviteBody`; title `Provision New Team Member`, description and field labels verbatim as in the markup, i.e. `Full Name`, `Work Email` (helper `@vunvault.com domain`), `Job Title`, `Base / Location`, role select, team select (the six `TEAM_LABELS` of staff teams: `Offensive Security`, `SOC — Detection & Response`, `Threat Intelligence`, `Security Automation`, `Compliance & Audit`, `Client Support`), `Access tier`, `Access review due`, `Scope Notes` (helper `Visible to reviewers only`) and the onboarding checklist: `MFA enrolment mandatory` (checked, disabled), `NDA on file`, `Background verified`, `Training acknowledged`):** the role select lists ONLY staff roles; selecting `Super Administrator`/`Administrator` requires the caller to be a super admin (the API enforces; the UI disables those options for others). Live summary line (verbatim pattern): `<n> outstanding security requirement(s)` and the button states `Provisioning incomplete` (disabled) / `Send Secure Invitation`; secondary `Save Draft` (`draft: true`). Email must end `@vunvault.com` (message `Use a valid @vunvault.com work email.`). Success toast `Invitation sent` / `Secure invitation issued to <email>` and for drafts `Draft saved` / `<name> — stored privately.`; on `409 email_taken` field error `That email already has an account or invitation.`. The invite expiry hint `Expires in 72 hours` is displayed (verbatim `— expires in 72 hours.` tail from the strings).
**Permission override dialog:** shows the member, current role/permissions (from `ROLE_PERMISSIONS`), a list of capability override checkboxes (`PERMISSIONS` with human labels from the markup), an authorisation checkbox (`Confirm that this access change is authorised before saving.` as the error text when unchecked) and the status line copy from the strings (`Select at least one capability override to apply to this member.`, `Ready to save. The change is written to the immutable audit log.`). **There is NO per-user permission override endpoint in the API** — role is the only authority. Therefore this dialog is implemented as a *role change* UI: show a role select and the resulting permission diff (added/removed capabilities computed from `ROLE_PERMISSIONS`), and Save calls `PATCH …/role`; keep the verbatim authorisation requirement and toast `Permissions updated` / `<name> is now <Role label>.` Document the limitation in a comment: `// TODO(backend-contract): per-capability overrides are not supported; role changes only`.

**Tests:** disabled/enabled states and the outstanding-requirement counter; non-vunvault email rejected; draft vs send payloads; admin cannot pick `super_admin`; permission dialog shows the diff and calls the role endpoint with the authorisation checked.

---

**Data shape (TypeScript):**
```ts
// ProvisionInviteBody, ChangeRoleBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/users/invitations body ProvisionInviteBody → 201 { data: Invitation } | 400 | 403 | 409 email_taken
// PATCH /api/v1/admin/users/:id/role body { role } → 200 { data: StaffMember } | 409
```

---

**Out of scope:**
- Do not invent a per-user override API.
- Do not allow inviting non-@vunvault.com emails.
- Do not edit the roster components other than mounting.

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
☐ Report at the end: `Task 80 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 81 — Admin Zero-Day Intel A: summary, advisory editor, NVD import, drafts, recent advisories

**Layer:** L9

**Prerequisites:** Task 38, Task 46, Task 75

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Zero-Day Intel A: summary, advisory editor, NVD import, drafts, recent advisories**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/zero-day`: summary tiles, the advisory editor (CVE, vendor, CVSS, severity, flags, scope entries, summary, remediation, references), NVD import, the live client-view preview, drafts and the published-advisories table.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/zero-day/page.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_components/zd-summary.tsx`, `advisory-editor.tsx`, `scope-entries.tsx`, `severity-picker.tsx`, `client-preview.tsx`, `drafts-panel.tsx`, `recent-advisories.tsx`, `patch-status-menu.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_hooks/use-advisories-admin.ts`
- `apps/web/src/app/(authed)/admin/zero-day/_lib/cvss.ts` — `severityFromCvss`, band hints.
- `apps/web/src/app/(authed)/admin/zero-day/_styles/zero-day.css`
- `apps/web/src/mocks/handlers/admin-advisories.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/zero-day/zero-day-a.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup (the Emergency Broadcast dialog is Task 82):**

##### Zero-Day Intel page body (editor, side panels, recent advisories)
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Zero-Day Intelligence & Advisory Desk</span>
   <h1 class="adm-page-title">Zero-Day Advisory Editor</h1>
   <p class="adm-page-sub">
    Draft, review and broadcast zero-day advisories. Save work in progress as a draft, or raise an emergency broadcast that pushes the advisory to every affected client dashboard within seconds.
   </p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-ghost" id="zd-new-advisory">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>New Advisory</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="zd-import-cve">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Import From NVD</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="zd-view-history">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Broadcast History</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="zd-kpi-heading">
  <h2 id="zd-kpi-heading" class="sr-only">Zero-day intelligence indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Active Zero-Days</span>
    <span class="adm-kpi-value">1,284</span>
    <span class="adm-kpi-delta adm-kpi-delta--down">▲ 62 this week</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Critical Severity ¦ 46 ¦ 9 currently unpatched || Weaponized In Wild ¦ 37 ¦ ● Active exploitation confirmed || Advisories Published ¦ 418 ¦ ▲ 12 broadcast this month || Open Drafts ¦ 7 ¦ ● 3 escalated for review || Dashboards Reached ¦ 312 ¦ ▲ 18 new clients this month]
  </div>
 </section>
 <div class="zd-layout">
  <div class="zd-col">
   <section class="adm-card" aria-labelledby="zd-editor-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-editor-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Advisory Editor
      </h2>
      <p class="adm-card-note">Complete the CVE details, set the severity level and define the affected scope. Drafts are private to the intelligence team until explicitly broadcast.</p>
     </div>
     <span class="adm-tag" id="zd-draft-tag">Draft — Not Published</span>
    </div>
    <div class="adm-card-body">
     <form class="zd-form" id="zd-form">
      <fieldset class="zd-fieldset">
       <legend class="zd-legend">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Identifiers
       </legend>
       <div class="zd-row">
        <div class="zd-field">
         <label class="zd-label" for="zd-cve">
          <span>
           CVE ID
           <span class="zd-label-req" aria-hidden="true">*</span>
          </span>
          <span class="zd-hint">Format: CVE-YYYY-NNNNN</span>
         </label>
         <input id="zd-cve" class="zd-input zd-mono" type="text" name="cve" placeholder="CVE-2026-21447" autocomplete="off" required aria-describedby="zd-cve-error"/>
         <span class="zd-hint" id="zd-cve-error" hidden>Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.</span>
        </div>
        <div class="zd-field">
         <label class="zd-label" for="zd-vendor">
          <span>Vendor / Project</span>
         </label>
         <input id="zd-vendor" class="zd-input" type="text" name="vendor" placeholder="Apache Software Foundation" autocomplete="off"/>
        </div>
       </div>
       <div class="zd-row">
        <div class="zd-field">
         <label class="zd-label" for="zd-cvss">
          <span>CVSS v3.1 Base Score</span>
          <span class="zd-hint">0.0 – 10.0</span>
         </label>
         <input id="zd-cvss" class="zd-input zd-mono" type="text" name="cvss" placeholder="9.8" inputmode="decimal" autocomplete="off" maxlength="4"/>
        </div>
        <div class="zd-field">
         <label class="zd-label" for="zd-published">
          <span>Disclosure Date (UTC)</span>
         </label>
         <input id="zd-published" class="zd-input zd-mono" type="date" name="published"/>
        </div>
       </div>
      </fieldset>
      [+4 more sibling <fieldset> elements with the SAME structure as the one above; their text content in order: Severity Level ¦ Critical ¦ CVSS 9.0 – 10.0 ¦ High ¦ CVSS 7.0 – 8.9 ¦ Medium ¦ CVSS 4.0 – 6.9 ¦ Low ¦ CVSS 0.1 – 3.9 ¦ Weaponized in the wild ¦ Public PoC available ¦ Pre-auth exploitable ¦ Vendor patch available || Advisory Title ¦ Headline ¦ * ¦ 0 / 140 ¦ An advisory title is required before saving or broadcasting. ¦ Use the pattern: ¦ Product — impact in plain language ¦ . Avoid exploit detail in the headline. || Affected Scope ¦ Affected Products, Versions, Platforms or Hosts ¦ Press Enter to add ¦ Add ¦ Quick add: ¦ Web & API ¦ Network & Edge ¦ Endpoint / Desktop ¦ Cloud & Containers ¦ Mobile ¦ OT / ICS ¦ Identity & SSO ¦ Add every product, version range, platform or client host class the advisory applies to. The broadcast engine matches these against client asset inventories. || Technical Summary & Guidance ¦ Technical Summary ¦ 0 / 1200 ¦ Remediation Guidance ¦ 0 / 900 ¦ References ¦ One URL per line]
     </form>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="zd-published-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-published-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Recently Published Advisories
      </h2>
      <p class="adm-card-note">Last six advisories pushed to client dashboards, with broadcast reach and remediation state.</p>
     </div>
     <span class="adm-tag adm-tag--ok">418 Published</span>
    </div>
    <div class="adm-table-wrap">
     <table class="adm-table zd-table">
      <caption class="sr-only">Recently published zero-day advisories</caption>
      <thead>
       <tr>
        <th>CVE ID</th>
        <th>Advisory Title</th>
        <th>Severity</th>
        <th>Broadcast</th>
        <th class="adm-num">Reach</th>
        <th>Status</th>
        <th>Actions</th>
       </tr>
      </thead>
      <tbody>
       <tr>
        <td class="adm-mono">CVE-2026-21447</td>
        <td>
         <span class="zd-advisory-title">Apache Struts 2 — OGNL injection RCE</span>
         <span class="zd-advisory-scope">Web & API · Struts 2.0.0 – 2.5.32</span>
        </td>
        <td>
         <span class="zd-sev-pill zd-sev-pill--critical">Critical</span>
        </td>
        <td class="adm-mono">24 Sep · 14:36</td>
        <td class="adm-num adm-strong">312</td>
        <td>
         <span class="adm-badge adm-badge--crit">Unpatched</span>
        </td>
        <td>
         <div class="zd-row-actions">
          <button type="button" class="zd-act">Edit</button>
          <button type="button" class="zd-act">Re-broadcast</button>
          <button type="button" class="zd-act zd-act--danger">Retract</button>
         </div>
        </td>
       </tr>
       [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: CVE-2026-0091 ¦ Cisco IOS XE — Web UI authentication bypass ¦ Network & Edge · IOS XE 17.x ¦ Critical ¦ 24 Sep · 14:35 ¦ 284 ¦ Patch in progress ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2026-3327 ¦ Oracle WebLogic — deserialization RCE ¦ Web & API · WebLogic 12.2.1.x ¦ High ¦ 24 Sep · 14:32 ¦ 196 ¦ Unpatched ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2026-18820 ¦ Windows Print Spooler — privilege escalation ¦ Endpoint / Desktop · Windows 10 / 11 ¦ High ¦ 24 Sep · 14:28 ¦ 298 ¦ Patched ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2025-53112 ¦ Google Chrome V8 — type confusion in JIT ¦ Endpoint / Desktop · Chrome < 128.0.6 ¦ Critical ¦ 24 Sep · 14:25 ¦ 305 ¦ Patched ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2026-1104 ¦ Linux Kernel io_uring — use-after-free ¦ OT / ICS · Kernel 6.4 – 6.9 ¦ High ¦ 24 Sep · 14:21 ¦ 152 ¦ Patched ¦ Edit ¦ Re-broadcast ¦ Retract]
      </tbody>
      <tfoot>
       <tr>
        <td>Broadcast reach counts unique client dashboards that acknowledged the advisory within 24 hours.</td>
       </tr>
      </tfoot>
     </table>
    </div>
   </section>
  </div>
  <aside class="zd-col" aria-label="Advisory publishing controls">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Publish Controls
      </h2>
      <p class="adm-card-note">Save the advisory as a private draft, or raise an emergency broadcast to every affected client dashboard.</p>
     </div>
    </div>
    <div class="adm-card-body zd-panel">
     <div class="zd-panel-section">
      <span class="zd-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Editorial State
      </span>
      <div class="zd-status-row">
       <span>Current status</span>
       <strong id="zd-status-value">Draft</strong>
      </div>
      <div class="zd-status-row">
       <span>Last saved</span>
       <strong id="zd-last-saved">Never</strong>
      </div>
      <div class="zd-status-row">
       <span>Severity set</span>
       <strong id="zd-severity-value">Not set</strong>
      </div>
      <div class="zd-status-row">
       <span>Scope entries</span>
       <strong id="zd-scope-count">0</strong>
      </div>
      <div class="zd-status-row">
       <span>Author</span>
       <strong>e.reed</strong>
      </div>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Actions ¦ Save Draft ¦ Preview Client View ¦ Emergency Broadcast ¦ Broadcasts are irreversible once dispatched. Verify the severity and scope before confirming. || Emergency broadcast ¦ pushes the advisory to every matching client dashboard, issues email and SMS alerts to registered contacts, and opens a SEV-1 audit event. || Estimated Broadcast Reach ¦ Client dashboards ¦ 312 ¦ Email contacts ¦ 486 ¦ SMS / on-call ¦ 74 ¦ Incident commander ¦ 1]
    </div>
   </section>
   <section class="adm-card" aria-labelledby="zd-drafts-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-drafts-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Open Drafts
      </h2>
      <p class="adm-card-note">Work in progress, private to the intelligence team.</p>
     </div>
     <span class="adm-tag adm-tag--warn">7</span>
    </div>
    <div class="adm-card-body">
     <div class="zd-drafts">
      <article class="zd-draft" tabindex="0">
       <div class="zd-draft-top">
        <span class="zd-draft-cve">CVE-2026-40118</span>
        <span class="zd-sev-pill zd-sev-pill--critical">Critical</span>
       </div>
       <span class="zd-draft-title">Kubernetes ingress-nginx — admission webhook bypass</span>
       <div class="zd-draft-meta">
        <span>e.reed · 12 min ago</span>
        <span>Unsaved changes</span>
       </div>
      </article>
      [+2 more sibling <article> elements with the SAME structure as the one above; their text content in order: CVE-2026-39980 ¦ High ¦ PostgreSQL — privilege escalation via extension loading ¦ f.hassan · 2 hours ago ¦ Awaiting reviewer || CVE-2026-38771 ¦ Medium ¦ Redis — ACL bypass in sentinel failover path ¦ d.mwangi · Yesterday ¦ Needs scope entries]
     </div>
     <div>
      <button type="button" class="adm-mini-btn" id="zd-view-all-drafts">View all 7 drafts</button>
     </div>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="zd-preview-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-preview-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Client Dashboard Preview
      </h2>
      <p class="adm-card-note">Live rendering of how this advisory appears to clients.</p>
     </div>
    </div>
    <div class="adm-card-body">
     <div class="zd-preview">
      <div class="zd-preview-top">
       <span class="zd-preview-cve" id="zd-prev-cve">CVE-XXXX-XXXXX</span>
       <span class="zd-preview-sev zd-preview-sev--none" id="zd-prev-sev">No severity</span>
      </div>
      <span class="zd-preview-title is-placeholder" id="zd-prev-title">Advisory title will appear here</span>
      <div class="zd-preview-scope" id="zd-prev-scope">
       <span class="zd-preview-chip">No scope entries</span>
      </div>
      <div class="zd-preview-foot">
       <span>Source: VUNVAULT Intelligence</span>
       <span id="zd-prev-date">Not dated</span>
      </div>
     </div>
    </div>
   </section>
  </aside>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: top; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.zd-layout { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.zd-layout { grid-template-columns: 1fr; }
}
.zd-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.zd-form { display: flex; flex-direction: column; gap: 22px; }
.zd-fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.zd-legend { display: flex; align-items: center; gap: 9px; padding: 0; margin-bottom: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.zd-legend::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line-soft); }
.zd-legend svg { color: var(--brand); flex: 0 0 auto; }
.zd-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 760px) {
.zd-row, .zd-row--3 { grid-template-columns: 1fr; }
}
.zd-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.zd-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.zd-label-req { color: #be123c; font-size: 11px; line-height: 1; }
.zd-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.zd-input,
      .zd-select,
      .zd-textarea { width: 100%; padding: 12px 14px; font-size: 0.82rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background-color var(--dur) var(--ease); }
.zd-input::placeholder,
      .zd-textarea::placeholder { color: var(--ink-faint); }
.zd-input:focus,
      .zd-select:focus,
      .zd-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.zd-input.is-invalid,
      .zd-select.is-invalid,
      .zd-textarea.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); animation: zdShake 0.32s var(--ease); }
.zd-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.01em; }
.zd-scope-input-row .zd-input { flex: 1 1 auto; }
.zd-panel { display: flex; flex-direction: column; gap: 16px; }
.zd-panel-section { display: flex; flex-direction: column; gap: 12px; }
.zd-panel-section + .zd-panel-section { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.adm-card--dark .zd-panel-section + .zd-panel-section { border-top-color: rgba(255, 255, 255, 0.08); }
.zd-panel-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .zd-panel-title { color: #7d8b9e; }
.zd-panel-title svg { color: var(--brand); flex: 0 0 auto; }
.zd-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.74rem; font-weight: 600; color: var(--ink-soft); }
.adm-card--dark .zd-status-row { color: #93a2b5; }
.zd-status-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .zd-status-row strong { color: #ffffff; }
.zd-actions-stack .adm-btn { width: 100%; }
.adm-card--dark .zd-action-note { color: #64748b; }
.zd-drafts { display: flex; flex-direction: column; gap: 10px; }
.zd-draft { display: flex; flex-direction: column; gap: 5px; padding: 13px 14px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line-soft); cursor: pointer; transition: all 0.2s var(--ease); }
.zd-draft:hover { transform: translateY(-2px); border-color: var(--brand-line); box-shadow: 0 14px 30px -22px var(--brand-glow); }
.zd-draft-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.zd-draft-cve { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 800; color: var(--ink); }
.zd-draft-title { font-size: 0.72rem; line-height: 1.5; color: var(--ink-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.zd-draft-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 9.5px; font-weight: 700; color: var(--ink-faint); }
.zd-preview { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 14px; background: linear-gradient(160deg, rgba(59, 153, 252, 0.06), rgba(10, 13, 18, 0.02)); border: 1px solid var(--brand-line); }
.zd-preview-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.zd-preview-cve { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.78rem; font-weight: 800; color: var(--brand-strong); letter-spacing: 0.02em; }
.zd-preview-sev { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: var(--r-full); border: 1px solid transparent; }
.zd-preview-sev--none { color: var(--ink-muted); background: #f4f4f5; border-color: var(--line); }
.zd-preview-title { font-size: 0.92rem; font-weight: 800; line-height: 1.4; color: var(--ink); }
.zd-preview-title.is-placeholder { color: var(--ink-faint); font-style: italic; font-weight: 600; }
.zd-preview-scope { display: flex; flex-wrap: wrap; gap: 6px; }
.zd-preview-chip { padding: 4px 10px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); }
.zd-preview-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px dashed var(--line); font-size: 9.5px; font-weight: 700; color: var(--ink-faint); }
.zd-table { min-width: 960px; }
.zd-sev-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.zd-sev-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.zd-sev-pill--critical { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.zd-advisory-title { display: block; font-size: 0.78rem; font-weight: 700; color: var(--ink); line-height: 1.45; }
.zd-advisory-scope { display: block; margin-top: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; color: var(--ink-muted); }
.zd-row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.zd-act { display: inline-flex; align-items: center; gap: 6px; padding: 7p
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Remove scope entry:`
- `Already in scope`
- `Scope updated`
- `No scope entries`
- `Advisory title will appear here`
- `Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.`
- `acknowledgement(s) still outstanding before broadcast can proceed.`
- `All acknowledgements complete — type "`
- `" to unlock the broadcast button.`
- `All checks complete. Broadcasting will dispatch the advisory immediately and cannot be undone.`
- `a valid CVE identifier`
- `an advisory title`
- `a severity level`
- `at least one scope entry`
- `Advisory incomplete`
- `before raising an emergency broadcast.`
- `Emergency broadcast dispatched`
- `pushed to 312 client dashboards, 486 email contacts and 74 on-call SMS numbers.`
- `Audit event recorded`
- `SEV-1 broadcast event written with session reference ADM-2026-0924-7F3A.`
- `Nothing to save`
- `Add at least a CVE identifier before saving this advisory as a draft.`
- `Draft saved`
- `stored privately. Only the intelligence team can see it until broadcast.`
- `Client view preview`
- `Opening a read-only rendering of the advisory as clients would see it.`
**Editor (RHF + Zod `AdvisoryDraftBody`/`AdvisoryPublishable`):** fields and labels verbatim from the markup. CVE field validates `^CVE-\d{4}-\d{4,}$` with the verbatim message `Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.`; `Import from NVD` button → `GET /admin/advisories/nvd?cveId=` pre-fills vendor, CVSS, severity, disclosure date, title, summary, references (never auto-saves; toast `NVD data imported` / `Review the imported fields before saving.` (planner); `404` → `CVE not found in NVD.`; `502` → `NVD is unavailable. Enter the details manually.`). Severity picker (`Critical`/`High`/`Medium`/`Low` with the `SEVERITY_CVSS_HINTS`) auto-selects from CVSS but can be set manually; a mismatch shows the warning `Severity does not match the CVSS score.`. Four flag toggles (`Weaponized`, `Public PoC`, `Pre-auth`, `Patch available` — labels from the markup). **Scope entries:** type + Enter adds a chip (max 50; duplicate → toast `Already in scope` / `"<entry>" is already listed.`), optional category select from `SCOPE_CATEGORY_LABELS`, remove buttons have `aria-label="Remove scope entry: <entry>"`. Counters: summary ≤ 1200, remediation ≤ 900, title ≤ 140. **Live client preview** (right column) renders the advisory exactly as `ClientAdvisory` cards do (Task 70) with placeholders `Advisory title will appear here`, `No scope entries`, severity chip `none` state; the `Preview as client` button toasts `Client view preview` / `Opening a read-only rendering of the advisory as clients would see it.`.
**Save Draft:** disabled/toast when only empty: `Nothing to save` / `Add at least a CVE identifier before saving this advisory as a draft.`; otherwise `POST /admin/advisories` (create) or `PUT …/:id` and toast `Draft saved` / `<CVE> stored privately. Only the intelligence team can see it until broadcast.`; `409 cve_exists` → field error `An advisory for this CVE already exists.`. `Clear editor` → toast `Editor cleared` / `Ready for a new zero-day advisory.`. Autosave is NOT used.
**Drafts panel:** `GET /admin/advisories/drafts` rows (CVE, title, author, `note` chip when present) — clicking loads the draft into the editor (`PUT` afterwards). **Recent published advisories:** `GET /admin/advisories?status=published` table (CVE, title/scope, severity chip, broadcast time, `reach` as `<n> dashboards`, patch status with an inline menu → `PATCH …/patch-status` for users with `intel:write`; `Retract` for `intel:broadcast` users opens a confirm dialog with a required note ≥ 10 → `POST …/retract`). Summary tiles from `GET /admin/advisories/summary`.
**Permissions:** the `Emergency Broadcast` area is visible only with `intel:broadcast`; analysts (`intel:write`) can draft and save.

**Tests:** CVE message; NVD import fills fields without saving; severity/CVSS mismatch warning; scope add/duplicate/remove with the verbatim toast; draft create vs update; drafts panel load; patch-status change; permission gating.

---

**Data shape (TypeScript):**
```ts
// AdvisoryDraftBody, Advisory, AdvisorySummary, DraftListItem, NvdImportResult: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/advisories/summary · /drafts · /nvd?cveId= · ?status= … (see contracts)
// POST /api/v1/admin/advisories → 201 | 409 cve_exists · PUT /api/v1/admin/advisories/:id → 200 | 409 not_editable
// PATCH /api/v1/admin/advisories/:id/patch-status { patchStatus } → 200 · POST …/retract { note } → 200
```

---

**Out of scope:**
- Do not broadcast from this task (Task 82).
- Do not auto-publish NVD data.
- Do not use browser storage for drafts.

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
☐ Report at the end: `Task 81 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 82 — Admin Zero-Day Intel B: irreversible Emergency Broadcast dialog

**Layer:** L9

**Prerequisites:** Task 38, Task 81, Task 11

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Zero-Day Intel B: irreversible Emergency Broadcast dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Emergency Broadcast confirmation dialog with audience estimate, five acknowledgements, typed confirmation and SEV-1 result.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/zero-day/_components/broadcast-dialog.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_components/ack-checklist.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_hooks/use-broadcast.ts`
- MODIFY `apps/web/src/app/(authed)/admin/zero-day/_styles/zero-day.css` — append.
- MODIFY `apps/web/src/app/(authed)/admin/zero-day/_components/advisory-editor.tsx` — wire the `Emergency Broadcast` button.
- `apps/web/src/app/(authed)/admin/zero-day/broadcast.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:**

##### Emergency broadcast dialog
```html
<div id="zd-broadcast-modal" class="zd-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="zd-broadcast-title">
 <div class="zd-modal-backdrop"></div>
 <div class="zd-modal-window" role="document">
  <div class="zd-modal-head">
   <div>
    <span class="zd-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Emergency Broadcast — Irreversible
    </span>
    <h2 class="zd-modal-title" id="zd-broadcast-title">Confirm advisory broadcast</h2>
    <p class="zd-modal-sub">
     This pushes the advisory to every matching client dashboard, dispatches email and SMS alerts, and opens a SEV-1 audit event. It cannot be undone — only retracted with a follow-up notice.
    </p>
   </div>
   <button type="button" class="zd-modal-close" aria-label="Close broadcast confirmation">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="zd-modal-body">
   <div>
    <div class="zd-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Advisory Being Broadcast
    </div>
    <div class="zd-modal-summary">
     <div class="zd-modal-summary-item">
      <span class="zd-modal-summary-label">CVE ID</span>
      <span class="zd-modal-summary-value" id="zd-modal-cve">—</span>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Severity ¦ — || Advisory Title ¦ — || Affected Scope ¦ —]
    </div>
   </div>
   [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Immediate Reach ¦ 312 ¦ Client Dashboards ¦ 486 ¦ Email Contacts ¦ 74 ¦ SMS / On-call || Pre-Broadcast Acknowledgement ¦ Severity level is correct ¦ The assigned severity matches the CVSS base score and observed exploitation status. ¦ Affected scope is complete ¦ Every affected product, version range and platform is listed — no over- or under-matching. ¦ Content is safe for client distribution ¦ No unredacted exploit code, internal credentials or third-party confidential data is included. ¦ Remediation guidance is actionable ¦ Immediate mitigations and the permanent fix are both documented for clients. ¦ I am authorised to issue emergency broadcasts ¦ This action is recorded against your administrator identity and cannot be revoked.]
   <div class="zd-confirm-word-field">
    <label class="zd-label" for="zd-confirm-word">
     <span>
      Type
      <strong>BROADCAST</strong>
      to confirm
     </span>
    </label>
    <input id="zd-confirm-word" class="zd-confirm-word" type="text" placeholder="BROADCAST" autocomplete="off" aria-describedby="zd-confirm-hint"/>
    <span class="zd-hint" id="zd-confirm-hint">The confirmation phrase is case-insensitive and required before the broadcast button unlocks.</span>
   </div>
  </div>
  <div class="zd-modal-foot">
   <span class="zd-modal-foot-note" id="zd-modal-hint">Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.</span>
   <div class="zd-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-danger" id="zd-confirm-broadcast" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Broadcast Now</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-btn-danger { color: #ffffff; background: linear-gradient(135deg, var(--critical), #be123c); border-color: rgba(244, 63, 94, 0.55); box-shadow: 0 14px 30px -16px rgba(244, 63, 94, 0.7); }
.adm-btn-danger:hover { transform: translateY(-2px); filter: brightness(1.07); box-shadow: 0 20px 40px -18px rgba(244, 63, 94, 0.85); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.zd-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.zd-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.zd-actions-stack .adm-btn { width: 100%; }
.zd-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.zd-modal[hidden] { display: none !important; }
.zd-modal.is-open { opacity: 1; }
.zd-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.zd-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(700px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid rgba(244, 63, 94, 0.3); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.zd-modal.is-open .zd-modal-window { transform: translateY(0) scale(1); }
.zd-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 22px 18px; background: radial-gradient(90% 140% at 100% 0%, rgba(244, 63, 94, 0.28), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.zd-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #fb7185; }
.zd-modal-title { margin-top: 8px; font-size: 1.14rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
.zd-modal-sub { margin-top: 6px; font-size: 11px; line-height: 1.6; color: #93a2b5; max-width: 54ch; }
.zd-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.zd-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.zd-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(244, 63, 94, 0.35) transparent; }
.zd-modal-body::-webkit-scrollbar { width: 8px; }
.zd-modal-body::-webkit-scrollbar-thumb { background: rgba(244, 63, 94, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.zd-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.zd-modal-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.zd-modal-summary { grid-template-columns: 1fr; }
}
.zd-modal-summary-item { padding: 13px 15px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line-soft); }
.zd-modal-summary-label { display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.zd-modal-summary-value { display: block; margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8rem; font-weight: 800; color: var(--ink); word-break: break-word; }
.zd-confirm-word-field { display: flex; flex-direction: column; gap: 8px; }
.zd-confirm-word { width: 100%; padding: 13px 15px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; text-align: center; color: var(--ink); background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; outline: none; transition: all 0.2s var(--ease); }
.zd-confirm-word::placeholder { color: rgba(159, 18, 57, 0.35); letter-spacing: 0.16em; }
.zd-confirm-word:focus { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.zd-confirm-word.is-valid { background: #ecfdf5; border-color: var(--ok); }
.zd-modal-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 22px; background: #f8fafc; border-top: 1px solid var(--line-soft); }
.zd-modal-foot-note { font-size: 10.5px; color: var(--ink-muted); max-width: 46ch; line-height: 1.6; }
.zd-modal-foot-actions { display: flex; flex-wrap: wrap; gap: 10px; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .zd-act, .zd-tag, .zd-draft, .zd-toast,
        .zd-modal, .zd-modal-window, .adm-hamburger-bar,
        .zd-input, .zd-select, .zd-textarea { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .zd-actions-stack,
        .zd-modal, .zd-toast-stack, .zd-row-actions { display: none !important; }
}
```

**Pre-checks (before the dialog opens):** the advisory must be saved (a draft id exists — otherwise save first) and complete: missing items produce the verbatim toast `Advisory incomplete` / `Complete <list from: a valid CVE identifier, an advisory title, a severity level, at least one scope entry> before raising an emergency broadcast.` — build the list from those four phrases.
**Dialog:** `Dialog` primitive; the audience estimate from `POST /admin/advisories/:id/estimate` (`dashboards`, `emailContacts`, `smsContacts`, `incidentCommanders`) shown in the summary strip; five acknowledgement checkboxes with the verbatim titles and descriptions from `BROADCAST_ACK_LABELS`; a text input `Type BROADCAST to confirm` (case-insensitive match against `BROADCAST_CONFIRM_PHRASE`); status line (verbatim): `Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.` → `<n> acknowledgement(s) still outstanding before broadcast can proceed.` → `All acknowledgements complete — type "BROADCAST" to unlock the broadcast button.` → `All checks complete. Broadcasting will dispatch the advisory immediately and cannot be undone.`; the confirm button is the danger variant `Broadcast Now` and stays disabled until the contract rule (`EmergencyBroadcastBody`) holds. `Cancel` closes.
**Submit:** `POST /admin/advisories/:id/broadcast { ack, confirmPhrase }` → `202 BroadcastRecord`; success toasts (verbatim): `Emergency broadcast dispatched` / `<CVE> pushed to <dashboards> client dashboards, <emailContacts> email contacts and <smsContacts> on-call SMS numbers.` and `Audit event recorded` / `SEV-1 broadcast event written with session reference <ADM-YYYY-MMDD-XXXX>.` (reference computed as in Task 46); then close, refresh the advisory lists, and show a delivery progress strip polling `GET /admin/advisories/:id/broadcasts` every 3 s until `status` is `sent`/`failed` (`Delivering… <sent>/<audience>`); the push version comes in Layer L12. Errors: `400 validation_failed` (never expected) → stay open; `403` → `Only administrators can issue emergency broadcasts.`; `409 broadcast_in_progress` → `A broadcast for this advisory was just sent. Wait a minute before sending another.`; `422 advisory_incomplete` → the same incomplete toast with the API's `details`. The dialog cannot be dismissed by clicking the backdrop once the request is in flight. **Re-broadcast** for published advisories uses the same dialog with title `Re-broadcast advisory` and `POST …/rebroadcast`.

**Tests:** confirm locked until five acks + phrase; wrong phrase locked; status line text transitions; success toasts with real counts; 409 and 422 mapping; the incomplete pre-check message lists exactly the missing items; backdrop click ignored while pending.

---

**Data shape (TypeScript):**
```ts
// EmergencyBroadcastBody, BroadcastEstimate, BroadcastRecord: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/advisories/:id/estimate → 200 { data: BroadcastEstimate }
// POST /api/v1/admin/advisories/:id/broadcast | /rebroadcast body { ack: {severityCorrect, scopeComplete, contentSafe, remediationActionable, authorised: true}; confirmPhrase: "BROADCAST" } → 202 { data: BroadcastRecord } | 403 | 409 broadcast_in_progress | 422 advisory_incomplete
// GET /api/v1/admin/advisories/:id/broadcasts → 200 { data: BroadcastRecord[] }
```

---

**Out of scope:**
- Do not add a way to cancel a broadcast.
- Do not enable the confirm button early.
- Do not implement SSE (Layer L12).

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
☐ Report at the end: `Task 82 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 83 — Admin Content Moderation: queue, filters and editorial review dialog

**Layer:** L9

**Prerequisites:** Task 36, Task 46, Task 75, Task 12, Task 11

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Content Moderation: queue, filters and editorial review dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/content`: summary tiles, filterable review queue with risk flags and the editorial review dialog with five checks and decisions (approve, request changes, reject, publish, schedule, remind author).

**Deliverables:**
- `apps/web/src/app/(authed)/admin/content/page.tsx`
- `apps/web/src/app/(authed)/admin/content/_components/content-summary.tsx`, `content-toolbar.tsx`, `content-table.tsx`, `review-dialog.tsx`, `editorial-checks.tsx`, `risk-flags.tsx`, `row-actions.tsx`
- `apps/web/src/app/(authed)/admin/content/_hooks/use-moderation.ts`
- `apps/web/src/app/(authed)/admin/content/_styles/content.css`
- `apps/web/src/mocks/handlers/admin-content.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/content/content.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:**

##### Content Moderation page body
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Pre-Publication Review Queue</span>
   <h1 class="adm-page-title">Content Moderation</h1>
   <p class="adm-page-sub">Every blog post, news announcement, threat advisory and product listing authored by staff must clear editorial review before it renders live on the public website.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="cm-review-next">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Review Next Item</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="cm-export-queue">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Review Log</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="cm-refresh-queue">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Queue</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="cm-kpi-heading">
  <h2 id="cm-kpi-heading" class="sr-only">Content moderation indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Awaiting Review</span>
    <span class="adm-kpi-value">14</span>
    <span class="adm-kpi-delta adm-kpi-delta--warn">● Blocking publication</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Changes Requested ¦ 5 ¦ ● Returned to authors || Approved Today ¦ 9 ¦ ▲ Queued for publication || Rejected (7 days) ¦ 3 ¦ 2 legal · 1 unsupported claim || Avg. Review Time ¦ 2.4 ¦ h ¦ ▼ 18% faster this week || Published (30 days) ¦ 62 ¦ ▲ 12% vs. previous period]
  </div>
 </section>
 <div class="cm-layout">
  <div class="cm-col">
   <section class="cm-toolbar" aria-labelledby="cm-filter-heading">
    <div class="cm-toolbar-head">
     <h2 class="cm-toolbar-title" id="cm-filter-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Filter & Search Queue
     </h2>
     <span class="cm-results" role="status" aria-live="polite">
      Showing
      <strong id="cm-visible-count">10</strong>
      of
      <strong id="cm-total-count">10</strong>
      items
     </span>
    </div>
    <div class="cm-toolbar-grid">
     <div class="cm-field">
      <label class="cm-field-label" for="cm-search">Search</label>
      <div class="cm-input-wrap">
       <span class="cm-input-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <input id="cm-search" class="cm-input" type="search" placeholder="Title, slug, author or tag…" autocomplete="off"/>
      </div>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Content Type ¦ All types ¦ Blog Post ¦ News Announcement ¦ Threat Advisory ¦ Product Listing || Review Status ¦ All statuses ¦ Pending Review ¦ In Review ¦ Changes Requested ¦ Approved ¦ Rejected || Risk Flag ¦ Any flag ¦ Legal review required ¦ Contains PII ¦ Unverified claim ¦ Brand-sensitive ¦ No flags]
     <div class="cm-toolbar-actions">
      <button type="button" class="cm-clear-btn" id="cm-clear-filters">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Reset</span>
      </button>
     </div>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="cm-queue-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-queue-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Pending Publication Queue
      </h2>
      <p class="adm-card-note">Content authored by staff members awaiting editorial sign-off before it renders on the public website. Nothing here is visible to clients or the public yet.</p>
     </div>
     <span class="adm-tag adm-tag--warn">14 Awaiting Review</span>
    </div>
    <div class="adm-table-wrap">
     <table class="adm-table cm-table">
      <caption class="sr-only">Content awaiting pre-publication review with type, author, risk flags and moderation actions</caption>
      <thead>
       <tr>
        <th>Content</th>
        <th>Type</th>
        <th>Author</th>
        <th>Submitted</th>
        <th>Risk Flags</th>
        <th>Status</th>
        <th>Actions</th>
       </tr>
      </thead>
      <tbody id="cm-tbody">
       <tr class="cm-row">
        <td>
         <div class="cm-content-cell">
          <span class="cm-thumb cm-thumb--blog" aria-hidden="true">
           <svg data-icon="REPLACE-WITH-LUCIDE"/>
          </span>
          <span class="cm-content-body">
           <span class="cm-title">Kenya State House Cyber Security Audit & Risk Analysis</span>
           <span class="cm-excerpt">An investigative analysis of government digital perimeter vulnerabilities and defence protocols, based on open-source intelligence.</span>
           <span class="cm-slug">/blog/kenya-state-house-cyber-audit</span>
          </span>
         </div>
        </td>
        [+2 more sibling <td> elements with the SAME structure as the one above; their text content in order: Blog Post || AN ¦ Amara Njoroge ¦ Offensive Security]
        <td class="adm-mono">24 Sep · 08:12</td>
        <td>
         <div class="cm-risk-stack">
          <span class="cm-risk cm-risk--legal">Legal review</span>
          <span class="cm-risk cm-risk--pii">Sensitive naming</span>
         </div>
        </td>
        [+2 more sibling <td> elements with the SAME structure as the one above; their text content in order: Pending Review || Review ¦ Approve]
       </tr>
       [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: Apache Struts 2 OGNL Injection — Emergency Client Advisory ¦ Urgent remediation guidance for CVE-2026-21447. Requires immediate publication across all affected client dashboards. ¦ /advisories/cve-2026-21447 ¦ Threat Advisory ¦ FH ¦ Fatima Hassan ¦ Threat Intelligence ¦ 24 Sep · 09:02 ¦ No flags ¦ Pending Review ¦ Review ¦ Approve || VUNVAULT Sentinel — Continuous Attack Surface Monitoring ¦ Product listing describing continuous perimeter monitoring with automated alerting and quarterly re-assessment. ¦ /products/sentinel ¦ Product Listing ¦ BO ¦ Brian Otieno ¦ Curriculum & Product ¦ 23 Sep · 16:48 ¦ Unverified claim ¦ Pending Review ¦ Review ¦ Request Changes || VUNVAULT Partners With East African Fintech Alliance ¦ Joint press announcement covering a new regional security partnership and shared threat intelligence programme. ¦ /news/east-african-fintech-alliance ¦ News Announcement ¦ GW ¦ Grace Wanjiru ¦ Compliance & Comms ¦ 23 Sep · 11:30 ¦ Brand-sensitive ¦ In Review ¦ Continue Review ¦ Approve || Africa's Cyber Awakening: How the Continent Is Fighting Back ¦ An in-depth analysis of evolving threat landscapes across Kenya, Ghana and Nigeria, citing recent incident case studies. ¦ /blog/africa-cyber-awakening ¦ Blog Post ¦ AN ¦ Amara Njoroge ¦ Offensive Security ¦ 22 Sep · 14:20 ¦ Contains PII ¦ Changes Requested ¦ Re-review ¦ Remind Author || VUNVAULT Opens Regional Security Operations Hub in Accra ¦ Announcement of the new Ghana-based SOC facility supporting West African clients with 24/7 monitoring. ¦ /news/accra-soc-hub ¦ News Announcement ¦ GW ¦ Grace Wanjiru ¦ Compliance & Comms ¦ 21 Sep · 10:15 ¦ No flags ¦ Approved ¦ Publish Now ¦ Schedule || VUNVAULT Academy — Security Foundations Certification ¦ Product page for the free cybersecurity foundations track with certificate of completion. ¦ /products/academy-foundations ¦ Product Listing ¦ BO ¦ Brian Otieno ¦ Curriculum & Product ¦ 23 Sep · 09:41 ¦ No flags ¦ Pending Review ¦ Review ¦ Approve || Unverified Ransomware Attribution — Vendor X Campaign ¦ Advisory attributing an active campaign to a named threat actor based on unattributed telemetry. ¦ /advisories/vendor-x-ransomware ¦ Threat Advisory ¦ DM ¦ Daniel Mwangi ¦ Security Automation ¦ 22 Sep · 08:55 ¦ Unverified claim ¦ Attribution risk ¦ Rejected ¦ Reopen ¦ Archive || Why Most SACCOs Fail Their Central Bank Security Audit ¦ Practical breakdown of the six most common regulatory findings and how to close them before examination. ¦ /blog/sacco-central-bank-audit ¦ Blog Post ¦ GW ¦ Grace Wanjiru ¦ Compliance & Comms ¦ 24 Sep · 07:28 ¦ Brand-sensitive ¦ Pending Review ¦ Review ¦ Approve || Cisco IOS XE Authentication Bypass — Client Mitigation Brief ¦ Compensating controls and patching guidance for CVE-2026-0091 affecting IOS XE Web UI deployments. ¦ /advisories/cve-2026-0091 ¦ Threat Advisory ¦ FH ¦ Fatima Hassan ¦ Threat Intelligence ¦ 24 Sep · 06:48 ¦ No flags ¦ Pending Review ¦ Review ¦ Approve]
      </tbody>
      <tfoot>
       <tr>
        <td>Content approved here is queued for publication, not immediately visible. Use the content editor to schedule a live time.</td>
       </tr>
      </tfoot>
     </table>
    </div>
    <div class="cm-empty" id="cm-empty">
     <span class="cm-empty-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="cm-empty-title">No content matches the current filters</span>
     <span class="cm-empty-text">Adjust your search terms or reset the filters to see the full pre-publication review queue.</span>
     <button type="button" class="adm-btn adm-btn-ghost" id="cm-empty-reset">Reset Filters</button>
    </div>
   </section>
  </div>
  <aside class="cm-col" aria-label="Moderation controls">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Review Workflow
      </h2>
      <p class="adm-card-note">Every item must clear editorial review before it can be published to the public website.</p>
     </div>
    </div>
    <div class="adm-card-body cm-panel">
     <div class="cm-panel-section">
      <span class="cm-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Queue Snapshot
      </span>
      <div class="cm-status-row">
       <span>Pending review</span>
       <strong>14</strong>
      </div>
      <div class="cm-status-row">
       <span>In review</span>
       <strong>3</strong>
      </div>
      <div class="cm-status-row">
       <span>Changes requested</span>
       <strong>5</strong>
      </div>
      <div class="cm-status-row">
       <span>Approved (not yet live)</span>
       <strong>9</strong>
      </div>
      <div class="cm-status-row">
       <span>Oldest waiting item</span>
       <strong>36 h</strong>
      </div>
     </div>
     <div class="cm-panel-section">
      <span class="cm-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Bulk Actions
      </span>
      <div class="cm-actions-stack">
       <button type="button" class="adm-btn adm-btn-ghost" id="cm-bulk-approve">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Approve All Flag-Free</span>
       </button>
       <button type="button" class="adm-btn adm-btn-dark" id="cm-bulk-escalate">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Escalate Flagged Items</span>
       </button>
       <button type="button" class="adm-btn adm-btn-ghost" id="cm-bulk-remind">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Remind All Authors</span>
       </button>
      </div>
      <p class="cm-action-note">Bulk approvals still require individual confirmation per item.</p>
     </div>
    </div>
   </section>
   <section class="adm-card adm-card--dark" aria-labelledby="cm-dist-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-dist-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Queue by Content Type
      </h2>
      <p class="adm-card-note">Breakdown of the 14 items currently awaiting review.</p>
     </div>
     <span class="adm-tag">14 Items</span>
    </div>
    <div class="adm-card-body">
     <div class="cm-dist">
      <div class="cm-dist-row">
       <span class="cm-dist-name">Blog Post</span>
       <progress class="cm-progress" value="6">6</progress>
       <span class="cm-dist-count">6</span>
      </div>
      [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Threat Advisory ¦ 4 ¦ 4 || News Announcement ¦ 2 ¦ 2 || Product Listing ¦ 2 ¦ 2]
     </div>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="cm-guidelines-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-guidelines-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Pre-Publication Guidelines
      </h2>
      <p class="adm-card-note">The five checks every reviewer must complete before approving content.</p>
     </div>
    </div>
    <div class="adm-card-body">
     <div class="cm-guidelines">
      <div class="cm-guideline">
       <span class="cm-guideline-num">01</span>
       <span class="cm-guideline-body">
        <span class="cm-guideline-title">No unverified claims</span>
        <span class="cm-guideline-text">Every technical assertion must trace to a cited source or internal test evidence.</span>
       </span>
      </div>
      [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: 02 ¦ No client or personal data ¦ Screenshots, logs and case studies must be fully anonymised before publication. || 03 ¦ Legal review completed where flagged ¦ Named entities, government bodies and vendor attribution require legal sign-off. || 04 ¦ Brand voice consistent ¦ Tone, terminology and product naming must match the VUNVAULT editorial standard. || 05 ¦ Publication path selected ¦ Decide whether the item publishes immediately, on schedule, or requires a client-only release.]
     </div>
    </div>
   </section>
   <section class="adm-card adm-card--dark" aria-labelledby="cm-activity-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-activity-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Recent Moderation Activity
      </h2>
      <p class="adm-card-note">Last six editorial decisions across the queue.</p>
     </div>
     <span class="adm-tag">Live</span>
    </div>
    <div class="adm-card-body">
     <div class="cm-activity">
      <div class="cm-activity-item">
       <span class="cm-activity-dot cm-activity-dot--ok"></span>
       <span class="cm-activity-body">
        <span class="cm-activity-text">
         <strong>e.reed</strong>
         approved
         <em>VUNVAULT Opens Regional SOC Hub in Accra</em>
         .
        </span>
        <span class="cm-activity-time">Today · 09:41 UTC</span>
       </span>
      </div>
      [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: e.reed ¦ requested changes on ¦ Africa's Cyber Awakening ¦ — PII in case study. ¦ Today · 09:22 UTC || e.reed ¦ rejected ¦ Unverified Ransomware Attribution ¦ — attribution risk. ¦ Yesterday · 17:04 UTC || a.njoroge ¦ submitted ¦ Kenya State House Cyber Security Audit ¦ for review. ¦ Today · 08:12 UTC || f.hassan ¦ published advisory ¦ CVE-2026-3327 ¦ to client dashboards. ¦ Yesterday · 14:32 UTC || g.wanjiru ¦ submitted ¦ East African Fintech Alliance ¦ — legal flag raised. ¦ Yesterday · 11:30 UTC]
     </div>
    </div>
   </section>
  </aside>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: top; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.cm-layout { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.cm-layout { grid-template-columns: 1fr; }
}
.cm-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.cm-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.cm-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.cm-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.cm-toolbar-title svg { color: var(--brand); }
.cm-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.cm-results strong { color: var(--brand-strong); }
.cm-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(3, minmax(140px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1180px) {
.cm-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)); }
}
@media (max-width: 720px) {
.cm-toolbar-grid { grid-template-columns: 1fr; }
}
.cm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cm-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.cm-input-wrap { position: relative; display: flex; align-items: center; }
.cm-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.cm-input,
      .cm-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.cm-input { padding-left: 38px; }
.cm-input::placeholder { color: var(--ink-faint); }
.cm-input:focus,
      .cm-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.cm-toolbar-actions { display: flex; gap: 8px; }
.cm-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.cm-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.cm-table { min-width: 1180px; }
.cm-content-cell { display: flex; align-items: flex-start; gap: 12px; min-width: 0; max-width: 34ch; }
.cm-thumb { width: 48px; height: 48px; border-radius: 10px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; color: #ffffff; background: linear-gradient(145deg, var(--dark), #060a10); border: 1px solid rgba(59, 153, 252, 0.3); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04); overflow: hidden; }
.cm-thumb svg { width: 22px; height: 22px; }
.cm-thumb--blog { color: var(--brand-soft); }
.cm-content-body { min-width: 0; }
.cm-title { display: block; font-size: 0.82rem; font-weight: 800; color: var(--ink); line-height: 1.4; }
.cm-excerpt { display: block; margin-top: 4px; font-size: 10.5px; line-height: 1.6; color: var(--ink-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.cm-slug { display: block; margin-top: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; color: var(--ink-faint); }
.cm-risk-stack { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.cm-risk { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; font-size: 9px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.cm-risk--legal { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.cm-risk--pii { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.cm-empty { display: none; flex-direction: column; align-items: center; gap: 10px; padding: 54px 22px; text-align: center; }
.cm-empty.is-visible { display: flex; }
.cm-empty-icon { width: 54px; height: 54px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--brand); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.cm-empty-title { font-size: 1rem; font-weight: 800; color: var(--ink); }
.cm-empty-text { font-size: 0.8rem; color: var(--ink-muted); max-width: 44ch; line-height: 1.65; }
.cm-panel { display: flex; flex-direction: column; gap: 16px; }
.cm-panel-section { display: flex; flex-direction: column; gap: 12px; }
.cm-panel-section + .cm-panel-section { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.adm-card--dark .cm-panel-section + .cm-panel-section { border-top-color: rgba(255, 255, 255, 0.08); }
.cm-panel-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .cm-panel-title { color: #7d8b9e; }
.cm-panel-title svg { color: var(--brand); flex: 0 0 auto; }
.cm-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.74rem; font-weight: 600; color: var(--ink-soft); }
.adm-card--dark .cm-status-row { color: #93a2b5; }
.cm-status-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .cm-status-row strong { color: #ffffff; }
.cm-actions-stack { display: flex; flex-direction: column; gap: 10px; }
.cm-actions-stack .adm-btn { width: 100%; }
.cm-action-note { font-size: 10px; line-height: 1.6; color: var(--ink-faint); text-align: center; }
.adm-card--dark
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Editorial review dialog
```html
<div id="cm-review-modal" class="cm-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="cm-review-title">
 <div class="cm-modal-backdrop"></div>
 <div class="cm-modal-window" role="document">
  <div class="cm-modal-head">
   <div>
    <span class="cm-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Pre-Publication Review
    </span>
    <h2 class="cm-modal-title" id="cm-review-title">Editorial sign-off</h2>
    <p class="cm-modal-sub">
     <span id="cm-modal-slug">/</span>
    </p>
   </div>
   <button type="button" class="cm-modal-close" aria-label="Close review">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="cm-modal-body">
   <div>
    <div class="cm-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Content Preview
    </div>
    <div class="cm-preview-body">
     <h3 class="cm-preview-title" id="cm-modal-preview-title">—</h3>
     <div class="cm-preview-meta">
      <span id="cm-modal-preview-type">—</span>
      <span>·</span>
      <span id="cm-modal-preview-author">—</span>
      <span>·</span>
      <span id="cm-modal-preview-date">—</span>
     </div>
     <p class="cm-preview-excerpt" id="cm-modal-preview-excerpt">Full content preview is rendered here for the reviewer.</p>
     <div class="cm-preview-tags" id="cm-modal-preview-tags">
      <span class="cm-preview-tag">no tags</span>
     </div>
    </div>
   </div>
   [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Mandatory Editorial Checklist ¦ Technical accuracy verified ¦ Every technical claim traces to a citation, internal test result or public advisory. ¦ No client or personal data present ¦ Screenshots, logs and case studies are fully anonymised. ¦ Legal review cleared (where flagged) ¦ Named entities, government references and vendor attribution are signed off. ¦ Brand voice and terminology consistent ¦ Tone, product naming and formatting match the VUNVAULT editorial standard. ¦ Publication path decided ¦ Immediate, scheduled or client-only release has been agreed with the author. || Editorial Decision ¦ Approve for Publication ¦ Clears the item for the public website and any scheduled client release. ¦ Request Changes ¦ Returns the item to the author with reviewer notes attached. ¦ Reject ¦ Marks the item invalid with feedback. It will not be published.]
   <div class="cm-note-field">
    <label class="cm-field-label" for="cm-review-note">
     <span>Reviewer Notes</span>
     <span class="cm-hint">Recorded in the audit log and sent to the author if changes are requested.</span>
    </label>
    <textarea id="cm-review-note" class="cm-textarea" placeholder="Summarise what was checked, any residual concerns and the rationale for this decision…"></textarea>
   </div>
   <div class="cm-reviewer">
    <span>
     <span class="cm-reviewer-label">Reviewer</span>
     <span class="cm-reviewer-value">e.reed@vunvault.com</span>
    </span>
    [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: Role ¦ Super Administrator || Decision Timestamp ¦ —]
   </div>
  </div>
  <div class="cm-modal-foot">
   <span class="cm-modal-foot-note" id="cm-modal-hint">Complete all five editorial checks and select a decision to enable the action.</span>
   <div class="cm-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-primary" id="cm-confirm-decision" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Confirm Decision</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.cm-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.cm-modal[hidden] { display: none !important; }
.cm-modal.is-open { opacity: 1; }
.cm-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.cm-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(900px, 100%); max-height: 92vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.cm-modal.is-open .cm-modal-window { transform: translateY(0) scale(1); }
.cm-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.cm-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.cm-modal-title { margin-top: 8px; font-size: 1.14rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; line-height: 1.35; }
.cm-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-word; }
.cm-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.cm-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.cm-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.cm-modal-body::-webkit-scrollbar { width: 8px; }
.cm-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.cm-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.cm-preview-body { padding: 18px 20px; border-radius: 14px; background: #f8fafc; border: 1px solid var(--line-soft); }
.cm-preview-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.015em; line-height: 1.4; color: var(--ink); margin: 0 0 8px; }
.cm-preview-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 10.5px; font-weight: 600; color: var(--ink-muted); }
.cm-preview-meta span { display: inline-flex; align-items: center; gap: 5px; }
.cm-preview-excerpt { font-size: 0.82rem; line-height: 1.75; color: var(--ink-soft); margin: 0; }
.cm-preview-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.cm-preview-tag { padding: 4px 10px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); }
.cm-note-field { display: flex; flex-direction: column; gap: 8px; }
.cm-textarea { w
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full pre-publication review queue.`
- `Pending Review`
- `Changes Requested`
- `News Announcement`
- `Threat Advisory`
- `Product Listing`
- `Legal review`
- `Contains PII`
- `Unverified claim`
- `Complete all five editorial checks and select a decision to enable the action.`
- `editorial check(s) still outstanding before a decision can be confirmed.`
- `All editorial checks complete — select a decision to continue.`
- `All checks complete. Confirming will write this editorial decision to the audit log.`
- `Content approved`
- `with reviewer notes.`
- `Changes requested`
- `Content rejected`
- `Content published`
- `Publication scheduled`
- `Author reminded`
- `Item reopened`
- `Content archived`
- `Reader preview`
- `Action recorded`
- `Queue clear`
- `No items are currently pending review.`
- `Review log exported`
- `CSV generated with editorial decisions, reviewers and timestamps.`
- `Queue refreshed`
- `Synced at`
- `Nothing to approve`
- `No flag-free pending items are currently in the queue.`
- `Bulk approval complete`
**Data:** `GET /admin/content/summary` → tiles (`Awaiting Review`, `Changes Requested`, `Approved Today`, `Rejected (7 days)`, `Avg. Review Time` `<n> h`, `Published (30 days)`). `GET /admin/content` (`type`, `status`, `flag`, `q`, `page`) → table: `Content` (title + summary + type chip `CONTENT_TYPE_LABELS` + slug path), `Author` (initials + name + team), `Submitted` (`DD Mon · HH:MM UTC`), `Risk flags` (`RISK_FLAG_LABELS` chips, none = `—`), `Status` (`CONTENT_STATUS_LABELS`), `Actions`. Filter selects and `Clear filters` (toast `Filters cleared` / `Showing the full pre-publication review queue.`). `Refresh queue` toasts `Queue refreshed`; `Export review log` calls `// TODO(backend-contract): no export endpoint` and toasts `Review log exported` only if a CSV was produced — until the endpoint exists render the button disabled with the tooltip `Export is not available yet.`. `Approve all clean` (bulk over flag-free pending items): iterate `POST …/actions { action: "approve" }` for each flag-free pending item the caller did not author; none → toast `Nothing to approve` / `No flag-free pending items are currently in the queue.`; each result handled individually.
**Review dialog (`Dialog`):** shows the item (title, author, slug, flags, summary), five editorial checks (labels from the markup), decision radios (`Approve`, `Request changes`, `Reject`), reviewer note (required for request-changes/reject, min 10 — error `Add a note of at least 10 characters.` planner), and the status lines verbatim: `Complete all five editorial checks and select a decision to enable the action.` → `<n> editorial check(s) still outstanding before a decision can be confirmed.` → `All editorial checks complete — select a decision to continue.` → `All checks complete. Confirming will write this editorial decision to the audit log.` Approve requires all five checks (UI rule; the API enforces separation of duties). Row actions by status: `publish` (approved → toast `Content published` / `"<title>" is now live on the public website.`), `schedule` (date-time picker, future only → `Publication scheduled` / `"<title>" will go live at the next scheduled slot.`), `remind_author` (`Author reminded` / `"<title>" — notification sent to the author.`), `Preview` (toast `Reader preview` / `"<title>" — rendering as it would appear to the public.`; no endpoint). Decision toasts verbatim: `Content approved` / `"<title>" cleared for publication with reviewer notes.`; `Changes requested` / `"<title>" returned to the author for revision.`; `Content rejected` / `"<title>" archived. No further review unless reopened.`.
**Error mapping:** `409 own_submission` → `You cannot review your own submission.`; `403 legal_review_required` → `This item needs administrator sign-off before it can be published.`; `409 invalid_transition` → refresh the queue.

**Tests:** summary tiles; filters; dialog gating; each decision payload; legal-review 403 message; own-submission 409 message; bulk approve skips authored/flagged items.

---

**Data shape (TypeScript):**
```ts
// ModerationItem, ModerationSummary, ModerationActionBody: see contracts (Task 20).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/content?… → 200 { data: ModerationItem[]; total } · GET …/summary → { data: ModerationSummary }
// POST /api/v1/admin/content/:id/actions body { action; note?; scheduledFor? } → 200 { data: ModerationItem } | 403 legal_review_required | 409 { error: "own_submission" | "invalid_transition" }
```

---

**Out of scope:**
- Do not render submitted body content unsanitised.
- Do not add an export endpoint call.
- Do not publish without the API's checks.

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
☐ Report at the end: `Task 83 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 83b — Admin Audit Logs: summary, filters, chain status, verification, export, event detail

**Layer:** L9

**Prerequisites:** Task 39, Task 46, Task 75, Task 12

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Audit Logs: summary, filters, chain status, verification, export, event detail**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/audit` on the read-only audit API: summary tiles, filter bar, live-style table, hash-chain status panel, verify/export/snapshot actions and the event detail dialog.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/audit/page.tsx`
- `apps/web/src/app/(authed)/admin/audit/_components/audit-summary.tsx`, `audit-toolbar.tsx`, `audit-table.tsx`, `chain-panel.tsx`, `event-dialog.tsx`, `severity-chip.tsx`
- `apps/web/src/app/(authed)/admin/audit/_hooks/use-audit.ts`
- `apps/web/src/app/(authed)/admin/audit/_styles/audit.css`
- `apps/web/src/mocks/handlers/admin-audit.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/audit/audit.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:**

##### Audit Logs page body
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Cryptographic System Audit Trail</span>
   <h1 class="adm-page-title">System Audit Logs</h1>
   <p class="adm-page-sub">
    Immutable, hash-chained record of every security event, authentication attempt, scan completion and administrative report release across the VUNVAULT platform. Writes are append-only and every entry is signed with AES-256-GCM.
   </p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="al-verify-chain">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Verify Hash Chain</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="al-export-logs">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Compliance Data</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="al-refresh-stream">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Stream</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="al-kpi-heading">
  <h2 id="al-kpi-heading" class="sr-only">Audit trail indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Events (24h)</span>
    <span class="adm-kpi-value">1,482</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 6.4% vs. yesterday</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Auth Attempts ¦ 316 ¦ 9 failed · 2 locked out || Scan Completions ¦ 96 ¦ ▲ 12 in the last hour || Report Releases ¦ 23 ¦ All approved by review gate || Chain Integrity ¦ 100 ¦ % ¦ 0 hash mismatches || Retention (WORM) ¦ 7 ¦ yr ¦ Immutable · AES-256-GCM]
  </div>
 </section>
 <div class="al-layout">
  <div class="al-col">
   <section class="al-toolbar" aria-labelledby="al-filter-heading">
    <div class="al-toolbar-head">
     <h2 class="al-toolbar-title" id="al-filter-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Filter & Search Audit Trail
     </h2>
     <span class="al-results" role="status" aria-live="polite">
      Showing
      <strong id="al-visible-count">18</strong>
      of
      <strong id="al-total-count">18</strong>
      events
     </span>
    </div>
    <div class="al-toolbar-grid">
     <div class="al-field">
      <label class="al-field-label" for="al-search">Search</label>
      <div class="al-input-wrap">
       <span class="al-input-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <input id="al-search" class="al-input" type="search" placeholder="Actor, IP, CVE, job ID or message…" autocomplete="off"/>
      </div>
     </div>
     [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Event Type ¦ All events ¦ Authentication ¦ Scan Completion ¦ Report Release ¦ Administrative ¦ Security Event ¦ System || Severity ¦ Any severity ¦ Success / OK ¦ Informational ¦ Warning ¦ Critical || Actor ¦ Any actor ¦ e.reed (Super Admin) ¦ a.njoroge (Admin) ¦ d.mwangi (Analyst) ¦ f.hassan (Analyst) ¦ b.otieno (Operator) ¦ g.wanjiru (Auditor) ¦ System / automation || Time Range ¦ Last 24 hours ¦ Last hour ¦ Last 6 hours ¦ Last 7 days ¦ Last 30 days]
     <div class="al-toolbar-actions">
      <button type="button" class="al-clear-btn" id="al-clear-filters">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Reset</span>
      </button>
     </div>
    </div>
   </section>
   <section class="al-console" aria-labelledby="al-console-heading">
    <div class="al-console-chrome">
     <div class="al-chrome-left">
      <span class="al-dots" aria-hidden="true">
       <span class="al-dot al-dot--close"></span>
       <span class="al-dot al-dot--min"></span>
       <span class="al-dot al-dot--max"></span>
      </span>
      <span class="al-chrome-title" id="al-console-heading">vunvault-audit-trail@node-nbo-01:/var/log/vunvault/audit.log — tail -f</span>
     </div>
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
    </div>
    <div class="al-console-meta">
     <div class="al-meta-cell">
      <span class="al-meta-label">Node</span>
      <span class="al-meta-value">node-nbo-01 · NBO-CORE</span>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Encryption ¦ AES-256-GCM || Head Hash ¦ 0x7f3a9c21d48b05e6 || Last Sync ¦ --:--:-- UTC]
    </div>
    <div class="al-console-body" id="al-console-body" role="log" aria-live="polite" aria-label="Audit trail stream">
     <article class="al-row al-row--ok">
      <span class="al-cell al-ts">
       <strong>09:41:12</strong>
       UTC
      </span>
      <span class="al-cell">
       <span class="al-type al-type--auth">Auth</span>
      </span>
      <span class="al-cell al-msg">
       <strong>AUTH_SUCCESS</strong>
       · e.reed@vunvault.com signed in from
       <span class="al-ip">196.201.214.77</span>
       (Nairobi, KE) · MFA
       <span class="al-ok">hardware-key verified</span>
      </span>
      <span class="al-cell">
       <span class="al-actor">
        <span class="al-actor-dot al-actor-dot--admin"></span>
        e.reed
       </span>
      </span>
      <span class="al-cell">
       <span class="al-2fa al-2fa--ok">2FA OK</span>
      </span>
     </article>
     [+17 more sibling <article> elements with the SAME structure as the one above; their text content in order: 09:38:04 ¦ UTC ¦ Security ¦ AUTH_RATE_LIMIT ¦ · 5 failed attempts in 90 s from ¦ 41.90.64.199 ¦ targeting ¦ admin@vunvault.com ¦ · source IP ¦ temporarily blocked for 15 min ¦ system ¦ 2FA FAIL || 09:36:48 ¦ UTC ¦ Scan ¦ SCAN_COMPLETE ¦ · ¦ JOB-4471 ¦ against ¦ api.horizonsacco.co.ke ¦ finished in 4 m 12 s · ¦ 3 findings (1 critical, 1 high, 1 medium) ¦ e.reed ¦ — || 09:34:21 ¦ UTC ¦ Release ¦ REPORT_RELEASED ¦ · ¦ JOB-4471 ¦ approved at the Mandatory Admin Review Gate and released to ¦ Horizon SACCO ¦ client portal · reviewer note attached ¦ e.reed ¦ 2FA OK || 09:32:09 ¦ UTC ¦ Auth ¦ AUTH_FAILURE ¦ · login attempt from ¦ 185.220.101.42 ¦ (TOR exit node) against ¦ admin@vunvault.com ¦ · source ¦ denied by geo-block policy ¦ external ¦ 2FA FAIL || 09:28:55 ¦ UTC ¦ Admin ¦ USER_PROVISIONED ¦ · invitation issued to ¦ a.mohamed@vunvault.com ¦ as Security Analyst — Offensive Security · MFA enrolment required within 72 h ¦ e.reed ¦ 2FA OK || 09:24:11 ¦ UTC ¦ Auth ¦ AUTH_SUCCESS ¦ · a.njoroge@vunvault.com signed in from ¦ 41.90.32.10 ¦ (Nairobi, KE) · MFA ¦ TOTP verified ¦ a.njoroge ¦ 2FA OK || 09:18:33 ¦ UTC ¦ Scan ¦ SCAN_COMPLETE ¦ · ¦ JOB-4470 ¦ against ¦ pay.nairobifintech.com ¦ finished · ¦ 2 findings (1 high, 1 medium) ¦ a.njoroge ¦ — || 09:12:04 ¦ UTC ¦ Admin ¦ PERMISSION_CHANGED ¦ · role elevated for ¦ d.mwangi@vunvault.com ¦ — granted ¦ Security Automation scope ¦ · SEV-2 audit event ¦ e.reed ¦ 2FA OK || 09:06:47 ¦ UTC ¦ Admin ¦ ADVISORY_BROADCAST ¦ · ¦ CVE-2026-21447 ¦ emergency advisory pushed to ¦ 312 client dashboards ¦ · SEV-1 audit event ¦ f.hassan ¦ 2FA OK || 08:54:12 ¦ UTC ¦ Release ¦ REPORT_RELEASED ¦ · ¦ JOB-4460 ¦ approved and released to ¦ Nairobi Fintech Group ¦ client portal ¦ e.reed ¦ 2FA OK || 08:00:00 ¦ UTC ¦ System ¦ KEY_ROTATION ¦ · audit log encryption key rotated by KMS · ¦ previous key archived to cold storage ¦ system ¦ — || 07:44:19 ¦ UTC ¦ Auth ¦ AUTH_MFA_FAILURE ¦ · invalid TOTP code for ¦ k.kimani@vunvault.com ¦ from ¦ 41.90.88.42 ¦ · ¦ attempt 3 of 5 before lockout ¦ system ¦ 2FA FAIL || 07:12:08 ¦ UTC ¦ Scan ¦ SCAN_COMPLETE ¦ · ¦ JOB-4469 ¦ against ¦ vault.lakeviewlogistics.com ¦ finished · ¦ 0 critical · 2 high · 6 medium ¦ d.mwangi ¦ — || 06:58:33 ¦ UTC ¦ Admin ¦ ACCOUNT_SUSPENDED ¦ · ¦ l.achieng@vunvault.com ¦ suspended after 68 days of inactivity · ¦ all session tokens revoked ¦ e.reed ¦ 2FA OK || 06:00:00 ¦ UTC ¦ Security ¦ CHAIN_VERIFIED ¦ · hourly hash chain integrity check completed · ¦ 1,482 entries · 0 mismatches ¦ system ¦ — || 17:22:14 ¦ UTC ¦ Auth ¦ AUTH_SUCCESS ¦ · g.wanjiru@vunvault.com signed in from ¦ 41.90.10.44 ¦ (Nairobi, KE) · MFA ¦ TOTP verified ¦ g.wanjiru ¦ 2FA OK || 23:00:00 ¦ UTC ¦ System ¦ LOG_BACKUP ¦ · daily audit log snapshot written to immutable WORM cold storage · ¦ retention 7 years ¦ system ¦ —]
    </div>
    <div class="al-empty" id="al-empty">
     <span class="al-empty-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="al-empty-title">No audit events match the current filters</span>
     <span class="al-empty-text">Adjust your search terms or reset the filters to see the full cryptographic audit trail.</span>
     <button type="button" class="adm-btn adm-btn-ghost" id="al-empty-reset">Reset Filters</button>
    </div>
   </section>
  </div>
  <aside class="al-col" aria-label="Audit integrity controls">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Cryptographic Chain
      </h2>
      <p class="adm-card-note">Append-only Merkle-linked log. Each entry commits to the hash of the previous.</p>
     </div>
     <span class="adm-tag adm-tag--ok">Intact</span>
    </div>
    <div class="adm-card-body al-panel">
     <div class="al-panel-section">
      <span class="al-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Chain State
      </span>
      <div class="al-status-row">
       <span>Total entries</span>
       <strong>1,482,904</strong>
      </div>
      <div class="al-status-row">
       <span>Chain height</span>
       <strong>1,482,904</strong>
      </div>
      <div class="al-status-row">
       <span>Genesis block</span>
       <strong>2024-03-01</strong>
      </div>
      <div class="al-status-row">
       <span>Last verified</span>
       <strong id="al-last-verified">06:00:00 UTC</strong>
      </div>
      <div class="al-status-row">
       <span>Hash mismatches</span>
       <strong>0</strong>
      </div>
     </div>
     [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Latest Blocks ¦ #1,482,904 ¦ 09:41:12 UTC ¦ 0x7f3a9c21d48b05e6…c9a1f0e2 ¦ #1,482,903 ¦ 09:38:04 UTC ¦ 0x4b8e12a7c3f96d0b…28e7f4c1 ¦ #1,482,902 ¦ 09:36:48 UTC ¦ 0x92d5c4f18ea63b70…d81e5a03 ¦ #1,482,901 ¦ 09:34:21 UTC ¦ 0xc1f0a84e796d230b…4a8f9b17 ¦ #1,482,900 ¦ 09:32:09 UTC ¦ 0x5e2b7d91af36c804…7f1e2d9a || Run Integrity Check ¦ Export WORM Snapshot ¦ Snapshot exports are signed and timestamped for regulatory submission.]
    </div>
   </section>
   [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Event Distribution (24h) ¦ 1,482 total events recorded across the platform. ¦ 24h ¦ Authentication ¦ 316 ¦ 316 ¦ Scan Events ¦ 642 ¦ 642 ¦ Report Releases ¦ 23 ¦ 23 ¦ Administrative ¦ 87 ¦ 87 ¦ Security Events ¦ 14 ¦ 14 ¦ System ¦ 400 ¦ 400 || Active Alerts ¦ Anomalies flagged by the audit stream monitor. ¦ 2 Open ¦ TOR exit node blocked ¦ — 185.220.101.42 attempted admin login. Geo-block policy enforced. No session created. ¦ Repeated MFA failures ¦ — k.kimani@vunvault.com has 3 invalid TOTP attempts in the last 2 hours. Account lockout imminent.]
  </aside>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.al-layout { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.al-layout { grid-template-columns: 1fr; }
}
.al-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.al-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.al-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.al-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.al-toolbar-title svg { color: var(--brand); }
.al-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.al-results strong { color: var(--brand-strong); }
.al-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(4, minmax(130px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1320px) {
.al-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(130px, 1fr)); }
}
@media (max-width: 720px) {
.al-toolbar-grid { grid-template-columns: 1fr; }
}
.al-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.al-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.al-input-wrap { position: relative; display: flex; align-items: center; }
.al-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.al-input,
      .al-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.al-input { padding-left: 38px; }
.al-input::placeholder { color: var(--ink-faint); }
.al-input:focus,
      .al-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.al-toolbar-actions { display: flex; gap: 8px; }
.al-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.al-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.al-console { position: relative; border-radius: 18px; overflow: hidden; background: radial-gradient(120% 100% at 0% 0%, rgba(59, 153, 252, 0.10), transparent 60%), linear-gradient(165deg, #05080d 0%, #070b11 55%, #04070b 100%); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 34px 80px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; }
.al-console-chrome { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 16px; background: linear-gradient(180deg, #151b25, #10151d); border-bottom: 1px solid rgba(59, 153, 252, 0.18); }
.al-chrome-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.al-dots { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
.al-dot { width: 11px; height: 11px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.3); }
.al-dot--close { background: #ff5f57; }
.al-dot--min { background: #febc2e; }
.al-dot--max { background: #28c840; }
.al-chrome-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #8d9aab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.al-chrome-right { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.al-chrome-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.al-chrome-pill--live { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.al-chrome-pill--live .al-live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.al-chrome-pill--chain { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.al-chrome-pill--chain.is-warn { color: #fbbf24; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.42); }
.al-console-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(59, 153, 252, 0.14); }
@media (max-width: 860px) {
.al-console-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
.al-console-meta { grid-template-columns: 1fr; }
}
.al-meta-cell { display: flex; flex-direction: column; gap: 5px; padding: 12px 16px; background: rgba(5, 8, 13, 0.6); }
.al-meta-label { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #55637a; }
.al-meta-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 700; color: #cbd5e1; word-break: break-all; }
.al-console-body { max-height: 680px; overflow-y: auto; padding: 14px 0 8px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; scroll-behavior: smooth; }
.al-console-body::-webkit-scrollbar { width: 9px; height: 9px; }
.al-console-body::-webkit-scrollbar-track { background: transparent; }
.al-console-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.al-console-body::-webkit-scrollbar-thumb:hover { background: rgba(59, 153, 252, 0.6); background-clip: padding-box; }
.al-row { display: grid; grid-template-columns: 172px 92px 1fr 128px 90px; align-items: start; gap: 12px; padding: 11px 18px
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Event detail dialog
```html
<div id="al-event-modal" class="al-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="al-event-title">
 <div class="al-modal-backdrop"></div>
 <div class="al-modal-window" role="document">
  <div class="al-modal-head">
   <div>
    <span class="al-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Audit Event Detail
    </span>
    <h2 class="al-modal-title" id="al-event-title">—</h2>
    <p class="al-modal-sub">
     Event ID:
     <span id="al-modal-event-id">—</span>
    </p>
   </div>
   <button type="button" class="al-modal-close" aria-label="Close event detail">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="al-modal-body">
   <div>
    <div class="al-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Event Summary
    </div>
    <div class="al-modal-summary">
     <div class="al-modal-summary-item">
      <span class="al-modal-summary-label">Timestamp (UTC)</span>
      <span class="al-modal-summary-value" id="al-modal-ts">—</span>
     </div>
     [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Event Type ¦ — || Actor ¦ — || Severity ¦ — || Event Code ¦ —]
    </div>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Full Message ¦ — || Raw Encrypted Payload || Hash Chain Verification ¦ Chain verified — entry is authentic and unmodified ¦ Entry hash: ¦ — ¦ Previous hash: ¦ — ¦ Signature: ¦ AES-256-GCM · HMAC-SHA256]
  </div>
  <div class="al-modal-foot">
   <span class="al-modal-foot-note">Audit entries are append-only. This record cannot be edited or deleted within the 7-year retention window.</span>
   <div class="al-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost" id="al-modal-copy">Copy Payload</button>
    <button type="button" class="adm-btn adm-btn-primary">Close</button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.al-actions-stack .adm-btn { width: 100%; }
.al-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.al-modal[hidden] { display: none !important; }
.al-modal.is-open { opacity: 1; }
.al-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.al-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(760px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.al-modal.is-open .al-modal-window { transform: translateY(0) scale(1); }
.al-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.al-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.al-modal-title { margin-top: 8px; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; line-height: 1.4; }
.al-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-all; }
.al-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.al-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.al-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.al-modal-body::-webkit-scrollbar { width: 8px; }
.al-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.al-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.al-modal-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.al-modal-summary { grid-template-col
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full cryptographic audit trail.`
- `Scan Completion`
- `Report Release`
- `Security Event`
- `Payload copied`
- `Raw encrypted payload copied to clipboard.`
- `Clipboard blocked`
- `Copy the payload manually from the panel.`
- `Payload ready`
- `Select and copy the payload text manually.`
- `Open detail for audit event`
- `Hash chain verified`
- `1,482,904 entries checked · 0 mismatches · chain integrity 100%.`
- `Compliance export ready`
- `Signed CSV + JSON bundle generated for the last 24 hours at`
- `Stream refreshed`
- `Audit tail resynced at`
- `Integrity check complete`
- `Chain state: intact · last verified at`
- `WORM snapshot signed`
- `Immutable snapshot written to cold storage at`
- `Profile picture`
**Data:** `GET /admin/audit/summary` tiles (`Events (24 h)`, `Auth Attempts`, `Failed Auth`, `Locked Out`, `Scan Completions`, `Report Releases`, `Chain Integrity` %, `Hash Mismatches`, `Retention` `7 years`); `GET /admin/audit/chain` for the chain panel (`state`, `totalEntries`, `genesisDate`, `lastVerifiedAt`, `headHash`, `node`, `encryption`); `GET /admin/audit` (`q`, `category`, `severity`, `actor`, `range`, `page`, `pageSize`) → table: `Timestamp (UTC)` (`YYYY-MM-DD HH:MM:SS`), `Category` (`AUDIT_CATEGORY_LABELS`), `Event`, `Severity` (chip colours ok=green, info=blue, warning=amber, critical=red; `SEV-n` suffix when `sevLevel`), `Actor`, `Details` (message), `Hash` (first 8 chars) and a row button `Open detail for audit event <seq>` (accessible name verbatim). Range select labels from `AUDIT_RANGE_LABELS`; `Clear filters` toasts `Filters cleared` / `Showing the full cryptographic audit trail.`. **Rows are read-only; there is no edit or delete control anywhere on this page.**
**Actions:** `Verify chain` → `POST /admin/audit/verify` (button shows a spinner; `409 verify_in_progress` → toast `Verification already running`); success toasts: `Hash chain verified` / `<entries> entries checked · <mismatches> mismatches · chain integrity <n>%.`, and when `mismatches > 0` a persistent critical banner above the table `Hash chain mismatch detected at entry #<firstMismatchSeq>. Escalate to the incident commander.`; `Integrity check` re-reads `GET …/chain` and toasts `Integrity check complete` / `Chain state: <intact|broken> · last verified at <HH:MM:SS UTC>.`; `Export` (`Compliance export`) → `GET /admin/audit/export` with the current filters, saved as `vunvault-audit-<UTC date>.csv`, toast `Compliance export ready` / `Signed CSV bundle generated for <range label> at <HH:MM:SS UTC>.` (JSON bundle and signing are not provided by the API — wording adjusted from the prototype); `WORM snapshot` is not an API action — render it disabled with tooltip `Snapshots are written automatically by the platform.` (`// TODO(backend-contract)`). `Refresh stream` refetches (toast `Stream refreshed` / `Audit tail resynced at <HH:MM:SS UTC>.`).
**Event dialog:** `Dialog`; header with category/severity chips, `seq`, event type; body: timestamp, actor, subject, ip, full message, `Hash` and `Previous hash` (monospace, each with a `Copy` button → toast `Payload copied` / `Hash copied to clipboard.`; on clipboard failure toast `Clipboard blocked` / `Select and copy the value manually.`), and the chain-link line `Linked to entry #<seq-1>`. Do NOT show or request encrypted payloads, signatures or key ids (the API never returns them).
Live row insertion over SSE and the `LIVE` indicator come in Layer L12; this task polls the first page every 10 s while visible and highlights newly seen rows for 2 s (no highlight under reduced motion).

**Tests:** summary tiles; filters in the URL; row detail dialog opens from the labelled button; verify success and mismatch banner; export triggers a download with the filter query; no element offers edit/delete; clipboard fallback toast.

---

**Data shape (TypeScript):**
```ts
// AuditEntryView, AuditSummary, ChainStatus, VerifyChainResult: see contracts (Task 20).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/audit?… → 200 { data: AuditEntryView[]; total } · GET …/summary · GET …/chain
// POST /api/v1/admin/audit/verify body { incremental?: boolean } → 200 { data: VerifyChainResult } | 409 verify_in_progress
// GET /api/v1/admin/audit/export?… → 200 text/csv | 422 range_too_large
```

---

**Out of scope:**
- Do not add any edit/delete/redact control.
- Do not implement SSE (Layer L12).
- Do not request or show sealed payloads.

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
☐ Report at the end: `Task 83b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 83c — Admin Profile Settings A: identity, personal details, avatar

**Layer:** L9

**Prerequisites:** Task 28, Task 46, Task 75, Task 10

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Profile Settings A: identity, personal details, avatar**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/profile`: identity header, tab bar, and the Personal Details panel (name, title, contact, timezone, language, bio) with avatar upload, saved through the account-settings API.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/profile/page.tsx`
- `apps/web/src/app/(authed)/admin/profile/_components/identity-header.tsx`, `profile-tabs.tsx`, `personal-panel.tsx`, `avatar-uploader.tsx`, `security-panel.tsx` (null stub — Task 83d), `notifications-panel.tsx` (null stub — Task 83d)
- `apps/web/src/app/(authed)/admin/profile/_hooks/use-account-settings.ts`
- `apps/web/src/app/(authed)/admin/profile/_styles/profile.css`
- `apps/web/src/mocks/handlers/admin-profile.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/profile/profile-a.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup (all three panels; only the Personal panel and the header are built here — the Security and Notifications panels are Task 83d, build them as stubs now):**

##### Profile Settings page body (identity header, tab bar, personal / security / notifications panels)
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Account & Personal Configuration</span>
   <h1 class="adm-page-title">Profile Settings</h1>
   <p class="adm-page-sub">
    Manage your administrator identity, profile picture, password, two-factor authentication and personal notification preferences. Sensitive changes are written to the immutable audit log.
   </p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-ghost" id="ps-discard-all">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Discard Changes</span>
   </button>
   <button type="button" class="adm-btn adm-btn-primary" id="ps-save-all">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Save All Changes</span>
   </button>
  </div>
 </div>
 <section class="ps-identity" aria-labelledby="ps-identity-heading">
  <div class="ps-identity-left">
   <div class="ps-avatar-wrap">
    <span class="ps-avatar" id="ps-identity-avatar" aria-hidden="true">ER</span>
    <span class="ps-avatar-badge" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
   </div>
   <div class="ps-identity-text">
    <span class="ps-identity-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Verified Administrator
    </span>
    <h2 class="ps-identity-name" id="ps-identity-heading">Dr. Evelyn Reed</h2>
    <div class="ps-identity-meta">
     <span>Super Administrator</span>
     <span aria-hidden="true">·</span>
     <span>Command Center — Nairobi HQ</span>
     <span aria-hidden="true">·</span>
     <code>e.reed@vunvault.com</code>
    </div>
   </div>
  </div>
  <div class="ps-identity-right">
   <span class="ps-identity-stat ps-identity-stat--ok">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    MFA:
    <strong>Hardware key</strong>
   </span>
   <span class="ps-identity-stat">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Last sign-in:
    <strong id="ps-last-signin">Today · 09:41 UTC</strong>
   </span>
   <span class="ps-identity-stat">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Sessions:
    <strong>3 active</strong>
   </span>
  </div>
 </section>
 <nav class="ps-tabs" role="tablist" aria-label="Profile settings sections">
  <button type="button" class="ps-tab" role="tab" id="ps-tab-personal" aria-controls="ps-panel-personal" aria-selected="true">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   Personal Details
  </button>
  [+3 more sibling <button> elements with the SAME structure as the one above; their text content in order: Profile Picture || Password & 2FA || Notifications]
 </nav>
 <div class="ps-layout">
  <div class="ps-col">
   <section class="adm-card ps-panel" id="ps-panel-personal" role="tabpanel" aria-labelledby="ps-tab-personal" tabindex="0">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Personal Details
      </h2>
      <p class="adm-card-note">How your name and contact information appear across the VUNVAULT platform and in client-facing communication.</p>
     </div>
     <span class="adm-tag adm-tag--ok">Verified</span>
    </div>
    <div class="adm-card-body">
     <form class="ps-form" id="ps-personal-form">
      <fieldset class="ps-fieldset">
       <legend class="ps-legend">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Identity
       </legend>
       <div class="ps-row">
        <div class="ps-field">
         <label class="ps-label" for="ps-first">
          <span>
           First Name
           <span class="ps-label-req" aria-hidden="true">*</span>
          </span>
         </label>
         <input id="ps-first" class="ps-input" type="text" name="first" value="Evelyn" autocomplete="given-name" required/>
        </div>
        <div class="ps-field">
         <label class="ps-label" for="ps-last">
          <span>
           Last Name
           <span class="ps-label-req" aria-hidden="true">*</span>
          </span>
         </label>
         <input id="ps-last" class="ps-input" type="text" name="last" value="Reed" autocomplete="family-name" required/>
        </div>
       </div>
       <div class="ps-row">
        <div class="ps-field">
         <label class="ps-label" for="ps-display">
          <span>Display Name</span>
          <span class="ps-hint">Shown in the audit log</span>
         </label>
         <input id="ps-display" class="ps-input" type="text" name="display" value="Dr. Evelyn Reed" autocomplete="nickname"/>
        </div>
        <div class="ps-field">
         <label class="ps-label" for="ps-jobtitle">
          <span>Job Title</span>
         </label>
         <input id="ps-jobtitle" class="ps-input" type="text" name="jobtitle" value="Super Administrator · Incident Commander" autocomplete="organization-title"/>
        </div>
       </div>
      </fieldset>
      [+2 more sibling <fieldset> elements with the SAME structure as the one above; their text content in order: Contact ¦ Work Email ¦ * ¦ @vunvault.com domain ¦ Direct Phone ¦ Encrypted at rest ¦ Timezone ¦ Africa/Nairobi — EAT (UTC+3) ¦ Africa/Lagos — WAT (UTC+1) ¦ Africa/Accra — GMT (UTC+0) ¦ Africa/Johannesburg — SAST (UTC+2) ¦ Europe/London — GMT/BST ¦ Europe/Berlin — CET/CEST ¦ America/New_York — ET ¦ Asia/Dubai — GST (UTC+4) ¦ Interface Language ¦ English (United Kingdom) ¦ English (United States) ¦ Kiswahili ¦ Français || Biography ¦ Short Biography ¦ 0 / 400 ¦ Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate.]
      <div>
       <button type="button" class="adm-btn adm-btn-ghost">Reset</button>
       <button type="button" class="adm-btn adm-btn-primary">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Save Personal Details</span>
       </button>
      </div>
     </form>
    </div>
   </section>
   [+3 more sibling <section> elements with the SAME structure as the one above; their text content in order: Profile Picture ¦ Upload a square image at least 256×256 px. It appears in the header, audit log, contributor cards and client-facing dashboards where your name is shown. ¦ No upload ¦ ER ¦ Drag & drop your image here ¦ Or click to browse. Accepted: PNG, JPG, WEBP, SVG — up to 4 MB. Square crops preferred. ¦ Remove Current Picture ¦ Generate From Initials ¦ Files are scanned for embedded malware, stripped of all EXIF metadata and stored encrypted on the VUNVAULT CDN. Uploads are written to the audit log against your administrator identity. || Password & Two-Factor Authentication ¦ Update your password and manage the authentication factors protecting your administrator account. All credential changes immediately invalidate other active sessions. ¦ 2FA Active ¦ Change Password ¦ Current Password ¦ * ¦ New Password ¦ * ¦ Min. 14 characters ¦ — ¦ Confirm New Password ¦ * ¦ Passwords are hashed with Argon2id and compared in constant time. The platform rejects any password appearing in known breach corpora. ¦ Two-Factor Authentication ¦ Require 2FA at every sign-in ¦ Enforces a second factor for every new session. Disabling this significantly weakens your account and triggers an immediate SEV-2 audit event. ¦ Enforced by policy ¦ Last factor change: 12 Aug 2026 ¦ Authenticator app — primary factor ¦ Scan the QR code with your authenticator app. If you can't scan it, enter the manual secret below. Codes rotate every 30 seconds. ¦ JBSW Y3DP EHPK 3PXP ¦ Recovery Codes — 3 of 10 remaining ¦ 4F7A-9C2E-D018 ¦ B3E1-6D45-A902 ¦ C8K2-7W91-Z534 ¦ ••••-••••-•••• ¦ ••••-••••-•••• ¦ ••••-••••-•••• ¦ Download Codes ¦ Regenerate Codes ¦ Hardware security key — secondary factor ¦ YubiKey 5C NFC registered on 12 Aug 2026. Provides phishing-resistant authentication for all privileged operations. ¦ Registered ¦ Serial: ••••-8842 ¦ Reset ¦ Update Password & 2FA || Notification Preferences ¦ Choose how and where VUNVAULT reaches you. Critical security alerts are always delivered regardless of these preferences. ¦ Personal ¦ Notification channel preferences per event category ¦ Event Category ¦ In-App ¦ Email ¦ SMS ¦ Push ¦ Security & Access ¦ Sign-in from new device ¦ Alert when a new device or unrecognised IP authenticates to your account. ¦ Password or 2FA changed ¦ Immediate notification of any credential change on your account. ¦ Failed authentication attempts ¦ Burst of failed sign-ins against your account from any source. ¦ Scan Operations ¦ Scan completed ¦ A job assigned to you finishes execution and results are ready. ¦ Job awaiting review gate ¦ A job is blocked on the Mandatory Admin Review Gate and requires your attention. ¦ Critical finding detected ¦ A scan has produced a critical severity finding requiring escalation. ¦ Threat Intelligence ¦ Zero-day advisory broadcast ¦ A new emergency advisory has been dispatched to client dashboards. ¦ Threat level change ¦ Global zero-day threat level moves up or down a step. ¦ Administrative ¦ Content awaiting moderation ¦ A staff-authored blog post, advisory or product listing is queued for review. ¦ New team member provisioned ¦ An invitation is sent or a new account is created on the platform. ¦ Weekly digest ¦ A Monday morning summary of scans, releases, threats and audit events. ¦ Quiet hours — suppress non-critical notifications ¦ to ¦ Always delivered: ¦ credential changes, SEV-1 broadcasts, review-gate escalations and incident commander pages ignore quiet hours. ¦ Reset to Defaults ¦ Save Notification Preferences]
  </div>
  <aside class="ps-col" aria-label="Account security summary">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Account Summary
      </h2>
      <p class="adm-card-note">Current identity and session state for this administrator account.</p>
     </div>
     <span class="adm-tag adm-tag--ok">Active</span>
    </div>
    <div class="adm-card-body ps-panel">
     <div class="ps-panel-section">
      <div class="ps-status-row">
       <span>Username</span>
       <strong>e.reed</strong>
      </div>
      <div class="ps-status-row">
       <span>Role</span>
       <strong>Super Administrator</strong>
      </div>
      <div class="ps-status-row">
       <span>Team</span>
       <strong>Command Center</strong>
      </div>
      <div class="ps-status-row">
       <span>Member since</span>
       <strong>Mar 2024</strong>
      </div>
      <div class="ps-status-row">
       <span>Session reference</span>
       <strong>ADM-…-7F3A</strong>
      </div>
     </div>
     [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Security Posture ¦ 80 ¦ Score ¦ Strong posture ¦ 3 of 4 recommendations complete. Enrol a second hardware key to reach a perfect score. ¦ Hardware-key MFA registered ¦ Recovery codes generated ¦ Password updated within 90 days ¦ Register a backup hardware key || Open Security Settings ¦ Sign Out Other Sessions ¦ 2 other active sessions will be terminated immediately.]
    </div>
   </section>
   <section class="adm-card" aria-labelledby="ps-sessions-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="ps-sessions-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Active Sessions
      </h2>
      <p class="adm-card-note">Devices currently authenticated to your account.</p>
     </div>
     <span class="adm-tag">3</span>
    </div>
    <div class="adm-card-body">
     <div>
      <table class="ps-sessions">
       <thead>
        <tr>
         <th>Device</th>
         <th>IP Address</th>
         <th>2FA</th>
         <th>Started</th>
         <th></th>
        </tr>
       </thead>
       <tbody>
        <tr>
         <td>
          <span class="adm-strong">MacBook Pro · Safari</span>
          <span>Nairobi, KE · This device</span>
         </td>
         <td class="adm-mono">196.201.214.77</td>
         <td>
          <span class="adm-badge adm-badge--ok">Hardware key</span>
         </td>
         <td class="adm-mono">09:41 UTC</td>
         <td>
          <span class="adm-badge adm-badge--info">Current</span>
         </td>
        </tr>
        [+2 more sibling <tr> elements with the SAME structure as the one above; their text content in order: iPhone 15 Pro · Safari ¦ Nairobi, KE ¦ 196.201.214.82 ¦ TOTP ¦ 07:12 UTC ¦ Revoke || ThinkPad X1 · Chrome ¦ Frankfurt, DE ¦ 185.220.101.9 ¦ Hardware key ¦ Yesterday · 21:04 ¦ Revoke]
       </tbody>
      </table>
     </div>
    </div>
   </section>
   <section class="adm-card adm-card--dark" aria-labelledby="ps-danger-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="ps-danger-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Danger Zone
      </h2>
     </div>
    </div>
    <div class="adm-card-body">
     <div class="ps-danger">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <div class="ps-danger-body">
       <span class="ps-danger-title">Deactivate administrator account</span>
       <p class="ps-danger-text">
        This immediately revokes all sessions, removes your access to every module and transfers outstanding review-gate jobs to the on-call lead. Reversal requires an executive approval.
       </p>
       <div>
        <button type="button" class="adm-btn adm-btn-danger" id="ps-deactivate">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
         <span>Request Deactivation</span>
        </button>
       </div>
      </div>
     </div>
    </div>
   </section>
  </aside>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn-danger { color: #be123c; background: #fff1f2; border-color: #fecdd3; }
.adm-btn-danger:hover { transform: translateY(-2px); color: #ffffff; background: linear-gradient(135deg, var(--critical), #be123c); border-color: transparent; }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.ps-layout { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.ps-layout { grid-template-columns: 1fr; }
}
.ps-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.ps-identity { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 26px; border-radius: 18px; background: radial-gradient(90% 160% at 100% 0%, rgba(59, 153, 252, 0.2), transparent 62%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 26px 56px -34px rgba(0, 0, 0, 0.7); color: #ffffff; overflow: hidden; position: relative; }
.ps-identity::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.08) 1px, transparent 1px); background-size: 44px 44px; -webkit-mask-image: radial-gradient(90% 90% at 0% 0%, #000 0%, transparent 76%); mask-image: radial-gradient(90% 90% at 0% 0%, #000 0%, transparent 76%); pointer-events: none; }
.ps-identity-left { position: relative; z-index: 1; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; min-width: 0; }
.ps-avatar-wrap { position: relative; flex: 0 0 auto; }
.ps-avatar { width: 96px; height: 96px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; letter-spacing: 0.04em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 3px solid rgba(255, 255, 255, 0.15); box-shadow: 0 0 0 6px rgba(59, 153, 252, 0.12), 0 24px 48px -26px rgba(0, 0, 0, 0.75); overflow: hidden; }
.ps-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ps-avatar-badge { position: absolute; bottom: 2px; right: 2px; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border: 2px solid #060a10; box-shadow: 0 8px 18px -8px var(--brand-glow); }
.ps-identity-text { min-width: 0; }
.ps-identity-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.ps-identity-name { margin-top: 8px; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: #ffffff; }
.ps-identity-meta { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 0.76rem; font-weight: 600; color: #93a2b5; }
.ps-identity-meta code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: var(--brand-soft); background: rgba(59, 153, 252, 0.12); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(59, 153, 252, 0.28); }
.ps-identity-right { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.ps-identity-stat { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: var(--r-full); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); font-size: 10.5px; font-weight: 700; color: #cbd5e1; white-space: nowrap; }
.ps-identity-stat strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #ffffff; font-weight: 800; }
.ps-identity-stat--ok strong { color: #34d399; }
@media (max-width: 720px) {
.ps-identity-right { align-items: flex-start; width: 100%; }
.ps-identity-left { gap: 18px; }
.ps-avatar { width: 82px; height: 82px; font-size: 26px; }
.ps-identity-name { font-size: 1.25rem; }
}
.ps-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border-radius: var(--r-full); background: #ffffff; border: 1px solid var(--line); box-shadow: 0 12px 30px -26px rgba(10, 13, 18, 0.5); margin-bottom: 20px; overflow-x: auto; scrollbar-width: none; }
.ps-tabs::-webkit-scrollbar { display: none; }
.ps-tab { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; border-radius: var(--r-full); border: 0; cursor: pointer; color: var(--ink-soft); background: transparent; transition: color var(--dur) var(--ease), background-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.ps-tab svg { flex: 0 0 auto; opacity: 0.85; }
.ps-tab:hover { color: var(--brand-strong); background: var(--brand-tint); }
.ps-tab[aria-selected="true"] { color: var(--brand-strong); background: var(--brand-tint); box-shadow: inset 0 0 0 1px var(--brand-line); font-weight: 800; }
.ps-panel[hidden] { display: none; }
.ps-form { display: flex; flex-direction: column; gap: 22px; }
.ps-fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.ps-legend { display: flex; align-items: center; gap: 9px; padding: 0; margin-bottom: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.ps-legend::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line-soft); }
.ps-legend svg { color: var(--brand); flex: 0 0 auto; }
.ps-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 820px) {
.ps-row, .ps-row--3 { grid-template-columns: 1fr; }
}
.ps-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ps-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.ps-label-req { color: #be123c; font-size: 11px; line-height: 1; }
.ps-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.ps-input,
      .ps-select,
      .ps-textarea { width: 100%; padding: 12px 14px; font-size: 0.82rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid va
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `[VUNVAULT] Unable to persist profile:`
- `><circle cx=`
- `Profile picture`
- `Custom image`
- `File too large`
- `Avatar uploads are limited to 4 MB.`
- `Unsupported file type`
- `Please upload a PNG, JPG, WEBP or SVG image.`
- `Avatar updated`
- `Image accepted and queued for security scanning at`
- `Upload failed`
- `The file could not be read. Please try again.`
- `Avatar removed`
- `Falling back to initials across the platform.`
- `Avatar generated`
- `Initials image created for your account.`
- `Toggle password visibility`
- `Personal details saved`
- `Profile updated at`
- `and written to the audit log.`
- `Security settings updated`
- `Password change enforced across all sessions at`
- `Notification preferences saved`
- `Channel matrix updated at`
- `Changes saved`
- `Settings updated successfully.`
- `Dr. Evelyn Reed`
- `Super Administrator · Incident Commander`
- `Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate.`
- `Personal details reset`
- `Restored to the last saved values.`
- `Security form reset`
- `Password fields cleared.`
- `Notifications reset`
- `Restored to VUNVAULT defaults.`
- `Saving all…`
- `All changes saved`
- `Profile, avatar, credentials and preferences synced at`
- `Changes discarded`
**Tabs:** `Personal Details`, `Security & Credentials`, `Notifications` as `role="tablist"` with the active tab in the URL hash (`#personal`, `#security`, `#notifications`) so the invite flow (`/admin/profile#security`) works; arrow-key navigation between tabs.
**Identity header:** avatar (image or initials), name, `ROLE_LABELS[role]` (plus `· Incident Commander` ONLY when the API ever supplies that flag — not available now: render just the role), member-since (`Mar 2024`), username, `MFA` summary (`mfaSummary`), last sign-in (`formatRelativeActive`), active sessions count; the bio text from `bio`.
**Personal panel (RHF + Zod `UpdateProfileSettingsBody`):** fields `First Name`, `Last Name`, `Display Name`, `Job Title`, `Email` (read-only), `Phone`, `Time Zone` (`TIMEZONES` options), `Language` (`LANGUAGES`), `Bio` (counter `n / 400`). Save → `PATCH /account/settings`; toast `Personal details saved` / `Profile updated at <HH:MM:SS UTC> and written to the audit log.`; `Reset` → toast `Personal details reset` / `Restored to the last saved values.`; unsaved-changes guard (Save disabled when pristine).
**Avatar:** file input + drop target; client checks first (toasts `File too large` / `Avatar uploads are limited to 4 MB.`, `Unsupported file type` / `Please upload a PNG, JPG, WEBP or SVG image.`), then `POST /account/avatar/upload-url` → `PUT` to the presigned URL → `POST /account/avatar/confirm { objectKey }`; success toast `Avatar updated` / `Image accepted and queued for security scanning at <HH:MM:SS UTC>.`; `Remove` → `DELETE /account/avatar` → toast `Avatar removed` / `Falling back to initials across the platform.`; the prototype's `Generate initials avatar` is just the fallback (toast `Avatar generated` / `Initials image created for your account.` — no API call). SVG avatars must be rendered through `<img>` only.
**Footer actions:** `Discard changes` (toast `Changes discarded` / `All unsaved edits have been reverted to the last saved state.`) and `Save all changes` (saves the personal panel; toast `All changes saved` / `Profile, avatar, credentials and preferences synced at <HH:MM:SS UTC>.` only when every panel was saved).

**Tests:** header values from MSW; hash-driven tabs; Save payload; avatar type/size rejections and the three-request order; remove avatar; read-only email.

---

**Data shape (TypeScript):**
```ts
// ProfileSettings, UpdateProfileSettingsBody: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/account/settings → 200 { data: ProfileSettings } · PATCH /api/v1/account/settings body UpdateProfileSettingsBody → 200
// POST /api/v1/account/avatar/upload-url · POST …/avatar/confirm · DELETE …/avatar
```

---

**Out of scope:**
- Do not build the Security and Notifications panels (Task 83d).
- Do not render SVG avatars inline.
- Do not fake an `Incident Commander` label.

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
☐ Report at the end: `Task 83c complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 83d — Admin Profile Settings B: security & credentials, active sessions, notification preferences

**Layer:** L9

**Prerequisites:** Task 27, Task 29, Task 67, Task 83c

**Estimated files touched:** 13

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Profile Settings B: security & credentials, active sessions, notification preferences**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Security & Credentials and Notifications panels of `/admin/profile`, reusing the password/MFA/recovery components from the client Password Manager where possible.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/profile/_components/security-panel.tsx` — overwrites the stub.
- `apps/web/src/app/(authed)/admin/profile/_components/sessions-list.tsx`, `posture-card.tsx`, `notifications-panel.tsx` — overwrites the stub, `notification-matrix.tsx`, `quiet-hours.tsx`
- `apps/web/src/app/(authed)/admin/profile/_hooks/use-admin-security.ts`
- MODIFY `apps/web/src/app/(authed)/admin/profile/_styles/profile.css` — append.
- MODIFY `apps/web/src/mocks/handlers/admin-profile.ts`.
- `apps/web/src/app/(authed)/admin/profile/profile-b.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Reference markup:** the Security and Notifications panels are inside the page body block shown in Task 83c (search it for the `Change Password`, `Active Sessions` and `Notification Preferences` groups). Build them with exactly that structure and copy; the strings list below applies:

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `[VUNVAULT] Unable to persist profile:`
- `><circle cx=`
- `Profile picture`
- `Custom image`
- `File too large`
- `Avatar uploads are limited to 4 MB.`
- `Unsupported file type`
- `Please upload a PNG, JPG, WEBP or SVG image.`
- `Avatar updated`
- `Image accepted and queued for security scanning at`
- `Upload failed`
- `The file could not be read. Please try again.`
- `Avatar removed`
- `Falling back to initials across the platform.`
- `Avatar generated`
- `Initials image created for your account.`
- `Toggle password visibility`
- `Personal details saved`
- `Profile updated at`
- `and written to the audit log.`
- `Security settings updated`
- `Password change enforced across all sessions at`
- `Notification preferences saved`
- `Channel matrix updated at`
- `Changes saved`
- `Settings updated successfully.`
- `Dr. Evelyn Reed`
- `Super Administrator · Incident Commander`
- `Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate.`
- `Personal details reset`
- `Restored to the last saved values.`
- `Security form reset`
- `Password fields cleared.`
- `Notifications reset`
- `Restored to VUNVAULT defaults.`
- `Saving all…`
- `All changes saved`
- `Profile, avatar, credentials and preferences synced at`
- `Changes discarded`
**Security & Credentials panel:** (1) **Posture card:** `GET /account/security` → `SecurityPosture` (score meter, label `Strong posture`/`Fair posture`/`Weak posture`, items with ✓/○). (2) **Change password:** reuse the `ChangePasswordCard` from `apps/web/src/app/(authed)/portal/security/_components` by importing it (do not copy); staff minimum is 14 characters (the component already switches by role); on success toast `Security settings updated` / `Password change enforced across all sessions at <HH:MM:SS UTC>.`. (3) **Authenticator app, hardware keys, recovery codes:** import the same `TotpPanel`, `SecurityKeyPanel`, `RecoveryKeysCard` from the portal security feature; the manual-secret copy button toasts `Manual secret copied to clipboard.` and on failure `Clipboard blocked` / `Copy the secret manually: <secret>`. (4) **Require 2FA** switch (read-only for staff: always on; render as a disabled checked switch with helper `Required for all staff accounts.`). (5) **Active sessions:** `GET /account/sessions` list (device label, ip, `location`, MFA method, started, `This device` chip for `current`), per-row `Revoke` (`DELETE …/sessions/:id`), `Sign out all other sessions` (`POST …/revoke-others`; toast `Sessions revoked` / `<n> other session(s) were signed out.` planner). (6) **Request deactivation** (danger zone): button → dialog with a required reason ≥ 10 characters → `POST /account/deactivation-request`; toast `Request sent` / `A super administrator will review your deactivation request.` (planner); `409 already_requested` → `You already have a pending request.`.
**Notifications panel:** `GET /account/notifications`; a matrix (rows = the 11 `NOTIFICATION_EVENT_META` events grouped as `Security & Access`, `Scan Operations`, `Threat Intelligence`, `Administrative` with titles/descriptions verbatim; columns `In-App`, `Email`, `SMS`, `Push` as real checkboxes, `aria-label` = `<event title> — <channel>`); a note that credential changes and SEV-1 alerts ignore opt-outs and quiet hours (`Critical security alerts are always delivered.` planner); `Quiet hours` switch + two `time` inputs (`From`, `To`; validation per contract). `Save` → `PUT /account/notifications` (toast `Notification preferences saved` / `Channel matrix updated at <HH:MM:SS UTC>.`); `Reset to Defaults` (in-app + email on, sms + push off for every event; toast `Notifications reset` / `Restored to VUNVAULT defaults.`) only changes the form until saved.

**Tests:** posture card renders the API values; the password card is the imported component (assert by test id); sessions list/revoke/revoke-others; deactivation dialog validation and 409; notification matrix state and the `PUT` payload shape; quiet-hours validation; defaults reset.

---

**Data shape (TypeScript):**
```ts
// MfaStatus, SecurityPosture, SessionView, NotificationPrefs: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/account/security · GET/DELETE /account/sessions[/:id] · POST /account/sessions/revoke-others · GET/PUT /account/notifications · POST /account/deactivation-request body { reason }
```

---

**Out of scope:**
- Do not copy the portal security components (import them).
- Do not allow staff to disable 2FA.
- Do not store anything in browser storage.

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
☐ Report at the end: `Task 83d complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 83e — Admin Contact inbox and Verified-Blogger badge management (planner-authored — no prototype)

**Layer:** L9

**Prerequisites:** Task 40f, Task 46, Task 75, Task 12

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Contact inbox and Verified-Blogger badge management (planner-authored — no prototype)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/contact`: the triage inbox for public contact messages (including verification requests) and the client directory with the badge grant/revoke control.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/contact/page.tsx`
- `apps/web/src/app/(authed)/admin/contact/_components/inbox-table.tsx`, `message-dialog.tsx`, `client-directory.tsx`, `badge-toggle.tsx`
- `apps/web/src/app/(authed)/admin/contact/_hooks/use-contact-admin.ts`
- `apps/web/src/app/(authed)/admin/contact/_styles/contact.css`
- MODIFY `apps/web/src/app/(authed)/admin/_components/admin-nav.ts` — add `Contact Inbox` · `/admin/contact` · `support:handle` (drawer label `Contact Inbox`).
- `apps/web/src/mocks/handlers/admin-contact.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/contact/contact-admin.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Planner-authored page; use the shared admin classes. Copy:** eyebrow `Support & Verification`, h1 `Contact Inbox`, description `Public contact requests, vulnerability reports and Verified Blogger verification requests.` Tabs: `Messages`, `Clients & Badges`.
**Messages tab:** summary chips (`New`, `Triaged`, `Closed` counts from the list totals), filters (status, category via `CONTACT_CATEGORY_LABELS`, search), `DataTable` columns `Received`, `From` (name + email + organisation), `Category`, `Subject`, `Status`, `Assigned to`, `Actions` (`Open`). `Open` shows a dialog with the full message (text node only), a status select (`new|triaged|closed`), an assignee select (active staff), `Save` → `PATCH /admin/contact/:id`; toast `Message updated` / `The request was saved.`. A message whose category is `journalist_blogger_profile_request` shows the banner `Verification request — grant the Verified Blogger badge from the Clients & Badges tab after you have verified the applicant.` with a `Find client` button that switches tabs and pre-fills the search with the sender's email.
**Clients & Badges tab:** requires `users:read` (otherwise hidden). `GET /admin/clients` table: `Client`, `Email`, `Company`, `Client ID`, `Verified Blogger` (chip), `Action` (`Grant badge` / `Revoke badge` — only with `users:manage`; confirm dialog; `POST/DELETE /admin/users/:id/blogger-badge`; toasts `Badge granted` / `<email> can now use the Content Studio.` and `Badge revoked` / `<email> can no longer submit articles.`).

**Tests:** inbox rows and filters; message dialog saves status/assignee; verification banner and the tab hand-off; badge grant/revoke permission gating and toasts.

---

**Data shape (TypeScript):**
```ts
// ContactMessageView, ClientDirectoryItem: see contracts (Task 40f).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/contact · PATCH /api/v1/admin/contact/:id · GET /api/v1/admin/clients · POST|DELETE /api/v1/admin/users/:id/blogger-badge
```

---

**Out of scope:**
- Do not send replies from the inbox.
- Do not expose the message body to roles without `support:handle`.
- Do not edit other admin pages.

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
☐ Report at the end: `Task 83e complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 84 — Scan controller foundation: env, queue consumer, target guard, signed API client, control channel

**Layer:** L10

**Prerequisites:** Task 3, Task 4, Task 22, Task 35, Task 40g

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Scan controller foundation: env, queue consumer, target guard, signed API client, control channel**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the scan controller skeleton: a BullMQ consumer on the `scan` queue that claims a job through the signed API, re-validates the target and authorisation, enforces the worker-slot limit, and relays abort/kill/pause/resume signals — with the pod execution behind an interface.

**Deliverables:**
- MODIFY `apps/scan-worker/package.json` — scripts `dev` (`tsx watch src/main.ts`), `build` (`tsc -p tsconfig.build.json`), `start` (`node dist/main.js`); dependencies.
- `apps/scan-worker/tsconfig.build.json`.
- `apps/scan-worker/src/config/env.ts` — `loadEnv()`.
- `apps/scan-worker/src/main.ts` — bootstrap + graceful shutdown.
- `apps/scan-worker/src/queue/consumer.ts` — `startConsumer(deps)`.
- `apps/scan-worker/src/domain/target-guard.ts` — `validateTarget`, `resolveTarget`, IP classification.
- `apps/scan-worker/src/domain/job-runner.ts` — `JobRunner` (orchestration; pod execution injected).
- `apps/scan-worker/src/ports.ts` — `ApiClient`, `PodRunner`, `RedisBus`, `Clock` interfaces.
- `apps/scan-worker/src/adapters/signed-api-client.ts` — `SignedApiClient` (fetch + HMAC).
- `apps/scan-worker/src/adapters/redis-bus.ts` — `IoRedisBus`.
- `apps/scan-worker/src/domain/slots.ts` — Redis counting semaphore.
- `apps/scan-worker/src/domain/target-guard.test.ts`, `job-runner.test.ts`, `signed-api-client.test.ts`, `slots.test.ts`.
- `apps/scan-worker/.env.example` — names only.
- `apps/scan-worker/README.md` — 25 lines: the isolation model and how to run locally with fakes.

**Dependencies allowed:**
- `bullmq`, `ioredis`, `pino`, `zod`, `@vunvault/contracts` (workspace).
- `tsx` (dev).
- Nothing else (Kubernetes client arrives in Task 86).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Scan-worker conventions (identical in every scan-worker task — do not deviate):**
- Node.js 22, TypeScript strict. No web framework: this app is a BullMQ consumer plus helpers. Forbidden: Express, Prisma, Joi, `localStorage`, any hard-coded secret.
- **Isolation model (the whole point of this app):** Frontend → API → BullMQ `scan` queue → **scan controller** (this app, on the self-managed k3s cluster) → one **unprivileged, ephemeral pod per scan** → stdout streamed by the controller to Redis Pub/Sub → the API's WebSocket relay (Layer L12) → the browser terminal. The browser NEVER talks to scan infrastructure. The scan pod NEVER touches the OKE cluster, the database, Redis, or any secret.
- The controller holds NO database credentials. It reports to the API only through the HMAC-signed internal callback routes (`/api/v1/internal/scans/*`, Task 40g). Its only credentials are: Upstash Redis URL, the API callback HMAC key, and the in-cluster service account limited to namespace `vv-scans`. They arrive as environment variables injected from Kubernetes Secrets (created from OCI Vault values at deploy time by the DevOps layer); nothing is committed and nothing is read from files.
- Config via Zod-validated env (`loadEnv()`); fail fast with a readable message. Logging with `pino` (redact `*.hmacKey`, `*.redisUrl`, anything named `secret`, `token`, `password`).
- All I/O behind small interfaces (`ApiClient`, `PodRunner`, `RedisBus`, `Clock`) so tests use fakes; no live Redis, Kubernetes, network or filesystem in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop taking jobs, let running scans finish up to 20 s, then abort them (publish `abort`), exit.

N/A — no UI.

**Env (`loadEnv`):** `NODE_ENV`; `UPSTASH_REDIS_URL` (TLS); `API_BASE_URL` (url, the API's public origin); `SCAN_CONTROLLER_HMAC_KEY` (base64, ≥ 32 bytes); `WORKER_SLOTS_TOTAL` (default 24); `SCAN_DEADLINE_SECONDS` (default 900, max 900); `RUNNER_IMAGE` (required in production, must contain `@sha256:`); `K8S_NAMESPACE` (default `vv-scans`); `LOG_LEVEL`. `.env.example` lists names only.

**Ports (exact):**
```ts
interface ApiClient {
  claim(jobId: string, i: { queueJobId: string; podName?: string }): Promise<InternalClaimResponse | { conflict: "not_claimable" | "authorisation_invalid" }>;
  progress(jobId: string, p: { progress: number; etaSeconds: number | null }): Promise<void>;
  findings(jobId: string, f: InternalFinding[]): Promise<void>;
  logUrl(jobId: string, sizeBytes: number): Promise<{ uploadUrl: string; objectKey: string }>;
  complete(jobId: string, i: { exitCode: number; lineCount: number; bytesStreamed: number; redactedLogKey?: string }): Promise<void>;
  fail(jobId: string, i: { reason: string; abortReason: "abort" | "kill" | "deadline" | "error" }): Promise<void>;
}
interface PodRunner { run(spec: PodSpec, hooks: RunHooks, signal: AbortSignal): Promise<RunResult> }   // implemented in Task 86
interface RedisBus { publish(channel: string, msg: string): Promise<void>; subscribe(channel: string, onMsg: (m: string) => void): Promise<() => Promise<void>>; rpushCapped(key: string, v: string, cap: number, ttlSec: number): Promise<void> }
type ControlMessage = { type: "abort" | "pause" | "resume" | "kill" };
```
**`SignedApiClient`:** signs every request exactly as Task 40g specifies (`timestamp + "." + METHOD + "." + path + "." + sha256hex(body)`), 10 s timeout, retries only idempotent calls (`progress`) up to 2 times with 200 ms backoff; `claim` and `complete` are NEVER auto-retried on a 4xx; 5xx on `complete`/`fail` retried up to 5 times with exponential backoff (they are idempotent on the API: a repeat returns `409 invalid_state`, treated as success).

**Target guard (pure + one DNS function; this is a security control — test it hard):**
- `validateTarget(raw, scanType)` accepts: hostname (`^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$`, lower-cased, no trailing dot), URL (take the hostname only; scheme must be `http`/`https`; strip userinfo and path), IPv4, or IPv4 CIDR with prefix ≥ 24 (max 256 addresses). IPv6 is rejected in v1. Anything else → `{ ok: false, reason: "invalid_target" }`.
- `classifyIp(ip)` marks as **forbidden**: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16` (includes the cloud metadata address `169.254.169.254`), `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`, and the broadcast address.
- `resolveTarget(host)` uses `node:dns/promises` `resolve4` (NOT the system resolver cache) with a 3 s timeout; ALL returned addresses must be public (one forbidden address rejects the whole target: `{ ok: false, reason: "target_not_allowed" }`); returns `{ ok: true, ips: string[] (max 16), host }`. A CIDR target is checked as a range (reject if it overlaps any forbidden range) and returns the CIDR. This pins the IPs the pod may reach (DNS-rebinding defence: the pod receives the resolved IPs, it does not resolve names itself).
- Private/internal targets are NOT scannable in v1 (the cloud-hosted scan cluster cannot reach customer private networks); `internal` and `network` scan types are accepted only for public addresses. Add a comment `// DECISION(v1): internal-network scans need a customer-side agent (future)`.

**`JobRunner.handle(job)` (the consumer calls it; pure orchestration with injected ports):**
1. Acquire a slot (`slots.ts`: Redis `INCR scan:slots`, reject and requeue when ≥ `WORKER_SLOTS_TOTAL`; always release in `finally`; slot keys expire after 20 minutes as a leak guard).
2. `api.claim()`: `conflict` → finish the BullMQ job successfully WITHOUT running (log `info`); `authorisation_invalid` → finish (the API already held the job).
3. `validateTarget` + `resolveTarget` on the claimed `targetHost`; failure → `api.fail({ reason, abortReason: "error" })`.
4. Subscribe to Redis `scan:ctl:<jobId>` for `ControlMessage`s (validate with Zod; ANY other shape is dropped and logged — the only accepted types are `abort`, `pause`, `resume`, `kill`); `abort`/`kill` trigger the `AbortController` passed to the runner.
5. Call `podRunner.run(spec, hooks, signal)` where `hooks.onLine/onProgress/onFinding` are provided by Task 88 (here: no-op defaults so the foundation is testable); `RunResult = { exitCode: number; reason: "completed" | "abort" | "kill" | "deadline" | "error"; lineCount: number; bytesStreamed: number }`.
6. Map the result: `completed` → `api.complete`; others → `api.fail({ abortReason })`. Unexpected exceptions → `api.fail({ reason: "controller_error", abortReason: "error" })` (message truncated to 300 chars, no stack).
7. Always unsubscribe and release the slot.
`PodSpec = { jobId, jobCode, attempt, scanType, host, ips: string[], cidr?: string, deadlineSeconds }` (defined in `ports.ts`).

**Consumer:** BullMQ `Worker` on queue `scan` with `concurrency = WORKER_SLOTS_TOTAL`, payload validated with `ScanJobPayload` from contracts (invalid payload → fail the job permanently, log `error`), `lockDuration: 60_000`, `attempts` is 1 (set by the API).

**Tests (assert):** every forbidden range, plus `169.254.169.254`, `127.0.0.1`, `localhost`-style names resolving to loopback (fake resolver), `10.24.8.0/24`, a CIDR /16 (too large), a hostname with ONE private A record among public ones → rejected; a public target passes and returns ≤ 16 IPs; URL with `user:pass@` is stripped; an unknown control message is ignored; `abort` aborts the runner signal; a `conflict` claim never calls the runner; the slot is released on every path; the HMAC signature matches a known vector from Task 40g's algorithm; `complete` 5xx retries but 4xx does not.

---

**Data shape (TypeScript):**
```ts
interface PodSpec { jobId: string; jobCode: string; attempt: number; scanType: ScanType; host: string; ips: string[]; cidr?: string; deadlineSeconds: number }
interface RunResult { exitCode: number; reason: "completed" | "abort" | "kill" | "deadline" | "error"; lineCount: number; bytesStreamed: number }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Outbound (signed) calls to the API: POST /api/v1/internal/scans/:id/{claim|progress|findings|log-url|complete|fail}   (Task 40g)
// Redis: subscribe scan:ctl:<jobId> (messages { type: "abort"|"pause"|"resume"|"kill" })
```

---

**Out of scope:**
- Do not create Kubernetes objects (Task 86).
- Do not add database access.
- Do not run any scanning tool in the controller process.
- Do not accept any control message type other than the four listed.

---

**Definition of done:**
☐ `pnpm --filter scan-worker typecheck` passes with zero errors.
☐ `pnpm --filter scan-worker lint` passes with zero errors.
☐ `pnpm --filter scan-worker typecheck` and `pnpm --filter scan-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 84 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 85 — Scan output pipeline: ANSI stripping, credential redaction, line caps, finding normalisation

**Layer:** L10

**Prerequisites:** Task 84, Task 40g

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Scan output pipeline: ANSI stripping, credential redaction, line caps, finding normalisation**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the pure output pipeline that turns raw pod stdout into safe terminal lines and normalised findings: strip terminal escapes, redact credentials, cap line length, parse the pod-to-controller event protocol, and dedupe/cap findings.

**Deliverables:**
- `apps/scan-worker/src/output/sanitise.ts` — `sanitiseLine`.
- `apps/scan-worker/src/output/redact.ts` — `redact` and the pattern table.
- `apps/scan-worker/src/output/protocol.ts` — `parseProtocolLine` and event types.
- `apps/scan-worker/src/output/classify.ts` — `classifyLine` (maps a human line to a terminal `kind`).
- `apps/scan-worker/src/output/findings.ts` — `FindingCollector`.
- `apps/scan-worker/src/output/line-buffer.ts` — chunk → line splitter with a hard memory cap.
- `apps/scan-worker/src/output/output.test.ts`, `redact.test.ts`, `protocol.test.ts`.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Scan-worker conventions (identical in every scan-worker task — do not deviate):**
- Node.js 22, TypeScript strict. No web framework: this app is a BullMQ consumer plus helpers. Forbidden: Express, Prisma, Joi, `localStorage`, any hard-coded secret.
- **Isolation model (the whole point of this app):** Frontend → API → BullMQ `scan` queue → **scan controller** (this app, on the self-managed k3s cluster) → one **unprivileged, ephemeral pod per scan** → stdout streamed by the controller to Redis Pub/Sub → the API's WebSocket relay (Layer L12) → the browser terminal. The browser NEVER talks to scan infrastructure. The scan pod NEVER touches the OKE cluster, the database, Redis, or any secret.
- The controller holds NO database credentials. It reports to the API only through the HMAC-signed internal callback routes (`/api/v1/internal/scans/*`, Task 40g). Its only credentials are: Upstash Redis URL, the API callback HMAC key, and the in-cluster service account limited to namespace `vv-scans`. They arrive as environment variables injected from Kubernetes Secrets (created from OCI Vault values at deploy time by the DevOps layer); nothing is committed and nothing is read from files.
- Config via Zod-validated env (`loadEnv()`); fail fast with a readable message. Logging with `pino` (redact `*.hmacKey`, `*.redisUrl`, anything named `secret`, `token`, `password`).
- All I/O behind small interfaces (`ApiClient`, `PodRunner`, `RedisBus`, `Clock`) so tests use fakes; no live Redis, Kubernetes, network or filesystem in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop taking jobs, let running scans finish up to 20 s, then abort them (publish `abort`), exit.

N/A — no UI. Everything here is pure and synchronous.

**`sanitiseLine(raw: string): string | null`:** (1) decode already done by the caller (UTF-8, replacement char for bad bytes); (2) strip ANSI: CSI (`\x1b\[[0-?]*[ -/]*[@-~]`), OSC (`\x1b\][^\x07\x1b]*(\x07|\x1b\\)`), and any other `\x1b`-initiated sequence up to 8 bytes; (3) remove every control character except `\t` (including `\r`, `\x00`, `\x08`, `\x7f`, and C1 controls `\x80–\x9f`); (4) collapse lines that consist only of whitespace to `null` (dropped); (5) apply `redact`; (6) cap at **8192 bytes** (UTF-8 safe — never split a code point) appending `…[truncated]`; (7) trim trailing whitespace. Idempotent.

**`redact(text)` — pattern table (each → `[REDACTED]`, keep the key name when the pattern is `key=value`):** `Authorization: (Bearer|Basic|Token) …`; `Cookie:` / `Set-Cookie:` header values; JWTs (`eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}`); `-----BEGIN [A-Z ]*PRIVATE KEY-----` through the END line (multi-line aware: once a BEGIN line is seen the buffer state redacts until END — implement as a stateful `Redactor` class with `push(line)`); AWS access keys (`\b(AKIA|ASIA)[0-9A-Z]{16}\b`) and secret-looking 40-char base64 after `aws_secret_access_key`; GitHub tokens (`gh[pousr]_[A-Za-z0-9]{36,}`); Slack tokens (`xox[baprs]-[A-Za-z0-9-]{10,}`); Google API keys (`AIza[0-9A-Za-z_-]{35}`); Stripe keys (`[sr]k_(live|test)_[0-9A-Za-z]{16,}`); URLs with credentials (`://user:pass@` → `://[REDACTED]@`); `(password|passwd|pwd|secret|token|api[_-]?key|apikey|auth|session|credential)s?\s*[:=]\s*\S+` (case-insensitive); long hex (≥ 32) or base64 (≥ 40) strings adjacent to those keywords. E-mail addresses are NOT redacted (they are legitimate findings evidence); redact nothing beyond this table. The table is data, exported as `REDACTION_PATTERNS` so Task 40g's server-side redactor and tests share the same list conceptually (copy, not import).

**Pod → controller protocol (`protocol.ts`):** the runner prints human lines normally; machine events are lines starting with the exact prefix `@@VV@@ ` followed by one JSON object. Parse with Zod: `{ t: "progress", pct: int 0..99, etaSec?: int | null }`, `{ t: "finding", severity, title, description, evidence?, cvss?, cwe?, remediation? }`, `{ t: "phase", name: string ≤ 40 }`, `{ t: "done", exit: int }`. `parseProtocolLine(line): ProtocolEvent | null | "invalid"` — a line that starts with the prefix but fails validation returns `"invalid"` (log and drop; NEVER forward protocol lines to the terminal). A pod that prints the prefix inside tool output cannot forge events beyond these schemas; `finding.evidence` is redacted and capped to 2,000 characters; titles to 200; descriptions to 4,000.

**`classifyLine(line): "sys"|"muted"|"info"|"ok"|"warn"|"crit"`** (the terminal colours the prototype used): lines beginning `[*]`/`[+]` → `ok`/`info`; `[!]` → `warn`; `[!!]`/containing `CRITICAL` → `crit`; `[~]`, `[-]` → `muted`; lines beginning `$ ` or `#` → `sys`; default `info`.

**`FindingCollector`:** `add(event)` normalises severity (`critical|high|medium|low`; `info` is dropped), dedupes by `(title.toLowerCase(), cwe ?? "")`, keeps at most **500** findings (extra ones counted in `dropped`), `drain(max=100)` returns batches for the API call, `counts()` returns `{ critical, high, medium, low }`.

**`line-buffer.ts`:** `LineBuffer.push(chunk: Buffer): string[]` splits on `\n`, keeps a partial tail, and if the tail exceeds 64 KB without a newline it flushes it as a line (so a pod cannot exhaust memory with an endless line).

**Tests (assert):** ANSI colour codes, cursor movement and an OSC hyperlink are removed; `\r` progress-bar rewrites are collapsed; a 20 KB line becomes ≤ 8,192 bytes ending `…[truncated]` and is valid UTF-8 even when the cut falls mid-emoji; each redaction pattern with a sample (assert the secret substring is gone); a multi-line private key block is fully redacted across `push` calls; idempotence (`sanitiseLine(sanitiseLine(x)) === sanitiseLine(x)`); forged protocol lines with bad JSON → `"invalid"`; `info`-severity findings dropped; dedupe; the 501st finding is counted as dropped; an endless line is flushed at 64 KB.

---

**Data shape (TypeScript):**
```ts
type ProtocolEvent =
  | { t: "progress"; pct: number; etaSec?: number | null }
  | { t: "finding"; severity: "critical" | "high" | "medium" | "low" | "info"; title: string; description: string; evidence?: string; cvss?: number; cwe?: string; remediation?: string }
  | { t: "phase"; name: string }
  | { t: "done"; exit: number };
```

**API contract (as comments only — do NOT implement the backend):**
N/A — pure functions.

---

**Out of scope:**
- Do not perform I/O (no Redis, no network, no files).
- Do not forward protocol lines to the terminal.
- Do not redact e-mail addresses.

---

**Definition of done:**
☐ `pnpm --filter scan-worker typecheck` passes with zero errors.
☐ `pnpm --filter scan-worker lint` passes with zero errors.
☐ `pnpm --filter scan-worker typecheck` and `pnpm --filter scan-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 85 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 86 — Kubernetes pod runner: unprivileged per-scan Job, per-job NetworkPolicy, log streaming, deadline, control

**Layer:** L10

**Prerequisites:** Task 84, Task 85

**Estimated files touched:** 17

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Kubernetes pod runner: unprivileged per-scan Job, per-job NetworkPolicy, log streaming, deadline, control**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement `PodRunner` on the k3s Kubernetes API: create one locked-down Job per scan with an egress-only-to-target NetworkPolicy, stream and sanitise its logs to Redis Pub/Sub, enforce the 15-minute deadline, support abort/kill/pause/resume, and clean everything up.

**Deliverables:**
- `apps/scan-worker/src/k8s/pod-manifest.ts` — `buildJobManifest(spec, env)`.
- `apps/scan-worker/src/k8s/network-policy.ts` — `buildNetworkPolicy(spec)`.
- `apps/scan-worker/src/k8s/k8s-pod-runner.ts` — `K8sPodRunner implements PodRunner`.
- `apps/scan-worker/src/k8s/kube.ts` — thin wrapper around `@kubernetes/client-node` (interface `KubeClient` for fakes).
- `apps/scan-worker/src/k8s/log-stream.ts` — follow logs, sanitise, publish.
- `apps/scan-worker/src/k8s/*.test.ts` — manifest, policy, runner and log-stream tests.
- `apps/scan-worker/k8s/namespace.yaml` — namespace `vv-scans` with Pod Security `restricted` labels.
- `apps/scan-worker/k8s/default-deny-networkpolicy.yaml` — default-deny ingress AND egress for the namespace.
- `apps/scan-worker/k8s/controller-rbac.yaml` — ServiceAccount, Role, RoleBinding for the controller.
- `apps/scan-worker/k8s/resource-quota.yaml` and `limit-range.yaml`.
- `apps/scan-worker/k8s/README.md` — 15 lines: these files are chart sources; never `kubectl apply` them by hand (Layer L13 deploys through Helm).
- MODIFY `apps/scan-worker/package.json` — add dependency.

**Dependencies allowed:**
- `@kubernetes/client-node`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Scan-worker conventions (identical in every scan-worker task — do not deviate):**
- Node.js 22, TypeScript strict. No web framework: this app is a BullMQ consumer plus helpers. Forbidden: Express, Prisma, Joi, `localStorage`, any hard-coded secret.
- **Isolation model (the whole point of this app):** Frontend → API → BullMQ `scan` queue → **scan controller** (this app, on the self-managed k3s cluster) → one **unprivileged, ephemeral pod per scan** → stdout streamed by the controller to Redis Pub/Sub → the API's WebSocket relay (Layer L12) → the browser terminal. The browser NEVER talks to scan infrastructure. The scan pod NEVER touches the OKE cluster, the database, Redis, or any secret.
- The controller holds NO database credentials. It reports to the API only through the HMAC-signed internal callback routes (`/api/v1/internal/scans/*`, Task 40g). Its only credentials are: Upstash Redis URL, the API callback HMAC key, and the in-cluster service account limited to namespace `vv-scans`. They arrive as environment variables injected from Kubernetes Secrets (created from OCI Vault values at deploy time by the DevOps layer); nothing is committed and nothing is read from files.
- Config via Zod-validated env (`loadEnv()`); fail fast with a readable message. Logging with `pino` (redact `*.hmacKey`, `*.redisUrl`, anything named `secret`, `token`, `password`).
- All I/O behind small interfaces (`ApiClient`, `PodRunner`, `RedisBus`, `Clock`) so tests use fakes; no live Redis, Kubernetes, network or filesystem in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop taking jobs, let running scans finish up to 20 s, then abort them (publish `abort`), exit.

N/A — no UI.

**Job manifest (`buildJobManifest`) — every field below is mandatory and is asserted by tests:**
- `apiVersion: batch/v1`, `kind: Job`, name `vv-scan-<jobCode lower>-a<attempt>` (≤ 63 chars, DNS-1123), namespace `vv-scans`, labels `app.kubernetes.io/name: vv-scan`, `vv/job-id: <uuid>`, `vv/job-code`, `vv/attempt`.
- `spec.backoffLimit: 0`, `spec.activeDeadlineSeconds: 900`, `spec.ttlSecondsAfterFinished: 300`, `spec.parallelism: 1`, `spec.completions: 1`.
- Pod `spec`: `restartPolicy: Never`; **`automountServiceAccountToken: false`**; `serviceAccountName: vv-scan-runner` (a ServiceAccount with NO bindings, created in `controller-rbac.yaml`); `enableServiceLinks: false`; `hostNetwork/hostPID/hostIPC: false`; `dnsPolicy: None` with `dnsConfig: { nameservers: ["127.0.0.1"] }` (the pod must not reach cluster DNS; names are pinned via `hostAliases` from the resolved IPs: one entry per resolved IP mapping to the target host); `terminationGracePeriodSeconds: 10`; `securityContext` (pod): `runAsNonRoot: true`, `runAsUser: 65532`, `runAsGroup: 65532`, `fsGroup: 65532`, `seccompProfile: { type: RuntimeDefault }`; no `nodeSelector` bypass — add `nodeSelector: { "vv/pool": "scan" }` and a toleration for `vv/scan=true:NoSchedule` so scans only run on the dedicated scan nodes.
- One container `runner`: `image: <RUNNER_IMAGE>` (digest-pinned), `imagePullPolicy: IfNotPresent`, `args: []`, `securityContext`: **`runAsNonRoot: true`, `runAsUser: 65532`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities: { drop: ["ALL"] }`, `privileged: false`, `seccompProfile: RuntimeDefault`**; `resources: { requests: { cpu: "250m", memory: "256Mi", "ephemeral-storage": "128Mi" }, limits: { cpu: "1", memory: "1Gi", "ephemeral-storage": "1Gi" } }`.
- **Scratch volume:** a single `emptyDir: { medium: Memory, sizeLimit: 1Gi }` named `scratch` mounted at `/tmp` (tmpfs, no persistent volumes — assert there is no `persistentVolumeClaim`, `hostPath`, `secret`, `configMap` or `projected` volume anywhere in the pod).
- `env` (the ONLY env the pod receives, plain values, no `valueFrom`): `VV_JOB_ID`, `VV_JOB_CODE`, `VV_SCAN_TYPE`, `VV_TARGET_HOST`, `VV_TARGET_IPS` (comma-separated), `VV_TARGET_CIDR` (optional), `VV_DEADLINE_SECONDS` = `840` (runner finishes before the Job deadline), `HOME=/tmp`. No secret, token, URL of the API, Redis or database is ever passed.
- No `ports`, no `volumeMounts` other than `/tmp`, no `lifecycle` hooks, no `command` override.

**NetworkPolicy (`buildNetworkPolicy`)** — one per job, name `vv-scan-<jobCode>-a<attempt>-egress`: `podSelector: { matchLabels: { "vv/job-id": <uuid> } }`, `policyTypes: ["Egress"]`, `egress: [ { to: [ { ipBlock: { cidr: "<ip>/32" } } …one per resolved IP, or the target CIDR ] } ]` (all ports — scanners probe many ports), NOTHING else: no DNS, no cluster CIDRs, no metadata IP. Combined with `default-deny-networkpolicy.yaml` this means a scan pod can reach only its target. Defence in depth: add an `except` list on CIDR targets so none of the forbidden ranges from Task 84 are inside the allowed block. The policy is created BEFORE the Job and deleted in `finally`; if policy creation fails the job fails closed (`error`).

**`K8sPodRunner.run(spec, hooks, signal)`:** (1) create NetworkPolicy then Job; (2) wait for the pod (poll/watch, max 120 s to reach Running — image pull failure → `error`); (3) follow container logs with `follow: true, timestamps: false`; feed chunks to `LineBuffer`; for each line: protocol events go to `hooks.onProgress/onFinding/onPhase` (Task 85 `parseProtocolLine`), human lines go through `sanitiseLine` and are delivered to `hooks.onLine({ seq, ts, kind, msg })` (the caller publishes them); enforce a total output cap of **5 MB** per scan — beyond it stop publishing, keep counting, and emit one final line `[!] Output limit reached — further output suppressed.`; (4) deadline: a controller-side timer at `deadlineSeconds` (900 s) deletes the Job with `propagationPolicy: Foreground` and resolves `reason: "deadline"`; (5) `signal` abort or a `kill` control: delete the Job immediately (`gracePeriodSeconds: 0`) and resolve `abort`/`kill`; `pause`/`resume`: send `SIGSTOP`/`SIGCONT` to the runner process through the Kubernetes exec API ONLY IF the cluster allows `pods/exec` for the controller role — it does NOT (no exec in RBAC): therefore implement pause/resume as a **no-op that publishes the line `[~] Pause is not supported in this environment.`** and document the limitation in a comment; (6) read the final exit code from the pod's terminated state (`exitCode`, `reason`), or `error` if absent; (7) always delete the Job and NetworkPolicy in `finally` and swallow 404s.
**RBAC (`controller-rbac.yaml`):** ServiceAccounts `vv-scan-controller` and `vv-scan-runner` (the latter with `automountServiceAccountToken: false`); a namespaced `Role` for the controller with ONLY: `batch/jobs` (create, get, list, watch, delete), `pods` (get, list, watch), `pods/log` (get), `networking.k8s.io/networkpolicies` (create, get, list, delete); NO `pods/exec`, NO secrets, NO configmaps, NO cluster-wide permissions; `RoleBinding` to the controller SA. `namespace.yaml` labels: `pod-security.kubernetes.io/enforce: restricted`, `…/enforce-version: latest`, `…/audit: restricted`, `…/warn: restricted`. `resource-quota.yaml`: `pods: "30"`, `requests.cpu: "12"`, `limits.cpu: "30"`, `limits.memory: 40Gi`. `limit-range.yaml`: default container limits `cpu 1 / memory 1Gi`.

**Tests (assert, against the generated objects — no cluster):** the full security-context list above (a table-driven test enumerates every required field and fails on any missing/different value); no secret/configMap/PVC/hostPath/projected volumes; `automountServiceAccountToken === false`; env contains exactly the allowed keys; `dnsPolicy` is `None`; the NetworkPolicy contains only the target `/32` blocks (and `except` ranges for CIDRs) and has no DNS/cluster rules; the Job name is DNS-safe for a long job code; runner with a fake `KubeClient`: normal completion resolves `completed`, the deadline timer (fake timers) deletes the Job and resolves `deadline`, abort deletes immediately, output over 5 MB stops publishing and emits the limit line once, Job and policy are deleted even on error, policy-create failure → `error` and no Job created; every RBAC verb in the YAML is parsed and asserted to equal the allowed list (no wildcards).

---

**Data shape (TypeScript):**
```ts
interface KubeClient { createNetworkPolicy(np: object): Promise<void>; deleteNetworkPolicy(name: string): Promise<void>; createJob(job: object): Promise<void>; deleteJob(name: string, i: { gracePeriodSeconds: number }): Promise<void>; waitForPod(label: string, timeoutMs: number): Promise<{ name: string }>; streamLogs(pod: string, onChunk: (b: Buffer) => void, signal: AbortSignal): Promise<void>; getTermination(pod: string): Promise<{ exitCode: number; reason?: string } | null> }
interface RunHooks { onLine(l: { seq: number; ts: string; kind: string; msg: string }): void; onProgress(p: { pct: number; etaSec: number | null }): void; onFinding(f: ProtocolEvent & { t: "finding" }): void; onPhase(n: string): void }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — Kubernetes API only (namespace `vv-scans`).

---

**Out of scope:**
- Do not give the pod any secret, service-account token, DNS or access beyond the target.
- Do not add `pods/exec` or any wildcard RBAC.
- Do not deploy anything (Layer L13).
- Do not implement the runner image (Task 87).

---

**Definition of done:**
☐ `pnpm --filter scan-worker typecheck` passes with zero errors.
☐ `pnpm --filter scan-worker lint` passes with zero errors.
☐ `pnpm --filter scan-worker typecheck` and `pnpm --filter scan-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 86 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 87 — Scan runner (inside the pod): tool adapters, argument allow-lists, protocol output, hardened image

**Layer:** L10

**Prerequisites:** Task 85

**Estimated files touched:** 18

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Scan runner (inside the pod): tool adapters, argument allow-lists, protocol output, hardened image**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the program that runs INSIDE the unprivileged pod: it validates its environment, runs allow-listed scanning tools without a shell, parses their output into the protocol events, enforces its own deadline, and ships as a hardened non-root image.

**Deliverables:**
- `apps/scan-worker/runner/src/main.ts` — entrypoint.
- `apps/scan-worker/runner/src/env.ts` — strict env parsing.
- `apps/scan-worker/runner/src/emit.ts` — `say(line)` and `event(obj)` writers (`@@VV@@ ` protocol).
- `apps/scan-worker/runner/src/exec.ts` — `runTool(spec)` using `spawn` WITHOUT a shell.
- `apps/scan-worker/runner/src/plan.ts` — `planFor(scanType, target)` returns ordered tool steps.
- `apps/scan-worker/runner/src/adapters/nmap.ts`, `httpx.ts`, `nuclei.ts`, `testssl.ts` — argv builders + output parsers.
- `apps/scan-worker/runner/src/severity.ts` — CVSS/severity mapping.
- `apps/scan-worker/runner/src/**/*.test.ts` — tests with captured sample outputs under `runner/test-fixtures/` (create small realistic fixtures: one nmap XML, one nuclei JSONL, one httpx JSONL, one testssl JSON).
- `apps/scan-worker/runner/tsconfig.json` — extends `../tsconfig.json`, `include: ["src"]`.
- `apps/scan-worker/Dockerfile.runner` — multi-stage hardened image.
- `apps/scan-worker/runner/.dockerignore`.
- `apps/scan-worker/runner/TOOLS.md` — table of pinned tool versions and where checksums are supplied (build args).
- MODIFY `apps/scan-worker/package.json` — add `fast-xml-parser` and scripts `build:runner`.

**Dependencies allowed:**
- `fast-xml-parser`.
- Nothing else. The scanning tools (nmap, nuclei, httpx, testssl.sh) are installed in the IMAGE, not as npm packages.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Scan-worker conventions (identical in every scan-worker task — do not deviate):**
- Node.js 22, TypeScript strict. No web framework: this app is a BullMQ consumer plus helpers. Forbidden: Express, Prisma, Joi, `localStorage`, any hard-coded secret.
- **Isolation model (the whole point of this app):** Frontend → API → BullMQ `scan` queue → **scan controller** (this app, on the self-managed k3s cluster) → one **unprivileged, ephemeral pod per scan** → stdout streamed by the controller to Redis Pub/Sub → the API's WebSocket relay (Layer L12) → the browser terminal. The browser NEVER talks to scan infrastructure. The scan pod NEVER touches the OKE cluster, the database, Redis, or any secret.
- The controller holds NO database credentials. It reports to the API only through the HMAC-signed internal callback routes (`/api/v1/internal/scans/*`, Task 40g). Its only credentials are: Upstash Redis URL, the API callback HMAC key, and the in-cluster service account limited to namespace `vv-scans`. They arrive as environment variables injected from Kubernetes Secrets (created from OCI Vault values at deploy time by the DevOps layer); nothing is committed and nothing is read from files.
- Config via Zod-validated env (`loadEnv()`); fail fast with a readable message. Logging with `pino` (redact `*.hmacKey`, `*.redisUrl`, anything named `secret`, `token`, `password`).
- All I/O behind small interfaces (`ApiClient`, `PodRunner`, `RedisBus`, `Clock`) so tests use fakes; no live Redis, Kubernetes, network or filesystem in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop taking jobs, let running scans finish up to 20 s, then abort them (publish `abort`), exit.

N/A — no UI. The runner is a separate entrypoint compiled to `runner/dist/main.js`.

**Runner contract:** reads ONLY the environment listed in Task 86 (`VV_JOB_ID`, `VV_JOB_CODE`, `VV_SCAN_TYPE`, `VV_TARGET_HOST`, `VV_TARGET_IPS`, `VV_TARGET_CIDR?`, `VV_DEADLINE_SECONDS`); anything missing or invalid → prints `[!] Invalid runner configuration.` and exits 2. Prints human lines to stdout and protocol events (`@@VV@@ {json}`) as defined in Task 85. Has NO network access except to the target IPs (enforced by the cluster) and uses NO DNS: tools are given the pinned IPs and the hostname is passed via `Host` headers/SNI only where a tool supports it. Writes only under `/tmp`. Exits `0` when all steps finish (including steps that found nothing), `1` when the plan could not run, `124` on its own deadline. Never prints environment variables, command lines containing secrets (there are none), or stack traces.

**Terminal narrative (the front end renders these lines; keep the prototype's voice and prefixes — `[*]` info, `[+]` ok, `[!]` warning, `[!!]` critical, `[~]` muted):**
`$ vunvault-scan --target <host> --mode <scan type>`, `[*] Resolving target (pinned): <ip,…>`, `[*] Phase: <name>` before each tool, `[+] <tool> finished in <n> s`, `[!] <title> (<severity>)` for each medium+ finding as it is parsed, `[!!] <title> (critical)` for criticals, and a final `[+] Scan complete · <n> findings (<c> critical, <h> high, <m> medium, <l> low)`. Each finding is ALSO emitted as a protocol `finding` event; progress events are emitted at each tool boundary with `pct` computed from a fixed weight table (e.g. external: httpx 10, nmap 35, testssl 15, nuclei 40) and `etaSec` estimated from elapsed time (null when unknown).

**`exec.ts` — `runTool({ bin, argv, timeoutMs, maxStdoutBytes, onStdoutLine })`:** `child_process.spawn(bin, argv, { shell: false, stdio: ["ignore","pipe","pipe"], env: { PATH: "/usr/local/bin:/usr/bin", HOME: "/tmp", LANG: "C.UTF-8" } })` — a minimal, constructed environment (the pod's own env is NOT passed to tools); absolute binary paths from a fixed table (`/usr/bin/nmap`, `/usr/local/bin/nuclei`, `/usr/local/bin/httpx`, `/opt/testssl/testssl.sh`); kill the process group on timeout (SIGTERM, then SIGKILL after 3 s); cap captured stdout at 20 MB (kill beyond); stderr is captured to a 64 KB ring buffer and surfaced only as one `[~]` line on non-zero exit. **No argument is ever built by string concatenation into a shell string.** The target is validated again here with the same grammar as Task 84 (hostname / IPv4 / CIDR ≥ /24) and rejected if it contains anything else (this is a second line of defence against option injection: also reject any value starting with `-`).

**Plans (`planFor`) and argv (all fixed flag sets; the only variable inputs are the validated target values and numeric limits):**
- `external`: `httpx -json -silent -status-code -title -tech-detect -follow-redirects -timeout 8 -rl 30 -u <host>` → `nmap -sT -Pn -n --top-ports 200 -sV --version-light --max-rate 100 --host-timeout 300s -oX - <ip…>` (TCP connect only; no raw sockets, so no `-sS`, no OS detection) → `testssl.sh --jsonfile-pretty /tmp/testssl.json --fast --warnings off <host>:443` (only when port 443 is open) → `nuclei -u <https://host> -jsonl -silent -severity critical,high,medium,low -tags cve,exposure,misconfig,tech,default-login,takeover -rl 50 -c 10 -timeout 10 -retries 0 -duc -ni -no-update-templates -t /opt/nuclei-templates` (templates are baked into the image; `-ni` disables interactsh/out-of-band).
- `api`: `httpx` (as above) → `nuclei` with `-tags api,swagger,graphql,jwt,cors,exposure,misconfig,cve`.
- `mobile`: same as `api` against the API host (the app binaries are not analysed in v1: add the line `[~] Mobile package analysis is not available; scanning the API surface only.`).
- `internal` / `network`: `nmap -sT -Pn -n --top-ports 1000 -sV --version-light --max-rate 100 --host-timeout 120s -oX - <ips|cidr>` → `nuclei -u <ip:port> …` for each open web port (max 20 URLs) with `-tags cve,exposure,misconfig,default-login`.
Never run: `--script` with arbitrary names, intrusive/DoS/brute-force templates (`-etags dos,bruteforce,intrusive,fuzz` always added to nuclei), `-sS`, `-O`, `--privileged`, `-iL` file inputs.

**Parsers:** nmap XML → open-port summary lines `[*] <ip>:<port>/tcp open <service> <version>` and findings for risky exposures (Telnet 23, FTP 21 cleartext, SMB 445 exposed, RDP 3389 exposed, database ports 3306/5432/1433/27017/6379 exposed to the internet → `high`/`medium` with remediation text); httpx JSONL → header/tech lines and findings for missing security headers (`Strict-Transport-Security`, `Content-Security-Policy` only when absent on an HTML 200 response → `low`); nuclei JSONL → findings (`info.severity`, `info.name`, `info.description`, `info.classification.cvss-score`, `info.classification.cwe-id[0]`, `matched-at`, `info.remediation`, `extracted-results`/`curl-command` omitted from evidence unless short and redacted by the controller); testssl JSON → findings for protocols/ciphers/cert issues rated `HIGH/CRITICAL/MEDIUM`. `severity.ts` maps tool severities and CVSS (`≥9.0` critical, `≥7.0` high, `≥4.0` medium, else low).

**Deadline:** the runner computes `deadline = start + VV_DEADLINE_SECONDS` and shrinks each tool's `timeoutMs` to the time remaining; at the deadline it kills the current tool, prints `[!] Deadline reached — partial results reported.`, emits a final `done` event with `exit: 124`, and exits 124 (partial findings already emitted are kept).

**`Dockerfile.runner` (multi-stage, hardened):** stage `build` on `node:22-bookworm-slim` compiles the runner (`pnpm --filter scan-worker build:runner`) with `pnpm deploy`-style pruned production deps; stage `tools` on `debian:12-slim` installs nmap and its libraries via apt (pinned `nmap=<version>*` through build arg `NMAP_VERSION`) and downloads nuclei and httpx release archives and testssl.sh with **build-arg versions and SHA-256 checksums verified with `sha256sum -c` (build fails on mismatch)**; nuclei templates are fetched at BUILD time into `/opt/nuclei-templates` from a pinned git tag/commit build arg; final stage `debian:12-slim`: copy node binary from the build stage, the compiled runner, the tools and templates; `apt-get purge` of everything not needed and removal of `/var/lib/apt/lists`, `apt`, `dpkg` binaries, shells other than `/bin/sh` (keep `sh` only if testssl requires `bash` — then keep `bash` only); create user `65532:65532` with no login shell and no home write access; set `USER 65532:65532`, `WORKDIR /tmp`, `ENTRYPOINT ["/usr/local/bin/node","/app/dist/main.js"]`; `ENV NODE_ENV=production`; no `EXPOSE`; labels with source, version and build date. The image must work with `readOnlyRootFilesystem: true` and `capabilities: drop ALL` (nmap connect scans do not need `NET_RAW`; verify no `setcap` binaries remain: add a final `RUN find / -xdev -perm /6000 -type f -delete` step). `TOOLS.md` documents each pinned version, its source URL, and that CI supplies the checksum build args (the checksums themselves are NOT committed in this task — leave the ARGs without defaults so the build fails loudly until CI provides them).

**Tests (with fixtures; no real tools):** `planFor` returns the exact step lists above per scan type; argv builders never contain a shell metacharacter source and always include the forbidden-tag exclusions; a target of `-oN /tmp/x` or `example.com;rm -rf /` is rejected before any spawn; the minimal env passed to `spawn` contains exactly PATH, HOME, LANG; each parser converts its fixture into the expected findings (counts and severities); progress events are monotonic and < 100 until done; the deadline test (fake timers + a hanging fake tool) kills it, emits partial results and exits 124; protocol lines produced by the runner round-trip through Task 85's `parseProtocolLine`.

---

**Data shape (TypeScript):**
```ts
interface ToolStep { name: "httpx" | "nmap" | "testssl" | "nuclei"; bin: string; argv: string[]; timeoutMs: number; weight: number }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — stdout protocol only (Task 85).

---

**Out of scope:**
- Do not implement the controller side.
- Do not add intrusive, brute-force or DoS capabilities.
- Do not pass the pod environment to tools.
- Do not fetch templates or tools at runtime.
- Do not commit checksum values.

---

**Definition of done:**
☐ `pnpm --filter scan-worker typecheck` passes with zero errors.
☐ `pnpm --filter scan-worker lint` passes with zero errors.
☐ `pnpm --filter scan-worker typecheck` and `pnpm --filter scan-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 87 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 88 — Controller wiring: live output to Redis, findings and progress to the API, log archive, isolation conformance suite

**Layer:** L10

**Prerequisites:** Task 84, Task 85, Task 86, Task 87, Task 40g

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Controller wiring: live output to Redis, findings and progress to the API, log archive, isolation conformance suite**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Wire the pieces together: publish sanitised lines to Redis Pub/Sub (with a replay buffer), forward progress and findings to the API, archive the sanitised log, finish the job, and add a conformance suite that fails if any isolation guarantee regresses.

**Deliverables:**
- `apps/scan-worker/src/domain/run-hooks.ts` — `makeRunHooks(deps)`.
- `apps/scan-worker/src/domain/log-archive.ts` — in-memory capped log accumulator + upload.
- `apps/scan-worker/src/domain/output-channel.ts` — channel/key naming + payload types (shared contract with the API relay).
- MODIFY `apps/scan-worker/src/domain/job-runner.ts` — use `makeRunHooks`, flush findings, upload log, call `complete`.
- MODIFY `apps/scan-worker/src/main.ts` — compose `K8sPodRunner`, `SignedApiClient`, `IoRedisBus`.
- `packages/contracts/src/scan-stream.ts` — `ScanStreamMessage`, `ScanClientMessage` Zod schemas (used by the API relay, Task 95).
- MODIFY `packages/contracts/src/index.ts` — export it.
- `apps/scan-worker/src/conformance/isolation.test.ts` — the isolation conformance suite.
- `apps/scan-worker/src/domain/run-hooks.test.ts`, `log-archive.test.ts`, `job-runner.integration.test.ts` — tests with fakes.
- `docs/adr/0003-scan-isolation.md` — one-page ADR: the isolation model, threat model (malicious target output, SSRF, resource exhaustion, escape attempts), and controls.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Scan-worker conventions (identical in every scan-worker task — do not deviate):**
- Node.js 22, TypeScript strict. No web framework: this app is a BullMQ consumer plus helpers. Forbidden: Express, Prisma, Joi, `localStorage`, any hard-coded secret.
- **Isolation model (the whole point of this app):** Frontend → API → BullMQ `scan` queue → **scan controller** (this app, on the self-managed k3s cluster) → one **unprivileged, ephemeral pod per scan** → stdout streamed by the controller to Redis Pub/Sub → the API's WebSocket relay (Layer L12) → the browser terminal. The browser NEVER talks to scan infrastructure. The scan pod NEVER touches the OKE cluster, the database, Redis, or any secret.
- The controller holds NO database credentials. It reports to the API only through the HMAC-signed internal callback routes (`/api/v1/internal/scans/*`, Task 40g). Its only credentials are: Upstash Redis URL, the API callback HMAC key, and the in-cluster service account limited to namespace `vv-scans`. They arrive as environment variables injected from Kubernetes Secrets (created from OCI Vault values at deploy time by the DevOps layer); nothing is committed and nothing is read from files.
- Config via Zod-validated env (`loadEnv()`); fail fast with a readable message. Logging with `pino` (redact `*.hmacKey`, `*.redisUrl`, anything named `secret`, `token`, `password`).
- All I/O behind small interfaces (`ApiClient`, `PodRunner`, `RedisBus`, `Clock`) so tests use fakes; no live Redis, Kubernetes, network or filesystem in unit tests.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop taking jobs, let running scans finish up to 20 s, then abort them (publish `abort`), exit.

N/A — no UI.

**Redis contract (exact; the API's WebSocket relay in Task 95 depends on it):**
- Live channel `scan:out:<jobId>` (Pub/Sub): each message is JSON `ScanStreamMessage`:
```ts
type ScanStreamMessage =
  | { type: "line"; seq: number; ts: string /* ISO */; kind: "sys"|"muted"|"info"|"ok"|"warn"|"crit"; msg: string }
  | { type: "progress"; progress: number; etaSeconds: number | null }
  | { type: "phase"; name: string }
  | { type: "status"; status: "running" | "completed" | "failed" | "cancelled"; reason?: string };
```
- Replay buffer: Redis list `scan:buf:<jobId>` receives every `line`/`phase`/`status` message JSON via `RPUSH` + `LTRIM` to the last **2,000** entries and `EXPIRE` 3,600 s (late joiners and reconnects replay it before going live).
- Control channel `scan:ctl:<jobId>` (inbound, Task 84): `{ type: "abort"|"pause"|"resume"|"kill" }` only.
- Client → server messages accepted by the relay are limited to those same four types (`ScanClientMessage` Zod schema, `.strict()`); put both schemas in `packages/contracts/src/scan-stream.ts` with tests.

**`makeRunHooks`:** `onLine` → assign monotonically increasing `seq` (starting at 1), publish `line` + push to the buffer, append the SAME sanitised text to `LogArchive` (cap 5 MB; beyond that keep counting only); `onProgress` → throttle to at most one API call per 2 s (`api.progress`) and publish a `progress` message each time; `onPhase` → publish `phase`; `onFinding` → `FindingCollector.add` (Task 85) and flush batches of up to 100 to `api.findings` every 5 s and at the end; also emit a `warn`-kind line for medium+ findings is already done by the runner — do not duplicate. Publishing failures are logged and never abort the scan; API `progress/findings` failures are retried by the client and never abort the scan; a failing `api.findings` flush at the end retries 5 times then marks the run `error` (the job must not complete with lost findings).

**Finish sequence in `JobRunner` (after `podRunner.run` resolves `completed`):** flush findings → `api.logUrl()` → `PUT` the archived log (`text/plain`, sanitised lines joined with `\n`) to the presigned URL (failure is logged, the key is then omitted) → `api.complete({ exitCode, lineCount, bytesStreamed, redactedLogKey })` → publish `status: completed`. On `abort`/`kill`/`deadline`/`error` → flush whatever findings exist (deadline keeps partial findings), `api.fail`, publish `status` (`cancelled` for abort/kill, `failed` otherwise, with a short `reason`).

**Isolation conformance suite (`isolation.test.ts`) — table-driven; each row is a test that fails with a clear message:** (1) the generated Job manifest satisfies every item of Task 86's security list; (2) the NetworkPolicy allows only target IPs; (3) the manifest env keys equal the allow-list and no value matches `redis://`, `postgres`, `Bearer`, the API origin or the HMAC key; (4) RBAC YAML grants exactly the allowed verbs and no wildcard / exec / secrets; (5) the controller source tree contains no import of `drizzle-orm`, `@vunvault/db`, `pg`, `postgres` (static scan); (6) the controller never forwards a pod `@@VV@@` line to the terminal; (7) a hostile pod log (ANSI bombs, a 10 MB line, a forged `done` event, a fake private key block, a line containing `Authorization: Bearer xyz`) produces only sanitised, capped, redacted terminal lines; (8) an unknown control message is ignored; (9) a runner that never exits is killed at the deadline and the Job + NetworkPolicy are deleted; (10) the client WebSocket schema rejects `{ type: "exec" }` and any extra property; (11) the Dockerfile.runner text contains `USER 65532:65532`, no `curl | sh`, `sha256sum -c`, and no `--privileged`/`setcap`.

**Tests (assert):** full happy path with fakes publishes ordered `seq` lines, throttles progress, uploads the log and calls `complete` once; a `kill` mid-run publishes `status: cancelled` and calls `fail` with `abortReason: "kill"`; findings are flushed before `complete`; lost-findings failure prevents completion; replay buffer is capped at 2,000.

---

**Data shape (TypeScript):**
```ts
type ScanClientMessage = { type: "abort" | "pause" | "resume" | "kill" };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Redis: scan:out:<jobId> (pub/sub, ScanStreamMessage) · scan:buf:<jobId> (list, last 2000, TTL 1h) · scan:ctl:<jobId> (inbound ScanClientMessage)
// Outbound signed API calls: progress, findings, log-url, complete, fail (Task 40g)
```

---

**Out of scope:**
- Do not implement the WebSocket relay or the browser terminal (Layer L12).
- Do not add database access to the controller.
- Do not weaken any control to make a test pass.
- Do not store raw (unsanitised) output anywhere.

---

**Definition of done:**
☐ `pnpm --filter scan-worker typecheck` passes with zero errors.
☐ `pnpm --filter scan-worker lint` passes with zero errors.
☐ `pnpm --filter scan-worker typecheck` and `pnpm --filter scan-worker test` pass with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 88 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


This is Part 4 of 5. Say "continue" to receive Part 5 (L11 workers, L12 real-time wiring, L13 DevOps, L14 integration & hardening).
