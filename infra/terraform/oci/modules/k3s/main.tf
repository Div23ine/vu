# The k3s scan cluster (Task 98): one control node, N scan agents, no public
# IPs, IMDSv1 disabled, and a join token that exists only in cloud-init (mode
# 0600) and Terraform state — which is why the state bucket is private,
# versioned and CMK-encrypted. SSH arrives through the bastion or not at all.
#
# The cloud-init templates add host-firewall DROPs for link-local and RFC1918
# destinations on FORWARD as defence in depth: even if an NSG rule were ever
# loosened, pod traffic still cannot reach metadata or private space.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }
variable "subnet_id" { type = string }
variable "nsg_id" { type = string }
variable "image_id" { type = string }
variable "k3s_version" { type = string }
variable "shape" { type = string }
variable "ocpus" { type = number }
variable "memory_gbs" { type = number }
variable "agent_count" { type = number }
variable "ssh_public_key" { type = string sensitive = true }
variable "availability_domain" { type = string }

resource "random_password" "k3s_token" {
  length  = 48
  special = false
}

resource "oci_core_instance" "server" {
  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  display_name        = "${var.name_prefix}-k3s-control"
  shape               = var.shape
  image               = var.image_id

  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gbs
  }

  instance_options {
    are_legacy_imds_endpoints_disabled = true # IMDSv2 only
  }

  create_vnic_details {
    subnet_id              = var.subnet_id
    nsg_ids                = [var.nsg_id]
    assign_public_ip       = false
    skip_source_dest_check = false
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init-server.yaml.tftpl", {
      k3s_version = var.k3s_version
      k3s_token   = random_password.k3s_token.result
    }))
  }

  lifecycle {
    ignore_changes = [metadata["user_data"]] # the token rotates out-of-band
  }
}

resource "oci_core_instance" "agents" {
  count = var.agent_count

  compartment_id      = var.compartment_ocid
  availability_domain = var.availability_domain
  display_name        = "${var.name_prefix}-k3s-agent-${count.index}"
  shape               = var.shape
  image               = var.image_id

  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_gbs
  }

  instance_options {
    are_legacy_imds_endpoints_disabled = true
  }

  create_vnic_details {
    subnet_id        = var.subnet_id
    nsg_ids          = [var.nsg_id]
    assign_public_ip = false
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init-agent.yaml.tftpl", {
      k3s_version   = var.k3s_version
      k3s_token     = random_password.k3s_token.result
      server_ip     = oci_core_instance.server.private_ip
    }))
  }

  lifecycle {
    ignore_changes = [metadata["user_data"]]
  }
}

output "server_private_ip" {
  value = oci_core_instance.server.private_ip
}

output "instance_ids" {
  description = "Control node first, then the agents — the IAM instance-principal group."
  value       = concat([oci_core_instance.server.id], oci_core_instance.agents[*].id)
}
