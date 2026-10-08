# VUNVAULT — Task Catalogue for coder.qwen.ai

## Part 2 of 5 — Part 1 addenda (20b–20d), Layer L3, Layer L4 (Tasks 20b–40)

## What changed from Part 1 (read this first)

The second batch of files (`profile-settings`, `dashboard`, `zero-day`, `password-manager`; `contact.html` was a byte-identical repeat) added entities Part 1 did not model. Instead of renumbering Part 1, three **addendum tasks (20b, 20c, 20d)** are inserted after Task 20 and before Task 21. Run them in numeric order: 20 → 20b → 20c → 20d → 21.

| New in this batch | Where it is covered |
|---|---|
| Zero-day advisories, emergency broadcast, acknowledgements, client assets, sensor nodes, hourly metrics, threat level | 20b (schema), 20d (contracts), 37, 38 |
| Payment transaction codes (`VX-90241`), plan seeds, Stripe/Paystack customer ids | 20b, 32–34 |
| Recovery codes, device sessions, notification preferences, onboarding answers, login attempts | 20c, 26–30 |
| Content Studio (verified-blogger badge, tags, slug, excerpt, image) — from `blogger.html`, which was in batch 1 but not modelled | 20c, 20d, 36, 40 |
| New permission `intel:broadcast` (admin + super_admin only) | 20d, 38 |

**Decisions I made where the prototype was ambiguous or inconsistent — change them before running the task if you disagree:**
1. **Password hashing:** the Profile Settings copy says "Argon2id", but you mandated Supabase Auth as the identity source and it hashes with bcrypt. I kept Supabase and the API never hashes passwords. The later UI task should use neutral wording ("salted, one-way hash") rather than "Argon2id". The recovery *answer* (onboarding) is hashed with scrypt.
2. **Password length:** clients 12 characters (Password Manager copy), staff 14 characters (Profile Settings copy).
3. **Security-posture score:** the prototype shows 80 for "3 of 4 complete"; the formula `round(100 × done ÷ total)` gives 75. The formula wins (Task 27 says so).
4. **Threat level:** the prototype shows "Level 4 / High" with 9 unpatched critical and 37 weaponised. A hand-written formula (Task 37) gives 5 for those inputs. The fixture value is kept as data; the formula is the production behaviour.
5. **Recovery codes at login:** Supabase cannot raise AAL from a recovery code, so a recovery login drops TOTP and forces staff to re-enrol (Task 27).
6. **`blogger.html`** unlocked itself with `localStorage` (a demo switch). The real gate is a server-side badge granted by an admin (Tasks 36, 40). No browser storage is used anywhere.
7. **M-Pesa in USD:** M-Pesa is routed through Paystack, charged in USD. Whether your Paystack merchant account can present USD for mobile money is not something the prototype can tell me; Task 33 surfaces it as `channel_unavailable`. Check this with Paystack before building the checkout UI.
8. **`dashboard.html` is the client onboarding wizard**, not a dashboard. The admin "Dashboard Overview" is `admin.html` (Command Center).

**Operator pre-steps (not coder tasks):** copy `logo.svg` to `apps/web/public/brand/logo.svg` before Task 41; enable the Supabase Auth Hook (Task 24) in the dashboard after applying the SQL.

**Revised totals:** 20 (Part 1) + 3 addenda + 20 (this part) = 43 so far; reserved remainder below brings the plan to **105 tasks**.

## Reserved numbering for remaining parts (updated)

| Reserved | Layer | Scope | Part |
|---|---|---|---|
| 41–46 | L5 | Frontend foundation: Next.js skeleton, providers (Query, Toaster, Tooltip), API/session bootstrap, shared marketing layout, shared portal layout, shared admin layout | 3 |
| 47–54 | L6 | Marketing pages: Home, About, Services, Product, Blog, Contact (+ consent banner), legal stubs, 404 | 3 |
| 55–60 | L7 | Auth: Login (+ MFA step), Signup, Accept-invite, Client onboarding (3 steps), Forgot-password stub | 3 |
| 61–69 | L8 | Client portal: Dashboard/Scans, Findings view, Billing & Invoices (+ FX checkout), Password Manager, Profile, Request PenTest, Advisories feed, Content Studio, Academy placeholder | 4 |
| 70–78 | L9 | Admin: Command Center dashboard, Scan Queue + Review Gate, User Management, Zero-Day Editor, Content Moderation, Audit Logs, Profile Settings, Payments admin | 4 |
| 79–83 | L10 | Scan worker (unprivileged Docker + adapters + WS relay) | 4 |
| 84–87 | L11 | Background workers: broadcast, maintenance (rollups, heartbeats, threat level, purge, scheduled publish) | 5 |
| 88–91 | L12 | Real-time wiring: audit SSE, advisory broadcast progress SSE, scan WebSocket terminal | 5 |
| 92–99 | L13 | DevOps: Dockerfiles, Terraform (OCI + Cloudflare), Helm, GitHub Actions | 5 |
| 100–105 | L14 | Integration, E2E, hardening | 5 |

## Sequence Overview (this part)

| # | Layer | Task title | Depends on | Files touched |
|---|---|---|---|---|
| 20b | L2 | Schema addendum: zero-day advisories, broadcasts, client assets, sensor nodes, platform metrics, payment txn codes | Task 14, Task 15, Task 17, Task 18 | 9 |
| 20c | L2 | Schema addendum: account security, sessions, notification preferences, client onboarding | Task 14, Task 15, Task 20b | 7 |
| 20d | L2 | Contracts C: zero-day, admin dashboard, account security, notifications, onboarding (+ fixtures) | Task 19, Task 20, Task 20b, Task 20c | 15 |
| 21 | L3 | API bootstrap: config, app factory, error model, health, OpenAPI | Task 3, Task 4, Task 7, Task 19, Task 20 | 14 |
| 22 | L3 | API infrastructure plugins: secrets (OCI Vault), database, Redis, queues, email/SMS providers | Task 21, Task 14, Task 20d | 16 |
| 23 | L3 | API security plugins: headers, CORS, cookies, CSRF, rate limiting, Sentry, raw-body | Task 21, Task 22 | 11 |
| 24 | L3 | API auth plugin: Supabase JWT verification, permissions, session cookies, Supabase admin client, JWT claims hook | Task 21, Task 22, Task 23, Task 15, Task 19, Task 20c | 11 |
| 25 | L3 | API audit-chain service: append-only hash chain, HMAC, AES-256-GCM sealing, `audited()` wrapper, verification, live stream | Task 18, Task 20, Task 22, Task 24 | 12 |
| 26 | L4 | Auth routes: signup, login, MFA challenge, refresh, logout, session | Task 19, Task 20c, Task 23, Task 24, Task 25 | 12 |
| 27 | L4 | Credentials & MFA self-service: password change, TOTP, WebAuthn, recovery codes | Task 24, Task 25, Task 26, Task 20c, Task 20d | 14 |
| 28 | L4 | Account settings & avatar: staff profile settings, R2 presigned upload | Task 20c, Task 20d, Task 24, Task 25, Task 22 | 11 |
| 29 | L4 | Notification preferences, device sessions, deactivation request | Task 20c, Task 20d, Task 24, Task 25, Task 22 | 9 |
| 30 | L4 | Client intake: client profile, onboarding, pen-test requests | Task 19, Task 20c, Task 20d, Task 24, Task 25, Task 29 | 12 |
| 31 | L4 | Staff users admin: roster, summary, invitations, acceptance, account actions | Task 19, Task 20c, Task 24, Task 25, Task 29 | 14 |
| 32 | L4 | Billing foundation: provider clients, invoice issuance (ledger), subscription, payment method, invoices, PDF/CSV | Task 17, Task 20, Task 20b, Task 22, Task 24, Task 25, Task 28 | 15 |
| 33 | L4 | FX quotes and USD checkout | Task 17, Task 20, Task 32, Task 24, Task 25 | 9 |
| 34 | L4 | Payment webhooks, ledger posting, refunds, ledger reconciliation | Task 17, Task 20b, Task 23, Task 25, Task 32, Task 33 | 12 |
| 35 | L4 | Scans API: client scans, admin queue, mandatory review gate, release lock | Task 16, Task 19, Task 24, Task 25, Task 29, Task 33, Task 34 | 14 |
| 36 | L4 | Content: moderation queue, content studio, public content feed | Task 18, Task 20b, Task 20c, Task 20d, Task 24, Task 25, Task 29 | 14 |
| 37 | L4 | Admin Command Center dashboard API: KPIs, revenue, transactions, traffic, nodes, pipeline, threat level, node heartbeats | Task 17, Task 20b, Task 20d, Task 24, Task 25, Task 34, Task 35 | 13 |
| 38 | L4 | Zero-day advisories API: editor, NVD import, emergency broadcast, retraction, client advisories | Task 18, Task 20b, Task 20d, Task 22, Task 24, Task 25, Task 29, Task 36 | 15 |
| 39 | L4 | Audit log read API: list, summary, chain status, verify, CSV export, live SSE stream | Task 18, Task 20, Task 24, Task 25, Task 22 | 9 |
| 40 | L4 | Public routes, badge grant, route-guard conformance test, API closeout | Task 21, Task 22, Task 23, Task 24, Task 25, Task 26, Task 27, Task 28, Task 29, Task 30, Task 31, Task 32, Task 33, Task 34, Task 35, Task 36, Task 37, Task 38, Task 39 | 12 |

---

### TASK 20b — Schema addendum: zero-day advisories, broadcasts, client assets, sensor nodes, platform metrics, payment txn codes

**Layer:** L2

**Prerequisites:** Task 14, Task 15, Task 17, Task 18

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Schema addendum: zero-day advisories, broadcasts, client assets, sensor nodes, platform metrics, payment txn codes**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the tables behind the Zero-Day Intel desk and the admin Command Center dashboard (advisories, emergency broadcasts, acknowledgements, client assets, sensor nodes, hourly metrics, threat-level snapshots) and a human transaction code on payment attempts.

**Deliverables:**
- MODIFY `packages/db/src/enum-values.ts` — append the enums listed below (tuple + union type each).
- MODIFY `packages/db/src/schema/_enums.ts` — append the matching `pgEnum`s.
- `packages/db/src/schema/intel.ts` — tables listed below.
- MODIFY `packages/db/src/schema/billing.ts` — add `txnNumber` and `txnCode` to `payment_attempts`, `unit` to `plans`, `plan_code` to `invoice_lines` (details below).
- MODIFY `packages/db/src/schema/identity.ts` — add `stripe_customer_id`, `paystack_customer_code` to `organizations`.
- MODIFY `packages/db/src/schema/scans.ts` — add `analyst_id` to `scan_jobs`.
- `packages/db/sql/0020_intel_and_txn.sql` — raw SQL: generated columns, append-only trigger for `advisory_broadcasts`, plan seed, ALTERs (below).
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./intel";`.
- `packages/db/src/schema/intel.test.ts` — asserts table names, CVE check constraint, and RLS enabled.

**Dependencies allowed:**
- None — use only existing (`drizzle-orm`).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**New enums (add to `enum-values.ts`, exact values):**
```ts
advisory_status:       "draft" | "published" | "retracted"
advisory_patch_status: "unpatched" | "patch_in_progress" | "patched"
scope_category:        "web_api" | "network_edge" | "endpoint_desktop" | "cloud_containers" | "mobile" | "ot_ics" | "identity_sso"
broadcast_kind:        "initial" | "rebroadcast" | "retraction"
node_status:           "operational" | "high_load" | "drift_warning" | "degraded" | "offline"
```
(Display labels for `scope_category`, defined later in contracts: `"Web & API"`, `"Network & Edge"`, `"Endpoint / Desktop"`, `"Cloud & Containers"`, `"Mobile"`, `"OT / ICS"`, `"Identity & SSO"`.)

**Tables in `intel.ts` (all `.enableRLS()`; use `idCol()`, `timestamps`, `usdCents`, `tz` helpers; reuse `findingSeverityEnum` for advisory severity):**

1. `advisories`
   - `id`; `cve_id` text not null unique with check `cve_id ~ '^CVE-\d{4}-\d{4,}$'`.
   - `vendor` text null; `cvss` numeric(3,1) null check `cvss between 0 and 10`; `disclosure_date` date null.
   - `severity` finding_severity null. Check: when both set, severity matches CVSS band — critical 9.0–10.0, high 7.0–8.9, medium 4.0–6.9, low 0.1–3.9.
   - Flags (boolean not null default false): `weaponized`, `public_poc`, `pre_auth`, `patch_available`.
   - `title` varchar(140) null (required before publishing — enforced by the API); `summary` text null with check `char_length(summary) <= 1200`; `remediation` text null with check `char_length(remediation) <= 900`; `references` text[] not null default `'{}'`.
   - `scope` jsonb not null default `'[]'` — array of `{ label: string; category: scope_category | null }`.
   - `status` advisory_status not null default `'draft'`; `patch_status` advisory_patch_status not null default `'unpatched'`.
   - `author_id` uuid not null → profiles; `content_item_id` uuid null → content_items (set when mirrored into the moderation queue).
   - `last_saved_at` timestamptz null; `published_at`, `retracted_at` timestamptz null; `retraction_note` text null; `created_at`, `updated_at`.
   - Indexes: `(status, published_at desc)`, `(severity)`, `(author_id, status)`, `(weaponized) where weaponized`.
