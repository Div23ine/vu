# `infra/terraform/cloudflare` — the Cloudflare stack (Task 99)

DNS (proxied `api`, DNS-only `origin` for the edge Worker), strict TLS with Authenticated Origin Pulls, managed+OWASP WAF
with the API-shape custom rules, four edge rate-limit rules, four R2 buckets
(the **audit bucket is compliance-locked for 2555 days**), Logpush of
`http_requests`/`firewall_events` with a privacy-minimal field list, and the
Turnstile widget.

## Running it

```sh
export CLOUDFLARE_API_TOKEN=…        # CI environment secret; never a file
terraform init -backend-config=bucket=<state-bucket> \
  -backend-config=key=cloudflare/<env>/terraform.tfstate \
  -backend-config=endpoint=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
terraform plan -var-file=<environment>.tfvars
```

Apply order across stacks: OCI (Task 98) first — this stack consumes
`api_origin_ip` from its outputs — then Cloudflare, then `wrangler secret put
EDGE_ORIGIN_SECRET` (value from OCI Vault) and the Worker deploy (Task 102).

## Secrets policy

The only sensitive values in this stack are the two Logpush R2 credentials
(CI `TF_VAR_*`) and they land in `destination_conf` — which means they land in
STATE. The state bucket is private, versioned and CMK-encrypted, and state
access is a security-review-level permission. No API token, no Turnstile
secret, no R2 S3 credential is ever created or stored here.

## Cross-stack contract

- `origin_hostname` output → the Worker's `ORIGIN_HOST` var (apps/edge).
- The API's `x-origin-verify` lock (apps/api/plugins/origin-verify.ts) pairs
  with the Worker's secret header; Authenticated Origin Pulls make direct
  transport-level bypass fail as well.
- `vv_requests` Analytics Engine dataset (the Worker writes, the maintenance
  worker's rollup reads) is created by `wrangler`/the dashboard out-of-band
  and referenced by binding only.
