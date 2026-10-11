# VUNVAULT deployment guide — from zero to staging to production

The teaching version of `deploy.md`. Order matters: **frontend first** (you
can see the product in an hour), **backend second** (two paths: a single-VM
preview, or the full designed estate), **third parties as you go**, and
**production only through the go-live checklist**.

```
                        ┌──────────────────────── Cloudflare ────────────────────────┐
 browser ── www.<zone> ─┤ Pages: vunvault-web-{staging,production}  (Next.js edge)   │
 browser ── api.<zone> ─┤ Worker: vv-edge (allow-list, x-origin-verify, metrics)     │
                        │ assets.<zone> ── R2 public bucket                          │
                        └───────────────┬────────────────────────────────────────────┘
                                        │ https (origin pull, authenticated)
                              origin.<zone> (DNS-only A → OKE load balancer)
                                        │
              ┌─────────────────────────┴──────────────────────┐
              │ OCI: OKE cluster (VCN 10.10/16)                │   OCI: k3s cluster (VCN 10.20/16)
              │  vv-api · broadcast · notify · maintenance     │   scan-controller → scan pods
              │  secrets: OCI Vault (direct / ExternalSecrets) │   NO peering, public-egress-only
              └────────────────────────────────────────────────┘
 third parties: Supabase (auth+DB) · Upstash (Redis) · Stripe · Paystack ·
                Resend · Africa's Talking · Twilio · NVD · Sentry (optional)
```

---

## 0. Prerequisites (once)

Accounts: **Cloudflare** (zone already delegated), **Oracle Cloud**,
**Supabase**, **Upstash**, **Stripe**, **Paystack**, **Resend**, **Africa's
Talking** and/or **Twilio**, optional **NVD** key and **Sentry**.

