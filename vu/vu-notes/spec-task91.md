### TASK 91 — Maintenance worker A: scheduler, metrics rollup, node heartbeat sweep, threat-level snapshot, scheduled publish

**Layer:** L11

**Prerequisites:** Task 25 (queues), Task 20b (intel tables), Task 36/40c (content), Task 44 (nodes).

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Maintenance worker A**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

> **Planner note (Part 5 is planner-authored):** the reserved scope adds
> *scheduled publish* to worker A, but `MAINTENANCE_TASKS` (Task 25) does not
> contain it. **Planner decision:** extend the contract enum with the four new
> task names used by Tasks 91/92 (`scheduled_publish`, `stale_signups`,
> `outbox_reenqueue`, `media_scan`) — nothing in the tree produces maintenance
> jobs yet, so no producer breaks. The worker itself is the producer: it
> registers BullMQ **repeatable job schedulers** at boot (idempotent by
> scheduler key) so a fresh cluster starts maintaining itself with no cron
> infrastructure.

---

**Goal:**
Implement `apps/maintenance-worker` (scaffold exists): the `maintenance` queue consumer, the repeatable-job scheduler, and the first four tasks — `metrics_rollup`, `node_health`, `threat_level`, `scheduled_publish`. Task 92 adds the rest into the same app.

**Deliverables:**
- MODIFY `packages/contracts/src/queues.ts` — `MAINTENANCE_TASKS` gains `'scheduled_publish'`, `'stale_signups'`, `'outbox_reenqueue'`, `'media_scan'` (order: appended after `'audit_snapshot'`).
- `packages/contracts/src/queues.test.ts` (new; or extend the existing contracts test that covers queues) — asserts the 12 task names and that `MaintenanceJobPayload` accepts each and rejects `'rm_rf'`.
- DELETE `apps/maintenance-worker/src/index.ts`; add `src/main.ts` instead.
- `apps/maintenance-worker/src/config/env.ts` — Zod env: `NODE_ENV`, `LOG_LEVEL`, `REDIS_URL`, `DATABASE_URL`, `MAINTENANCE_CONCURRENCY` (1..8, default 2), `HEARTBEAT_STALE_MS` (default 90_000), `HEARTBEAT_MISS_LIMIT` (int ≥ 1, default 3), `REDIS_KEY_PREFIX` (default `vv`), plus (used by Task 92, validated now) `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `AUDIT_HMAC_KEY_ID`, `AUDIT_HMAC_KEY`. pino redaction like Task 89 plus `*.AUDIT_HMAC_KEY`, `*.R2_SECRET_ACCESS_KEY`.
- `apps/maintenance-worker/src/ports.ts` — `MaintenanceRepo`, `NotifyEnqueuer`, `Clock`, `Logger` (+ Task 92's `ObjectStorage`, `AuditChainVerifier` seams declared here too).
- `apps/maintenance-worker/src/adapters/sql-repo.ts` — drizzle implementation of the Task 91 operations.
- `apps/maintenance-worker/src/domain/metrics-rollup.ts`, `node-health.ts`, `threat-level.ts`, `scheduled-publish.ts`.
- `apps/maintenance-worker/src/queue/consumer.ts` — parses `MaintenanceJobPayload`, dispatches `task → handler` from a registry map (unknown task → permanent fail, log `error`).
- `apps/maintenance-worker/src/queue/scheduler.ts` — `registerSchedulers(queue, clock)`: upserts one repeatable BullMQ job per task with a stable scheduler id (`maintenance:<task>`) and the pattern table below.
- `apps/maintenance-worker/src/main.ts` — composition + graceful shutdown (≤ 20 s).
- Tests: `src/domain/metrics-rollup.test.ts`, `node-health.test.ts`, `threat-level.test.ts`, `scheduled-publish.test.ts`, `src/queue/consumer.test.ts`, `src/queue/scheduler.test.ts` — fakes only.
- MODIFY `apps/maintenance-worker/package.json` — deps: `bullmq`, `ioredis`, `pino`, `zod`, `postgres`, `drizzle-orm`, `@vunvault/contracts`, `@vunvault/db`; dev like scan-worker. Scripts `dev`/`build`/`start`.
- `apps/maintenance-worker/tsconfig.build.json`.
- MODIFY `.env.example` — `# maintenance-worker` heading, names only.

**Dependencies allowed:** as listed for the app above; nothing else.

---

