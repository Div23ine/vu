# Docker scan executor — architecture decision

Status: proposed; implementation must remain fail-closed until every host-side
network control in this document is present and verified.

## Context

The scan controller currently depends on the `PodRunner` port. The Kubernetes
adapter creates a per-job NetworkPolicy **before** the runner Job, allowing
egress only to controller-pinned target addresses. The runner image is already
non-root, read-only, capability-free, and receives only an allowlisted set of
scan parameters.

The VPS deployment target is Docker Compose on a single Linux host, not a
Kubernetes cluster. Replacing the Kubernetes adapter with a plain
`docker run` command is not equivalent isolation.

## Decision

A Docker adapter may be enabled only when all of the following are true:

1. **Separate controller and runner.** The controller is the only service with
   access to a Docker Engine API. The runner never receives `docker.sock`, a
   Docker API endpoint, host credentials, or a host bind mount.
2. **Restricted Engine access.** The controller talks through a local,
   authenticated socket proxy with only the Engine API operations it needs.
   Do not mount the raw host socket into a general-purpose application
   container. Docker API access is effectively host-root access and must be
   treated as a privileged control-plane boundary.
3. **Per-job network before container.** The adapter creates a dedicated
   per-job network and installs host firewall rules for the exact pinned
   destination IPs before creating or attaching the runner container. If
   network or firewall setup fails, no runner container is created.
4. **Default-deny egress.** The host firewall permits the runner bridge to
   reach only the pinned target IPs. It denies private, loopback, link-local,
   carrier-grade NAT, metadata, multicast, reserved, documentation and
   broadcast ranges, plus host, Docker bridge, service and management
   networks. DNS egress is denied. The runner receives pinned IPs and uses
   local host mapping only for the authorized hostname.
5. **No fallback network.** The runner must never be attached to Docker's
   default bridge, host networking, or an unrestricted Compose network. A
   missing firewall backend, missing rules, or an unsupported host kernel is
   a hard failure, not a warning.
6. **Hardened container.** Use the existing digest-pinned runner image with
   non-root UID/GID 65532, read-only root filesystem, no-new-privileges, all
   capabilities dropped, no devices, no privileged mode, no host PID/IPC/
   network namespaces, a bounded tmpfs at `/tmp`, memory/CPU/PID limits,
   bounded logs, and a hard deadline.
7. **Deterministic cleanup.** Remove the container, per-job network and
   firewall rules in `finally`, including timeout, abort, daemon error and
   controller shutdown paths. Cleanup is idempotent and stale-resource
   reconciliation runs at controller startup.
8. **Fixed execution contract.** Container image, entrypoint, command, mounts,
   environment keys, resource limits and security options are constants in
   application code. User-supplied values are validated data only; they are
   never interpolated into shell commands or Docker CLI strings.

## Why a basic Compose service is insufficient

A shared scanner service on a normal bridge can reach more than the one target
that the API authorized. Container-level resource limits and a read-only
filesystem do not constrain network destinations. Likewise, `network_mode:
host` bypasses network isolation, and `network_mode: none` prevents the
scanner from reaching even an authorized public target.

The Kubernetes NetworkPolicy behavior must be reproduced at the host boundary;
it cannot be replaced by merely setting `cap_drop: [ALL]` or
`no-new-privileges`.

## Required implementation and validation gates

- Define a narrow Docker client port and test it with a fake Engine API.
- Implement an explicit host-firewall adapter with an allowlist of operations;
  never accept arbitrary rule text from a scan job.
- Prove the firewall is installed before the runner can transmit any packet.
- Test public-target reachability and denial of loopback, RFC 1918, link-local,
  metadata, Docker bridge, host, and unrelated public IPs from inside a runner.
- Test DNS rebinding, redirects, abort, deadline, daemon restart, partial
  creation, cleanup failure and stale-resource recovery.
- Verify the controller's socket proxy cannot create privileged containers,
  mount arbitrary host paths, or access unrelated Docker resources.
- Run the full repository policy, lint, typecheck, unit, integration and
  security workflows before enabling the adapter.
- Keep Kubernetes as the only production executor until these gates pass.

## Rollout

The adapter must be opt-in (for example, `SCAN_EXECUTOR=docker`) and startup
must fail if its required firewall and restricted Engine API configuration is
absent. The default must not silently change from Kubernetes or from the
existing fail-closed placeholder. Compose deployment and public scanner
exposure are separate approvals; this ADR does not authorize either.
