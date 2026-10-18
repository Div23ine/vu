import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PodSpec } from '../ports.js';
import {
  ACTIVE_DEADLINE_SECONDS,
  ALLOWED_ENV_KEYS,
  RUNNER_DEADLINE_SECONDS,
  RUNNER_SERVICE_ACCOUNT,
  RUN_AS_USER,
  SCAN_NAMESPACE,
  buildJobManifest,
  forbiddenVolumes,
  jobResourceName,
} from './pod-manifest.js';

/**
 * Job-manifest tests (Task 86).
 *
 * These run against the GENERATED OBJECT — no cluster, no client library. The
 * manifest is the isolation model, so the security context is asserted field by
 * field from a table: a missing or changed field must fail here rather than be
 * discovered by a pod that runs as root.
 *
 * The RBAC YAML is parsed in this file too, because the Role and the manifest
 * are two halves of one promise: the pod has no token, and the controller cannot
 * exec into it. Neither half holds alone.
 */

const SPEC: PodSpec = {
  jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  jobCode: 'JOB-4471',
  attempt: 1,
  scanType: 'external',
  host: 'api.horizonsacco.co.ke',
  ips: ['41.90.64.199', '41.90.64.200'],
  deadlineSeconds: 900,
};

const ENV = { runnerImage: 'registry.vunvault.test/vv-runner@sha256:abc123' };

function manifest() {
  return buildJobManifest(SPEC, ENV);
}

function podSpec() {
  return manifest().spec.template.spec;
}

function container() {
  const containers = podSpec().containers;
  expect(containers).toHaveLength(1);
  return containers[0]!;
}

describe('buildJobManifest — identity and metadata', () => {
  it('is a batch/v1 Job in the scan namespace', () => {
    const job = manifest();
    expect(job.apiVersion).toBe('batch/v1');
    expect(job.kind).toBe('Job');
    expect(job.metadata.namespace).toBe(SCAN_NAMESPACE);
    expect(SCAN_NAMESPACE).toBe('vv-scans');
  });

  it('carries the four required labels on both the Job and the pod template', () => {
    const job = manifest();
    const expected = {
      'app.kubernetes.io/name': 'vv-scan',
      'vv/job-id': SPEC.jobId,
      'vv/job-code': 'job-4471',
      'vv/attempt': '1',
    };
    expect(job.metadata.labels).toEqual(expected);
    expect(job.spec.template.metadata.labels).toEqual(expected);
  });

  it('names the Job after the job code and attempt', () => {
    expect(manifest().metadata.name).toBe('vv-scan-job-4471-a1');
  });
});

describe('buildJobManifest — job limits', () => {
  it.each([
    ['backoffLimit', 0],
    ['activeDeadlineSeconds', ACTIVE_DEADLINE_SECONDS],
    ['ttlSecondsAfterFinished', 300],
    ['parallelism', 1],
    ['completions', 1],
  ])('spec.%s is %s', (field, value) => {
    expect(manifest().spec[field as 'backoffLimit']).toBe(value);
  });

  it('gives the runner a shorter deadline than the Job', () => {
    expect(RUNNER_DEADLINE_SECONDS).toBe(840);
    expect(RUNNER_DEADLINE_SECONDS).toBeLessThan(ACTIVE_DEADLINE_SECONDS);
    const env = container().env.find((entry) => entry.name === 'VV_DEADLINE_SECONDS');
    expect(env?.value).toBe('840');
  });
});

