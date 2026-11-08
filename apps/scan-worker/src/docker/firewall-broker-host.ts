import { startFirewallBrokerServer } from './nft-firewall-broker';

/**
 * Entrypoint for the separate host firewall helper. Run under a dedicated
 * systemd unit with CAP_NET_ADMIN and a private Unix socket. Do not run inside
 * the public API, scan controller, or scan runner containers.
 */
async function main(): Promise<void> {
  const socketPath = process.env.VV_SCAN_FIREWALL_SOCKET ?? '/run/vunvault-scan-firewall/broker.sock';
  const rawGroupId = process.env.VV_SCAN_FIREWALL_GID;
  const groupId = rawGroupId === undefined || rawGroupId === '' ? undefined : Number(rawGroupId);
  if (groupId !== undefined && (!Number.isInteger(groupId) || groupId < 1)) {
    throw new Error('VV_SCAN_FIREWALL_GID must be a positive numeric group ID');
  }

  const server = await startFirewallBrokerServer({
    socketPath,
    ...(groupId === undefined ? {} : { groupId }),
  });
  process.stdout.write('VUNVAULT scan firewall broker ready on its Unix socket\n');

  let closing = false;
  const shutdown = (): void => {
    if (closing) return;
    closing = true;
    void server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        process.stderr.write(`firewall broker shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
      },
    );
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

const entryName = process.argv[1]?.split('/').pop();
if (entryName !== undefined && import.meta.url.endsWith(`/${entryName}`)) {
  main().catch((error: unknown) => {
    process.stderr.write(`firewall broker failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
