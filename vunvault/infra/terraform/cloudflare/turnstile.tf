# Turnstile (Task 99): the bot check behind the public contact/newsletter
# forms. Only the SITE KEY is a Terraform output — the secret key goes into
# OCI Vault (TURNSTILE_SECRET_KEY) out-of-band, where the API already reads
# it from (Task 40).

resource "cloudflare_turnstile_widget" "this" {
  account_id = var.account_id
  name       = "vv-turnstile-${var.environment}"
  mode       = "managed"
  domains = [
    var.zone_name,
    local.www_hostname,
    local.api_hostname,
  ]
}
