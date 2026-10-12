# OCIR repositories (Task 97's images land here). Private, immutable tags
# where the API supports them, and one repository per service so a compromised
# push token cannot rewrite a sibling's images.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }
variable "ocir_region_key" {
  description = "The OCIR region key, e.g. ams for eu-amsterdam-1."
  type        = string
}

locals {
  repositories = [
    "vv/api",
    "vv/broadcast-worker",
    "vv/notify-worker",
    "vv/maintenance-worker",
    "vv/scan-controller",
    "vv/scan-runner",
  ]
}

resource "oci_artifacts_repository" "this" {
  for_each = toset(local.repositories)

  compartment_id = var.compartment_ocid
  display_name   = "${var.name_prefix}-${replace(each.value, "/", "-")}"
  is_immutable   = true  # a tag that moved is a supply-chain incident
  is_public      = false

  # Image scanning is enabled at the tenancy/registry level; CI (Task 102)
  # additionally runs Trivy over every build before the push.
}

data "oci_objectstorage_namespace" "this" {
  compartment_id = var.compartment_ocid
}

output "registry_url" {
  description = "<region-key>.ocir.io/<namespace> — the bake file's REGISTRY."
  value       = "${var.ocir_region_key}.ocir.io/${data.oci_objectstorage_namespace.this.namespace}"
}

output "repository_ids" {
  value = { for name, repo in oci_artifacts_repository.this : name => repo.id }
}
