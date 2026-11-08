import type { Clock, Logger, PodRunner, PodSpec, RunHooks, RunResult } from '../ports';
import { classifyIp } from '../domain/target-guard';
import { consumeLogStream, type TerminalLine } from '../k8s/log-stream';

/**
 * Docker execution boundary.
 *
 * The Docker Engine client and host-firewall broker are deliberately separate
 * ports. A Docker daemon alone cannot enforce per-job egress; the broker must
 * install host-level rules before a runner container is created. Production
 * bootstrap must refuse to select this adapter unless BOTH ports are backed by
 * authenticated, least-privilege services.
 */

export interface DockerNetwork {
  id: string;
  name: string;
}

export interface DockerContainerConfig {
  name: string;
  image: string;
  networkName: string;
  user: '65532:65532';
  env: string[];
  extraHosts: string[];
  readonlyRootfs: true;
  privileged: false;
  capDrop: ['ALL'];
  securityOpt: ['no-new-privileges:true'];
  pidsLimit: number;
  memoryBytes: number;
  nanoCpus: number;
  tmpfs: { '/tmp': string };
  dns: ['127.0.0.1'];
  ipv6Disabled: true;
  labels: Record<string, string>;
}

export interface DockerEnginePort {
  createNetwork(name: string, labels: Record<string, string>): Promise<DockerNetwork>;
  createContainer(config: DockerContainerConfig): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  followLogs(containerId: string, signal: AbortSignal): Promise<NodeJS.ReadableStream>;
  waitContainer(containerId: string): Promise<{ exitCode: number }>;
  stopContainer(containerId: string, timeoutSeconds: number): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  removeNetwork(networkId: string): Promise<void>;
}

export interface HostFirewallPort {
  /**
   * Install an egress allowlist for this newly-created, empty Docker network.
   * The implementation must bind the rule to that network's bridge interface,
   * deny all other IPv4/IPv6 forwarding and host-input traffic from the bridge,
   * and return only after the kernel confirms the rules are active.
   */
  install(network: DockerNetwork, allowedIPv4: readonly string[]): Promise<void>;
  /** Idempotently remove only this job's rules. */
  remove(network: DockerNetwork): Promise<void>;
}

export interface DockerPodRunnerOptions {
  docker: DockerEnginePort;
  firewall: HostFirewallPort;
  clock: Clock;
  logger: Logger;
  runnerImage: string;
  onTerminalLine?(line: TerminalLine): void;
  maxOutputBytes?: number;
}

export const DOCKER_RUNNER_UID = '65532:65532';
export const DOCKER_RUNNER_MEMORY_BYTES = 1024 * 1024 * 1024;
export const DOCKER_RUNNER_NANO_CPUS = 1_000_000_000;
export const DOCKER_RUNNER_PIDS_LIMIT = 128;
export const DOCKER_RUNNER_TMPFS = 'rw,noexec,nosuid,nodev,size=1g';

export class DockerPodRunner implements PodRunner {
  constructor(private readonly options: DockerPodRunnerOptions) {
    if (!/^.+@sha256:[a-f0-9]{64}$/.test(options.runnerImage)) {
      throw new Error('Docker runner image must be pinned by sha256 digest');
    }
  }

