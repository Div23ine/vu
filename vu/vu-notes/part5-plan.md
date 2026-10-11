# VUNVAULT — Part 5 plan (planner-authored)

**Status of this document.** Catalogue Part 5 was never delivered: Part 4 ends with
"Say *continue* to receive Part 5" and the repository contains only Parts 1–4 plus
specs up to Task 88. The reserved-numbering tables in Parts 3 and 4 reserve
Tasks 89–110 for Layers L11–L14. The specs in this folder named
`spec-task89.md` … `spec-task110.md` are therefore **planner-authored**: their
scope is derived strictly from (a) the reserved tables, (b) contracts, schemas and
route behaviour that already exist in the tree, and (c) forward references inside
Tasks 39/40g/82/88 (audit SSE, HMAC callbacks, emergency broadcast, Redis stream
contract). Where a spec has to invent a detail the catalogues do not pin down, it
says **planner decision** and lists the choice explicitly. There is no prototype
for any L11/L13 task; Task 96 (scan terminal UI) reuses the `.vv-scan-screen`
prototype CSS that already exists in the catalogue for the marketing scan demo.

**There is no Task 88b.** Task 88 is complete and no addendum is referenced
anywhere in Parts 1–4; work resumes at Task 89.

## Numbering (this plan)

| Task | Layer | Title | Spec |
|---|---|---|---|
| 89 | L11 | Broadcast worker: advisory delivery (dashboards, e-mail, SMS), progress counters, retraction | spec-task89.md |
| 90 | L11 | Notify + PDF worker: notify-queue consumer (e-mail/SMS/in-app), receipts, invoice & report PDFs | spec-task90.md |
| 91 | L11 | Maintenance worker A: scheduler, metrics rollup, node heartbeat sweep, threat-level snapshot, scheduled publish | spec-task91.md |
| 92 | L11 | Maintenance worker B: purges, expiries, dormant accounts, stale signups, outbox re-enqueue, media scan, chain verify, audit snapshot | spec-task92.md |
| 93 | L12 | Audit SSE client + live ticker (admin Audit Logs) | spec-task93.md |
| 94 | L12 | Broadcast delivery progress: API SSE relay + Zero-Day desk progress UI | spec-task94.md |
| 95 | L12 | Scan WebSocket relay in the API (Redis → WS; abort/pause/resume/kill only) | spec-task95.md |
| 96 | L12 | Scan terminal UI: client portal scan detail + admin scan-queue drawer | spec-task96.md |
| 97 | L13 | Dockerfiles: api, workers, controller (distroless/slim, non-root) | spec-task97.md |
| 98 | L13 | Terraform I: OCI (OKE, k3s scan nodes, Vault, OCIR) | spec-task98.md |
| 99 | L13 | Terraform II: Cloudflare (Pages, Workers, R2, Logpush) | spec-task99.md |
| 100 | L13 | Helm charts: api, scan-worker, broadcast-worker, notify-worker, maintenance-worker | spec-task100.md |
| 101 | L13 | GitHub Actions: CI (typecheck/lint/test/verify) | spec-task101.md |
| 102 | L13 | GitHub Actions: CD (images, Helm deploy) + security scanning | spec-task102.md |
| 103 | L13 | Environment & secrets runbook: .env.example completion, Vault map, operator steps | spec-task103.md |
| 104 | L13 | Deployment conformance suite (text-level checks over Dockerfiles/charts/workflows) | spec-task104.md |
| 105 | L14 | Integration suite A: publish → broadcast → notify end-to-end with fakes | spec-task105.md |
| 106 | L14 | Integration suite B: scan queue → controller → relay → terminal contract tests | spec-task106.md |
| 107 | L14 | Playwright E2E: public site, auth, portal, admin smoke flows (CI-gated) | spec-task107.md |
| 108 | L14 | Load & security hardening: k6 profiles, header/rate-limit audit, dependency & secret scanning config | spec-task108.md |
| 109 | L14 | Final ADRs: workers & queues, real-time transports, deployment topology | spec-task109.md |
| 110 | L14 | Release roll-up: conformance matrix, version bump, README/operator docs, archive | spec-task110.md |

## Global rules (unchanged from Parts 1–4)

- TypeScript strict, Node 22. Forbidden: Express, Prisma, Joi, `localStorage`,
  hard-coded secrets, prototype numbers in code (Task 76).
- All worker I/O behind small ports with fakes in tests; no live Redis, Postgres,
  Kubernetes, network or filesystem in unit tests.
- Every queue payload is parsed with its `@vunvault/contracts` schema before use.
- pino logging with redaction of anything named secret/token/password/key/url.
- Graceful shutdown on SIGTERM/SIGINT in every worker.
- Definition of done per task: typecheck + lint + tests green, then the report
  line `Task NN complete. Files created/modified/dependencies`.
