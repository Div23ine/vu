import { spawn } from 'node:child_process';
import { access, mkdir, lstat, unlink, chmod, chown } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { classifyIp } from '../domain/target-guard';
import type { DockerNetwork, HostFirewallPort } from './docker-pod-runner';

const NFT_TABLE = 'vv_scan';
const MAX_RULE_IPS = 256;
const MAX_BODY_BYTES = 16 * 1024;

export interface NftCommandPort {
  run(args: string[], input?: string): Promise<string>;
}

export class SpawnNftCommand implements NftCommandPort {
  async run(args: string[], input?: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn('nft', args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let outputBytes = 0;
      const collect = (target: Buffer[]) => (chunk: Buffer): void => {
        outputBytes += chunk.byteLength;
        if (outputBytes > 128 * 1024) {
          child.kill('SIGKILL');
          reject(new Error('nft output exceeded 128 KiB'));
          return;
        }
        target.push(Buffer.from(chunk));
      };
      child.stdout.on('data', collect(stdout));
      child.stderr.on('data', collect(stderr));
      child.on('error', reject);
      child.on('close', (code) => {
        const out = Buffer.concat(stdout).toString('utf8');
        if (code === 0) resolve(out);
        else reject(new Error(`nft exited ${code}: ${Buffer.concat(stderr).toString('utf8').slice(0, 500)}`));
      });
      if (input !== undefined) child.stdin.end(input);
      else child.stdin.end();
    });
  }
}

/** Host-side nftables implementation; run only in the separate host helper. */
export class NftHostFirewallBroker implements HostFirewallPort {
  constructor(
    private readonly nft: NftCommandPort = new SpawnNftCommand(),
    private readonly interfaceExists: (name: string) => Promise<boolean> = async (name) => {
      await access(`/sys/class/net/${name}`);
      return true;
    },
  ) {}

  async install(network: DockerNetwork, allowedIPv4: readonly string[]): Promise<void> {
    const { bridge, inputChain, forwardChain } = identifiers(network);
    if (!(await this.interfaceExists(bridge))) {
      throw new Error('Docker bridge interface does not exist; refusing to install egress policy');
    }
    if (allowedIPv4.length < 1 || allowedIPv4.length > MAX_RULE_IPS) {
      throw new Error('firewall allowlist must contain between 1 and 256 IPv4 addresses');
    }
    const unique = [...new Set(allowedIPv4)];
    if (unique.some((ip) => classifyIp(ip) !== 'public')) {
      throw new Error('firewall allowlist contains a non-public IPv4 address');
    }

    await this.ensureBaseChains();
    await this.remove(network);
    const set = unique.join(', ');
    const comment = commentFor(network);
    const script = [
      `add chain inet ${NFT_TABLE} ${inputChain}`,
      `add chain inet ${NFT_TABLE} ${forwardChain}`,
      `add rule inet ${NFT_TABLE} input iifname "${bridge}" jump ${inputChain} comment "${comment}"`,
      `add rule inet ${NFT_TABLE} ${inputChain} drop`,
      `add rule inet ${NFT_TABLE} forward iifname "${bridge}" jump ${forwardChain} comment "${comment}"`,
      `add rule inet ${NFT_TABLE} forward oifname "${bridge}" jump ${forwardChain} comment "${comment}"`,
      `add rule inet ${NFT_TABLE} ${forwardChain} ct state established,related accept`,
      `add rule inet ${NFT_TABLE} ${forwardChain} iifname "${bridge}" ip daddr { ${set} } accept`,
      `add rule inet ${NFT_TABLE} ${forwardChain} iifname "${bridge}" drop`,
      `add rule inet ${NFT_TABLE} ${forwardChain} oifname "${bridge}" drop`,
    ].join('\n') + '\n';
    await this.nft.run(['-f', '-'], script);
  }

  async remove(network: DockerNetwork): Promise<void> {
    const { inputChain, forwardChain } = identifiers(network);
    const comment = commentFor(network);
    const [inputRules, forwardRules, inputExists, forwardExists] = await Promise.all([
      this.listChain('input'),
      this.listChain('forward'),
      this.chainExists(inputChain),
      this.chainExists(forwardChain),
    ]);
    const handles = [
      ...handlesFor(inputRules, comment, 'input'),
      ...handlesFor(forwardRules, comment, 'forward'),
    ];
    const commands = handles.map(({ chain, handle }) =>
      `delete rule inet ${NFT_TABLE} ${chain} handle ${handle}`,
    );
    if (inputExists) commands.push(`delete chain inet ${NFT_TABLE} ${inputChain}`);
    if (forwardExists) commands.push(`delete chain inet ${NFT_TABLE} ${forwardChain}`);
    if (commands.length > 0) await this.nft.run(['-f', '-'], commands.join('\n') + '\n');
  }

