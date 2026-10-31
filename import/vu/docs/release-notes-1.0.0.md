# VUNVAULT 1.0.0 — release roll-up (Task 110)

The first complete cut of the platform: 110 catalogue tasks across fifteen
layers, from an empty monorepo root to a deployable, self-auditing estate.

## What shipped, by layer

- **L0 Foundation** — pnpm + Turborepo monorepo, shared TS/ESLint/Prettier
  configs, nine workspaces, the test harness, git hooks and the first two
  stack-guard scripts.
- **L1 Design system & shared lib** — tokens + Tailwind v4 theme, the UI
  primitive set (buttons → DataTable), `cn`/date/money/ID formatters, the API
  client with the cookie+CSRF security model, query keys.
- **L2 Data & contracts** — Drizzle schema (identity, orgs, WebAuthn, consent,
  scans, findings, the review gate, the double-entry billing ledger, FX,
  content, the append-only audit chain), the Zod contract layer with fixtures,
  the route documentation the conformance suite reads.
- **L3/L4 Backend** — Fastify 5 bootstrap with layered plugins (secrets, db,
  redis, queues, providers, security headers, CORS, cookies, raw-body, rate
  limits, CSRF, auth guards, audit), and every domain route group: auth
  (password + WebAuthn/TOTP/email-OTP MFA, OAuth PKCE), accounts, users &
  invitations, billing & checkout & webhooks (Stripe + Paystack), scans & the
  release lock, advisories & emergency broadcast, content/studio/badges,
  dashboard, nodes, contact, the audit read API with its SSE tail, internal
  scan callbacks under HMAC.
- **L5–L9 Frontend** — Next.js 15 app (marketing, auth, client portal, admin
  Command Center): every surface from the prototypes, the MSW mock layer, the
  review-gate and Zero-Day desks, the audit console, payments admin.
- **L10/L11 Workers** — the scan controller (k3s pods, unprivileged, target
  guard, output channel) and the four BullMQ workers: broadcast delivery with
  live progress, notify + PDF, and the twelve maintenance sweeps (purges,
  expiries, dormancy, outbox re-enqueue, chain verification, media validation,
  daily WORM snapshots).
- **L12 Real-time** — audit SSE ticker with pause/resume, broadcast progress
  relay + desk, the scan WebSocket relay (four-verb whitelist) and the staff
  live terminal.
- **L13 DevOps** — distroless multi-stage images + bake + Dockerfile policy,
  two Terraform stacks (OCI: OKE, the isolated scan VCN with its generated
  103-CIDR egress allow-list, Vault, OCIR, IAM, bastions; Cloudflare: Pages,
  DNS, strict TLS + AOP, WAF, rate limits, R2 with the 7-year audit lock,
  Logpush, Turnstile), five Helm charts over one hardening library, the vv-edge
  Worker + API origin lock, CI/CD/security/rollback workflows, the env &
  secrets runbook, and the deployment conformance suite.
- **L14 Integration & hardening** — the two cross-process integration suites
  (publish→broadcast→notify; scan queue→controller→relay→terminal), the
  Playwright smoke suite, k6 load/abuse/header-audit profiles, the Semgrep
  policy, security.txt, the closing ADRs and this roll-up.

## The invariants (ADR index: docs/adr/)

1. The audit log is an append-only, hash-chained, HMAC-signed ledger with
   daily WORM snapshots — nobody can rewrite history, including us (0001).
2. A scan report does not exist for its client until the review gate AND the
   payment lock release it; unreleased jobs 404 (0002/0003).
3. Scan pods are unprivileged, exec-less, default-denied and egress-limited to
   the generated public allow-list — the scan tier is the assumed breach
   (0003/0006).
4. The scan terminal's browser→controller channel is exactly four verbs,
   strict-parsed, rate-budgeted and audited before it is published (0005).
5. Background work is at-least-once and idempotent by construction; telemetry
   never blocks delivery (0004).
6. Cloudflare is the only front door; the API refuses traffic that did not
   come through the edge's secret header (0006).

## Known gaps (deliberate, documented)

- No notification-bell UI, Academy course pages, `/team/*`, the floating AI
  Security Agent button, or a customer-side scan agent: none had a prototype,
  none was promised (catalogue Part 5, "Not planned").
- Worker secrets arrive via ExternalSecrets rather than direct Vault reads —
  a recorded trade-off with a migration path (ADR 0004 §7).
- `pause`/`resume` on the scan terminal render disabled: the controller cannot
  pause an unprivileged pod without `exec`, and `exec` is banned (ADR 0003).
- The E2E suite runs against the MSW mock layer; the full local-stack E2E with
  real Postgres/Redis is a go-live-adjacent investment (docs/ci.md).

## Numbers

2,637 package tests · 74 policy-script tests · 11 browser smokes · 9 static
verify gates · 6 ADRs · 6 container images · 5 Helm charts · 2 Terraform
stacks · 1 generated 103-CIDR firewall allow-list.

Everything above is enforced somewhere: see `docs/conformance-matrix.md`.
