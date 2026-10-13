# `infra/helm` — the five service charts (Task 100)

One library chart (`vv-lib`) carries the workload and security templates, so
the hardening contract (non-root 65532, read-only rootfs + `/tmp` emptyDir,
all capabilities dropped, seccomp `RuntimeDefault`, requests AND limits,
pinned tags with a `fail` guard instead of `latest`) is written ONCE and
cannot drift per service. Task 104's checker enforces it textually.

| Chart                | Cluster | Namespace  | Notes                                                                                                                                                             |
| -------------------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`                | OKE     | `vunvault` | ingress + service; reads OCI Vault directly (resource principal), no ExternalSecret                                                                               |
| `broadcast-worker`   | OKE     | `vunvault` | ExternalSecret `vv-broadcast-worker-secrets`                                                                                                                      |
| `notify-worker`      | OKE     | `vunvault` | ExternalSecret `vv-notify-worker-secrets`                                                                                                                         |
| `maintenance-worker` | OKE     | `vunvault` | ExternalSecret `vv-maintenance-worker-secrets`                                                                                                                    |
| `scan-controller`    | k3s     | `vv-scans` | singleton; envFrom the Terraform-built `vv-scan-controller-secrets`; carries the Task 86 guard rails (RBAC without `pods/exec`, default-deny, limit-range, quota) |

**Workers have no probes.** They expose no HTTP surface (pure BullMQ loops)
and the distroless image has no shell for an exec probe; liveness is the
process exit + Deployment restart, and a stalled loop is BullMQ's own
stalled-job recovery. The API probes `/healthz` on 8080.

## Deploy (the only sanctioned path — no raw kubectl)

```sh
# OKE (through the bastion-forwarded kubeconfig):
helm upgrade --install --atomic --wait -n vunvault --create-namespace \
  vv-api ./api \
  --set image.repository=<registry>/vv/api --set image.tag=<GIT_SHA> \
  --set config.webOrigin=https://www.<zone> --set config.apiUrl=https://api.<zone> \
  --set ingress.host=origin.<zone> \
  --set-json ociSecretMap='<Task 98 secret_ocids output>'

for w in broadcast-worker notify-worker maintenance-worker; do
  helm upgrade --install --atomic --wait -n vunvault \
    vv-$w ./$w \
    --set image.repository=<registry>/vv/$w --set image.tag=<GIT_SHA> \
    --set-json vaultSecrets='<name→OCID map for this worker>'
done

# k3s scan cluster (namespace + secrets pre-exist from Terraform):
helm upgrade --install --atomic --wait -n vv-scans \
  vv-scan-controller ./scan-controller \
  --set image.repository=<registry>/vv/scan-controller --set image.tag=<GIT_SHA> \
  --set config.apiInternalUrl=https://api.<zone>
```

## Rules

- **No secret values in values files, ever.** OCIDs, hostnames, sizes. The
  values that DO exist (`ociSecretMap`, `vaultSecrets`) are maps to Vault
  OCIDs — identifiers, not material.
- `image.tag` is REQUIRED: the template calls `fail` on an empty tag. CI
  passes the immutable GIT_SHA tag (Task 102); `latest` is not deployable.
- Library-chart dependency is `file://../vv-lib` at an exact version — run
  `helm dependency update <chart>` after editing `vv-lib`.
- The scan-namespace static manifests in `apps/scan-worker/k8s/` remain the
  test-pinned reference (`isolation.test.ts`); the chart templates mirror
  them and are what a cluster ever sees.
