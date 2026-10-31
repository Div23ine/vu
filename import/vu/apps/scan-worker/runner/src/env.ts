/**
 * Runner environment (Task 87).
 *
 * The pod receives EXACTLY the variables Task 86's manifest passes — no secret,
 * no API URL, no Redis URL, because none of them exist in the pod. Anything
 * missing or malformed is a hard stop: the runner prints the one-line failure
 * the front end expects and exits 2, without echoing what it was given (an env
 * dump would be the first thing an attacker looked for in a scan transcript).
 */

export const INVALID_CONFIG_LINE = '[!] Invalid runner configuration.';
export const INVALID_CONFIG_EXIT = 2;

export const SCAN_TYPES = ['external', 'api', 'internal', 'network', 'mobile'] as const;
export type ScanType = (typeof SCAN_TYPES)[number];

export interface RunnerEnv {
  jobId: string;
  jobCode: string;
  scanType: ScanType;
  targetHost: string;
  /** Pinned addresses — the pod never resolves a name. */
  targetIps: string[];
  targetCidr: string | null;
  deadlineSeconds: number;
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOSTNAME = /^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

function isIpv4(value: string): boolean {
  const match = IPV4.exec(value);
  if (match === null) return false;
  for (let index = 1; index <= 4; index += 1) {
    const octet = Number(match[index]);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return false;
  }
  return true;
}

export interface ParseEnvResult {
  ok: true;
  env: RunnerEnv;
}
export type EnvResult = ParseEnvResult | { ok: false; reason: string };

/**
 * Parse and validate the runner's environment.
 *
 * `reason` is a short internal token for the log; it is NEVER printed to stdout,
 * because the transcript is shown to the client who requested the scan.
 */
export function parseRunnerEnv(
  source: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): EnvResult {
  const jobId = source.VV_JOB_ID ?? '';
  const jobCode = source.VV_JOB_CODE ?? '';
  const scanType = source.VV_SCAN_TYPE ?? '';
  const targetHost = source.VV_TARGET_HOST ?? '';
  const targetIps = source.VV_TARGET_IPS ?? '';
  const deadline = source.VV_DEADLINE_SECONDS ?? '';
  const cidr = source.VV_TARGET_CIDR;

  if (jobId === '') return { ok: false, reason: 'missing_job_id' };
  if (jobCode === '') return { ok: false, reason: 'missing_job_code' };
  if (!SCAN_TYPES.includes(scanType as ScanType)) {
    return { ok: false, reason: 'bad_scan_type' };
  }
  if (targetHost === '') return { ok: false, reason: 'missing_target_host' };

  // The host is checked with the same grammar the controller used. A value that
  // begins with `-` is refused outright: it would be read as a flag by a tool.
  if (targetHost.startsWith('-')) return { ok: false, reason: 'target_looks_like_flag' };
  const host = targetHost.toLowerCase();
  const hostIsCidr = host.includes('/');
  if (hostIsCidr) {
    // A `/` in the host means it claims to be a CIDR — validate it as one
    // rather than assuming. `example.com;rm -rf /` contains a slash and must
    // not be waved through as a range.
    const [address, prefix] = host.split('/');
    if (address === undefined || prefix === undefined) {
      return { ok: false, reason: 'bad_target_host' };
    }
    if (!isIpv4(address) || !/^\d{1,2}$/.test(prefix)) {
      return { ok: false, reason: 'bad_target_host' };
    }
    const bits = Number(prefix);
    if (!Number.isInteger(bits) || bits < 24 || bits > 32) {
      return { ok: false, reason: 'cidr_too_wide' };
    }
  } else if (!isIpv4(host) && !HOSTNAME.test(host)) {
    return { ok: false, reason: 'bad_target_host' };
  }

  const ips = targetIps
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value !== '');
  for (const ip of ips) {
    if (!isIpv4(ip)) return { ok: false, reason: 'bad_target_ip' };
  }
  if (!hostIsCidr && ips.length === 0 && cidr === undefined) {
    // A hostname target must arrive with its pinned addresses.
    return { ok: false, reason: 'no_pinned_ips' };
  }

  if (cidr !== undefined && cidr !== '') {
    const [address, prefix] = cidr.split('/');
    if (address === undefined || prefix === undefined) return { ok: false, reason: 'bad_cidr' };
    if (!isIpv4(address)) return { ok: false, reason: 'bad_cidr' };
    const bits = Number(prefix);
    if (!Number.isInteger(bits) || bits < 24 || bits > 32) {
      return { ok: false, reason: 'cidr_too_wide' };
    }
  }

  const deadlineSeconds = Number(deadline);
  if (!Number.isInteger(deadlineSeconds) || deadlineSeconds <= 0 || deadlineSeconds > 3_600) {
    return { ok: false, reason: 'bad_deadline' };
  }

  return {
    ok: true,
    env: {
      jobId,
      jobCode,
      scanType: scanType as ScanType,
      targetHost: host,
      targetIps: ips,
      targetCidr: cidr === undefined || cidr === '' ? null : cidr,
      deadlineSeconds,
    },
  };
}
