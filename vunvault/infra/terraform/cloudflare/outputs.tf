output "pages_project_name" {
  description = "The Pages project CI deploys into."
  value       = cloudflare_pages_project.web.name
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
