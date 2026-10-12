# Edge rate limits (Task 99) — the OUTER layer. The API keeps its own Redis
# counters (Task 23): these rules stop credential-stuffing volume from ever
# reaching it, keyed on ip.src (which is honest at the edge and only there).

resource "cloudflare_ruleset" "rate_limits" {
  zone_id = data.cloudflare_zone.this.id
  name    = "vv-rate-limits"
  kind    = "zone"
  phase   = "http_ratelimit"

  # Login and MFA verification: 20/min per IP, then a 10-minute block.
  rules {
    expression = "(http.request.uri.path eq \"/api/v1/auth/login\" or http.request.uri.path eq \"/api/v1/auth/mfa/verify\") and http.request.method eq \"POST\""
    action     = "block"
    action_parameters {
      timeout = 600
    }
    rate_limit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 20
    }
    description = "auth: login + MFA verify"
    enabled     = true
  }

  # Account-creation and recovery surfaces: 10 per 10 minutes.
  rules {
    expression = "(http.request.uri.path eq \"/api/v1/auth/signup\" or http.request.uri.path eq \"/api/v1/auth/forgot-password\" or http.request.uri.path eq \"/api/v1/auth/signup/resend\") and http.request.method eq \"POST\""
    action     = "block"
    action_parameters {
      timeout = 600
    }
    rate_limit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 600
      requests_per_period = 10
    }
    description = "auth: signup / recovery / resend"
    enabled     = true
  }

  # Public write endpoints behind Turnstile: 10 per 10 minutes.
  rules {
    expression = "(http.request.uri.path eq \"/api/v1/contact\" or http.request.uri.path eq \"/api/v1/newsletter\" or http.request.uri.path eq \"/api/v1/consent\") and http.request.method eq \"POST\""
    action     = "block"
    action_parameters {
      timeout = 600
    }
    rate_limit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 600
      requests_per_period = 10
    }
    description = "public: contact / newsletter / consent"
    enabled     = true
  }

  # The general API budget: 600/min per IP, then a managed challenge.
  rules {
    expression = "starts_with(http.request.uri.path, \"/api/v1/\")"
    action     = "challenge"
    rate_limit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 600
    }
    description = "api: general volume"
    enabled     = true
  }
}
