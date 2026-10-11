### TASK 89 — Broadcast worker: advisory delivery (dashboards, e-mail, SMS), progress counters, retraction

**Layer:** L11

**Prerequisites:** Task 38 (advisories), Task 82 (emergency broadcast UI + service), Task 25 (queues), Task 90's inbox table is NOT required (in-app delivery is enqueued, not written).

**Estimated files touched:** 18

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Broadcast worker: advisory delivery (dashboards, e-mail, SMS), progress counters, retraction**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

> **Planner note (Part 5 is planner-authored):** the advisory service already
> writes the `advisory_broadcasts` row (`status: 'queued'`, audience counters
> from the estimate, `queue_job_id = 'broadcast:<id>'`, `audit_seq`) and enqueues
> `{ broadcastId, advisoryId, kind }` on the `broadcast` queue. This task is the
> consumer side of exactly that contract. Deviations forced by what exists in
> the tree are flagged **planner decision**.

---

**Goal:**
Implement `apps/broadcast-worker`: a BullMQ consumer for the `broadcast` queue that delivers an emergency advisory broadcast to the matched client audience — in-app dashboard notifications (enqueued onto the `notify` queue), e-mail (sent directly), SMS (sent directly, `initial` only) — keeps the row's progress counters honest, publishes machine-readable progress for the Task 94 SSE relay, handles `retraction`, and never double-delivers.

**Deliverables:**

