# The OCI stack (Task 98): an OKE cluster for the API and workers, a
# SEPARATE k3s scan network with public-egress-only access, Vault, OCIR,
# least-privilege IAM and bastions.
#
# The isolation model is the point of this file. The two VCNs are not peered,
# not routed to each other and share nothing but the compartment. Scan nodes
# cannot see the API's database, the API cannot see scan nodes, and the only
# inbound path to either control plane is an OCI Bastion port-forward.

locals {
  name_prefix = "vv-${var.environment}"
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

module "network_oke" {
  source = "./modules/network-oke"

  compartment_ocid = var.compartment_ocid
  name_prefix      = local.name_prefix
}

module "oke" {
  source = "./modules/oke"

  compartment_ocid = var.compartment_ocid
  name_prefix      = local.name_prefix
  vcn_id           = module.network_oke.vcn_id
  api_subnet_id    = module.network_oke.api_endpoint_subnet_id
  node_subnet_ids  = module.network_oke.node_subnet_ids
  lb_subnet_id     = module.network_oke.lb_subnet_id
  node_nsg_id      = module.network_oke.node_nsg_id
  k8s_version      = var.oke_k8s_version
  node_image_id    = var.node_image_id
  node_shape       = var.node_shape
  node_ocpus       = var.node_ocpus
  node_memory_gbs  = var.node_memory_gbs
  node_count       = var.node_count
  availability_domains = [for ad in data.oci_identity_availability_domains.ads.availability_domains : ad.name]
}

module "network_scan" {
  source = "./modules/network-scan"

  compartment_ocid    = var.compartment_ocid
  name_prefix         = local.name_prefix
  bastion_subnet_cidr = module.network_oke.bastion_subnet_cidr
}

module "bastion" {
  source = "./modules/bastion"

  compartment_ocid    = var.compartment_ocid
  name_prefix         = local.name_prefix
  oke_vcn_id          = module.network_oke.vcn_id
  oke_target_subnet_id = module.network_oke.bastion_target_subnet_id
  scan_vcn_id         = module.network_scan.vcn_id
  scan_target_subnet_id = module.network_scan.node_subnet_id
  allowed_cidrs       = var.bastion_allowed_cidrs
}

module "k3s" {
  source = "./modules/k3s"

  compartment_ocid = var.compartment_ocid
  name_prefix      = local.name_prefix
  subnet_id        = module.network_scan.node_subnet_id
  nsg_id           = module.network_scan.node_nsg_id
  image_id         = var.k3s_image_id
  k3s_version      = var.k3s_version
  shape            = var.k3s_shape
  ocpus            = var.k3s_ocpus
  memory_gbs       = var.k3s_memory_gbs
  agent_count      = var.scan_agent_count
  ssh_public_key   = var.k3s_ssh_public_key
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
}

module "vault" {
  source = "./modules/vault"
  providers = {
    oci = oci.home
  }

  compartment_ocid = var.compartment_ocid
  name_prefix      = local.name_prefix
  secret_names     = var.secret_names
}

module "registry" {
  source = "./modules/registry"

  compartment_ocid = var.compartment_ocid
  name_prefix      = local.name_prefix
  ocir_region_key  = var.ocir_region_key
}

module "iam" {
  source = "./modules/iam"
  providers = {
    oci = oci.home
  }

  compartment_ocid    = var.compartment_ocid
  tenancy_ocid        = var.tenancy_ocid
  name_prefix         = local.name_prefix
  oke_cluster_id      = module.oke.cluster_id
  k3s_instance_ids    = module.k3s.instance_ids
  vault_id            = module.vault.vault_id
  tls_secret_ocids    = module.vault.tls_secret_ocids
  deployer_group_name = var.deployer_group_name
}

module "k8s_bootstrap" {
  source = "./modules/k8s-bootstrap"
  providers = {
    kubernetes.oke = kubernetes.oke
    helm.oke       = helm.oke
    kubernetes.k3s = kubernetes.k3s
  }

  name_prefix                = local.name_prefix
  region                     = var.region
  vault_id                   = module.vault.vault_id
  registry_url               = module.registry.registry_url
  ocir_username              = var.ocir_username
  ocir_auth_token            = var.ocir_auth_token
  ingress_nginx_chart_version  = var.ingress_nginx_chart_version
  external_secrets_chart_version = var.external_secrets_chart_version
  controller_secret_names    = ["SCAN_CONTROLLER_HMAC_KEY", "UPSTASH_REDIS_URL", "DATABASE_URL"]
  secret_ocids               = module.vault.secret_ocids
}