describe('buildJobManifest — pod security context', () => {
  // Table-driven: every required field, asserted exactly.
  const POD_CONTEXT: readonly [string, unknown][] = [
    ['runAsNonRoot', true],
    ['runAsUser', RUN_AS_USER],
    ['runAsGroup', RUN_AS_USER],
    ['fsGroup', RUN_AS_USER],
  ];

  it.each(POD_CONTEXT)('pod securityContext.%s is %s', (field, value) => {
    const context = podSpec().securityContext as Record<string, unknown>;
    expect(context[field]).toBe(value);
  });

  it('runs as the nonroot user 65532', () => {
    expect(RUN_AS_USER).toBe(65_532);
  });

  it('uses the RuntimeDefault seccomp profile', () => {
    const context = podSpec().securityContext as { seccompProfile: { type: string } };
    expect(context.seccompProfile).toEqual({ type: 'RuntimeDefault' });
  });

  it('does not mount a service account token', () => {
    expect(podSpec().automountServiceAccountToken).toBe(false);
  });

  it('runs under the bound-less runner account', () => {
    expect(podSpec().serviceAccountName).toBe(RUNNER_SERVICE_ACCOUNT);
    expect(RUNNER_SERVICE_ACCOUNT).toBe('vv-scan-runner');
  });

  it('disables service links and every host namespace', () => {
    expect(podSpec().enableServiceLinks).toBe(false);
    expect(podSpec().hostNetwork).toBe(false);
    expect(podSpec().hostPID).toBe(false);
    expect(podSpec().hostIPC).toBe(false);
  });

  it('never restarts and terminates quickly', () => {
    expect(podSpec().restartPolicy).toBe('Never');
    expect(podSpec().terminationGracePeriodSeconds).toBe(10);
  });

  it('is pinned to the dedicated scan pool', () => {
    expect(podSpec().nodeSelector).toEqual({ 'vv/pool': 'scan' });
    expect(podSpec().tolerations).toEqual([
      { key: 'vv/scan', operator: 'Equal', value: 'true', effect: 'NoSchedule' },
    ]);
  });
});

describe('buildJobManifest — container security context', () => {
  const CONTEXT: readonly [string, unknown][] = [
    ['runAsNonRoot', true],
    ['runAsUser', RUN_AS_USER],
    ['allowPrivilegeEscalation', false],
    ['readOnlyRootFilesystem', true],
    ['privileged', false],
  ];

  it.each(CONTEXT)('container securityContext.%s is %s', (field, value) => {
    const context = container().securityContext as Record<string, unknown>;
    expect(context[field]).toBe(value);
  });

  it('drops ALL capabilities', () => {
    const context = container().securityContext as { capabilities: { drop: string[] } };
    expect(context.capabilities.drop).toEqual(['ALL']);
  });

  it('uses RuntimeDefault seccomp', () => {
    const context = container().securityContext as { seccompProfile: { type: string } };
    expect(context.seccompProfile).toEqual({ type: 'RuntimeDefault' });
  });

  it('sets both requests and limits, including ephemeral storage', () => {
    expect(container().resources).toEqual({
      requests: { cpu: '250m', memory: '256Mi', 'ephemeral-storage': '128Mi' },
      limits: { cpu: '1', memory: '1Gi', 'ephemeral-storage': '1Gi' },
    });
  });
});

