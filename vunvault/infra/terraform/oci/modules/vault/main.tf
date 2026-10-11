# OCI Vault (Task 98): the ONLY home of application secrets. Terraform creates
# the vault, an AES-256 master key and one secret per name in var.secret_names
# with placeholder content — operators set the real values out-of-band (Vault
# console / CLI), and `ignore_changes` makes sure no future plan can clobber or
# leak them. Pods read their secrets at runtime via workload identity (OKE) or
# the Terraform-built Kubernetes Secret (k3s); nothing is ever baked into an
# image, a Helm values file or this repository.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }
variable "secret_names" { type = list(string) }

resource "oci_kms_vault" "this" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.name_prefix}-vault"
  vault_type     = "DEFAULT"
}

resource "oci_kms_key" "master" {
  compartment_id      = var.compartment_ocid
  vault_id            = oci_kms_vault.this.id
  display_name        = "${var.name_prefix}-master-key"
  management_endpoint = oci_kms_vault.this.management_endpoint
  protection_mode     = "SOFTWARE"

  key_shape {
    algorithm = "AES"
    length    = 32 # AES-256
  }
}

resource "oci_vault_secret" "secrets" {
  for_each = toset(var.secret_names)

  compartment_id = var.compartment_ocid
  vault_id       = oci_kms_vault.this.id
  key_id         = oci_kms_key.master.id
  secret_name    = "${var.name_prefix}-${lower(each.value)}"
  description    = "VUNVAULT runtime secret ${each.value} — value set out-of-band."

  # base64("CHANGE_ME") — a placeholder that forces the operator rotation
  # step; the real value is NEVER written through Terraform.
  secret_content = "Q0hBTkdFX01F"

  lifecycle {
    # The content belongs to the operator. A plan that proposes changing it
    # means someone tried to manage a secret value as code — refuse.
    ignore_changes = [secret_content]
  }
}

output "vault_id" {
  value = oci_kms_vault.this.id
}

output "secret_ocids" {
  description = "name → secret OCID. OCIDs are identifiers, not secrets."
  value       = { for name, secret in oci_vault_secret.secrets : name => secret.id }
}

output "tls_secret_ocids" {
  description = "The TLS material the external-secrets service account may read (origin lock, Task 99)."
  value = {
    for name in ["ORIGIN_TLS_CERT", "ORIGIN_TLS_KEY", "CF_ORIGIN_PULL_CA"] :
    name => oci_vault_secret.secrets[name].id
  }
}
