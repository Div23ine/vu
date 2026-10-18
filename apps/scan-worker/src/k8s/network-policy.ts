import type { PodSpec } from '../ports.js';
import { SCAN_NAMESPACE, jobResourceName } from './pod-manifest.js';

/**
 * Per-job egress NetworkPolicy (Task 86).
 *
 * One policy per scan, created BEFORE the Job and deleted in `finally`. Combined
 * with the namespace's default-deny policy, the effect is that a scan pod can
 * reach exactly one thing: the addresses the controller pinned when it
 * authorised the scan.
 *
 * What is deliberately ABSENT matters more than what is present:
 *  - **No DNS egress.** The pod has `dnsPolicy: None` and a dead nameserver, and
 *    resolving a name would need port 53 to something. A target cannot make the
 *    pod call home to look a name up.
 *  - **No cluster CIDRs.** Not the pod CIDR, not the service CIDR, not the node
 *    network. The API, Redis and the database are all unreachable.
 *  - **No metadata IP.** `169.254.169.254` is the classic way out of a
 *    compromised workload into the cloud account; it is excluded twice — once by
 *    never appearing in an allow rule, and again in the `except` list below.
 *  - **All ports on the target**, because a scanner probes many ports. Widening
 *    the destination would defeat the purpose; widening the port range does not.
 *
 * For a CIDR target the allowed block carries an `except` list of every
 * forbidden range from Task 84, so a customer-supplied range that happens to
 * overlap private or link-local space cannot smuggle it in. That is defence in
 * depth: `target-guard` already refuses such a range before a pod exists.
 */

/**
 * The ranges a scan must never reach, as CIDRs.
 *
 * The same list `target-guard.ts` classifies against, expressed as strings so
 * Kubernetes can consume it directly. `169.254.0.0/16` includes the cloud
 * metadata address; `255.255.255.255/32` is the broadcast address.
 */
export const FORBIDDEN_CIDRS: readonly string[] = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
] as const;

export interface IpBlock {
  cidr: string;
  except?: string[];
}

export interface NetworkPolicyManifest {
  apiVersion: 'networking.k8s.io/v1';
  kind: 'NetworkPolicy';
  metadata: { name: string; namespace: string; labels: Record<string, string> };
  spec: {
    podSelector: { matchLabels: Record<string, string> };
    policyTypes: ['Egress'];
    egress: { to: { ipBlock: IpBlock }[] }[];
  };
}

/** `vv-scan-job-4471-a1-egress` — the policy that belongs to one Job. */
export function networkPolicyName(jobCode: string, attempt: number): string {
  // The Job name is already DNS-1123 and length-checked; `-egress` is 7 chars,
  // so re-trim to stay inside the 63-character limit.
  const base = jobResourceName(jobCode, attempt);
  const suffix = '-egress';
  return base.length + suffix.length > 63
    ? `${base.slice(0, 63 - suffix.length)}${suffix}`
    : `${base}${suffix}`;
}

/**
 * The allow-list for one scan.
 *
 * A hostname target yields one `/32` per pinned IP. A CIDR target yields the
 * range itself, minus every forbidden block — Kubernetes applies `except` as a
 * subtraction from `cidr`, so overlapping private space is carved out even if a
 * caller passes a range that contains it.
 */
export function allowedIpBlocks(spec: PodSpec): IpBlock[] {
  if (spec.cidr !== undefined) {
    return [{ cidr: spec.cidr, except: [...FORBIDDEN_CIDRS] }];
  }
  return spec.ips.map((ip) => ({ cidr: `${ip}/32` }));
}

export function buildNetworkPolicy(spec: PodSpec): NetworkPolicyManifest {
  const blocks = allowedIpBlocks(spec);

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: networkPolicyName(spec.jobCode, spec.attempt),
      namespace: SCAN_NAMESPACE,
      labels: {
        'app.kubernetes.io/name': 'vv-scan',
        'vv/job-id': spec.jobId,
        'vv/job-code': spec.jobCode.toLowerCase(),
        'vv/attempt': String(spec.attempt),
      },
    },
    spec: {
      // Selects exactly this scan's pod, and nothing else in the namespace.
      podSelector: { matchLabels: { 'vv/job-id': spec.jobId } },
      // Egress only: ingress is denied by the namespace default-deny policy, and
      // nothing needs to reach a scan pod.
      policyTypes: ['Egress'],
      egress:
        blocks.length === 0
          ? // No pinned addresses means no egress at all. An empty `egress`
            // array would allow NOTHING, which is the correct fail-closed
            // answer for a target we could not resolve.
            []
          : [{ to: blocks.map((ipBlock) => ({ ipBlock })) }],
    },
  };
}
