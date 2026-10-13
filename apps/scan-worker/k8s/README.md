# `k8s/` — chart sources, not deployment manifests

These five documents are the **source of truth for the Helm chart** that Layer
L13 (`apps/../charts/scan-worker`) renders. They are committed here so the
isolation model is reviewable next to the code that depends on it: the
controller's `KubeClient` interface and this RBAC are two views of the same
allowlist, and a change to either should be reviewed against the other.

**Never `kubectl apply` these by hand.** Deployment goes through Helm so that
values (image digest, namespace, node-pool label, quota sizes) come from one
place and drift between environments is impossible. A hand-applied namespace
would also miss the Pod Security Admission labels on the next reconcile.

| File                              | What it pins down                                                             |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `namespace.yaml`                  | `vv-scans` with Pod Security `restricted` (enforce + audit + warn)            |
| `default-deny-networkpolicy.yaml` | Deny all ingress AND egress; per-job policies add the only allowed egress     |
| `controller-rbac.yaml`            | The controller's eight verbs; the runner account has no bindings and no token |
| `resource-quota.yaml`             | 30 pods / 12 CPU requested / 30 CPU / 40 Gi across the namespace              |
| `limit-range.yaml`                | Default container limits of 1 CPU / 1 Gi for anything that sets none          |

Two rules in these files are load-bearing and must not be relaxed without a
security review:

1. **No `pods/exec` in the controller Role.** It is why pause/resume are no-ops
   in `src/k8s/k8s-pod-runner.ts`. Granting exec would let a compromised
   controller inject commands into a pod running attacker-chosen tooling.
2. **`vv-scan-runner` keeps `automountServiceAccountToken: false`.** The scan
   pod must contain no credential at all — not even a useless one.
