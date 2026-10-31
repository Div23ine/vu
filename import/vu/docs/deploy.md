# Deployment (Tasks 102 + 103)

> Learning the deployment for the first time? Start with
> **[`deploy-guide.md`](deploy-guide.md)** — the teaching walkthrough
> (frontend-first, staging-first, third-party wiring). This file is the
> terse operator reference.

## Environments

| GitHub environment | Trigger                      | Reviewers                                  | Deploys to                                                                           |
| ------------------ | ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `staging`          | push to `main`               | none                                       | OKE staging namespace set, k3s staging, `api.staging.<zone>`, `vunvault-web-staging` |
| `production`       | `workflow_dispatch` (choice) | **required** (the org's release approvers) | the production estate                                                                |

Every deploy-shaped job (`migrate`, `deploy-*`, `smoke`, `rollback`) declares
`environment:` — that key is what attaches the reviewer gate and the scoped
secrets, and `scripts/verify-workflows.mjs` fails any workflow that forgets it.

## GitHub environment secrets (NAMES only — values never live in git)

Deployment credentials, the only material GitHub is allowed to hold:

- `OCI_USER_OCID`, `OCI_FINGERPRINT`, `OCI_TENANCY_OCID`, `OCI_PRIVATE_KEY` — the `vv-deployer` API key
- `OCIR_USERNAME`, `OCIR_AUTH_TOKEN` — image push/pull
- `CLOUDFLARE_API_TOKEN` — Pages/Worker deploys
- `DIRECT_DATABASE_URL` — Supabase DIRECT (non-poolered) URL for DDL only
- `GITLEAKS_LICENSE` (organisation-level; may be empty for OSS mode)

Repository VARIABLES (not secret, operator-set, pinned):
`OCIR_REGISTRY`, `OCI_REGION`, `COMPARTMENT_OCID`, `OKE_BASTION_ID`,
`SCAN_BASTION_ID`, `SECRET_OCIDS_JSON` (Task 98 `secret_ocids` output),
`EDGE_ORIGIN_SECRET_OCID`, `NODE_BUILD_IMAGE`, `DISTROLESS_IMAGE` (digests),
`NMAP_VERSION`/`NMAP_PACKAGE`, `NUCLEI_VERSION`/`NUCLEI_SHA256`,
`HTTPX_VERSION`/`HTTPX_SHA256`, `TESTSSL_VERSION`/`TESTSSL_SHA256`,
`NUCLEI_TEMPLATES_REF`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_R2_HOST`, `STRIPE_PUBLISHABLE_KEY`, `API_URL`, `WEB_URL`.

**Application secrets are NOT here.** They live in OCI Vault and reach pods at
runtime (API: resource principal; workers: External Secrets; k3s controller:
the Terraform-built Kubernetes secret). `EDGE_ORIGIN_SECRET` travels
Vault → CI memory (`::add-mask::`) → `wrangler secret put` and is never
printed or stored in GitHub.

## Sequence (deploy.yml)

1. `release` — bake + push six images pinned by digest, Trivy-gate each,
   cosign-sign keyless, publish `digests.json`.
2. `migrate` — `verify-migrations` (additive-only gate), then
   `pnpm --filter @vunvault/db db:migrate` over the direct URL.
3. `deploy-oke` — bastion tunnel → `helm-deploy.sh` api → broadcast →
   notify → maintenance, each `--atomic --wait` (self-rollback on failure).
4. `deploy-k3s` — tunnel → scan-controller.
5. `deploy-edge` — Vault fetch → `wrangler secret put` → `wrangler deploy`.
6. `deploy-web` — `cf:build` (`@opennextjs/cloudflare`) → `wrangler deploy --env <environment>`.
7. `smoke` — the seven property checks in `scripts/deploy/smoke.mjs`; on
   failure the `rollback` job `helm rollback`s the OKE releases to the
   previous revision.

## Rollback

Automatic: `--atomic` per release + the smoke-triggered `rollback` job.
Manual: run `rollback.yml` (environment, release, optional revision), or
re-dispatch `deploy.yml` with the last known-good `git_sha` (images are
immutable — redeploying an old SHA is a real rollback, not a rebuild).

## First-time bootstrap (human, in order)

1. Create the OCI tenancy compartment, the `vv-deployer` user + API key, and
   the state bucket (private, versioned, CMK-encrypted).
2. `terraform apply` the OCI stack (Task 98) — README documents the two-phase
   kubeconfig dance for the first apply.
3. Set every Vault secret VALUE (`CHANGE_ME` → real), out-of-band.
4. `terraform apply` the Cloudflare stack (Task 99) with `api_origin_ip` from
   step 2's outputs; mint the origin-pull certificate into Vault.
5. Create the GitHub environments, secrets and variables above; add the
   `production` required reviewers.
6. Push a tag / dispatch `deploy.yml` for `production`.
