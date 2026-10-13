# The web frontend is a Worker built by @opennextjs/cloudflare and deployed by
# `wrangler deploy --env <environment>` (see apps/web/wrangler.jsonc). Terraform
# does not manage it: the pinned cloudflare provider (~> 4.40) predates
# assets-Worker support, and the vv-edge Worker set the precedent of wrangler
# owning the Worker and its custom domains. These outputs publish the values CI
# needs as GitHub repository VARIABLES, so the build-time NEXT_PUBLIC_* values
# and the Worker name stay derived from this stack instead of being retyped.
output "web_worker_name" {
  description = "The Worker name CI deploys (must match `name` in apps/web/wrangler.jsonc for this environment)."
  value       = "vunvault-web-${var.environment}"
}

output "www_hostname" {
  description = "Canonical web hostname (NEXT_PUBLIC_SITE_URL). Served by the web Worker's custom_domain route."
  value       = local.www_hostname
}

output "apex_hostname" {
  description = "Apex hostname, production only. Also a custom_domain route on the web Worker."
  value       = var.environment == "production" ? var.zone_name : "${var.environment}.${var.zone_name}"
}

output "stripe_publishable_key" {
  description = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — publishable by design, inlined into the web build."
  value       = var.stripe_publishable_key
}

output "assets_url" {
  description = "Public media origin (NEXT_PUBLIC_R2_HOST)."
  value       = "https://${var.assets_hostname}"
}

output "bucket_names" {
  description = "The four R2 buckets by role."
  value = {
    public  = cloudflare_r2_bucket.public.name
    private = cloudflare_r2_bucket.private.name
    audit   = cloudflare_r2_bucket.audit.name
    logs    = cloudflare_r2_bucket.logs.name
  }
}

output "turnstile_sitekey" {
  description = "PUBLIC site key (NEXT_PUBLIC_TURNSTILE_SITEKEY). The secret lives in Vault."
  value       = cloudflare_turnstile_widget.this.id
}

output "api_hostname" {
  description = "The proxied API hostname the Worker route binds to."
  value       = local.api_hostname
}

output "origin_hostname" {
  description = "The DNS-only origin hostname — wrangler's ORIGIN_HOST var."
  value       = local.origin_hostname
}
