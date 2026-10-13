# Copy to <environment>.tfvars; NEVER commit the filled copy.

account_id       = "" # Cloudflare account id
zone_name        = "vunvault.example"
environment      = "staging"
api_origin_ip    = "" # output of the OCI stack: the OKE LB public IP
web_origin       = "https://www.vunvault.example"
assets_hostname  = "assets.vunvault.example"
r2_location_hint = "default"

# Publishable/public values only:
stripe_publishable_key = "" # pk_… — public by design

# Provider webhook allow-lists (empty = no WAF skip):
stripe_webhook_ips  = []
paystack_webhook_ips = []

# Supplied by CI as TF_VAR_* from environment secrets, never from a file:
#   logpush_r2_access_key_id, logpush_r2_secret_access_key
