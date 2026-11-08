import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, lstat, unlink, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  DockerContainerConfig,
  DockerEnginePort,
  DockerNetwork,
  HostFirewallPort,
} from './docker-pod-runner';
import { DockerEngineHttpClient } from './docker-engine-http';
import { HostFirewallUnixClient } from './host-firewall-client';

/**
 * Narrow host-side broker. This is the ONLY process allowed to own the raw
 * Docker socket. The scan controller talks to this API over a private Unix
 * socket; it cannot submit arbitrary Docker Engine request paths or bodies.
 *
 * The broker deliberately accepts only the fixed runner contract. It is not a
 * generic Docker proxy. State is held in memory for this first iteration;
 * production startup MUST remain disabled until durable reconciliation is
 * added and tested (see README).
 */

const MAX_BODY = 32 * 1024;
const MAX_IPS = 256;
const LABEL_NAME = 'app.kubernetes.io/name';
const LABEL_JOB = 'vv/job-id';
const LABEL_CODE = 'vv/job-code';
const LABEL_ATTEMPT = 'vv/attempt';
const RUNNER_UID = '65532:65532';
const RUNNER_MEMORY = 1024 * 1024 * 1024;
const RUNNER_CPUS = 1_000_000_000;
const RUNNER_PIDS = 128;
const RUNNER_TMPFS = 'rw,noexec,nosuid,nodev,size=1g';
const RUNNER_ENV = new Set([
  'VV_JOB_ID', 'VV_JOB_CODE', 'VV_SCAN_TYPE', 'VV_TARGET_HOST',
  'VV_TARGET_IPS', 'VV_TARGET_CIDR', 'VV_DEADLINE_SECONDS', 'HOME',
]);

interface BrokerOptions {
  socketPath: string;
  dockerSocketPath: string;
  runnerImage: string;
  groupId?: number;
}
interface NetworkRecord extends DockerNetwork {
  labels: Record<string, string>;
  allowedIPv4?: string[];
}
interface ContainerRecord { id: string; networkId: string; labels: Record<string, string> }

export interface DockerHostBrokerServer {
  close(): Promise<void>;
}

/** Start under a dedicated systemd identity with access to Docker and firewall sockets. */
export async function startDockerHostBroker(options: BrokerOptions): Promise<DockerHostBrokerServer> {
  if (!options.socketPath.startsWith('/') || !options.dockerSocketPath.startsWith('/')) {
    throw new Error('broker socket paths must be absolute');
  }
  if (!/^.+@sha256:[a-f0-9]{64}$/.test(options.runnerImage)) {
    throw new Error('host broker runner image must be digest pinned');
  }
  await mkdir(dirname(options.socketPath), { recursive: true, mode: 0o750 });
  try {
    const existing = await lstat(options.socketPath);
    if (!existing.isSocket()) throw new Error('refusing to replace non-socket broker path');
    await unlink(options.socketPath);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const docker = new DockerEngineHttpClient({ socketPath: options.dockerSocketPath });
  const firewall = new NftHostFirewallBroker();
  const networks = new Map<string, NetworkRecord>();
  const containers = new Map<string, ContainerRecord>();
  const server = createServer((req, res) => {
    void route(req, res, { docker, firewall, networks, containers, runnerImage: options.runnerImage });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.socketPath, () => { server.removeListener('error', reject); resolve(); });
  });
  await chmod(options.socketPath, 0o660);
  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await unlink(options.socketPath).catch(() => undefined);
    },
  };
}

interface BrokerState {
  docker: DockerEngineHttpClient;
  firewall: HostFirewallPort;
  networks: Map<string, NetworkRecord>;
  containers: Map<string, ContainerRecord>;
  runnerImage: string;
}

