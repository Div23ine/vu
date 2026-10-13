# The OKE VCN (Task 98): 10.10.0.0/16, private API endpoint, private nodes,
# a public load-balancer subnet (the ONLY public surface of the platform) and
# a bastion target subnet. Node egress is NAT'd; nothing here is reachable
# from the internet except the LB's 80/443.

variable "compartment_ocid" { type = string }
variable "name_prefix" { type = string }

locals {
  vcn_cidr     = "10.10.0.0/16"
  api_cidr     = "10.10.1.0/24" # private: OKE Kubernetes API endpoint
  node_cidrs   = ["10.10.2.0/24", "10.10.3.0/24"] # private: worker nodes, per AD
  lb_cidr      = "10.10.4.0/24" # public: the flexible load balancer
  bastion_cidr = "10.10.5.0/24" # private: bastion target
  node_port_range_min = 30000
  node_port_range_max = 32767
}

resource "oci_core_vcn" "this" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = [local.vcn_cidr]
  display_name   = "${var.name_prefix}-oke-vcn"
  dns_label      = "vvke"
}

resource "oci_core_internet_gateway" "this" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-igw"
}

resource "oci_core_nat_gateway" "this" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-nat"
}

resource "oci_core_service_gateway" "this" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-sgw"
  services {
    service_id = lookup(data.oci_core_services.this.services[0], "id")
  }
}

data "oci_core_services" "this" {
  filter {
    name   = "name"
    values = ["All .* Services In Oracle Services Network"]
    regex  = true
  }
}

# --- route tables -----------------------------------------------------------

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-rt-public"
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.this.id
  }
}

resource "oci_core_route_table" "private" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-rt-private"
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_nat_gateway.this.id
  }
  route_rules {
    destination       = "all-ams-services-in-oracle-services-network"
    destination_type  = "SERVICE_CIDR_BLOCK"
    network_entity_id = oci_core_service_gateway.this.id
  }
}

# --- subnets ------------------------------------------------------------------

resource "oci_core_subnet" "api_endpoint" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.this.id
  cidr_block        = local.api_cidr
  display_name      = "${var.name_prefix}-oke-api"
  route_table_id    = oci_core_route_table.private.id
  prohibit_public_ip_on_vnic = true
}

resource "oci_core_subnet" "nodes" {
  for_each = toset(local.node_cidrs)

  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.this.id
  cidr_block        = each.value
  display_name      = "${var.name_prefix}-oke-nodes-${substr(replace(each.value, ".", "-"), 0, 12)}"
  route_table_id    = oci_core_route_table.private.id
  security_list_ids = []
  prohibit_public_ip_on_vnic = true
}

resource "oci_core_subnet" "lb" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  cidr_block     = local.lb_cidr
  display_name   = "${var.name_prefix}-oke-lb"
  route_table_id = oci_core_route_table.public.id
  security_list_ids = []
}

resource "oci_core_subnet" "bastion_target" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.this.id
  cidr_block        = local.bastion_cidr
  display_name      = "${var.name_prefix}-oke-bastion"
  route_table_id    = oci_core_route_table.private.id
  prohibit_public_ip_on_vnic = true
}

# --- NSGs ---------------------------------------------------------------------
# The load-balancer NSG carries the ONE wildcard ingress rule the whole repo
# is allowed (TCP 80/443 — the public API). Everything else in this VCN is
# NSG-to-NSG or egress-only.

resource "oci_core_network_security_group" "lb" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-nsg-lb"
}

# The VCN's default security list is OCI's notorious allow-all ingress. It is
# emptied: every rule in this VCN lives in an NSG above.
resource "oci_core_default_security_list" "lockdown" {
  manage_default_resource_id = oci_core_vcn.this.default_security_list_id
  display_name               = "${var.name_prefix}-default-empty"
}

resource "oci_core_network_security_group_security_rule" "lb_ingress_http" {
  network_security_group_id = oci_core_network_security_group.lb.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Public API over HTTP — redirected to HTTPS at the edge"
  tcp_options {
    destination_port_range { min = 80  max = 80 }
  }
}

resource "oci_core_network_security_group_security_rule" "lb_ingress_https" {
  network_security_group_id = oci_core_network_security_group.lb.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Public API over HTTPS"
  tcp_options {
    destination_port_range { min = 443 max = 443 }
  }
}

resource "oci_core_network_security_group_security_rule" "lb_egress_nodeports" {
  network_security_group_id = oci_core_network_security_group.lb.id
  direction                 = "EGRESS"
  protocol                  = "6"
  destination               = oci_core_network_security_group.nodes.id
  destination_type          = "NETWORK_SECURITY_GROUP"
  description               = "LB to ingress-nginx NodePorts only"
  tcp_options {
    destination_port_range {
      min = local.node_port_range_min
      max = local.node_port_range_max
    }
  }
}

resource "oci_core_network_security_group" "nodes" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.this.id
  display_name   = "${var.name_prefix}-nsg-nodes"
}

resource "oci_core_network_security_group_security_rule" "node_ingress_nodeports" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = oci_core_network_security_group.lb.id
  source_type               = "NETWORK_SECURITY_GROUP"
  description               = "NodePorts from the LB NSG only"
  tcp_options {
    destination_port_range {
      min = local.node_port_range_min
      max = local.node_port_range_max
    }
  }
}

resource "oci_core_network_security_group_security_rule" "node_ingress_kubelet" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = local.api_cidr
  source_type               = "CIDR_BLOCK"
  description               = "kubelet from the OKE API endpoint subnet"
  tcp_options {
    destination_port_range { min = 10250 max = 10250 }
  }
}

resource "oci_core_network_security_group_security_rule" "node_egress_all" {
  network_security_group_id = oci_core_network_security_group.nodes.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "Workers pull images and reach the Supabase/Upstash SaaS endpoints"
}

output "vcn_id" { value = oci_core_vcn.this.id }
output "api_endpoint_subnet_id" { value = oci_core_subnet.api_endpoint.id }
output "node_subnet_ids" { value = [for s in oci_core_subnet.nodes : s.id] }
output "lb_subnet_id" { value = oci_core_subnet.lb.id }
output "bastion_target_subnet_id" { value = oci_core_subnet.bastion_target.id }
output "bastion_subnet_cidr" { value = local.bastion_cidr }
output "node_nsg_id" { value = oci_core_network_security_group.nodes.id }
output "lb_nsg_id" { value = oci_core_network_security_group.lb.id }
