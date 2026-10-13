# IAM (Task 98): least privilege, one dynamic group per workload class and
# one policy whose every statement is commented with WHY it exists. The two
# rules that carry the design: pods read secrets with workload identity
# (nothing in a container ever holds a tenancy credential), and the k3s scan
# nodes — the machines assumed to be compromised — can pull images and do
# absolutely nothing else in OCI.

variable "compartment_ocid" { type = string }
variable "tenancy_ocid" { type = string }
variable "name_prefix" { type = string }
variable "oke_cluster_id" { type = string }
variable "k3s_instance_ids" { type = list(string) }
variable "vault_id" { type = string }
variable "tls_secret_ocids" { type = map(string) }
variable "deployer_group_name" { type = string }

# --- dynamic groups -----------------------------------------------------------

resource "oci_identity_dynamic_group" "oke_workloads" {
  compartment_id = var.tenancy_ocid
  name           = "${var.name_prefix}-oke-workloads"
  description    = "OKE pod service accounts (workload identity)."
  matching_rule  = "ALL { resource.type = 'cluster', resource.id = '${var.oke_cluster_id}' }"
}

resource "oci_identity_dynamic_group" "k3s_instances" {
  compartment_id = var.tenancy_ocid
  name           = "${var.name_prefix}-k3s-instances"
  description    = "The k3s scan nodes' instance principals."
  matching_rule  = "ANY { ${join(", ", [for id in var.k3s_instance_ids : "resource.id = '${id}'"])} }"
}

# --- policies -----------------------------------------------------------------

resource "oci_identity_policy" "workload_secrets" {
  compartment_id = var.compartment_ocid
  name           = "${var.name_prefix}-workload-secrets"
  description    = "Pod workload identity reads ONLY its own runtime secrets."
  statements = [
    # The API and the three workers read the runtime secret bundle — scoped to
    # this cluster's namespace and their exact service accounts, so a pod in
    # any other namespace (or cluster) asking for a secret is denied by IAM
    # itself, not just by the API.
    "Allow any-user to read secret-bundles in compartment id ${var.compartment_ocid} where all { request.principal.type = 'workload', request.principal.namespace = 'vunvault', request.principal.service_account in ('vv-api','vv-broadcast-worker','vv-notify-worker','vv-maintenance-worker'), request.principal.cluster_id = '${var.oke_cluster_id}' }",
    # External Secrets Operator fetches secret bundles for the WORKERS (they
    # take plain env, Task 89–92) and for the origin TLS material (Task 99).
    # Scoped by cluster + namespace + service account: an ESO in any other
    # namespace, or any other cluster, is denied by IAM itself. The API pod
    # does NOT go through ESO — it reads Vault with its own resource
    # principal (the statement above).
    "Allow any-user to read secret-bundles in compartment id ${var.compartment_ocid} where all { request.principal.type = 'workload', request.principal.namespace = 'external-secrets', request.principal.service_account = 'external-secrets', request.principal.cluster_id = '${var.oke_cluster_id}' }",
  ]
}

resource "oci_identity_policy" "k3s_nodes" {
  compartment_id = var.compartment_ocid
  name           = "${var.name_prefix}-k3s-nodes"
  description    = "Scan nodes: pull images. Nothing else. No Vault, no OCIR writes."
  statements = [
    # Image pulls for the scan-runner and controller images. Deliberately
    # `read repos` only — a scan node cannot push an image, read a secret or
    # touch the cluster API of OKE.
    "Allow dynamic-group ${var.name_prefix}-k3s-instances to read repos in compartment id ${var.compartment_ocid}",
  ]
}

resource "oci_identity_policy" "deployer" {
  compartment_id = var.compartment_ocid
  name           = "${var.name_prefix}-deployer"
  description    = "The CI deployment identity — images, tunnels, kubeconfigs."
  statements = [
    # Push and pull the six image repositories (Task 102).
    "Allow group ${var.deployer_group_name} to manage repos in compartment id ${var.compartment_ocid}",
    # Open bastion port-forwarding sessions to both private cluster APIs.
    "Allow group ${var.deployer_group_name} to use bastion-session in compartment id ${var.compartment_ocid}",
    "Allow group ${var.deployer_group_name} to use bastion in compartment id ${var.compartment_ocid}",
    # Read cluster metadata and generate kubeconfigs; NOT manage — CI cannot
    # resize, upgrade or delete the clusters.
    "Allow group ${var.deployer_group_name} to read clusters in compartment id ${var.compartment_ocid}",
    # Read the Vault secret OCIDs (not contents) so ExternalSecrets manifests
    # can reference them.
    "Allow group ${var.deployer_group_name} to read secret-family in compartment id ${var.compartment_ocid}",
  ]
}

output "dynamic_group_oke" { value = oci_identity_dynamic_group.oke_workloads.name }
output "dynamic_group_k3s" { value = oci_identity_dynamic_group.k3s_instances.name }
output "policy_ids" {
  value = {
    workloads = oci_identity_policy.workload_secrets.id
    k3s       = oci_identity_policy.k3s_nodes.id
    deployer  = oci_identity_policy.deployer.id
  }
}
