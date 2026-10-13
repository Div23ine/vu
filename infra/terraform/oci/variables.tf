# Inputs (Task 98). Ids have NO defaults — a stack that silently provisions
# into the wrong tenancy is worse than one that refuses to plan.

variable "tenancy_ocid" {
  description = "Tenancy the stack provisions into."
  type        = string
}

variable "home_region" {
  description = "Home region (IAM and Vault live there)."
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment for every resource in this stack."
  type        = string
}

variable "region" {
  description = "Deployment region, e.g. eu-amsterdam-1."
  type        = string
}

variable "environment" {
  description = "Environment name; every resource is named vv-<environment>-<thing>."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.environment))
    error_message = "environment must be a lowercase DNS-safe name."
  }
}

# --- cluster shapes and images (pinned by CI repository variables) ---------

variable "oke_k8s_version" {
  description = "OKE Kubernetes version (e.g. v1.30.1); pinned per environment."
  type        = string
}

variable "node_image_id" {
  description = "OCID of the OKE worker node image."
  type        = string
}

variable "node_shape" {
  description = "OKE node pool shape."
  type        = string
  default     = "VM.Standard.E4.Flex"
}

variable "node_ocpus" {
  type    = number
  default = 2
}

variable "node_memory_gbs" {
  type    = number
  default = 16
}

variable "node_count" {
  description = "OKE node pool size, spread across the ADs of the region."
  type        = number
  default     = 3
}

variable "k3s_image_id" {
  description = "OCID of the Oracle Linux image for k3s instances."
  type        = string
}

variable "k3s_version" {
  description = "k3s release, e.g. v1.30.4+k3s1."
  type        = string
}

variable "k3s_shape" {
  type    = string
  default = "VM.Standard.E4.Flex"
}

variable "k3s_ocpus" {
  type    = number
  default = 2
}

variable "k3s_memory_gbs" {
  type    = number
  default = 16
}

variable "scan_agent_count" {
  description = "Number of k3s scan agents (the controller is separate)."
  type        = number
  default     = 2
}

variable "k3s_ssh_public_key" {
  description = "SSH key for k3s instance access THROUGH the bastion only."
  type        = string
  sensitive   = true
}

# --- access ------------------------------------------------------------------

variable "bastion_allowed_cidrs" {
  description = "CIDRs allowed to open bastion sessions (CI runners / office)."
  type        = list(string)
}

variable "deployer_group_name" {
  description = "IAM group whose members CI authenticates as (vv-deployer)."
  type        = string
  default     = "vv-deployer"
}

# --- cluster provider inputs (CI exports these from the forwarded kubeconfigs)

variable "oke_kubeconfig_host" {
  type      = string
  default   = ""
  sensitive = true
}

variable "oke_kubeconfig_ca" {
  type      = string
  default   = ""
  sensitive = true
}

variable "oke_kubeconfig_token" {
  type      = string
  default   = ""
  sensitive = true
}

variable "k3s_kubeconfig_host" {
  type      = string
  default   = ""
  sensitive = true
}

variable "k3s_kubeconfig_ca" {
  type      = string
  default   = ""
  sensitive = true
}

variable "k3s_kubeconfig_client_cert" {
  type      = string
  default   = ""
  sensitive = true
}

variable "k3s_kubeconfig_client_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "ocir_auth_token" {
  description = "OCIR auth token for the image-pull secrets. Sensitive; state-destined — the state bucket is private, versioned and CMK-encrypted."
  type        = string
  sensitive   = true
}

variable "ocir_username" {
  description = "OCIR pull username (tenancy-namespace/user form)."
  type        = string
}

variable "ocir_region_key" {
  description = "OCIR region key (ams, fra, …) — the registry hostname prefix."
  type        = string
}

# --- vault -------------------------------------------------------------------

variable "secret_names" {
  description = "The SECRET_NAMES list the applications read at runtime."
  type        = list(string)
  default = [
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "UPSTASH_REDIS_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "PAYSTACK_SECRET_KEY",
    "RESEND_API_KEY",
    "AFRICASTALKING_API_KEY",
    "AFRICASTALKING_USERNAME",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "AUDIT_HMAC_KEY",
    "AUDIT_AES_KEY",
    "NVD_API_KEY",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "SCAN_CONTROLLER_HMAC_KEY",
    "TURNSTILE_SECRET_KEY",
    "CF_ANALYTICS_TOKEN",
    "CF_ACCOUNT_ID",
    "ORIGIN_TLS_CERT",
    "ORIGIN_TLS_KEY",
    "CF_ORIGIN_PULL_CA",
    "EDGE_ORIGIN_SECRET",
  ]
}

# --- bootstrap chart pins ------------------------------------------------------

variable "ingress_nginx_chart_version" {
  description = "Pinned ingress-nginx chart version (exact, no range)."
  type        = string
  default     = "4.11.3"
}

variable "external_secrets_chart_version" {
  description = "Pinned external-secrets chart version (exact, no range)."
  type        = string
  default     = "0.10.5"
}