async function route(req: IncomingMessage, res: ServerResponse, state: BrokerState): Promise<void> {
  try {
    const method = req.method ?? '';
    const path = req.url ?? '';
    if (method === 'POST' && path === '/v1/networks') {
      const body = await readJson(req);
      const { name, labels } = parseNetworkRequest(body);
      const network = await state.docker.createNetwork(name, labels);
      state.networks.set(network.id, { ...network, labels });
      return send(res, 201, { network });
    }
    if (method === 'POST' && path === '/v1/firewall/install') {
      const body = await readJson(req);
      const id = stringField(body, 'networkId');
      const network = ownedNetwork(state, id);
      const ips = parsePublicIps(body.allowedIPv4);
      await state.firewall.install(network, ips);
      network.allowedIPv4 = ips;
      return send(res, 200, { ok: true });
    }
    if (method === 'DELETE' && path.startsWith('/v1/firewall/')) {
      const id = decodeURIComponent(path.slice('/v1/firewall/'.length));
      const network = ownedNetwork(state, id);
      await state.firewall.remove(network);
      delete network.allowedIPv4;
      return send(res, 200, { ok: true });
    }
    if (method === 'POST' && path === '/v1/containers') {
      const body = await readJson(req);
      const config = parseContainerRequest(body, state);
      const network = ownedNetworkByName(state, config.networkName);
      if (network.allowedIPv4 === undefined) throw new Error('egress firewall must be installed before container creation');
      const id = await state.docker.createContainer(config);
      state.containers.set(id, { id, networkId: network.id, labels: config.labels });
      return send(res, 201, { id });
    }
    const start = /^\/v1\/containers\/([a-f0-9]{12,64})\/start$/.exec(path);
    if (method === 'POST' && start?.[1]) {
      const record = ownedContainer(state, start[1]);
      await state.docker.startContainer(record.id);
      return send(res, 200, { ok: true });
    }
    const wait = /^\/v1\/containers\/([a-f0-9]{12,64})\/wait$/.exec(path);
    if (method === 'POST' && wait?.[1]) {
      const record = ownedContainer(state, wait[1]);
      const result = await state.docker.waitContainer(record.id);
      return send(res, 200, result);
    }
    const stop = /^\/v1\/containers\/([a-f0-9]{12,64})\/stop$/.exec(path);
    if (method === 'POST' && stop?.[1]) {
      const record = ownedContainer(state, stop[1]);
      await state.docker.stopContainer(record.id, 0);
      return send(res, 200, { ok: true });
    }
    const removeContainer = /^\/v1\/containers\/([a-f0-9]{12,64})$/.exec(path);
    if (method === 'DELETE' && removeContainer?.[1]) {
      const record = ownedContainer(state, removeContainer[1]);
      await state.docker.removeContainer(record.id);
      state.containers.delete(record.id);
      return send(res, 200, { ok: true });
    }
    const removeNetwork = /^\/v1\/networks\/([a-f0-9]{12,64})$/.exec(path);
    if (method === 'DELETE' && removeNetwork?.[1]) {
      const network = ownedNetwork(state, removeNetwork[1]);
      if ([...state.containers.values()].some((item) => item.networkId === network.id)) {
        throw new Error('cannot remove network while broker-owned containers remain');
      }
      await state.docker.removeNetwork(network.id);
      state.networks.delete(network.id);
      return send(res, 200, { ok: true });
    }
    const logs = /^\/v1\/containers\/([a-f0-9]{12,64})\/logs$/.exec(path);
    if (method === 'GET' && logs?.[1]) {
      const record = ownedContainer(state, logs[1]);
      const signal = new AbortController();
      res.on('close', () => signal.abort());
      const stream = await state.docker.followLogs(record.id, signal.signal);
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
      stream.on('data', (chunk: Buffer | string) => { if (!res.write(chunk)) stream.pause(); });
      res.on('drain', () => stream.resume());
      stream.on('end', () => res.end());
      stream.on('error', () => res.destroy());
      return;
    }
    send(res, 404, { error: 'not_found' });
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : 'broker_request_rejected' });
  }
}

function parseNetworkRequest(value: unknown): { name: string; labels: Record<string, string> } {
  const body = object(value);
  const name = stringField(body, 'name');
  if (!/^vv-scan-[a-z0-9-]{1,55}$/.test(name)) throw new Error('invalid scan network name');
  const labels = parseLabels(body.labels);
  if (labels[LABEL_NAME] !== 'vv-scan') throw new Error('invalid scan ownership label');
  return { name, labels };
}

