# Docker executor implementation status

This directory contains the Docker execution orchestration and the host-side
firewall building blocks. It is **not enabled by the scan controller yet**.

## Security boundary

The intended process split is:

- **Scan controller:** unprivileged. It must not receive the host Docker socket,
  CAP_NET_ADMIN, host networking, or host filesystem mounts.
- **Host firewall broker:** separate root-owned process with only
  CAP_NET_ADMIN. It listens on a private Unix socket accessible only to the body-validating
  Docker host broker. The scan controller must not call this socket directly.
- **Docker Engine broker:** must be a body-validating broker, not a generic
  endpoint-only socket proxy. Docker's container-create API can request
  privileged containers and arbitrary host bind mounts; merely allowing
  POST /containers/create is not a safe restriction. The
  DockerEngineHttpClient is intended for the host broker process only. Do
  not point a controller process at the raw Docker socket or a generic
  Docker-socket proxy.

The host firewall broker binds rules to Docker's per-network bridge interface.
It drops all traffic from that bridge to the host, allows forwarding only to
the validated public IPv4 addresses, permits established return traffic, and
drops all other forwarding in either direction. IPv6 is disabled for the
runner. The broker accepts only public IPv4 addresses and never accepts raw
nftables expressions or command fragments.

## Ordering

For each job, the controller adapter performs:

1. Create a fresh, empty Docker bridge network.
2. Ask the host firewall broker to install and confirm the egress policy.
3. Only after policy installation succeeds, create and start the runner.
4. Stop/remove the runner, remove the firewall policy, then remove the network.

If policy installation partially fails, cleanup is still attempted. If it
cannot be installed, no runner container is created.

## Runner restrictions

The Docker container request is fixed in application code: digest-pinned image,
UID/GID 65532, read-only root filesystem, no privilege escalation, all Linux
capabilities dropped, no devices or binds, no-new-privileges, 1 GiB memory,
1 CPU, 128 PIDs, bounded tmpfs, local-only DNS, and IPv6 disabled. Scan
parameters are passed through a fixed environment allowlist; no shell command
is constructed from user input.

## Host helper installation (not yet activated)

The systemd unit template is deploy/vunvault-scan-firewall.service. Before
enabling it:

1. Build the scan-worker package and install its compiled output under
   /opt/vunvault/vu.
2. Create the dedicated group vunvault-scan-firewall.
3. Set VV_SCAN_FIREWALL_GID in /etc/vunvault/scan-firewall.env to the
   numeric GID reserved for the trusted host Docker broker process. Do not add
   the scan-controller container to this group.
4. Verify nftables is installed and that the host uses a compatible nftables
   backend. Do not mix unmanaged rules with the inet vv_scan table.
5. Review the systemd unit and socket ownership, then install it with systemd.

This unit grants only CAP_NET_ADMIN to the host helper. It is not a Docker
Compose service and must not be run in the API or runner container.

## Remaining gates

- Implement a body-validating Docker host broker. It must own the raw Docker
  socket and expose only the fixed scan operations and fixed container policy.
- Make the Docker controller client use that broker's private Unix socket.
- Add startup reconciliation for orphaned Docker networks, containers, and
  nftables rules after a broker crash or host restart.
- Wire SCAN_EXECUTOR=docker as an explicit opt-in only after the host broker
  and socket permissions are present; fail startup if any required component
  is absent.
- Run package typecheck, lint, unit tests, integration tests with a real Docker
  daemon and nftables namespace, then all repository CI and security checks.

Until these gates pass, Kubernetes remains the only production executor and
this implementation must not be enabled on the VPS.
