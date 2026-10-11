# Conformance matrix (Task 110)

Every gate the platform ships with, what it protects, and where it runs.
The rule of the house: **a convention that lives in a document decays; a
convention that lives in a test does not.** If a row here has no enforcement
column, it is a wish, not a control.

## 1. Static policy gates — `pnpm verify` (local + CI `verify` job)

| #   | Script                              | Protects                                                                                                                                                                                                                                                              | Tests                              |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | `verify-no-html.mjs`                | no hand-written HTML; every surface is Next.js or Fastify JSON                                                                                                                                                                                                        | — (self-evident walk)              |
| 2   | `verify-forbidden-stack.mjs`        | no Express/Prisma/Joi dependency, no foreign CI config in the repo                                                                                                                                                                                                    | —                                  |
| 3   | `verify-dockerfiles.mjs`            | multi-stage, digest/ARG bases, numeric non-root USER, no `latest`, no remote ADD, no pipe-to-shell, no secret-named ARG/ENV, no privilege bits, distroless finals, runner checksums                                                                                   | `verify-dockerfiles.test.mjs` (13) |
| 4   | `verify-terraform.mjs`              | no committed tfvars/state, pinned providers, no hard-coded OCIDs, Vault `ignore_changes`, the single LB-only wildcard ingress, scan-VCN isolation (no DRG/peering), generated-only egress, CF posture (strict TLS, HSTS, AOP, 2555-day audit lock), no token literals | `verify-terraform.test.mjs` (15)   |
| 5   | `gen-scan-egress.mjs` (verify mode) | the 103-CIDR public allow-list is the exact BigInt complement of the forbidden ranges; committed file matches the generator                                                                                                                                           | `gen-scan-egress.test.mjs` (7)     |
| 6   | `verify-workflows.mjs`              | top-level `permissions`, per-job timeouts, no `pull_request_target`, no event-interpolation injection, no echoed secrets, no pipe-to-shell, tag/SHA-pinned actions, `persist-credentials: false`, deploy jobs environment-gated, actions allow-listed in `docs/ci.md` | `verify-workflows.test.mjs` (12)   |
| 7   | `verify-migrations.mjs`             | migrations are additive-only; destructive statements need a same-line ticket marker                                                                                                                                                                                   | `verify-migrations.test.mjs` (6)   |
| 8   | `verify-env-docs.mjs`               | every env var in every Zod schema is documented + exemplified; no stale `.env.example` entries                                                                                                                                                                        | `verify-env-docs.test.mjs` (8)     |
| 9   | `verify-deploy.mjs`                 | chart hardening contract (65532, read-only rootfs, drop ALL, seccomp, no-escalation, requests+limits), pinned digests with a fail-guard, no secret values in chart values, bake↔chart↔registry triangle, deploy job ordering, atomic-helm-only                        | `verify-deploy.test.mjs` (13)      |

`node --test scripts/*.test.mjs`: **74 tests**.

## 2. Package test suites (Vitest, CI `test` job)

| Package               | Tests     | Highlights                                                                                                                  |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `api`                 | 953       | route-table/audit/CSRF conformance, the audit chain + SSE relay, the scan-stream relay (38), origin lock, rate limits       |
| `web`                 | 691       | every surface's verbatim copy + behaviour, Task 93 SSE ticker, Task 94 live progress, Task 96 terminal dialog (XSS-as-text) |
| `scan-worker`         | 309       | target guard, pod isolation manifests, output channel, **integration suite B** (controller→relay→terminal loop, 6)          |
| `@vunvault/contracts` | 172       | every wire schema incl. scan-stream + broadcast-stream unions, fixtures' chain integrity                                    |
| `@vunvault/db`        | 143       | schema shape, enum values, ledger constraints                                                                               |
| `@vunvault/ui`        | 101       | primitives, tokens, overlays                                                                                                |
| `@vunvault/lib`       | 77        | formatters, api client, audit-chain crypto/verify, advisory matching                                                        |
| `maintenance-worker`  | 75        | all twelve sweeps + scheduler singleton                                                                                     |
| `broadcast-worker`    | 49        | delivery idempotency, progress throttle, **integration suite A** (publish→broadcast→notify, 7)                              |
| `notify-worker`       | 48        | channels, receipts, templates, PDFs                                                                                         |
| `@vunvault/edge`      | 19        | allow-list, header hygiene, pass-through streams, metrics shape                                                             |
| **Total**             | **2,637** |                                                                                                                             |

## 3. Runtime gates

| Gate                                                                                          | When                               | Protects                                                                                                     |
| --------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `e2e` Playwright suite (11 tests)                                                             | CI, every PR/push                  | the real browser path: RSC + hydration + middleware + MSW fixtures; auth, portal, admin, Task 93/96 surfaces |
| `security.yml` (gitleaks, CodeQL, dependency-review, pnpm audit, Trivy fs+config, Semgrep)    | CI + weekly                        | secrets, code, dependencies, misconfig, policy rules                                                         |
| `iac.yml` (hadolint, helm lint/template + kubeconform, terraform fmt/validate/tflint/checkov) | CI on infra changes                | the artefacts `verify` reads, with real toolchains                                                           |
| `release.yml` (Trivy per image, cosign)                                                       | every deploy                       | image supply chain                                                                                           |
| `smoke.mjs` (7 property probes)                                                               | after every deploy, gates rollback | the deployed estate behaves as designed                                                                      |
| k6 profiles (`perf/`)                                                                         | staging, on demand                 | latency SLOs, the header audit against the live edge, rate-limit engagement under abuse                      |

## 4. Human gates (docs/go-live-checklist.md)

The rows no script can tick: legal pages, the external penetration test,
on-call staffing, the real-money round trip, Paystack's written USD M-Pesa
confirmation, the security.txt signature, the incident contacts.
