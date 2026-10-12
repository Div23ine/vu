import type { RunnerEnv, ScanType } from './env';

/**
 * Scan plans (Task 87).
 *
 * Every argv here is a FIXED flag list. The only values interpolated are the
 * target (already validated by `env.ts` and again by `exec.ts`) and numeric
 * limits this module chooses. No user-controlled string ever lands in a flag
 * position, and nothing is built by concatenating into a shell string — there
 * is no shell.
 *
 * What is deliberately absent:
 *  - **No `-sS` and no `-O`.** A SYN scan and OS detection need `CAP_NET_RAW`,
 *    which the pod does not have (`capabilities: drop ALL`). Connect scans
 *    (`-sT`) work unprivileged.
 *  - **No `--script` with arbitrary names.** The NSE is a Lua interpreter; a
 *    script name from a target's banner would be code execution.
 *  - **No `-iL`.** A file input would let the target list decide what to scan.
 *  - **No intrusive nuclei tags.** `-etags dos,bruteforce,intrusive,fuzz` is
 *    appended to EVERY nuclei invocation, so a plan cannot forget it.
 *  - **No out-of-band interaction.** `-ni` disables interactsh, because a
 *    callback to a third party would be an unauthorised egress path.
 */

/** Absolute binary paths — never resolved through `PATH` at runtime. */
export const TOOL_PATHS = {
  nmap: '/usr/bin/nmap',
  nuclei: '/usr/local/bin/nuclei',
  httpx: '/usr/local/bin/httpx',
  testssl: '/opt/testssl/testssl.sh',
} as const;

export type ToolName = keyof typeof TOOL_PATHS;

/** Tags nuclei must never run, appended to every invocation. */
export const NUCLEI_EXCLUDED_TAGS = ['dos', 'bruteforce', 'intrusive', 'fuzz'] as const;

/** Progress weights per step, so `pct` advances predictably. */
export const STEP_WEIGHTS: Record<string, number> = {
  httpx: 10,
  nmap: 35,
  testssl: 15,
  nuclei: 40,
};

export type StepKind = 'httpx' | 'nmap' | 'testssl' | 'nuclei';

export interface PlanStep {
  kind: StepKind;
  tool: ToolName;
  bin: string;
  argv: string[];
  /** Relative weight for the progress calculation. */
  weight: number;
  /** A human phase name for the narrative and the `phase` event. */
  phase: string;
  /**
   * Steps that only make sense once an earlier step has told us something
   * (testssl needs port 443 open; per-port nuclei needs an open web port).
   */
  when?: 'port_443_open' | 'web_ports_open';
}

export interface Plan {
  steps: PlanStep[];
  /** A `[~]` line the runner prints before starting, if the plan has a caveat. */
  notices: string[];
  totalWeight: number;
}

/** httpx probes the web surface first — cheap, and it tells nmap nothing. */
function httpxStep(target: string): PlanStep {
  return {
    kind: 'httpx',
    tool: 'httpx',
    bin: TOOL_PATHS.httpx,
    argv: [
      '-json',
      '-silent',
      '-status-code',
      '-title',
      '-tech-detect',
      '-follow-redirects',
      '-timeout',
      '8',
      '-rl',
      '30',
      '-u',
      target,
    ],
    weight: STEP_WEIGHTS.httpx ?? 10,
    phase: 'Web surface discovery',
  };
}

/** TCP connect scan only — unprivileged, and no OS detection. */
function nmapStep(targets: string[], topPorts: number, hostTimeout: string): PlanStep {
  return {
    kind: 'nmap',
    tool: 'nmap',
    bin: TOOL_PATHS.nmap,
    argv: [
      '-sT',
      '-Pn',
      '-n',
      '--top-ports',
      String(topPorts),
      '-sV',
      '--version-light',
      '--max-rate',
      '100',
      '--host-timeout',
      hostTimeout,
      '-oX',
      '-',
      ...targets,
    ],
    weight: STEP_WEIGHTS.nmap ?? 35,
    phase: 'Port and service scan',
  };
}

