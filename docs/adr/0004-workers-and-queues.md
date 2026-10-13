# 0004 — Background work is five BullMQ workers on one Redis, at-least-once and idempotent

**Status:** Accepted
**Date:** 2026-10 (Tasks 89–92 shipped; recorded in Task 109)
**Deciders:** Platform + Security

## Context

The platform's slow and consequential work — delivering zero-day broadcasts to
a national client estate, sending mail/SMS, rendering invoice and report PDFs,
twelve maintenance sweeps, running scans — cannot share the API's request
budget, and several of its steps (a SEV-1 broadcast) are exactly the ones that
must not be lost when a pod dies mid-flight. The estate is small: one Redis
provider (Upstash), one Kubernetes platform cluster, a team that reads every
queue it owns.

## Decision

1. **Five queues, five workers, one Redis.** `scan`, `broadcast`, `notify`,
   `pdf`, `maintenance` — one deployment each (scan-controller separately on
   k3s, ADR 0006). BullMQ owns retries, backoff, stalled-job recovery and
   delayed jobs; nothing hand-rolls a retry loop.
2. **At-least-once everywhere, so idempotency is a job-level invariant.**
   Every handler assumes it may run twice: stable jobIds (`broadcast:<id>`,
   the outbox sweep re-enqueues with the SAME id and BullMQ dedupes), status-row
   guards (a `sent`/`failed` broadcast row skips re-delivery), natural keys and
   `ON CONFLICT DO NOTHING` for inserts, and receipts per ATTEMPT so a mail
   that failed twice and landed on the third has three rows telling that story.
3. **Workers never import from `apps/api`.** The audit-chain helpers the
   maintenance worker verifies with live in `packages/lib/audit-chain` (the API
   re-exports them); the wire shapes live in `@vunvault/contracts`. The
   dependency graph stays a tree — a worker redeploy can never require an API
   change.
4. **The maintenance worker owns the schedule.** BullMQ job schedulers with
   stable ids, registered idempotently at boot by every replica under a Redis
   lock (`maint:scheduler:lock`) so exactly one replica schedules while all of
   them process. No crontab, no external scheduler to forget when the cluster
   is rebuilt.
5. **Telemetry never blocks delivery.** Progress frames (broadcast counters,
   scan lines) are fire-and-forget: a Redis blip drops a frame, never a
   delivery. The database row remains the truth; frames only make it live.
6. **Graceful shutdown is a contract.** SIGTERM/SIGINT stop fetching, finish
   the active job within 25 s, close connections — Kubernetes' 30 s grace
   period minus margin. A worker that cannot stop cleanly cannot be rolled
   safely.
7. **Secrets: two read paths, one direction of travel.** The API reads OCI
   Vault directly with its resource principal. Workers take plain env from
   ExternalSecrets (ESO) — accepted trade-off: workers stay framework-free
   (no OCI SDK in a BullMQ loop), at the cost of a 15-minute rotation window
   and a Kubernetes Secret at rest. The migration path (a shared
   `server-kit` secret provider, per the catalogue's Task 88b) is recorded
   here as future work, not silently skipped.
8. **The outbox sweep is the recovery path.** A broadcast decided but never
   delivered (API crashed between commit and enqueue) is re-enqueued by
   `outbox_reenqueue` within `OUTBOX_STUCK_MINUTES`. Deciding and delivering
   are two systems; the sweep is the seam-stitcher.

## Consequences

- Every new queue job starts from a checklist: stable id? status guard?
  receipts? shutdown? The broadcast/notify/maintenance suites are the worked
  examples.
- One Redis is a single point of failure for ALL async work — accepted:
  Upstash multi-AZ, and the failure mode is "nothing dispatches" (visible,
  recoverable) rather than "things diverge" (invisible).
- Duplicate deliveries are IMPOSSIBLE only where a natural key exists; where
  none does (an e-mail), the receipt table makes duplicates visible instead.

## Enforcement

- Queue payloads are parsed with their `@vunvault/contracts` schema before use
  (every consumer; asserted in each worker's suite).
- The Task 105 integration suite proves producer→consumer agreement on the
  real notify wire; the worker suites pin idempotent redelivery (`skipped`),
  the shutdown budget and the scheduler singleton.
- `verify-forbidden-stack` keeps Express/Prisma/Joi out; pino redaction keeps
  recipients and tokens out of logs (asserted in worker suites).
