# UAMP HQ production integration — execution plan

**Status:** implementation started on `feature/uamp-production-integration`  
**Frontend:** approved static prototype  
**Production deployment:** not authorised / not started

## Architecture decision

UAMP HQ will use the existing VUNVAULT monorepo and platform services. The web product UI will be implemented in the existing Next.js 15 / React 19 application. The API remains Fastify 5 under the existing `/api/v1/uamp` route namespace. PostgreSQL/Drizzle, shared authentication, billing, audit, Redis and BullMQ remain shared platform capabilities. Do not create a second API, user database, authentication system, billing system or Redis deployment for UAMP.

## Repository facts verified from the current default branch

- Workspace: pnpm 12 + Turborepo; Node.js 22.
- Web: `apps/web`, Next.js 15, React 19, shared `@vunvault/contracts`, `@vunvault/ui`, `@vunvault/lib`.
- API: `apps/api`, Fastify 5, Zod type provider, shared auth and audit plugins.
- Data: `packages/db`, PostgreSQL and Drizzle.
- Async: BullMQ and shared Redis.
- UAMP API module is already registered in `apps/api/src/routes/v1/index.ts`; preserve that registration.
- UAMP worker and database/contracts packages already exist. Extend them rather than duplicating their responsibilities.
- The existing portal route group is session-guarded in `apps/web/src/app/(authed)/portal/layout.tsx`. Product-specific placement and navigation must be checked against current web conventions before adding pages.

## Confirmed integration blockers from source inspection

1. **API audit compliance:** UAMP state-changing route handlers currently do not use the required `audited(spec, handler)` wrapper. The repository ADR 0002 and `apps/api/src/conformance/route-table.test.ts` require every non-exempt mutation to be audited in the same transaction. Do not exempt UAMP writes merely to make the test pass.
2. **Fine-grained authorization:** UAMP routes currently use `app.authenticate` but no product-action permission guards. Define and map least-privilege UAMP actions to the existing shared permission model; do not create a separate role system.
3. **SSRF protection:** `target-guard.ts` checks URL syntax, selected hostnames and some IPv4 ranges, but does not resolve DNS and validate the actual destination IP before connecting. A safe fix must address DNS rebinding and connection pinning, IPv6 and IPv4-mapped IPv6, redirects, and egress restrictions. A hostname pre-check alone is not a complete fix.
4. **Worker scheduling:** `apps/uamp-worker/src/queue/consumer.ts` currently schedules with `setInterval`. ADR 0004 says the maintenance worker owns recurring schedules and BullMQ job schedulers are registered idempotently. Reconcile this explicitly before relying on production scheduling.
5. **Check semantics:** the current checker performs HTTP fetches and basic status/body/keyword/latency checks. JSON path/equality assertions are in the contract but not evaluated in the inspected checker. SSL, DNS and domain-expiry monitor types need type-specific implementations rather than generic HTTP checks.
6. **Delivery and status publication:** alert-rule persistence exists, but a complete notification outbox/delivery path and public status-page read path were not found in the inspected UAMP routes/worker. Verify shared notification capabilities before adding product-specific delivery infrastructure.
7. **AI investigations:** the contracts/schema include investigation concepts, but a production model-provider/orchestration route, tenant-scoped retrieval, usage accounting and human approval flow were not found in the inspected UAMP module. Keep AI out of the monitoring critical path.

## Delivery sequence and gates

### Phase 1 — API security and platform conformance
- Add tests first for tenant isolation, permissions, audit atomicity, cross-tenant resource references, and safe entitlement failure behavior.
- Introduce action-level permission checks using the shared permission registry and role mapping.
- Refactor UAMP writes through `audited()` with audit event types that exist in the platform catalogue; add event types only through the normal audit catalogue/migration process.
- Validate monitor targets at create/update and again at execution time.
- Implement DNS-aware destination resolution and connection pinning, or enforce equivalent network egress isolation; reject unsafe address families/ranges.
- Enforce all plan quotas server-side. Do not silently treat billing/database failures as an active Free subscription without an explicit, tested fail-closed policy.

**Gate:** UAMP API unit/integration tests and the full route-table conformance test pass.

### Phase 2 — monitoring execution
- Replace the worker-local interval scheduler with the platform-approved scheduling ownership and stable BullMQ job IDs.
- Make handlers safe for at-least-once delivery and duplicate jobs.
- Add assertion evaluation for JSON paths/equality and bounded response parsing.
- Implement dedicated SSL certificate, DNS record and domain-expiry checkers.
- Ensure location configuration is either actually dispatched to supported locations or not advertised as multi-location functionality.
- Add worker health/readiness and graceful shutdown tests.

**Gate:** worker tests cover duplicate jobs, timeout, DNS rebinding, IPv4/IPv6 private targets, redirects, assertion semantics and every supported monitor type.

### Phase 3 — incidents, notifications and public status pages
- Make incident transitions deterministic and idempotent.
- Use a durable outbox for alert delivery; reuse shared notification providers/queues where possible.
- Add per-attempt delivery receipts, retries and deduplication.
- Add public status-page endpoints with strict public projections, rate limits and slug/domain ownership validation.

**Gate:** notification failures are recoverable; public endpoints reveal no tenant-private information.

### Phase 4 — frontend integration
- Build the approved UAMP HQ design in the existing Next.js app using shared UI, session, API-client and contract conventions.
- Keep the product's own navigation/branding while reusing VUNVAULT identity and workspace context.
- Replace all prototype data and simulated actions with typed API calls.
- No credentials or secrets in browser storage; follow the platform's HttpOnly-cookie and CSRF model.

**Gate:** browser tests cover sign-in/session expiry, monitor CRUD, incidents, analytics, status pages, settings, billing visibility and responsive layouts.

### Phase 5 — AI investigations (separate from monitoring)
- Add provider abstraction for the selected self-hosted model.
- Enforce tenant-scoped retrieval, strict tool allow-lists, usage budgets and redaction.
- Keep monitoring operational when AI is unavailable.
- Read-only investigation by default; remediation requires explicit approval and audit.

**Gate:** tests prove cross-tenant retrieval is denied, unsafe tools cannot execute, and no remediation occurs without approval.

### Phase 6 — release readiness
- Run targeted tests, full typecheck/lint/build, migration verification, deployment checks and security review.
- Verify staging configuration, secrets, DNS/TLS, observability, rollback and data-retention policies.
- Production release requires a separate explicit go-live approval.

## Working rules

- All implementation commits stay on `feature/uamp-production-integration`; never commit directly to `main`.
- Inspect repository conventions and tests before adding files, tables, permissions, queue names or migrations.
- Use additive migrations only; never rewrite already-applied migrations.
- Do not claim a build/test passed unless it was actually run against the resulting code.
- Do not deploy or alter production infrastructure as part of this work.
