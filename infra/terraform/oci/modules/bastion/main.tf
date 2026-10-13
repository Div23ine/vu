# OCI Bastions (Task 98): one per VCN. Both Kubernetes APIs are private; CI
# (Task 102) and human operators reach them exclusively through
# port-forwarding sessions from the CIDRs in var.allowed_cidrs. There is no
# jump host, no SSH into the OKE VCN, and the k3s SSH rule exists for
# break-glass only.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }
variable "oke_vcn_id" { type = string }
variable "oke_target_subnet_id" { type = string }
variable "scan_vcn_id" { type = string }
variable "scan_target_subnet_id" { type = string }
variable "allowed_cidrs" { type = list(string) }

resource "oci_bastion_bastion" "oke" {
  compartment_id       = var.compartment_ocid
  name                 = "${var.name_prefix}-bastion-oke"
  bastion_type         = "STANDARD"
  target_subnet_id     = var.oke_target_subnet_id
  client_cidr_block_allow_list = var.allowed_cidrs
  max_session_ttl_in_seconds   = 3600
}

resource "oci_bastion_bastion" "scan" {
  compartment_id       = var.compartment_ocid
  name                 = "${var.name_prefix}-bastion-scan"
  bastion_type         = "STANDARD"
  target_subnet_id     = var.scan_target_subnet_id
  client_cidr_block_allow_list = var.allowed_cidrs
  max_session_ttl_in_seconds   = 3600
}

output "oke_bastion_id" { value = oci_bastion_bastion.oke.id }
output "scan_bastion_id" { value = oci_bastion_bastion.scan.id }
