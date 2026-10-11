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