2. `advisory_broadcasts` (append-only; reuse the Task 18 append-only trigger pattern)
   - `id`; `advisory_id` → advisories; `kind` broadcast_kind not null; `status` broadcast_status not null default `'queued'`; `triggered_by` uuid not null → profiles.
   - `ack` jsonb not null — `{ severityCorrect: boolean; scopeComplete: boolean; contentSafe: boolean; remediationActionable: boolean; authorised: boolean }` (all must be true for `initial` and `rebroadcast`).
   - `audience_dashboards` int not null default 0; `email_contacts` int not null default 0; `sms_contacts` int not null default 0; `sent_dashboards`, `sent_email`, `sent_sms`, `failed` int not null default 0.
   - `audit_seq` bigint null (the SEV-1 audit entry's chain height); `queue_job_id` text null; `started_at`, `finished_at` timestamptz null; `created_at`.
   - Index `(advisory_id, created_at desc)`.
   - NOTE: status transitions are done by inserting a new row is NOT required; this table allows UPDATE of the delivery counters and `status`/`finished_at` ONLY (the append-only trigger in the SQL file blocks DELETE and blocks UPDATE of any other column).
3. `advisory_acknowledgements` — `id`; `advisory_id` → advisories on delete cascade; `org_id` → organizations; `user_id` uuid null → profiles; `acknowledged_at` timestamptz not null default now(). Unique `(advisory_id, org_id)`. ("Reach" = distinct orgs that acknowledged within 24 h of the first broadcast.)
4. `client_assets` — `id`; `org_id` → organizations; `category` scope_category not null; `product` text not null; `version` text null; `host` text null; `created_at`. Index `(org_id)`, `(category)`. (Used by the broadcast engine to match advisory scope entries to clients.)
5. `sensor_nodes` — `id`; `code` text not null unique (e.g. `node-nbo-01`); `label` text not null (e.g. `Nairobi Core`); `country` text not null (e.g. `Kenya`); `status` node_status not null default `'operational'`; `req_per_min` integer not null default 0; `load_percent` smallint not null default 0 check 0..100; `heartbeat_latency_ms` integer null; `clock_drift_ms` integer null; `missed_heartbeats` smallint not null default 0; `last_heartbeat_at` timestamptz null; `public_key` text not null (Ed25519, base64; nodes sign heartbeats); `created_at`, `updated_at`.
6. `platform_metrics_hourly` — `hour` timestamptz primary key; `site_sessions` integer not null default 0; `api_requests` bigint not null default 0; `avg_response_ms` integer not null default 0; `p95_response_ms` integer not null default 0; `threats_blocked` integer not null default 0.
7. `endpoint_stats` — `id`; `endpoint` text not null (e.g. `/api/v1/scan/submit`); `window_start` timestamptz not null; `requests` bigint not null default 0; `avg_latency_ms` integer not null default 0; `error_ratio` numeric(6,4) not null default 0 (0.0021 = 0.21 %). Unique `(endpoint, window_start)`.
8. `threat_level_snapshots` — `id`; `computed_at` timestamptz not null default now(); `level` smallint not null check 1..5; `active_zero_days` integer not null; `critical_cves` integer not null; `unpatched_critical` integer not null; `weaponized_in_wild` integer not null; `threats_blocked_ytd` bigint not null. Index `(computed_at desc)`.

**Changes to `billing.ts` + SQL (`0020_intel_and_txn.sql`):**
- `payment_attempts.txn_number` bigint **generated always as identity (start with 90242)**; `payment_attempts.txn_code` text **generated always as `'VX-' || txn_number::text` stored**, unique. (Prototype transaction IDs look like `VX-90241`.) In Drizzle declare both as `.generatedAlwaysAs(...)`/identity so inserts never set them.
- `organizations.stripe_customer_id` text null unique and `organizations.paystack_customer_code` text null unique (MODIFY `identity.ts`).
- `invoice_lines.plan_code` text null → `plans.code` (MODIFY `billing.ts`).
- `scan_jobs.analyst_id` uuid null → `profiles.id` (the analyst running the job; MODIFY `scans.ts`; index `(analyst_id)`).
- `plans.unit` text not null default `'month'` (values `scan` | `assessment` | `month`); document in a comment that `monthly_usd_cents` holds the unit price in USD cents regardless of `unit`.
- Seed three plans (idempotent `INSERT ... ON CONFLICT (code) DO NOTHING`): `starter_scan` / `"Starter Scan"` / unit `scan` / `29900`; `sacco_fintech_compliance` / `"SACCO & Fintech Compliance"` / unit `assessment` / `89900`; `enterprise_retainer` / `"Enterprise Client"` / unit `month` / `249900`.
- Seed the ledger accounts listed in Task 17's comment (idempotent).
- Trigger on `advisory_broadcasts`: `BEFORE DELETE` raises `'advisory broadcasts are append-only'`; `BEFORE UPDATE` raises unless every column other than `status, sent_dashboards, sent_email, sent_sms, failed, finished_at, started_at, queue_job_id, audit_seq` is unchanged.

---

**Data shape (TypeScript):**
```ts
interface Advisory {
  id: string; cveId: string; vendor: string | null; cvss: string | null; disclosureDate: string | null; severity: "critical" | "high" | "medium" | "low" | null;
  weaponized: boolean; publicPoc: boolean; preAuth: boolean; patchAvailable: boolean;
  title: string | null; summary: string | null; remediation: string | null; references: string[];
  scope: { label: string; category: ScopeCategory | null }[];
  status: "draft" | "published" | "retracted"; patchStatus: "unpatched" | "patch_in_progress" | "patched";
  authorId: string; contentItemId: string | null; lastSavedAt: Date | null; publishedAt: Date | null; retractedAt: Date | null;
}
interface SensorNode { id: string; code: string; label: string; country: string; status: NodeStatus; reqPerMin: number; loadPercent: number; heartbeatLatencyMs: number | null; clockDriftMs: number | null; missedHeartbeats: number; lastHeartbeatAt: Date | null }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema only. (Heartbeat rule for later layers: a signed heartbeat every 15 s; 2 consecutive misses → `degraded`; 3 → `offline`. Threat level is recalculated hourly; level ≥ 4 escalates to the incident commander on duty.)

---

**Out of scope:**
- Do not generate or apply migrations.
- Do not write seed data other than the plans and ledger accounts named above.
- Do not implement matching, broadcasting, or metrics collection logic.
- Do not modify any column other than those named above.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` and `pnpm --filter @vunvault/db test` pass (schema-shape tests import each new table and assert column names, enum values, and RLS enabled).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 20b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 20c — Schema addendum: account security, sessions, notification preferences, client onboarding

**Layer:** L2

**Prerequisites:** Task 14, Task 15, Task 20b

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Schema addendum: account security, sessions, notification preferences, client onboarding**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the tables and profile columns behind Password Manager, admin Profile Settings and the 3-step client onboarding: recovery codes, device sessions, notification preferences, onboarding answers.

**Deliverables:**
- MODIFY `packages/db/src/enum-values.ts` — append the enums below.
- MODIFY `packages/db/src/schema/_enums.ts` — append matching `pgEnum`s.
- `packages/db/src/schema/account.ts` — tables below.
- MODIFY `packages/db/src/schema/identity.ts` — add the new `profiles` columns listed below.
- MODIFY `packages/db/src/schema/content.ts` — add the new `content_items` columns listed below.
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./account";`.
- `packages/db/src/schema/account.test.ts` — asserts table names, composite keys, RLS enabled, and that no column stores a plaintext secret (no column named `code`, `answer`, `password`, `secret` without a `_hash` / `_enc` suffix).

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**New enums (exact values):**
```ts
career_role:       "student" | "business_owner" | "cybersecurity_professional" | "independent_specialist"
entity_type:       "individual" | "company" | "corporation"
recovery_question: "first_pet" | "birth_city" | "maiden_name" | "first_car" | "first_school"
notification_event:"signin_new_device" | "credentials_changed" | "failed_auth" | "scan_completed" | "job_awaiting_review" | "critical_finding" | "advisory_broadcast" | "threat_level_change" | "content_awaiting_moderation" | "team_member_provisioned" | "weekly_digest"
notification_channel: "in_app" | "email" | "sms" | "push"
```
(Labels, verbatim, for later contracts — `recovery_question`: `"What was the name of your first pet?"`, `"In what city were you born?"`, `"What is your mother's maiden name?"`, `"What was your first car?"`, `"What was the name of your first school?"`. `career_role`: `"Student"`, `"Business Owner"`, `"Cybersecurity Professional"`, `"Independent Specialist"`. `entity_type`: `"Individual"`, `"Company"`, `"Corporation"`.)

**Also add to `enum-values.ts`:** `blog_category: "news" | "threat_intel" | "blog" | "industry_updates" | "tutorials"`.

**New columns on `content_items` (MODIFY `content.ts`):** `category` blog_category null; `tags` text[] not null default `'{}'` (max 8 enforced by the API; DB check `cardinality(tags) <= 8`); `featured_image_key` text null; `featured_image_url` text null; `image_alt` text null; `read_minutes` smallint null; `excerpt` text null with check `char_length(excerpt) <= 240`. (`summary` stays for non-blog types; blog posts use `excerpt`.)

**New columns on `profiles` (modify `identity.ts`):** `verified_blogger_at` timestamptz null and `verified_blogger_by` uuid null → profiles (the "Verified Journalist / Blogger" badge, granted manually by an administrator after a Contact-page verification request).

**New columns on `profiles` (modify `identity.ts`):**
`first_name` text null; `last_name` text null; `display_name` text null; `timezone` text not null default `'Africa/Nairobi'`; `language` text not null default `'en-GB'` (allowed: `en-GB`, `en-US`, `sw`, `fr`); `bio` text null check `char_length(bio) <= 400`; `avatar_key` text null (object-storage key; the file lives in R2); `require_2fa` boolean not null default true; `last_password_change_at` timestamptz null; `last_factor_change_at` timestamptz null; `deactivation_requested_at` timestamptz null.

**Tables in `account.ts` (all `.enableRLS()`):**
1. `user_recovery_codes` — `id`; `user_id` → profiles on delete cascade; `batch_id` uuid not null; `code_hash` text not null (SHA-256 hex of the normalised code; the plaintext is shown to the user once and never stored); `used_at` timestamptz null; `created_at`. Index `(user_id, batch_id)`. Unique `(user_id, code_hash)`. A set is 10 codes in the display format `XXXX-XXXX-XXXX`.
2. `user_sessions` — `id` uuid primary key (equals the Supabase Auth session id); `user_id` → profiles on delete cascade; `device_label` text not null (e.g. `MacBook Pro · Safari`); `user_agent` text null; `ip` inet null; `geo_city` text null; `geo_country` char(2) null; `mfa_method` mfa_method null; `started_at` timestamptz not null default now(); `last_seen_at` timestamptz not null default now(); `revoked_at` timestamptz null. Indexes `(user_id, revoked_at)`.
3. `notification_preferences` — composite primary key `(user_id, event)`; `user_id` → profiles on delete cascade; `event` notification_event not null; `in_app`, `email`, `sms`, `push` boolean not null. Planner's defaults (applied by the API when a row is missing and by "Reset to Defaults"): `in_app true, email true, sms false, push false` for every event.
4. `notification_settings` — `user_id` primary key → profiles on delete cascade; `quiet_hours_enabled` boolean not null default false; `quiet_from` time null; `quiet_to` time null. Rule (document in a comment): credential changes, SEV-1 broadcasts, review-gate escalations and incident-commander pages ignore quiet hours and channel opt-outs.
5. `onboarding_profiles` — `user_id` primary key → profiles on delete cascade; `date_of_birth` date null (check: user is at least 16 years old at write time is enforced by the API; add a DB check `date_of_birth <= current_date - interval '16 years'`); `career` career_role null; `entity` entity_type null; `recovery_question` recovery_question null; `recovery_answer_hash` text null (Argon2id or scrypt hash of the lower-cased, trimmed answer; never plaintext); `declarations` jsonb not null default `'{"infoAccurate":false,"authorisedTesting":false,"termsAccepted":false}'`; `terms_version` text null; `completed_at` timestamptz null; `created_at`, `updated_at`.
6. `login_attempts` — `id`; `email_hash` text not null (SHA-256 of lower-cased email — never the address); `ip` inet not null; `succeeded` boolean not null; `reason` text null; `created_at`. Indexes `(email_hash, created_at desc)`, `(ip, created_at desc)`. (Backs the 5-failures lockout; rows older than 30 days are purged by the maintenance worker.)

---

**Data shape (TypeScript):**
```ts
interface UserSession { id: string; userId: string; deviceLabel: string; ip: string | null; geoCity: string | null; geoCountry: string | null; mfaMethod: MfaMethod | null; startedAt: Date; lastSeenAt: Date; revokedAt: Date | null }
interface NotificationPreference { userId: string; event: NotificationEvent; inApp: boolean; email: boolean; sms: boolean; push: boolean }
interface OnboardingProfile { userId: string; dateOfBirth: string | null; career: CareerRole | null; entity: EntityType | null; recoveryQuestion: RecoveryQuestion | null; declarations: { infoAccurate: boolean; authorisedTesting: boolean; termsAccepted: boolean }; completedAt: Date | null }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema only. (Hashing note: password hashing is owned by Supabase Auth. Recovery codes use SHA-256 of high-entropy random codes; the recovery answer uses a memory-hard hash because it is low-entropy.)

---

**Out of scope:**
- Do not generate or apply migrations.
- Do not store TOTP secrets or passwords (Supabase Auth owns them).
- Do not implement any endpoint or hashing code.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` and `pnpm --filter @vunvault/db test` pass (schema-shape tests import each new table and assert column names, enum values, and RLS enabled).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 20c complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 20d — Contracts C: zero-day, admin dashboard, account security, notifications, onboarding (+ fixtures)

**Layer:** L2

**Prerequisites:** Task 19, Task 20, Task 20b, Task 20c

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Contracts C: zero-day, admin dashboard, account security, notifications, onboarding (+ fixtures)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create Zod schemas, label maps, the new `intel:broadcast` permission, route documentation and fixtures for zero-day advisories, the Command Center dashboard, Password Manager / Profile Settings, notification preferences, and client onboarding.

**Deliverables:**
- MODIFY `packages/contracts/src/permissions.ts` — add `"intel:broadcast"` to `PERMISSIONS`; grant it to `super_admin` and `admin` only (security_analyst keeps `intel:write` but may NOT broadcast).
- `packages/contracts/src/intel.ts` — advisories, NVD import, broadcast, history.
- `packages/contracts/src/dashboard.ts` — Command Center metrics.
- `packages/contracts/src/account.ts` — password change, MFA, recovery codes, sessions, profile settings, notification prefs.
- `packages/contracts/src/onboarding.ts` — 3-step onboarding.
- `packages/contracts/src/studio.ts` — content-studio schemas and helpers.
- `packages/contracts/src/routes-c.ts` — `ROUTES_C` documentation constant.
- `packages/contracts/fixtures/intel.ts`, `fixtures/dashboard.ts`, `fixtures/account.ts` — typed fixtures (below).
- MODIFY `packages/contracts/src/enums.ts` — add Zod enums for every enum added in Tasks 20b/20c (`z.enum(...)` from `@vunvault/db/enum-values`).
- MODIFY `packages/contracts/fixtures/index.ts` and `packages/contracts/src/index.ts` — re-export new modules (not fixtures from `src`).
- `packages/contracts/src/contracts-c.test.ts` — parse tests.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI. All user-facing strings are verbatim product copy for later tasks.

**Label maps (verbatim):**
- `SCOPE_CATEGORY_LABELS`: web_api `"Web & API"`, network_edge `"Network & Edge"`, endpoint_desktop `"Endpoint / Desktop"`, cloud_containers `"Cloud & Containers"`, mobile `"Mobile"`, ot_ics `"OT / ICS"`, identity_sso `"Identity & SSO"`.
- `SEVERITY_CVSS_HINTS`: critical `"CVSS 9.0 – 10.0"`, high `"CVSS 7.0 – 8.9"`, medium `"CVSS 4.0 – 6.9"`, low `"CVSS 0.1 – 3.9"`.
- `PATCH_STATUS_LABELS`: unpatched `"Unpatched"`, patch_in_progress `"Patch in progress"`, patched `"Patched"`.
- `ADVISORY_STATUS_LABELS`: draft `"Draft — Not Published"`, published `"Published"`, retracted `"Retracted"`.
- `BROADCAST_ACK_LABELS` (key → `{ title, description }`): severityCorrect `"Severity level is correct"` / `"The assigned severity matches the CVSS base score and observed exploitation status."`; scopeComplete `"Affected scope is complete"` / `"Every affected product, version range and platform is listed — no over- or under-matching."`; contentSafe `"Content is safe for client distribution"` / `"No unredacted exploit code, internal credentials or third-party confidential data is included."`; remediationActionable `"Remediation guidance is actionable"` / `"Immediate mitigations and the permanent fix are both documented for clients."`; authorised `"I am authorised to issue emergency broadcasts"` / `"This action is recorded against your administrator identity and cannot be revoked."`.
- `BROADCAST_CONFIRM_PHRASE = "BROADCAST"` (case-insensitive match).
- `THREAT_LEVEL_LABELS`: 1 `"Low"`, 2 `"Guarded"`, 3 `"Elevated"`, 4 `"High"`, 5 `"Severe"`. `THREAT_ESCALATION_LEVEL = 4`.
- `NODE_STATUS_LABELS`: operational `"Operational"`, high_load `"High Load"`, drift_warning `"Drift Warning"`, degraded `"Degraded"`, offline `"Offline"`.
- `NOTIFICATION_EVENT_META` (event → `{ group, title, description }`, verbatim): 
  - Security & Access: signin_new_device `"Sign-in from new device"` / `"Alert when a new device or unrecognised IP authenticates to your account."`; credentials_changed `"Password or 2FA changed"` / `"Immediate notification of any credential change on your account."`; failed_auth `"Failed authentication attempts"` / `"Burst of failed sign-ins against your account from any source."`
  - Scan Operations: scan_completed `"Scan completed"` / `"A job assigned to you finishes execution and results are ready."`; job_awaiting_review `"Job awaiting review gate"` / `"A job is blocked on the Mandatory Admin Review Gate and requires your attention."`; critical_finding `"Critical finding detected"` / `"A scan has produced a critical severity finding requiring escalation."`
  - Threat Intelligence: advisory_broadcast `"Zero-day advisory broadcast"` / `"A new emergency advisory has been dispatched to client dashboards."`; threat_level_change `"Threat level change"` / `"Global zero-day threat level moves up or down a step."`
  - Administrative: content_awaiting_moderation `"Content awaiting moderation"` / `"A staff-authored blog post, advisory or product listing is queued for review."`; team_member_provisioned `"New team member provisioned"` / `"An invitation is sent or a new account is created on the platform."`; weekly_digest `"Weekly digest"` / `"A Monday morning summary of scans, releases, threats and audit events."`
- `NOTIFICATION_CHANNEL_LABELS`: in_app `"In-App"`, email `"Email"`, sms `"SMS"`, push `"Push"`.
- `CAREER_LABELS` / `CAREER_DESCRIPTIONS`: student `"Student"` / `"Learning tracks, labs and free certificates."`; business_owner `"Business Owner"` / `"Starter scans and plain-language reporting."`; cybersecurity_professional `"Cybersecurity Professional"` / `"Full-scope pentesting and purple-team work."`; independent_specialist `"Independent Specialist"` / `"Consulting, audits and client engagements."`.
- `ENTITY_LABELS` / `ENTITY_DESCRIPTIONS`: individual `"Individual"` / `"Personal account, personal scope."`; company `"Company"` / `"Registered business or startup."`; corporation `"Corporation"` / `"Enterprise, group or public entity."`.
- `RECOVERY_QUESTION_LABELS` (from Task 20c).
- `TIMEZONES` (value → label): `Africa/Nairobi` `"Africa/Nairobi — EAT (UTC+3)"`, `Africa/Lagos` `"Africa/Lagos — WAT (UTC+1)"`, `Africa/Accra` `"Africa/Accra — GMT (UTC+0)"`, `Africa/Johannesburg` `"Africa/Johannesburg — SAST (UTC+2)"`, `Europe/London` `"Europe/London — GMT/BST"`, `Europe/Berlin` `"Europe/Berlin — CET/CEST"`, `America/New_York` `"America/New_York — ET"`, `Asia/Dubai` `"Asia/Dubai — GST (UTC+4)"`.
- `LANGUAGES`: en-GB `"English (United Kingdom)"`, en-US `"English (United States)"`, sw `"Kiswahili"`, fr `"Français"`.

**Schemas — intel.ts:**
- `AdvisoryScopeEntry = { label: string min 1 max 120, category: ScopeCategory | null }`.
- `AdvisoryDraftBody = { cveId: string regex ^CVE-\d{4}-\d{4,}$ (message "Enter a valid CVE identifier in the format CVE-YYYY-NNNNN."), vendor?: string max 120, cvss?: number 0..10 (one decimal), disclosureDate?: string date, severity?: Severity, weaponized: boolean, publicPoc: boolean, preAuth: boolean, patchAvailable: boolean, title?: string max 140, summary?: string max 1200, remediation?: string max 900, references: string url[] default [], scope: AdvisoryScopeEntry[] max 50 }` (drafts may be incomplete).
- `AdvisoryPublishable = AdvisoryDraftBody` refined: `title` required (message `"An advisory title is required before saving or broadcasting."`), `severity` required, `scope` min 1, `summary` and `remediation` required, and if `cvss` and `severity` are both present they must agree with the CVSS bands.
- `Advisory` (view) = `{ id, cveId, vendor, cvss: number | null, disclosureDate, severity | null, weaponized, publicPoc, preAuth, patchAvailable, title, summary, remediation, references, scope, status, patchStatus, author: { id, label }, lastSavedAt, publishedAt, lastBroadcastAt: IsoDateTime | null, reach: number | null }`.
- `AdvisoryListQuery = PageQuery & { status?: AdvisoryStatus, severity?: Severity }`.
- `AdvisorySummary = { activeZeroDays: number; criticalSeverity: number; unpatchedCritical: number; weaponizedInWild: number; advisoriesPublished: number; broadcastThisMonth: number; openDrafts: number; escalatedDrafts: number; dashboardsReached: number; newClientsThisMonth: number }`.
- `DraftListItem = { id, cveId, title: string | null, authorLabel: string, lastSavedAt: IsoDateTime, note: "Unsaved changes" | "Awaiting reviewer" | "Needs scope entries" | null }` (note is computed by the API).
- `NvdImportQuery = { cveId: string regex }`; `NvdImportResult = { cveId, vendor: string | null, cvss: number | null, severity: Severity | null, disclosureDate: string | null, title: string | null, summary: string | null, references: string[] }`.
- `BroadcastEstimate = { dashboards: number; emailContacts: number; smsContacts: number; incidentCommanders: number }`.
- `EmergencyBroadcastBody = { ack: Record<keyof BROADCAST_ACK_LABELS, boolean>, confirmPhrase: string }` with `.superRefine`: all five `ack` values true (path `["ack"]`, message `"Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button."`) and `confirmPhrase.trim().toUpperCase() === "BROADCAST"` (path `["confirmPhrase"]`).
- `RetractBody = { note: string min 10 max 500 }`; `PatchStatusBody = { patchStatus: PatchStatus }`.
- `BroadcastRecord = { id, advisoryId, kind: "initial"|"rebroadcast"|"retraction", status: BroadcastStatus, triggeredByLabel: string, audienceDashboards, emailContacts, smsContacts, sentDashboards, sentEmail, sentSms, failed, createdAt, finishedAt: IsoDateTime | null }`.
- `ClientAdvisory = { id, cveId, title, severity, scope: AdvisoryScopeEntry[], summary, remediation, references, patchStatus, publishedAt, source: z.literal("VUNVAULT Intelligence"), acknowledged: boolean }` (what the client dashboard shows).

**Schemas — dashboard.ts:**
- `DashboardKpis = { totalPaidClients: number; newPaidClientsThisMonth: number; totalRevenueUsdCents: number; revenueChangeVsLastQuarterPercent: number; completedJobs: number; closedThisWeek: number; pendingReview: number; activeRunningScans: number; workerSlotsUsed: number; workerSlotsTotal: number; criticalCvesTracked: number; unpatchedCritical: number }`.
- `RevenueSummary = { grossRevenueYtdUsdCents: number; revenueThisMonthUsdCents: number; periodLabel: string; paidClients: { sme: number; sacco: number; enterprise: number }; averageOrderValueUsdCents: number; tiers: { code: string; name: string; unitLabel: string; sharePercent: number }[] }`.
- `RecentTransaction = { txnCode: string regex ^VX-\d+$, occurredAt: IsoDateTime, client: string, package: string, method: "mpesa"|"card"|"bank_transfer", amountUsdCents: UsdCents, status: "settled"|"pending"|"refunded" }`; `TransactionsResponse = { data: RecentTransaction[]; totals: { totalUsdCents: number; settled: number; pending: number; refunded: number } }`.
- `TrafficSummary = { siteSessions: number; sessionsChangePercent: number; apiRequests: number; endpointCount: number; avgResponseMs: number; p95ResponseMs: number; hourly: { hourUtc: number; apiRequestsMillions: number }[] }`.
- `EndpointStat = { endpoint: string, requests: number, avgLatencyMs: number, errorRatio: number }`.
- `NodeView = { code, label, country, status: NodeStatus, reqPerMin, loadPercent, heartbeatLatencyMs: number | null, clockDriftMs: number | null }`; `NodesResponse = { data: NodeView[]; online: number; total: number }`.
- `PipelineSummary = { pendingJobs: number; unreviewedJobs: number; running: number; workerSlotsUsed: number; workerSlotsTotal: number; distribution: { completed: number; pending: number; unreviewed: number; running: number }; closedLast7Days: number }`.
- `RunningScan = { jobCode, target, scanType, analystLabel: string, progress: number, etaSeconds: number | null }`; `RunningScansResponse = { data: RunningScan[]; shown: number; total: number }`.
- `ThreatLevel = { level: 1..5, label: string, activeZeroDays: number, criticalCves: number, unpatchedCritical: number, weaponizedInWild: number, threatsBlockedYtd: number, blockedLast7Days: { day: "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun", count: number }[], recalculatedAt: IsoDateTime }`.
- `NodeHeartbeatBody = { nodeCode: string, sentAt: IsoDateTime, reqPerMin: number, loadPercent: 0..100, clockDriftMs: number, signature: string }`.

**Schemas — account.ts:**
- `ChangePasswordBody = { currentPassword: string, newPassword: string, confirmPassword: string }` — `newPassword` rules: min 12 chars (the API raises the minimum to 14 for staff roles), at least one uppercase, one lowercase, one digit, one symbol; `.refine` newPassword ≠ currentPassword; `.refine` confirm match (message `"Both entries must match exactly."`). Export `PASSWORD_RULES = [ { id: "len", label: "At least 12 characters" }, { id: "upper", label: "One uppercase letter" }, { id: "lower", label: "One lowercase letter" }, { id: "digit", label: "One number" }, { id: "symbol", label: "One symbol (!@#$…)" } ]` and `scorePassword(pw): { score: 0..4; label: "Awaiting input" | "Weak" | "Fair" | "Good" | "Strong" }`.
- `TotpEnrollStart = { data: { factorId: string; qrCodeSvg: string; secret: string (base32); uri: string } }`; `TotpVerifyBody = { factorId: string, code: string 6 digits }`.
- `WebauthnRegisterOptionsResponse`, `WebauthnRegisterVerifyBody = { deviceName?: string, credential: unknown }`, `WebauthnKey = { id, deviceName: string | null, createdAt, lastUsedAt: IsoDateTime | null }`.
- `RecoveryCodeBody = { code: string regex ^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$ }`; `RecoveryCodesResponse = { data: { codes: string[] (10); batchId: Uuid; generatedAt: IsoDateTime } }`; `RecoveryCodesStatus = { generated: boolean; remaining: number; total: 10; generatedAt: IsoDateTime | null }`.
- `MfaStatus = { totp: { enabled: boolean; factorId: string | null }, webauthn: { keys: WebauthnKey[] }, recovery: RecoveryCodesStatus, require2fa: boolean, lastFactorChangeAt: IsoDateTime | null }`.
- `SessionView = { id, deviceLabel, ip: string | null, location: string | null, mfaMethod: MfaMethod | null, startedAt: IsoDateTime, current: boolean }`; `SessionsResponse = { data: SessionView[] }`.
- `ProfileSettings = { id, firstName, lastName, displayName, jobTitle: string | null, email, phone: string | null, timezone, language, bio: string | null max 400, avatarUrl: string | null, role, team: Team | null, memberSince: IsoDateTime, username: string, mfaSummary: string, lastSignInAt: IsoDateTime | null, activeSessions: number, require2fa: boolean }`.
- `UpdateProfileSettingsBody = { firstName: string min 1, lastName: string min 1, displayName: string min 2, jobTitle?: string, phone?: string, timezone: key of TIMEZONES, language: key of LANGUAGES, bio?: string max 400 }` (email is read-only here).
- `AvatarUploadRequest = { contentType: "image/png"|"image/jpeg"|"image/webp"|"image/svg+xml", sizeBytes: number max 4_194_304 }`; `AvatarUploadResponse = { data: { uploadUrl: string; objectKey: string; expiresAt: IsoDateTime } }`; `AvatarConfirmBody = { objectKey: string }`.
- `SecurityPosture = { score: number 0..100, label: "Strong posture" | "Fair posture" | "Weak posture", completed: number, total: number, items: { id: string, label: string, done: boolean }[] }` (items verbatim: `"Hardware-key MFA registered"`, `"Recovery codes generated"`, `"Password updated within 90 days"`, `"Register a backup hardware key"`).
- `NotificationPrefs = { events: Record<NotificationEvent, { inApp: boolean; email: boolean; sms: boolean; push: boolean }>, quietHours: { enabled: boolean; from: string "HH:MM" | null; to: string "HH:MM" | null } }`; `UpdateNotificationPrefsBody = NotificationPrefs`.
- `DeactivationRequestBody = { reason: string min 10 max 500 }`.

**Schemas — content studio (put in `content.ts`? NO — add to a NEW file `packages/contracts/src/studio.ts` and list it in Deliverables below):**
- `BLOG_CATEGORY_LABELS`: news `"News"`, threat_intel `"Threat Intel"`, blog `"Blog"`, industry_updates `"Industry Updates"`, tutorials `"Tutorials"`. `STUDIO_TAG_SUGGESTIONS = ["#security","#threatintel","#fintech","#africa","#compliance","#research"]`. `STUDIO_LIMITS = { title: 120, excerpt: 240, tags: 8, minWords: 150, imageMaxBytes: 5_242_880 }`.
- `StudioDraftBody = { title?: string max 120, slug?: string regex ^[a-z0-9]+(?:-[a-z0-9]+)*$, category?: BlogCategory, excerpt?: string max 240, bodyMd?: string, tags: string[] max 8 (each regex ^#?[a-z0-9-]{2,30}$, stored lower-cased without #), featuredImageUrl?: string url, imageAlt?: string max 160 }`.
- `StudioSubmitReadiness = { title: boolean; category: boolean; bodyWords: boolean; excerpt: boolean; featuredImage: boolean; tags: boolean }` (first three REQUIRED, last three optional; copy verbatim: `"Title added"`, `"Category selected"`, `"Body ≥ 150 words"`, `"Excerpt written"`, `"Featured image attached"`, `"At least 2 tags"`).
- `StudioItem = { id, title: string | null, slugPath: string | null, category: BlogCategory | null, excerpt, bodyMd, tags: string[], featuredImageUrl, imageAlt, status: ContentStatus, readiness: StudioSubmitReadiness, readMinutes: number | null, updatedAt: IsoDateTime, reviewerNote: string | null }`.
- `StudioStatus = { verified: boolean; verifiedAt: IsoDateTime | null; displayName: string }`.
- `StudioImageUploadRequest = { contentType: "image/jpeg"|"image/png"|"image/webp"|"image/gif", sizeBytes: number max 5_242_880 }`; response `{ data: { uploadUrl, objectKey, publicUrl, expiresAt } }`.
- `countWords(md)` and `readMinutes(md)` (200 wpm, min 1) pure helpers exported with tests.

**Schemas — onboarding.ts:**
- `OnboardingStep1 = { fullName: string min 2, dateOfBirth: string date (must be ≥ 16 years ago; message "You must be at least 16 years old."), phone?: string (E.164), email: string email, emailConfirm: string email }` + `.refine` emails equal (path `emailConfirm`, message `"Email addresses must match."`).
- `OnboardingStep2 = { career: CareerRole, entity: EntityType }`.
- `OnboardingStep3 = { recoveryQuestion: RecoveryQuestion, recoveryAnswer: string min 3, declarations: { infoAccurate: literal true, authorisedTesting: literal true, termsAccepted: literal true } }`.
- `OnboardingSubmitBody = { step1: OnboardingStep1, step2: OnboardingStep2, step3: OnboardingStep3 }`; `OnboardingStatus = { completed: boolean, completedAt: IsoDateTime | null }`.

**Fixtures:**
- `fixtures/intel.ts` — `advisories` from this table (summary/remediation: fixture-only one-liners), plus `advisorySummary = { activeZeroDays: 1284, criticalSeverity: 46, unpatchedCritical: 9, weaponizedInWild: 37, advisoriesPublished: 418, broadcastThisMonth: 12, openDrafts: 7, escalatedDrafts: 3, dashboardsReached: 312, newClientsThisMonth: 18 }`, `broadcastEstimate = { dashboards: 312, emailContacts: 486, smsContacts: 74, incidentCommanders: 1 }`, and three `drafts`: `CVE-2026-40118` "Kubernetes ingress-nginx — admission webhook bypass" (e.reed, note `"Unsaved changes"`), `CVE-2026-39980` "PostgreSQL — privilege escalation via extension loading" (f.hassan, `"Awaiting reviewer"`), `CVE-2026-38771` "Redis — ACL bypass in sentinel failover path" (d.mwangi, `"Needs scope entries"`):

| cveId | title | scope | severity | broadcastedAt (2026-09-24 UTC) | reach | patchStatus |
|---|---|---|---|---|---|---|
| CVE-2026-21447 | Apache Struts 2 — OGNL injection RCE | Web & API · Struts 2.0.0 – 2.5.32 | critical | 14:36 | 312 | unpatched |
| CVE-2026-0091 | Cisco IOS XE — Web UI authentication bypass | Network & Edge · IOS XE 17.x | critical | 14:35 | 284 | patch_in_progress |
| CVE-2026-3327 | Oracle WebLogic — deserialization RCE | Web & API · WebLogic 12.2.1.x | high | 14:32 | 196 | unpatched |
| CVE-2026-18820 | Windows Print Spooler — privilege escalation | Endpoint / Desktop · Windows 10 / 11 | high | 14:28 | 298 | patched |
| CVE-2025-53112 | Google Chrome V8 — type confusion in JIT | Endpoint / Desktop · Chrome < 128.0.6 | critical | 14:25 | 305 | patched |
| CVE-2026-1104 | Linux Kernel io_uring — use-after-free | OT / ICS · Kernel 6.4 – 6.9 | high | 14:21 | 152 | patched |

- `fixtures/dashboard.ts` — `dashboardKpis = { totalPaidClients: 312, newPaidClientsThisMonth: 18, totalRevenueUsdCents: 18472000, revenueChangeVsLastQuarterPercent: 12.4, completedJobs: 1842, closedThisWeek: 96, pendingReview: 37, activeRunningScans: 12, workerSlotsUsed: 12, workerSlotsTotal: 24, criticalCvesTracked: 46, unpatchedCritical: 9 }`; `revenueSummary = { revenueThisMonthUsdCents: 2245000, periodLabel: "01 – 24 Sep 2026", paidClients: { sme: 284, sacco: 22, enterprise: 6 }, averageOrderValueUsdCents: 59200, tiers: [ { code: "starter_scan", name: "Starter Scan", unitLabel: "$299 / scan", sharePercent: 41 }, { code: "sacco_fintech_compliance", name: "SACCO & Fintech", unitLabel: "$899 / assessment", sharePercent: 34 }, { code: "enterprise_retainer", name: "Enterprise Retainer", unitLabel: "$2,499 / month", sharePercent: 25 } ] }` (fixture-only `grossRevenueYtdUsdCents` chosen = 18472000); `trafficSummary = { siteSessions: 48392, sessionsChangePercent: 6.2, apiRequests: 2140000, endpointCount: 41, avgResponseMs: 142, p95ResponseMs: 384, hourly: [{0,0.31},{4,0.22},{8,0.29},{12,0.27},{16,0.24},{20,0.21},{24,0.30}] (hourUtc, apiRequestsMillions) }`; `endpointStats` = `/api/v1/scan/submit` 412880 168 ms 0.21 % · `/api/v1/auth/token` 388214 92 ms 0.08 % · `/api/v1/report/export` 121540 431 ms 0.64 % · `/api/v1/cve/feed` 96772 74 ms 0.02 % · `/api/v1/nodes/heartbeat` 84318 41 ms 0.01 % · `/admin (dashboard)` 51204 210 ms 0.33 %; `nodes` = node-nbo-01 Nairobi Core Kenya 41200 req/min 62 % hb 18 ms drift 2 ms operational · node-nbo-02 Nairobi Edge Kenya 28940 48 % 24 ms 3 ms operational · node-acc-01 Accra Relay Ghana 36410 88 % 142 ms 11 ms high_load · node-lag-01 Lagos Relay Nigeria 31880 55 % 96 ms 5 ms operational · node-jnb-01 Johannesburg Vault South Africa 19220 33 % 112 ms 4 ms operational · node-fra-01 Frankfurt Mirror Germany 44600 79 % 38 ms 19 ms drift_warning (`online: 412, total: 412`); `pipelineSummary = { pendingJobs: 96, unreviewedJobs: 37, running: 12, workerSlotsUsed: 12, workerSlotsTotal: 24, distribution: { completed: 1842, pending: 96, unreviewed: 37, running: 12 }, closedLast7Days: 96 }`; `runningScans` = JOB-4471 api.horizonsacco.co.ke External e.reed 78 % 252 s · JOB-4470 pay.nairobifintech.com API a.njoroge 64 % 458 s · JOB-4469 vault.lakeviewlogistics.com Internal d.mwangi 41 % 785 s · JOB-4468 10.24.8.0/24 Network b.otieno 89 % 107 s · JOB-4467 mobile.mwananchi.co.ke Mobile f.hassan 22 % 1110 s (`shown: 5, total: 12`); `threatLevel = { level: 4, label: "High", activeZeroDays: 1284, criticalCves: 46, unpatchedCritical: 9, weaponizedInWild: 37, threatsBlockedYtd: 12904, blockedLast7Days: Mon 1640, Tue 1982, Wed 1410, Thu 2240, Fri 1880, Sat 1502, Sun 2250 }`; `recentTransactions`: `VX-90241` Horizon SACCO Enterprise Retainer mpesa $2,499 settled (24 Sep 09:14) · `VX-90240` Nairobi Fintech Group SACCO & Fintech Compliance card $899 settled (24 Sep 08:02) · `VX-90239` Kijani Agri Co-op Starter Scan card $299 settled (23 Sep 17:41) · `VX-90238` Lakeview Logistics (fixture-only package) bank_transfer pending (23 Sep 14:20) · `VX-90237` Mwananchi Microfinance (fixture-only) settled (23 Sep 11:05) · `VX-90236` TechBridge Solutions (fixture-only) refunded (22 Sep 19:33).
- `fixtures/account.ts` — `sessions` = `MacBook Pro · Safari` Nairobi KE 196.201.214.77 (current, started 09:41 UTC) · `iPhone 15 Pro · Safari` Nairobi KE 196.201.214.82 totp 07:12 UTC · `ThinkPad X1 · Chrome` Frankfurt DE 185.220.101.9 (yesterday 21:04); `mfaStatus = { totp: { enabled: true }, webauthn: { keys: [{ deviceName: "YubiKey 5C NFC", createdAt: "2026-08-12" }] }, recovery: { generated: true, remaining: 3, total: 10 }, require2fa: true, lastFactorChangeAt: "2026-08-12T00:00:00Z" }`; `securityPosture = { score: 80, label: "Strong posture", completed: 3, total: 4, items: [ {"Hardware-key MFA registered", true}, {"Recovery codes generated", true}, {"Password updated within 90 days", true}, {"Register a backup hardware key", false} ] }`; `profileSettings` for Dr. Evelyn Reed (firstName `"Evelyn"`, lastName `"Reed"`, displayName `"e.reed"`, email `"e.reed@vunvault.com"`, role `super_admin`, memberSince Mar 2024, timezone `Africa/Nairobi`, language `en-GB`, bio `"Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate."`, `username: "e.reed"`, `mfaSummary: "Hardware key"`, `activeSessions: 3`); `notificationPrefs` with every event at the planner defaults and quiet hours disabled.

---

**Data shape (TypeScript):**
```ts
// All types inferred: export type X = z.infer<typeof X>;
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Document these in routes-c.ts (method, path, request schema, response schema, permission). Do NOT implement.
// ZERO-DAY (permission intel:read for GET, intel:write for drafts, intel:broadcast for broadcast/retract/rebroadcast)
// GET    /api/v1/admin/advisories                 query AdvisoryListQuery           → 200 { data: Advisory[]; total }
// GET    /api/v1/admin/advisories/summary                                           → 200 { data: AdvisorySummary }
// GET    /api/v1/admin/advisories/drafts                                            → 200 { data: DraftListItem[]; total }
// GET    /api/v1/admin/advisories/nvd             query NvdImportQuery              → 200 { data: NvdImportResult } | 404 not_found | 502 { error: "nvd_unavailable" }
// POST   /api/v1/admin/advisories                 body AdvisoryDraftBody            → 201 { data: Advisory } | 409 { error: "cve_exists" }
// PUT    /api/v1/admin/advisories/:id             body AdvisoryDraftBody            → 200 { data: Advisory } | 409 { error: "not_editable" }
// POST   /api/v1/admin/advisories/:id/estimate                                      → 200 { data: BroadcastEstimate }
// POST   /api/v1/admin/advisories/:id/broadcast   body EmergencyBroadcastBody       → 202 { data: BroadcastRecord } | 400 validation_failed | 422 { error: "advisory_incomplete" }
// POST   /api/v1/admin/advisories/:id/rebroadcast body EmergencyBroadcastBody       → 202 { data: BroadcastRecord }
// POST   /api/v1/admin/advisories/:id/retract     body RetractBody                  → 200 { data: Advisory }
// PATCH  /api/v1/admin/advisories/:id/patch-status body PatchStatusBody             → 200 { data: Advisory }
// GET    /api/v1/admin/advisories/:id/broadcasts                                    → 200 { data: BroadcastRecord[] }
// GET    /api/v1/advisories                       (client portal; published only)   → 200 { data: ClientAdvisory[]; total }
// POST   /api/v1/advisories/:id/acknowledge                                         → 204
// DASHBOARD (permission dashboard:read)
// GET /api/v1/admin/dashboard/kpis → { data: DashboardKpis } · /revenue → { data: RevenueSummary } · /transactions?limit=6 → TransactionsResponse
// GET /api/v1/admin/dashboard/traffic → { data: TrafficSummary } · /endpoints → { data: EndpointStat[] } · /nodes → NodesResponse
// GET /api/v1/admin/dashboard/pipeline → { data: PipelineSummary } · /running-scans?limit=5 → RunningScansResponse · /threat-level → { data: ThreatLevel }
// POST /api/v1/nodes/heartbeat  body NodeHeartbeatBody (Ed25519-signed; no session)  → 204 | 401 { error: "bad_signature" }
// ACCOUNT SECURITY (any authenticated user; acts only on self)
// POST   /api/v1/account/password                  body ChangePasswordBody          → 204 | 400 validation_failed | 401 { error: "invalid_credentials" } | 422 { error: "breached_password" }
// GET    /api/v1/account/security                                                    → 200 { data: MfaStatus & { posture: SecurityPosture } }
// POST   /api/v1/account/mfa/totp/enroll                                             → 201 TotpEnrollStart
// POST   /api/v1/account/mfa/totp/verify          body TotpVerifyBody                → 204 | 401 { error: "mfa_failed" }
// DELETE /api/v1/account/mfa/totp                                                    → 204
// POST   /api/v1/account/mfa/webauthn/register/options                               → 200 { data: unknown }
// POST   /api/v1/account/mfa/webauthn/register/verify body WebauthnRegisterVerifyBody → 201 { data: WebauthnKey }
// DELETE /api/v1/account/mfa/webauthn/:id                                            → 204
// POST   /api/v1/account/recovery-codes                                              → 201 RecoveryCodesResponse
// POST   /api/v1/account/recovery-codes/regenerate                                   → 201 RecoveryCodesResponse
// POST   /api/v1/auth/mfa/recovery                body RecoveryCodeBody              → 200 { data: SessionUser } | 401 { error: "mfa_failed" }
// GET    /api/v1/account/sessions                                                    → 200 SessionsResponse
// DELETE /api/v1/account/sessions/:id                                                → 204
// POST   /api/v1/account/sessions/revoke-others                                      → 200 { data: { revoked: number } }
// GET    /api/v1/account/settings                                                    → 200 { data: ProfileSettings }
// PATCH  /api/v1/account/settings                 body UpdateProfileSettingsBody     → 200 { data: ProfileSettings }
// POST   /api/v1/account/avatar/upload-url        body AvatarUploadRequest           → 200 AvatarUploadResponse
// POST   /api/v1/account/avatar/confirm           body AvatarConfirmBody             → 200 { data: ProfileSettings }
// DELETE /api/v1/account/avatar                                                      → 204
// GET    /api/v1/account/notifications                                               → 200 { data: NotificationPrefs }
// PUT    /api/v1/account/notifications            body UpdateNotificationPrefsBody   → 200 { data: NotificationPrefs }
// POST   /api/v1/account/deactivation-request     body DeactivationRequestBody       → 202
// CONTENT STUDIO (verified bloggers and staff with content:author)
// GET    /api/v1/studio/status                                                       → 200 { data: StudioStatus }
// GET    /api/v1/studio/submissions                                                  → 200 { data: StudioItem[]; total }
// POST   /api/v1/studio/drafts                    body StudioDraftBody               → 201 { data: StudioItem }
// PUT    /api/v1/studio/drafts/:id                body StudioDraftBody               → 200 { data: StudioItem } | 409 { error: "not_editable" }
// DELETE /api/v1/studio/drafts/:id                                                   → 204
// POST   /api/v1/studio/drafts/:id/submit                                            → 200 { data: StudioItem } | 422 { error: "not_ready"; details: StudioSubmitReadiness }
// POST   /api/v1/studio/images/upload-url         body StudioImageUploadRequest      → 200 StudioImageUploadResponse
// ONBOARDING
// GET    /api/v1/onboarding                                                          → 200 { data: OnboardingStatus }
// POST   /api/v1/onboarding                       body OnboardingSubmitBody          → 201 { data: OnboardingStatus } | 400 validation_failed
```

---

**Out of scope:**
- Do not implement endpoints or MSW handlers.
- Do not import `drizzle-orm` in this package.
- Do not edit Task 19/20 files except the two index re-exports, `enums.ts`, and the one `permissions.ts` change named in Deliverables.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/contracts typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts lint` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts test` passes: every new schema has a parse-success test using its fixture and at least one parse-failure test.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Test: `EmergencyBroadcastBody` fails when any ack is false, and fails when `confirmPhrase` is `"broadcast now"`; passes for `"broadcast"` with all five true.
☐ Test: `AdvisoryPublishable` fails with no title and passes a fully-populated fixture; `severity: "low"` with `cvss: 9.5` fails.
☐ Test: `ROLE_PERMISSIONS.security_analyst` does NOT include `intel:broadcast`; `admin` and `super_admin` do.
☐ Report at the end: `Task 20d complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 21 — API bootstrap: config, app factory, error model, health, OpenAPI

**Layer:** L3

**Prerequisites:** Task 3, Task 4, Task 7, Task 19, Task 20

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **API bootstrap: config, app factory, error model, health, OpenAPI**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the Fastify 5 application skeleton in `apps/api`: validated environment config, `buildApp()` factory, request context, the error model, health endpoints, and Zod→OpenAPI 3.1 generation.

**Deliverables:**
- MODIFY `apps/api/package.json` — add scripts `dev` (`tsx watch --env-file=.env src/server.ts`), `build` (`tsc -p tsconfig.build.json`), `start` (`node dist/server.js`); add dependencies.
- `apps/api/tsconfig.build.json` — extends `./tsconfig.json`, `noEmit: false`, `outDir: dist`, `include: ["src"]`, excludes `**/*.test.ts`.
- `apps/api/src/config/env.ts` — Zod-validated env (below); exports `loadEnv()` and `type Env`.
- `apps/api/src/lib/http-error.ts` — `HttpError` class.
- `apps/api/src/app.ts` — `buildApp(opts?: { env?: Partial<Env>; overrides?: object })` returns a configured Fastify instance WITHOUT listening.
- `apps/api/src/server.ts` — loads env, calls `buildApp`, listens on `0.0.0.0:$PORT`, handles `SIGTERM`/`SIGINT` with graceful close (10 s timeout).
- `apps/api/src/plugins/error-handler.ts` — global error + not-found handlers.
- `apps/api/src/plugins/request-context.ts` — request id + logger binding.
- `apps/api/src/plugins/openapi.ts` — swagger registration.
- `apps/api/src/routes/health.ts` — `/healthz`, `/readyz`.
- `apps/api/src/routes/v1/index.ts` — empty aggregator plugin that later tasks extend by adding one `register` line each.
- `apps/api/src/types/fastify.d.ts` — module augmentation file (empty interface stubs later tasks extend).
- `apps/api/src/app.test.ts` — tests (below).
- `apps/api/.env.example` — copy of the `api` section of the root `.env.example` plus `PORT`, `NODE_ENV`, `LOG_LEVEL`, `WEB_ORIGIN`, `COOKIE_DOMAIN`, `SECRETS_PROVIDER`.

**Dependencies allowed:**
- `fastify`, `fastify-plugin`, `fastify-type-provider-zod`, `@fastify/swagger`, `@fastify/swagger-ui`, `zod` (catalog).
- `tsx` (dev).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**`env.ts` (Zod; coerce numbers; fail fast with a readable error listing every bad variable):**
- `NODE_ENV: "development" | "test" | "production"` (default `development`); `PORT` default 8080; `LOG_LEVEL: "fatal"|"error"|"warn"|"info"|"debug"|"trace"` default `info`.
- `WEB_ORIGIN: url` (exact origin of the web app, e.g. `https://www.vunvault.com`); `COOKIE_DOMAIN: string` (e.g. `.vunvault.com`; empty allowed in development); `API_PUBLIC_URL: url`.
- `SECRETS_PROVIDER: "env" | "oci-vault"` default `env` (production MUST be `oci-vault` — add a refine that rejects `env` when `NODE_ENV === "production"`).
- Non-secret config: `SUPABASE_URL: url`, `SENTRY_DSN: url optional`, `OCI_SECRET_MAP: string optional` (JSON name→secret OCID).
- Secret names are NOT read here when `SECRETS_PROVIDER=oci-vault`; they are fetched by the secrets provider in Task 22.

**`HttpError`:** `class HttpError extends Error { constructor(public status: number, public code: string, message?: string, public details?: unknown[]) }`; helpers `HttpError.unauthorized()`, `.forbidden(code?)`, `.notFound()`, `.conflict(code)`, `.badRequest(code, details)`.

**Error handler mapping (exact):**
- Zod validation failure from the type provider (`hasZodFastifySchemaValidationErrors`) → `400 { error: "validation_failed", details: <ZodIssue[]> }`.
- `HttpError` → its status/code; message omitted when status ≥ 500.
- Fastify rate-limit error (statusCode 429) → `429 { error: "rate_limited" }` + `Retry-After` header preserved.
- Not found → `404 { error: "not_found" }`.
- Anything else → log at `error` with request id, respond `500 { error: "internal_error" }`. NEVER include stack traces, SQL, or secrets in a response.
- Every response carries `x-request-id`.

**Request context:** read inbound `x-request-id` if it matches `^[A-Za-z0-9-]{8,64}$` else generate a UUID; set it on the request, logger bindings (`reqId`), and the response header. Pino redaction paths: `req.headers.cookie`, `req.headers.authorization`, `req.headers["x-csrf-token"]`, `res.headers["set-cookie"]`.

**Health:** `GET /healthz` → `200 { status: "ok" }` (no dependency checks). `GET /readyz` → runs registered readiness checks (`app.readiness: Map<string, () => Promise<void>>`, empty now) with a 2 s timeout each → `200 { status: "ready", checks: { <name>: "ok" } }` or `503 { status: "not_ready", checks: { <name>: "fail" } }`. Both routes are excluded from OpenAPI and rate limits.

**OpenAPI:** register `@fastify/swagger` with `openapi: { openapi: "3.1.0", info: { title: "VUNVAULT API", version: "1.0.0" }, servers: [{ url: env.API_PUBLIC_URL }] }` and `transform: jsonSchemaTransform` from `fastify-type-provider-zod`; add `security` scheme `cookieAuth` (apiKey in cookie `vv_at`) and a `csrf` header scheme `x-csrf-token`. Serve `GET /openapi.json` always; serve Swagger UI at `/docs` ONLY when `NODE_ENV !== "production"`.

**`buildApp`:** `Fastify({ logger, genReqId, trustProxy: true, bodyLimit: 1_048_576 })`; set `validatorCompiler`/`serializerCompiler` from `fastify-type-provider-zod`; register request-context, error-handler, openapi, health; register `routes/v1` under prefix `/api/v1`. Decorate `app.env`.

**Tests (assert):** `/healthz` 200; unknown route 404 envelope; a test-only route that throws `new Error("boom")` yields `500 { error: "internal_error" }` with no stack text; a test-only route with a Zod body returns `400 validation_failed` with `details`; `x-request-id` echoed when valid and regenerated when malformed; `/openapi.json` reports `openapi: "3.1.0"`; env refine rejects `SECRETS_PROVIDER=env` in production.

---

**Data shape (TypeScript):**
```ts
class HttpError extends Error { status: number; code: string; details?: unknown[] }
interface ErrorEnvelope { error: string; message?: string; details?: unknown[] }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /healthz → 200 { status: "ok" }
// GET /readyz  → 200 { status: "ready"; checks: Record<string,"ok"> } | 503 { status: "not_ready"; checks: Record<string,"fail"|"ok"> }
// GET /openapi.json → 200 OpenAPI 3.1 document
// All other errors: { error: string; message?: string; details?: unknown[] } with codes validation_failed(400) unauthorized(401) forbidden(403) not_found(404) rate_limited(429) internal_error(500)
```

---

**Out of scope:**
- Do not add database, Redis, auth, CORS, or rate-limit plugins (Tasks 22–24).
- Do not implement any domain route.
- Do not create Dockerfiles or CI.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 21 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 22 — API infrastructure plugins: secrets (OCI Vault), database, Redis, queues, email/SMS providers

**Layer:** L3

**Prerequisites:** Task 21, Task 14, Task 20d

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **API infrastructure plugins: secrets (OCI Vault), database, Redis, queues, email/SMS providers**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the infrastructure plugins every domain module relies on: a secrets provider (env for dev, OCI Vault in production), the Drizzle database plugin over Supavisor, the Redis plugin, BullMQ queue registry with typed job payloads, and fetch-based Resend / Africa's Talking / Twilio providers.

**Deliverables:**
- `apps/api/src/plugins/secrets.ts` — decorates `app.secrets: SecretProvider`.
- `apps/api/src/lib/secrets/provider.ts` — `SecretProvider` interface, `EnvSecretProvider`, `OciVaultSecretProvider`, `SECRET_NAMES`.
- `apps/api/src/plugins/db.ts` — decorates `app.db` and `app.withTx`.
- `apps/api/src/plugins/redis.ts` — decorates `app.redis` and `app.createRedis()`.
- `apps/api/src/queues/index.ts` — queue registry plugin: `app.queues`.
- `packages/contracts/src/queues.ts` — job payload Zod schemas + queue names (shared with the workers).
- MODIFY `packages/contracts/src/index.ts` — `export * from "./queues";`.
- `apps/api/src/providers/email.ts` — `EmailProvider`, `ResendEmailProvider`.
- `apps/api/src/providers/sms.ts` — `SmsProvider`, `AfricasTalkingSmsProvider`, `TwilioSmsProvider`, `SmsRouter`.
- `apps/api/src/plugins/providers.ts` — decorates `app.email`, `app.sms`.
- MODIFY `apps/api/src/types/fastify.d.ts` — add the decorations.
- MODIFY `apps/api/src/app.ts` — register the new plugins in order: secrets → db → redis → queues → providers; add readiness checks `db` (`select 1`) and `redis` (`PING`).
- `apps/api/src/plugins/infra.test.ts` — tests.
- `apps/api/src/providers/providers.test.ts` — tests with stubbed `fetch`.
- MODIFY `.env.example` (repo root) — add exactly two lines: `AUDIT_AES_KEY=` and `NVD_API_KEY=`.
- MODIFY `apps/api/package.json` — add dependencies.

**Dependencies allowed:**
- `ioredis`, `bullmq`, `oci-common`, `oci-secrets`, `drizzle-orm` and `postgres` (via `@vunvault/db`; do not re-install).
- Nothing else. Email/SMS providers use the global `fetch`, not vendor SDKs.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Secret names (`SECRET_NAMES`, exact):** `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `UPSTASH_REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `AUDIT_HMAC_KEY`, `AUDIT_AES_KEY`, `NVD_API_KEY`.
- `SecretProvider.get(name): Promise<string>`; throws `Error("secret <name> missing")` if absent.
- `EnvSecretProvider` reads `process.env[name]` (development/test only).
- `OciVaultSecretProvider`: authenticates with the instance/resource principal (`oci-common` `ResourcePrincipalAuthenticationDetailsProvider` when `OCI_RESOURCE_PRINCIPAL_VERSION` is set, else `InstancePrincipalsAuthenticationDetailsProviderBuilder`); resolves the secret OCID from `OCI_SECRET_MAP` (JSON `{ "<name>": "<ocid>" }`); fetches the CURRENT secret bundle; base64-decodes the content; caches 5 minutes; never logs values. Secrets are NEVER written into `process.env`.
- Add a unit test with a fake OCI client proving cache hit within 5 min and refetch after.

**DB plugin:** `createDb(await app.secrets.get("DATABASE_URL"))` (Supavisor transaction pooler, port 6543, `prepare: false` — already handled by `@vunvault/db`). `app.withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T>` wraps `db.transaction`. Close on `onClose`.

**Redis plugin:** `new Redis(await app.secrets.get("UPSTASH_REDIS_URL"), { maxRetriesPerRequest: null, enableReadyCheck: false, tls: {} })` (Upstash requires TLS and BullMQ requires `maxRetriesPerRequest: null`). `app.createRedis()` returns a NEW connection (needed for pub/sub subscribers, which cannot share a command connection). Close all on `onClose`.

**Queue registry (`app.queues`):** BullMQ `Queue` instances named exactly: `scan`, `broadcast`, `maintenance`, `pdf`, `notify`. Default job options: `attempts: 3`, `backoff: { type: "exponential", delay: 5000 }`, `removeOnComplete: { age: 86400, count: 1000 }`, `removeOnFail: { age: 604800 }`. The `scan` queue overrides `attempts: 1` (a scan is never auto-retried).

**`packages/contracts/src/queues.ts` (exact exports):**
```ts
export const QUEUE_NAMES = { scan: "scan", broadcast: "broadcast", maintenance: "maintenance", pdf: "pdf", notify: "notify" } as const;
export const ScanJobPayload = z.object({ jobId: z.string().uuid(), attempt: z.number().int().min(1), targetHost: z.string(), scanType: ScanType, requestedBy: z.string().uuid().nullable() });
export const BroadcastJobPayload = z.object({ broadcastId: z.string().uuid(), advisoryId: z.string().uuid(), kind: z.enum(["initial","rebroadcast","retraction"]) });
export const PdfJobPayload = z.object({ kind: z.enum(["invoice","report"]), refId: z.string().uuid() });
export const NotifyJobPayload = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), to: z.string().email(), template: z.string(), vars: z.record(z.string()) }),
  z.object({ channel: z.literal("sms"), to: z.string(), body: z.string().max(480) }),
  z.object({ channel: z.literal("in_app"), userId: z.string().uuid(), event: NotificationEvent, title: z.string(), body: z.string() }),
]);
export const MaintenanceJobPayload = z.object({ task: z.enum(["purge_login_attempts","verify_chain","node_health","metrics_rollup","threat_level","expire_invitations","flag_dormant_accounts","audit_snapshot"]) });
```
(Import `ScanType` and `NotificationEvent` from this package's `enums.ts`.)

**Providers (all `fetch`-based, 8 s timeout via `AbortSignal.timeout(8000)`, no retries inside the provider — BullMQ retries):**
- `EmailProvider.send({ to, subject, html, text?, from? }): Promise<{ id: string }>`. `ResendEmailProvider`: `POST https://api.resend.com/emails`, header `Authorization: Bearer <RESEND_API_KEY>`, JSON `{ from, to: [to], subject, html, text }`; default from `VUNVAULT <no-reply@vunvault.com>`; maps 4xx to `ProviderError("email_rejected")`, 5xx/timeouts to `ProviderError("email_unavailable", { retryable: true })`.
- `SmsProvider.send({ to, body }): Promise<{ id: string }>`. `AfricasTalkingSmsProvider`: `POST https://api.africastalking.com/version1/messaging` form-encoded `username, to, message`, headers `apiKey: <AFRICASTALKING_API_KEY>`, `Accept: application/json`. `TwilioSmsProvider`: `POST https://api.twilio.com/2010-04-01/Accounts/<SID>/Messages.json` Basic auth, form `To, From, Body` (sender from env `TWILIO_FROM`).
- `SmsRouter`: E.164 numbers beginning `+254`, `+255`, `+256`, `+250`, `+234`, `+233`, `+27`, `+20`, `+251` go through Africa's Talking; every other number goes through Twilio. Invalid numbers throw `ProviderError("sms_invalid_number")`.
- `ProviderError { code: string; retryable: boolean }`.
- Tests: success mapping, 4xx vs 5xx classification, routing table (assert `+254712345678` → AT and `+447700900123` → Twilio), and that no request is made when the number is invalid.

---

**Data shape (TypeScript):**
```ts
interface SecretProvider { get(name: SecretName): Promise<string> }
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
interface EmailProvider { send(m: { to: string; subject: string; html: string; text?: string; from?: string }): Promise<{ id: string }> }
interface SmsProvider { send(m: { to: string; body: string }): Promise<{ id: string }> }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — no HTTP endpoints. (`/readyz` now reports `db` and `redis` checks.)

---

**Out of scope:**
- Do not implement domain routes or queue consumers (workers are Layers L10–L11).
- Do not read any secret from a committed file; do not write secrets to `process.env`.
- Do not install Stripe, Paystack, Supabase, Twilio, or Resend SDKs.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ `OciVaultSecretProvider` is the provider selected when `SECRETS_PROVIDER=oci-vault` (covered by a test).
☐ Report at the end: `Task 22 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 23 — API security plugins: headers, CORS, cookies, CSRF, rate limiting, Sentry, raw-body

**Layer:** L3

**Prerequisites:** Task 21, Task 22

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **API security plugins: headers, CORS, cookies, CSRF, rate limiting, Sentry, raw-body**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the cross-cutting HTTP security layer: Helmet, credentialed CORS locked to the web origin, cookie parsing, double-submit CSRF, Redis-backed rate limiting with named policies, scrubbed Sentry, and raw-body capture for webhooks.

**Deliverables:**
- `apps/api/src/plugins/security-headers.ts` — Helmet.
- `apps/api/src/plugins/cors.ts` — CORS.
- `apps/api/src/plugins/cookies.ts` — cookie parsing + `COOKIE_NAMES` + `cookieOptions()` helper.
- `apps/api/src/plugins/csrf.ts` — CSRF hook + `GET /api/v1/auth/csrf` route.
- `apps/api/src/plugins/rate-limit.ts` — rate limiter + exported policies.
- `apps/api/src/plugins/sentry.ts` — Sentry init + error capture.
- `apps/api/src/plugins/raw-body.ts` — raw body capture.
- MODIFY `apps/api/src/app.ts` — register in order: sentry → security-headers → cors → cookies → raw-body → rate-limit → csrf (all BEFORE routes).
- MODIFY `apps/api/src/types/fastify.d.ts` — augment `FastifyRequest.rawBody`, route `config.rateLimitPolicy`, `config.csrf`.
- `apps/api/src/plugins/security.test.ts` — tests.
- MODIFY `apps/api/package.json` — add dependencies.

**Dependencies allowed:**
- `@fastify/helmet`, `@fastify/cors`, `@fastify/cookie`, `@fastify/rate-limit`, `fastify-raw-body`, `@sentry/node`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Helmet (API-only JSON service):** `contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }`, `hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }`, `referrerPolicy: no-referrer`, `crossOriginResourcePolicy: { policy: "same-site" }`, `frameguard: deny`. Disable the CSP for `/docs*` ONLY when not in production.

**CORS:** `origin` = EXACT match of `env.WEB_ORIGIN` (no wildcard, no reflection); `credentials: true`; `methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`; `allowedHeaders: Content-Type, X-CSRF-Token, X-Request-Id`; `exposedHeaders: X-Request-Id, Retry-After`; `maxAge: 600`. Requests with a different `Origin` get no CORS headers.

**Cookies (`COOKIE_NAMES`, exact):**
| name | purpose | HttpOnly | SameSite | Path | Lifetime |
|---|---|---|---|---|---|
| `vv_at` | access token | yes | Lax | `/` | 3600 s |
| `vv_rt` | refresh token | yes | Strict | `/api/v1/auth` | 30 days if remember else session |
| `vv_mfa` | MFA challenge handle | yes | Strict | `/api/v1/auth` | 300 s |
| `vv_csrf` | CSRF token (double-submit) | **no** (JS must read it) | Lax | `/` | session |
All cookies: `Secure: true` outside development, `Domain: env.COOKIE_DOMAIN || undefined`. `cookieOptions(name, { remember })` returns the options. Tokens are NEVER returned in a JSON body and NEVER stored in `localStorage`.

**CSRF (double-submit, stateless):** `onRequest` hook for methods `POST, PUT, PATCH, DELETE`: if the request carries ANY of the cookies `vv_at`, `vv_rt`, `vv_mfa` (i.e. it is session-bound), require header `x-csrf-token` to equal cookie `vv_csrf` using `crypto.timingSafeEqual`; otherwise `403 { error: "csrf_failed" }`. Skip when the route config has `csrf: false` (set on: webhooks, node heartbeat) or when the request carries no session cookie (public forms are protected by rate limits instead). `GET /api/v1/auth/csrf` → sets `vv_csrf` to 32 random bytes hex if missing and returns `200 { data: { csrfToken: string } }`.

**Rate limiting (Redis store via `app.redis`, key prefix `rl:`; fall back to in-memory only when `NODE_ENV === "test"`):** global `300 req / 1 min` per `req.ip`. Named policies exported as `RATE_POLICIES`, selectable per route via `config: { rateLimitPolicy: "<name>" }`:
- `login`: 5 / 1 min keyed by `ip + sha256(lowercased email)`; plus a second counter of 20 / 15 min per ip.
- `public_form`: 5 / 10 min per ip (contact, consent, signup).
- `sensitive`: 10 / 1 min per authenticated user id (password change, MFA changes, recovery codes).
- `webhook`: exempt.
When exceeded respond `429 { error: "rate_limited" }` with `Retry-After`. `trustProxy: true` is already set; `req.ip` must come from `CF-Connecting-IP` when present (add a small `onRequest` hook that sets it only if the immediate peer is a trusted proxy).

**Sentry:** init only when `SENTRY_DSN` is set; `sendDefaultPii: false`; `beforeSend` removes request headers `cookie`, `authorization`, `x-csrf-token` and any body field named `password`, `currentPassword`, `newPassword`, `confirmPassword`, `code`, `recoveryAnswer`, `token`; capture only errors with status ≥ 500; tag `requestId`.

**Raw body:** `fastify-raw-body` with `global: false`, `runFirst: true`, `encoding: false` (Buffer); routes opt in with `config: { rawBody: true }` (used by Stripe/Paystack webhooks later).

**Tests (assert):** CORS reflects only the configured origin; helmet headers present; CSRF rejects a session-cookie POST without header and accepts a matching one; a cookie-less POST passes CSRF; `/auth/csrf` sets the cookie; the `login` policy blocks the 6th attempt within a minute and returns `Retry-After`; Sentry `beforeSend` strips `cookie` and `password`.

---

**Data shape (TypeScript):**
```ts
type CookieName = "vv_at" | "vv_rt" | "vv_mfa" | "vv_csrf";
type RatePolicy = "login" | "public_form" | "sensitive" | "webhook";
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/auth/csrf → 200 { data: { csrfToken: string } }  (sets cookie vv_csrf)
// Any session-bound POST/PUT/PATCH/DELETE without matching x-csrf-token → 403 { error: "csrf_failed" }
// Any rate-limited route → 429 { error: "rate_limited" } + Retry-After
```

---

**Out of scope:**
- Do not implement authentication or token verification (Task 24).
- Do not implement any domain route.
- Do not use `localStorage` or `sessionStorage` or return tokens in JSON.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 23 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 24 — API auth plugin: Supabase JWT verification, permissions, session cookies, Supabase admin client, JWT claims hook

**Layer:** L3

**Prerequisites:** Task 21, Task 22, Task 23, Task 15, Task 19, Task 20c

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **API auth plugin: Supabase JWT verification, permissions, session cookies, Supabase admin client, JWT claims hook**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement request authentication from the HttpOnly `vv_at` cookie, role/permission guards, AAL2 enforcement for staff, session-revocation checks, a Supabase admin wrapper, cookie helpers, and the Postgres Auth Hook that mints the `role`, `org_id`, `permissions[]` claims.

**Deliverables:**
- `apps/api/src/plugins/auth.ts` — decorates `app.authenticate`, `app.optionalAuth`, `app.requirePermission`, `app.requireAnyPermission`, `app.requireRole`, `app.requireStaff`.
- `apps/api/src/lib/jwt.ts` — token verification with `jose`.
- `apps/api/src/lib/supabase-admin.ts` — `SupabaseAdmin` wrapper (interface + real implementation).
- `apps/api/src/lib/session-cookies.ts` — `setSessionCookies`, `clearSessionCookies`, `readSessionCookies`.
- `apps/api/src/lib/session-registry.ts` — Redis-cached session/account lookups.
- `packages/db/sql/0024_auth_hook.sql` — `public.vv_custom_access_token_hook(event jsonb) returns jsonb` + grants.
- MODIFY `apps/api/src/types/fastify.d.ts` — `FastifyRequest.user: AuthUser | undefined`.
- MODIFY `apps/api/src/app.ts` — register `auth` after `csrf`; decorate `app.supabase`.
- `apps/api/src/plugins/auth.test.ts` — tests.
- MODIFY `apps/api/package.json` — add dependencies.
- `apps/api/src/lib/staff.ts` — `STAFF_ROLES`, `isStaff(role)`.

**Dependencies allowed:**
- `jose`, `@supabase/supabase-js`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Token verification (`jwt.ts`):** read the access token ONLY from cookie `vv_at` (never from an `Authorization` header or query string). Verify with `jose` `jwtVerify`: algorithm HS256 using `SUPABASE_JWT_SECRET` (secret from `app.secrets`), `issuer = <SUPABASE_URL>/auth/v1`, `audience = "authenticated"`, `clockTolerance: 5`. Required claims: `sub`, `exp`, `session_id`, `aal` (`aal1` | `aal2`), and the custom claims `role` (UserRole), `org_id` (uuid | null), `permissions` (Permission[]) — validate with Zod `JwtClaims` from `@vunvault/contracts`. Missing/invalid → `401 { error: "unauthorized" }`.

**`AuthUser`:** `{ id, email, role, orgId, permissions, aal: "aal1" | "aal2", sessionId }`.

**Guards:**
- `authenticate`: verify the token; then consult `session-registry` (Redis, TTL 30 s, key `sess:<sessionId>`; miss → DB read of `user_sessions.revoked_at` and `profiles.account_status, deleted_at`). If the session is revoked, or the account is not `active`, or soft-deleted → `401 { error: "unauthorized" }`. Fire-and-forget `user_sessions.last_seen_at` update at most once per minute per session. `AuthUser.aal` is `"aal2"` when the JWT says `aal2` OR `user_sessions.mfa_method IS NOT NULL` for that session (in-house WebAuthn and email-OTP verifications cannot raise Supabase's own AAL, so they record `mfa_method` on the session row; the registry value is cached with the same 30 s TTL).
- `requirePermission(...perms)`: every perm must be in `req.user.permissions`, else `403 { error: "forbidden" }`. `requireAnyPermission(...perms)`: at least one. `requireRole(...roles)`.
- `requireStaff`: role ∈ `STAFF_ROLES` (`super_admin, admin, security_analyst, soc_operator, compliance_auditor, support_engineer`) AND `aal === "aal2"`; staff on `aal1` → `403 { error: "mfa_required" }`.
- `optionalAuth`: sets `req.user` when a valid cookie exists, never rejects.
- Compose in routes as `preHandler: [app.authenticate, app.requireStaff, app.requirePermission("x:y")]` for every `/admin/*` route (enforced later by a test in Task 40 that walks the route table).

**`session-cookies.ts`:** `setSessionCookies(reply, { accessToken, refreshToken, expiresIn }, { remember })` sets `vv_at` and `vv_rt` (options from Task 23) and (re)issues `vv_csrf`; `clearSessionCookies(reply)` expires all four; `readSessionCookies(req)` returns `{ at?, rt?, mfa? }`.

**`SupabaseAdmin` interface (real impl uses `@supabase/supabase-js` with the SERVICE ROLE key, `auth: { persistSession: false, autoRefreshToken: false }`; tests use a fake):**
```ts
interface SupabaseAdmin {
  createUser(i: { email: string; password: string; emailConfirm?: boolean; userMetadata?: object }): Promise<{ id: string }>;
  signInWithPassword(email: string, password: string): Promise<{ session: SupabaseSession | null; userId: string; mfaRequired: boolean; factors: { id: string; type: "totp" }[] }>;
  refresh(refreshToken: string): Promise<SupabaseSession>;
  signOut(accessToken: string, scope: "global" | "local" | "others"): Promise<void>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  mfa: {
    enrollTotp(accessToken: string, friendlyName: string): Promise<{ factorId: string; qrSvg: string; secret: string; uri: string }>;
    challengeAndVerify(accessToken: string, factorId: string, code: string): Promise<SupabaseSession>;
    unenroll(accessToken: string, factorId: string): Promise<void>;
    listFactors(userId: string): Promise<{ id: string; type: "totp"; verified: boolean }[]>;
  };
}
interface SupabaseSession { accessToken: string; refreshToken: string; expiresIn: number; sessionId: string; userId: string; aal: "aal1" | "aal2" }
```

**`0024_auth_hook.sql`:** create `public.vv_custom_access_token_hook(event jsonb) returns jsonb language plpgsql stable security definer set search_path = public`. Logic: read `event->>'user_id'`; select `role, org_id, account_status` from `public.profiles`; if no profile or `account_status <> 'active'` → return the event unchanged with claim `role = 'client'` and `permissions = []`; else set claims `role`, `org_id` (JSON null when none) and `permissions` as the JSON array for that role. Embed the role→permissions map as a SQL `CASE` that MIRRORS `ROLE_PERMISSIONS` from `@vunvault/contracts` (add a header comment: `-- KEEP IN SYNC with packages/contracts/src/permissions.ts; a test compares them`). Add `grant execute on function public.vv_custom_access_token_hook to supabase_auth_admin; revoke execute ... from authenticated, anon, public;` and `grant usage on schema public to supabase_auth_admin;`. Add a comment documenting that the hook is enabled in the Supabase dashboard (Auth → Hooks → Custom Access Token).
- Add a Vitest test in `apps/api` that reads the SQL file and asserts that every permission string for every role in `ROLE_PERMISSIONS` appears in the `CASE` branch for that role (parse by regex) — this prevents drift.

**Tests (assert):** no cookie → 401; expired token → 401; wrong audience → 401; revoked session → 401; staff with `aal1` hitting a `requireStaff` route → 403 `mfa_required`; client lacking permission → 403 `forbidden`; `optionalAuth` never rejects; `Authorization: Bearer <valid>` header alone is ignored (401).

---

**Data shape (TypeScript):**
```ts
interface AuthUser { id: string; email: string; role: UserRole; orgId: string | null; permissions: Permission[]; aal: "aal1" | "aal2"; sessionId: string }
type StaffRole = "super_admin" | "admin" | "security_analyst" | "soc_operator" | "compliance_auditor" | "support_engineer";
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// No new HTTP routes. Guards produce:
//   401 { error: "unauthorized" } · 403 { error: "forbidden" } · 403 { error: "mfa_required" }
```

---

**Out of scope:**
- Do not implement login/signup/logout routes (Task 26).
- Do not accept tokens from headers or query strings.
- Do not store tokens anywhere except HttpOnly cookies.
- Do not apply or run the SQL migration.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 24 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 25 — API audit-chain service: append-only hash chain, HMAC, AES-256-GCM sealing, `audited()` wrapper, verification, live stream

**Layer:** L3

**Prerequisites:** Task 18, Task 20, Task 22, Task 24

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **API audit-chain service: append-only hash chain, HMAC, AES-256-GCM sealing, `audited()` wrapper, verification, live stream**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the audit chain service and the `audited(spec, handler)` route wrapper so every state-changing route appends a hash-linked, HMAC-signed, optionally AES-256-GCM-sealed entry inside the same database transaction.

**Deliverables:**
- `apps/api/src/audit/canonical.ts` — canonical JSON.
- `apps/api/src/audit/crypto.ts` — SHA-256, HMAC, AES-256-GCM seal/open, key ring.
- `apps/api/src/audit/events.ts` — `AUDIT_EVENTS` catalog.
- `apps/api/src/audit/repo.ts` — `AuditRepo` (head, insert, range read).
- `apps/api/src/audit/service.ts` — `AuditService` (`append`, `verify`, `head`, `publish`).
- `apps/api/src/audit/audited.ts` — the `audited()` wrapper.
- `apps/api/src/plugins/audit.ts` — decorates `app.audit`, `app.audited`.
- MODIFY `apps/api/src/types/fastify.d.ts` — add decorations.
- MODIFY `apps/api/src/app.ts` — register `audit` after `auth`.
- `apps/api/src/audit/audit.test.ts` — tests.
- `apps/api/src/audit/events.test.ts` — catalog tests.
- `docs/adr/0001-audit-chain.md` — one-page ADR (context, decision, consequences) describing the design below.

**Dependencies allowed:**
- None — use only existing (`node:crypto` for hashing/AES).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Principles:** the chain is append-only; there is NO update or delete code path; corrections are new entries (`docs/adr/0001-audit-chain.md` states this). The database also refuses UPDATE/DELETE (triggers from Task 18).

**Canonical JSON (`canonical.ts`):** deterministic serialisation — object keys sorted lexicographically at every depth, no whitespace, `undefined` dropped, `Date` → ISO-8601 UTC with milliseconds (`2026-09-24T09:41:12.000Z`), numbers via `JSON.stringify`, throws on `NaN`/`Infinity`/cycles.

**Hash & signature (exact):**
```
payload   = canonicalJson({ category, event_type, severity, actor_label, subject, message, details, created_at })
hash      = sha256_hex( prev_hash + payload )                       // 64 hex chars
signature = hmac_sha256_hex( hmacKey(key_id), hash )                 // 64 hex chars
```
Genesis (`seq = 1`, created by Task 18's SQL) has `prev_hash` = 64 zeros. `created_at` is chosen by the application (not by a DB default) so hashes are reproducible.

**Key ring (`crypto.ts`):** keys come from `app.secrets`: `AUDIT_HMAC_KEY`, `AUDIT_AES_KEY` (32 bytes, base64). Each secret value may be a JSON map `{ "current": "<key_id>", "keys": { "<key_id>": "<base64>" } }`. New entries use `current`; verification looks up the entry's own `key_id`, so old entries stay verifiable after rotation. `seal(plaintext: object, aad: string): { sealed: Buffer; nonce: Buffer }` uses AES-256-GCM with a random 12-byte nonce (sealed = ciphertext ‖ 16-byte tag) and `aad` = the entry's uuid `id`. `open(...)` reverses it. Nonces are never reused (random + a unit test that 1,000 nonces are unique).

**Event catalog (`AUDIT_EVENTS`: event type → `{ category, severity, sevLevel? }`, exact):**
- authentication: `AUTH_SUCCESS` (ok), `AUTH_FAILURE` (warning), `AUTH_MFA_FAILURE` (warning), `AUTH_LOGOUT` (info), `PASSWORD_CHANGED` (info, sev 3), `MFA_ENABLED` (info, sev 3), `MFA_DISABLED` (warning, sev 2), `RECOVERY_CODES_GENERATED` (info, sev 3), `SESSION_REVOKED` (info), `ACCOUNT_REGISTERED` (info).
- security_event: `AUTH_RATE_LIMIT` (warning), `RELEASE_LOCK_VIOLATION` (critical, sev 2), `CSRF_REJECTED` (warning), `WEBHOOK_SIGNATURE_INVALID` (warning).
- scan_completion: `SCAN_REQUESTED` (info), `SCAN_STARTED` (info), `SCAN_COMPLETE` (ok), `SCAN_CANCELLED` (info), `SCAN_HELD` (warning), `SCAN_FAILED` (warning).
- report_release: `GATE_DECISION` (info), `REPORT_RELEASED` (ok).
- administrative: `USER_PROVISIONED` (info), `INVITATION_RESENT` (info), `INVITATION_REVOKED` (info), `INVITATION_ACCEPTED` (info), `PERMISSION_CHANGED` (warning, sev 2), `ACCOUNT_SUSPENDED` (warning, sev 2), `ACCOUNT_REACTIVATED` (info), `ACCOUNT_DELETED` (warning, sev 2), `MFA_ENFORCED` (info), `PROFILE_UPDATED` (info), `DEACTIVATION_REQUESTED` (warning, sev 2), `PAYMENT_METHOD_UPDATED` (info), `PAYMENT_CAPTURED` (ok), `PAYMENT_FAILED` (warning), `REFUND_ISSUED` (warning, sev 3), `ADVISORY_DRAFT_SAVED` (info), `ADVISORY_BROADCAST` (critical, sev 1), `ADVISORY_RETRACTED` (warning, sev 2), `CONTENT_REVIEWED` (info), `CONTENT_PUBLISHED` (ok), `PENTEST_REQUESTED` (info), `CONTACT_RECEIVED` (info), `CONSENT_RECORDED` (info), `PAYMENT_ATTEMPT_CREATED` (info), `FX_QUOTE_LOCKED` (info), `ADVISORY_ACKNOWLEDGED` (info), `ADVISORY_PATCH_STATUS_CHANGED` (info), `CONTENT_DRAFT_SAVED` (info), `CONTENT_SUBMITTED` (info), `AVATAR_UPDATED` (info), `ONBOARDING_COMPLETED` (info), `SCAN_PAYMENT_REQUESTED` (info), `BULK_SCAN_ACTION` (info), `FINDING_REVIEWED` (info), `INVOICE_ISSUED` (info), `NOTIFICATION_PREFS_UPDATED` (info).
- system: `KEY_ROTATION` (info), `CHAIN_VERIFIED` (ok), `LOG_BACKUP` (ok), `CHAIN_GENESIS` (info), `THREAT_LEVEL_CHANGED` (warning).
`AuditEventType` is the union of the keys.

**`AuditService.append(tx, input)`:** `input = { eventType, actor: { id: string | null; label: string }, subject?: string, message: string, ip?: string, details?: object, sealed?: object }`. Steps (all inside the caller's transaction): (1) `SELECT pg_advisory_xact_lock(7340481)`; (2) read the head row (`ORDER BY seq DESC LIMIT 1`); (3) build the entry with `category/severity/sevLevel` from the catalog (`severity`/`sevLevel` may be overridden only upward); (4) redact `details` — drop any key matching `/pass(word)?|secret|token|authorization|cookie|cvc|pan|code$/i`; (5) compute `hash` and `signature`; (6) seal `sealed` if provided; (7) INSERT; (8) register an `onCommit` callback that publishes the entry view to Redis channel `audit:stream` (and, for `sevLevel === 1`, to `audit:sev1`) — publish failures are logged, never thrown.
**`AuditService.verify(db, { fromSeq?, toSeq? })`:** streams entries in `seq` order in batches of 1,000; checks `prev_hash` linkage, recomputes every `hash`, and verifies every `signature` with the entry's `key_id`; returns `{ checkedFromSeq, checkedToSeq, entries, mismatches, firstMismatchSeq, verifiedAt }`. Never throws on a mismatch — it reports it. Also exported: `verifyEntries(entries, hmacKeyFor)` pure function used by tests.

**`audited(spec, handler)`:**
```ts
type AuditSpec<Req, Res> = {
  eventType: AuditEventType;
  subject?: (req: Req, res: Res) => string | undefined;
  message: (req: Req, res: Res) => string;
  details?: (req: Req, res: Res) => object;
  actor?: (req: Req) => { id: string | null; label: string };   // default: req.user → { id, label: email-local-part }
};
audited(spec, handler: (req, reply, ctx: { tx: Tx }) => Promise<Res>) => (req, reply) => Promise<Res>
```
Behaviour: `app.withTx(tx => { const res = await handler(req, reply, { tx }); await audit.append(tx, build(spec, req, res)); return res; })`. If the handler throws, nothing is written (rolled back) and the error propagates. If `append` throws, the transaction rolls back and the request fails with `500 { error: "audit_unavailable" }`. The returned handler is tagged with `Symbol.for("vv.audited")` (export `isAudited(handler): boolean`) so a route-table test can verify coverage. Also export `auditFailure(app, spec, req, err)` that appends a standalone entry for REJECTED security-relevant attempts (e.g. `AUTH_FAILURE`, `RELEASE_LOCK_VIOLATION`) in its own short transaction; this is the only non-wrapped append path.

**Tests (assert):** (1) 3 sequential appends produce a verifiable chain; (2) mutating one `message` byte makes `verify` report exactly that `seq` as `firstMismatchSeq`; (3) a wrong HMAC key fails the signature check; (4) `details` containing `password` and `recoveryCode` come back redacted; (5) `audited` rolls back the domain write when `append` throws; (6) `audited` writes nothing when the handler throws; (7) sealed round-trip + tamper detection (flip a tag bit → `open` throws); (8) key rotation: entries signed with the old `key_id` still verify; (9) canonical JSON ignores key order; (10) catalog: every event has a category from `AUDIT_CATEGORIES` and `sevLevel ∈ {1,2,3}` when present.

---

**Data shape (TypeScript):**
```ts
interface AuditAppendInput { eventType: AuditEventType; actor: { id: string | null; label: string }; subject?: string; message: string; ip?: string; details?: Record<string, unknown>; sealed?: Record<string, unknown> }
interface AuditEntryRow { seq: number; id: string; category: AuditCategory; eventType: string; severity: AuditSeverity; sevLevel: 1 | 2 | 3 | null; actorId: string | null; actorLabel: string; ip: string | null; subject: string | null; message: string; details: object; sealedDetails: Buffer | null; nonce: Buffer | null; prevHash: string; hash: string; signature: string; keyId: string; createdAt: Date }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// No HTTP routes in this task (Task 39 exposes read-only audit routes).
// Redis pub/sub: channel "audit:stream" payload = AuditEntryView (JSON); channel "audit:sev1" payload = AuditEntryView.
// There is NO update or delete operation anywhere.
```

---

**Out of scope:**
- Do not add any function that updates or deletes an audit entry.
- Do not expose audit data over HTTP (Task 39).
- Do not store plaintext secrets, tokens, or card data in `details`.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 25 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 26 — Auth routes: signup, login, MFA challenge, refresh, logout, session

**Layer:** L4

**Prerequisites:** Task 19, Task 20c, Task 23, Task 24, Task 25

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Auth routes: signup, login, MFA challenge, refresh, logout, session**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the session lifecycle routes on top of Supabase Auth with HttpOnly cookies, lockout, MFA challenge handling and audit entries.

**Deliverables:**
- `apps/api/src/routes/v1/auth/index.ts` — route plugin.
- `apps/api/src/routes/v1/auth/service.ts` — `AuthService`.
- `apps/api/src/routes/v1/auth/repo.ts` — profiles, organizations, `login_attempts`, `user_sessions` access.
- `apps/api/src/routes/v1/auth/challenge.ts` — Redis MFA-challenge store with AES-256-GCM encrypted session payload.
- `apps/api/src/routes/v1/auth/mfa-registry.ts` — `MfaVerifierRegistry` (`totp`, `email_otp`, `webauthn`, `recovery`).
- `apps/api/src/routes/v1/auth/device.ts` — device label + geo parsing.
- `apps/api/src/lib/breach.ts` — `BreachCheck` (HIBP k-anonymity).
- `packages/db/sql/0026_client_code.sql` — sequence + function for client codes.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/auth/auth.test.ts` — tests.
- `apps/api/src/routes/v1/auth/device.test.ts` — parser tests.
- MODIFY `apps/api/src/types/fastify.d.ts` — add `app.mfaVerifiers`.

**Dependencies allowed:**
- None — use only existing (`node:crypto`, global `fetch`).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Signup (`POST /api/v1/auth/signup`, public, rate policy `public_form`):**
1. Validate `SignupBody` (password ≥ 12 chars with upper/lower/digit/symbol).
2. `BreachCheck.isBreached(password)` — SHA-1 the password, send the first 5 hex chars to `https://api.pwnedpasswords.com/range/<prefix>` with header `Add-Padding: true`, compare suffix locally; timeout 3 s; on timeout/5xx FAIL OPEN and log `warn`. Breached → `422 { error: "breached_password" }`.
3. Email uniqueness: if `profiles.email` (citext) exists → `409 { error: "email_taken" }`.
4. `supabase.createUser({ email, password, emailConfirm: true, userMetadata: { fullName } })` (v1 decision: mailbox-ownership verification is NOT part of signup; onboarding step 1 makes the user type the email twice. Add a `// DECISION(v1)` comment).
5. In ONE transaction: insert `organizations` (`name` = company description or the full name for `individual`, `client_code` from `SELECT next_client_code()`, `country`) and `profiles` (`role: "client"`, `account_type`, `phone`, `country`, `full_name`, `first_name`/`last_name` split on the first space).
6. Sign in with `signInWithPassword`, `setSessionCookies` (remember = false), insert `user_sessions`.
7. Audit `ACCOUNT_REGISTERED` (actor = the new user, ip). Respond `201 { data: SessionUser }`.

**`0026_client_code.sql`:** `CREATE SEQUENCE IF NOT EXISTS client_code_seq START 48211;` and `CREATE FUNCTION next_client_code() RETURNS text AS $$ SELECT 'VV-CL-' || lpad(nextval('client_code_seq')::text, 5, '0') $$ LANGUAGE sql;` (client codes look like `VV-CL-48210`).

**Login (`POST /api/v1/auth/login`, public, policy `login`):**
1. Lockout: count failed `login_attempts` for `sha256(lower(email))` in the last 15 min (≥ 5) or for the `ip` (≥ 20) → `429 { error: "rate_limited" }`, `Retry-After: 900`, and `auditFailure` event `AUTH_RATE_LIMIT` (actor label `system`, subject = the email, message `"<n> failed attempts in 15 min from <ip> targeting <email> · source IP temporarily blocked for 15 min"`).
2. `signInWithPassword`. Wrong password, unknown email, suspended, dormant, soft-deleted → ALL return `401 { error: "invalid_credentials" }` with identical timing envelope (always perform one dummy hash comparison) and record `login_attempts(succeeded=false, reason)`; `auditFailure` event `AUTH_FAILURE` (actor label `external` for unknown emails, else the user label).
3. Success without MFA (`mfaRequired === false` and the user has no TOTP factor, no `webauthn_credentials`): `setSessionCookies` (`remember` → `vv_rt` 30 days), insert `user_sessions` (device label, ip, geo), set `last_active_at`, record attempt, audit `AUTH_SUCCESS`; respond `200 { data: { user: SessionUser, mfaRequired: false, mfaMethods: [] } }`.
4. Success WITH MFA available: do NOT set `vv_at`/`vv_rt`. Create a challenge: random 32-byte handle (base64url) → Redis `mfa:<handle>` TTL 300 s holding `{ userId, email, remember, attempts: 0, methods, sessionEnc }` where `sessionEnc` is the aal1 Supabase session encrypted with AES-256-GCM using a key derived by HKDF-SHA256 from the `SUPABASE_SERVICE_ROLE_KEY` secret with info `"vv-mfa-challenge"`. Set cookie `vv_mfa` (300 s). Respond `200 { data: { user: null, mfaRequired: true, mfaMethods: ["totp"|"webauthn"|"email_otp", …] } }`. `email_otp` is offered only to roles in `STAFF_ROLES`.

**MFA verify (`POST /api/v1/auth/mfa/verify`, public, requires cookie `vv_mfa`):** load the challenge (missing → `410 { error: "challenge_expired" }`); increment `attempts` — at 5 failures delete the challenge, `auditFailure` `AUTH_MFA_FAILURE`, `401 mfa_failed`. Delegate by `method` through `MfaVerifierRegistry`:
- `totp`: decrypt the aal1 session; `supabase.mfa.challengeAndVerify(accessToken, factorId, code)` → aal2 session.
- `email_otp`: compare `sha256(code)` to Redis `emailotp:<userId>` (constant-time); on success reuse the aal1 session and write `mfa_method = 'email_otp'` on the `user_sessions` row.
- `webauthn` and `recovery`: the registry returns `501 { error: "not_implemented" }` until Task 27 registers the real verifiers.
On success: delete the challenge, clear `vv_mfa`, set session cookies, insert `user_sessions` with `mfa_method`, audit `AUTH_SUCCESS` with `details: { mfa: <method> }`, respond `200 { data: SessionUser }`.

**Email OTP send (`POST /api/v1/auth/mfa/email-otp`, requires `vv_mfa`, staff only):** generate a 6-digit code, store `sha256` in Redis `emailotp:<userId>` TTL 600 s, max 1 send per 60 s, send via `app.email` (subject `"Your VUNVAULT sign-in code"`, body states the code expires in 10 minutes) → `202 {}`.

**Refresh (`POST /api/v1/auth/refresh`, requires `vv_rt`):** `supabase.refresh`, rotate both cookies, update `user_sessions.last_seen_at` → `204`. Invalid → clear cookies, `401 unauthorized`.
**Logout (`POST /api/v1/auth/logout`, authenticated):** `supabase.signOut(at, "local")`, set `user_sessions.revoked_at`, clear all cookies, audit `AUTH_LOGOUT`, `204`.
**Session (`GET /api/v1/auth/session`, authenticated):** `200 { data: SessionUser }` where `mfaEnrolled` = TOTP factor verified OR a WebAuthn credential exists.

**Device parsing (`device.ts`):** `deviceLabel(userAgent)` → `"<Device> · <Browser>"`, e.g. `MacBook Pro · Safari` is NOT derivable from a UA, so use coarse labels: `Mac · Safari`, `Windows PC · Chrome`, `iPhone · Safari`, `Android · Chrome`, `Linux · Firefox`, `Unknown device · Unknown browser`. Geo from Cloudflare headers `cf-ipcity` and `cf-ipcountry` when present.

**Tests (assert):** signup happy path sets three cookies (`vv_at`, `vv_rt`, `vv_csrf`) and writes organization + profile; breached password → 422; duplicate email → 409; 5 bad logins → 6th is 429 and an `AUTH_RATE_LIMIT` entry exists; wrong password and unknown email produce byte-identical bodies; MFA-enrolled login sets `vv_mfa` and NOT `vv_at`; TOTP verify success sets `vv_at`; the 5th wrong TOTP deletes the challenge; the challenge payload in Redis does not contain the access token in plaintext; logout clears cookies and revokes the session row; `webauthn` verify returns 501 now.

---

**Data shape (TypeScript):**
```ts
interface SessionUser { id: string; email: string; fullName: string; role: UserRole; orgId: string | null; permissions: Permission[]; mfaEnrolled: boolean }
interface MfaChallenge { userId: string; email: string; remember: boolean; attempts: number; methods: MfaMethod[]; sessionEnc: string }
interface MfaVerifier { verify(ctx: { challenge: MfaChallenge; body: unknown; req: FastifyRequest }): Promise<{ session: SupabaseSession | null; method: MfaMethod | "recovery" }> }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/signup   body { fullName: string(min2); email; phone?: string; country: string(len2); accountType: "individual"|"company"; password: string(min12); confirmPassword: string; description?: string(max500) }
//   → 201 { data: SessionUser } + cookies vv_at, vv_rt, vv_csrf
//   → 400 validation_failed | 409 { error: "email_taken" } | 422 { error: "breached_password" } | 429 rate_limited
// POST /api/v1/auth/login    body { email; password: string(min8); remember?: boolean }
//   → 200 { data: { user: SessionUser | null; mfaRequired: boolean; mfaMethods: ("totp"|"webauthn"|"email_otp")[] } }
//   → 401 { error: "invalid_credentials" } | 429 { error: "rate_limited" }
// POST /api/v1/auth/mfa/verify  body { method: "totp"|"email_otp"; code: string(6 digits) } | { method: "webauthn"; assertion: unknown }
//   → 200 { data: SessionUser } | 401 { error: "mfa_failed" } | 410 { error: "challenge_expired" } | 501 { error: "not_implemented" }
// POST /api/v1/auth/mfa/email-otp → 202 {} | 410 challenge_expired | 429 rate_limited
// POST /api/v1/auth/refresh → 204 | 401 unauthorized
// POST /api/v1/auth/logout → 204
// GET  /api/v1/auth/session → 200 { data: SessionUser } | 401 unauthorized
```

---

**Out of scope:**
- Do not implement password change, TOTP enrolment, WebAuthn, or recovery codes (Task 27).
- Do not implement email verification links.
- Do not return tokens in any response body.
- Do not apply the SQL migration.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Every failure path leaves the response body free of the word `password` echoed back and free of stack traces.
☐ Report at the end: `Task 26 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 27 — Credentials & MFA self-service: password change, TOTP, WebAuthn, recovery codes

**Layer:** L4

**Prerequisites:** Task 24, Task 25, Task 26, Task 20c, Task 20d

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Credentials & MFA self-service: password change, TOTP, WebAuthn, recovery codes**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the Password Manager / Profile Settings security routes: change password, TOTP enrol/verify/disable, in-house WebAuthn register/authenticate, recovery codes, MFA status with security posture.

**Deliverables:**
- `apps/api/src/routes/v1/account-security/index.ts` — route plugin.
- `apps/api/src/routes/v1/account-security/service.ts` — `AccountSecurityService`.
- `apps/api/src/routes/v1/account-security/repo.ts` — recovery codes, webauthn credentials, profile security columns.
- `apps/api/src/routes/v1/account-security/recovery-codes.ts` — generator + normaliser + hasher.
- `apps/api/src/routes/v1/account-security/webauthn.ts` — WebAuthn service (SimpleWebAuthn).
- `apps/api/src/routes/v1/account-security/posture.ts` — `computePosture()`.
- `apps/api/src/routes/v1/account-security/password-policy.ts` — `validatePassword(pw, role)`.
- MODIFY `apps/api/src/routes/v1/auth/mfa-registry.ts` — register the real `webauthn` and `recovery` verifiers.
- MODIFY `apps/api/src/routes/v1/auth/index.ts` — add `POST /api/v1/auth/mfa/recovery` and `POST /api/v1/auth/mfa/webauthn/options`.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/account-security/account-security.test.ts` — tests.
- `apps/api/src/routes/v1/account-security/recovery-codes.test.ts` — unit tests.
- MODIFY `apps/api/src/config/env.ts` — add `WEBAUTHN_RP_ID: string` and `WEBAUTHN_RP_NAME` (default `VUNVAULT`).
- MODIFY `apps/api/package.json` — add dependency.

**Dependencies allowed:**
- `@simplewebauthn/server`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Permission for all routes: authenticated user acting ONLY on their own account (`req.user.id`); no route accepts a user id from the client. Rate policy `sensitive` on every route here.

**Password change (`POST /api/v1/account/password`):** (1) validate body; (2) `validatePassword`: min length 12 for clients, **14 for `STAFF_ROLES`**; must contain upper, lower, digit, symbol; must not equal the current password; (3) verify the current password with `supabase.signInWithPassword(email, currentPassword)` — failure → `401 { error: "invalid_credentials" }` + `auditFailure` `AUTH_FAILURE`; (4) `BreachCheck` (Task 26) — breached → `422 { error: "breached_password" }`; (5) `supabase.updatePassword`; (6) revoke every OTHER session (`supabase.signOut(at, "others")` + `user_sessions.revoked_at` for ids ≠ current); (7) set `last_password_change_at`; (8) enqueue a `notify` email to the user (template `credentials_changed`); (9) audit `PASSWORD_CHANGED`. `204`. The product copy says credentials are stored as a salted hash; password hashing is owned by Supabase Auth — never implement hashing here.

**TOTP:** `POST …/mfa/totp/enroll` → `supabase.mfa.enrollTotp(at, "Authenticator app")`, return `{ factorId, qrCodeSvg, secret, uri }` (`secret` base32, shown to the user as the manual key). `POST …/mfa/totp/verify` `{ factorId, code }` → `challengeAndVerify`; on success replace the session cookies with the returned aal2 session, set `last_factor_change_at`, `profiles.mfa_enrolled = true`, add `"totp"` to `mfa_methods`, audit `MFA_ENABLED`; wrong code → `401 { error: "mfa_failed" }`. `DELETE …/mfa/totp` → unenroll; STAFF may not remove their last factor (no WebAuthn key) → `422 { error: "last_factor" }`; audit `MFA_DISABLED`.

**WebAuthn (`webauthn.ts`, `@simplewebauthn/server`; rpID `WEBAUTHN_RP_ID`, origin `WEB_ORIGIN`):**
- `POST …/mfa/webauthn/register/options` → `generateRegistrationOptions` (`userVerification: "preferred"`, `residentKey: "discouraged"`, exclude existing credentials); store the challenge in Redis `wa:reg:<userId>` TTL 300 s.
- `POST …/mfa/webauthn/register/verify` `{ deviceName?, credential }` → `verifyRegistrationResponse`; insert `webauthn_credentials` (`credential_id`, `public_key`, `counter`, `transports`, `device_name`); set `last_factor_change_at`; audit `MFA_ENABLED` with `details: { factor: "webauthn" }`; `201 { data: WebauthnKey }`.
- `DELETE …/mfa/webauthn/:id` → only own credentials; staff cannot delete the last factor.
- Login-time authentication (registered into `MfaVerifierRegistry`): `POST /api/v1/auth/mfa/webauthn/options` (requires `vv_mfa`) → `generateAuthenticationOptions` with the user's credentials, challenge in Redis `wa:auth:<handle>` TTL 300 s; the `webauthn` verifier runs `verifyAuthenticationResponse`, enforces counter increase (non-increasing counter → treat as a cloned key: reject and `auditFailure` `AUTH_MFA_FAILURE`), updates `counter` + `last_used_at`, and returns the aal1 session; the route layer then writes `mfa_method = 'webauthn'` on the session row (this is what makes `AuthUser.aal` = `aal2`).

**Recovery codes (`recovery-codes.ts`):** alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (Crockford base32, no I/L/O/U); a code is 12 characters shown as `XXXX-XXXX-XXXX`, generated with `crypto.randomInt`; a batch is 10 codes. `normalise(code)` = uppercase, strip spaces, map `O→0`, `I/L→1`, re-insert dashes. Store only `sha256(normalised)` in `user_recovery_codes`. `POST …/recovery-codes` creates the FIRST batch (409 `{ error: "already_generated" }` when one exists); `POST …/recovery-codes/regenerate` marks every unused code of the old batch as used (`used_at = now()`) and creates a new batch; both return the plaintext codes ONCE (`{ data: { codes, batchId, generatedAt } }`) with `Cache-Control: no-store`; audit `RECOVERY_CODES_GENERATED` (details: only `{ batchId }` — never codes).
- **Using a code at login (`POST /api/v1/auth/mfa/recovery` body `{ code }`, requires `vv_mfa`):** hash lookup of an unused code for that user; mark `used_at`; because Supabase cannot raise AAL from a recovery code, the verifier (a) unenrols the user's TOTP factors using the stored aal1 session, (b) keeps WebAuthn keys, (c) returns the aal1 session WITHOUT `mfa_method`, so staff accounts are forced to re-enrol (`requireStaff` answers `mfa_required`); audit `AUTH_SUCCESS` with `details: { mfa: "recovery" }` and `MFA_DISABLED` with `details: { reason: "recovery_code_used" }`.

**`GET /api/v1/account/security`:** `{ data: MfaStatus & { posture: SecurityPosture } }`. `computePosture()` items (verbatim labels): `"Hardware-key MFA registered"` (≥ 1 WebAuthn key), `"Recovery codes generated"` (a batch exists), `"Password updated within 90 days"` (`last_password_change_at` within 90 days; null → false), `"Register a backup hardware key"` (≥ 2 WebAuthn keys). `score = round(100 × done / total)`; label `"Strong posture"` ≥ 75, `"Fair posture"` ≥ 40, else `"Weak posture"`.

**Tests (assert):** staff password of 13 chars rejected, client password of 12 accepted; wrong current password → 401 and no session revoked; other sessions revoked on success; recovery codes: 10 unique, format regex `^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$`, only hashes persisted, regenerate invalidates old codes, a used code cannot be reused, `normalise("4f7a 9c2e d018")` matches; posture score for the product example (3 of 4 done) = 75 → `"Strong posture"` — NOTE the prototype shows 80; the formula above is authoritative, do not special-case; WebAuthn counter regression rejected; staff cannot delete their last factor.

---

**Data shape (TypeScript):**
```ts
interface WebauthnKey { id: string; deviceName: string | null; createdAt: string; lastUsedAt: string | null }
interface MfaStatus { totp: { enabled: boolean; factorId: string | null }; webauthn: { keys: WebauthnKey[] }; recovery: { generated: boolean; remaining: number; total: 10; generatedAt: string | null }; require2fa: boolean; lastFactorChangeAt: string | null }
interface SecurityPosture { score: number; label: "Strong posture" | "Fair posture" | "Weak posture"; completed: number; total: number; items: { id: string; label: string; done: boolean }[] }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST   /api/v1/account/password  body { currentPassword; newPassword; confirmPassword } → 204 | 400 | 401 invalid_credentials | 422 breached_password | 429
// GET    /api/v1/account/security → 200 { data: MfaStatus & { posture: SecurityPosture } }
// POST   /api/v1/account/mfa/totp/enroll → 201 { data: { factorId; qrCodeSvg; secret; uri } }
// POST   /api/v1/account/mfa/totp/verify  body { factorId; code: string(6) } → 204 | 401 mfa_failed
// DELETE /api/v1/account/mfa/totp → 204 | 422 { error: "last_factor" }
// POST   /api/v1/account/mfa/webauthn/register/options → 200 { data: PublicKeyCredentialCreationOptionsJSON }
// POST   /api/v1/account/mfa/webauthn/register/verify  body { deviceName?: string; credential: unknown } → 201 { data: WebauthnKey } | 400 { error: "webauthn_failed" }
// DELETE /api/v1/account/mfa/webauthn/:id → 204 | 404 not_found | 422 last_factor
// POST   /api/v1/account/recovery-codes → 201 { data: { codes: string[10]; batchId: string; generatedAt: string } } | 409 already_generated
// POST   /api/v1/account/recovery-codes/regenerate → 201 (same shape)
// POST   /api/v1/auth/mfa/webauthn/options (needs vv_mfa) → 200 { data: PublicKeyCredentialRequestOptionsJSON }
// POST   /api/v1/auth/mfa/recovery  body { code: string(XXXX-XXXX-XXXX) } → 200 { data: SessionUser } | 401 mfa_failed | 410 challenge_expired
```

---

**Out of scope:**
- Do not implement password hashing or storage (Supabase Auth owns it).
- Do not log or audit-log recovery codes, TOTP secrets, or passwords.
- Do not build the UI.
- Do not add sessions listing (Task 29).

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ `grep -R "recoveryCode\|currentPassword\|newPassword" apps/api/src --include=*.ts` shows no use of those names inside any logger or audit `details` call.
☐ Report at the end: `Task 27 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 28 — Account settings & avatar: staff profile settings, R2 presigned upload

**Layer:** L4

**Prerequisites:** Task 20c, Task 20d, Task 24, Task 25, Task 22

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Account settings & avatar: staff profile settings, R2 presigned upload**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement `GET/PATCH /account/settings` and the avatar upload/confirm/delete flow using Cloudflare R2 presigned URLs.

**Deliverables:**
- `apps/api/src/routes/v1/account-settings/index.ts` — route plugin.
- `apps/api/src/routes/v1/account-settings/service.ts` — `AccountSettingsService`.
- `apps/api/src/routes/v1/account-settings/repo.ts` — profile settings access.
- `apps/api/src/lib/object-storage.ts` — `ObjectStorage` interface + `R2ObjectStorage` (S3-compatible).
- MODIFY `apps/api/src/lib/secrets/provider.ts` — add `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` to `SECRET_NAMES`.
- MODIFY `apps/api/src/config/env.ts` — add `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL: url`.
- MODIFY `apps/api/src/plugins/providers.ts` — decorate `app.storage`.
- MODIFY `apps/api/src/types/fastify.d.ts` — add `app.storage`.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/account-settings/account-settings.test.ts` — tests.
- MODIFY `apps/api/package.json` — add dependencies.

**Dependencies allowed:**
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (R2 is S3-compatible; endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, region `auto`).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Auth: `authenticate` only (any role acts on their own profile). Rate policy `sensitive` on writes.

**`ObjectStorage` interface:** `presignPut({ key, contentType, maxBytes, expiresSec }): Promise<{ url: string; headers: Record<string,string> }>`, `head(key): Promise<{ size: number; contentType: string } | null>`, `delete(key)`, `presignGet({ key, expiresSec })`, `publicUrl(key)`. `R2ObjectStorage` implements it with the AWS SDK v3 (`forcePathStyle: true`). Presigned PUT URLs expire in 300 s and sign `content-type` and `content-length-range` equivalents (reject on mismatch by validating with `head()` at confirm time).

**Settings (`GET/PATCH /api/v1/account/settings`):** `GET` returns `ProfileSettings` (id, firstName, lastName, displayName, jobTitle, email, phone, timezone, language, bio, avatarUrl, role, team, memberSince, username = local-part of email, mfaSummary, lastSignInAt, activeSessions, require2fa). `mfaSummary` is `"Hardware key"` when a WebAuthn key exists, else `"Authenticator app"` when TOTP is enabled, else `"Not enabled"`. `PATCH` accepts `UpdateProfileSettingsBody` (email is read-only); validate `timezone` ∈ `TIMEZONES` keys and `language` ∈ `LANGUAGES` keys; keep `full_name = firstName + " " + lastName` in sync; `display_name` is what the audit log shows as `actor_label` for this user going forward is NOT changed (audit labels stay the email local-part). Audit `PROFILE_UPDATED` with `details: { fields: <changed field names> }` (never values for `phone`).

**Avatar:** 
1. `POST /api/v1/account/avatar/upload-url` body `{ contentType, sizeBytes }` — allow `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`; `sizeBytes ≤ 4_194_304` else `422 { error: "file_too_large" }`; unsupported type → `422 { error: "unsupported_type" }`; object key `avatars/<userId>/<uuid>.<ext>`; returns `{ data: { uploadUrl, objectKey, expiresAt } }`.
2. `POST /api/v1/account/avatar/confirm` body `{ objectKey }` — key must start with `avatars/<own userId>/`; `head()` must exist, size ≤ 4 MB, content type in the allow-list; delete the previous avatar object; set `profiles.avatar_key`; audit `AVATAR_UPDATED`; returns `ProfileSettings` with `avatarUrl = storage.publicUrl(key)`. (Malware scanning and EXIF stripping are performed asynchronously by the maintenance worker in a later task; this route only validates and records the key. Add a `// TODO(worker)` comment.)
3. `DELETE /api/v1/account/avatar` — deletes the object, nulls `avatar_key`, audit `AVATAR_UPDATED`, `204`.

**Tests (assert):** PATCH rejects an unknown timezone; changing `firstName` updates `full_name`; avatar confirm rejects another user's key prefix; a 5 MB declared size is rejected at `upload-url`; SVG allowed but `application/pdf` rejected; audit `details` for a phone change contains the field name but not the number.

---

**Data shape (TypeScript):**
```ts
interface ProfileSettings { id: string; firstName: string; lastName: string; displayName: string; jobTitle: string | null; email: string; phone: string | null; timezone: string; language: "en-GB"|"en-US"|"sw"|"fr"; bio: string | null; avatarUrl: string | null; role: UserRole; team: Team | null; memberSince: string; username: string; mfaSummary: string; lastSignInAt: string | null; activeSessions: number; require2fa: boolean }
interface ObjectStorage { presignPut(i: { key: string; contentType: string; maxBytes: number; expiresSec: number }): Promise<{ url: string; headers: Record<string, string> }>; head(key: string): Promise<{ size: number; contentType: string } | null>; delete(key: string): Promise<void>; presignGet(i: { key: string; expiresSec: number }): Promise<string>; publicUrl(key: string): string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET   /api/v1/account/settings → 200 { data: ProfileSettings }
// PATCH /api/v1/account/settings  body { firstName: string(min1); lastName: string(min1); displayName: string(min2); jobTitle?: string; phone?: string; timezone: string; language: string; bio?: string(max400) } → 200 { data: ProfileSettings } | 400 validation_failed
// POST  /api/v1/account/avatar/upload-url body { contentType: "image/png"|"image/jpeg"|"image/webp"|"image/svg+xml"; sizeBytes: number(max 4194304) } → 200 { data: { uploadUrl: string; objectKey: string; expiresAt: string } } | 422 file_too_large | 422 unsupported_type
// POST  /api/v1/account/avatar/confirm body { objectKey: string } → 200 { data: ProfileSettings } | 400 validation_failed | 404 not_found
// DELETE /api/v1/account/avatar → 204
```

---

**Out of scope:**
- Do not implement malware scanning or EXIF stripping (maintenance worker).
- Do not proxy file bytes through the API; uploads go browser → R2 via presigned URL.
- Do not implement notification preferences or sessions (Task 29).

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 28 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 29 — Notification preferences, device sessions, deactivation request

**Layer:** L4

**Prerequisites:** Task 20c, Task 20d, Task 24, Task 25, Task 22

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Notification preferences, device sessions, deactivation request**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement notification preference storage, the active-sessions list with revoke / revoke-others, and the administrator deactivation request.

**Deliverables:**
- `apps/api/src/routes/v1/account-sessions/index.ts` — route plugin.
- `apps/api/src/routes/v1/account-sessions/service.ts` — services.
- `apps/api/src/routes/v1/account-sessions/repo.ts` — repos.
- `apps/api/src/lib/notify.ts` — `NotificationDispatcher` (resolves preferences, quiet hours, and enqueues `notify` jobs).
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/account-sessions/account-sessions.test.ts` — tests.
- `apps/api/src/lib/notify.test.ts` — dispatcher tests.
- MODIFY `apps/api/src/plugins/providers.ts` — decorate `app.notify`.
- MODIFY `apps/api/src/types/fastify.d.ts` — add `app.notify`.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Auth: `authenticate`. Users act only on their own rows.

**Notification preferences:** `GET /api/v1/account/notifications` returns every `NotificationEvent` (11 keys) with `{ inApp, email, sms, push }`, filling missing rows with the planner defaults (`inApp: true, email: true, sms: false, push: false`) and `quietHours: { enabled, from, to }`. `PUT` replaces all rows atomically (upsert 11 rows + `notification_settings`); validate `HH:MM` 24-hour times; when `enabled` is true both `from` and `to` are required and must differ. Audit `NOTIFICATION_PREFS_UPDATED` (details: `{ changed: <event keys> }`).

**`NotificationDispatcher.dispatch({ userId, event, title, body, critical?: boolean })`:** loads the user's preferences + quiet hours (in the user's `timezone`); for each enabled channel enqueue a `notify` job (payloads from `@vunvault/contracts` `NotifyJobPayload`). `critical: true` (used by credential changes, SEV-1 broadcasts, review-gate escalations, incident-commander pages) IGNORES preferences and quiet hours and uses email + SMS (SMS only when a phone exists) + in-app. Non-critical during quiet hours: drop `sms` and `push`, keep `in_app` and `email`. Push is recorded but no push provider exists yet (log `debug`).

**Sessions:** `GET /api/v1/account/sessions` → non-revoked `user_sessions` for the user, newest first, `{ id, deviceLabel, ip, location ("<city>, <CC>" or null), mfaMethod, startedAt, current }` (`current` = id equals `req.user.sessionId`). `DELETE /api/v1/account/sessions/:id` → own, non-current only (revoking the current one → `409 { error: "use_logout" }`): `supabase.deleteSession(id)` + `revoked_at`; invalidate the Redis registry key `sess:<id>`; audit `SESSION_REVOKED`; `204`. `POST /api/v1/account/sessions/revoke-others` → revokes every other session the same way, returns `{ data: { revoked: n } }`, audit `SESSION_REVOKED` with `details: { count }`.

**Deactivation request:** `POST /api/v1/account/deactivation-request` body `{ reason }` — STAFF roles only (`403 forbidden` for clients). Sets `deactivation_requested_at`; does NOT deactivate anything. Dispatches a `critical` notification to every active `super_admin` (title `"Deactivation requested"`). Audit `DEACTIVATION_REQUESTED` (severity warning, SEV-2). `202`. Repeat requests within 24 h → `409 { error: "already_requested" }`.

**Tests (assert):** defaults filled for missing rows; `quietHours.enabled` without times → 400; dispatcher: normal event during quiet hours enqueues no `sms`; `critical` ignores opt-outs; revoking another user's session id → 404; revoke-others never touches the current session; staff-only deactivation.

---

**Data shape (TypeScript):**
```ts
interface NotificationPrefs { events: Record<NotificationEvent, { inApp: boolean; email: boolean; sms: boolean; push: boolean }>; quietHours: { enabled: boolean; from: string | null; to: string | null } }
interface SessionView { id: string; deviceLabel: string; ip: string | null; location: string | null; mfaMethod: MfaMethod | null; startedAt: string; current: boolean }
interface NotificationDispatcher { dispatch(i: { userId: string; event: NotificationEvent; title: string; body: string; critical?: boolean }): Promise<void> }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET    /api/v1/account/notifications → 200 { data: NotificationPrefs }
// PUT    /api/v1/account/notifications body NotificationPrefs → 200 { data: NotificationPrefs } | 400 validation_failed
// GET    /api/v1/account/sessions → 200 { data: SessionView[] }
// DELETE /api/v1/account/sessions/:id → 204 | 404 not_found | 409 { error: "use_logout" }
// POST   /api/v1/account/sessions/revoke-others → 200 { data: { revoked: number } }
// POST   /api/v1/account/deactivation-request body { reason: string(10..500) } → 202 | 403 forbidden | 409 { error: "already_requested" }
```

---

**Out of scope:**
- Do not implement push delivery or the notify worker.
- Do not actually deactivate accounts.
- Do not add new audit event types.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 29 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 30 — Client intake: client profile, onboarding, pen-test requests

**Layer:** L4

**Prerequisites:** Task 19, Task 20c, Task 20d, Task 24, Task 25, Task 29

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client intake: client profile, onboarding, pen-test requests**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the client profile, the 3-step onboarding submission, and pen-test request intake.

**Deliverables:**
- `apps/api/src/routes/v1/client/index.ts` — route plugin (profile, onboarding, pentest requests).
- `apps/api/src/routes/v1/client/service.ts` — services.
- `apps/api/src/routes/v1/client/repo.ts` — repos.
- `apps/api/src/lib/secret-hash.ts` — memory-hard hashing for the recovery answer (scrypt).
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/client/client.test.ts` — tests.
- `apps/api/src/lib/secret-hash.test.ts` — tests.

**Dependencies allowed:**
- None — use only existing (`node:crypto` scrypt).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Auth: `authenticate` + `requirePermission("profile:read" | "profile:write" | "scans:create")`; all data scoped to `req.user.orgId` (a user without an org → `403 { error: "no_org" }`).

**Client profile:** `GET /api/v1/profile` → `ClientProfile`: person fields from `profiles`; `clientCode` and `company { name, primaryDomain, industry }` from `organizations`; `plan` from the org's active `subscriptions` (`name`, `status`) or null; `stats.engagements` = count of the org's `scan_jobs`; `stats.openFindings` = count of `scan_findings` with `status in ('open','validated')` on jobs whose gate is `approved_released`; `stats.nextAssessmentInDays` = days until the nearest `pentest_requests.preferred_schedule` in the future (or null). `PATCH /api/v1/profile` updates the person fields and the org's `name`, `primary_domain`, `industry`; `primaryDomain` must be a bare hostname or an https URL (normalise to hostname); audit `PROFILE_UPDATED`.

**Onboarding:** `GET /api/v1/onboarding` → `{ data: { completed, completedAt } }`. `POST /api/v1/onboarding` body `{ step1, step2, step3 }` (schemas verbatim from the contract): requires `step1.email` to equal the session email (else `422 { error: "email_mismatch" }`); `dateOfBirth` ≥ 16 years (else field error `"You must be at least 16 years old."`); stores `date_of_birth`, `phone` (profiles), `career`, `entity`, recovery question, `recovery_answer_hash = scrypt(lowercase(trim(answer)), randomSalt)` formatted `scrypt$N$r$p$salt$hash` (N 2^15, r 8, p 1; verify with `timingSafeEqual`), `declarations`, `terms_version` (from env `TERMS_VERSION`, default `2026-09`), `completed_at`. Re-submission after completion → `409 { error: "already_completed" }`. `entity` is also written to `profiles.account_type` mapping `individual → individual`, `company|corporation → company`. Audit `ONBOARDING_COMPLETED`.

**Pen-test requests:** `POST /api/v1/pentest-requests` body `{ targetUrl, targetType, preferredSchedule?, notes? }`: `targetUrl` must be a valid hostname, URL, IPv4/CIDR; reject private/loopback/link-local targets (`127.*`, `10.*`, `172.16–31.*`, `192.168.*`, `169.254.*`, `localhost`) with `422 { error: "target_not_allowed" }` — internal assessments are scoped by an engagement lead, not by this form; `preferredSchedule` must be in the future; inserts `pentest_requests` (the DB generates `ref_code`, format `VV-PT-000123`); enqueue a `notify` email to the engagement inbox env `ENGAGEMENT_INBOX` and an acknowledgement email to the requester stating a named engagement lead will reply within one business day; audit `PENTEST_REQUESTED`; `201 { data: { id, refCode, targetUrl, targetType, status: "received", createdAt } }`.

**Tests (assert):** profile stats computed from fixtures; PATCH normalises `https://acmefintech.co.ke/path` to `acmefintech.co.ke`; onboarding rejects a 15-year-old DOB; recovery answer is stored as a scrypt string and never plaintext, and `"Nairobi"` / `" nairobi "` verify equal; second onboarding → 409; pen-test target `10.24.8.11` → 422; the returned `refCode` matches `^VV-PT-\d{6}$` (fake repo mimics the generated column).

---

**Data shape (TypeScript):**
```ts
interface ClientProfile { id: string; fullName: string; jobTitle: string | null; email: string; phone: string | null; clientCode: string; company: { name: string; primaryDomain: string | null; industry: Industry | null }; plan: { name: string; status: "active" | "past_due" | "canceled" | "incomplete" } | null; stats: { engagements: number; openFindings: number; nextAssessmentInDays: number | null }; updatedAt: string }
interface PentestRequest { id: string; refCode: string; targetUrl: string; targetType: PentestTargetType; status: "received"; createdAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET   /api/v1/profile → 200 { data: ClientProfile } | 403 { error: "no_org" }
// PATCH /api/v1/profile body { fullName: string(min2); jobTitle?: string; phone?: string; company: { name: string(min2); primaryDomain?: string; industry?: Industry } } → 200 { data: ClientProfile } | 400
// GET   /api/v1/onboarding → 200 { data: { completed: boolean; completedAt: string | null } }
// POST  /api/v1/onboarding body { step1: { fullName; dateOfBirth: date; phone?: string; email; emailConfirm }; step2: { career; entity }; step3: { recoveryQuestion; recoveryAnswer: string(min3); declarations: { infoAccurate: true; authorisedTesting: true; termsAccepted: true } } }
//   → 201 { data: { completed: true; completedAt: string } } | 400 validation_failed | 409 already_completed | 422 email_mismatch
// POST  /api/v1/pentest-requests body { targetUrl: string(min3); targetType: "web_application"|"network_infrastructure"|"api"|"mobile_app"; preferredSchedule?: string(ISO); notes?: string(max2000) } → 201 { data: PentestRequest } | 400 | 422 target_not_allowed
```

---

**Out of scope:**
- Do not implement scan creation (Task 35).
- Do not implement a recovery-by-question flow (only storing the hashed answer).
- Do not build email templates beyond plain subject/body strings.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 30 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 31 — Staff users admin: roster, summary, invitations, acceptance, account actions

**Layer:** L4

**Prerequisites:** Task 19, Task 20c, Task 24, Task 25, Task 29

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Staff users admin: roster, summary, invitations, acceptance, account actions**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the User & Access Management API: roster with filters, summary, scoped invitations, public invitation acceptance, and suspend / reactivate / enforce-MFA / role change / delete.

**Deliverables:**
- `apps/api/src/routes/v1/users/index.ts` — admin route plugin.
- `apps/api/src/routes/v1/users/invitations-public.ts` — public acceptance routes.
- `apps/api/src/routes/v1/users/service.ts` — `UsersService`.
- `apps/api/src/routes/v1/users/repo.ts` — repos.
- `apps/api/src/routes/v1/users/tokens.ts` — invitation token generation/hash.
- MODIFY `packages/contracts/src/users.ts` — add `InvitationPreview`, `AcceptInvitationBody`.
- MODIFY `packages/contracts/src/routes-a.ts` — add the two public routes.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/users/users.test.ts` — tests.
- `apps/api/src/routes/v1/users/tokens.test.ts` — tests.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Auth: every `/admin/users*` route uses `[authenticate, requireStaff, requirePermission(...)]`: GET routes need `users:read`; every mutation needs `users:manage` (held ONLY by `super_admin`). Public invitation routes use no auth, rate policy `public_form`.

**Roster (`GET /api/v1/admin/users`):** exclude soft-deleted; `q` ILIKE on `full_name`, `email`, `scope_summary`; filters `role`, `status`, `mfa` (`enrolled` = `mfa_enrolled`, `not_enrolled`); default sort `last_active_at desc nulls last`; each row is `StaffMember` (`initials` = first letters of the first and last name, e.g. `"Evelyn Reed"` → `"ER"`; the title `Dr.` is stripped before computing). Only staff roles are listed (`role <> 'client'`). Pending invitations appear in the roster as rows with `accountStatus: "pending_invite"` (fields from `staff_invitations`) when no profile exists yet.
**Summary (`GET /api/v1/admin/users/summary`):** `activeMembers` = staff with status `active`; `securityAnalysts` = role `security_analyst`, status active; `operators` = role `soc_operator`, status active; `pendingInvitations` = invitations `pending` and not expired; `mfaEnrolmentPercent` = round(100 × active staff with `mfa_enrolled` ÷ active staff); `accountsWithoutMfa`; `dormantAccounts` = status `dormant`; `onboardedThisMonth` = profiles joined this UTC month.

**Invitations (`POST /api/v1/admin/users/invitations` body `ProvisionInviteBody`):** email must end with `@vunvault.com` (case-insensitive) and be unused; `role` must be a staff role; only `super_admin` may invite `admin` or `super_admin`; `team` required; checklist `mfaEnrolmentMandatory` must be `true`. Token: 32 random bytes base64url; store `sha256(token)` as `token_hash`; `expires_at = now + 72 h`. `draft: true` stores `status = 'draft'` and sends nothing. Otherwise status `pending` and send an email via `app.email` with a link `${WEB_ORIGIN}/accept-invite?token=<token>` (subject `"You've been invited to VUNVAULT"`; body states the invitation expires in 72 hours and MFA enrolment is mandatory). Audit `USER_PROVISIONED` — message `"Invitation issued to <email> as <Role label> — <Team label> · MFA enrolment required within 72 h"` — and notify `team_member_provisioned` subscribers (use `app.notify`, non-critical, target: active super_admins). `POST …/invitations/:id/resend`: only `pending`, max 5 resends, new token + new 72 h expiry, `resend_count++`, audit `INVITATION_RESENT`. `DELETE …/invitations/:id`: set `status = 'revoked'`, audit `INVITATION_REVOKED`, `204`.

**Public acceptance:** `GET /api/v1/invitations/:token` → `InvitationPreview { email, fullName, role, roleLabel, team, teamLabel, expiresAt }` for a `pending`, unexpired invitation (hash lookup; anything else → `404 { error: "not_found" }`, same response for unknown/expired/used). `POST /api/v1/invitations/:token/accept` body `AcceptInvitationBody { password, confirmPassword }` (min **14** chars, same complexity rules, breach check, confirm match): create the Supabase user with `emailConfirm: true` (the invitation proves mailbox ownership), insert the `profiles` row (`role`, `team`, `access_tier`, `scope_notes`, `account_status: 'active'`, `mfa_enrolled: false`, `access_review_due`), mark the invitation `accepted`, sign the user in (`setSessionCookies`, `user_sessions` row), audit `INVITATION_ACCEPTED`, respond `201 { data: SessionUser, mfaEnrolmentRequired: true }`. Because the session is `aal1`, every `/admin/*` route answers `mfa_required` until the user enrols a factor (Task 27).

**Account actions** (body `{ reason? }` unless noted; `:id` = profile id; self-targeting rules apply):
- `POST …/:id/suspend` — cannot suspend yourself or the last active `super_admin`; set `account_status = 'suspended'`, `suspended_at`, `suspended_reason`; revoke ALL the user's sessions (`supabase.deleteSession` for each + `revoked_at` + Redis registry invalidation); audit `ACCOUNT_SUSPENDED` (message `"<email> suspended and all session tokens revoked"`).
- `POST …/:id/reactivate` — only from `suspended`/`dormant`; audit `ACCOUNT_REACTIVATED`.
- `POST …/:id/enforce-mfa` — only when `mfa_enrolled = false`; set `require_2fa = true`; email an enrolment reminder; audit `MFA_ENFORCED`.
- `PATCH …/:id/role` body `{ role }` — cannot change your own role; granting/removing `admin`/`super_admin` requires the actor to be `super_admin` (always true given `users:manage`); cannot demote the last `super_admin`; after the change revoke the target's sessions so new JWT claims apply; audit `PERMISSION_CHANGED` (severity warning, SEV-2; message `"Role changed for <email> — <old label> → <new label>"`).
- `DELETE …/:id` — soft delete (`deleted_at`, `account_status = 'suspended'`), same safeguards as suspend, revoke sessions, audit `ACCOUNT_DELETED`; `204`.
Every action returns `200 { data: StaffMember }` (except delete).

**Tests (assert):** admin cannot call `suspend` (403, lacks `users:manage`); `@gmail.com` invite rejected; token hash stored and raw token only in the email; expired and reused tokens return identical 404; accept creates an active profile and an `aal1` session; last `super_admin` cannot be suspended/demoted/deleted; role change revokes sessions; summary numbers computed from fixtures; resend limit of 5.

---

**Data shape (TypeScript):**
```ts
interface InvitationPreview { email: string; fullName: string; role: UserRole; roleLabel: string; team: Team; teamLabel: string; expiresAt: string }
interface AcceptInvitationBody { password: string; confirmPassword: string }
// StaffMember, StaffSummary, ProvisionInviteBody, Invitation: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET    /api/v1/admin/users            query { page; pageSize; q?; role?; status?: "active"|"pending_invite"|"suspended"|"dormant"; mfa?: "enrolled"|"not_enrolled" } → 200 { data: StaffMember[]; total }
// GET    /api/v1/admin/users/summary → 200 { data: StaffSummary }
// POST   /api/v1/admin/users/invitations body ProvisionInviteBody → 201 { data: Invitation } | 400 validation_failed | 403 forbidden | 409 { error: "email_taken" }
// POST   /api/v1/admin/users/invitations/:id/resend → 200 { data: Invitation } | 404 | 409 { error: "resend_limit" }
// DELETE /api/v1/admin/users/invitations/:id → 204
// POST   /api/v1/admin/users/:id/suspend | /reactivate | /enforce-mfa  body { reason?: string(max500) } → 200 { data: StaffMember } | 404 | 409 { error: "last_super_admin" | "self_action" | "invalid_state" }
// PATCH  /api/v1/admin/users/:id/role body { role: UserRole } → 200 { data: StaffMember } | 409 same codes
// DELETE /api/v1/admin/users/:id → 204 | 409 same codes
// GET    /api/v1/invitations/:token → 200 { data: InvitationPreview } | 404 { error: "not_found" }
// POST   /api/v1/invitations/:token/accept body { password: string(min14); confirmPassword } → 201 { data: SessionUser; mfaEnrolmentRequired: true } | 400 | 404 | 422 breached_password
```

---

**Out of scope:**
- Do not implement MFA enrolment (Task 27) or the UI.
- Do not allow any route to change `audit_entries`.
- Do not email raw tokens anywhere except the invitation email.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 31 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 32 — Billing foundation: provider clients, invoice issuance (ledger), subscription, payment method, invoices, PDF/CSV

**Layer:** L4

**Prerequisites:** Task 17, Task 20, Task 20b, Task 22, Task 24, Task 25, Task 28

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Billing foundation: provider clients, invoice issuance (ledger), subscription, payment method, invoices, PDF/CSV**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Stripe and Paystack REST clients, the ledger-posting `InvoiceIssuer`, and the client billing read/update routes (subscription, payment method, invoice list, invoice PDF, invoice CSV).

**Deliverables:**
- `apps/api/src/routes/v1/billing/index.ts` — route plugin.
- `apps/api/src/routes/v1/billing/service.ts` — `BillingService`.
- `apps/api/src/routes/v1/billing/repo.ts` — repos (invoices, balances, subscriptions, payment methods).
- `apps/api/src/billing/ledger.ts` — `LedgerService` (`post(tx, entry)`; enforces balanced lines, idempotency key, positive amounts).
- `apps/api/src/billing/invoice-issuer.ts` — `InvoiceIssuer.issue(tx, input)`.
- `apps/api/src/billing/invoice-number.ts` — `nextInvoiceNumber(tx, year)`.
- `apps/api/src/billing/providers/stripe.ts` — `StripeClient` (fetch-based REST).
- `apps/api/src/billing/providers/paystack.ts` — `PaystackClient` (fetch-based REST).
- `apps/api/src/billing/providers/index.ts` — `PaymentProviders` interface + plugin decorating `app.payments`.
- `apps/api/src/billing/csv.ts` — safe CSV writer.
- `packages/db/sql/0032_invoice_numbers.sql` — per-year invoice counters.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/billing/billing.test.ts` — ledger + issuer tests.
- `apps/api/src/routes/v1/billing/billing.test.ts` — route tests.
- MODIFY `apps/api/src/types/fastify.d.ts` — add `app.payments`.

**Dependencies allowed:**
- None — use only existing (global `fetch`, `node:crypto`). Do NOT install the Stripe or Paystack SDK.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Money rules (comment at the top of `ledger.ts`):** (1) Settlement is USD, always; every amount is integer USD cents. (2) The ledger is the source of truth; invoices are views — never store a mutable "paid" amount. (3) Ledger rows are immutable; corrections are reversal entries. (4) No raw card data ever touches this API: browsers tokenise with Stripe.js / Paystack, we receive tokens. (5) No cryptocurrency.

**`LedgerService.post(tx, { orgId, kind, memo, referenceType, referenceId, idempotencyKey, lines: { accountCode, direction, amountUsdCents }[], createdBy })`:** reject unless Σdebit = Σcredit and every amount is a positive safe integer; resolve account ids by `ledger_accounts.code`; if `idempotency_key` already exists return the existing entry id (no duplicate). Posting recipes (document as constants): `invoice_issued`: debit `accounts_receivable`, credit `revenue_services` | `revenue_subscription` | `revenue_academy` (by plan unit/kind); `payment_captured`: debit `cash_stripe_clearing` | `cash_paystack_clearing`, credit `accounts_receivable`; `refund`: debit `refunds`, credit the same cash clearing account.

**`InvoiceIssuer.issue(tx, { orgId, title, detail, lines: { description, quantity, unitUsdCents, planCode? }[], dueInDays = 14, scanJobId? })`:** allocate `number` = `VV-INV-<year>-<4-digit counter>` using the per-year counter table (`INSERT … ON CONFLICT DO UPDATE SET last = last + 1 RETURNING last`, in SQL file `0032_invoice_numbers.sql`: `invoice_counters(year int primary key, last int not null)`); insert `invoices` (`status 'pending'`, `settlement_currency 'USD'`) and `invoice_lines`; post the `invoice_issued` ledger entry (idempotency key `inv:<invoiceId>`); link `ledger_entry_id` on the lines; audit `INVOICE_ISSUED` through the caller's `audited()` wrapper (the issuer itself does not audit — document this).

**Provider clients (global `fetch`, 8 s timeout, `Idempotency-Key` header on every POST):**
- `StripeClient` (`https://api.stripe.com/v1`, Bearer `STRIPE_SECRET_KEY`, form-encoded): `createCustomer`, `attachPaymentMethod(pmId, customerId)`, `setDefaultPaymentMethod`, `retrievePaymentMethod(pmId)` → `{ brand, last4, expMonth, expYear }`, `detachPaymentMethod`, `createPaymentIntent({ amountUsdCents, customerId, paymentMethodId, idempotencyKey, returnUrl, metadata })` (always `currency=usd`, `confirm=true`, `automatic_payment_methods[enabled]=true`, `automatic_payment_methods[allow_redirects]=never` unless a redirect is configured), `refund({ paymentIntentId, amountUsdCents })`, and `verifyWebhook(rawBody: Buffer, signatureHeader: string, toleranceSec = 300)` implementing Stripe's `t=…,v1=…` HMAC-SHA256 scheme with `timingSafeEqual`.
- `PaystackClient` (`https://api.paystack.co`, Bearer `PAYSTACK_SECRET_KEY`, JSON): `initializeTransaction({ email, amountUsdCents, reference, channels, metadata })` (amount in the currency's minor unit, `currency: "USD"`), `verifyTransaction(reference)`, `refund({ transaction, amountUsdCents })`, `verifyWebhook(rawBody, signatureHeader)` (HMAC-SHA512 of the raw body with the secret key, `timingSafeEqual`).
- Both throw `ProviderError` from Task 22 (`retryable` for 5xx/timeouts). Tests stub `fetch` and assert request shape (currency `usd`/`USD`, amounts in cents, idempotency header).

**Routes** (client portal; `[authenticate, requirePermission("billing:read" | "billing:manage")]`; all data scoped to `req.user.orgId`, no org → `403 { error: "no_org" }`):
- `GET /api/v1/billing/subscription` → `Subscription` (`planName`, `status`, `billingCycle`, `amountUsdCents`, `settlementCurrency: "USD"`, `renewsOn`, `description` from `plans.description`) or `404 { error: "not_found" }`.
- `GET /api/v1/billing/payment-method` → default `PaymentMethodView` or `404`.
- `PUT /api/v1/billing/payment-method` body `{ provider, providerPaymentMethodToken, cardholderName, billingCountry }` (`billing:manage`): Stripe → ensure `organizations.stripe_customer_id` (create customer if null), `attachPaymentMethod`, `setDefaultPaymentMethod`, `retrievePaymentMethod` to get brand/last4/expiry; Paystack → store the authorisation reference the same way (`brand`, `last4`, `exp_*` returned by `verifyTransaction`). Replace the previous default (`is_default=false`, detach at the provider best-effort). Persist ONLY `provider_payment_method_id`, brand, last4, expiry, cardholder name, country. Audit `PAYMENT_METHOD_UPDATED` (details: `{ brand, last4 }`). Changes apply from the next billing cycle.
- `GET /api/v1/billing/invoices` query `{ page, pageSize, status? }` → `{ data: Invoice[], total }` from `invoices` ⋈ `invoice_balances` (`totalUsdCents`, `paidUsdCents`, `outstandingUsdCents`), ordered `issued_at desc`; `pdfAvailable = pdf_object_key IS NOT NULL`.
- `GET /api/v1/billing/invoices/:id/pdf` → own invoice only (else 404). If `pdf_object_key` exists stream it from `app.storage` (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<number>.pdf"`, `Cache-Control: private, no-store`); otherwise enqueue a `pdf` job `{ kind: "invoice", refId }` and respond `202 { data: { status: "generating" } }`.
- `GET /api/v1/billing/invoices.csv` → streams `text/csv` of all the org's invoices; header row `Order / Invoice ID,Date,Service Description,Status,Amount (USD)`; the CSV writer prefixes any cell starting with `=`, `+`, `-`, `@` with a single quote (formula-injection defence) and quotes cells with commas.

**Tests (assert):** unbalanced ledger entry rejected; duplicate idempotency key returns the first entry id; invoice numbers increment `…-0841`, `…-0842`; `StripeClient.verifyWebhook` accepts a correctly signed body, rejects a tampered body and a timestamp older than 300 s; `PaystackClient.verifyWebhook` same; Stripe PaymentIntent request carries `currency=usd`; client of org A cannot read org B's invoice (404); CSV cell `=cmd()` is neutralised; payment-method PUT never stores the token itself beyond `provider_payment_method_id`.

---

**Data shape (TypeScript):**
```ts
interface PaymentProviders { stripe: StripeClient; paystack: PaystackClient }
interface Invoice { id: string; number: string; issuedAt: string; title: string; detail: string | null; totalUsdCents: number; paidUsdCents: number; outstandingUsdCents: number; status: "draft"|"pending"|"paid"|"overdue"|"void"; settlementCurrency: "USD"; pdfAvailable: boolean }
interface Subscription { id: string; planName: string; status: "active"|"past_due"|"canceled"|"incomplete"; billingCycle: "monthly"|"annual"; amountUsdCents: number; settlementCurrency: "USD"; renewsOn: string; description: string }
interface PaymentMethodView { id: string; provider: "stripe"|"paystack"; brand: string; last4: string; expMonth: number; expYear: number; cardholderName: string | null; billingCountry: string | null }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/billing/subscription → 200 { data: Subscription } | 404 not_found | 403 no_org
// GET  /api/v1/billing/payment-method → 200 { data: PaymentMethodView } | 404 not_found
// PUT  /api/v1/billing/payment-method body { provider: "stripe"|"paystack"; providerPaymentMethodToken: string; cardholderName: string(min2); billingCountry: string(len2) } → 200 { data: PaymentMethodView } | 400 | 422 { error: "payment_method_rejected" }
// GET  /api/v1/billing/invoices query { page; pageSize; status? } → 200 { data: Invoice[]; total }
// GET  /api/v1/billing/invoices/:id/pdf → 200 application/pdf | 202 { data: { status: "generating" } } | 404 not_found
// GET  /api/v1/billing/invoices.csv → 200 text/csv
```

---

**Out of scope:**
- Do not implement FX quotes or checkout (Task 33).
- Do not implement webhooks or refunds (Task 34).
- Do not implement PDF rendering (the pdf worker).
- Do not store or log raw card data, tokens, or CVC.
- Do not add any crypto provider.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Every provider request in tests asserts a USD currency value; no non-USD currency is ever sent to a provider.
☐ Report at the end: `Task 32 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 33 — FX quotes and USD checkout

**Layer:** L4

**Prerequisites:** Task 17, Task 20, Task 32, Task 24, Task 25

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **FX quotes and USD checkout**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement locked display-only FX quotes and the checkout route that always charges the outstanding invoice amount in USD through Stripe or Paystack.

**Deliverables:**
- `apps/api/src/routes/v1/checkout/index.ts` — route plugin.
- `apps/api/src/routes/v1/checkout/service.ts` — `FxService`, `CheckoutService`.
- `apps/api/src/routes/v1/checkout/repo.ts` — repos.
- `apps/api/src/billing/fx-rates.ts` — `FxRateSource` interface + `HttpFxRateSource`.
- `apps/api/src/billing/money.ts` — BigInt USD→local conversion.
- `apps/api/src/billing/money.test.ts` — tests.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/checkout/checkout.test.ts` — tests.
- MODIFY `apps/api/src/config/env.ts` — add `FX_API_URL: url` (default `https://open.er-api.com/v6/latest/USD`), `FX_QUOTE_TTL_SECONDS` default 900.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Auth: `[authenticate, requirePermission("billing:manage")]`, org-scoped. Rate policy `sensitive`.

**FX quote flow (state this in a comment at the top of `service.ts`):** (1) client asks for a quote for ONE invoice in a display currency → (2) server locks a rate for 15 minutes and returns the local amount for DISPLAY → (3) checkout charges `usdCents` in USD. A quote can never change the charged amount; it can only be consumed once.

**Rates (`FxRateSource.getRate(currency): Promise<string>`):** `HttpFxRateSource` GETs `FX_API_URL`, reads `rates[KES|NGN|GHS|ZAR]`, caches the whole payload in Redis `fx:latest` for 15 minutes, converts to a fixed 8-decimal string; timeout 4 s; failure with no cache → `502 { error: "fx_unavailable" }`. `USD` is always `"1.00000000"`.

**Conversion (`money.ts`):** `usdCentsToLocalMinor(usdCents: number, rate: string): number` using BigInt at 1e8 scale, round half up — NEVER floating point. Test: `usdCentsToLocalMinor(249900, "129.50000000") === 32362050`; `usdCentsToLocalMinor(89900, "1.00000000") === 89900`.

**`POST /api/v1/billing/fx-quotes` body `{ invoiceId, displayCurrency }`:** invoice must belong to the org, be `pending`/`overdue`, and have `outstanding_usd_cents > 0` (else `409 { error: "already_paid" }`); `displayCurrency` ∈ `USD|KES|NGN|GHS|ZAR` (else `422 { error: "unsupported_currency" }`); insert `fx_quotes` (`usd_cents` = current outstanding, `rate_local_per_usd`, `local_minor`, `locked_at`, `expires_at = now + 900 s`); audit `FX_QUOTE_LOCKED`; `201 { data: FxQuote }` with `settlementCurrency: "USD"`.

**`POST /api/v1/billing/checkout` body `{ invoiceId, fxQuoteId?, provider, channel, providerPaymentMethodToken?, idempotencyKey }` (`idempotencyKey` ≥ 16 chars):**
1. Idempotency: if a `payment_attempts` row with this key exists → return its current state with `200` (never create a second attempt).
2. Load the invoice + balance; `outstanding_usd_cents` is the ONLY amount charged. Zero → `409 already_paid`.
3. If `fxQuoteId` is given: it must belong to the org and invoice, `expires_at > now` and `consumed_at IS NULL` (else `409 { error: "quote_expired" }`), and `usd_cents` must equal the current outstanding (else `409 { error: "amount_changed" }`). Mark `consumed_at = now()` in the same transaction.
4. Routing: `channel = "card"` with `provider = "stripe"` → `StripeClient.createPaymentIntent` (requires `providerPaymentMethodToken` or the org's default method; `currency=usd`); `provider = "paystack"` (any channel) → `PaystackClient.initializeTransaction` with `currency: "USD"`, `channels: ["card"] | ["mobile_money"] | ["bank_transfer"]` per channel, reference = the attempt id; `channel = "mpesa"` REQUIRES `provider = "paystack"` (validated by the contract). Provider rejection of the channel/currency combination → `422 { error: "channel_unavailable" }` (comment: if Paystack cannot present USD for M-Pesa on the merchant account, this is where it surfaces).
5. Insert `payment_attempts` (`usd_cents`, `settlement_currency 'USD'`, `status` mapped from the provider response: `succeeded` | `requires_action` | `created`), `provider_reference`, `fx_quote_id`, `idempotency_key`.
6. Audit `PAYMENT_ATTEMPT_CREATED` (details: `{ provider, channel, usdCents }`).
7. Respond `201 { data: { paymentAttemptId, status, usdCents, settlementCurrency: "USD", clientSecret?, redirectUrl? } }`. The LEDGER is NOT posted here — only the signature-verified webhook posts `payment_captured` (Task 34), even when the provider says `succeeded` synchronously.

**Tests (assert):** quote math; expired quote → 409; consumed quote cannot be reused; amount change after quoting → 409; duplicate idempotency key returns the same attempt id; the Stripe request body contains `currency=usd` and the exact outstanding cents even when the quote was in KES; `mpesa` + `stripe` rejected; checkout never posts to the ledger (assert the fake LedgerService was not called); org B cannot quote org A's invoice.

---

**Data shape (TypeScript):**
```ts
interface FxQuote { id: string; invoiceId: string; displayCurrency: "USD"|"KES"|"NGN"|"GHS"|"ZAR"; rateLocalPerUsd: string; usdCents: number; localMinor: number; lockedAt: string; expiresAt: string; settlementCurrency: "USD" }
interface CheckoutResponseData { paymentAttemptId: string; status: "created"|"requires_action"|"succeeded"|"failed"; usdCents: number; settlementCurrency: "USD"; clientSecret?: string; redirectUrl?: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/billing/fx-quotes body { invoiceId: string(uuid); displayCurrency: "USD"|"KES"|"NGN"|"GHS"|"ZAR" } → 201 { data: FxQuote } | 404 | 409 already_paid | 422 unsupported_currency | 502 fx_unavailable
// POST /api/v1/billing/checkout  body { invoiceId; fxQuoteId?: string(uuid); provider: "stripe"|"paystack"; channel: "card"|"mpesa"|"bank_transfer"; providerPaymentMethodToken?: string; idempotencyKey: string(min16) }
//   → 201 { data: CheckoutResponseData } | 200 (idempotent replay) | 400 | 409 { error: "quote_expired" | "amount_changed" | "already_paid" } | 422 { error: "channel_unavailable" }
```

---

**Out of scope:**
- Do not post ledger entries (webhooks do, Task 34).
- Do not charge any non-USD amount, under any condition.
- Do not accept an amount from the client; the amount is always server-derived.
- Do not implement the UI or provider JS SDK usage.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ A test proves that a quote in `NGN` for an outstanding $2,499.00 results in a provider call for 249900 USD cents.
☐ Report at the end: `Task 33 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 34 — Payment webhooks, ledger posting, refunds, ledger reconciliation

**Layer:** L4

**Prerequisites:** Task 17, Task 20b, Task 23, Task 25, Task 32, Task 33

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Payment webhooks, ledger posting, refunds, ledger reconciliation**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement signature-verified, idempotent Stripe and Paystack webhooks that post `payment_captured` ledger entries and update invoices and scan payment state, plus admin refunds and ledger reconciliation.

**Deliverables:**
- `apps/api/src/routes/v1/webhooks/index.ts` — `/webhooks/stripe`, `/webhooks/paystack`.
- `apps/api/src/routes/v1/webhooks/service.ts` — `WebhookService`.
- `apps/api/src/routes/v1/payments-admin/index.ts` — refund + reconcile routes.
- `apps/api/src/routes/v1/payments-admin/service.ts` — `RefundService`, `ReconcileService`.
- `apps/api/src/routes/v1/payments-admin/repo.ts` — repos.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/webhooks/webhooks.test.ts` — tests.
- `apps/api/src/routes/v1/payments-admin/payments-admin.test.ts` — tests.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Webhook routes (`POST /api/v1/webhooks/stripe`, `/webhooks/paystack`):** route `config: { rawBody: true, csrf: false, rateLimitPolicy: "webhook" }`; no auth. Steps: (1) verify the signature with `StripeClient.verifyWebhook` / `PaystackClient.verifyWebhook` over the RAW body — invalid → `401 { error: "bad_signature" }` + `auditFailure` `WEBHOOK_SIGNATURE_INVALID`; (2) insert `provider_webhook_events (provider, event_id, payload)`; a unique-violation means a replay → respond `200 { received: true }` WITHOUT reprocessing; (3) process inside `app.withTx`, set `processed_at`; (4) always `200 { received: true }` for events we ignore. A processing error returns `500` so the provider retries (the event row is rolled back with the transaction).

**Event handling:**
- Stripe `payment_intent.succeeded` / Paystack `charge.success`: find the attempt by `provider_reference` (Stripe PaymentIntent id, Paystack reference = attempt id). Verify amount (`amount_received` / `amount`) equals `payment_attempts.usd_cents` AND currency is USD (`usd`/`USD`); mismatch → mark attempt `failed` with `failure_code = "amount_mismatch"`, audit `PAYMENT_FAILED`, DO NOT post to the ledger, still `200`. Otherwise: set attempt `succeeded`; `LedgerService.post` `payment_captured` (debit `cash_stripe_clearing` | `cash_paystack_clearing`, credit `accounts_receivable`; idempotency key `pay:<attemptId>`); recompute the invoice from `invoice_balances` — when outstanding is 0 set `invoices.status = 'paid'`; if the invoice has `scan_job_id`: set that job's `payment_status = 'paid'` and, if its `review_gate_state = 'blocked_payment'`, set it to `in_review`; enqueue a `notify` receipt email; audit `PAYMENT_CAPTURED` (message `"<invoice number> paid · $<amount> via <provider>"`).
- Stripe `payment_intent.payment_failed` / Paystack `charge.failed`: attempt → `failed`, `failure_code` from the provider; audit `PAYMENT_FAILED`; notify the org's billing contacts (`dispatch`, non-critical).
- Stripe `payment_intent.requires_action`: attempt → `requires_action`.
- Stripe `charge.refunded` / Paystack `refund.processed`: reconcile with refunds created by `RefundService` (idempotent: if the refund entry exists, do nothing).
- Everything else: stored and ignored.
`actor` for audit entries from webhooks: `{ id: null, label: "system" }`.

**Refund (`POST /api/v1/admin/payments/:attemptId/refund`, `[authenticate, requireStaff, requirePermission("billing:manage")]`) body `{ reason: string(10..500), amountUsdCents?: number }`:** only `succeeded` attempts; default amount = the full attempt amount; amount ≤ attempt amount − already refunded (derived from `refund` ledger entries referencing the attempt) else `422 { error: "refund_exceeds_payment" }`; call the provider refund API (idempotency key `refund:<attemptId>:<n>`); `LedgerService.post` `refund` (debit `refunds`, credit the same cash clearing account, idempotency key `refund:<attemptId>:<n>`); when fully refunded set the invoice `status = 'void'`; audit `REFUND_ISSUED` (warning, SEV-3; message `"$<amount> refunded on <invoice number> — <reason>"`); `200 { data: { attemptId, refundedUsdCents, totalRefundedUsdCents } }`.

**Reconcile (`POST /api/v1/admin/payments/reconcile`, same guard):** scan the ledger and report `{ data: { checkedEntries, unbalancedEntries: string[], attemptsWithoutEntry: string[], entriesWithoutAttempt: string[], invoicesWithMismatchedStatus: string[], ranAt } }`: (a) every `journal_entries` row balances; (b) every `succeeded` attempt has a `payment_captured` entry; (c) every `payment_captured` entry references an existing attempt; (d) invoices with status `paid` have outstanding 0 and invoices with outstanding 0 are `paid` or `void`. Read-only (not audited; log at `info`).

**Tests (assert):** invalid signature → 401 + `WEBHOOK_SIGNATURE_INVALID`; replayed event id processed once (ledger has one entry); amount mismatch posts nothing and marks `failed`; successful event pays the invoice, flips a linked job's payment to `paid`, and moves `blocked_payment` → `in_review`; partial refund keeps the invoice `paid`, full refund voids it; refund above the paid amount → 422; a non-admin gets 403 on refund; reconcile detects a succeeded attempt with no ledger entry.

---

**Data shape (TypeScript):**
```ts
interface RefundResult { attemptId: string; refundedUsdCents: number; totalRefundedUsdCents: number }
interface ReconcileReport { checkedEntries: number; unbalancedEntries: string[]; attemptsWithoutEntry: string[]; entriesWithoutAttempt: string[]; invoicesWithMismatchedStatus: string[]; ranAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/webhooks/stripe   (raw body; header Stripe-Signature) → 200 { received: true } | 401 { error: "bad_signature" }
// POST /api/v1/webhooks/paystack (raw body; header x-paystack-signature) → 200 { received: true } | 401 { error: "bad_signature" }
// POST /api/v1/admin/payments/:attemptId/refund body { reason: string(10..500); amountUsdCents?: number(int>0) } → 200 { data: RefundResult } | 404 | 422 { error: "refund_exceeds_payment" | "not_refundable" }
// POST /api/v1/admin/payments/reconcile → 200 { data: ReconcileReport }
```

---

**Out of scope:**
- Do not trust any amount or currency from the webhook without comparing it to the stored attempt.
- Do not post to the ledger outside a signature-verified webhook or an admin refund.
- Do not add dashboard queries (Task 37).
- Do not add crypto handling.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 34 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 35 — Scans API: client scans, admin queue, mandatory review gate, release lock

**Layer:** L4

**Prerequisites:** Task 16, Task 19, Task 24, Task 25, Task 29, Task 33, Task 34

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Scans API: client scans, admin queue, mandatory review gate, release lock**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement scan job creation and listing, the admin Scan Queue with summary and bulk actions, and the Mandatory Admin Review Gate — including the payment lock and the client-portal release lock.

**Deliverables:**
- `apps/api/src/routes/v1/scans/index.ts` — client + admin route plugin.
- `apps/api/src/routes/v1/scans/service.ts` — `ScansService`.
- `apps/api/src/routes/v1/scans/gate.ts` — `ReviewGate` (pure rules).
- `apps/api/src/routes/v1/scans/repo.ts` — repos.
- `apps/api/src/routes/v1/scans/visibility.ts` — `clientVisibleWhere()`.
- `apps/api/src/routes/v1/scans/authorisation.ts` — signed-authorisation upload URL + validation.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/scans/scans.test.ts` — route tests.
- `apps/api/src/routes/v1/scans/gate.test.ts` — rule tests.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Scan execution is NOT done here: creating a job only enqueues it on the BullMQ `scan` queue; an unprivileged Docker pod on k3s runs it later (Layer L10). The API never talks to scan infrastructure directly.

**Client routes** (`[authenticate, requirePermission("scans:read" | "scans:create")]`, org-scoped):
- `POST /api/v1/scans/authorisation-url` body `{ contentType: "application/pdf", sizeBytes ≤ 10 MB }` → presigned PUT to `authorisations/<orgId>/<uuid>.pdf` via `app.storage` → `{ data: { uploadUrl, objectKey, expiresAt } }`.
- `POST /api/v1/scans` body `CreateScanBody`: `authorisationDocKey` must start with `authorisations/<orgId>/` and exist in storage (`head`), else `422 { error: "authorisation_missing" }`; `targetHost` must be a hostname, https URL host, IPv4 or CIDR; reject loopback/link-local/metadata targets (`127.*`, `169.254.*`, `localhost`, `metadata.*`) with `422 { error: "target_not_allowed" }`; Insert `scan_jobs` (`status 'queued'`, `payment_status 'pending'`, `review_gate_state 'not_eligible'`; `job_code` is DB-generated), enqueue `scan` job `{ jobId, attempt: 1, targetHost, scanType, requestedBy }` with `jobId` = the BullMQ job id `scan:<uuid>`; audit `SCAN_REQUESTED`; `201 { data: ScanJob }`.
- `GET /api/v1/scans` query `ScanListQuery`. **RELEASE LOCK (security-critical):** a client sees a job ONLY IF `org_id = req.user.orgId` AND `review_gate_state = 'approved_released'`. Anything else is invisible: omit it from lists and return `404 { error: "not_found" }` for direct fetches (never `403`, never a hint that it exists). Implement as the single function `clientVisibleWhere(orgId)` used by every client scan/report/finding query, and add a unit test that fails if any client route builds its own filter.
- `GET /api/v1/scans/:id` (visible jobs only) and `GET /api/v1/scans/:id/findings` → `ScanFinding[]` with `evidence_redacted` only (never raw evidence).

**Admin routes** (`[authenticate, requireStaff, requirePermission("scans:read")]` for reads, `"scans:review"` for review actions, `"scans:release"` for release):
- `GET /api/v1/admin/scans` query `ScanListQuery` (`q` ILIKE on `job_code`, `target_host`, org name, `requester_email`); default order `requested_at desc`; rows are `ScanJob` with `client { orgId, name, contactEmail }`.
- `GET /api/v1/admin/scans/summary` → `ScanQueueSummary`: `jobsInQueue` = `status in ('queued','running','awaiting_review')`; `addedToday` = requested since 00:00 UTC; `runningScans`; `workerSlotsTotal` = env `WORKER_SLOTS_TOTAL` (default 24), `workerSlotsUsed` = running; `awaitingAdminReview` = gate `in_review`; `approvedReleased` = gate `approved_released`; `releasedThisWeek` = `released_at` in the last 7 days; `paymentOutstanding` = `payment_status <> 'paid'`; `overdueOver14Days` = payment `overdue` older than 14 days; `heldRejected` = status `held` or `rejected`.
- `POST /api/v1/admin/scans/:id/gate-decision` body `GateDecisionBody`.

**Gate rules (`gate.ts`, pure and exhaustively tested):**
1. Only a job with `status = 'completed'` (scanner finished) can receive a decision; else `409 { error: "not_reviewable" }`. A job in `queued`/`running` shows gate `not_eligible`; when the worker marks it completed (Layer L10) the gate becomes `in_review`.
2. `approve_release` requires `scans:release` (held by `admin` and `super_admin`; analysts have `scans:review` only → `403 forbidden`), all five checks true, and `note ≥ 10` chars.
3. **Payment lock:** `approve_release` when `payment_status <> 'paid'` → NO release: set `review_gate_state = 'blocked_payment'`, write the `review_decisions` row anyway, respond `409 { error: "payment_outstanding" }` (the rows are committed — do this by committing the audit/decision first and returning the conflict after). Audit `RELEASE_LOCK_VIOLATION` (critical, SEV-2) with `details: { jobCode, paymentStatus }`.
4. `approve_release` (payment paid): `review_gate_state = 'approved_released'`, `released_at = now()`, `released_by`; persist the five `review_gate_checks` rows (unique per job+key); append `review_decisions` (immutable) with `reviewer_role`; audit `REPORT_RELEASED` (message `"Report approved at the Mandatory Admin Review Gate and released to <client> client portal · reviewer note attached"`) and `GATE_DECISION`; notify the client org's users (`dispatch` event `scan_completed`, non-critical) and enqueue the invoice/report `pdf` job.
5. `hold_remediation`: gate `held_blocked`, status `held`; `reject_archive`: gate `held_blocked`, status `rejected`; both need `scans:review`, note ≥ 10; audit `GATE_DECISION` + `SCAN_HELD`.
6. A released job can NEVER be un-released (`409 { error: "already_released" }`); to retract a report create a new job. There is no code path that deletes a decision.

**Bulk:** `POST /api/v1/admin/scans/bulk` body `BulkScanActionBody` (`scans:review`): `open_review_gate` (completed jobs not yet in review → `in_review`), `assign_reviewer` (needs `reviewerId`, who must be an active staff member with `scans:review`), `place_on_hold` (non-released jobs → status `held`), `reject_batch` (→ `rejected`, gate `held_blocked`). Skips ineligible rows and returns `{ data: { updated: n, skippedIds: string[] } }`; ONE audit entry `BULK_SCAN_ACTION` with `details: { action, ids }` (max 100 ids). Bulk can never release.
- `POST /api/v1/admin/scans/:id/request-payment` (`scans:review`): create an invoice via `InvoiceIssuer` if none is linked (plan `starter_scan` etc. by `scan_type`, USD cents from `plans`), email the client, audit `SCAN_PAYMENT_REQUESTED`; `200 { data: ScanJob }`.
- `POST /api/v1/admin/scans/:id/cancel` — only `queued`/`running`; remove the BullMQ job or publish `{type:"abort"}` on Redis `scan:ctl:<jobId>` for a running job; status `cancelled`; audit `SCAN_CANCELLED`.

**Tests (assert):** client A cannot see client B's job; a `completed` but un-released job returns 404 to its own client; gate approval of an unpaid job returns 409 and leaves `blocked_payment` + a decision row + a `RELEASE_LOCK_VIOLATION` entry; analyst cannot release; `approve_release` with one unchecked check is rejected by the contract; double release → 409; bulk skips ineligible rows and never releases; creating a scan without an authorisation key → 422; summary numbers match fixtures.

---

**Data shape (TypeScript):**
```ts
// ScanJob, ScanQueueSummary, GateDecisionBody, BulkScanActionBody: see contracts (Task 19).
interface ReviewGateRules { canDecide(job: { status: ScanStatus }): boolean; decide(i: { job: ScanJobRow; decision: ReviewDecision; checks: Record<ReviewCheckKey, boolean>; note: string; actorPerms: Permission[] }): { next: Partial<ScanJobRow>; outcome: "released" | "blocked_payment" | "held" | "rejected" } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/scans/authorisation-url body { contentType: "application/pdf"; sizeBytes: number(max 10485760) } → 200 { data: { uploadUrl; objectKey; expiresAt } }
// POST /api/v1/scans body { orgId?: never-for-clients; targetHost: string(min3); scanType; priority?; environment?: "production"|"staging"; scopeNotes?: string; authorisationDocKey: string } → 201 { data: ScanJob } | 422 authorisation_missing | 422 target_not_allowed
// GET  /api/v1/scans query ScanListQuery → 200 { data: ScanJob[]; total }   (released jobs of own org only)
// GET  /api/v1/scans/:id → 200 { data: ScanJob } | 404 not_found            GET /api/v1/scans/:id/findings → 200 { data: ScanFinding[] }
// GET  /api/v1/admin/scans query ScanListQuery → 200 { data: ScanJob[]; total } · GET /api/v1/admin/scans/summary → 200 { data: ScanQueueSummary }
// POST /api/v1/admin/scans/:id/gate-decision body { decision; checks: Record<ReviewCheckKey, boolean>; note: string(min10) } → 200 { data: ScanJob } | 403 forbidden | 409 { error: "payment_outstanding" | "not_reviewable" | "already_released" }
// POST /api/v1/admin/scans/bulk body { action; ids: uuid[](1..100); reviewerId?: uuid } → 200 { data: { updated: number; skippedIds: string[] } }
// POST /api/v1/admin/scans/:id/request-payment | /cancel → 200 { data: ScanJob } | 409
```

---

**Out of scope:**
- Do not run or simulate scans (Layer L10).
- Do not give the client portal any path that bypasses `clientVisibleWhere`.
- Do not implement the WebSocket relay (Layer L12).
- Do not add any update/delete of `review_decisions`.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ A route-table test (added in Task 40) will assert that every route here that mutates is `audited`; make sure yours are.
☐ Report at the end: `Task 35 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 36 — Content: moderation queue, content studio, public content feed

**Layer:** L4

**Prerequisites:** Task 18, Task 20b, Task 20c, Task 20d, Task 24, Task 25, Task 29

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Content: moderation queue, content studio, public content feed**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the admin Content Moderation queue and actions, the verified-blogger Content Studio (draft → submit), and the public published-content feed.

**Deliverables:**
- `apps/api/src/routes/v1/content/index.ts` — route plugin (admin + public).
- `apps/api/src/routes/v1/content/service.ts` — `ModerationService`.
- `apps/api/src/routes/v1/content/repo.ts` — repos.
- `apps/api/src/routes/v1/content/state-machine.ts` — pure status transitions.
- `apps/api/src/routes/v1/studio/index.ts` — studio routes.
- `apps/api/src/routes/v1/studio/service.ts` — `StudioService`.
- `apps/api/src/routes/v1/studio/markdown.ts` — `sanitiseMarkdown()` (no raw HTML, safe links).
- `apps/api/src/routes/v1/studio/slug.ts` — slug generator.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/content/content.test.ts` — tests.
- `apps/api/src/routes/v1/studio/studio.test.ts` — tests.
- `apps/api/src/routes/v1/content/state-machine.test.ts` — tests.

**Dependencies allowed:**
- None — use only existing (write the small markdown sanitiser yourself; no HTML rendering library).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**State machine (`state-machine.ts`, exhaustive tests):** `draft → pending_review` (submit); `pending_review → in_review` (reviewer opens/claims, optional); `pending_review|in_review → approved | changes_requested | rejected`; `changes_requested → draft` (the author edits, then resubmits to `pending_review`); `approved → published | scheduled`; `scheduled → published` (worker at `scheduled_for`); anything else `409 { error: "invalid_transition" }`. Actions → transitions: `approve` (→ approved), `request_changes` (→ changes_requested, note required), `reject` (→ rejected, note required), `publish` (→ published), `schedule` (→ scheduled, needs `scheduledFor` in the future), `remind_author` (no status change; emails the author).

**Admin routes** (`[authenticate, requireStaff, requirePermission("content:moderate")]`):
- `GET /api/v1/admin/content` query `ModerationQuery` — default shows `pending_review, in_review, changes_requested`; rows `ModerationItem` (author block with initials and team, `riskFlags`, `cveId`). `GET …/summary` → `ModerationSummary`: `awaitingReview` = `pending_review` + `in_review`; `changesRequested`; `approvedToday` = approvals since 00:00 UTC (from `content_reviews`); `rejectedLast7Days`; `avgReviewHours` = mean hours from `submitted_at` to the first review action over the last 30 days (1 decimal); `publishedLast30Days`.
- `POST /api/v1/admin/content/:id/actions` body `ModerationActionBody`: apply the state machine; **separation of duties:** a reviewer cannot act on their own submission (`409 { error: "own_submission" }`); items with the risk flag `legal_review_required` cannot be `publish`ed unless the actor is `admin` or `super_admin` (`403 { error: "legal_review_required" }`) — flags are informational for `approve`; insert `content_reviews` (append-only); on `publish` set `published_at`, and for `threat_advisory` items linked to an `advisories` row leave the broadcast to Task 38 (publishing the content item does NOT broadcast); audit `CONTENT_REVIEWED` / `CONTENT_PUBLISHED`; notify the author (`content_awaiting_moderation` is for reviewers, so use an email to the author through `app.notify`). Respond `200 { data: ModerationItem }`.

**Studio** (`[authenticate]` + a guard `requireBlogger`: `profiles.verified_blogger_at IS NOT NULL` OR role has `content:author`; otherwise `403 { error: "badge_required" }` — the UI shows the "Verified Journalist / Blogger badge required" screen):
- `GET /api/v1/studio/status` → `{ data: { verified, verifiedAt, displayName } }` (callable by any authenticated user, never 403).
- `GET /api/v1/studio/submissions` → own `content_items` (type `blog_post`) newest first with `readiness`, `reviewerNote` (latest `content_reviews.note` for `changes_requested`/`rejected`).
- `POST /api/v1/studio/drafts` / `PUT …/:id` body `StudioDraftBody`: editable only in `draft` or `changes_requested` (else `409 not_editable`), only the author; generate `slug_path` = `/blog/<slug>` (slug from `slug` or the title; ensure uniqueness by appending `-2`, `-3`); `bodyMd` passes through `sanitiseMarkdown` (strip raw HTML tags and `javascript:`/`data:` link targets; allow `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)`, `##`/`###`, `-` lists, `>` quotes); compute `read_minutes` (200 wpm, min 1); tags lower-cased, `#` stripped, max 8, de-duplicated; audit `CONTENT_DRAFT_SAVED` (at most once per minute per item to avoid noise).
- `POST /api/v1/studio/drafts/:id/submit`: readiness required = title, category, body ≥ 150 words; otherwise `422 { error: "not_ready", details: StudioSubmitReadiness }`; sets `submitted_at`, status `pending_review`, notifies moderators (`dispatch` `content_awaiting_moderation` to users with `content:moderate`); audit `CONTENT_SUBMITTED`.
- `POST /api/v1/studio/images/upload-url` → presigned PUT for `studio/<userId>/<uuid>.<ext>` (JPG/PNG/WebP/GIF, ≤ 5 MB) → `{ data: { uploadUrl, objectKey, publicUrl, expiresAt } }`.
- `DELETE /api/v1/studio/drafts/:id` → only own drafts in `draft` status.

**Public feed:** `GET /api/v1/content` (no auth; `public_form` rate policy not required; cache header `Cache-Control: public, max-age=60`) query `PageQuery & { type? }` → ONLY `status = 'published'` items → `PublicContentItem` (`author.fullName` only — no email, no ids beyond the item id).

**Tests (assert):** every transition in the table passes and every other is 409; reject without note is 400; reviewer cannot moderate own item; `legal_review_required` publish blocked for a `security_analyst`-moderator but allowed for `admin`; unverified user → 403 `badge_required`; markdown `<script>alert(1)</script>[x](javascript:alert(1))` is neutralised; a 149-word body fails readiness and a 150-word body passes; slug collisions get `-2`; public feed leaks no draft and no author email; `approvedToday` etc. computed from fixtures.

---

**Data shape (TypeScript):**
```ts
type ContentAction = "approve" | "request_changes" | "reject" | "publish" | "schedule" | "remind_author";
interface StudioItem { id: string; title: string | null; slugPath: string | null; category: BlogCategory | null; excerpt: string | null; bodyMd: string | null; tags: string[]; featuredImageUrl: string | null; imageAlt: string | null; status: ContentStatus; readiness: StudioSubmitReadiness; readMinutes: number | null; updatedAt: string; reviewerNote: string | null }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/admin/content query ModerationQuery → 200 { data: ModerationItem[]; total } · GET /api/v1/admin/content/summary → 200 { data: ModerationSummary }
// POST /api/v1/admin/content/:id/actions body { action; note?: string(max1000); scheduledFor?: string(ISO) } → 200 { data: ModerationItem } | 400 | 403 legal_review_required | 409 { error: "invalid_transition" | "own_submission" }
// GET  /api/v1/studio/status → 200 { data: { verified: boolean; verifiedAt: string | null; displayName: string } }
// GET  /api/v1/studio/submissions → 200 { data: StudioItem[]; total } | 403 badge_required
// POST /api/v1/studio/drafts body StudioDraftBody → 201 { data: StudioItem } · PUT /api/v1/studio/drafts/:id → 200 | 409 not_editable · DELETE /api/v1/studio/drafts/:id → 204
// POST /api/v1/studio/drafts/:id/submit → 200 { data: StudioItem } | 422 { error: "not_ready"; details: StudioSubmitReadiness }
// POST /api/v1/studio/images/upload-url body { contentType: "image/jpeg"|"image/png"|"image/webp"|"image/gif"; sizeBytes: number(max 5242880) } → 200 { data: { uploadUrl; objectKey; publicUrl; expiresAt } }
// GET  /api/v1/content query { page; pageSize; type? } → 200 { data: PublicContentItem[]; total }   (public, published only)
```

---

**Out of scope:**
- Do not render markdown to HTML on the server (the web app does it with a safe renderer).
- Do not implement the scheduled-publish worker (Layer L11).
- Do not broadcast advisories from here (Task 38).
- Do not add an endpoint that grants the verified-blogger badge (Task 40 adds the admin grant).

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 36 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 37 — Admin Command Center dashboard API: KPIs, revenue, transactions, traffic, nodes, pipeline, threat level, node heartbeats

**Layer:** L4

**Prerequisites:** Task 17, Task 20b, Task 20d, Task 24, Task 25, Task 34, Task 35

**Estimated files touched:** 13

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Command Center dashboard API: KPIs, revenue, transactions, traffic, nodes, pipeline, threat level, node heartbeats**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the read-only Command Center endpoints and the Ed25519-signed sensor-node heartbeat ingest.

**Deliverables:**
- `apps/api/src/routes/v1/dashboard/index.ts` — route plugin.
- `apps/api/src/routes/v1/dashboard/service.ts` — `DashboardService`.
- `apps/api/src/routes/v1/dashboard/repo.ts` — aggregate queries.
- `apps/api/src/routes/v1/dashboard/cache.ts` — Redis read-through cache.
- `apps/api/src/routes/v1/dashboard/threat-level.ts` — `computeThreatLevel()` (pure).
- `apps/api/src/routes/v1/nodes/index.ts` — `POST /nodes/heartbeat`.
- `apps/api/src/routes/v1/nodes/service.ts` — heartbeat verification + status derivation.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/dashboard/dashboard.test.ts` — tests.
- `apps/api/src/routes/v1/dashboard/threat-level.test.ts` — tests.
- `apps/api/src/routes/v1/nodes/nodes.test.ts` — tests.

**Dependencies allowed:**
- None — use only existing (`node:crypto` supports Ed25519 verify).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. All dashboard routes: `[authenticate, requireStaff, requirePermission("dashboard:read")]`; GET only; cached in Redis for 15 s (key `dash:<name>`; `?refresh=1` bypasses the cache — this is the "Refresh Metrics" button). Money fields are USD cents.

- `GET /api/v1/admin/dashboard/kpis` → `DashboardKpis`: `totalPaidClients` = distinct orgs with ≥ 1 `payment_captured` entry; `newPaidClientsThisMonth` = orgs whose FIRST capture is in the current UTC month; `totalRevenueUsdCents` = Σ credits to revenue accounts YTD minus `refund` debits; `revenueChangeVsLastQuarterPercent` = (this quarter-to-date vs the previous full quarter, normalised per day, 1 decimal); `completedJobs` = `scan_jobs.status='completed'`; `closedThisWeek` = completed in the last 7 days; `pendingReview` = gate `in_review`; `activeRunningScans`, `workerSlotsUsed`, `workerSlotsTotal` (env `WORKER_SLOTS_TOTAL`, default 24); `criticalCvesTracked` = published advisories with severity critical (not retracted); `unpatchedCritical` = of those, `patch_status <> 'patched'`.
- `GET …/revenue` → `RevenueSummary`: `grossRevenueYtdUsdCents`, `revenueThisMonthUsdCents`, `periodLabel` (`"01 – 24 Sep 2026"` built from the first day of the UTC month to today), `paidClients { sme, sacco, enterprise }` classified by the org's highest-tier active/latest plan (`starter_scan` → sme, `sacco_fintech_compliance` → sacco, `enterprise_retainer` → enterprise), `averageOrderValueUsdCents` = revenue ÷ paid invoices (trailing 90 days), `tiers` = share of trailing-90-day gross by plan with `unitLabel` generated from `plans` (`"$299 / scan"`, `"$899 / assessment"`, `"$2,499 / month"`; use `formatUsdWhole` from `@vunvault/lib` plus ` / <unit>`) — shares are whole percents that sum to 100 (largest-remainder rounding).
- `GET …/transactions?limit=6` → `TransactionsResponse` for the last 48 hours: each `payment_attempts` row → `{ txnCode, occurredAt, client, package, method, amountUsdCents, status }` where `method`: `mpesa|card|bank_transfer` from `channel`; `status`: `succeeded → settled`, `created|requires_action → pending`, fully refunded → `refunded`; `failed` attempts are excluded; `totals { totalUsdCents (sum of displayed rows), settled, pending, refunded }` counts.
- `GET …/traffic` → `TrafficSummary` from `platform_metrics_hourly` (last 24 h): `siteSessions`, `sessionsChangePercent` vs the previous 24 h, `apiRequests`, `endpointCount` = distinct endpoints in `endpoint_stats` for the window, `avgResponseMs`, `p95ResponseMs`, `hourly` = 7 points at hours 0,4,8,12,16,20,24 (UTC hour of the window) `apiRequestsMillions` (2 decimals).
- `GET …/endpoints` → top 6 `EndpointStat` by requests in the last 24 h (`errorRatio` as a fraction, e.g. 0.0021).
- `GET …/nodes` → `NodesResponse` `{ data: NodeView[], online, total }`; `online` counts nodes with status ≠ `offline`. The prototype lists 6 featured nodes of 412; return the featured six by highest `req_per_min` and the true counts for `online`/`total`.
- `GET …/pipeline` → `PipelineSummary`: `pendingJobs` = status `queued`; `unreviewedJobs` = gate `in_review`; `running`; `distribution` counts; `closedLast7Days`.
- `GET …/running-scans?limit=5` → `RunningScansResponse`: running jobs ordered by `started_at`, `analystLabel` = analyst email local-part, `eta_seconds`; `shown`, `total`.
- `GET …/threat-level` → `ThreatLevel` from the latest `threat_level_snapshots` plus `blockedLast7Days` (Mon…Sun labels for the trailing 7 UTC days from `platform_metrics_hourly.threats_blocked`).

**`computeThreatLevel(i: { unpatchedCritical, weaponizedInWild, activeZeroDays, patchCoveragePercent })` (pure; document the formula in a comment):** `score = min(100, unpatchedCritical × 3 + weaponizedInWild × 1.2 + max(0, 100 − patchCoveragePercent) × 0.4)`; level = 1 if score < 20, 2 if < 40, 3 if < 60, 4 if < 80, else 5. The maintenance worker (Layer L11) runs it hourly and inserts a snapshot; level ≥ 4 escalates to the incident commander (`THREAT_ESCALATION_LEVEL`). Test with `unpatchedCritical 9, weaponizedInWild 37, patchCoveragePercent 62` → score 27 + 44.4 + 15.2 = 86.6 → level 5; the prototype's "Level 4 / High" value is only fixture data, not a formula output.

**Node heartbeat (`POST /api/v1/nodes/heartbeat`, `config: { csrf: false }`, no session, `rawBody` not needed):** body `NodeHeartbeatBody { nodeCode, sentAt, reqPerMin, loadPercent, clockDriftMs, signature }`. Verify the Ed25519 signature (base64) over the canonical string `<nodeCode>|<sentAt>|<reqPerMin>|<loadPercent>|<clockDriftMs>` using `sensor_nodes.public_key`; reject unknown nodes or bad signatures with `401 { error: "bad_signature" }`; reject `sentAt` more than 30 s from server time with `401 { error: "stale" }`; rate limit 6 / min per node (Redis). Update `req_per_min`, `load_percent`, `clock_drift_ms`, `heartbeat_latency_ms` = server receive time − `sentAt`, `last_heartbeat_at`, `missed_heartbeats = 0`; derive status: `high_load` when `load_percent > 85` (autoscaling trigger), `drift_warning` when `abs(clockDriftMs) > 15`, else `operational` (priority: drift → `drift_warning`, then load → `high_load`). `204`. Heartbeat misses (2 → `degraded`, 3 → `offline`) are applied by the maintenance worker, not here.

**Tests (assert):** cache hit within 15 s and bypass with `refresh=1`; tier shares sum to 100; non-staff → 403; heartbeat with a valid signature updates status, with a tampered field → 401; stale `sentAt` → 401; drift 19 ms → `drift_warning`; load 88 → `high_load`.

---

**Data shape (TypeScript):**
```ts
// DashboardKpis, RevenueSummary, TransactionsResponse, TrafficSummary, EndpointStat, NodesResponse, PipelineSummary, RunningScansResponse, ThreatLevel, NodeHeartbeatBody: see contracts (Task 20d).
interface ThreatInputs { unpatchedCritical: number; weaponizedInWild: number; activeZeroDays: number; patchCoveragePercent: number }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/dashboard/{kpis|revenue|transactions|traffic|endpoints|nodes|pipeline|running-scans|threat-level}[?refresh=1][&limit=n]
//   → 200 { data: … } (shapes in contracts) | 401 | 403 forbidden | 403 mfa_required
// POST /api/v1/nodes/heartbeat body { nodeCode; sentAt: string(ISO); reqPerMin: number; loadPercent: 0..100; clockDriftMs: number; signature: string } → 204 | 401 { error: "bad_signature" | "stale" } | 429
```

---

**Out of scope:**
- Do not implement metrics collection or the hourly rollup (maintenance worker).
- Do not write to any table other than `sensor_nodes` (heartbeat).
- Do not add write endpoints to the dashboard.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 37 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 38 — Zero-day advisories API: editor, NVD import, emergency broadcast, retraction, client advisories

**Layer:** L4

**Prerequisites:** Task 18, Task 20b, Task 20d, Task 22, Task 24, Task 25, Task 29, Task 36

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Zero-day advisories API: editor, NVD import, emergency broadcast, retraction, client advisories**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the Zero-Day Intel & Advisory Editor API: drafts, NVD import, publish via an irreversible emergency broadcast with five acknowledgements, re-broadcast, retraction, patch status, broadcast history, and the client-facing advisory feed and acknowledgements.

**Deliverables:**
- `apps/api/src/routes/v1/advisories/index.ts` — admin + client route plugin.
- `apps/api/src/routes/v1/advisories/service.ts` — `AdvisoriesService`.
- `apps/api/src/routes/v1/advisories/repo.ts` — repos.
- `apps/api/src/routes/v1/advisories/matching.ts` — `matchClients(scope, assets)` (pure) and the audience estimator.
- `apps/api/src/routes/v1/advisories/nvd.ts` — `NvdClient`.
- `apps/api/src/routes/v1/advisories/validation.ts` — `severityFromCvss`, `assertBroadcastable`.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/advisories/advisories.test.ts` — route tests.
- `apps/api/src/routes/v1/advisories/matching.test.ts` — tests.
- `apps/api/src/routes/v1/advisories/validation.test.ts` — tests.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Permissions: reads `intel:read`; draft create/update/patch-status `intel:write`; broadcast / re-broadcast / retract `intel:broadcast` (only `admin` and `super_admin`). All admin routes use `[authenticate, requireStaff, requirePermission(...)]`.

**Drafts:** `POST /api/v1/admin/advisories` body `AdvisoryDraftBody` → `status 'draft'`; CVE unique (`409 { error: "cve_exists" }`); `author_id` = caller; sets `last_saved_at`; audit `ADVISORY_DRAFT_SAVED`. `PUT …/:id` only while `draft` (published advisories are corrected by retract + new advisory; `409 { error: "not_editable" }`); only the author or a user with `intel:broadcast` may edit. Drafts are private to the intelligence team (`intel:read`). `GET …/drafts` → `DraftListItem[]` where `note` is `"Awaiting reviewer"` when the draft is flagged for review (`content_item_id` set and the item is `pending_review`/`in_review`), `"Needs scope entries"` when `scope` is empty, else `null` (the editor's `"Unsaved changes"` tag is client-side only).
**Summary:** `GET …/summary` → `AdvisorySummary`: `activeZeroDays` = published, non-retracted advisories (+ imported drafts excluded); `criticalSeverity`; `unpatchedCritical`; `weaponizedInWild` = published with `weaponized`; `advisoriesPublished`; `broadcastThisMonth` = `initial` broadcasts in the current UTC month; `openDrafts`; `escalatedDrafts` = drafts with a content item in review; `dashboardsReached` = distinct orgs with an acknowledgement in the last 30 days (or that were broadcast targets); `newClientsThisMonth` = orgs created this UTC month.
**List:** `GET /api/v1/admin/advisories` query `AdvisoryListQuery` → `Advisory[]` with `lastBroadcastAt` and `reach` = distinct orgs that acknowledged within 24 h of the FIRST broadcast.

**NVD import:** `GET …/nvd?cveId=` → `NvdClient` calls `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=<id>` with header `apiKey: <NVD_API_KEY>`, 6 s timeout; map `cvssMetricV31[0].cvssData.baseScore`, `vendor` from the first CPE, `descriptions[lang=en]` → `summary` (truncate to 1,200), `published` → `disclosureDate`, `references[].url`; derive `severity` with `severityFromCvss` (critical ≥ 9.0, high ≥ 7.0, medium ≥ 4.0, low > 0). Not found → `404 { error: "not_found" }`; upstream failure → `502 { error: "nvd_unavailable" }`. Cache results in Redis 1 h. Imported data is NEVER auto-saved; it only pre-fills the editor.

**Broadcast estimate:** `POST …/:id/estimate` → `matchClients` compares each `scope` entry (label + category) against `client_assets` (`ILIKE` on `product`, category equality); `dashboards` = matching orgs; `emailContacts` = active users of those orgs with an email; `smsContacts` = those with a phone + on-call flag (use users with `notification_preferences.sms = true` for `advisory_broadcast`); `incidentCommanders` = 1 (the on-duty `super_admin`; env `INCIDENT_COMMANDER_ID`). Shape `BroadcastEstimate`.

**Emergency broadcast (`POST …/:id/broadcast` body `EmergencyBroadcastBody`):** guard order (all must pass): (1) `assertBroadcastable`: status `draft` (or `published` for re-broadcast), `title`, `severity`, `summary`, `remediation` present and `scope.length ≥ 1`, and if `cvss` present severity matches the CVSS band — else `422 { error: "advisory_incomplete", details: [...missing] }`; (2) all five acknowledgements true and `confirmPhrase` = `BROADCAST` case-insensitively — the contract already enforces it (`400 validation_failed`); (3) permission `intel:broadcast`; (4) at most 1 broadcast per advisory per 60 s (`409 { error: "broadcast_in_progress" }`). In ONE audited transaction: set `status='published'`, `published_at`; insert `advisory_broadcasts` (`kind 'initial'`, `status 'queued'`, the `ack` object, audience counts from the estimate); append audit `ADVISORY_BROADCAST` (critical, **SEV-1**; message `"<CVE> emergency advisory pushed to <n> client dashboards"`); store the audit `seq` in `advisory_broadcasts.audit_seq`; enqueue a `broadcast` BullMQ job `{ broadcastId, advisoryId, kind }` (delivery — dashboards, emails, SMS — is done by the broadcast worker in Layer L11); dispatch a CRITICAL notification (`advisory_broadcast`) to the incident commander. Respond `202 { data: BroadcastRecord }`. Broadcasts are irreversible: there is NO route that deletes a broadcast; a mistake is handled with `retract`.
- `POST …/:id/rebroadcast`: same body and guards; only `published` advisories; `kind 'rebroadcast'`; audit `ADVISORY_BROADCAST` (SEV-2).
- `POST …/:id/retract` body `RetractBody`: only `published`; sets `status 'retracted'`, `retracted_at`, `retraction_note`; inserts a `retraction` broadcast and enqueues it (clients receive a follow-up notice); audit `ADVISORY_RETRACTED` (warning, SEV-2). `PATCH …/:id/patch-status` body `{ patchStatus }` → audit `ADVISORY_PATCH_STATUS_CHANGED`.
- `GET …/:id/broadcasts` → `BroadcastRecord[]` (counters update as the worker progresses; clients of the admin UI poll or use SSE in Layer L12).

**Client routes** (`[authenticate, requirePermission("profile:read")]`, role `client`): `GET /api/v1/advisories` → published, non-retracted `ClientAdvisory[]` newest first, each with `acknowledged` for the caller's org; `source` is always the literal `"VUNVAULT Intelligence"`; NEVER expose drafts, author ids, or broadcast internals. `POST /api/v1/advisories/:id/acknowledge` → upsert `advisory_acknowledgements (advisory_id, org_id)` (idempotent), audit `ADVISORY_ACKNOWLEDGED`, `204`.

**Tests (assert):** an `intel:write`-only analyst gets 403 on broadcast; broadcast with four acks → 400; wrong phrase → 400; incomplete advisory (no scope) → 422 listing `scope`; successful broadcast writes status, one `advisory_broadcasts` row, a SEV-1 audit entry, and enqueues exactly one job — and the enqueue happens AFTER the transaction commits (outbox pattern): if the enqueue fails the `advisory_broadcasts` row stays `queued` so the maintenance worker can re-enqueue it; assert the response is still 202 and a warning is logged; published advisory cannot be PUT; CVE regex error message equals `"Enter a valid CVE identifier in the format CVE-YYYY-NNNNN."`; matching: scope `Web & API · Struts 2.0.0 – 2.5.32` matches an asset `{ category: "web_api", product: "Struts 2", version: "2.5.30" }`; clients never see drafts; reach counts acknowledgements only within 24 h.

---

**Data shape (TypeScript):**
```ts
interface BroadcastRecord { id: string; advisoryId: string; kind: "initial" | "rebroadcast" | "retraction"; status: "queued" | "sending" | "sent" | "failed"; triggeredByLabel: string; audienceDashboards: number; emailContacts: number; smsContacts: number; sentDashboards: number; sentEmail: number; sentSms: number; failed: number; createdAt: string; finishedAt: string | null }
interface NvdClient { getCve(cveId: string): Promise<NvdImportResult | null> }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/admin/advisories query { page; pageSize; q?; status?; severity? } → 200 { data: Advisory[]; total } · GET …/summary → { data: AdvisorySummary } · GET …/drafts → { data: DraftListItem[]; total }
// GET  /api/v1/admin/advisories/nvd?cveId=CVE-YYYY-NNNNN → 200 { data: NvdImportResult } | 404 | 502 nvd_unavailable
// POST /api/v1/admin/advisories body AdvisoryDraftBody → 201 { data: Advisory } | 409 cve_exists · PUT …/:id → 200 | 409 not_editable
// POST /api/v1/admin/advisories/:id/estimate → 200 { data: BroadcastEstimate }
// POST /api/v1/admin/advisories/:id/broadcast | /rebroadcast body { ack: { severityCorrect; scopeComplete; contentSafe; remediationActionable; authorised: true }; confirmPhrase: "BROADCAST" } → 202 { data: BroadcastRecord } | 400 | 403 | 409 broadcast_in_progress | 422 advisory_incomplete
// POST /api/v1/admin/advisories/:id/retract body { note: string(10..500) } → 200 { data: Advisory } · PATCH …/:id/patch-status body { patchStatus } → 200 { data: Advisory } · GET …/:id/broadcasts → 200 { data: BroadcastRecord[] }
// GET  /api/v1/advisories → 200 { data: ClientAdvisory[]; total } · POST /api/v1/advisories/:id/acknowledge → 204
```

---

**Out of scope:**
- Do not deliver emails/SMS/dashboard pushes here (broadcast worker, Layer L11).
- Do not add any way to delete a broadcast or an acknowledgement.
- Do not auto-publish NVD data.
- Do not implement SSE (Layer L12).

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ `broadcast`/`rebroadcast`/`retract` routes are each wrapped in `audited()` and a test asserts the SEV-1 entry for the initial broadcast.
☐ Report at the end: `Task 38 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 39 — Audit log read API: list, summary, chain status, verify, CSV export, live SSE stream

**Layer:** L4

**Prerequisites:** Task 18, Task 20, Task 24, Task 25, Task 22

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Audit log read API: list, summary, chain status, verify, CSV export, live SSE stream**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Expose the append-only audit trail read-only: filtered list, 24-hour summary, chain status, on-demand verification, CSV export, and the live Server-Sent Events stream.

**Deliverables:**
- `apps/api/src/routes/v1/audit/index.ts` — route plugin.
- `apps/api/src/routes/v1/audit/service.ts` — `AuditReadService`.
- `apps/api/src/routes/v1/audit/repo.ts` — read queries.
- `apps/api/src/routes/v1/audit/csv.ts` — CSV serialiser.
- `apps/api/src/routes/v1/audit/sse.ts` — SSE helper (heartbeat, backpressure, cleanup).
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/audit/audit-routes.test.ts` — tests.
- `apps/api/src/routes/v1/audit/sse.test.ts` — tests.
- MODIFY `docs/adr/0001-audit-chain.md` — append a short section: read-only access model.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI. Guard for every route: `[authenticate, requireStaff, requirePermission("audit:read")]`; `verify` additionally `audit:verify`. **There are NO PUT/PATCH/DELETE routes for audit data, and none may be added.** Add a test that walks `app.printRoutes()`/route table and fails if any route under `/api/v1/admin/audit` uses a method other than GET or the single POST `/verify`.

- `GET /api/v1/admin/audit` query `AuditQuery` (`q` ILIKE on `message`, `subject`, `actor_label`, `event_type`; `category`, `severity`, `actor` (label equality), `range` default `24h`) → `{ data: AuditEntryView[], total }` newest first by `seq`; `pageSize` max 100. Never return `details`, `sealed_details`, `nonce`, `signature`, or `key_id` here (view fields only: `seq,id,category,eventType,severity,sevLevel,actorLabel,message,ip,subject,hash,prevHash,createdAt`).
- `GET …/summary` → `AuditSummary` for the trailing 24 h: `events24h`; `authAttempts` = `AUTH_SUCCESS + AUTH_FAILURE + AUTH_MFA_FAILURE`; `failedAuth` = `AUTH_FAILURE + AUTH_MFA_FAILURE`; `lockedOut` = `AUTH_RATE_LIMIT` entries; `scanCompletions` = `SCAN_COMPLETE`; `reportReleases` = `REPORT_RELEASED`; `chainIntegrityPercent` and `hashMismatches` from the latest `audit_checkpoints` row (100 / 0 when none); `retentionYears: 7`.
- `GET …/chain` → `ChainStatus`: `totalEntries` = max `seq`; `genesisDate` = `created_at` of seq 1 as `YYYY-MM-DD`; `lastVerifiedAt`, `hashMismatches` from the latest checkpoint; `headHash` = `"0x" + first 16 hex chars` of the head `hash`; `state` = `broken` when the latest checkpoint has `mismatches > 0` else `intact`; `node` = env `NODE_LABEL` (default `node-nbo-01 · NBO-CORE`); `encryption: "AES-256-GCM"`.
- `POST …/verify` (rate policy `sensitive`; at most one verification at a time via a Redis lock `audit:verify:lock` TTL 600 s → `409 { error: "verify_in_progress" }`): runs `AuditService.verify` over the whole chain (or `fromSeq` of the latest checkpoint + 1 for an incremental run when the body `{ incremental: true }`), inserts an `audit_checkpoints` row, appends an audit entry `CHAIN_VERIFIED` (actor = caller, `ok` when 0 mismatches, `critical` otherwise) through `audited()`, returns `VerifyChainResult`.
- `GET …/export` (query same as list, `audit:read`) → streams `text/csv` (`Content-Disposition: attachment; filename="vunvault-audit-<UTC date>.csv"`), cursor-based in batches of 1,000 up to 100,000 rows (`413`-style `422 { error: "range_too_large" }` beyond that); header `Time (UTC),Seq,Category,Event,Severity,Actor,Subject,Message,Hash`; formula-injection-safe cells (same rule as Task 32); exporting is itself logged via `audited()` using event `LOG_BACKUP` (info) with `details: { rows, filters }` and message `"Audit log export generated"`.
- `GET …/stream` (SSE): headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`. On connect send `retry: 5000` and an initial `chain` event (`ChainStatus`). Subscribe with a DEDICATED Redis connection (`app.createRedis()`) to `audit:stream`; for every message send `event: entry` with `data: <AuditEntryView JSON>`; every 20 s send `event: heartbeat` `data: {}`; support `Last-Event-ID` = last `seq`: on reconnect replay up to 200 entries with `seq > id` from the database before going live (each SSE message has `id: <seq>`); when the socket is slow (write buffer > 1 MB) drop the connection; always `unsubscribe` + `quit` the Redis connection on close/abort/error; cap 5 concurrent streams per user (`429`). Each frame's `data` conforms to `AuditStreamEvent`. Permission is checked once at connect (and the stream ends when the session is revoked — poll the session registry every 30 s).

**Tests (assert):** list never contains `signature` or `details`; range filter works; summary counts; a tampered row makes `verify` return `mismatches: 1` and `chain` report `broken`; non-admin 403; only GET/POST-verify exist under the audit prefix; CSV neutralises `=HYPERLINK(...)` in `message`; SSE: initial `chain` event, an entry published on `audit:stream` is delivered with `id`, heartbeat after 20 s (fake timers), `Last-Event-ID` replay, Redis connection closed on abort; 6th concurrent stream → 429.

---

**Data shape (TypeScript):**
```ts
// AuditEntryView, AuditSummary, ChainStatus, VerifyChainResult, AuditStreamEvent: see contracts (Task 20).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/admin/audit query { page; pageSize; q?; category?; severity?; actor?; range?: "1h"|"6h"|"24h"|"7d"|"30d" } → 200 { data: AuditEntryView[]; total }
// GET  /api/v1/admin/audit/summary → 200 { data: AuditSummary } · GET …/chain → 200 { data: ChainStatus }
// POST /api/v1/admin/audit/verify body { incremental?: boolean } → 200 { data: VerifyChainResult } | 409 verify_in_progress
// GET  /api/v1/admin/audit/export → 200 text/csv | 422 range_too_large
// GET  /api/v1/admin/audit/stream → 200 text/event-stream  events: entry | heartbeat | chain (data: AuditStreamEvent) | 429
// (No PUT/PATCH/DELETE exists for audit data.)
```

---

**Out of scope:**
- Do not add any write path to `audit_entries`.
- Do not use WebSockets here (SSE only).
- Do not expose sealed or secret fields.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 39 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 40 — Public routes, badge grant, route-guard conformance test, API closeout

**Layer:** L4

**Prerequisites:** Task 21, Task 22, Task 23, Task 24, Task 25, Task 26, Task 27, Task 28, Task 29, Task 30, Task 31, Task 32, Task 33, Task 34, Task 35, Task 36, Task 37, Task 38, Task 39

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Public routes, badge grant, route-guard conformance test, API closeout**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the public contact and consent routes, the admin verified-blogger badge grant, and a conformance test that walks the entire route table to enforce authentication, permissions, CSRF, audit coverage, and OpenAPI completeness.

**Deliverables:**
- `apps/api/src/routes/v1/public/index.ts` — contact + consent routes.
- `apps/api/src/routes/v1/public/service.ts` — services.
- `apps/api/src/routes/v1/public/repo.ts` — repos.
- `apps/api/src/routes/v1/public/turnstile.ts` — Cloudflare Turnstile verification.
- `apps/api/src/routes/v1/admin-badges/index.ts` — `POST/DELETE /admin/users/:id/blogger-badge`.
- MODIFY `apps/api/src/lib/secrets/provider.ts` — add `TURNSTILE_SECRET_KEY` to `SECRET_NAMES`.
- MODIFY `apps/api/src/routes/v1/index.ts` — add exactly one `app.register(<group>Routes)` line.
- `apps/api/src/routes/v1/public/public.test.ts` — tests.
- `apps/api/src/conformance/route-table.test.ts` — the conformance suite.
- `apps/api/src/conformance/route-manifest.ts` — the explicit allow-lists the suite reads.
- `docs/adr/0002-api-conventions.md` — one-page ADR summarising the conventions every route follows.
- MODIFY any route file under `apps/api/src/routes/v1/**` ONLY to add a missing `preHandler` guard, `audited()` wrapper, or Zod `schema` that the conformance suite reveals (list each in your report).
- MODIFY `.env.example` — add `TURNSTILE_SECRET_KEY=`, `ENGAGEMENT_INBOX=`, `INCIDENT_COMMANDER_ID=`, `WORKER_SLOTS_TOTAL=`, `NODE_LABEL=`, `WEBAUTHN_RP_ID=`, `R2_ACCOUNT_ID=`, `R2_BUCKET=`, `R2_PUBLIC_BASE_URL=`, `R2_ACCESS_KEY_ID=`, `R2_SECRET_ACCESS_KEY=`, `FX_API_URL=`, `TERMS_VERSION=` (names only).

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Contact (`POST /api/v1/contact`, public, policy `public_form`, no session):** body `ContactBody` (consent must be `true`); optional header/field `turnstileToken` — when env `TURNSTILE_ENFORCE=true` verify with `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (secret from `app.secrets`; failure → `400 { error: "captcha_failed" }`); store `ip_hash = sha256(ip + daily salt)` (never the raw IP); insert `contact_messages`; if `category = 'journalist_blogger_profile_request'` mark it for the badge workflow (the email subject carries `[Verification]`); enqueue a `notify` email to `ENGAGEMENT_INBOX` (or the support inbox for `general_support`) and an acknowledgement to the sender; audit `CONTACT_RECEIVED` (actor `external`, details: `{ category }` only — no message text). `201 { data: { id } }`. Honeypot: reject a body containing a non-empty `website` field with `201` and NO side effects.
**Consent (`POST /api/v1/consent`, public, policy `public_form`):** body `ConsentBody`; `strictlyNecessary` must be `true`; insert `consent_records` (`user_id` from `optionalAuth` else the `anonymous_id` from cookie `vv_anon` — create it, non-HttpOnly is NOT allowed: set it `HttpOnly; Secure; SameSite=Lax; 1 year`); `ip_hash` as above; audit `CONSENT_RECORDED`; `204`. (The consent banner's "Accept All" sends all true; "Essential Only" sends only `strictlyNecessary`.)
**Badge grant:** `POST /api/v1/admin/users/:id/blogger-badge` and `DELETE …` (`[authenticate, requireStaff, requirePermission("users:manage")]`): set/clear `verified_blogger_at` and `verified_blogger_by`; the target may be a client; audit `PERMISSION_CHANGED` (message `"Verified Blogger badge granted to <email>"` / `"…revoked from <email>"`); `200 { data: { id, verifiedBloggerAt: string | null } }`.

**Conformance suite (`route-table.test.ts` + `route-manifest.ts`) — build the full app with fake infrastructure and iterate every registered route (use Fastify's `onRoute` hook capture installed in the test or `app.routes`):**
1. **Auth coverage:** every route NOT in `PUBLIC_ROUTES` (an explicit allow-list in the manifest: health, openapi, auth/signup, auth/login, auth/mfa/*, auth/refresh, auth/csrf, invitations/:token(+accept), contact, consent, content (GET), webhooks/*, nodes/heartbeat) must have `authenticate` in its `preHandler`. Fail with the route list.
2. **Admin guard:** every route whose URL starts with `/api/v1/admin/` must have `authenticate`, `requireStaff`, AND at least one `requirePermission`/`requireAnyPermission`.
3. **Mutations are audited:** every POST/PUT/PATCH/DELETE route not in `AUDIT_EXEMPT` (manifest: health, auth/refresh, auth/csrf, auth/mfa/email-otp, auth/mfa/webauthn/options, webhooks/* (audited inside the service by the system actor), nodes/heartbeat, fx-quotes read-style, scans/authorisation-url, studio/images/upload-url, avatar/upload-url, advisories/:id/estimate, audit/verify (audited via `audited()` too — keep it audited), billing/reconcile) must have a handler tagged by `isAudited`.
4. **CSRF:** every non-GET route must either be in `CSRF_EXEMPT` (webhooks, nodes/heartbeat) or have the CSRF hook active (assert `config.csrf !== false`).
5. **Schemas:** every route declares a Zod `response` schema for its 2xx status and a `body`/`querystring` schema when it has input; every route has a `schema.tags` entry and appears in `GET /openapi.json`.
6. **Audit immutability:** no route registered under `/api/v1/admin/audit` has a method outside `GET` and `POST /verify`; the repo layer exports no function named like `update*`/`delete*` for `audit_entries`.
7. **Rate limits:** the routes `auth/login`, `auth/signup`, `contact`, `consent`, `account/password`, `account/recovery-codes*`, `account/mfa/*`, `billing/checkout` declare a non-default `rateLimitPolicy`.
8. **Forbidden stack:** a text scan of `apps/api/src/**` fails on imports of `express`, `@prisma/client`, `joi`, and on the identifiers `localStorage`/`sessionStorage`.
9. **Contract drift:** every path+method documented in `ROUTES_A`, `ROUTES_B`, `ROUTES_C` exists in the live route table, and every live `/api/v1` route is documented (list differences in the failure message).

**Tests (public):** valid contact → 201 and one email job; `consent: false` → 400; honeypot returns 201 without inserting; raw IP never stored; consent essential-only stores `analytics:false`; badge grant requires `users:manage`.

---

**Data shape (TypeScript):**
```ts
interface RouteManifest { PUBLIC_ROUTES: string[]; AUDIT_EXEMPT: string[]; CSRF_EXEMPT: string[] }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/contact body { name; email; organization?: string; category; subject; message(10..5000); consent: true } → 201 { data: { id } } | 400 validation_failed | 400 captcha_failed | 429 rate_limited
// POST /api/v1/consent body { categories: { strictlyNecessary: true; analytics: boolean; marketing: boolean; functional: boolean }; policyVersion: string } → 204 | 400
// POST /api/v1/admin/users/:id/blogger-badge → 200 { data: { id: string; verifiedBloggerAt: string } } · DELETE → 200 { data: { id: string; verifiedBloggerAt: null } }
```

---

**Out of scope:**
- Do not add new domain features.
- Do not weaken any earlier guard to make the conformance suite pass — fix the route instead and report which route you fixed in your completion note (the fix is a permitted edit to that route's file and ONLY its `preHandler`/`audited` wrapper/`schema`).
- Do not store raw IPs.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ `pnpm --filter api test` runs the conformance suite and it passes; list in your report every route you had to modify to satisfy it.
☐ Report at the end: `Task 40 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


This is Part 2 of 5. Say "continue" to receive Part 3 (L5 frontend foundation, L6 marketing, L7 auth).
