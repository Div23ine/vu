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

