import type { PodSpec } from '../ports.js';

/**
 * Job manifest builder (Task 86) — the locked-down pod a single scan runs in.
 *
 * Every field here is a deliberate denial. The pod executes tools pointed at a
 * host chosen by an anonymous public form, so it is assumed to be owned from the
 * moment it starts, and the manifest is written so that owning it buys an
 * attacker nothing:
 *
 *  - **No identity.** `automountServiceAccountToken: false` and a
 *    `vv-scan-runner` ServiceAccount with NO bindings, so there is no token to
 *    steal and nothing it could reach if there were.
 *  - **No cluster.** `dnsPolicy: None` with a dead nameserver, plus a
 *    per-job NetworkPolicy that allows egress only to the pinned target IPs. The
 *    pod cannot resolve a service name, cannot reach the API, Redis, the
 *    database or the cloud metadata address.
 *  - **No filesystem.** Read-only root, a single 1 GiB tmpfs at `/tmp`, and no
 *    hostPath / PVC / secret / configMap / projected volume anywhere.
 *  - **No privileges.** Non-root 65532, all capabilities dropped, no privilege
 *    escalation, RuntimeDefault seccomp, not privileged, no host namespaces.
 *  - **No secrets.** The env list is a fixed allowlist of scan parameters. No
 *    API URL, no HMAC key, no Redis URL, nothing with `valueFrom`.
 *  - **Bounded.** `backoffLimit: 0` (a scan is not retried by Kubernetes),
 *    `activeDeadlineSeconds: 900`, `ttlSecondsAfterFinished: 300`, resource
 *    limits, and it can only land on the dedicated scan node pool.
 *
 * The runner's own deadline (`VV_DEADLINE_SECONDS = 840`) is deliberately
 * SHORTER than the Job's 900 s so the runner can finish, flush and exit on its
 * own terms before Kubernetes kills it.
 */

/** The pod runs as the nonroot "nobody" user. */
export const RUN_AS_USER = 65_532;

/** The runner finishes before the Job's `activeDeadlineSeconds`. */
export const RUNNER_DEADLINE_SECONDS = 840;

/** The Job's own hard stop. */
export const ACTIVE_DEADLINE_SECONDS = 900;

export const SCAN_NAMESPACE = 'vv-scans';

/** The bound-less ServiceAccount the scan pod runs under. */
export const RUNNER_SERVICE_ACCOUNT = 'vv-scan-runner';

/** The only env keys a scan pod ever receives. */
export const ALLOWED_ENV_KEYS = [
  'VV_JOB_ID',
  'VV_JOB_CODE',
  'VV_SCAN_TYPE',
  'VV_TARGET_HOST',
  'VV_TARGET_IPS',
  'VV_TARGET_CIDR',
  'VV_DEADLINE_SECONDS',
  'HOME',
] as const;

export interface ManifestEnv {
  /** Digest-pinned runner image, e.g. `registry/vv-runner@sha256:…`. */
  runnerImage: string;
}

/** Minimal structural types — the client library's are far wider than needed. */
export interface ObjectMeta {
  name: string;
  namespace: string;
  labels: Record<string, string>;
}

export interface ContainerPort {
  containerPort: number;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
}

export interface Container {
  name: string;
  image: string;
  imagePullPolicy: string;
  args: string[];
  env: { name: string; value: string }[];
  securityContext: Record<string, unknown>;
  resources: Record<string, unknown>;
  volumeMounts: VolumeMount[];
}

export interface Volume {
  name: string;
  emptyDir?: { medium: string; sizeLimit: string };
}

export interface JobManifest {
  apiVersion: 'batch/v1';
  kind: 'Job';
  metadata: ObjectMeta;
  spec: {
    backoffLimit: number;
    activeDeadlineSeconds: number;
    ttlSecondsAfterFinished: number;
    parallelism: number;
    completions: number;
    selector: { matchLabels: Record<string, string> };
    template: {
      metadata: { labels: Record<string, string> };
      spec: Record<string, unknown> & {
        containers: Container[];
        volumes: Volume[];
      };
    };
  };
}

/**
 * A DNS-1123 subdomain name: lowercase alphanumerics and `-`, starting and
 * ending alphanumeric, at most 63 characters.
 *
 * `jobCode` comes from the API and is human-facing (`JOB-4471`), so it is
 * lower-cased and stripped of anything DNS would reject. Truncation keeps the
 * `-a<attempt>` suffix, because two attempts at the same job must not collide.
 */
export function jobResourceName(jobCode: string, attempt: number): string {
  const suffix = `-a${attempt}`;
  const cleaned = jobCode
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = 'vv-scan-';
  const budget = 63 - prefix.length - suffix.length;
  const body =
    cleaned.length > budget ? cleaned.slice(0, Math.max(1, budget)).replace(/-+$/g, '') : cleaned;
  return `${prefix}${body}${suffix}`;
}

