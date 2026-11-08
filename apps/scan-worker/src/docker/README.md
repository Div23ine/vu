# Docker executor implementation status

The Docker runner and host broker are implemented as isolated foundations, but
Docker is **not enabled by the scan controller**. Kubernetes remains the only
production executor.

## Security boundary

The intended process split is:

- **Scan controller:** unprivileged. It receives only the Docker broker's
  private Unix socket. It must not receive the raw Docker socket, the firewall
  helper socket, CAP_NET_ADMIN, host networking, or host filesystem mounts.
- **Docker host broker:** `docker-host-broker.ts` owns the raw Docker socket.
  It exposes only fixed network/container/log operations, not arbitrary Docker
  Engine paths. It checks scan ownership labels, a host-pinned digest image,
  fixed environment keys, exact runner resource/security settings, and that
  pinned target IPs are covered by the installed firewall allowlist.
- **Firewall helper:** separate root-owned process with CAP_NET_ADMIN. The
  Docker host broker calls it over a second private Unix socket. The controller
  must not have access to this socket.

The Docker socket grants root-equivalent authority. The host broker's systemd
unit therefore runs as a dedicated user with narrowly scoped supplementary
groups. Its primary group owns the controller-facing socket; the controller
must be given the matching numeric GID when the socket is mounted into its
container. The Docker host broker alone belongs to the firewall socket group.

## Request sequence

For each job:

1. Create a fresh, empty Docker bridge network with fixed ownership labels.
2. Install and confirm the host egress policy.
3. Create the runner only after firewall installation succeeds.
4. Start the runner, stream bounded logs, and wait for exit.
5. Remove the runner, remove the firewall policy, then remove the network. If
   container removal or firewall cleanup fails, retain the network rather than
   removing the evidence needed for safe host reconciliation.

The broker refuses unknown resource IDs, requires broker-created network and
container records, and caps active scan networks at two. It allows only one
runner container per network. It validates every create-container request against the
host-pinned image and the fixed policy: UID/GID 65532, read-only root filesystem,
no privilege escalation, all capabilities dropped, no-new-privileges, 1 GiB
memory, 1 CPU, 128 PIDs, bounded tmpfs, local-only DNS, IPv6 disabled, and no
binds/devices/ports/privileged mode. No shell command is built from user input.

## Host helper installation (not activated)

The systemd templates are:

- `deploy/vunvault-scan-firewall.service`
- `deploy/vunvault-scan-docker-broker.service`

Before installing:

1. Build the scan-worker package and install its compiled output under
   `/opt/vunvault/vu`.
2. Create dedicated groups for the firewall helper, Docker broker, and
   controller-facing broker socket. The Docker broker's primary group must be
   the controller socket group; set the matching numeric GID on the controller
   container only when wiring the Compose service.
3. Configure `/etc/vunvault/scan-firewall.env` with
   `VV_SCAN_FIREWALL_GID`, whose group is accessible only to the Docker host
   broker. Do not add the scan-controller container to that group.
4. Configure `/etc/vunvault/scan-docker-broker.env` with
   `VV_DOCKER_BROKER_SOCKET`, `VV_DOCKER_SOCKET`,
   `VV_SCAN_FIREWALL_SOCKET`, and a digest-pinned `RUNNER_IMAGE`.
5. The Docker broker user needs access to the Docker socket. Membership in the
   `docker` group is root-equivalent; treat this broker as a privileged host
   security boundary.
6. Verify nftables is installed and compatible. Do not mix unmanaged rules
   with the `inet vv_scan` table. Review socket ownership and both systemd
   units before enabling them.

The firewall helper receives CAP_NET_ADMIN; the Docker host broker receives
Docker socket access but does not need CAP_NET_ADMIN. Neither service is a
Docker Compose service.

## Remaining gates

- Durable startup reconciliation for orphaned Docker containers, networks, and
  nftables rules is not implemented. For safety, the broker currently refuses
  startup when it detects any pre-existing `vv-scan` Docker resources. It does
  not guess which leftovers are safe to delete.
- Add broker unit tests and integration tests against a real Docker daemon and
  an nftables network namespace.
- Wire `SCAN_EXECUTOR=docker` as an explicit opt-in only after reconciliation,
  tests, and socket permissions are complete. Fail startup if any prerequisite
  is missing.
- Run full repository CI and security checks and resolve both new and baseline
  failures.

Until these gates pass, do not install or enable either host service on the VPS,
do not add the Docker socket to Compose, and do not switch the production
executor from Kubernetes.