Tools on your machine: Node 22 (`nvm use 22`), `corepack enable` (pnpm 9.15
comes from the repo's `packageManager` field), Docker + buildx (images only),
Terraform ≥ 1.8 (estate only), OCI CLI, and:

```sh
pnpm install --frozen-lockfile
pnpm --filter web exec wrangler login     # opens a browser, stores your CF token locally
pnpm --filter edge exec wrangler login    # same login covers both
```

Pick your hostnames once and keep them consistent everywhere (the Terraform
stacks derive the rest):

| Environment | web                  | api (public)         | origin (Worker → LB)    | assets                  |
| ----------- | -------------------- | -------------------- | ----------------------- | ----------------------- |
| staging     | `www.staging.<zone>` | `api.staging.<zone>` | `origin.staging.<zone>` | `assets.staging.<zone>` |
| production  | `www.<zone>`         | `api.<zone>`         | `origin.<zone>`         | `assets.<zone>`         |

---

## 1. See it TODAY: the frontend on Pages with mock data

The web app ships an MSW mock layer that serves the contract fixtures — the
same data its 691 unit tests use. Deploying that build to a Pages **preview**
gives you the entire product to click through before any backend exists.

```sh
cd apps/web

# the mock service-worker script is gitignored — regenerate it once per clone:
pnpm exec msw init public --save >/dev/null   # or: cp node_modules/msw/mockServiceWorker.js public/

# build-time variables are inlined by Next — export them in THIS shell:
export NEXT_PUBLIC_API_URL=https://api.vunvault.test        # never called in mock mode
export NEXT_PUBLIC_SITE_URL=https://vunvault-preview.pages.dev
export NEXT_PUBLIC_API_MOCKING=enabled                      # exactly "enabled"

cd .. && pnpm --filter web pages:build
pnpm --filter web exec wrangler pages deploy .vercel/output/static \
  --project-name vunvault-preview --branch preview
```

Wrangler prints a `*.pages.dev` URL — open it: marketing site, login
(`jane.wanjiru@acmefintech.co.ke` client / `e.reed@vunvault.com` staff, any
password, MFA code `123456`), portal, Command Center, Zero-Day desk, audit
console. Throw the project away when the real staging exists.

---

## 2. Frontend → Cloudflare Pages (staging, then production)

### 2.1 Create the projects

Two projects, one per environment (the Terraform stack also creates them —
pick ONE creator; if you run the CF stack, skip the manual create):

```sh
pnpm --filter web exec wrangler pages project create vunvault-web-staging    --production-branch staging
pnpm --filter web exec wrangler pages project create vunvault-web-production --production-branch main
```

### 2.2 Build with the environment's public variables

`NEXT_PUBLIC_*` values are **build-time** — there is nothing to set in the
dashboard for a CLI deploy; the shell environment IS the configuration:

```sh
# ---- staging ----
export NEXT_PUBLIC_API_URL=https://api.staging.<zone>
export NEXT_PUBLIC_SITE_URL=https://www.staging.<zone>
export NEXT_PUBLIC_R2_HOST=https://assets.staging.<zone>
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…        # test mode first
# export NEXT_PUBLIC_SENTRY_DSN=…                          # optional
# export NEXT_PUBLIC_BUILD_LABEL=staging                   # optional provenance
unset NEXT_PUBLIC_API_MOCKING                              # real API from here on

pnpm --filter web pages:build
pnpm --filter web pages:deploy:staging     # = wrangler pages deploy --project-name vunvault-web-staging --branch staging
```

The scripts live in `apps/web/package.json`; `apps/web/wrangler.jsonc` pins
`pages_build_output_dir`, `nodejs_compat` and defaults the project name to
**staging** so a bare `wrangler pages deploy` can never hit production.

**The wrangler cwd rule, worth internalising:** `wrangler.jsonc` is discovered
in the directory wrangler starts from, and `pages_build_output_dir` resolves
relative to that same directory. `pnpm --filter web …` always starts in
`apps/web` — which is why the scripts above need no directory argument and
find the config automatically. If you invoke wrangler yourself, either
`cd apps/web` first, or point at the output explicitly:

```sh
pnpm --filter web exec wrangler pages deploy .vercel/output/static \
  --project-name vunvault-web-staging --branch staging
```

The `msw init` step in §1 needs the same cwd for the same reason
(`--filter web exec` provides it): it writes into that package's `public/`.

### 2.3 Custom domains

Dashboard → project → Custom domains: `www.staging.<zone>` (and the apex for
production, where the Terraform `apex_redirect` ruleset 301s it to www).
Cloudflare issues the certificate automatically.

### 2.4 Alternative: Git-integrated builds

If you prefer pushes-to-branch over CLI deploys: Pages dashboard → create
project → connect the repo → build command
`pnpm install --frozen-lockfile && pnpm --filter web pages:build`, output
directory `apps/web/.vercel/output/static`, Node 22 + the pnpm version env,
and set the same `NEXT_PUBLIC_*` variables **per environment** in the
dashboard (Production vs Preview). The repo's CD (`deploy.yml`) uses the CLI
path; don't run both against one project.

### 2.5 Production

Identical, with the production hostnames and the LIVE Stripe publishable key
(publishable keys are public by design — the secret key never comes near
this build):

```sh
pnpm --filter web pages:deploy:production   # --project-name vunvault-web-production --branch main
```

---

## 3. Backend — two paths

### Path A (preview): API + workers on ONE VM

The fastest honest staging: everything except scans (the controller needs a
Kubernetes cluster to create pods — see Path B). Any Ubuntu 24.04 VM with 2
vCPU / 8 GB works (OCI compute, or anything else). DNS: point
`api.staging.<zone>` at it (proxied through Cloudflare is fine; you will run
WITHOUT the edge origin lock here).

```sh
# --- on the VM ---
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo corepack enable
git clone <your-fork> vunvault && cd vunvault && pnpm install --frozen-lockfile

# env: SECRETS_PROVIDER=env means "read the secrets from .env" — the VM
# preview path only. Copy the reference and fill in real values:
cp apps/api/.env.example .env.staging     # names + comments for EVERY app live there
```

`.env.staging` — the minimum that makes the product work (every name is
documented in `docs/env-reference.md`):

```ini
# api
NODE_ENV=production
PORT=8080
WEB_ORIGIN=https://www.staging.<zone>
API_PUBLIC_URL=https://api.staging.<zone>
COOKIE_DOMAIN=.staging.<zone>
SECRETS_PROVIDER=env
ORIGIN_VERIFY_ENFORCE=false        # no vv-edge Worker on this path (see §4)
WEBAUTHN_RP_ID=staging.<zone>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_JWT_SECRET=<Settings → API → JWT secret>
DATABASE_URL=<Supavisor pooler URL, port 6543>
DIRECT_URL=<direct URL, port 5432 — migrations only>
UPSTASH_REDIS_URL=<upstash redis url>
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
PAYSTACK_SECRET_KEY=sk_test_…
RESEND_API_KEY=re_…
AFRICASTALKING_USERNAME=…
AFRICASTALKING_API_KEY=…
TWILIO_ACCOUNT_SID=…
TWILIO_AUTH_TOKEN=…
AUDIT_HMAC_KEY=<64 hex chars: openssl rand -hex 32>
AUDIT_AES_KEY=<64 hex chars: openssl rand -hex 32>
TURNSTILE_SECRET_KEY=0x…            # test key until the widget is wired
# broadcast/notify/maintenance workers read the same names from this file:
REDIS_URL=$UPSTASH_REDIS_URL        # (duplicate the value; no interpolation in dotenv)
R2_ACCOUNT_ID=…                     # optional until you use media/PDFs
R2_BUCKET=vv-staging-private
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_PUBLIC_BASE_URL=https://assets.staging.<zone>
```

```sh
# migrate, build, run
set -a; source .env.staging; set +a
pnpm --filter @vunvault/db db:migrate
pnpm --filter api build && pnpm --filter broadcast-worker build \
  && pnpm --filter notify-worker build && pnpm --filter maintenance-worker build

sudo npm i -g pm2
pm2 start apps/api/dist/server.js              --name vv-api
pm2 start apps/broadcast-worker/dist/main.js   --name vv-broadcast
pm2 start apps/notify-worker/dist/main.js      --name vv-notify
pm2 start apps/maintenance-worker/dist/main.js --name vv-maintenance
pm2 save && pm2 startup        # survive reboots
```

Put the API behind TLS: the simplest honest setup is a Caddy/nginx reverse
proxy on the VM terminating `api.staging.<zone>`, or Cloudflare's Origin
Certificate on nginx. Verify:

```sh
node scripts/deploy/smoke.mjs --api https://api.staging.<zone> --web https://www.staging.<zone>
```

**Caveats of Path A, stated plainly:** secrets in a file instead of Vault, no
origin lock, no scans, no HA. It is a preproduction PREVIEW. Production is
Path B — do not promote a VM.

### Path B (designed): the full estate on OCI

This is what `docs/deploy.md`, the two Terraform stacks and the Helm charts
exist for. Sequence (each step's details live in the referenced file):

1. **OCI bootstrap (human, once)** — compartment; `vv-deployer` user + API
   key → GitHub environment secrets; private+versioned+CMK-encrypted state
   bucket (`infra/terraform/oci/README.md`).
2. **`terraform apply` the OCI stack** (`infra/terraform/oci`) — OKE with a
   private endpoint, the isolated k3s scan VCN (egress = the generated 103-CIDR
   allow-list), Vault + placeholder secrets, six OCIR repos, IAM, two
   bastions. First apply is two-phase (kubeconfig chicken-and-egg — the README
   documents the `-target` dance).
3. **Fill the Vault secrets** (every `CHANGE_ME` → real value; the map is
   `docs/vault-map.md`, the procedure `docs/operator-runbook.md`).
4. **`terraform apply` the Cloudflare stack** (`infra/terraform/cloudflare`)
   with `api_origin_ip` from step 2 — DNS (`api` proxied, `origin` grey),
   strict TLS + authenticated origin pulls, WAF, rate limits, Pages projects,
   R2 (audit bucket WORM-locked 2555 days), Logpush, Turnstile.
5. **Build & push images** — set the repository variables (base-image digests,
   scan-tool versions + checksums — `docs/deploy.md`), then either push a
   commit (CD does it) or run `release.yml` by hand with the SHA.
6. **Deploy** — `deploy.yml` (dispatch, environment=staging): migrate →
   OKE charts (api first) → k3s scan-controller → edge Worker (its
   `EDGE_ORIGIN_SECRET` is piped from Vault, masked) → Pages → smoke.
   Manual equivalent: every command is written out in `docs/deploy.md`
   (bastion tunnel → `scripts/deploy/helm-deploy.sh <chart> digests.json`).
7. **Verify staging** — smoke script, `k6 run perf/k6/headers-audit.js`, click
   through the portal and admin surfaces.

---

## 4. The edge Worker and the origin lock

The API in production REJECTS every request without the `x-origin-verify`
header that only `vv-edge` stamps (ADR 0006 §3) — so on Path B the Worker is
not optional:

```sh
# once per environment; value = EDGE_ORIGIN_SECRET in Vault (generate: openssl rand -hex 32)
cd apps/edge
printf '%s' "$EDGE_ORIGIN_SECRET" | pnpm exec wrangler secret put EDGE_ORIGIN_SECRET --env staging
pnpm exec wrangler deploy --env staging
```

Set the env's `ORIGIN_HOST` var in `wrangler.jsonc` to your real
`origin.staging.<zone>` before deploying (or `--var`). The API side reads the
same secret from Vault (`SECRETS_PROVIDER=oci-vault`) or from
`EDGE_ORIGIN_SECRET` in `.env` when `SECRETS_PROVIDER=env`. Rotation order and
the escape hatch (`ORIGIN_VERIFY_ENFORCE=false`) are in
`docs/operator-runbook.md`.

---

## 5. Connecting the third-party applications

Rule of thumb: **create a separate project/account per environment** (test
mode first), and every secret lands in Vault (Path B) or `.env.staging`
(Path A) under the exact name in the middle column. Webhook URLs only work
once the API is publicly reachable — connect them in the order below.

| Service                  | You create                                                                                                | Value goes to                                                                                                         | Notes                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**             | Project (staging + prod)                                                                                  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL` (pooler 6543), `DIRECT_URL` (5432) | Auth → URL config: allow `https://www.staging.<zone>/**` redirects; SMTP: point at Resend; WebAuthn: RP ID `staging.<zone>` (must match `WEBAUTHN_RP_ID`); email templates' links use the web origin                                                                                |
| **Upstash Redis**        | DB (per env, region near OCI)                                                                             | `UPSTASH_REDIS_URL` → apps read it as `REDIS_URL` (workers) — same URL, two names                                     | TLS endpoint; it carries BullMQ queues, the audit stream, rate-limit counters, sessions cache                                                                                                                                                                                       |
| **Stripe**               | Account; Developers → API keys; test mode first                                                           | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (build var)                                                 | Webhook endpoint `https://api.<zone>/api/v1/webhooks/stripe` → copy the **signing secret** to `STRIPE_WEBHOOK_SECRET`; subscribe to `checkout.session.completed`, `payment_intent.succeeded/failed`, `charge.refunded`, `invoice.*`; locally `stripe listen --forward-to` works too |
| **Paystack**             | Account; Settings → Developer                                                                             | `PAYSTACK_SECRET_KEY`                                                                                                 | Webhook `https://api.<zone>/api/v1/webhooks/paystack` (set in the Paystack dashboard; it signs with your secret key — nothing extra to store). USD cards + **USD M-Pesa**: enable on the merchant account and get Paystack's written confirmation (go-live checklist row)           |
| **Resend**               | Account → Domains: add `vunvault.<zone>` sender domain                                                    | `RESEND_API_KEY`                                                                                                      | Add the DKIM/SPF/Return-Path records it shows to Cloudflare DNS; wait for "Verified"; send from `alerts@…`/`engagements@…` — the notify templates use those addresses                                                                                                               |
| **Africa's Talking**     | App + sender ID/shortcode                                                                                 | `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`                                                                   | Primary SMS channel (KE market); sandbox credentials for staging                                                                                                                                                                                                                    |
| **Twilio**               | Account + phone number                                                                                    | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (plain env)                                                  | SMS fallback channel                                                                                                                                                                                                                                                                |
| **Cloudflare Turnstile** | Widget (managed)                                                                                          | sitekey → web build var when the contact widget is wired; `TURNSTILE_SECRET_KEY` → Vault                              | The Terraform CF stack can create the widget and outputs the sitekey                                                                                                                                                                                                                |
| **Cloudflare R2**        | Buckets come from the CF Terraform stack; then R2 → API → **Create token** (out of band, never Terraform) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`                        | Bucket roles: public (avatars/studio), private (authorisations/invoices/reports/scan logs), audit (WORM), logs (Logpush). Give the token Object Read & Write on the first two only                                                                                                  |
| **NVD** (optional)       | nvd.nist.gov API key                                                                                      | `NVD_API_KEY`                                                                                                         | Without it the advisory import still works, rate-limited to a crawl                                                                                                                                                                                                                 |
| **Sentry** (optional)    | Two projects (api, web)                                                                                   | `SENTRY_DSN` (api env), `NEXT_PUBLIC_SENTRY_DSN` (web build var)                                                      |                                                                                                                                                                                                                                                                                     |
| **OCI Vault** (Path B)   | Values written by the operator runbook                                                                    | `SECRET_OCIDS_JSON` GitHub **variable** (from the TF output `secret_ocids`)                                           | OCIDs are identifiers, not secrets — that's why they live in a variable and in Helm values                                                                                                                                                                                          |

The name-by-name map with rotation procedures and blast radii:
`docs/vault-map.md`. What each app reads and defaults for:
`docs/env-reference.md`.

---

## 6. Staging acceptance, then production

Staging is "done" when:

```sh
node scripts/deploy/smoke.mjs --api https://api.staging.<zone> --web https://www.staging.<zone>   # 7/7
k6 run -e API_URL=https://api.staging.<zone> -e WEB_URL=https://www.staging.<zone> perf/k6/headers-audit.js   # checks 100%
k6 run -e API_URL=https://api.staging.<zone> perf/k6/auth-abuse.js    # limits engage, zero 5xx
```

…plus one manual pass: signup → verify email → login → MFA → request a scan
(Path B) → watch the terminal → review gate → checkout (Stripe test card
`4242…`) → invoice PDF → advisory publish → watch the Zero-Day progress strip.

Production is then the SAME artefacts promoted: same image digests
(`deploy.yml` dispatch with `environment=production`, which is
reviewer-gated), production env vars at build time for the web, live-mode
Stripe/Paystack keys, and every row of **`docs/go-live-checklist.md`** ticked
by a human — including the real-money round trip (one live USD charge, then
refunded) and the external penetration test. Nothing on that list is
automatable, and nothing is pre-ticked.

---

## Troubleshooting index

| Symptom                                     | First place to look                                                                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages deploy 404s on every non-static route | `nodejs_compat` missing (use `apps/web/wrangler.jsonc`), or you deployed `out/` instead of `.vercel/output/static`                                         |
| Site renders but every API call fails       | `NEXT_PUBLIC_API_URL` was wrong at BUILD time — rebuild; it is inlined, not runtime                                                                        |
| API 403s everything in production           | origin lock: Worker secret ≠ API secret, or you're hitting the LB directly (`ORIGIN_VERIFY_ENFORCE`, runbook §Rotate EDGE_ORIGIN_SECRET)                   |
| Login redirect loops                        | `COOKIE_DOMAIN`/`WEB_ORIGIN` mismatch, or Supabase redirect allow-list missing the web origin                                                              |
| Webhooks never arrive                       | endpoint URL vs the real hostname; Stripe/Paystack still in test mode; check the audit log — signature failures are recorded (`WEBHOOK_SIGNATURE_INVALID`) |
| Scan stuck `queued` (Path B)                | controller pod logs; the k3s tunnel; `vv-scan-controller-secrets` present in `vv-scans`                                                                    |
| Worker crash-loops on boot                  | its env block in `.env.staging` / the ExternalSecret's OCID map (`kubectl -n vunvault describe externalsecret`)                                            |