function parseContainerRequest(value: unknown, state: BrokerState): DockerContainerConfig {
  const body = object(value);
  const config = body.config;
  const c = object(config);
  const name = stringField(c, 'name');
  const image = stringField(c, 'image');
  const networkName = stringField(c, 'networkName');
  if (image !== state.runnerImage) throw new Error('runner image does not match host-pinned image');
  if (!/^vv-scan-[a-z0-9-]{1,55}$/.test(name)) throw new Error('invalid runner name');
  const labels = parseLabels(c.labels);
  if (labels[LABEL_NAME] !== 'vv-scan') throw new Error('invalid runner ownership label');
  const network = ownedNetworkByName(state, networkName);
  if (!sameLabels(labels, network.labels)) throw new Error('container labels do not match its network');
  const env = stringArray(c.env, 8);
  if (env.some((entry) => {
    const index = entry.indexOf('=');
    return index < 1 || !RUNNER_ENV.has(entry.slice(0, index));
  })) throw new Error('runner environment contains an unsupported key');
  const envMap = Object.fromEntries(env.map((entry) => [entry.slice(0, entry.indexOf('=')), entry.slice(entry.indexOf('=') + 1)]));
  if (envMap.VV_JOB_ID !== labels[LABEL_JOB] || envMap.VV_JOB_CODE?.toLowerCase() !== labels[LABEL_CODE]) {
    throw new Error('runner environment does not match ownership labels');
  }
  if (envMap.HOME !== '/tmp') throw new Error('runner HOME must be /tmp');
  const allowed = network.allowedIPv4 ?? [];
  const pinned = envMap.VV_TARGET_IPS === '' ? [] : (envMap.VV_TARGET_IPS ?? '').split(',');
  if (pinned.some((ip) => !allowed.includes(ip))) throw new Error('runner target IPs exceed firewall allowlist');
  if (envMap.VV_TARGET_CIDR !== undefined && pinned.length !== 0) throw new Error('CIDR runner cannot also supply pinned host IPs');
  const extraHosts = stringArray(c.extraHosts, 16);
  if (extraHosts.some((entry) => !/^[a-z0-9.-]+:\d{1,3}(?:\.\d{1,3}){3}$/.test(entry))) {
    throw new Error('invalid pinned extra-host entry');
  }
  if (c.user !== RUNNER_UID || c.readonlyRootfs !== true || c.privileged !== false ||
      !arrayEquals(c.capDrop, ['ALL']) || !arrayEquals(c.securityOpt, ['no-new-privileges:true']) ||
      c.pidsLimit !== RUNNER_PIDS || c.memoryBytes !== RUNNER_MEMORY || c.nanoCpus !== RUNNER_CPUS ||
      !isObject(c.tmpfs) || c.tmpfs['/tmp'] !== RUNNER_TMPFS ||
      !arrayEquals(c.dns, ['127.0.0.1']) || c.ipv6Disabled !== true) {
    throw new Error('runner security configuration differs from the host-enforced profile');
  }
  return {
    name, image, networkName, user: RUNNER_UID, env, extraHosts,
    readonlyRootfs: true, privileged: false, capDrop: ['ALL'],
    securityOpt: ['no-new-privileges:true'], pidsLimit: RUNNER_PIDS,
    memoryBytes: RUNNER_MEMORY, nanoCpus: RUNNER_CPUS,
    tmpfs: { '/tmp': RUNNER_TMPFS }, dns: ['127.0.0.1'],
    ipv6Disabled: true, labels,
  };
}

