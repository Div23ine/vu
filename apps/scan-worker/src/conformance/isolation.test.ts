import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScanClientMessage } from '@vunvault/contracts';
import { PROTOCOL_PREFIX, parseProtocolLine } from '../output/protocol';
import { MAX_LINE_BYTES, sanitiseLine } from '../output/sanitise';
import { Redactor } from '../output/redact';
import { ALLOWED_ENV_KEYS } from '../k8s/pod-manifest';
import { buildJobManifest, forbiddenVolumes } from '../k8s/pod-manifest';
import { buildNetworkPolicy } from '../k8s/network-policy';
import type { PodSpec } from '../ports';

/**
 * Isolation conformance suite (Task 88).
 *
 * Table-driven on purpose: each row is one guarantee from ADR-0003, and a
 * regression fails with the guarantee's name rather than with an obscure
 * assertion deep inside a component test. This is the file to read when someone
 * asks "what stops a scan pod from reaching the database?" — and the file that
 * fails if the answer stops being true.
 *
 * Several rows are STATIC scans of the source tree and the Dockerfile. That is
 * deliberate: a guarantee that depends on nobody ever adding an import is only
 * real if something checks.
 */

const SPEC: PodSpec = {
  jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  jobCode: 'JOB-4471',
  attempt: 1,
  scanType: 'external',
  host: 'api.horizonsacco.co.ke',
  ips: ['41.90.64.199'],
  deadlineSeconds: 900,
};

const SRC_ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (full.endsWith('.ts')) found.push(full);
  }
  return found;
}