  async run(spec: PodSpec, hooks: RunHooks, signal: AbortSignal): Promise<RunResult> {
    const { docker, firewall, logger, clock } = this.options;
    const name = resourceName(spec);
    const networkLabels = labelsFor(spec);
    let network: DockerNetwork | null = null;
    let containerId: string | null = null;
    let firewallInstalled = false;
    let lineCount = 0;
    let bytesStreamed = 0;
    let reason: RunResult['reason'] = 'error';
    let exitCode = -1;
    let abortReason: 'abort' | 'kill' | null = signal.aborted ? 'abort' : null;
    let deadlineHit = false;
    let stopRequested = false;

    const onAbort = (): void => {
      abortReason = abortReason ?? 'abort';
      if (containerId !== null) void stopOnce();
    };
    const stopOnce = async (): Promise<void> => {
      if (containerId === null || stopRequested) return;
      stopRequested = true;
      await docker.stopContainer(containerId, 0).catch((error: unknown) => {
        logger.warn('could not stop Docker scan container', {
          message: messageOf(error),
        });
      });
    };

    if (!signal.aborted) signal.addEventListener('abort', onAbort, { once: true });

    // A deadline promise is a backstop even if the runner process or log stream
    // becomes unresponsive. The container is stopped before cleanup begins.
    const deadline = clock.sleep(spec.deadlineSeconds * 1_000).then(async () => {
      deadlineHit = true;
      await stopOnce();
    }).catch(() => undefined);

    try {
      if (signal.aborted) {
        return { exitCode: 130, reason: 'abort', lineCount, bytesStreamed };
      }

      // Create an empty isolated network. No container is attached yet.
      network = await docker.createNetwork(name, networkLabels);

      // CRITICAL ORDER: install and confirm host egress rules BEFORE container
      // creation. Failure here leaves no executable runner.
      const allowedIPv4 = allowedAddresses(spec);
      await firewall.install(network, allowedIPv4);
      firewallInstalled = true;

      if (signal.aborted) {
        return { exitCode: 130, reason: 'abort', lineCount, bytesStreamed };
      }

      const config: DockerContainerConfig = {
        name,
        image: this.options.runnerImage,
        networkName: network.name,
        user: DOCKER_RUNNER_UID,
        env: runnerEnvironment(spec),
        extraHosts: spec.cidr === undefined ? spec.ips.map((ip) => `${spec.host}:${ip}`) : [],
        readonlyRootfs: true,
        privileged: false,
        capDrop: ['ALL'],
        securityOpt: ['no-new-privileges:true'],
        pidsLimit: DOCKER_RUNNER_PIDS_LIMIT,
        memoryBytes: DOCKER_RUNNER_MEMORY_BYTES,
        nanoCpus: DOCKER_RUNNER_NANO_CPUS,
        tmpfs: { '/tmp': DOCKER_RUNNER_TMPFS },
        dns: ['127.0.0.1'],
        ipv6Disabled: true,
        labels: networkLabels,
      };

      containerId = await docker.createContainer(config);
      await docker.startContainer(containerId);

      const stream = await docker.followLogs(containerId, signal);
      const streamPromise = consumeLogStream(stream, {
        logger,
        hooks,
        onTerminalLine: this.options.onTerminalLine ?? (() => undefined),
        ...(this.options.maxOutputBytes === undefined
          ? {}
          : { maxOutputBytes: this.options.maxOutputBytes }),
      });

      const waitPromise = docker.waitContainer(containerId);
      const outcome = await Promise.race([
        Promise.all([streamPromise, waitPromise]).then(([logs, state]) => ({ kind: 'finished' as const, logs, state })),
        deadline.then(() => ({ kind: 'deadline' as const })),
        abortPromise(signal).then(() => ({ kind: 'abort' as const })),
      ]);

      if (outcome.kind === 'deadline' || deadlineHit) {
        await stopOnce();
        reason = 'deadline';
        exitCode = 124;
        // The stream may finish after stop; don't allow it to hold cleanup open.
        const logs = await settleLogs(streamPromise);
        lineCount = logs.lineCount;
        bytesStreamed = logs.bytesStreamed;
      } else if (outcome.kind === 'abort' || abortReason !== null) {
        await stopOnce();
        reason = abortReason === 'kill' ? 'kill' : 'abort';
        exitCode = reason === 'kill' ? 137 : 130;
        const logs = await settleLogs(streamPromise);
        lineCount = logs.lineCount;
        bytesStreamed = logs.bytesStreamed;
      } else {
        lineCount = outcome.logs.lineCount;
        bytesStreamed = outcome.logs.bytesStreamed;
        exitCode = outcome.state.exitCode;
        reason = exitCode === 0 ? 'completed' : 'error';
      }
      return { exitCode, reason, lineCount, bytesStreamed };
    } catch (error) {
      logger.error('Docker scan execution failed closed', {
        jobId: spec.jobId,
        message: messageOf(error),
      });
      return { exitCode: -1, reason: 'error', lineCount, bytesStreamed };
    } finally {
      signal.removeEventListener('abort', onAbort);
      await stopOnce();
      if (containerId !== null) {
        await docker.removeContainer(containerId).catch((error: unknown) => {
          logger.warn('could not remove Docker scan container', { message: messageOf(error) });
        });
      }
      if (network !== null) {
        if (firewallInstalled) {
          await firewall.remove(network).catch((error: unknown) => {
            logger.error('could not remove Docker scan firewall rules', {
              networkId: network?.id,
              message: messageOf(error),
            });
          });
        }
        await docker.removeNetwork(network.id).catch((error: unknown) => {
          logger.warn('could not remove Docker scan network', {
            networkId: network?.id,
            message: messageOf(error),
          });
        });
      }
      void deadline;
    }
  }
}

