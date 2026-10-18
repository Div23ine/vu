import { describe, expect, it } from 'vitest';
import type { PodSpec } from '../ports.js';
import {
  FORBIDDEN_CIDRS,
  allowedIpBlocks,
  buildNetworkPolicy,
  networkPolicyName,
} from './network-policy.js';

/**
 * NetworkPolicy tests (Task 86).
 *
 * The policy is an allowlist, so the meaningful assertions are about what is
 * ABSENT: no DNS, no cluster CIDR, no metadata address, no ingress. A policy
 * that accidentally permitted `0.0.0.0/0` would look almost identical to a
 * correct one in a diff, which is why the destination set is compared exactly.
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

describe('buildNetworkPolicy — shape', () => {
  it('selects exactly this scan pod by job id', () => {
    const policy = buildNetworkPolicy(SPEC);
    expect(policy.spec.podSelector).toEqual({ matchLabels: { 'vv/job-id': SPEC.jobId } });
  });

  it('is egress-only, in the scan namespace', () => {
    const policy = buildNetworkPolicy(SPEC);
    expect(policy.apiVersion).toBe('networking.k8s.io/v1');
    expect(policy.kind).toBe('NetworkPolicy');
    expect(policy.metadata.namespace).toBe('vv-scans');
    expect(policy.spec.policyTypes).toEqual(['Egress']);
  });

  it('is named after the job and attempt', () => {
    expect(buildNetworkPolicy(SPEC).metadata.name).toBe('vv-scan-job-4471-a1-egress');
    expect(networkPolicyName('JOB-4471', 2)).toBe('vv-scan-job-4471-a2-egress');
  });

  it('stays inside the 63-character DNS limit for a long job code', () => {
    const name = networkPolicyName('JOB-' + 'X'.repeat(200), 12);
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name.endsWith('-egress')).toBe(true);
  });
});

describe('buildNetworkPolicy — the allowlist', () => {
  it('allows one /32 per pinned IP and nothing else', () => {
    const policy = buildNetworkPolicy(SPEC);
    expect(policy.spec.egress).toHaveLength(1);
    expect(policy.spec.egress[0]?.to).toEqual([
      { ipBlock: { cidr: '41.90.64.199/32' } },
      { ipBlock: { cidr: '41.90.64.200/32' } },
    ]);
  });

  it('carries no port restriction — a scanner probes many ports', () => {
    const serialised = JSON.stringify(buildNetworkPolicy(SPEC).spec.egress);
    expect(serialised).not.toContain('"port"');
    expect(serialised).not.toContain('"ports"');
  });

  it('never allows DNS, a cluster CIDR or the metadata address', () => {
    const serialised = JSON.stringify(buildNetworkPolicy(SPEC));
    expect(serialised).not.toContain('0.0.0.0/0');
    expect(serialised).not.toContain('169.254.169.254');
    expect(serialised).not.toContain('10.0.0.0');
    expect(serialised).not.toContain('namespaceSelector');
    expect(serialised).not.toContain('podSelector: {}');
    // Only ipBlock peers exist.
    for (const rule of buildNetworkPolicy(SPEC).spec.egress) {
      for (const peer of rule.to) {
        expect(Object.keys(peer)).toEqual(['ipBlock']);
      }
    }
  });

  it('allows no egress at all when nothing was pinned', () => {
    const policy = buildNetworkPolicy({ ...SPEC, ips: [] });
    expect(policy.spec.egress).toEqual([]);
  });
});

describe('buildNetworkPolicy — CIDR targets', () => {
  const CIDR_SPEC: PodSpec = { ...SPEC, ips: [], cidr: '93.184.216.0/24' };

  it('allows the range minus every forbidden block', () => {
    const blocks = allowedIpBlocks(CIDR_SPEC);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.cidr).toBe('93.184.216.0/24');
    expect(blocks[0]?.except).toEqual([...FORBIDDEN_CIDRS]);
  });

  it('excludes the metadata address and all private space', () => {
    const except = allowedIpBlocks(CIDR_SPEC)[0]?.except ?? [];
    for (const required of [
      '169.254.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '127.0.0.0/8',
      '0.0.0.0/8',
      '224.0.0.0/4',
      '240.0.0.0/4',
      '255.255.255.255/32',
    ]) {
      expect(except, required).toContain(required);
    }
  });

  it('the forbidden list matches the target guard', () => {
    // 15 ranges, the same set Task 84 classifies against.
    expect(FORBIDDEN_CIDRS).toHaveLength(15);
    expect(FORBIDDEN_CIDRS).toContain('100.64.0.0/10');
    expect(FORBIDDEN_CIDRS).toContain('198.18.0.0/15');
  });
});