function scanLabels(spec: PodSpec): Record<string, string> {
  return {
    'app.kubernetes.io/name': 'vv-scan',
    'vv/job-id': spec.jobId,
    'vv/job-code': spec.jobCode.toLowerCase(),
    'vv/attempt': String(spec.attempt),
  };
}

/** One `hostAliases` entry per pinned IP, so the pod needs no DNS at all. */
function hostAliasesOf(spec: PodSpec): { ip: string; hostnames: string[] }[] {
  return spec.ips.map((ip) => ({ ip, hostnames: [spec.host] }));
}

export function buildJobManifest(spec: PodSpec, env: ManifestEnv): JobManifest {
  const name = jobResourceName(spec.jobCode, spec.attempt);
  const labels = scanLabels(spec);

  const containerEnv: { name: string; value: string }[] = [
    { name: 'VV_JOB_ID', value: spec.jobId },
    { name: 'VV_JOB_CODE', value: spec.jobCode },
    { name: 'VV_SCAN_TYPE', value: spec.scanType },
    { name: 'VV_TARGET_HOST', value: spec.host },
    { name: 'VV_TARGET_IPS', value: spec.ips.join(',') },
    { name: 'VV_DEADLINE_SECONDS', value: String(RUNNER_DEADLINE_SECONDS) },
    { name: 'HOME', value: '/tmp' },
  ];
  if (spec.cidr !== undefined) {
    containerEnv.push({ name: 'VV_TARGET_CIDR', value: spec.cidr });
  }

  const container: Container = {
    name: 'runner',
    image: env.runnerImage,
    imagePullPolicy: 'IfNotPresent',
    // No `command` override: the image's own entrypoint is the runner (Task 87).
    args: [],
    env: containerEnv,
    securityContext: {
      runAsNonRoot: true,
      runAsUser: RUN_AS_USER,
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      privileged: false,
      capabilities: { drop: ['ALL'] },
      seccompProfile: { type: 'RuntimeDefault' },
    },
    resources: {
      requests: { cpu: '250m', memory: '256Mi', 'ephemeral-storage': '128Mi' },
      limits: { cpu: '1', memory: '1Gi', 'ephemeral-storage': '1Gi' },
    },
    volumeMounts: [{ name: 'scratch', mountPath: '/tmp' }],
  };

  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { name, namespace: SCAN_NAMESPACE, labels },
    spec: {
      backoffLimit: 0,
      activeDeadlineSeconds: ACTIVE_DEADLINE_SECONDS,
      ttlSecondsAfterFinished: 300,
      parallelism: 1,
      completions: 1,
      selector: { matchLabels: { 'vv/job-id': spec.jobId, 'vv/attempt': String(spec.attempt) } },
      template: {
        metadata: { labels },
        spec: {
          restartPolicy: 'Never',
          automountServiceAccountToken: false,
          serviceAccountName: RUNNER_SERVICE_ACCOUNT,
          enableServiceLinks: false,
          hostNetwork: false,
          hostPID: false,
          hostIPC: false,
          // The pod must not reach cluster DNS; names come from hostAliases.
          dnsPolicy: 'None',
          dnsConfig: { nameservers: ['127.0.0.1'] },
          hostAliases: hostAliasesOf(spec),
          terminationGracePeriodSeconds: 10,
          securityContext: {
            runAsNonRoot: true,
            runAsUser: RUN_AS_USER,
            runAsGroup: RUN_AS_USER,
            fsGroup: RUN_AS_USER,
            seccompProfile: { type: 'RuntimeDefault' },
          },
          // Dedicated scan pool only — never a node running the API or OKE work.
          nodeSelector: { 'vv/pool': 'scan' },
          tolerations: [{ key: 'vv/scan', operator: 'Equal', value: 'true', effect: 'NoSchedule' }],
          containers: [container],
          // tmpfs only: no persistent volume, no host path, no secret, no
          // configMap, no projected token.
          volumes: [{ name: 'scratch', emptyDir: { medium: 'Memory', sizeLimit: '1Gi' } }],
        },
      },
    },
  };
}

/**
 * Assert the manifest carries no volume type that could leak data or identity
 * into the pod. Used by the tests and callable at runtime as a paranoid check
 * before the Job is created.
 */
export function forbiddenVolumes(manifest: JobManifest): string[] {
  const forbidden = [
    'persistentVolumeClaim',
    'hostPath',
    'secret',
    'configMap',
    'projected',
    'csi',
    'nfs',
  ];
  const found: string[] = [];
  for (const volume of manifest.spec.template.spec.volumes) {
    for (const key of forbidden) {
      if (key in volume) found.push(key);
    }
  }
  return found;
}
