import type { Logger } from '../ports';
import type { NetworkPolicyManifest } from './network-policy';
import type { JobManifest } from './pod-manifest';

/** The container name inside every scan pod. */
export const RUNNER_CONTAINER = 'runner';

/**
 * Kubernetes client seam (Task 86).
 *
 * `KubeClient` is the ONLY place the cluster is touched, and it is deliberately
 * narrow: the eight operations a scan needs and nothing else. The controller's
 * Role grants exactly these verbs (see `k8s/controller-rbac.yaml`), so the
 * interface and the RBAC are two views of the same allowlist — in particular
 * there is no `exec`, because pause/resume cannot be implemented without it and
 * the RBAC deliberately does not grant it.
 *
 * Tests inject a fake; production uses `createKubeClient()`, which loads
 * in-cluster config (the controller runs as a pod, so there is no kubeconfig to
 * read and no credential file on disk).
 */

export interface DeleteOptions {
  /** `Foreground` waits for dependants (the pod) to go too. */
  propagationPolicy?: 'Background' | 'Foreground' | 'Orphan';
  gracePeriodSeconds?: number;
}

export interface PodPhase {
  name: string;
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
  /** Set once the container has terminated. */
  exitCode: number | null;
  reason: string | null;
  /** True while the image is being pulled or cannot be pulled. */
  waiting: string | null;
}

export interface LogStreamOptions {
  follow: boolean;
  timestamps: boolean;
  container: string;
}

export interface KubeClient {
  createJob(manifest: JobManifest): Promise<void>;
  deleteJob(name: string, options?: DeleteOptions): Promise<void>;
  createNetworkPolicy(manifest: NetworkPolicyManifest): Promise<void>;
  deleteNetworkPolicy(name: string): Promise<void>;
  /** Pods matching `vv/job-id=<id>` — the controller only ever lists its own. */
  listPodsForJob(jobId: string): Promise<PodPhase[]>;
  /** A readable stream of the runner container's stdout/stderr. */
  followLogs(podName: string, options: LogStreamOptions): Promise<NodeJS.ReadableStream>;
}

/** A 404 is not an error when we are deleting something that may already be gone. */
export function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  return candidate.code === 404 || candidate.statusCode === 404;
}

export interface CreateKubeClientOptions {
  namespace: string;
  logger: Logger;
}

/**
 * The real client, built on `@kubernetes/client-node`.
 *
 * Loaded lazily so a unit test never imports the Kubernetes library (and so the
 * dependency stays optional for anyone running the domain tests alone).
 */
export async function createKubeClient(
  options: CreateKubeClientOptions,
): Promise<KubeClient> {
  const k8s = await import('@kubernetes/client-node');
  const config = new k8s.KubeConfig();
  config.loadFromCluster();

  const batch = config.makeApiClient(k8s.BatchV1Api);
  const core = config.makeApiClient(k8s.CoreV1Api);
  const networking = config.makeApiClient(k8s.NetworkingV1Api);
  const namespace = options.namespace;
  const { logger } = options;

  const swallowNotFound = async (label: string, run: () => Promise<unknown>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      if (isNotFound(error)) {
        logger.debug('already gone', { label });
        return;
      }
      throw error;
    }
  };

  return {
    async createJob(manifest) {
      await batch.createNamespacedJob({ namespace, body: manifest as never });
    },

    async deleteJob(name, deleteOptions = {}) {
      await swallowNotFound(`job/${name}`, () =>
        batch.deleteNamespacedJob({
          name,
          namespace,
          propagationPolicy: deleteOptions.propagationPolicy ?? 'Foreground',
          gracePeriodSeconds: deleteOptions.gracePeriodSeconds,
        }),
      );
    },

    async createNetworkPolicy(manifest) {
      await networking.createNamespacedNetworkPolicy({ namespace, body: manifest as never });
    },

    async deleteNetworkPolicy(name) {
      await swallowNotFound(`networkpolicy/${name}`, () =>
        networking.deleteNamespacedNetworkPolicy({ name, namespace }),
      );
    },

    async listPodsForJob(jobId) {
      const response = await core.listNamespacedPod({
        namespace,
        labelSelector: `vv/job-id=${jobId}`,
      });
      return (response.items ?? []).map((pod) => {
        const status = pod.status?.containerStatuses?.[0]?.state;
        const terminated = status?.terminated;
        const waiting = status?.waiting;
        return {
          name: pod.metadata?.name ?? '',
          phase: (pod.status?.phase ?? 'Unknown') as PodPhase['phase'],
          exitCode: terminated?.exitCode ?? null,
          reason: terminated?.reason ?? null,
          waiting: waiting?.reason ?? null,
        };
      });
    },

    async followLogs(podName, logOptions) {
      const log = new k8s.Log(config);
      // A PassThrough is both sides: the client library WRITES chunks into it as
      // they arrive from the kubelet, and the caller READS them as a stream.
      const { PassThrough } = await import('node:stream');
      const stream = new PassThrough();
      await log.log(
        namespace,
        podName,
        logOptions.container,
        stream,
        (error) => {
          if (error !== null && error !== undefined) stream.destroy(error);
          else stream.end();
        },
        { follow: logOptions.follow, timestamps: logOptions.timestamps },
      );
      return stream;
    },
  };
}
