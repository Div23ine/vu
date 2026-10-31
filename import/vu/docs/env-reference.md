# Environment reference (Task 103)

Every variable every app reads, extracted from the Zod schemas and kept honest
by `scripts/verify-env-docs.mjs` (part of `pnpm verify`). **Values are never
committed**: local development uses `.env` files copied from the matching
`.env.example`; production reads Vault (see `vault-map.md`); CI uses GitHub
repository variables/secrets (see `deploy.md`).

Classification: **V** = Vault secret in production · **C** = plain
configuration · **P** = public build-time value (inlined into the browser
bundle; must never be a secret) · **D** = deployment credential (GitHub
environment secret; migrations and images only).

## api (`apps/api/src/config/env.ts`)

| Variable                                           | Class | Purpose / default                                                                                                                    |
| -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                         | C     | `development` \| `test` \| `production` (default development)                                                                        |
| `PORT`                                             | C     | HTTP listen port (default 8080)                                                                                                      |
| `LOG_LEVEL`                                        | C     | pino level (default info)                                                                                                            |
| `WEB_ORIGIN`                                       | C     | exact web origin — CORS + the Task 95 WS Origin check                                                                                |
| `COOKIE_DOMAIN`                                    | C     | session cookie domain (empty allowed in dev)                                                                                         |
| `API_PUBLIC_URL`                                   | C     | public API base — OpenAPI server + absolute links                                                                                    |
| `SECRETS_PROVIDER`                                 | C     | `env` (dev) or `oci-vault` (prod)                                                                                                    |
| `OCI_SECRET_MAP`                                   | C     | JSON name→Vault-OCID map (the Task 98 `secret_ocids` output); OCIDs are identifiers, not secrets                                     |
| `SUPABASE_URL`                                     | V/C   | Supabase project URL (auth provider)                                                                                                 |
| `WEBAUTHN_RP_ID`                                   | C     | WebAuthn relying-party id, e.g. `vunvault.com` — never a URL, never localhost                                                        |
| `WEBAUTHN_RP_NAME`                                 | C     | relying-party name shown in the browser's passkey prompt (default VUNVAULT)                                                          |
| `SENTRY_DSN`                                       | C     | optional browser+server error reporting DSN                                                                                          |
| `ORIGIN_VERIFY_ENFORCE`                            | C     | `false` disables the Task 99 edge origin lock (escape hatch only)                                                                    |
| `TURNSTILE_ENFORCE`                                | O     | `true` switches on Cloudflare Turnstile (contact form + Phase 4 magic-link soft limit); secret is the vault's `TURNSTILE_SECRET_KEY` |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | C     | media storage coordinates                                                                                                            |
| `FX_API_URL`                                       | C     | optional FX quote source override                                                                                                    |
| `FX_QUOTE_TTL_SECONDS`                             | C     | FX quote cache TTL                                                                                                                   |
| `SCAN_CONTROLLER_CIDRS`                            | C     | NAT egress CIDR(s) of the k3s cluster — the internal-callback allow-list                                                             |
| `DIRECT_URL`                                       | D     | Supabase DIRECT connection — DDL/migrations only (`pnpm --filter @vunvault/db db:migrate`)                                           |

The Vault-backed secrets the API reads at runtime through
`SECRETS_PROVIDER=oci-vault` are listed in `vault-map.md` (they are
deliberately NOT process env in production).

## web (`apps/web/src/env.ts`) — all build-time, all public

| Variable                                            | Class | Purpose                                                                      |
| --------------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                               | P     | API origin the browser calls                                                 |
| `NEXT_PUBLIC_SITE_URL`                              | P     | canonical web origin (metadataBase, OG)                                      |
| `NEXT_PUBLIC_R2_HOST`                               | P     | CDN host for uploaded/generated media                                        |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                | P     | Stripe publishable key (tokenises in-browser by design)                      |
| `NEXT_PUBLIC_SENTRY_DSN`                            | P     | optional browser error reporting                                             |
| `NEXT_PUBLIC_API_MOCKING`                           | P     | exactly `enabled` turns on the MSW mock layer (dev/preview only)             |
| `NEXT_PUBLIC_BUILD_LABEL`, `NEXT_PUBLIC_NODE_LABEL` | P     | build provenance strings for the admin footer                                |
| `NEXT_PUBLIC_ZURA_LLM_URL`                          | P     | Zura's optional LLM endpoint; absent = knowledge-base-only answers           |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`                    | P     | Cloudflare Turnstile site key (public); needed when `TURNSTILE_ENFORCE=true` |

### Build-only (not in `env.ts`, never inlined into the bundle)

