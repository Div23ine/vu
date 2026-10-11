# Copy to <environment>.tfvars and fill in. NEVER commit the filled file —
# `.gitignore` excludes every *.tfvars except this example. No secret VALUES
# live in Terraform at all: they go into OCI Vault out-of-band (README.md).

tenancy_ocid     = "" # ocid1.tenancy.oc1..…
home_region      = "eu-amsterdam-1"
compartment_ocid = "" # ocid1.compartment.oc1..…
region           = "eu-amsterdam-1"
environment      = "staging"

oke_k8s_version = "v1.30.1"
node_image_id   = "" # ocid1.image.oc1..… (OKE worker image for the version above)
k3s_image_id    = "" # ocid1.image.oc1..… (Oracle Linux 9)
k3s_version     = "v1.30.4+k3s1"
scan_agent_count = 2

bastion_allowed_cidrs = ["203.0.113.0/24"] # e.g. the CI egress range

k3s_ssh_public_key = "ssh-ed25519 AAAA… ci@vunvault"

# Supplied by CI as TF_VAR_… from environment secrets, never from a file:
#   ocir_username, ocir_auth_token,
#   oke_kubeconfig_{host,ca,token}, k3s_kubeconfig_{host,ca,client_cert,client_key}
