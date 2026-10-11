### TASK 92 — Maintenance worker B: purges, expiries, dormant accounts, stale signups, outbox re-enqueue, media scan, chain verify, audit snapshot

**Layer:** L11

**Prerequisites:** Task 91 (same app: consumer, scheduler, env, ports), Task 39 (audit chain), Task 82 (advisory broadcasts), Task 20c (account statuses).

**Estimated files touched:** 17

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Maintenance worker B**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

> **Planner note (Part 5 is planner-authored):** the audit chain's pure crypto
> and verification helpers live in `apps/api/src/audit/` and workers may not
> import from `apps/api` — they are MOVED to `packages/lib` here (api keeps
> re-exports; `AuditService` and its repo stay in the api). `broadcast_jobs`
> (bulletin outbox) has no producer in the tree, so `outbox_reenqueue` covers
> `advisory_broadcasts` only — stated in a code comment.

---

**Goal:**
Add the remaining eight maintenance handlers to `apps/maintenance-worker` and their scheduler entries: `purge_login_attempts`, `expire_invitations`, `flag_dormant_accounts`, `stale_signups`, `verify_chain`, `outbox_reenqueue`, `media_scan`, `audit_snapshot`.

**Deliverables:**

*Shared extraction:*
- `packages/lib/src/audit-chain/{index.ts,canonical.ts,crypto.ts,verify.ts}` — MOVE `apps/api/src/audit/canonical.ts` and `crypto.ts` verbatim; MOVE the pure verification pieces out of `apps/api/src/audit/service.ts` into `verify.ts` (`AuditEntryRow`, `VerifyIssue`, `VerifyEntriesResult`, `checkEntry`, `verifyEntries`, `digestsEqual`, `VERIFY_BATCH_SIZE` if defined there, `ZERO_HASH` re-export).
- MODIFY `apps/api/src/audit/{canonical.ts,crypto.ts}` — one-line re-exports of `@vunvault/lib/audit-chain`.
- MODIFY `apps/api/src/audit/service.ts` — import the moved helpers from lib; `AuditService.verify` behaviour unchanged; all existing audit tests pass untouched.
- MODIFY `packages/lib/package.json` — subpath export `"./audit-chain": "./src/audit-chain/index.ts"`.
- MODIFY `apps/api/package.json` — `@vunvault/lib` (if not already present).
- `packages/lib/src/audit-chain/verify.test.ts` — the moved/added pure tests (chain intact, broken hash, broken signature, anchor mismatch).

*Worker:*
- `apps/maintenance-worker/src/domain/{purge-login-attempts.ts,expire-invitations.ts,flag-dormant.ts,stale-signups.ts,verify-chain.ts,outbox-reenqueue.ts,media-scan.ts,audit-snapshot.ts}` + per-handler tests (the four same-shaped sweeps share `sweeps.test.ts`; verify-chain, outbox, media-scan and audit-snapshot get their own files).
- MODIFY `apps/maintenance-worker/src/ports.ts` — repo operations below; `ObjectStorage` (put + head), `BroadcastProducer` (`requeue(broadcastId, advisoryId, kind)`), `NotifyEnqueuer` (already exists), `AuditKeyRing`-compatible `hmacKeyFor(keyId)`.
- MODIFY `apps/maintenance-worker/src/adapters/sql-repo.ts`, `src/main.ts` (compose R2 + key ring + broadcast queue producer), `src/queue/scheduler.ts` (eight more patterns), `src/queue/consumer.ts` (registry gains the eight handlers).
- MODIFY `apps/maintenance-worker/src/config/env.ts` — add `AUDIT_ALERT_EMAIL` (optional e-mail; when set, a chain mismatch pages it), `LOGIN_ATTEMPT_RETENTION_DAYS` (default 30), `INVITATION_GRACE_HOURS` (default 0 — expire strictly at `expires_at`), `DORMANT_AFTER_DAYS` (default 90), `SIGNUP_STALE_DAYS` (default 7), `OUTBOX_STUCK_MINUTES` (default 2), `R2_PUBLIC_BASE_URL`.
- MODIFY `.env.example` — the new names under the existing `# maintenance-worker` heading.

**Dependencies allowed:** `apps/maintenance-worker` gains `@vunvault/lib` (workspace) only — the R2 upload goes through `R2ObjectStorage`/`ObjectWriter` from `@vunvault/lib/storage` (extracted in Task 90), so no direct `@aws-sdk` dependency.

---