| Variable                    | Class | Purpose                                                                                                                                                                         |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VUNVAULT_ALLOW_MOCK_BUILD` | C     | Read by `next.config.ts`. Set to `true` to allow a production build with `NEXT_PUBLIC_API_MOCKING=enabled` — the throwaway-preview flow only. Without it that build is refused. |
| `NEXTJS_ENV`                | C     | Read by workerd from `apps/web/.dev.vars` (see `.dev.vars.example`). Selects which Next `.env` files `@opennextjs/cloudflare` loads; defaults to `production` when unset.       |

Neither is a secret and neither belongs in OCI Vault: both only affect what the
build produces, and a production deploy sets neither.

## broadcast-worker (`apps/broadcast-worker/src/config/env.ts`)

| Variable                                            | Class | Purpose / default                                    |
| --------------------------------------------------- | ----- | ---------------------------------------------------- |
| `NODE_ENV`, `LOG_LEVEL`                             | C     | as above                                             |
| `REDIS_URL`                                         | V     | Upstash Redis — BullMQ queues + the progress Pub/Sub |
| `DATABASE_URL`                                      | V     | Supavisor pooler URL (`prepare: false`)              |
| `RESEND_API_KEY`                                    | V     | transactional e-mail                                 |
| `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY` | V     | SMS (Africa's Talking)                               |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`           | V     | SMS fallback (Twilio)                                |
| `TWILIO_FROM`                                       | C     | sending number (plain config)                        |
| `BROADCAST_CONCURRENCY`                             | C     | BullMQ concurrency (default 2, max 16)               |
| `PROGRESS_THROTTLE_MS`                              | C     | progress-frame throttle (default 2000)               |
| `COUNTER_FLUSH_EVERY`                               | C     | DB counter flush batch (default 25)                  |
| `REDIS_KEY_PREFIX`                                  | C     | BullMQ prefix (default vv)                           |

## notify-worker (`apps/notify-worker/src/config/env.ts`)

Everything the broadcast-worker has (same channels), plus:

| Variable                                           | Class | Purpose / default                          |
| -------------------------------------------------- | ----- | ------------------------------------------ |
| `NOTIFY_CONCURRENCY`                               | C     | notify queue concurrency (default 8)       |
| `PDF_CONCURRENCY`                                  | C     | PDF render concurrency (default 2)         |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | C     | invoice/report PDF storage                 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`         | V     | S3-compatible credentials                  |
| `WEB_ORIGIN`                                       | C     | absolute links inside transactional e-mail |

## maintenance-worker (`apps/maintenance-worker/src/config/env.ts`)

| Variable                                           | Class | Purpose / default                                |
| -------------------------------------------------- | ----- | ------------------------------------------------ |
| `REDIS_URL`, `DATABASE_URL`                        | V     | as above                                         |
| `MAINTENANCE_CONCURRENCY`                          | C     | default 2                                        |
| `HEARTBEAT_STALE_MS`, `HEARTBEAT_MISS_LIMIT`       | C     | node-offline sweep (90000 / 3)                   |
| `LOGIN_ATTEMPT_RETENTION_DAYS`                     | C     | purge window (30)                                |
| `INVITATION_GRACE_HOURS`                           | C     | invitation expiry grace (0)                      |
| `DORMANT_AFTER_DAYS`                               | C     | client dormancy window (90)                      |
| `SIGNUP_STALE_DAYS`                                | C     | stale pending-verification window (7)            |
| `OUTBOX_STUCK_MINUTES`                             | C     | broadcast re-enqueue threshold (2)               |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | C     | audit-snapshot destination + media_scan origin   |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`         | V     | as above                                         |
| `AUDIT_HMAC_KEY_ID`, `AUDIT_HMAC_KEY`              | C/V   | chain VERIFICATION key (appends stay in the API) |
| `AUDIT_ALERT_EMAIL`                                | C     | optional — chain-mismatch page destination       |

## scan-worker / controller (`apps/scan-worker/src/config/env.ts`)

| Variable                                                      | Class | Purpose / default                                         |
| ------------------------------------------------------------- | ----- | --------------------------------------------------------- |
| `REDIS_URL`                                                   | V*    | BullMQ scan queue + the stream Pub/Sub                    |
| `API_INTERNAL_URL`                                            | C     | the API's internal callback base                          |
| `SCAN_CONTROLLER_HMAC_KEY`                                    | V*    | signs the internal callbacks (the API holds the same key) |
| `WORKER_SLOTS_TOTAL`                                          | C     | queue capacity signal (default 4)                         |
| `REDIS_KEY_PREFIX`, `API_TIMEOUT_MS`, `NODE_ENV`, `LOG_LEVEL` | C     | as above                                                  |

\* On the k3s cluster these arrive via the Terraform-built
`vv-scan-controller-secrets` Kubernetes Secret (Task 98) — the scan nodes have
NO Vault access by design.
