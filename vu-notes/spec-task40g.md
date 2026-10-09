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

