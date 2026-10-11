# DNS (Task 99). Exactly three records:
#  - `api`    proxied  → the Worker's custom domain lives on api.<zone>; the
#                        A record points at the OKE LB so Cloudflare has an
#                        origin to reach for the Worker route.
#  - `origin` DNS-only → the SAME IP, unproxied: the hostname the edge Worker
#                        fetches. Grey-clouded on purpose — proxying it would
#                        loop the request back into the Worker.
#  - apex/www → owned by the Pages custom domains in pages.tf (Cloudflare
#                        flattens them at the edge); no records here.

resource "cloudflare_record" "api" {
  zone_id = data.cloudflare_zone.this.id
  name    = var.environment == "production" ? "api" : "api.${var.environment}"
  type    = "A"
  value   = var.api_origin_ip
  proxied = true
  ttl     = 1 # automatic
  comment = "VUNVAULT API behind the edge Worker"
}

resource "cloudflare_record" "origin" {
  zone_id = data.cloudflare_zone.this.id
  name    = var.environment == "production" ? "origin" : "origin.${var.environment}"
  type    = "A"
  value   = var.api_origin_ip
  proxied = false # DNS-only: the Worker's fetch target. Proxying would loop.
  ttl     = 300
  comment = "Origin hostname for the vv-edge Worker — the API's origin lock makes direct hits useless"
}
