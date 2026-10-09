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

