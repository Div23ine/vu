# 0003 — Scan isolation: one unprivileged pod per scan, no credentials in the cluster

- Status: accepted
- Date: 2026-10-09
- Deciders: platform team
- Related: ADR-0001 (audit chain), ADR-0002 (API conventions), Tasks 40g, 84–88

## Context

VUNVAULT scans hosts chosen by people we do not know. A public form accepts a
target, and a paying client can point a scan at any address they claim to own.
That makes the scanning tier the one part of the platform that routinely executes
tooling against hostile infrastructure and ingests hostile output.

Three properties make this dangerous in a way the rest of the platform is not:

1. **The output is attacker-controlled.** A banner, an HTTP header or a TLS
   certificate is text written by whoever runs the target. It reaches an
   operator's browser terminal, a stored log and a client-facing report.
2. **The tools are powerful.** nmap, nuclei, httpx and testssl.sh parse complex
   network input and have historically had memory-safety bugs of their own.
3. **The natural place to run them is next to the data.** A controller that talks
   to the database directly is the obvious design — and the worst one, because
   compromising it then compromises everything.

## Decision

Run every scan in **one unprivileged, ephemeral pod**, and treat the tier that
does so as already compromised.

```
Browser → API → BullMQ `scan` → scan controller (k3s) → scan pod → target
                                     ↓ HMAC-signed callbacks
                                    API → Postgres
```

The controller holds **no database credentials**. Its only secrets are the Redis
URL, the HMAC key that signs its callbacks, and an in-cluster service account
limited to one namespace. State reaches the platform exclusively through the
signed internal routes (`/api/v1/internal/scans/*`, Task 40g).

Controls, and what each one defeats:

| Control                                                                                                                                   | Threat it addresses                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `automountServiceAccountToken: false`, runner SA has no bindings                                                                          | A compromised pod has no identity to steal and nothing to reach with it                                           |
| Per-job NetworkPolicy allowing egress only to the pinned target IPs; namespace default-deny both directions                               | SSRF, data exfiltration, lateral movement to the API/Redis/DB                                                     |
| `dnsPolicy: None` with a dead nameserver; target names pinned via `hostAliases`                                                           | DNS rebinding — a record that changes between authorisation and execution cannot redirect a scan inward           |
| Forbidden-range classification (`target-guard.ts`) incl. `169.254.0.0/16`                                                                 | Cloud metadata theft; scanning private ranges the cluster cannot legitimately reach                               |
| Non-root `65532`, `drop ALL`, `readOnlyRootFilesystem`, no `hostPID/IPC/Network`, RuntimeDefault seccomp, no setuid binaries in the image | Container escape, persistence on the node                                                                         |
| Single 1 GiB tmpfs at `/tmp`; no PVC, hostPath, secret, configMap or projected volume                                                     | Exfiltration to durable storage; credential leakage into the pod                                                  |
| `backoffLimit: 0`, `activeDeadlineSeconds: 900`, ResourceQuota, LimitRange, dedicated `vv/pool=scan` nodes with a taint                   | Resource exhaustion; a scan landing on a node that also runs the API                                              |
| ANSI/OSC stripping, control-character removal, 8 KiB line cap, 5 MB per-scan publication cap, credential redaction                        | Terminal escape injection (incl. OSC 52 clipboard writes), memory exhaustion, secret leakage into a client report |
| `@@VV@@` protocol lines never rendered; malformed ones dropped; exit code read from pod state, never stdout                               | A target forging controller output or declaring its own scan successful                                           |
| No `pods/exec` in the controller Role                                                                                                     | Pivoting into a pod running attacker-chosen tooling — this is _why_ pause/resume are no-ops                       |
| HMAC signature over `timestamp.method.path.sha256(body)`, nonce-guarded, optionally IP-restricted                                         | A compromised pod impersonating the controller to the API                                                         |

**Deliberate trade-off: pause and resume do not work.** Suspending a container
needs `pods/exec`. Granting it would let anything that compromises the controller
also inject commands into a pod that is already running hostile-adjacent tooling,
so the capability is refused and the UI says so
(`[~] Pause is not supported in this environment.`) rather than pretending.

**Deliberate trade-off: internal-network scanning is not possible in v1.** The
cluster is cloud-hosted and cannot reach a customer's private network. An
`internal`/`network` scan type works only against public addresses. Doing this
properly needs a customer-side agent, which is a separate project.

## Consequences

**Gains.** A fully compromised scan pod yields: no credentials, no cluster
identity, no route to anything but the target it was already pointed at, a
read-only filesystem with 1 GiB of tmpfs, and a 900-second lifetime. The blast
radius is the target itself — which the customer asked us to scan.

**Costs.** One pod per scan is more expensive than a long-lived worker pool, and
cold-start latency (image pull, pod scheduling) is visible in the queue. The
HMAC callback layer is more code than a database connection would be, and every
controller-to-API interaction needs a signed request. The RBAC and manifest
constraints must be enforced by tests, not by memory — hence
`src/conformance/isolation.test.ts`, which fails the build if any control
regresses.

**What would change this decision.** A customer-side agent (for internal
scanning), or a requirement for interactive scan control (which would need
`pods/exec` and a fundamentally different trust model).

## Enforcement

The model is asserted, not documented-and-hoped:

- `src/k8s/pod-manifest.test.ts` — every security-context field, the volume
  allowlist, the env allowlist, `dnsPolicy: None`, and the RBAC verb list parsed
  from `k8s/controller-rbac.yaml` (no wildcards, no `pods/exec`, no secrets).
- `src/k8s/network-policy.test.ts` — the egress allowlist contains only the
  pinned target blocks; no DNS, cluster CIDR or metadata address.
- `src/domain/target-guard.test.ts` — every forbidden range, including
  `169.254.169.254`, and a host with one private A record among public ones.
- `src/output/*.test.ts` — escapes, control characters, byte caps, redaction and
  the forged-protocol cases.
- `src/conformance/isolation.test.ts` — the eleven guarantees above as a single
  table, including a static scan proving the controller imports no database
  module, and a hostile-log fixture run end to end.
