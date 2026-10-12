# The scan VCN (Task 98) — the OCI half of the isolation model, and the most
# security-critical file in the repository.
#
# Rules, all of them deliberate:
#   1. NO DRG. NO local peering. NO remote peering. NO route to the OKE VCN
#      (10.10.0.0/16). A compromised scan node — and scanning hostile targets
#      means assuming compromise — must not be one route away from the API's
#      network. The two VCNs share a compartment and nothing else.
#   2. ONE private subnet behind a NAT gateway. No instance ever gets a public
#      IP; no inbound path exists except the bastion subnet's SSH/6443.
#   3. Egress is an ALLOW-LIST of the public IPv4 space: OCI security rules
#      only allow, so "the internet minus private/reserved ranges" is the
#      generated 103-CIDR list in egress_cidrs.generated.tf — the exact
#      complement of the controller's target guard (Task 84). The generated
#      file is the ONLY place an IPv4 literal appears in this module.
#   4. No service gateway: scan nodes have no OCI service business — they do
#      not read Vault (the controller's two secrets arrive as a Kubernetes
#      Secret built by Terraform, Task 98/k8s-bootstrap) and they pull images
#      through the NAT'd public OCIR endpoint.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }
variable "bastion_subnet_cidr" {
  description = "The OKE VCN's bastion-target subnet — the ONLY ingress source."
  type        = string
}

locals {
  vcn_cidr   = "10.20.0.0/16"
  node_cidr  = "10.20.1.0/24" # the single k3s subnet (control + agents)
  # Set by Terraform at plan time — documented here so a reader of main.tf
  # knows where the egress list comes from:
  #   egress_cidrs.generated.tf → local.scan_egress_cidrs (103 public CIDRs)
}

resource "oci_core_vcn" "this" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = [local.vcn_cidr]
  display_name   = "${var.name_prefix}-scan-vcn"
  dns_label      = "vvscan"
  # by_ipv6_cidr_block deliberately off: the egress allow-list is IPv4-only,
  # and an IPv6 path around it would defeat the entire design.
}

resource "oci_core_nat_gateway" "this" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-scan-nat"
}

resource "oci_core_route_table" "private" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-scan-rt"
  # ONE rule: default via NAT. There is no second gateway to add.
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_nat_gateway.this.id
  }
}

resource "oci_core_default_security_list" "lockdown" {
  manage_default_resource_id = oci_core_vcn.this.default_security_list_id
  display_name               = "${var.name_prefix}-scan-default-empty"
}

resource "oci_core_subnet" "nodes" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.this.id
  cidr_block                 = local.node_cidr
  display_name               = "${var.name_prefix}-k3s"
  route_table_id             = oci_core_route_table.private.id
  security_list_ids          = []
  prohibit_public_ip_on_vnic = true
}

resource "oci_core_network_security_group" "nodes" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-nsg-scan"
}

# --- ingress: bastion subnet ONLY -------------------------------------------

resource "oci_core_network_security_group_security_rule" "ingress_ssh" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = var.bastion_subnet_cidr
  source_type               = "CIDR_BLOCK"
  description               = "SSH from the bastion target subnet only"
  tcp_options {
    destination_port_range { min = 22 max = 22 }
  }
}

resource "oci_core_network_security_group_security_rule" "ingress_k3s_api" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = var.bastion_subnet_cidr
  source_type               = "CIDR_BLOCK"
  description               = "k3s API (CI port-forward sessions) from the bastion subnet only"
  tcp_options {
    destination_port_range { min = 6443 max = 6443 }
  }
}

# --- ingress: node-to-node inside the subnet (k3s gossip/VXLAN/kubelet) ------

resource "oci_core_network_security_group_security_rule" "ingress_intra_vxlan" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "17" # UDP
  source                    = local.node_cidr
  source_type               = "CIDR_BLOCK"
  description               = "flannel VXLAN between k3s nodes"
  udp_options {
    destination_port_range { min = 8472 max = 8472 }
  }
}

resource "oci_core_network_security_group_security_rule" "ingress_intra_tcp" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = local.node_cidr
  source_type               = "CIDR_BLOCK"
  description               = "k3s API + kubelet between nodes"
  tcp_options {
    destination_port_range { min = 6443 max = 6443 }
  }
}

resource "oci_core_network_security_group_security_rule" "ingress_intra_kubelet" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = local.node_cidr
  source_type               = "CIDR_BLOCK"
  description               = "kubelet between nodes"
  tcp_options {
    destination_port_range { min = 10250 max = 10250 }
  }
}

# --- egress: the generated public allow-list, one rule per CIDR ---------------

resource "oci_core_network_security_group_security_rule" "scan_egress" {
  for_each = toset(local.scan_egress_cidrs)

  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = each.value
  destination_type          = "CIDR_BLOCK"
  description               = "Public IPv4 space (generated allow-list)"
}

output "vcn_id" { value = oci_core_vcn.this.id }
output "node_subnet_id" { value = oci_core_subnet.nodes.id }
output "node_subnet_cidr" { value = local.node_cidr }
output "node_nsg_id" { value = oci_core_network_security_group.nodes.id }
