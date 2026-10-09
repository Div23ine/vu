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
