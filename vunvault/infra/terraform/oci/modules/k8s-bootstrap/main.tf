# Cluster bootstrap (Task 98): the pieces Helm needs before Helm charts can
# deploy — ingress-nginx and external-secrets on OKE, the OCI Vault
# ClusterSecretStore, and the image-pull + controller secrets on both clusters.
#
# Two of these secrets end up in Terraform STATE (the OCIR auth token, the
# controller's Vault-sourced values): that is why the backend bucket is
# private, versioned and CMK-encrypted, and why the README says so loudly.

terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
      configuration_aliases = [kubernetes.oke, kubernetes.k3s]
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
      configuration_aliases = [helm.oke]
    }
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

variable "name_prefix" { type = string }
variable "region" { type = string }
variable "vault_id" { type = string }
variable "registry_url" { type = string }
variable "ocir_username" { type = string }
variable "ocir_auth_token" { type = string sensitive = true }
variable "ingress_nginx_chart_version" { type = string }
variable "external_secrets_chart_version" { type = string }
variable "controller_secret_names" { type = list(string) }
variable "secret_ocids" { type = map(string) }

# --- namespaces ----------------------------------------------------------------

resource "kubernetes_namespace_v1" "vunvault" {
  provider = kubernetes.oke
  metadata {
    name = "vunvault"
    labels = { "app.kubernetes.io/part-of" = var.name_prefix }
  }
}

resource "kubernetes_namespace_v1" "external_secrets" {
  provider = kubernetes.oke
  metadata {
    name = "external-secrets"
  }
}

# The scan namespace is created HERE (not by the Helm chart) so Terraform can
# put the controller's secrets into it in the same apply. The chart (Task 100)
# delivers everything else: RBAC, default-deny, limits, quota, the controller.
# The Pod Security labels are the Task 86 contract: `restricted`, enforced.
resource "kubernetes_namespace_v1" "scan_system" {
  provider = kubernetes.k3s
  metadata {
    name = "vv-scans"
    labels = {
      "app.kubernetes.io/name"                  = "vv-scan"
      "app.kubernetes.io/part-of"               = "vunvault"
      "pod-security.kubernetes.io/enforce"      = "restricted"
      "pod-security.kubernetes.io/enforce-version" = "latest"
      "pod-security.kubernetes.io/audit"        = "restricted"
      "pod-security.kubernetes.io/audit-version"   = "latest"
      "pod-security.kubernetes.io/warn"         = "restricted"
      "pod-security.kubernetes.io/warn-version"    = "latest"
    }
  }
}

# --- ingress-nginx (OKE) --------------------------------------------------------

resource "helm_release" "ingress_nginx" {
  provider = helm.oke

  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = var.ingress_nginx_chart_version # pinned exact; no ranges
  namespace  = "ingress-nginx"
  create_namespace = true
  atomic     = true
  timeout    = 600

  values = [yamlencode({
    controller = {
      service = {
        type = "LoadBalancer"
        annotations = {
          # The OCI flexible LB the network-oke NSGs were built around.
          "oci.oraclecloud.com/load-balancer-type" = "lb"
          "oci-load-balancer-shape"                = "flexible"
          "oci-load-balancer-shape-flex-min"       = "10"
          "oci-load-balancer-shape-flex-max"       = "100"
        }
      }
      config = {
        # Behind the Cloudflare edge Worker (Task 99/101): trust its
        # X-Forwarded-For, and speak only modern TLS at the LB.
        use-forwarded-headers = "true"
        ssl-protocols         = "TLSv1.2 TLSv1.3"
      }
      resources = {
        requests = { cpu = "100m", memory = "128Mi" }
        limits   = { cpu = "1", memory = "512Mi" }
      }
    }
  })]
}

# --- external-secrets (OKE) + the OCI ClusterSecretStore ------------------------

resource "helm_release" "external_secrets" {
  provider = helm.oke

  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = var.external_secrets_chart_version
  namespace  = "external-secrets"
  atomic     = true
  timeout    = 600

  values = [yamlencode({
    serviceAccount = {
      name = "external-secrets"
      annotations = {
        # Workload identity: ESO authenticates to OCI as its own service
        # account, scoped by IAM to the three TLS secrets — no API key.
        "oci.oraclecloud.com/workload-identity" = "enabled"
      }
    }
  })]

  depends_on = [kubernetes_namespace_v1.external_secrets]
}

resource "kubernetes_manifest" "cluster_secret_store" {
  provider = kubernetes.oke

  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ClusterSecretStore"
    metadata = {
      name = "oci-vault"
    }
    spec = {
      provider = {
        oracle = {
          region   = var.region
          vault    = var.vault_id
          auth     = {
            workload-identity = {}
          }
        }
      }
    }
  }

  depends_on = [helm_release.external_secrets]
}

# --- image-pull secrets ----------------------------------------------------------

resource "kubernetes_secret_v1" "ocir_pull_oke" {
  provider = kubernetes.oke

  metadata {
    name      = "ocir-pull"
    namespace = kubernetes_namespace_v1.vunvault.metadata[0].name
  }
  type = "kubernetes.io/dockerconfigjson"
  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        (var.registry_url) = {
          username = var.ocir_username
          password = var.ocir_auth_token
        }
      }
    })
  }
}

resource "kubernetes_secret_v1" "ocir_pull_k3s" {
  provider = kubernetes.k3s

  metadata {
    name      = "ocir-pull"
    namespace = kubernetes_namespace_v1.scan_system.metadata[0].name
  }
  type = "kubernetes.io/dockerconfigjson"
  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        (var.registry_url) = {
          username = var.ocir_username
          password = var.ocir_auth_token
        }
      }
    })
  }
}

# --- the scan controller's two secrets, read from Vault at apply time -----------
# The k3s cluster has no workload identity and must never get one: the scan
# nodes are the assumed-compromised tier. Terraform (running as the deployer,
# inside the bastion path) reads the bundle ONCE and writes a Kubernetes
# Secret; the controller consumes it from there (Task 88's env contract).

data "oci_secrets_secretbundle" "controller" {
  for_each = toset(var.controller_secret_names)

  secret_id = var.secret_ocids[each.value]
}

resource "kubernetes_secret_v1" "scan_controller" {
  provider = kubernetes.k3s

  metadata {
    name      = "vv-scan-controller-secrets"
    namespace = kubernetes_namespace_v1.scan_system.metadata[0].name
  }
  type = "Opaque"
  data = {
    for name, bundle in data.oci_secrets_secretbundle.controller :
    name => base64decode(bundle.secret_bundle_content[0].content)
  }
}
