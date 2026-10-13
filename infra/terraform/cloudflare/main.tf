locals {
  api_hostname    = var.environment == "production" ? "api.${var.zone_name}" : "api.${var.environment}.${var.zone_name}"
  origin_hostname = var.environment == "production" ? "origin.${var.zone_name}" : "origin.${var.environment}.${var.zone_name}"
  www_hostname    = var.environment == "production" ? "www.${var.zone_name}" : "www.${var.environment}.${var.zone_name}"
}

data "cloudflare_zone" "this" {
  account_id = var.account_id
  name       = var.zone_name
}

# The apex redirects to www with ONE 301 — a single canonical web origin keeps
# cookies, CSP reporting and the sitemap honest.
resource "cloudflare_ruleset" "apex_redirect" {
  zone_id = data.cloudflare_zone.this.id
  name    = "vv-apex-to-www"
  kind    = "zone"
  phase   = "http_request_dynamic_redirect"

  rules {
    expression  = "(http.host eq \"${var.zone_name}\")"
    description = "Apex to www (301)"
    action      = "redirect"
    action_parameters {
      from_value {
        status_code = 301
        target_url {
          value = "\"https://${local.www_hostname}/\" + to_string(http.request.uri.path)"
        }
        preserve_query_string = true
      }
    }
    enabled = true
  }
}
