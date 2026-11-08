import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { Logger, PodSpec } from '../ports';
import {
  DockerPodRunner,
  type DockerContainerConfig,
  type DockerEnginePort,
  type DockerNetwork,
  type HostFirewallPort,
} from './docker-pod-runner';

const SPEC: PodSpec = {
  jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  jobCode: 'JOB-4471',
  attempt: 1,
  scanType: 'external',
  host: 'scan.example.com',
  ips: ['93.184.216.34'],
  deadlineSeconds: 900,
};
const IMAGE = 'registry.example.test/vv-runner@sha256:' + 'a'.repeat(64);

function logger(): Logger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
}

interface Harness {
  runner: DockerPodRunner;
  calls: string[];
  config: DockerContainerConfig[];
  allowed: string[][];
}

function harness(options: {
  failFirewall?: boolean;
  failCreateContainer?: boolean;
  exitCode?: number;
} = {}): Harness {
  const calls: string[] = [];
  const config: DockerContainerConfig[] = [];
  const allowed: string[][] = [];
  const network: DockerNetwork = { id: 'network-id-123456', name: 'vv-scan-job-4471-a1' };
  const docker: DockerEnginePort = {
    async createNetwork(name) {
      calls.push('create-network');
      expect(name).toBe(network.name);
      return network;
    },
    async createContainer(value) {
      calls.push('create-container');
      config.push(value);
      if (options.failCreateContainer) throw new Error('container create rejected');
      return 'container-id';
    },
    async startContainer() { calls.push('start-container'); },
    async followLogs() {
      calls.push('follow-logs');
      return Readable.from([Buffer.from('[*] scan started\n')]);
    },
    async waitContainer() {
      calls.push('wait-container');
      return { exitCode: options.exitCode ?? 0 };
    },
    async stopContainer() { calls.push('stop-container'); },
    async removeContainer() { calls.push('remove-container'); },
    async removeNetwork() { calls.push('remove-network'); },
  };
  const firewall: HostFirewallPort = {
    async install(received, addresses) {
      calls.push('install-firewall');
      expect(received.id).toBe(network.id);
      allowed.push([...addresses]);
      if (options.failFirewall) throw new Error('firewall unavailable');
    },
    async remove(received) {
      calls.push('remove-firewall');
      expect(received.id).toBe(network.id);
    },
  };
  return {
    runner: new DockerPodRunner({
      docker,
      firewall,
      logger: logger(),
      runnerImage: IMAGE,
    }),
    calls,
    config,
    allowed,
  };
}

describe('DockerPodRunner — fail-closed ordering', () => {
  it('installs host egress rules before creating a runner container', async () => {
    const h = harness();
    const result = await h.runner.run(SPEC, {
      onLine: () => undefined,
      onProgress: () => undefined,
      onFinding: () => undefined,
    }, new AbortController().signal);

    expect(result.reason).toBe('completed');
    expect(h.calls.indexOf('install-firewall')).toBeLessThan(h.calls.indexOf('create-container'));
    expect(h.calls).toContain('remove-firewall');
    expect(h.calls).toContain('remove-network');
  });

  it('does not create a container when host firewall installation fails', async () => {
    const h = harness({ failFirewall: true });
    const result = await h.runner.run(SPEC, {
      onLine: () => undefined,
      onProgress: () => undefined,
      onFinding: () => undefined,
    }, new AbortController().signal);

    expect(result.reason).toBe('error');
    expect(h.calls).not.toContain('create-container');
    // install may have partially applied rules before reporting an error.
    expect(h.calls).toContain('remove-firewall');
    expect(h.calls).toContain('remove-network');
  });

  it('removes firewall and network if container creation fails', async () => {
    const h = harness({ failCreateContainer: true });
    const result = await h.runner.run(SPEC, {
      onLine: () => undefined,
      onProgress: () => undefined,
      onFinding: () => undefined,
    }, new AbortController().signal);

    expect(result.reason).toBe('error');
    expect(h.calls).toContain('remove-firewall');
    expect(h.calls).toContain('remove-network');
  });

  it('uses only pinned public addresses and hardened container settings', async () => {
    const h = harness();
    await h.runner.run(SPEC, {
      onLine: () => undefined,
      onProgress: () => undefined,
      onFinding: () => undefined,
    }, new AbortController().signal);

    expect(h.allowed).toEqual([['93.184.216.34']]);
    expect(h.config[0]).toMatchObject({
      user: '65532:65532',
      readonlyRootfs: true,
      privileged: false,
      capDrop: ['ALL'],
      securityOpt: ['no-new-privileges:true'],
      pidsLimit: 128,
      dns: ['127.0.0.1'],
      ipv6Disabled: true,
      extraHosts: ['scan.example.com:93.184.216.34'],
    });
    expect(h.config[0]?.env.some((value) => value.includes('HMAC') || value.includes('REDIS'))).toBe(false);
  });

  it('rejects a forbidden pinned address before the runner container is created', async () => {
    const h = harness();
    const result = await h.runner.run({ ...SPEC, ips: ['169.254.169.254'] }, {
      onLine: () => undefined,
      onProgress: () => undefined,
      onFinding: () => undefined,
    }, new AbortController().signal);

    expect(result.reason).toBe('error');
    expect(h.calls).not.toContain('create-container');
  });

  it('requires a digest-pinned image', () => {
    expect(() => new DockerPodRunner({
      docker: {} as DockerEnginePort,
      firewall: {} as HostFirewallPort,
      logger: logger(),
      runnerImage: 'registry.example.test/vv-runner:latest',
    })).toThrow(/sha256 digest/);
  });
});
