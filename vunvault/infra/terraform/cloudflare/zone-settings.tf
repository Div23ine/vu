# Zone posture (Task 99): full strict TLS with authenticated origin pulls,
# modern TLS only, HTTPS always, HSTS preload-ready. The origin certificate
# itself (CF_ORIGIN_PULL_CA material) is minted out-of-band and lands in OCI
# Vault; the ingress annotation side is Task 100's Helm values.

resource "cloudflare_zone_settings_override" "this" {
  zone_id = data.cloudflare_zone.this.id

  settings {
    ssl                      = "strict"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    automatic_https_rewrites = "on"
    always_use_https         = "on"
    browser_check            = "on"
    opportunistic_encryption = "on"
    http3                    = "on"
    websockets               = "on" # the audit tail and scan terminal need them
    security_header {
      enabled            = true
      max_age            = 63072000 # 2 years
      include_subdomains = true
      preload            = true
      nosniff            = true
    }
  }
}

# Authenticated Origin Pulls: the OKE load balancer verifies that every
# inbound TLS handshake carries Cloudflare's client certificate, so "direct to
# the LB" stops being a transport option at all (defence in depth behind the
# edge Worker's x-origin-verify).
resource "cloudflare_authenticated_origin_pulls" "this" {
  zone_id  = data.cloudflare_zone.this.id
  enabled  = true
}