*Shared code (the worker may not import from `apps/api`):*
- `packages/lib/src/advisory-matching.ts` — MOVE the pure audience-matching code from `apps/api/src/routes/v1/advisories/matching.ts` (ClientAsset, MatchResult, normalise, labelNamesProduct, matchesAsset, matchClients, estimateAudience) verbatim; add its tests as `packages/lib/src/advisory-matching.test.ts` (move the API's matching tests).
- MODIFY `packages/lib/package.json` — add subpath export `"./advisory-matching": "./src/advisory-matching.ts"` (do NOT re-export from the root index: the root is browser-facing).
- MODIFY `apps/api/src/routes/v1/advisories/matching.ts` — becomes a one-line re-export of `@vunvault/lib/advisory-matching` so existing API imports and tests keep working. DELETE `apps/api/src/routes/v1/advisories/matching.test.ts` (moved to lib).
- MODIFY `apps/api/package.json` — add `"@vunvault/lib": "workspace:*"`.
- `packages/contracts/src/broadcast-stream.ts` — progress-event contract shared with the Task 94 relay (shape below) + channel helper `broadcastProgressChannel(broadcastId)` returning `broadcast:progress:<broadcastId>`.
- MODIFY `packages/contracts/src/index.ts` — export it.
- `packages/contracts/src/broadcast-stream.test.ts` — schema tests (rejects unknown fields, bad counters).

*Worker app (`apps/broadcast-worker`; scaffold exists — package.json/tsconfig/eslint config only, `src/index.ts` is `export {}`):*
- DELETE `apps/broadcast-worker/src/index.ts`; add `src/main.ts` (composition root) instead.
- `apps/broadcast-worker/src/config/env.ts` — Zod-validated env (names below).
- `apps/broadcast-worker/src/ports.ts` — `BroadcastRepo`, `NotifyEnqueuer`, `EmailSender`, `SmsSender`, `ProgressBus`, `Clock`, `Logger` interfaces.
- `apps/broadcast-worker/src/adapters/sql-repo.ts` — drizzle implementation of `BroadcastRepo` (reads/writes listed below; uses `@vunvault/db`).
- `apps/broadcast-worker/src/adapters/providers.ts` — thin `EmailSender`/`SmsSender` adapters over `@vunvault/lib/providers`-style fetch clients **local to this app** (`src/adapters/email.ts`, `src/adapters/sms.ts`: copy the Resend client and the SmsRouter/Africa's Talking/Twilio clients from `apps/api/src/providers/*` with the same URLs, timeouts and error classification; the api keeps its copies — extraction to lib happens in Task 90, do not do it here).
- `apps/broadcast-worker/src/adapters/redis-bus.ts` — `ProgressBus` over ioredis `PUBLISH` (JSON `BroadcastProgressEvent`).
- `apps/broadcast-worker/src/domain/templates.ts` — e-mail/SMS/in-app copy (verbatim below).
- `apps/broadcast-worker/src/domain/delivery.ts` — `BroadcastDeliveryService` (the whole delivery algorithm below).
- `apps/broadcast-worker/src/queue/consumer.ts` — BullMQ `Worker` wrapper mirroring `apps/scan-worker/src/queue/consumer.ts` conventions (payload parse or permanent fail; graceful close).
- Tests: `src/domain/delivery.test.ts`, `src/domain/templates.test.ts`, `src/queue/consumer.test.ts` — fakes only, no live I/O.
- MODIFY `apps/broadcast-worker/package.json` — scripts `dev`/`build`/`start` like scan-worker; dependencies below.
- `apps/broadcast-worker/tsconfig.build.json` — mirror scan-worker's.
- MODIFY `.env.example` (repo root or apps/api's — wherever the existing one lives) — add the worker's variable NAMES only under a `# broadcast-worker` heading.

**Dependencies allowed:**
- `apps/broadcast-worker`: `bullmq`, `ioredis`, `pino`, `zod` (catalog), `postgres`, `drizzle-orm` (catalog), `@vunvault/contracts`, `@vunvault/db`, `@vunvault/lib` (all workspace). Dev: `@types/node`, `@vunvault/config`, `eslint`, `tsx`, `typescript`, `vitest` (match scan-worker's versions).
- Nothing else. No new dependencies anywhere else.

---

**Environment (Zod-validated, fail fast):** `NODE_ENV`, `LOG_LEVEL`, `REDIS_URL` (url), `DATABASE_URL` (url — Supavisor pooler is fine; the worker runs no DDL), `RESEND_API_KEY` (min 1), `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (default `''`), `BROADCAST_CONCURRENCY` (int 1..16, default 2), `PROGRESS_THROTTLE_MS` (int ≥ 250, default 2000), `COUNTER_FLUSH_EVERY` (int ≥ 1, default 25), `REDIS_KEY_PREFIX` (default `vv`). pino redact: `*.RESEND_API_KEY`, `*.AFRICASTALKING_API_KEY`, `*.TWILIO_AUTH_TOKEN`, `*.REDIS_URL`, `*.DATABASE_URL`, anything named `secret`, `token`, `password`.

**Data shapes (TypeScript, in `packages/contracts/src/broadcast-stream.ts`):**
```ts
export const BroadcastProgressEvent = z.object({
  type: z.literal('progress'),
  broadcastId: z.string().uuid(),
  advisoryId: z.string().uuid(),
  kind: z.enum(['initial', 'rebroadcast', 'retraction']),
  status: z.enum(['queued', 'sending', 'sent', 'failed']), // BROADCAST_STATUSES
  audience: z.object({
    dashboards: z.number().int().nonnegative(),
    email: z.number().int().nonnegative(),
    sms: z.number().int().nonnegative(),
  }),
  sent: z.object({
    dashboards: z.number().int().nonnegative(),
    email: z.number().int().nonnegative(),
    sms: z.number().int().nonnegative(),
  }),
  failed: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
}).strict();
```

**Repo port (exactly these operations):**
```ts
interface BroadcastRepo {
  getBroadcast(broadcastId: string): Promise<BroadcastRow | null>;
  // BroadcastRow: { id, advisoryId, kind, status, triggeredBy, audienceDashboards,
  //   emailContacts, smsContacts, sentDashboards, sentEmail, sentSms, failed, queueJobId }
  getAdvisory(advisoryId: string): Promise<AdvisoryDeliveryView | null>;
  // AdvisoryDeliveryView: { id, cveId, title, summary, remediation, references,
  //   severity, cvss, status, scope: AdvisoryScopeEntry[], disclosureDate }
  listClientAssets(): Promise<ClientAsset[]>;              // client_assets
  listOrgContacts(orgIds: string[]): Promise<OrgContact[]>; // profiles: active, role client,
  //   not deleted, orgId ∈ orgIds → { userId, orgId, email, fullName, phone }
  markSending(broadcastId: string, at: Date): Promise<void>;       // status 'sending', started_at
  incrementCounters(broadcastId: string, delta: CounterDelta): Promise<void>;
  //   CounterDelta: { sentDashboards?, sentEmail?, sentSms?, failed? } — single UPDATE with `col = col + n`
  finish(broadcastId: string, status: 'sent' | 'failed', at: Date): Promise<void>;
  retractAdvisory(advisoryId: string, at: Date): Promise<void>;    // status → 'retracted' when 'published'
}
```

**Delivery algorithm (`BroadcastDeliveryService.deliver(job)`):**
1. Load the broadcast row. Missing → log `warn`, complete (no re-delivery loop). `status` already `sent`/`failed` → log `info` "already delivered", complete (**idempotency**: BullMQ may redeliver).
2. Load the advisory. Missing → log `error` and throw so the job retries per queue policy; do NOT mark the row failed (a missing advisory row is a data bug, not a contact-level failure — the job rests in failed history after its attempts and the row stays visible to Task 92's outbox sweep).
3. `markSending(broadcastId, now)`, publish progress.
4. Audience: `matchClients(advisory.scope, await listClientAssets())` → `orgIds`. `listOrgContacts(orgIds)` → contacts. **Planner decision:** dedupe contacts by `userId` (a user in two matched orgs is contacted once) and sort by `(orgId, email)` so progress is deterministic.
5. `kind === 'retraction'`: `retractAdvisory(advisoryId, now)`; deliver e-mail + in-app only (NO SMS); copy from the retraction block below; then step 8.
6. In-app (all kinds): for every contact enqueue `NotifyJobPayload` `{ channel: 'in_app', userId, event: 'advisory_broadcast', title, body }` on the `notify` queue (job name = `in_app`, jobId = `broadcast:<broadcastId>:in_app:<userId>` so a retry cannot double-enqueue). After an org's users are all enqueued without error → `sentDashboards += 1`; any enqueue error → `failed += 1` (per user) and the org is not counted.
7. E-mail (all kinds) to every contact; SMS (kind `initial` only — **planner decision:** a rebroadcast must not re-page phones; a retraction is e-mail/in-app) to contacts with a non-null E.164 phone. Send with bounded concurrency 5 (simple promise pool, no new dependency). Per success `sentEmail`/`sentSms += 1`; per failure `failed += 1` and continue (never abort the batch). Flush `incrementCounters` every `COUNTER_FLUSH_EVERY` deliveries and at the end; publish progress at most every `PROGRESS_THROTTLE_MS` (always publish the final state).
8. Finish: `sentTotal = sentDashboards + sentEmail + sentSms`. Status = `failed` when `sentTotal === 0 && failed > 0`, else `sent` (an empty audience finishes `sent` with zero counters). `finish(broadcastId, status, now)`, final progress publish, return a summary the consumer logs at `info`.

**Copy (verbatim; planner-authored — no prototype exists):**
- In-app: title `Emergency advisory: <cveId>` (retraction: `Advisory retracted: <cveId>`); body = first 160 chars of `summary` + `…` when truncated.
- E-mail subject: `[VUNVAULT] <cveId> — <title>`; rebroadcast prefix `Reminder: `; retraction subject `[VUNVAULT] RETRACTED: <cveId> — <title>`.
- E-mail text body (plain text, `\n` separated): `<title>` / blank / `Severity: <severity>< cvss ? ` · CVSS <cvss.toFixed(1)>` : ''>` / `Disclosed: <disclosureDate ?? 'unknown'>` / blank / `<summary>` / blank / `Remediation:` / `<remediation>` / blank / `References:` then one line per reference (omit the block when empty) / blank / `—` / `VUNVAULT Emergency Advisory · <cveId> · Automated notification, do not reply.` — retraction body instead: `This advisory has been retracted and should no longer be acted on.` / blank / `Original title: <title>` / blank / same footer.
- SMS body (≤ 480 chars, truncate summary to fit): `VUNVAULT: <cveId> <title>. Severity <severity>. <summary truncated>`.

**Consumer rules:** parse `BroadcastJobPayload`; a payload that does not parse fails PERMANENTLY (moveToFailed, no retry) and is logged at `error` with the jobId only (never the raw body). Lock duration 60 s; `BROADCAST_CONCURRENCY`. Graceful shutdown on SIGTERM/SIGINT: stop taking jobs, wait ≤ 20 s for in-flight deliveries, close queue/worker/redis/pg, exit 0 (exit 1 on shutdown error).

**Tests (assert):** happy path initial broadcast — counters exact (dashboards = matched orgs with all users enqueued, email = deduped contacts, sms = contacts with phones), statuses `queued → sending → sent`, progress events monotonic and throttled, final publish always happens; rebroadcast sends NO SMS; retraction flips the advisory to `retracted`, sends e-mail + in-app only; already-`sent` row is skipped with zero provider calls (idempotency); provider failure on one contact increments `failed` and does not stop the batch; all-failed run finishes `failed`; empty audience finishes `sent` with zero counters; enqueue jobId dedupe (second attempt for same user does not re-enqueue); consumer permanently fails a malformed payload; templates match the copy above exactly, SMS ≤ 480; contracts tests for `BroadcastProgressEvent`.

**Out of scope:** the SSE relay and UI (Task 94); writing to `notifications` inbox (Task 90 consumes what this enqueues); audit entries (the API already wrote the SEV entry — `audit_seq`); anything in `apps/scan-worker`.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/contracts typecheck|lint|test` pass.
☐ `pnpm --filter @vunvault/lib typecheck|lint|test` pass.
☐ `pnpm --filter api typecheck|lint|test` pass (re-export keeps them green).
☐ `pnpm --filter broadcast-worker typecheck|lint|test` pass with zero errors.
☐ Output: `Task 89 complete. Files created: <list>. Files modified: <list>. Dependencies: <list or "none">`.