function testsslStep(hostPort: string): PlanStep {
  return {
    kind: 'testssl',
    tool: 'testssl',
    bin: TOOL_PATHS.testssl,
    // JSON goes to /tmp — the only writable path in the pod.
    argv: ['--jsonfile-pretty', '/tmp/testssl.json', '--fast', '--warnings', 'off', hostPort],
    weight: STEP_WEIGHTS.testssl ?? 15,
    phase: 'TLS configuration review',
    when: 'port_443_open',
  };
}

function nucleiStep(urls: string[], tags: string[]): PlanStep {
  const argv: string[] = [];
  for (const url of urls) {
    argv.push('-u', url);
  }
  argv.push(
    '-jsonl',
    '-silent',
    '-severity',
    'critical,high,medium,low',
    '-tags',
    tags.join(','),
    '-etags',
    NUCLEI_EXCLUDED_TAGS.join(','),
    '-rl',
    '50',
    '-c',
    '10',
    '-timeout',
    '10',
    '-retries',
    '0',
    '-duc',
    '-ni',
    '-no-update-templates',
    '-t',
    '/opt/nuclei-templates',
  );
  return {
    kind: 'nuclei',
    tool: 'nuclei',
    bin: TOOL_PATHS.nuclei,
    argv,
    weight: STEP_WEIGHTS.nuclei ?? 40,
    phase: 'Vulnerability template scan',
  };
}

const EXTERNAL_TAGS = ['cve', 'exposure', 'misconfig', 'tech', 'default-login', 'takeover'];
const API_TAGS = ['api', 'swagger', 'graphql', 'jwt', 'cors', 'exposure', 'misconfig', 'cve'];
const NETWORK_TAGS = ['cve', 'exposure', 'misconfig', 'default-login'];

/** At most this many URLs are handed to one nuclei invocation. */
export const MAX_NUCLEI_URLS = 20;

/**
 * The ordered steps for a scan type.
 *
 * `internal` and `network` plans are built here for completeness, but Task 84's
 * target guard only ever lets a PUBLIC address through — the cloud-hosted
 * cluster cannot reach a customer's private network.
 * DECISION(v1): internal-network scans need a customer-side agent (future).
 */
export function planFor(scanType: ScanType, env: RunnerEnv): Plan {
  const host = env.targetHost;
  const httpsUrl = `https://${host}`;

  switch (scanType) {
    case 'external':
      return build([
        httpxStep(host),
        nmapStep(env.targetIps.length > 0 ? env.targetIps : [host], 200, '300s'),
        testsslStep(`${host}:443`),
        nucleiStep([httpsUrl], EXTERNAL_TAGS),
      ]);

    case 'api':
      return build([httpxStep(host), nucleiStep([httpsUrl], API_TAGS)]);

    case 'mobile':
      return {
        ...build([httpxStep(host), nucleiStep([httpsUrl], API_TAGS)]),
        // The app binaries are not analysed in v1; say so rather than imply
        // coverage the scan does not have.
        notices: ['[~] Mobile package analysis is not available; scanning the API surface only.'],
      };

    case 'internal':
    case 'network': {
      const targets = env.targetCidr !== null ? [env.targetCidr] : env.targetIps;
      return build([nmapStep(targets.length > 0 ? targets : [host], 1000, '120s')]);
    }
  }
}

/**
 * The per-open-web-port nuclei steps for a network scan.
 *
 * Built after nmap, because the URLs depend on what was actually open, and
 * capped at `MAX_NUCLEI_URLS` so a /24 of web servers cannot turn into a
 * thousand template runs.
 */
export function nucleiStepsForWebPorts(urls: readonly string[]): PlanStep[] {
  if (urls.length === 0) return [];
  return [nucleiStep([...urls].slice(0, MAX_NUCLEI_URLS), NETWORK_TAGS)];
}

function build(steps: PlanStep[]): Plan {
  return {
    steps,
    notices: [],
    totalWeight: steps.reduce((sum, step) => sum + step.weight, 0),
  };
}

/** The cumulative percentage once `completedWeight` of the plan has run. */
export function progressPercent(plan: Plan, completedWeight: number): number {
  if (plan.totalWeight <= 0) return 0;
  // Never 100: `complete` is what moves a job to 100, not the runner.
  return Math.max(0, Math.min(99, Math.round((completedWeight / plan.totalWeight) * 100)));
}
