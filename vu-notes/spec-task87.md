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

