import { request as httpRequest, type IncomingMessage } from 'node:http';
import type { DockerNetwork, HostFirewallPort } from './docker-pod-runner';

/**
 * Client for the root-owned, Unix-socket-only host firewall helper.
 * Socket permissions (owner/group/mode) are the access-control boundary.
 */
export interface HostFirewallUnixClientOptions {
  socketPath: string;
  timeoutMs?: number;
}

export class HostFirewallUnixClient implements HostFirewallPort {
  constructor(private readonly options: HostFirewallUnixClientOptions) {
    if (!options.socketPath.startsWith('/')) {
      throw new Error('firewall broker socket path must be absolute');
    }
  }

  async install(network: DockerNetwork, allowedIPv4: readonly string[]): Promise<void> {
    await this.request('POST', '/v1/policies', JSON.stringify({ network, allowedIPv4 }), [201]);
  }

  async remove(network: DockerNetwork): Promise<void> {
    await this.request('DELETE', `/v1/policies/${encodeURIComponent(network.id)}`, '', [200]);
  }

  private async request(
    method: string,
    path: string,
    body: string,
    accepted: number[],
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const request = httpRequest({
        socketPath: this.options.socketPath,
        path,
        method,
        headers: body === '' ? { accept: 'application/json' } : {
          accept: 'application/json',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      }, (response) => {
        void readResponse(response).then((text) => {
          const status = response.statusCode ?? 0;
          if (accepted.includes(status)) resolve();
          else reject(new Error(`firewall broker rejected ${method} (HTTP ${status}): ${text.slice(0, 200)}`));
        }, reject);
      });
      request.setTimeout(this.options.timeoutMs ?? 10_000, () => {
        request.destroy(new Error('firewall broker request timed out'));
      });
      request.on('error', reject);
      if (body !== '') request.write(body);
      request.end();
    });
  }
}

async function readResponse(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > 8 * 1024) throw new Error('firewall broker response exceeded 8 KiB');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
