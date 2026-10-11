# CI/CD (Tasks 101–102)

## Workflows

| Workflow       | Trigger                                                                            | What it does                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`       | PR, push to `main`                                                                 | `verify` (policy scripts → lint → typecheck), then in parallel `test` (all Vitest suites + coverage artifact + the `node --test` policy suites), `build` (Turbo builds + the web app through `next-on-pages`), `contracts` (the API route-table/audit conformance and the scan-worker isolation suites, named so a regression says which contract broke) |
| `iac.yml`      | PR/push touching `infra/**`, `docker/**`, `docker-bake.hcl`, `apps/scan-worker/**` | hadolint + `verify-dockerfiles` + `bake --print`; `helm lint`/`template` + kubeconform per chart; per-stack Terraform `fmt`/`validate`/tflint/checkov + `verify-terraform` + the egress drift gate                                                                                                                                                       |
| `security.yml` | PR, push to `main`, weekly                                                         | gitleaks, CodeQL (`security-extended`), dependency-review (PRs), `pnpm audit --prod`, Trivy fs + misconfig (SARIF)                                                                                                                                                                                                                                       |
| `cd.yml`       | push to `main` (staging) and version tags (production)                             | images → OCIR via bake, Helm deploys through bastion-forwarded kubeconfigs, Pages/Worker deploys, smoke tests                                                                                                                                                                                                                                            |

## Required checks protecting `main`

`verify`, `test`, `build`, `contracts`, `dockerfiles`, `helm`, `terraform (oci)`,
`terraform (cloudflare)`, `gitleaks`, `codeql`, `audit`. Production deploys
additionally require the `production` GitHub environment's reviewers.

## Allowed third-party actions

The workflow policy checker (`scripts/verify-workflows.mjs`) fails on any
`uses:` that is not local (`./…`) or listed here. Adding an entry is a
security review: pin to a tag at minimum, prefer a full SHA (the pinning bot,
Task 108, converts tags to SHAs weekly).

- `actions/checkout`
- `actions/setup-node`
- `actions/cache`
- `actions/upload-artifact`
- `actions/download-artifact`
- `hadolint/hadolint-action`
- `hashicorp/setup-terraform`
- `terraform-linters/setup-tflint`
- `bridgecrewio/checkov-action`
- `gitleaks/gitleaks-action`
- `github/codeql-action`
- `actions/dependency-review-action`
- `aquasecurity/trivy-action`
- `oracle-actions/configure-oci-cli` (CD only — bastion + kubeconfig fetch)
- `cloudflare/wrangler-action` (CD only — Pages/Worker deploys)
- `docker/login-action` (release only — OCIR push)
- `docker/setup-buildx-action` (release only)
- `sigstore/cosign-installer` (release only — keyless signing)

## Local equivalents

```sh
pnpm verify            # every policy script (html, stack, docker, terraform, egress, workflows)
pnpm lint && pnpm typecheck && pnpm test
node --test scripts/*.test.mjs
```

## Secrets

GitHub holds ONLY deployment credentials (environment secrets): the OCI
deployer key/auth-token, the Cloudflare API token, the Supabase direct URL for
migrations, the k3s kubeconfig material. Application secrets never touch CI —
they live in OCI Vault and reach pods at runtime (Task 98/100). No workflow
echoes a secret; `verify-workflows.mjs` fails the build if one tries.
