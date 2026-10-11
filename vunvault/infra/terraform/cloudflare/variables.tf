variable "account_id" {
  description = "Cloudflare account."
  type        = string
}

variable "zone_name" {
  description = "The apex zone, e.g. vunvault.com."
  type        = string
  default     = "vunvault.com"
}

variable "environment" {
  description = "staging | production — suffixes the Pages project and buckets."
  type        = string
}

variable "api_origin_ip" {
  description = "The OKE load balancer's public IP (output of the OCI stack)."
  type        = string
}

variable "web_origin" {
  description = "Canonical web origin, used for R2 CORS, e.g. https://www.vunvault.com."
  type        = string
}

variable "assets_hostname" {
  description = "Public hostname of the R2 media bucket, e.g. assets.vunvault.com."
  type        = string
}

variable "pages_branch" {
  description = "The branch Pages treats as production."
  type        = string
  default     = "main"
}

variable "r2_location_hint" {
  description = "R2 location hint, e.g. apac or enoc (eastern North America… use EEAA default)."
  type        = string
  default     = "default"
}

variable "stripe_publishable_key" {
  description = "Stripe PUBLISHABLE key — public by design, inlined into the web build."
  type        = string
  default     = ""
}

variable "pnpm_version" {
  description = "The packageManager-pinned pnpm the Pages build must use."
  type        = string
  default     = "9.15.0"
}

variable "stripe_webhook_ips" {
  description = "Provider-published source ranges allowed to skip WAF on the Stripe webhook path. Empty = no skip."
  type        = list(string)
  default     = []
}

variable "paystack_webhook_ips" {
  description = "Provider-published source ranges allowed to skip WAF on the Paystack webhook path. Empty = no skip."
  type        = list(string)
  default     = []
}

# Logpush writes to R2 with credentials supplied by CI (TF_VAR_*); they end up
# in the destination_conf string and therefore in STATE — the state bucket's
# encryption and access policy is the control (see README).
variable "logpush_r2_access_key_id" {
  type      = string
  default   = ""
  sensitive = true
}

variable "logpush_r2_secret_access_key" {
  type      = string
  default   = ""
  sensitive = true
}