  private async ensureBaseChains(): Promise<void> {
    try {
      await this.nft.run(['list', 'table', 'inet', NFT_TABLE]);
    } catch {
      await this.nft.run(['-f', '-'], [
        `add table inet ${NFT_TABLE}`,
        `add chain inet ${NFT_TABLE} input { type filter hook input priority -10; policy accept; }`,
        `add chain inet ${NFT_TABLE} forward { type filter hook forward priority -10; policy accept; }`,
      ].join('\n') + '\n');
      return;
    }
    for (const [chain, hook] of [['input', 'input'], ['forward', 'forward']] as const) {
      try {
        await this.nft.run(['list', 'chain', 'inet', NFT_TABLE, chain]);
      } catch {
        await this.nft.run(['-f', '-'], `add chain inet ${NFT_TABLE} ${chain} { type filter hook ${hook} priority -10; policy accept; }\n`);
      }
    }
  }

  private async listChain(chain: string): Promise<string> {
    try {
      return await this.nft.run(['-a', 'list', 'chain', 'inet', NFT_TABLE, chain]);
    } catch {
      return '';
    }
  }

  private async chainExists(chain: string): Promise<boolean> {
    try {
      await this.nft.run(['list', 'chain', 'inet', NFT_TABLE, chain]);
      return true;
    } catch {
      return false;
    }
  }
}

function identifiers(network: DockerNetwork): {
  bridge: string; inputChain: string; forwardChain: string;
} {
  if (!/^[a-f0-9]{12,64}$/i.test(network.id)) throw new Error('invalid Docker network ID');
  const suffix = network.id.slice(0, 12).toLowerCase();
  return {
    bridge: `br-${suffix}`,
    inputChain: `in_${suffix}`,
    forwardChain: `fw_${suffix}`,
  };
}

function commentFor(network: DockerNetwork): string {
  return `vvscan:${network.id}`;
}

function handlesFor(output: string, comment: string, chain: string): { chain: string; handle: number }[] {
  const escaped = comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`comment "\${escaped}" # handle (\\d+)`);
  const result: { chain: string; handle: number }[] = [];
  for (const line of output.split('\n')) {
    const match = pattern.exec(line);
    if (match?.[1] !== undefined) result.push({ chain, handle: Number(match[1]) });
  }
  return result;
}

export interface FirewallBrokerServerOptions {
  socketPath: string;
  groupId?: number;
  broker?: NftHostFirewallBroker;
}

/** Unix-socket-only API. Mount this socket, not docker.sock, into the controller. */
export async function startFirewallBrokerServer(options: FirewallBrokerServerOptions): Promise<{
  close(): Promise<void>;
  address: AddressInfo | string | null;
}> {
  if (!options.socketPath.startsWith('/')) throw new Error('firewall broker socket path must be absolute');
  await mkdir(dirname(options.socketPath), { recursive: true, mode: 0o750 });
  try {
    const existing = await lstat(options.socketPath);
    if (!existing.isSocket()) throw new Error('refusing to replace a non-socket firewall broker path');
    await unlink(options.socketPath);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const broker = options.broker ?? new NftHostFirewallBroker();
  const server = createServer((request, response) => {
    void handleBrokerRequest(request, response, broker);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.socketPath, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  await chmod(options.socketPath, 0o660);
  if (options.groupId !== undefined) await chown(options.socketPath, 0, options.groupId);

  return {
    address: server.address(),
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await unlink(options.socketPath).catch(() => undefined);
    },
  };
}

async function handleBrokerRequest(
  request: IncomingMessage,
  response: ServerResponse,
  broker: NftHostFirewallBroker,
): Promise<void> {
  try {
    const path = request.url ?? '';
    if (request.method === 'POST' && path === '/v1/policies') {
      const body = await readJsonBody(request);
      const network = parseNetwork(body.network);
      const ips = parseAllowedIps(body.allowedIPv4);
      await broker.install(network, ips);
      sendJson(response, 201, { ok: true });
      return;
    }
    const match = /^\/v1\/policies\/([a-f0-9]{12,64})$/i.exec(path);
    if (request.method === 'DELETE' && match?.[1] !== undefined) {
      await broker.remove({ id: match[1], name: '' });
      sendJson(response, 200, { ok: true });
      return;
    }
    sendJson(response, 404, { error: 'not_found' });
  } catch (error) {
    sendJson(response, 400, {
      error: 'firewall_policy_rejected',
      message: error instanceof Error ? error.message.slice(0, 200) : 'invalid request',
    });
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error('request body too large');
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('request body must be an object');
  }
  return parsed as Record<string, unknown>;
}

function parseNetwork(value: unknown): DockerNetwork {
  if (typeof value !== 'object' || value === null) throw new Error('network is required');
  const network = value as { id?: unknown; name?: unknown };
  if (typeof network.id !== 'string' || !/^[a-f0-9]{12,64}$/i.test(network.id)) {
    throw new Error('invalid network ID');
  }
  if (typeof network.name !== 'string' || !/^vv-scan-[a-z0-9-]{1,50}$/.test(network.name)) {
    throw new Error('invalid network name');
  }
  return { id: network.id, name: network.name };
}

function parseAllowedIps(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RULE_IPS) {
    throw new Error('allowedIPv4 must contain between 1 and 256 addresses');
  }
  const ips = value.map((ip) => {
    if (typeof ip !== 'string' || classifyIp(ip) !== 'public') {
      throw new Error('allowlist contains an invalid or non-public IPv4 address');
    }
    return ip;
  });
  return [...new Set(ips)];
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) });
  response.end(raw);
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
