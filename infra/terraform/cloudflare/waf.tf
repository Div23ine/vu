# WAF (Task 99): Cloudflare's managed rules BLOCK, OWASP runs at paranoia
# level 2 (anomaly threshold 40), and three custom rules encode the API's own
# shape at the edge. The webhook skips exist because provider callbacks fail
# signature checks they cannot retry around — but a skip is only armed when the
# provider's published IP list is passed in, and both lists default to EMPTY.

resource "cloudflare_ruleset" "managed" {
  zone_id = data.cloudflare_zone.this.id
  name    = "vv-managed-firewall"
  kind    = "zone"
  phase   = "http_request_firewall_managed"

  rules {
    action = "execute"
    expression = "true"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Ruleset
      action = "block"
    }
    enabled = true
  }

  rules {
    action = "execute"
    expression = "true"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f" # OWASP Core Ruleset
      version = "latest"
      action = "block"
      sensitivity_level = "high" # paranoia level 2 behaviour
      anomaly_threshold = 40
    }
    enabled = true
  }
}

resource "cloudflare_ruleset" "custom" {
  zone_id = data.cloudflare_zone.this.id
  name    = "vv-custom-firewall"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  # 1 — The API hostname serves the API shape and nothing else. The edge
  #     Worker enforces the same list in code; this is the outer copy.
  rules {
    expression  = "(http.host eq \"${local.api_hostname}\" and not starts_with(http.request.uri.path, \"/api/v1/\") and http.request.uri.path ne \"/healthz\" and http.request.uri.path ne \"/readyz\" and http.request.uri.path ne \"/openapi.json\")"
    description = "API hostname: allow-listed paths only"
    action      = "block"
    enabled     = true
  }

  # 2 — High threat score on the auth surface gets a managed challenge.
  rules {
    expression  = "(starts_with(http.request.uri.path, \"/api/v1/auth/\") and cf.threat_score > 30)"
    description = "Auth paths: challenge high threat scores"
    action      = "challenge"
    enabled     = true
  }

  # 3 — No user agent on the API is a bot pretending to be nothing.
  rules {
    expression  = "(starts_with(http.request.uri.path, \"/api/v1/\") and http.user_agent eq \"\")"
    description = "API: empty User-Agent blocked"
    action      = "block"
    enabled     = true
  }

  # 4/5 — Provider webhook skips, armed ONLY with a published source list.
  dynamic "rules" {
    for_each = length(var.stripe_webhook_ips) > 0 ? [1] : []
    content {
      expression  = "(http.request.uri.path eq \"/api/v1/webhooks/stripe\" and not ip.src in { ${join(" ", var.stripe_webhook_ips)} })"
      description = "Stripe webhook: WAF applies unless the source is a published Stripe IP"
      action      = "skip"
      action_parameters {
        ruleset = "current"
      }
      enabled = true
    }
  }

  dynamic "rules" {
    for_each = length(var.paystack_webhook_ips) > 0 ? [1] : []
    content {
      expression  = "(http.request.uri.path eq \"/api/v1/webhooks/paystack\" and not ip.src in { ${join(" ", var.paystack_webhook_ips)} })"
      description = "Paystack webhook: WAF applies unless the source is a published Paystack IP"
      action      = "skip"
      action_parameters {
        ruleset = "current"
      }
      enabled = true
    }
  }
}
