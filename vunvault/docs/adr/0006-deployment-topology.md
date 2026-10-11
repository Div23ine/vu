# 0006 — Two clusters that share nothing, one edge in front of both, one Vault behind them

**Status:** Accepted
**Date:** 2026-10 (Tasks 97–104 shipped; recorded in Task 109)
**Deciders:** Platform + Security

## Context

VUNVAULT runs unprivileged scanning tools against customer-facing hosts from
pods that receive attacker-influenced input, on the same platform that holds
seven years of audit evidence and its clients' payment records. The estate is
small (one tenancy, one zone, two clusters) but the two halves have opposite
trust profiles: the platform is the asset, the scan tier is the assumed
breach.

## Decision

1. **Two clusters, no path between them.** OKE runs the API and the three OKE
   workers. A separate k3s cluster on its own VCN (`10.20.0.0/16`) runs the
   scan controller and the scan pods. There is no DRG, no local or remote
   peering, no route to the OKE VCN and no service gateway — the two share a
   compartment and nothing else.
2. **The scan network is public-egress-only, by allow-list.** OCI security
   rules only allow, so "the internet minus private space" is spelled out: the
   `scan-egress` NSG carries the 103 generated CIDRs that are the exact
   complement of the ranges the controller's own target guard blocks
   (RFC1918, link-local/IMDS, CGNAT, loopback, benchmark, documentation,
   multicast, reserved). `scripts/gen-scan-egress.mjs` computes it with BigInt
   arithmetic, the result is committed, and CI fails if the committed list
   drifts from the generator. Host firewalls in cloud-init drop
   link-local/RFC1918 FORWARD traffic as defence in depth.
3. **Cloudflare is the only front door.** The web app is a Pages project; the
   API hostname is proxied into the `vv-edge` Worker, which allow-lists paths,
   caps declared body sizes, strips client-sent forwarding headers, stamps
   `x-origin-verify` and passes WebSocket/SSE through untouched. The API
   enforces that header in production, so a request that reaches the load
   balancer directly is refused — and `cf-connecting-ip` is trusted for
   rate-limit keys only AFTER the header verifies. Authenticated Origin Pulls
   close the transport-level version of the same hole.
4. **One secret home, three read paths.** OCI Vault holds every application
   secret. The API pod reads it directly with its resource principal; the OKE
   workers receive values through ExternalSecrets (IAM-scoped to that cluster,
   namespace and service account); the k3s controller gets a Terraform-built
   Kubernetes Secret, because the scan cluster has NO Vault access at all —
   its instance principal may `read repos` to pull images and nothing else.
   Terraform creates Vault secrets with placeholder content and
   `ignore_changes`, so no plan can ever print or clobber a real value.
5. **Both Kubernetes APIs are private; the bastion is the only way in.** CI
   reaches each through an OCI Bastion port-forwarding session, deploys with
   `helm upgrade --install --atomic` (never raw `kubectl apply`), and verifies
   afterwards with the smoke script. State lives in a private, versioned,
   CMK-encrypted bucket, because it holds the k3s join token and the OCIR
   auth token.
6. **Images are immutable and content-addressed.** Six repositories,
   `is_immutable = true`, tags set to the git SHA, and deployments pinned
   `repo@sha256:…` from the digests the release job actually pushed. Base
   images arrive as build args with no defaults, so a build without an
   operator-supplied digest fails instead of floating. Every image is
   distroless, non-root (65532), read-only-rootfs — except the scan runner,
   which carries checksum-verified tools instead.
7. **The scan tier is fenced inside its own cluster too.** Namespace `vv-scans`
   enforces Pod Security `restricted`; a default-deny NetworkPolicy leaves only
   per-job egress policies; the controller's Role has eight verbs and no
   `pods/exec` (which is why pause/resume are no-ops and cannot become
   anything else); the runner's ServiceAccount has no binding and no mounted
   token; a LimitRange and ResourceQuota bound the blast radius of a runaway
   job.

## Consequences

- Deploying is more steps than one `kubectl apply` — deliberately: every step
  is a gate that a static checker or a smoke test can fail.
- The scan tier cannot reach the platform's database, so all controller
  callbacks go out through the NAT gateway to the public API hostname and are
  authenticated by HMAC signature rather than network position. A leaked
  controller secret is a rotation, not a lateral-movement incident.
- Two clusters cost more than one. The alternative — scanning on the platform
  cluster — puts attacker-influenced workloads one NetworkPolicy typo away
  from the audit ledger.

## Enforcement

- `scripts/verify-terraform.mjs`: no DRG or peering resource in the scan
  module, no IPv4 literal in its NSG rules, the single wildcard ingress
  confined to the LB's 80/443, Vault secrets locked with `ignore_changes`,
  strict TLS and the 2555-day audit lock.
- `scripts/gen-scan-egress.mjs`: the allow-list is generated, not written, and
  CI fails on drift.
- `scripts/verify-dockerfiles.mjs` + `scripts/verify-deploy.mjs`: the image and
  chart hardening contracts (non-root, distroless, digest-pinned, resource
  bounds, atomic upgrades).
- `apps/scan-worker/src/conformance/isolation.test.ts`: the pod manifests the
  controller actually creates.
- `scripts/deploy/smoke.mjs`: the deployed estate must answer with the headers,
  the dead `/docs`, the refused unauthenticated WebSocket upgrade and the
  rejected unsigned callback — on every deploy.