**Scheduler patterns (added to Task 91's table):**

| Task | Pattern |
|---|---|
| `verify_chain` | `0 */6 * * *` |
| `outbox_reenqueue` | `*/2 * * * *` |
| `expire_invitations` | `17 * * * *` |
| `purge_login_attempts` | `0 3 * * *` |
| `flag_dormant_accounts` | `30 3 * * *` |
| `stale_signups` | `0 4 * * *` |
| `media_scan` | `23 * * * *` |
| `audit_snapshot` | `0 2 * * *` |

**Handler behaviour (each returns the Task 91 `Summary`):**

1. **`purge_login_attempts`** — DELETE `login_attempts` WHERE `created_at < now − LOGIN_ATTEMPT_RETENTION_DAYS`. `affected` = rows deleted. (The table is operational telemetry, not audit; retention is a privacy control.)
2. **`expire_invitations`** — UPDATE `staff_invitations` SET `status='expired'` WHERE `status='pending'` AND `expires_at < now − INVITATION_GRACE_HOURS`. `affected` = rows.
3. **`flag_dormant_accounts`** — UPDATE `profiles` SET `account_status='dormant'` WHERE `account_status='active'` AND `role='client'` AND `last_active_at < now − DORMANT_AFTER_DAYS` AND `deleted_at IS NULL`. Staff are never auto-flagged (access reviews are a human process — comment says so). `affected` = rows.
4. **`stale_signups`** — UPDATE `profiles` SET `account_status='dormant'` WHERE `account_status='pending_verification'` AND `joined_at < now − SIGNUP_STALE_DAYS`. (**Planner decision:** the enum has no `expired`; `dormant` is the soft state, and the Supabase auth user is left for the provider's own cleanup — the worker holds no service-role key.) `affected` = rows.
5. **`verify_chain`** — read the latest `audit_checkpoints` row; `fromSeq = to_seq + 1` (or 1), anchor `prevHash = head_hash` (or `ZERO_HASH`). Stream `audit_entries` in `VERIFY_BATCH_SIZE` batches through lib's `checkEntry` with `hmacKeyFor` from env (`AUDIT_HMAC_KEY_ID → AUDIT_HMAC_KEY`, hex/base64 per the api's existing key parsing). Write ONE checkpoint row `{from_seq, to_seq, entries, mismatches, head_hash (last verified entry hash, or the anchor when empty), verified_by: 'system'}` — append-only, an empty range still writes a checkpoint (liveness proof). On `mismatches > 0`: log `error` with `firstMismatchSeq`; when `AUDIT_ALERT_EMAIL` is set enqueue notify e-mail template `chain_broken` vars `{ firstMismatchSeq, mismatches }` (add the template to the Task 90 registry — MODIFY `apps/notify-worker/src/domain/templates.ts` + its test). `affected = entries checked`.
6. **`outbox_reenqueue`** — `advisory_broadcasts` WHERE `status='queued'` AND `created_at < now − OUTBOX_STUCK_MINUTES`: for each, re-add the BullMQ job `{broadcastId, advisoryId, kind}` with jobId `broadcast:<id>` (BullMQ dedupes an identical jobId — the enqueue is safe to repeat). Count only rows whose requeue resolved. `detail = { requeued, skipped }`.
7. **`media_scan`** — validation sweep, no destructive action (**planner decision:** quarantine needs a moderation UI that does not exist): profiles' `avatar_key` must be null or match `^avatars/[A-Za-z0-9._-]+$` (no traversal, no absolute paths); `content_items.featured_image_url` must be null or a URL whose origin equals `R2_PUBLIC_BASE_URL`'s origin. Violations: log `warn` per row (id + field only, never the value) and count them. `detail = { avatarsChecked, imagesChecked, violations }`.
8. **`audit_snapshot`** — build `{ date: 'YYYY-MM-DD' (UTC), entryCount, headSeq, headHash, lastCheckpoint: {toSeq, mismatches, verifiedAt} | null, generatedAt }`; `storage.put('audit-snapshots/<date>.json', json, 'application/json')`. Idempotent per day (overwrite same key; WORM is an R2 bucket-policy concern, noted in the file header and in Task 109's ADR). Head/exists check via repo; `affected = 1`.

**Tests (assert):** each handler's exact WHERE semantics against a fake repo (rows touched, rows NOT touched — e.g. staff never flagged dormant, fresh signups untouched, pending invitations with future expiry untouched); verify_chain — intact chain writes a checkpoint with 0 mismatches and advances `to_seq`; a tampered hash is caught with the right `firstMismatchSeq` and the alert e-mail is enqueued only when the env address is set; an empty range writes a liveness checkpoint; resume-from-checkpoint anchoring; outbox — only stuck queued rows re-enqueued with the stable jobId, `sent`/`failed`/`sending` rows untouched; media_scan — traversal keys and foreign origins counted as violations, values never logged (fake logger asserts); audit_snapshot — exact key and JSON shape, overwrite on re-run; scheduler registers all twelve patterns with stable ids; consumer dispatches all twelve tasks.

**Out of scope:** appending audit entries from the worker (chain appends stay in the API under its advisory lock); deleting Supabase auth users; quarantining media; bulletin `broadcast_jobs` (no producer exists).

---

**Definition of done:**
☐ `pnpm --filter @vunvault/lib typecheck|lint|test` pass (audit-chain moved + tested).
☐ `pnpm --filter api typecheck|lint|test` pass (re-exports; audit suite untouched and green).
☐ `pnpm --filter maintenance-worker typecheck|lint|test` pass with zero errors.
☐ `pnpm --filter notify-worker typecheck|lint|test` pass (chain_broken template added).
☐ Output: `Task 92 complete. Files created: <list>. Files modified: <list>. Dependencies: <list>`.
