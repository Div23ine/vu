# Vault map (Task 103)

Every secret the platform holds, who reads it, how it rotates and what a leak
costs. Source of truth for NAMES: `apps/api/src/lib/secrets/provider.ts`
(`SECRET_NAMES`) — the drift gate in `pnpm verify` keeps this document honest.

**The rule:** secret VALUES exist in exactly two places — OCI Vault and, at
runtime, inside the process that needs them. Never in git, never in Helm
values (OCIDs only), never in Terraform plans, never in CI logs (`::add-mask::`
anywhere a script touches one), never in an audit `details` field (the chain
seals sensitive fields with AES-256-GCM instead).

## How each consumer reads

| Path                                       | Mechanism                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| API pod                                    | `SECRETS_PROVIDER=oci-vault` → OCI SDK with its **resource principal** (workload identity), 5-minute cache. No credential in the pod.              |
| Workers (broadcast / notify / maintenance) | ExternalSecrets (`oci-vault` ClusterSecretStore) → Kubernetes Secret → `envFrom`. ESO's service account is IAM-scoped to this cluster + namespace. |
| Scan controller (k3s)                      | Terraform reads the bundle at apply time → `vv-scan-controller-secrets` Kubernetes Secret. The k3s cluster has NO Vault access by design.          |
| Edge Worker                                | `wrangler secret put EDGE_ORIGIN_SECRET` in CD, value piped from `oci secrets secret-bundle get` (masked, never printed).                          |
| Web (Cloudflare Worker)                    | Nothing. Every `NEXT_PUBLIC_*` value is public by definition.                                                                                      |

## The secrets

| Name                                                       | Consumers                           | Rotation                                                                           | Blast radius if leaked                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                             | api, all three OKE workers          | Supabase password rotate → update Vault → ESO refresh (≤15 min) or rollout restart | Full data read/write — treat as compromise: rotate + audit-chain review                                                         |
| `SUPABASE_SERVICE_ROLE_KEY`                                | api                                 | Supabase dashboard → Vault                                                         | Bypasses RLS on auth users — rotate immediately, review auth audit entries                                                      |
| `SUPABASE_JWT_SECRET`                                      | api                                 | Supabase dashboard → Vault; invalidates all sessions on rotate                     | Session forgery — rotate + force re-login                                                                                       |
| `UPSTASH_REDIS_URL`                                        | api, workers, controller            | Upstash rotate → Vault                                                             | Queue injection (fake scan jobs/broadcasts) + session-registry reads                                                            |
| `STRIPE_SECRET_KEY`                                        | api                                 | Stripe dashboard (roll) → Vault                                                    | Refunds/charges as VUNVAULT                                                                                                     |
| `STRIPE_WEBHOOK_SECRET`                                    | api                                 | Stripe endpoint reveal/roll → Vault                                                | Forged payment webhooks (signature check defeated)                                                                              |
| `PAYSTACK_SECRET_KEY`                                      | api                                 | Paystack dashboard → Vault                                                         | Forged M-Pesa/card confirmations, refunds                                                                                       |
| `RESEND_API_KEY`                                           | api, broadcast/notify workers       | Resend dashboard → Vault                                                           | Phishing from the vunvault.com sender                                                                                           |
| `AFRICASTALKING_USERNAME` / `AFRICASTALKING_API_KEY`       | api, broadcast/notify               | AT dashboard → Vault                                                               | SMS spoofing to every client contact (SEV-1 channel)                                                                            |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`                 | api, broadcast/notify               | Twilio key roll → Vault                                                            | Same, fallback SMS path                                                                                                         |
| `AUDIT_HMAC_KEY` (+ `AUDIT_HMAC_KEY_ID` env)               | api (append), maintenance (verify)  | **Dual-key window** — see runbook §Rotate the audit HMAC key                       | Chain re-signing — the crown jewels; rotate per runbook, never bare                                                             |
| `AUDIT_AES_KEY`                                            | api (sealing `details`)             | Dual-key window, same procedure                                                    | Unsealing of sealed audit details                                                                                               |
| `NVD_API_KEY`                                              | api (NVD import)                    | NVD portal → Vault                                                                 | Rate-limit abuse of our NVD quota only                                                                                          |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`                | api, notify, maintenance            | Cloudflare R2 token roll → Vault                                                   | Media overwrite (public bucket), report/invoice read (private), snapshot write (audit — WORM-locked, so destruction is bounded) |
| `SCAN_CONTROLLER_HMAC_KEY`                                 | api (verify), controller (sign)     | Vault → TF apply (k3s secret) + api ESO refresh; both sides must move together     | Forged scan callbacks — findings injection                                                                                      |
| `TURNSTILE_SECRET_KEY`                                     | api (contact/newsletter)            | CF dashboard → Vault                                                               | Bot submissions past the Turnstile check                                                                                        |
| `EDGE_ORIGIN_SECRET`                                       | api (verify), edge worker (stamp)   | **Worker first, API second** — runbook §Rotate the edge secret                     | Direct-to-LB access bypassing Cloudflare WAF/rate limits, and `cf-connecting-ip` spoofing                                       |
| `ORIGIN_TLS_CERT` / `ORIGIN_TLS_KEY` / `CF_ORIGIN_PULL_CA` | ingress (via ESO → TLS Secret)      | Cert re-mint → Vault → ESO                                                         | MITM of the edge→origin leg (defence in depth behind the origin lock)                                                           |
| `CF_ANALYTICS_TOKEN` / `CF_ACCOUNT_ID`                     | maintenance worker (metrics rollup) | CF dashboard → Vault                                                               | Analytics reads only                                                                                                            |

## What is NOT a Vault secret

Deployment credentials live in GitHub environment secrets (OCI deployer key,
OCIR auth token, Cloudflare API token, `DIRECT_DATABASE_URL`) — see
`deploy.md`. They are powerful but auditable through GitHub's own log, and
they must never reach a pod.