function parseLabels(value: unknown): Record<string, string> {
  const labels = object(value);
  const entries = Object.entries(labels);
  if (entries.length !== 4 || entries.some(([key, val]) => typeof val !== 'string' || val.length > 128)) {
    throw new Error('invalid scan labels');
  }
  const result = Object.fromEntries(entries) as Record<string, string>;
  if (result[LABEL_NAME] !== 'vv-scan' || !/^[a-f0-9-]{8,64}$/i.test(result[LABEL_JOB] ?? '') || !/^[a-z0-9-]{1,64}$/.test(result[LABEL_CODE] ?? '') ||
      !/^[1-9]\d{0,3}$/.test(result[LABEL_ATTEMPT] ?? '')) throw new Error('invalid scan labels');
  return result;
}
function parsePublicIps(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_IPS ||
      value.some((ip) => typeof ip !== 'string' || !isPublicIpv4(ip))) throw new Error('invalid public IPv4 allowlist');
  return [...new Set(value as string[])];
}
function isPublicIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c, d] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0 && c === 113) || (a === 192 && b === 0 && c === 2) ||
      (a === 255 && b === 255 && c === 255 && d === 255)) return false;
  return true;
}
function ownedNetwork(state: BrokerState, id: string): NetworkRecord {
  const item = state.networks.get(id);
  if (!item || item.labels[LABEL_NAME] !== 'vv-scan') throw new Error('unknown broker-owned network');
  return item;
}
function ownedNetworkByName(state: BrokerState, name: string): NetworkRecord {
  const item = [...state.networks.values()].find((network) => network.name === name);
  if (!item) throw new Error('unknown broker-owned network');
  return item;
}
function ownedContainer(state: BrokerState, id: string): ContainerRecord {
  const item = state.containers.get(id);
  if (!item || item.labels[LABEL_NAME] !== 'vv-scan') throw new Error('unknown broker-owned container');
  return item;
}
function sameStringSet(a: string[], b: string[]): boolean {\n  return a.length === b.length && new Set(a).size === a.length && new Set(b).size === b.length && a.every((value) => b.includes(value));\n}\nfunction expandPublicCidr(cidr: string): string[] {\n  const match = /^(\\d{1,3}(?:\\.\\d{1,3}){3})\\/(\\d{1,2})$/.exec(cidr);\n  if (!match?.[1] || !match[2]) throw new Error('invalid target CIDR');\n  const octets = match[1].split('.').map(Number);\n  const prefix = Number(match[2]);\n  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255) || prefix < 24 || prefix > 32) {\n    throw new Error('invalid target CIDR');\n  }\n  const base = octets.reduce((value, octet) => value * 256 + octet, 0);\n  const size = 2 ** (32 - prefix);\n  if (Math.floor(base / size) * size !== base) throw new Error('target CIDR must be canonical');\n  const result: string[] = [];\n  for (let offset = 0; offset < size; offset += 1) {\n    const value = base + offset;\n    const ip = [Math.floor(value / 2 ** 24) % 256, Math.floor(value / 2 ** 16) % 256, Math.floor(value / 2 ** 8) % 256, value % 256].join('.');\n    if (!isPublicIpv4(ip)) throw new Error('target CIDR overlaps a forbidden address range');\n    result.push(ip);\n  }\n  return result;\n}\nfunction sameLabels(a: Record<string, string>, b: Record<string, string>): boolean {
  return Object.keys(b).length === Object.keys(a).length && Object.entries(a).every(([key, value]) => b[key] === value);
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected JSON object');
  return value as Record<string, unknown>;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function stringField(value: unknown, key: string): string {
  const field = object(value)[key];
  if (typeof field !== 'string' || field.length < 1 || field.length > 512) throw new Error(`invalid ${key}`);
  return field;
}
function stringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string' || item.length > 1024)) {
    throw new Error('invalid string array');
  }
  return value as string[];
}
function arrayEquals(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY) throw new Error('broker request body too large');
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new Error('invalid JSON body'); }
}
function send(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) { res.destroy(); return; }
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'cache-control': 'no-store' });
  res.end(data);
}
function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Controller-side adapter. It can call only the broker's fixed operations. */
export class DockerHostBrokerClient implements DockerEnginePort, HostFirewallPort {
  constructor(private readonly socketPath: string, private readonly timeoutMs = 15_000) {
    if (!socketPath.startsWith('/')) throw new Error('Docker host broker socket path must be absolute');
  }
  async createNetwork(name: string, labels: Record<string, string>): Promise<DockerNetwork> {
    const result = await this.json<{ network: DockerNetwork }>('POST', '/v1/networks', { name, labels });
    return result.network;
  }
  async install(network: DockerNetwork, allowedIPv4: readonly string[]): Promise<void> {
    await this.json('POST', '/v1/firewall/install', { networkId: network.id, allowedIPv4 });
  }
  async remove(network: DockerNetwork): Promise<void> {
    await this.json('DELETE', `/v1/firewall/${encodeURIComponent(network.id)}`);
  }
  async createContainer(config: DockerContainerConfig): Promise<string> {
    const result = await this.json<{ id: string }>('POST', '/v1/containers', { config });
    return result.id;
  }
  async startContainer(id: string): Promise<void> { await this.json('POST', `/v1/containers/${id}/start`); }
  async waitContainer(id: string): Promise<{ exitCode: number }> {
    return await this.json('POST', `/v1/containers/${id}/wait`);
  }
  async stopContainer(id: string, _timeoutSeconds: number): Promise<void> {
    await this.json('POST', `/v1/containers/${id}/stop`);
  }
  async removeContainer(id: string): Promise<void> { await this.json('DELETE', `/v1/containers/${id}`); }
  async removeNetwork(id: string): Promise<void> { await this.json('DELETE', `/v1/networks/${id}`); }
  async followLogs(id: string, signal: AbortSignal): Promise<NodeJS.ReadableStream> {
    return await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      const req = httpRequest({ socketPath: this.socketPath, path: `/v1/containers/${id}/logs`, method: 'GET' }, (res) => {
        if (res.statusCode !== 200) { void readResponse(res).then((body) => reject(new Error(body)), reject); return; }
        resolve(res);
      });
      req.setTimeout(this.timeoutMs, () => req.destroy(new Error('Docker broker logs timed out')));
      req.on('error', reject);
      const abort = (): void => req.destroy(new Error('Docker broker logs aborted'));
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
      req.on('close', () => signal.removeEventListener('abort', abort));
      req.end();
    });
  }
  private async json<T = { ok: boolean }>(method: string, path: string, body?: unknown): Promise<T> {
    const payload = body === undefined ? '' : JSON.stringify(body);
    return await new Promise<T>((resolve, reject) => {
      const req = httpRequest({
        socketPath: this.socketPath, path, method,
        headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {},
      }, (res) => {
        void readResponse(res).then((raw) => {
          let parsed: { error?: string } & T;
          try { parsed = JSON.parse(raw) as { error?: string } & T; }
          catch { reject(new Error('invalid Docker host broker response')); return; }
          if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) reject(new Error(parsed.error ?? 'Docker host broker rejected request'));
          else resolve(parsed);
        }, reject);
      });
      req.setTimeout(this.timeoutMs, () => req.destroy(new Error('Docker host broker timed out')));
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}
async function readResponse(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > 16 * 1024) throw new Error('Docker host broker response too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}


async function main(): Promise<void> {
  const socketPath = process.env.VV_DOCKER_BROKER_SOCKET ?? '/run/vunvault-scan-docker/broker.sock';
  const dockerSocketPath = process.env.VV_DOCKER_SOCKET ?? '/var/run/docker.sock';
  const firewallSocketPath = process.env.VV_SCAN_FIREWALL_SOCKET ?? '/run/vunvault-scan-firewall/broker.sock';
  const runnerImage = process.env.RUNNER_IMAGE ?? '';
  const broker = await startDockerHostBroker({
    socketPath, dockerSocketPath, firewallSocketPath, runnerImage,
  });
  process.stdout.write('VUNVAULT Docker host broker ready on its private Unix socket\\n');
  let closing = false;
  const shutdown = (): void => {
    if (closing) return;
    closing = true;
    void broker.close().then(() => process.exit(0), (error: unknown) => {
      process.stderr.write(`Docker host broker shutdown failed: ${error instanceof Error ? error.message : String(error)}\\n`);
      process.exit(1);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
const entryName = process.argv[1]?.split('/').pop();
if (entryName !== undefined && import.meta.url.endsWith(`/${entryName}`)) {
  main().catch((error: unknown) => {
    process.stderr.write(`Docker host broker failed to start: ${error instanceof Error ? error.message : String(error)}\\n`);
    process.exit(1);
  });
}
