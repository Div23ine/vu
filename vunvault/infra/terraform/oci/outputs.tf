output "oke_cluster_id" {
  description = "OKE cluster the API and workers run on."
  value       = module.oke.cluster_id
}

output "oke_private_endpoint" {
  description = "Private Kubernetes API endpoint — bastion port-forward only."
  value       = module.oke.cluster_endpoint
}

output "scan_vcn_id" {
  description = "The isolated scan VCN (no peering, public egress only)."
  value       = module.network_scan.vcn_id
}

output "k3s_server_private_ip" {
  description = "k3s control node — reachable only inside the scan VCN."
  value       = module.k3s.server_private_ip
}

output "vault_id" {
  description = "OCI Vault holding every application secret."
  value       = module.vault.vault_id
}

output "secret_ocids" {
  description = "Map of secret name to OCID. OCIDs are identifiers, not secrets."
  value       = module.vault.secret_ocids
}

output "registry_url" {
  description = "OCIR registry path the images are pushed to."
  value       = module.registry.registry_url
}

output "bastion_oke_id" {
  description = "Bastion in front of the OKE API endpoint."
  value       = module.bastion.oke_bastion_id
}

output "bastion_scan_id" {
  description = "Bastion in front of the k3s API."
  value       = module.bastion.scan_bastion_id
}
