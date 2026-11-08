import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http';
import { PassThrough } from 'node:stream';
import type { DockerContainerConfig, DockerEnginePort, DockerNetwork } from './docker-pod-runner';

/**
 * Minimal Docker Engine HTTP client.
 *
 * This client is for the separate host broker process only. It is the process
 * that owns access to the raw Docker socket and validates every controller
 * request before calling this client. Never instantiate it in the scan
 * controller, API, or runner. Endpoint-only socket proxies are insufficient:
 * containers/create accepts dangerous host mounts and privilege settings.
 */

export interface DockerEngineHttpOptions {
  socketPath: string;
  apiVersion?: string;
  requestTimeoutMs?: number;
}

interface DockerNetworkCreateResponse { Id?: string }
interface DockerContainerCreateResponse { Id?: string }
interface DockerWaitResponse { StatusCode?: number }

export class DockerEngineHttpClient implements DockerEnginePort {
  private readonly apiPrefix: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: DockerEngineHttpOptions) {
    if (!options.socketPath.startsWith('/')) {
      throw new Error('Docker Engine proxy socket path must be absolute');
    }
    this.apiPrefix = `/v${options.apiVersion ?? '1.45'}`;
    this.timeoutMs = options.requestTimeoutMs ?? 15_000;
  }

  async createNetwork(name: string, labels: Record<string, string>): Promise<DockerNetwork> {
    const response = await this.json<DockerNetworkCreateResponse>('POST', '/networks/create', {
      Name: name,
      CheckDuplicate: true,
      Driver: 'bridge',
      Internal: false,
      Attachable: false,
      Ingress: false,
      EnableIPv6: false,
      Options: {
        'com.docker.network.bridge.enable_icc': 'false',
        'com.docker.network.bridge.enable_ip_masquerade': 'true',
      },
      Labels: labels,
    });
    if (typeof response.Id !== 'string' || response.Id.length < 12) {
      throw new Error('Docker Engine returned an invalid network ID');
    }
    return { id: response.Id, name };
  }

  async createContainer(config: DockerContainerConfig): Promise<string> {
    const response = await this.json<DockerContainerCreateResponse>(
      'POST',
      `/containers/create?name=${encodeURIComponent(config.name)}`,
      {
        Image: config.image,
        User: config.user,
        Env: config.env,
        Labels: config.labels,
        Tty: false,
        OpenStdin: false,
        AttachStdin: false,
        AttachStdout: false,
        AttachStderr: false,
        HostConfig: {
          NetworkMode: config.networkName,
          ReadonlyRootfs: config.readonlyRootfs,
          Privileged: config.privileged,
          CapDrop: config.capDrop,
          SecurityOpt: config.securityOpt,
          PidsLimit: config.pidsLimit,
          Memory: config.memoryBytes,
          NanoCpus: config.nanoCpus,
          Tmpfs: config.tmpfs,
          Dns: config.dns,
          ExtraHosts: config.extraHosts,
          Init: true,
          RestartPolicy: { Name: 'no' },
          AutoRemove: false,
          Binds: [],
          Devices: [],
          PortBindings: {},
          PublishAllPorts: false,
          OomKillDisable: false,
          Sysctls: {
            'net.ipv6.conf.all.disable_ipv6': '1',
            'net.ipv6.conf.default.disable_ipv6': '1',
          },
          LogConfig: {
            Type: 'local',
            Config: { 'max-size': '1m', 'max-file': '2' },
          },
        },
        NetworkingConfig: {
          EndpointsConfig: { [config.networkName]: {} },
        },
      },
    );
    if (typeof response.Id !== 'string' || response.Id.length < 12) {
      throw new Error('Docker Engine returned an invalid container ID');
    }
    return response.Id;
  }

  async startContainer(containerId: string): Promise<void> {
    await this.empty('POST', `/containers/${encodeURIComponent(containerId)}/start`, [204, 304]);
  }

  async followLogs(containerId: string, signal: AbortSignal): Promise<NodeJS.ReadableStream> {
    const output = new PassThrough();
    const path = `${this.apiPrefix}/containers/${encodeURIComponent(containerId)}/logs?follow=1&stdout=1&stderr=1&timestamps=0&tail=all`;
    const req = httpRequest(this.requestOptions('GET', path), (response) => {
      if (response.statusCode !== 200) {
        void readBody(response).then((body) => {
          output.destroy(new Error(`Docker logs failed (HTTP ${response.statusCode}): ${body.slice(0, 300)}`));
        });
        return;
      }
      demultiplexDockerStream(response, output);
    });
    req.setTimeout(this.timeoutMs, () => req.destroy(new Error('Docker logs request timed out')));
    const onAbort = (): void => req.destroy(new Error('Docker logs request aborted'));
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
    req.on('error', (error) => output.destroy(error));
    output.on('close', () => signal.removeEventListener('abort', onAbort));
    req.end();
    return output;
  }

  async waitContainer(containerId: string): Promise<{ exitCode: number }> {
    const response = await this.json<DockerWaitResponse>(
      'POST',
      `/containers/${encodeURIComponent(containerId)}/wait?condition=not-running`,
      {},
    );
    if (!Number.isInteger(response.StatusCode)) {
      throw new Error('Docker Engine returned no container exit status');
    }
    return { exitCode: response.StatusCode as number };
  }

  async stopContainer(containerId: string, timeoutSeconds: number): Promise<void> {
    await this.empty(
      'POST',
      `/containers/${encodeURIComponent(containerId)}/stop?t=${Math.max(0, Math.floor(timeoutSeconds))}`,
      [204, 304, 404],
    );
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.empty(
      'DELETE',
      `/containers/${encodeURIComponent(containerId)}?force=1&v=1`,
      [204, 404],
    );
  }

  async removeNetwork(networkId: string): Promise<void> {
    await this.empty('DELETE', `/networks/${encodeURIComponent(networkId)}`, [204, 404]);
  }

  private async json<T>(method: string, path: string, body: unknown): Promise<T> {
    const response = await this.perform(method, path, JSON.stringify(body));
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Docker Engine ${method} failed (HTTP ${response.status}): ${response.body.slice(0, 300)}`);
    }
    try {
      return JSON.parse(response.body) as T;
    } catch {
      throw new Error('Docker Engine returned invalid JSON');
    }
  }

  private async empty(method: string, path: string, accepted: number[]): Promise<void> {
    const response = await this.perform(method, path, '');
    if (!accepted.includes(response.status)) {
      throw new Error(`Docker Engine ${method} failed (HTTP ${response.status}): ${response.body.slice(0, 300)}`);
    }
  }

  private perform(method: string, path: string, body: string): Promise<{ status: number; body: string }> {
    const requestPath = path.startsWith(this.apiPrefix) ? path : `${this.apiPrefix}${path}`;
    return new Promise((resolve, reject) => {
      const req = httpRequest(this.requestOptions(method, requestPath), (response) => {
        void readBody(response).then((text) => {
          resolve({ status: response.statusCode ?? 0, body: text });
        }, reject);
      });
      req.setTimeout(this.timeoutMs, () => req.destroy(new Error('Docker Engine request timed out')));
      req.on('error', reject);
      if (body !== '') {
        req.setHeader('content-type', 'application/json');
        req.setHeader('content-length', Buffer.byteLength(body));
        req.write(body);
      }
      req.end();
    });
  }

  private requestOptions(method: string, path: string): RequestOptions {
    return {
      socketPath: this.options.socketPath,
      path,
      method,
      headers: { accept: 'application/json' },
    };
  }
}

async function readBody(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > 1024 * 1024) throw new Error('Docker Engine response exceeded 1 MiB');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Docker's non-TTY log stream frames each stdout/stderr chunk with an 8-byte header. */
function demultiplexDockerStream(input: NodeJS.ReadableStream, output: PassThrough): void {
  let pending = Buffer.alloc(0);
  input.on('data', (chunk: Buffer | string) => {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    pending = pending.length === 0 ? next : Buffer.concat([pending, next]);
    while (pending.length >= 8) {
      const streamType = pending[0];
      const length = pending.readUInt32BE(4);
      if (length > 1024 * 1024) {
        output.destroy(new Error('Docker log frame exceeded 1 MiB'));
        return;
      }
      if (pending.length < 8 + length) return;
      const payload = pending.subarray(8, 8 + length);
      if (streamType === 1 || streamType === 2) output.write(payload);
      pending = pending.subarray(8 + length);
    }
  });
  input.on('end', () => {
    if (pending.length !== 0) output.destroy(new Error('Docker log stream ended with an incomplete frame'));
    else output.end();
  });
  input.on('error', (error) => output.destroy(error));
}
