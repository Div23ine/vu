# Logpush (Task 99): http_requests and firewall_events into the logs bucket.
# The field list is a privacy decision, not a default: NO cookies, NO request
# headers, NO query strings — ClientRequestPath carries the route, and the
# maintenance worker's rollup plus incident review work off that.

locals {
  logpush_fields = join(",", [
    "ClientRequestPath",
    "ClientRequestMethod",
    "EdgeResponseStatus",
    "EdgeStartTimestamp",
    "OriginResponseStatus",
    "ClientIP",
    "RayID",
    "WAFAction",
    "WAFRuleID",
  ])
}

resource "cloudflare_logpush_job" "http_requests" {
  account_id       = var.account_id
  zone_id          = data.cloudflare_zone.this.id
  enabled          = true
  dataset          = "http_requests"
  logpull_options  = "fields=${local.logpush_fields}&timestamps=rfc3339"
  destination_conf = "r2://${cloudflare_r2_bucket.logs.name}/http_requests/{DATE}?account-id=${var.account_id}&access-key-id=${var.logpush_r2_access_key_id}&secret-access-key=${var.logpush_r2_secret_access_key}"
}

resource "cloudflare_logpush_job" "firewall_events" {
  account_id       = var.account_id
  zone_id          = data.cloudflare_zone.this.id
  enabled          = true
  dataset          = "firewall_events"
  logpull_options  = "fields=${local.logpush_fields}&timestamps=rfc3339"
  destination_conf = "r2://${cloudflare_r2_bucket.logs.name}/firewall_events/{DATE}?account-id=${var.account_id}&access-key-id=${var.logpush_r2_access_key_id}&secret-access-key=${var.logpush_r2_secret_access_key}"
}
