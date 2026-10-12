# `infra/terraform/oci` — the Oracle Cloud stack (Task 98)

OKE for the API and workers, an **isolated k3s scan network**, OCI Vault,
OCIR, least-privilege IAM and bastions. Cloudflare lives in Task 99's stack;
nothing here provisions a DNS record.

## Layout

| Path                    | What it owns                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/network-oke`   | VCN `10.10.0.0/16`: private API endpoint, private nodes, public LB subnet (the only `0.0.0.0/0` ingress in the repo: TCP 80/443), bastion subnet                                                               |
| `modules/oke`           | Enhanced cluster, private endpoint, one E4.Flex pool (2 OCPU / 16 GB, 3 nodes across ADs), workload identity                                                                                                   |
| `modules/network-scan`  | VCN `10.20.0.0/16`: one private subnet behind NAT, **no DRG/peering**, egress = the generated 103-CIDR public allow-list (`egress_cidrs.generated.tf`, regenerate: `node scripts/gen-scan-egress.mjs --write`) |
| `modules/k3s`           | Control + N agents, no public IPs, IMDSv2-only, join token via cloud-init 0600, host-firewall DROPs for link-local/RFC1918 FORWARD traffic                                                                     |
| `modules/vault`         | DEFAULT vault, AES-256 master key, one secret per `SECRET_NAMES` entry with `CHANGE_ME` + `ignore_changes` — operators set real values out-of-band                                                             |
| `modules/registry`      | Six private immutable OCIR repositories                                                                                                                                                                        |
| `modules/iam`           | Dynamic groups + commented policies: pod workload identity scoped per service account; k3s nodes may `read repos` and nothing else                                                                             |
| `modules/bastion`       | One bastion per VCN — the only path to either Kubernetes API                                                                                                                                                   |
| `modules/k8s-bootstrap` | ingress-nginx + external-secrets (pinned charts), the OCI `ClusterSecretStore`, `ocir-pull` secrets, the controller's Vault-sourced secret                                                                     |

## Operating it

```sh
terraform init -backend-config=bucket=<state-bucket> -backend-config=key=oci/<env>/terraform.tfstate \
  -backend-config=endpoint=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
terraform plan -var-file=<environment>.tfvars   # plus TF_VAR_* for the kubeconfig/OCIR secrets
```

First-boot ordering: apply the infra stack with the `k8s_bootstrap` module
targeted OUT (`-target=module.oke …`), fetch both kubeconfigs through bastion
port-forwards, export the `*_kubeconfig_*` TF_VARs, then apply fully.

## Read this before you touch state

**The state file contains secrets**: the k3s join token, the OCIR auth token
and the controller secret values fetched from Vault. The backend bucket MUST
be private, versioned and encrypted with a customer-managed key, and state
access is a security-review-level permission. Never `terraform state pull`
into a terminal recording, a CI log or a ticket.

`.terraform.lock.hcl` is committed (generated on first `terraform init` in
CI — run `terraform providers lock -platform=linux/amd64` once and commit the
result). `*.tfvars` other than `example.tfvars` are gitignored, and
`scripts/verify-terraform.mjs` fails the build if one appears.