**Scheduler patterns (planner decision; BullMQ `pattern` strings, server local time is UTC):**

| Task | Pattern |
|---|---|
| `metrics_rollup` | `5 * * * *` (hourly at :05) |
| `node_health` | `*/5 * * * *` |
| `threat_level` | `*/15 * * * *` |
| `scheduled_publish` | `*/5 * * * *` |

(Task 92 registers the remaining eight.) Registration is idempotent: `upsertJobScheduler` with the stable id; re-running boot must not duplicate jobs. The scheduler test asserts one job per task with the exact pattern.

**Task behaviour (all handlers: `(repo, deps) → Promise<Summary>` where `Summary` is `{ task, affected: number, detail?: Record<string, number|string> }`, logged at `info` on success):**

1. **`metrics_rollup`** — window = the last COMPLETE hour `[H-1, H)` from `clock.now()`, truncated to the hour. Aggregate `endpoint_stats` rows with `window_start` in the window: `apiRequests = Σ requests`; `avgResponseMs = round(Σ(avg_latency_ms × requests) / Σ requests)` (0 when no requests); `p95ResponseMs = max(avg_latency_ms)` across endpoints — **planner decision:** per-request percentiles are not stored; the max endpoint-average is the honest conservative approximation, and the file says so in a comment. `siteSessions` and `threatsBlocked` are set to 0 with a `TODO(backend-contract)` comment (Cloudflare Logpush analytics is L13; inventing numbers is forbidden — Task 76). UPSERT `platform_metrics_hourly` on `hour` (re-runs are idempotent). `affected = 1`.
2. **`node_health`** — stale sweep: nodes with `last_heartbeat_at < now − HEARTBEAT_STALE_MS` (or null with `created_at` older than the same window) and `status != 'offline'` → `missed_heartbeats + 1`; when the new count reaches `HEARTBEAT_MISS_LIMIT` → `status = 'offline'`. Recovery: nodes with `status = 'offline'` and `last_heartbeat_at >= now − HEARTBEAT_STALE_MS` → `status = 'operational'`, `missed_heartbeats = 0`. `affected` = rows changed, `detail = { degraded, offline, recovered }`.
3. **`threat_level`** — count from `advisories` (status `published` only): `criticalCves = severity 'critical'`; `unpatchedCritical = severity 'critical' AND patch_status 'unpatched'`; `weaponizedInWild = weaponized = true`; `activeZeroDays = patch_status 'unpatched' AND (weaponized OR public_poc)`; `threatsBlockedYtd = 0` with `TODO(backend-contract)`. Level (**planner decision**, deterministic, documented in the file): start at 1; `+2` if `weaponizedInWild > 0`; `+1` if `unpatchedCritical > 0`; `+1` if `criticalCves >= 10`; clamp to [1, 5]. Insert one `threat_level_snapshots` row per run. `affected = 1`, `detail = { level }`.
4. **`scheduled_publish`** — `content_items` with `status = 'scheduled'` AND `scheduled_for <= now` → `status = 'published'`, `published_at = now` (single UPDATE … RETURNING id, author id, title). For each published item enqueue ONE notify e-mail to the author's address: template `content_publish`, vars `{ title, slug }` (author e-mail resolved via repo). `affected = rows published`.

**Consumer rules:** malformed payload → permanent fail (log jobId only); a handler throw → job retries per queue policy (3 attempts) and the error is logged with the task name; no handler touches the network except through ports.

**Tests (assert):** rollup math incl. weighted average, empty window, idempotent re-run, sessions/blocked are 0; node health degradation at exactly the miss limit, recovery, untouched fresh nodes; threat-level table — each rule flips the level, clamping at 5, snapshots insert; scheduled publish flips statuses, sets `published_at`, enqueues one e-mail per item with the right template/vars, ignores future `scheduled_for`; consumer dispatches by task, permanently fails unknown tasks and malformed payloads; scheduler registers exactly the four patterns with stable ids, idempotently.

**Out of scope:** Task 92's eight handlers (their ports/env exist but handlers land next task); any API/UI change; backfilling historical metrics.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/contracts typecheck|lint|test` pass.
☐ `pnpm --filter maintenance-worker typecheck|lint|test` pass with zero errors.
☐ `pnpm --filter api typecheck|lint|test` still pass (enum extension breaks nothing).
☐ Output: `Task 91 complete. Files created: <list>. Files modified: <list>. Dependencies: <list>`.
