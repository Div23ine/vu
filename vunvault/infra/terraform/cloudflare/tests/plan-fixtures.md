# `terraform plan` sanity checks — Cloudflare stack (Task 99)

Run after every non-trivial change, with a staging token; record the output in
the PR. Terraform is never applied from a laptop against production.

1. `terraform plan -var-file=staging.tfvars` shows **no changes to
   `cloudflare_r2_bucket_lock.audit`** — the compliance lock is write-once;
   any plan touching it is an incident, not a change.
2. The plan's `cloudflare_pages_project.web` diff never contains a
   `deployment_configs` block (the `ignore_changes` is working; CI owns
   deployments).
3. `cloudflare_zone_settings_override` shows `ssl = strict`,
   `min_tls_version = 1.2` and an enabled `security_header` — a plan that
   relaxes any of them fails review.
4. `cloudflare_authenticated_origin_pulls.this` is `enabled = true` and the
   plan never proposes disabling it.
5. The `destination_conf` values in the two Logpush jobs appear REDACTED in
   the plan output (sensitive variables) — if a key is ever printed in clear,
   rotate it and purge the CI log.
6. DNS: exactly two A records exist (`api` proxied, `origin` DNS-only) plus
   the Pages custom domains; `origin` flipping to `proxied = true` would loop
   the Worker — refuse.
7. `cloudflare_ruleset.rate_limits` keeps four rules with
   `characteristics = ["cf.colo.id", "ip.src"]` — a plan removing `ip.src`
   breaks per-client limiting.
8. Custom WAF rules: the webhook skips exist ONLY when the corresponding
   `*_webhook_ips` variable is non-empty (default empty ⇒ no skip rules in
   the plan).
9. Turnstile output is the site key only; `terraform output -json |
grep -i secret` prints nothing.