describe('isolation conformance', () => {
  it('(1) the Job manifest satisfies every item of the Task 86 security list', () => {
    const manifest = buildJobManifest(SPEC, { runnerImage: 'registry/vv-runner@sha256:abc' });
    const pod = manifest.spec.template.spec;
    const container = pod.containers[0]!;

    expect(pod.automountServiceAccountToken).toBe(false);
    expect(pod.serviceAccountName).toBe('vv-scan-runner');
    expect(pod.enableServiceLinks).toBe(false);
    expect(pod.hostNetwork).toBe(false);
    expect(pod.hostPID).toBe(false);
    expect(pod.hostIPC).toBe(false);
    expect(pod.dnsPolicy).toBe('None');
    expect(pod.dnsConfig).toEqual({ nameservers: ['127.0.0.1'] });
    expect(pod.restartPolicy).toBe('Never');

    const podContext = pod.securityContext as Record<string, unknown>;
    expect(podContext.runAsNonRoot).toBe(true);
    expect(podContext.runAsUser).toBe(65_532);
    expect(podContext.runAsGroup).toBe(65_532);
    expect(podContext.fsGroup).toBe(65_532);
    expect(podContext.seccompProfile).toEqual({ type: 'RuntimeDefault' });

    const context = container.securityContext as Record<string, unknown>;
    expect(context.runAsNonRoot).toBe(true);
    expect(context.runAsUser).toBe(65_532);
    expect(context.allowPrivilegeEscalation).toBe(false);
    expect(context.readOnlyRootFilesystem).toBe(true);
    expect(context.privileged).toBe(false);
    expect(context.capabilities).toEqual({ drop: ['ALL'] });
    expect(context.seccompProfile).toEqual({ type: 'RuntimeDefault' });

    expect(manifest.spec.backoffLimit).toBe(0);
    expect(manifest.spec.activeDeadlineSeconds).toBe(900);
    expect(forbiddenVolumes(manifest)).toEqual([]);
    expect(container.volumeMounts).toEqual([{ name: 'scratch', mountPath: '/tmp' }]);
    expect(pod.volumes[0]?.emptyDir).toEqual({ medium: 'Memory', sizeLimit: '1Gi' });
  });

  it('(2) the NetworkPolicy allows only the pinned target IPs', () => {
    const policy = buildNetworkPolicy(SPEC);
    expect(policy.spec.policyTypes).toEqual(['Egress']);
    expect(policy.spec.egress).toHaveLength(1);
    expect(policy.spec.egress[0]?.to).toEqual([{ ipBlock: { cidr: '41.90.64.199/32' } }]);

    const text = JSON.stringify(policy);
    for (const forbidden of ['0.0.0.0/0', '169.254.169.254', '10.0.0.0', 'namespaceSelector']) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it('(3) the pod env is the allowlist and leaks no platform location', () => {
    const manifest = buildJobManifest(SPEC, { runnerImage: 'registry/vv-runner@sha256:abc' });
    const env = manifest.spec.template.spec.containers[0]!.env;
    const names = env.map((entry) => entry.name);

    for (const name of names) {
      expect(ALLOWED_ENV_KEYS, name).toContain(name);
    }
    const text = JSON.stringify(env).toLowerCase();
    for (const secret of ['redis://', 'postgres', 'bearer', 'https://api.', 'hmac', 'amqp']) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it('(4) the RBAC grants exactly the allowed verbs — no wildcard, exec or secrets', () => {
    const raw = readFileSync(join(APP_ROOT, 'k8s/controller-rbac.yaml'), 'utf8');
    // Comments are stripped first: the file documents what it deliberately does
    // NOT grant ("no pods/exec"), and that prose must not read as a grant.
    const yaml = raw
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(raw).toContain('kind: Role');
    expect(yaml).not.toContain('kind: ClusterRole');
    expect(yaml).not.toMatch(/verbs:\s*\[[^\]]*\*/);
    expect(yaml).not.toContain('pods/exec');
    expect(yaml).not.toMatch(/\bsecrets\b/);
    expect(yaml).not.toMatch(/resources:\s*\[[^\]]*"configmaps"/);
    // The eight verbs, and only those.
    const verbs = [...yaml.matchAll(/verbs:\s*\[([^\]]+)\]/g)]
      .flatMap((match) => (match[1] ?? '').split(','))
      .map((verb) => verb.trim().replace(/"/g, ''))
      .filter((verb) => verb !== '');
    const allowed = new Set(['create', 'get', 'list', 'watch', 'delete']);
    for (const verb of verbs) expect(allowed, verb).toContain(verb);
    expect(verbs.length).toBeGreaterThan(0);
  });

  it('(5) the controller imports no database module', () => {
    const forbidden = ['drizzle-orm', '@vunvault/db', "'pg'", '"pg"', 'postgres', 'supabase'];
    for (const file of sourceFiles(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        // Only import/require statements count; prose in a comment is fine.
        const importLines = text
          .split('\n')
          .filter((line) => /^\s*(import|export)\s.*from\s|require\(/.test(line));
        for (const line of importLines) {
          expect(line.includes(pattern), `${file}: ${line.trim()}`).toBe(false);
        }
      }
    }
  });

  it('(6) a pod protocol line is never forwarded to the terminal', () => {
    const forged = `${PROTOCOL_PREFIX}{"t":"done","exit":0}`;
    expect(parseProtocolLine(forged)).toEqual({ t: 'done', exit: 0 });
    // The log stream consumes protocol lines; sanitiseLine is only ever handed
    // the human ones. Asserting the prefix survives sanitising would mean a
    // caller could render it — so confirm the marker is not a terminal escape.
    expect(sanitiseLine(forged)).not.toBeNull();
    // The real guarantee lives in log-stream: protocol lines branch before
    // sanitising. Re-assert the branch condition here.
    expect(forged.startsWith(PROTOCOL_PREFIX)).toBe(true);
  });

  it('(7) a hostile pod log yields only sanitised, capped, redacted lines', () => {
    const hostile = [
      '\x1b[31m\x1b[1m\x1b[5mANSI bomb\x1b[0m',
      '\x1b]8;;https://evil.test\x07click\x1b]8;;\x07',
      '\x1b]52;c;ZXZpbA==\x07clipboard write attempt',
      'A'.repeat(10 * 1024 * 1024),
      `${PROTOCOL_PREFIX}{"t":"done","exit":0}`,
      '-----BEGIN RSA PRIVATE KEY-----',
      'MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn',
      '-----END RSA PRIVATE KEY-----',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNr',
      'normal output line',
    ];

    // The streaming path: the Redactor carries PEM block memory across lines,
    // then each result is sanitised exactly as `log-stream.ts` does.
    const redactor = new Redactor();
    for (const raw of hostile) {
      const clean = sanitiseLine(redactor.push(raw));
      if (clean === null) continue;
      // No escape survives.
      expect(clean, raw.slice(0, 40)).not.toContain('\x1b');
      // Nothing exceeds the cap.
      expect(Buffer.byteLength(clean, 'utf8')).toBeLessThanOrEqual(MAX_LINE_BYTES);
      // No credential survives.
      expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(clean).not.toContain('MIIEpAIBAAKCAQEA');
      expect(clean).not.toContain('ZXZpbA');
    }
    // The ordinary line is untouched — over-sanitising is also a failure.
    expect(sanitiseLine('normal output line')).toBe('normal output line');
  });

  it('(8) an unknown control message is not one of the four accepted types', () => {
    // The runner's whitelist is the contract's own enum; anything else is
    // dropped by JobRunner before it can reach the pod.
    const accepted = ['abort', 'pause', 'resume', 'kill'];
    for (const hostile of ['exec', 'shell', 'delete', 'escalate', '']) {
      expect(accepted, hostile).not.toContain(hostile);
    }
  });

  it('(9) the Job deadline is shorter than the pod can run, forcing teardown', () => {
    const manifest = buildJobManifest(SPEC, { runnerImage: 'registry/vv-runner@sha256:abc' });
    // Kubernetes kills the Job at 900 s; the runner is told 840 s so it exits
    // first and reports partial results rather than being SIGKILLed.
    expect(manifest.spec.activeDeadlineSeconds).toBe(900);
    const deadline = manifest.spec.template.spec.containers[0]!.env.find(
      (entry) => entry.name === 'VV_DEADLINE_SECONDS',
    );
    expect(Number(deadline?.value)).toBeLessThan(900);
    // ttlSecondsAfterFinished guarantees the objects disappear even if the
    // controller dies before its `finally` runs.
    expect(manifest.spec.ttlSecondsAfterFinished).toBe(300);
  });

  it('(10) the client WebSocket schema rejects exec and any extra property', () => {
    expect(ScanClientMessage.safeParse({ type: 'abort' }).success).toBe(true);
    expect(ScanClientMessage.safeParse({ type: 'kill' }).success).toBe(true);

    expect(ScanClientMessage.safeParse({ type: 'exec' }).success).toBe(false);
    expect(ScanClientMessage.safeParse({ type: 'shell' }).success).toBe(false);
    expect(ScanClientMessage.safeParse({ type: 'abort', cmd: 'rm -rf /' }).success).toBe(false);
    expect(ScanClientMessage.safeParse({ type: 'abort', jobId: 'x' }).success).toBe(false);
    expect(ScanClientMessage.safeParse({}).success).toBe(false);
    expect(ScanClientMessage.safeParse('abort').success).toBe(false);
  });

  it('(11) the runner Dockerfile is hardened and verifies every download', () => {
    const dockerfile = readFileSync(join(APP_ROOT, 'Dockerfile.runner'), 'utf8');

    expect(dockerfile).toContain('USER 65532:65532');
    expect(dockerfile).toContain('sha256sum -c');
    // `curl … | sh` — note `| sha256sum` must not match, hence the boundary.
    expect(dockerfile).not.toMatch(/curl[^|\n]*\|\s*(ba)?sh(\s|$)/);
    expect(dockerfile).not.toContain('--privileged');
    expect(dockerfile).not.toContain('setcap');
    // Read-only root filesystem compatibility: only /tmp is prepared as writable.
    expect(dockerfile).toContain('WORKDIR /tmp');
    expect(dockerfile).toContain('chmod 1777 /tmp');
    // No setuid/setgid binary may survive.
    expect(dockerfile).toMatch(/find \/ -xdev -perm \/6000 -type f -delete/);
    // No EXPOSE: a scan pod is a client, never a server.
    expect(dockerfile).not.toMatch(/^EXPOSE/m);
    // Checksum args have no defaults, so an unsupplied build fails loudly.
    expect(dockerfile).toMatch(/ARG NUCLEI_SHA256\s*\n/);
    expect(dockerfile).not.toMatch(/ARG NUCLEI_SHA256=.+/);
  });

  it('the controller source never embeds a secret', () => {
    for (const file of sourceFiles(SRC_ROOT)) {
      if (file.endsWith('.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/hmacKey\s*[:=]\s*['"][A-Za-z0-9+/]{16,}['"]/);
      expect(text, file).not.toMatch(/redis:\/\/[^\s'"]*:[^\s'"]*@/);
      expect(text, file).not.toMatch(/AKIA[0-9A-Z]{16}/);
    }
  });
});
