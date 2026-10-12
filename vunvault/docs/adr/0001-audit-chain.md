# 0001 — The audit log is an append-only, hash-chained ledger

**Status:** Accepted
**Date:** 2024-03-01 (genesis), reaffirmed for the VUNVAULT build
**Deciders:** Security leadership

## Context

VUNVAULT's audit log is evidence. It is read by compliance auditors, quoted in
incident reviews, and — because the platform releases penetration-test reports to
clients — it is the record of _who authorised what, and when_. A log that can be
edited is not evidence; it is an opinion.

Three threats matter:

1. **Insider rewriting.** An administrator who released a report without completing
   the review gate has both the motive and the privilege to erase the trace.
2. **Database-level tampering.** Anyone who obtains write access to the database
   (a leaked credential, a compromised migration) can `UPDATE` or `DELETE` rows.
3. **Silent truncation.** Deleting the tail of a log leaves no gap that a naive
   reader would notice.

Retention is seven years, write-once-read-many.

## Decision

The audit log is an **append-only, hash-chained, HMAC-signed ledger**. There is no
update path and no delete path anywhere in the codebase.

1. **Chain.** Each row stores `prev_hash` (the previous row's `hash`) and its own
   `hash = sha256_hex(prev_hash ‖ canonical_json(payload))`, where the payload is
   `{ category, event_type, severity, actor_label, subject, message, details,
created_at }` serialised by a deterministic canonical-JSON function. Editing or
   removing any row invalidates every hash after it.
2. **Signature.** Each row also stores `signature = hmac_sha256_hex(key, hash)` and
   the `key_id` of the key that produced it. Database write access alone is
   therefore not enough to forge a plausible chain — an attacker also needs the
   audit HMAC key, which lives in OCI Vault and never in the database or the
   environment of a compromised pod.
3. **Serialised appends.** `append` takes `pg_advisory_xact_lock(7340481)` before
   reading the head, and a `BEFORE INSERT` trigger takes the same lock and refuses
   a `prev_hash` that does not match the current head. Two concurrent writes cannot
   fork the chain.
4. **Database enforcement.** `BEFORE UPDATE OR DELETE OR TRUNCATE` triggers on
   `audit_entries`, `audit_checkpoints` and `content_reviews` raise
   `audit records are append-only`. The application cannot bypass this even with a
   bug or a malicious patch.
5. **One transaction.** `audited(spec, handler)` runs the domain write and the
   audit append in a single transaction. If the audit entry cannot be written, the
   domain write is rolled back and the request fails `500 audit_unavailable`. An
   unauditable mutation does not happen. Rejected attempts (failed logins, release
   lock violations) are recorded through `auditFailure` in their own short
   transaction.
6. **Sealing.** Sensitive fields are not stored in `details`; they are sealed with
   AES-256-GCM into `sealed_details` + `nonce`, with the entry's own uuid as
   additional authenticated data so a blob cannot be moved between entries.
   `details` is additionally redacted of any key matching
   `pass(word)?|secret|token|authorization|cookie|cvc|pan|code$`.
7. **Key rotation.** Keys live in a ring (`{ current, keys }`). New entries use
   `current`; verification looks up each entry's own `key_id`, so rotation never
   invalidates history. A rotation is itself an audited `KEY_ROTATION` event.
8. **Verification.** `AuditService.verify` streams entries in `seq` order in
   batches of 1000, re-checks linkage, recomputes every hash and verifies every
   signature. It reports `{ entries, mismatches, firstMismatchSeq }` rather than
   throwing, and writes an `audit_checkpoints` row — also append-only.
9. **Corrections.** A wrong entry is never edited. A new entry supersedes it,
   referencing the original in `details`.
10. **`created_at` is chosen by the application**, not by a database default, so a
    hash is reproducible from the row alone.

## Consequences

**Gains**

- Tampering is detectable, attributable and bounded: verification names the exact
  `seq` where the chain first diverges.
- Forgery requires the HMAC key, not just database access.
- The `audited()` wrapper makes "we forgot to log this" a compile-and-test-time
  problem: the handler is tagged with `Symbol.for("vv.audited")` and a route-table
  test walks every mutating route to prove coverage.

**Costs**

- Every state-changing request pays one advisory lock and one extra INSERT inside
  its existing transaction. Appends serialise per chain, so audit throughput is
  bounded by a single row at a time — acceptable at this platform's write volume,
  and the reason the lock is transaction-scoped rather than table-scoped.
- No `UPDATE` means no "fix the typo" path. Corrections are new entries, and any
  consumer that renders the log must understand supersession.
- Losing the HMAC key ring makes old entries unverifiable (though still chained).
  Key material is therefore backed up in Vault and rotation is recorded.
- A failure in the audit path fails the request. That is intentional — it converts
  "silently unaudited write" into "visible outage" — and it means the audit
  database is on the critical path of every mutation.

## Alternatives considered

- **WORM object storage only.** Strong immutability, but no transactional coupling
  to the write it describes, and querying becomes an export job.
- **Merkle tree over batches.** Cheaper verification for huge logs; more machinery
  than a seven-year, single-tenant log needs today. The linear chain can be
  upgraded to a Merkle structure later without changing the row format, because
  `hash` already covers `prev_hash`.
- **Database triggers computing the hash.** Would remove the need for application
  discipline, but puts a secret key inside the database — the one place an attacker
  with SQL access already controls.

## Read-only access model (Task 39)

The trail is exposed over HTTP by `apps/api/src/routes/v1/audit`, and the access
model is deliberately narrower than the write path it reads:

- **Every route is a GET except one.** `POST /api/v1/admin/audit/verify` runs a
  verification; it writes no entry, only an `audit_checkpoints` row recording that
  the chain was checked, by whom, over which `seq` range, and what it found.
  `audit-routes.test.ts` walks `app.printRoutes()` and fails if a PUT, PATCH or
  DELETE ever appears under the prefix, so "no update path" is enforced by a test
  rather than by a convention.
- **Guards:** `authenticate` + `requireStaff` (so a first-factor session cannot
  read the log) + `audit:read`; verification additionally requires `audit:verify`.
  Reading who did what is a compliance function, and the two permissions let an
  organisation grant it separately from the right to run a verification.
- **The projection is the control.** The list and the CSV export select thirteen
  columns by name. `details`, `sealed_details`, `nonce`, `signature` and `key_id`
  are never selected, so widening a response later cannot leak the material that
  makes a hash verifiable — or forgeable — outside the API.
- **Verification is serialised** behind a Redis lock (`audit:verify:lock`, TTL
  600 s) because it recomputes a SHA-256 and an HMAC per entry; a second caller
  gets `409 verify_in_progress`. The lock is released in a `finally`, so a verifier
  that throws cannot block the chain for ten minutes.
- **The live tail is SSE, not WebSockets**: one-way, plain HTTP, self-reconnecting.
  Frames carry `id: <seq>`, and a reconnecting client that sends `Last-Event-ID`
  is replayed up to 200 missed entries from the database before going live — a
  security console with a silent gap is worse than no console. A reader whose
  socket buffer exceeds 1 MB is dropped rather than buffered, the subscriber
  connection is dedicated (a subscribed Redis connection cannot issue commands) and
  is released on close, abort and error alike, and at most five streams per user
  may be open.
- **Exports are logged.** Generating a CSV appends `LOG_BACKUP` with the row count
  and the filters used: taking a copy of the audit trail is itself an event worth
  an entry in it. The export is capped at 100 000 rows, counted _before_ a byte is
  written, so an over-wide filter answers `422 range_too_large` instead of
  producing a silently truncated file.

## Daily snapshots (Task 92, recorded per Task 109)

The chain itself lives in Postgres; its daily **evidence copy** lives in R2.

- **What is written.** The maintenance worker's `audit_snapshot` job builds
  `{ date, entryCount, headSeq, headHash, lastCheckpoint, generatedAt }` and
  writes it to `audit-snapshots/<YYYY-MM-DD>.json` in the `vv-<env>-audit`
  bucket. It is a statement ABOUT the chain — head and counts — not a copy of
  it; the rows stay the source of truth.
- **WORM.** The bucket carries an R2 compliance lock with a 2555-day (7-year)
  retention (`cloudflare_r2_bucket_lock`, Task 98/99): inside the window an
  object cannot be overwritten or deleted by ANY credential, including the
  tenancy admin. That is what makes the snapshot evidence rather than
  telemetry.
- **Idempotent per day.** The job overwrites the SAME key on re-run — safe
  because the compliance lock engages on object finalisation per environment
  policy; in staging (unlocked) reruns simply refresh the day's file. A day
  with an empty range still writes: a snapshot that says "no new entries, head
  unchanged, checkpoint current" is a liveness proof, and its absence is how a
  reviewer would notice a dead worker.
- **Who writes what.** Only the API appends chain entries (under its advisory
  lock); the worker only READS to snapshot and VERIFY (`verify_chain`,
  6-hourly, checkpoint-anchored, alerting `AUDIT_ALERT_EMAIL` on any
  mismatch). Splitting append and snapshot across processes means the thing
  that photographs the ledger is not the thing that writes in it.