describe('buildJobManifest — network and volumes', () => {
  it('has no cluster DNS and a dead nameserver', () => {
    expect(podSpec().dnsPolicy).toBe('None');
    expect(podSpec().dnsConfig).toEqual({ nameservers: ['127.0.0.1'] });
  });

  it('pins the target host to each resolved IP through hostAliases', () => {
    expect(podSpec().hostAliases).toEqual([
      { ip: '41.90.64.199', hostnames: [SPEC.host] },
      { ip: '41.90.64.200', hostnames: [SPEC.host] },
    ]);
  });

  it('mounts exactly one tmpfs scratch volume at /tmp', () => {
    expect(podSpec().volumes).toEqual([
      { name: 'scratch', emptyDir: { medium: 'Memory', sizeLimit: '1Gi' } },
    ]);
    expect(container().volumeMounts).toEqual([{ name: 'scratch', mountPath: '/tmp' }]);
  });

  it('has no PVC, hostPath, secret, configMap or projected volume', () => {
    expect(forbiddenVolumes(manifest())).toEqual([]);
    const serialised = JSON.stringify(manifest());
    for (const forbidden of [
      'persistentVolumeClaim',
      'hostPath',
      '"secret"',
      'configMap',
      'projected',
    ]) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it('exposes no ports and overrides no command', () => {
    expect('ports' in container()).toBe(false);
    expect('command' in container()).toBe(false);
    expect('lifecycle' in container()).toBe(false);
    expect(container().args).toEqual([]);
    expect(container().imagePullPolicy).toBe('IfNotPresent');
    expect(container().image).toBe(ENV.runnerImage);
  });
});

describe('buildJobManifest — the environment allowlist', () => {
  it('passes exactly the allowed keys and nothing else', () => {
    const names = container()
      .env.map((entry) => entry.name)
      .sort();
    expect(names).toEqual([...ALLOWED_ENV_KEYS].filter((k) => k !== 'VV_TARGET_CIDR').sort());
  });

  it('carries plain values only — no valueFrom, so no secret can be injected', () => {
    const serialised = JSON.stringify(container().env);
    expect(serialised).not.toContain('valueFrom');
    expect(serialised).not.toContain('secretKeyRef');
    expect(serialised).not.toContain('configMapKeyRef');
    expect(serialised).not.toContain('fieldRef');
  });

  it('never leaks an API, Redis or database location', () => {
    const serialised = JSON.stringify(manifest()).toLowerCase();
    for (const forbidden of ['redis', 'database', 'postgres', 'supabase', 'hmac', 'api_internal']) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it('passes the pinned IPs comma-separated and HOME=/tmp', () => {
    const env = Object.fromEntries(container().env.map((e) => [e.name, e.value]));
    expect(env.VV_TARGET_IPS).toBe('41.90.64.199,41.90.64.200');
    expect(env.VV_TARGET_HOST).toBe(SPEC.host);
    expect(env.HOME).toBe('/tmp');
    expect(env.VV_JOB_ID).toBe(SPEC.jobId);
    expect(env.VV_JOB_CODE).toBe('JOB-4471');
  });

  it('adds VV_TARGET_CIDR only for a CIDR target', () => {
    expect(container().env.some((e) => e.name === 'VV_TARGET_CIDR')).toBe(false);

    const cidr = buildJobManifest({ ...SPEC, ips: [], cidr: '93.184.216.0/24' }, ENV);
    const env = Object.fromEntries(
      cidr.spec.template.spec.containers[0]!.env.map((e) => [e.name, e.value]),
    );
    expect(env.VV_TARGET_CIDR).toBe('93.184.216.0/24');
    expect(env.VV_TARGET_IPS).toBe('');
  });
});

describe('jobResourceName — DNS-1123 safety', () => {
  it('lower-cases and keeps the attempt suffix', () => {
    expect(jobResourceName('JOB-4471', 3)).toBe('vv-scan-job-4471-a3');
  });

  it('stays within 63 characters for a long job code', () => {
    const name = jobResourceName('JOB-' + 'X'.repeat(200), 12);
    expect(name.length).toBeLessThanOrEqual(63);
    // The attempt suffix must survive truncation, or two attempts collide.
    expect(name.endsWith('-a12')).toBe(true);
  });

  it('produces a valid DNS-1123 subdomain for awkward codes', () => {
    const dns1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    for (const code of ['JOB-4471', 'job_4471', 'JOB 4471!!', 'JOB--4471', 'A'.repeat(120)]) {
      const name = jobResourceName(code, 1);
      expect(name.length, code).toBeLessThanOrEqual(63);
      expect(dns1123.test(name), name).toBe(true);
    }
  });
});

describe('controller-rbac.yaml — the verb allowlist', () => {
  const yaml = readFileSync(
    fileURLToPath(new URL('../../k8s/controller-rbac.yaml', import.meta.url)),
    'utf8',
  );

  /**
   * A minimal reader for the `rules:` block.
   *
   * The YAML is committed and stable, and Task 86 allows no new dependency, so
   * the verbs are extracted with a focused line scan rather than a parser. It
   * reads each `- apiGroups:` / `resources:` / `verbs:` triple in order.
   */
  function rulesOf(text: string): { apiGroups: string[]; resources: string[]; verbs: string[] }[] {
    const rules: { apiGroups: string[]; resources: string[]; verbs: string[] }[] = [];
    let current: { apiGroups: string[]; resources: string[]; verbs: string[] } | null = null;
    let field: 'apiGroups' | 'resources' | 'verbs' | null = null;

    const inlineList = (value: string): string[] =>
      value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
        .filter((entry) => entry !== '');

    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/#.*$/, '');
      const ruleStart = /^\s*-\s+apiGroups:\s*(.*)$/.exec(line);
      if (ruleStart !== null) {
        current = { apiGroups: inlineList(ruleStart[1] ?? ''), resources: [], verbs: [] };
        rules.push(current);
        field = 'apiGroups';
        continue;
      }
      const groupContinuation = /^\s+(-\s+)?"?([\w./-]+)"?,?\s*$/.exec(line);
      const resourcesMatch = /^\s+resources:\s*(.*)$/.exec(line);
      const verbsMatch = /^\s+verbs:\s*(.*)$/.exec(line);
      if (resourcesMatch !== null) {
        field = 'resources';
        if (current !== null) current.resources = inlineList(resourcesMatch[1] ?? '');
        continue;
      }
      if (verbsMatch !== null) {
        field = 'verbs';
        if (current !== null) current.verbs = inlineList(verbsMatch[1] ?? '');
        continue;
      }
      if (groupContinuation !== null && current !== null && field === 'apiGroups') {
        const value = groupContinuation[2];
        if (value !== undefined && !current.apiGroups.includes(value)) {
          current.apiGroups.push(value);
        }
      }
    }
    return rules;
  }

  const rules = rulesOf(yaml);

  it('grants exactly the documented rules', () => {
    const granted = rules
      .map(
        (rule) =>
          `${rule.apiGroups.join('|')}:${rule.resources.join('|')}=${rule.verbs.sort().join(',')}`,
      )
      .sort();
    expect(granted).toEqual(
      [
        'batch:jobs=create,delete,get,list,watch',
        ':pods=get,list,watch',
        ':pods/log=get',
        'networking.k8s.io:networkpolicies=create,delete,get,list',
      ].sort(),
    );
  });

  it('uses no wildcard anywhere', () => {
    expect(yaml).not.toMatch(/verbs:\s*\[[^\]]*\*/);
    expect(yaml).not.toMatch(/resources:\s*\[[^\]]*\*/);
    expect(yaml).not.toMatch(/apiGroups:\s*\[[^\]]*\*/);
    for (const rule of rules) {
      for (const verb of rule.verbs) expect(verb).not.toBe('*');
      for (const resource of rule.resources) expect(resource).not.toBe('*');
    }
  });

  it('grants no pods/exec, no secrets and no configmaps', () => {
    const allResources = rules.flatMap((rule) => rule.resources);
    const allVerbs = rules.flatMap((rule) => rule.verbs);
    expect(allResources).not.toContain('pods/exec');
    expect(allResources).not.toContain('secrets');
    expect(allResources).not.toContain('configmaps');
    expect(allVerbs).not.toContain('*');
  });

  it('is namespaced only — no ClusterRole', () => {
    expect(yaml).toContain('kind: Role');
    expect(yaml).toContain('kind: RoleBinding');
    expect(yaml).not.toContain('kind: ClusterRole');
    expect(yaml).not.toContain('kind: ClusterRoleBinding');
  });

  it('gives the runner account no token and no bindings', () => {
    expect(yaml).toContain('name: vv-scan-runner');
    expect(yaml).toMatch(/name: vv-scan-runner[\s\S]*?automountServiceAccountToken: false/);
    // The only RoleBinding subject is the controller.
    const bindingSubjects = yaml.slice(yaml.indexOf('kind: RoleBinding'));
    expect(bindingSubjects).toContain('name: vv-scan-controller');
    expect(bindingSubjects).not.toContain('name: vv-scan-runner');
  });
});

describe('the namespace and default-deny manifests', () => {
  const namespace = readFileSync(
    fileURLToPath(new URL('../../k8s/namespace.yaml', import.meta.url)),
    'utf8',
  );
  const deny = readFileSync(
    fileURLToPath(new URL('../../k8s/default-deny-networkpolicy.yaml', import.meta.url)),
    'utf8',
  );

  it('enforces the restricted Pod Security profile', () => {
    expect(namespace).toContain('pod-security.kubernetes.io/enforce: restricted');
    expect(namespace).toContain('pod-security.kubernetes.io/enforce-version: latest');
    expect(namespace).toContain('pod-security.kubernetes.io/audit: restricted');
    expect(namespace).toContain('pod-security.kubernetes.io/warn: restricted');
    expect(namespace).toContain('name: vv-scans');
  });

  it('denies both directions for every pod', () => {
    expect(deny).toContain('- Ingress');
    expect(deny).toContain('- Egress');
    expect(deny).toMatch(/podSelector:\s*\{\}/);
    expect(deny).toContain('namespace: vv-scans');
  });
});