function runnerEnvironment(spec: PodSpec): string[] {
  const values: Record<string, string> = {
    VV_JOB_ID: spec.jobId,
    VV_JOB_CODE: spec.jobCode,
    VV_SCAN_TYPE: spec.scanType,
    VV_TARGET_HOST: spec.host,
    VV_TARGET_IPS: spec.ips.join(','),
    VV_DEADLINE_SECONDS: String(Math.min(spec.deadlineSeconds, 840)),
    HOME: '/tmp',
  };
  if (spec.cidr !== undefined) values.VV_TARGET_CIDR = spec.cidr;
  return Object.entries(values).map(([key, value]) => `${key}=${value}`);
}

function allowedAddresses(spec: PodSpec): string[] {
  if (spec.cidr === undefined) {
    if (spec.ips.length === 0 || spec.ips.some((ip) => classifyIp(ip) !== 'public')) {
      throw new Error('refusing Docker scan without exclusively public pinned IPv4 addresses');
    }
    return [...new Set(spec.ips)];
  }

  const [rawAddress, rawPrefix] = spec.cidr.split('/');
  const octets = rawAddress?.split('.').map(Number);
  const prefix = Number(rawPrefix);
  if (octets?.length !== 4 || !Number.isInteger(prefix) || prefix < 24 || prefix > 32) {
    throw new Error('invalid Docker scan CIDR');
  }
  const base = octets.reduce((value, octet) => value * 256 + octet, 0);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    throw new Error('invalid Docker scan CIDR');
  }
  const size = 2 ** (32 - prefix);
  const network = Math.floor(base / size) * size;
  const addresses: string[] = [];
  for (let offset = 0; offset < size; offset += 1) {
    const value = network + offset;
    const ip = [
      Math.floor(value / 2 ** 24) % 256,
      Math.floor(value / 2 ** 16) % 256,
      Math.floor(value / 2 ** 8) % 256,
      value % 256,
    ].join('.');
    if (classifyIp(ip) !== 'public') {
      throw new Error('Docker scan CIDR overlaps a forbidden IPv4 range');
    }
    addresses.push(ip);
  }
  return addresses;
}

function resourceName(spec: PodSpec): string {
  const job = spec.jobCode.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return `vv-scan-${job.slice(0, 38)}-a${spec.attempt}`.slice(0, 63).replace(/-+$/g, '');
}

function labelsFor(spec: PodSpec): Record<string, string> {
  return {
    'app.kubernetes.io/name': 'vv-scan',
    'vv/job-id': spec.jobId,
    'vv/job-code': spec.jobCode.toLowerCase(),
    'vv/attempt': String(spec.attempt),
  };
}

function abortPromise(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
}

async function settleLogs(
  promise: ReturnType<typeof consumeLogStream>,
): Promise<{ lineCount: number; bytesStreamed: number }> {
  return await Promise.race([
    promise.then(({ lineCount, bytesStreamed }) => ({ lineCount, bytesStreamed })),
    new Promise<{ lineCount: number; bytesStreamed: number }>((resolve) =>
      setTimeout(() => resolve({ lineCount: 0, bytesStreamed: 0 }), 2_000),
    ),
  ]);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
