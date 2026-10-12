# The OKE cluster (Task 98): enhanced cluster with a PRIVATE API endpoint,
# one managed node pool of flexible VMs spread across the region's ADs, and
# workload identity enabled so pods read OCI Vault secrets with their own
# service accounts — no cloud credentials ever reach a container.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }
variable "vcn_id" { type = string }
variable "api_subnet_id" { type = string }
variable "node_subnet_ids" { type = list(string) }
variable "lb_subnet_id" { type = string }
variable "node_nsg_id" { type = string }
variable "k8s_version" { type = string }
variable "node_image_id" { type = string }
variable "node_shape" { type = string }
variable "node_ocpus" { type = number }
variable "node_memory_gbs" { type = number }
variable "node_count" { type = number }
variable "availability_domains" { type = list(string) }

resource "oci_containerengine_cluster" "this" {
  compartment_id     = var.compartment_ocid
  name               = "${var.name_prefix}-oke"
  kubernetes_version = var.k8s_version
  vcn_id             = var.vcn_id
  type               = "ENHANCED_CLUSTER"

  # The API endpoint is private: CI and operators reach it through an OCI
  # Bastion port-forwarding session, never from the internet.
  endpoint_config {
    is_public_ip_enabled = false
    subnet_id            = var.api_subnet_id
    nsg_ids              = []
  }

  options {
    service_lb_subnet_ids = [var.lb_subnet_id]
    add_ons {
      is_kubernetes_dashboard_enabled = false
      is_tiller_enabled               = false
    }
    admission_controller_options {
      is_pod_security_policy_enabled = false
    }
    kubernetes_network_config {
      pods_cidr     = "10.244.0.0/16"
      services_cidr = "10.96.0.0/16"
    }
    # Workload identity (OKE-native): pods authenticate to OCI as
    # `request.principal.type = workload` with their service account — the
    # IAM module scopes each account to exactly the secrets it needs.
    persistent_freeform_tags = {
      "vv.workload-identity" = "enabled"
    }
  }
}

resource "oci_containerengine_node_pool" "workers" {
  cluster_id         = oci_containerengine_cluster.this.id
  compartment_id     = var.compartment_ocid
  name               = "${var.name_prefix}-pool"
  kubernetes_version = var.k8s_version
  node_shape         = var.node_shape
  node_image_id      = var.node_image_id

  node_config_details {
    size = var.node_count
    placement_configs {
      for_each = toset(var.availability_domains)
      content {
        availability_domain = each.value
        subnet_id           = var.node_subnet_ids[index(var.availability_domains, each.value) % length(var.node_subnet_ids)]
        nsg_ids             = [var.node_nsg_id]
      }
    }
  }

  node_shape_config {
    ocpus         = var.node_ocpus
    memory_in_gbs = var.node_memory_gbs
  }

  node_source_details {
    source_type             = "IMAGE"
    image_id                = var.node_image_id
    boot_volume_size_in_gbs = 60
  }
}

data "oci_containerengine_cluster" "this" {
  cluster_id = oci_containerengine_cluster.this.id
}

data "oci_containerengine_cluster_option" "this" {
  cluster_option_id = oci_containerengine_cluster.this.id
}

output "cluster_id" {
  value = oci_containerengine_cluster.this.id
}

output "cluster_endpoint" {
  description = "Private API endpoint — reachable only via the bastion tunnel."
  value       = try(data.oci_containerengine_cluster.this.endpoints[0].private_endpoint, "")
}
