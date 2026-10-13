# Provider configuration (Task 98).
#
# Authentication: the OCI CLI config / environment of whoever runs Terraform —
# in CI, the `vv-deployer` API key from GitHub environment secrets (the only
# credential allowed to live in GitHub). Nothing here embeds a key.

provider "oci" {
  region = var.region
}

# A second, home-region alias: IAM and Vault are global/home-region services.
provider "oci" {
  alias  = "home"
  region = var.home_region
}

# ---------------------------------------------------------------------------
# Cluster providers.
#
# Both Kubernetes APIs are PRIVATE: OKE's endpoint is a private VCN endpoint
# and the k3s API listens on a private subnet. CI reaches them through OCI
# Bastion port-forwarding sessions (Task 102/104) and exports the forwarded
# kubeconfig values as TF_VAR_* before plan/apply — which is why these are
# variables and not data sources: no provider here ever needs (or gets) a
# public path to a cluster API.

provider "kubernetes" {
  alias                  = "oke"
  host                   = var.oke_kubeconfig_host
  cluster_ca_certificate = var.oke_kubeconfig_ca
  token                  = var.oke_kubeconfig_token
}

provider "helm" {
  alias = "oke"
  kubernetes {
    host                   = var.oke_kubeconfig_host
    cluster_ca_certificate = var.oke_kubeconfig_ca
    token                  = var.oke_kubeconfig_token
  }
}

provider "kubernetes" {
  alias                  = "k3s"
  host                   = var.k3s_kubeconfig_host
  cluster_ca_certificate = var.k3s_kubeconfig_ca
  client_certificate     = var.k3s_kubeconfig_client_cert
  client_key             = var.k3s_kubeconfig_client_key
}
