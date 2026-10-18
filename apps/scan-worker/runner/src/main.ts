import { INVALID_CONFIG_EXIT, INVALID_CONFIG_LINE, parseRunnerEnv, type RunnerEnv } from './env.js';
import { PREFIX, createEmitter } from './emit.js';
import { progressPercent, planFor, nucleiStepsForWebPorts, type PlanStep } from './plan.js';
import { runTool, type ToolOutcome } from './exec.js';
import { parseNmapXml, isPortOpen, webPortUrls, type NmapParseResult } from './adapters/nmap.js';
import { parseHttpxOutput } from './adapters/httpx.js';
import { parseNucleiOutput } from './adapters/nuclei.js';
import { parseTestsslJson } from './adapters/testssl.js';
import type { Severity } from './emit.js';

/**
 * Runner entrypoint (Task 87) — the program inside the unprivileged pod.
 *
 * Exit codes are the contract with the controller: `0` when every step ran (a
 * step that found nothing still counts as finished), `1` when the plan could not
 * run at all, `124` when the runner hit its own deadline, `2` for a bad
 * configuration. The controller reads the code from the pod's terminated state,
 * never from stdout, so a target cannot talk its way into a success.
 *
 * The deadline is enforced HERE as well as by Kubernetes, and it is checked at
 * each tool boundary: each tool's timeout is shrunk to the time remaining, so a
 * long nmap cannot consume the window nuclei needed. On expiry the current tool
 * is killed, partial results are reported, and the exit is 124.
 *
 * Nothing in this file prints an environment variable, a full command line or a
 * stack trace — the transcript is shown to the customer.
 */

const EXIT_OK = 0;
const EXIT_PLAN_FAILED = 1;
const EXIT_DEADLINE = 124;

/** testssl writes JSON to /tmp; this is the path it is told to use. */
const TESTSSL_JSON_PATH = '/tmp/testssl.json';

interface Counters {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

function emptyCounters(): Counters {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

function count(counters: Counters, severity: Severity): void {
  if (severity === 'info') return;
  counters[severity] += 1;
}

export interface MainDeps {
  /** Test seam: replace tool execution and the clock. */
  runToolImpl?: typeof runTool;
  now?: () => number;
  readFile?: (path: string) => Promise<string>;
  out?: { write(chunk: string): void };
}

export async function main(deps: MainDeps = {}): Promise<number> {
  const emitter = createEmitter(deps.out === undefined ? {} : { out: deps.out });
  const now = deps.now ?? (() => Date.now());
  const runToolImpl = deps.runToolImpl ?? runTool;

  const parsed = parseRunnerEnv();
  if (!parsed.ok) {
    // One line, no detail: the transcript is client-facing.
    emitter.say(INVALID_CONFIG_LINE);
    return INVALID_CONFIG_EXIT;
  }
  const env = parsed.env;

  const startedAt = now();
  const deadlineAt = startedAt + env.deadlineSeconds * 1_000;

  emitter.say(`$ vunvault-scan --target ${env.targetHost} --mode ${env.scanType}`);
  emitter.say(
    `${PREFIX.info} Resolving target (pinned): ${
      env.targetCidr ?? (env.targetIps.length > 0 ? env.targetIps.join(', ') : env.targetHost)
    }`,
  );

  const plan = planFor(env.scanType, env);
  for (const notice of plan.notices) emitter.say(notice);
  if (plan.steps.length === 0) {
    emitter.say(`${PREFIX.warn} No scan steps apply to this target.`);
    return EXIT_PLAN_FAILED;
  }

  const counters = emptyCounters();
  const collected: string[] = [];
  let completedWeight = 0;
  let nmapResult: NmapParseResult | null = null;
  let deadlineHit = false;

  const steps: PlanStep[] = [...plan.steps];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (step === undefined) break;

    // The deadline is checked at every tool boundary.
    const remaining = deadlineAt - now();
    if (remaining <= 0) {
      deadlineHit = true;
      break;
    }

    // Conditional steps only run when an earlier step earned them.
    if (step.when === 'port_443_open' && !(nmapResult !== null && isPortOpen(nmapResult, 443))) {
      emitter.say(`${PREFIX.muted} Skipping TLS review — port 443 was not open.`);
      completedWeight += step.weight;
      continue;
    }

    emitter.phase(step.phase);
    emitter.progress(progressPercent(plan, completedWeight), estimateEta(startedAt, now()));

    const buffer: string[] = [];
    const stepStarted = now();
    const outcome: ToolOutcome = await runToolImpl({
      bin: step.bin,
      argv: step.argv,
      timeoutMs: Math.max(1_000, remaining),
      onStdoutLine: (line) => {
        buffer.push(line);
      },
      targets: targetArgs(env),
    });

    const elapsed = Math.max(1, Math.round((now() - stepStarted) / 1_000));

    if (outcome.kind === 'rejected') {
      emitter.say(`${PREFIX.warn} ${step.kind} could not run.`);
      completedWeight += step.weight;
      continue;
    }
    if (outcome.kind === 'timeout') {
      emitter.say(`${PREFIX.warn} ${step.kind} timed out — partial results kept.`);
    } else if (outcome.kind === 'output_limit') {
      emitter.say(`${PREFIX.warn} ${step.kind} produced too much output and was stopped.`);
    }

    // Feed the step's output to its parser.
    const parsedStep = parseStep(step, buffer);
    if (parsedStep.nmap !== null) nmapResult = parsedStep.nmap;

    for (const line of parsedStep.lines) {
      collected.push(line);
      emitter.say(line);
    }
    for (const finding of parsedStep.findings) {
      count(counters, finding.severity);
      emitter.finding({
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        ...(finding.cwe === undefined ? {} : { cwe: finding.cwe }),
        ...(finding.cvss === undefined ? {} : { cvss: finding.cvss }),
        ...(finding.remediation === undefined ? {} : { remediation: finding.remediation }),
        ...(finding.matchedAt === undefined ? {} : { evidence: finding.matchedAt }),
      });
    }

    emitter.say(`${PREFIX.ok} ${step.kind} finished in ${elapsed} s`);
    completedWeight += step.weight;
    emitter.progress(progressPercent(plan, completedWeight), estimateEta(startedAt, now()));

    // A network scan runs nuclei once per open web port, discovered by nmap.
    if (step.kind === 'nmap' && (env.scanType === 'internal' || env.scanType === 'network')) {
      const urls = webPortUrls(nmapResult ?? { ports: [], lines: [], findings: [] });
      const extra = nucleiStepsForWebPorts(urls);
      steps.splice(index + 1, 0, ...extra);
    }

    if (outcome.kind === 'timeout' || outcome.kind === 'output_limit') {
      // A tool that had to be killed is a warning, not the end of the scan.
      if (outcome.kind === 'timeout' && now() >= deadlineAt) {
        deadlineHit = true;
        break;
      }
    }
    // testssl's findings live in the JSON file, not on stdout.
    if (step.kind === 'testssl') {
      const json = deps.readFile === undefined ? '' : await deps.readFile(TESTSSL_JSON_PATH);
      const testssl = parseTestsslJson(json);
      for (const line of testssl.lines) {
        collected.push(line);
        emitter.say(line);
      }
      for (const finding of testssl.findings) {
        count(counters, finding.severity);
        emitter.finding({
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          remediation: finding.remediation,
        });
      }
    }
  }

  if (deadlineHit) {
    emitter.say(`${PREFIX.warn} Deadline reached — partial results reported.`);
    emitter.done(EXIT_DEADLINE);
    return EXIT_DEADLINE;
  }

  const total = counters.critical + counters.high + counters.medium + counters.low;
  emitter.say(
    `${PREFIX.ok} Scan complete · ${total} findings (${counters.critical} critical, ${counters.high} high, ${counters.medium} medium, ${counters.low} low)`,
  );
  emitter.done(EXIT_OK);
  return EXIT_OK;
}

/**
 * The target values that must survive `exec.ts`'s re-validation.
 *
 * These are the only argv entries that did not originate in this file: the plan
 * supplies fixed flags, but the host, the pinned IPs and the CIDR all trace back
 * to a scan request. Naming them explicitly is what lets `runTool` refuse a
 * value that begins with `-`.
 */
function targetArgs(env: RunnerEnv): string[] {
  const values = [env.targetHost, ...env.targetIps];
  if (env.targetCidr !== null) values.push(env.targetCidr);
  return values;
}

/** A rough ETA from elapsed time; null until at least one step has finished. */
function estimateEta(startedAt: number, nowValue: number): number | null {
  const elapsed = Math.round((nowValue - startedAt) / 1_000);
  return elapsed > 0 ? elapsed : null;
}

interface ParsedStep {
  lines: string[];
  findings: {
    severity: Severity;
    title: string;
    description: string;
    cwe?: string;
    cvss?: number;
    remediation?: string;
    matchedAt?: string;
  }[];
  nmap: NmapParseResult | null;
}

function parseStep(step: PlanStep, buffer: readonly string[]): ParsedStep {
  switch (step.kind) {
    case 'nmap': {
      const result = parseNmapXml(buffer.join('\n'));
      return { lines: result.lines, findings: result.findings, nmap: result };
    }
    case 'httpx': {
      const result = parseHttpxOutput(buffer);
      return { lines: result.lines, findings: result.findings, nmap: null };
    }
    case 'nuclei': {
      const result = parseNucleiOutput(buffer);
      return { lines: result.lines, findings: result.findings, nmap: null };
    }
    case 'testssl':
      // Its findings come from the JSON file, read after the tool exits.
      return { lines: [], findings: [], nmap: null };
  }
}

// Only run when executed directly, so tests can import `main` freely.
const entryName = process.argv[1]?.split('/').pop();
if (entryName !== undefined && import.meta.url.endsWith(`/${entryName}`)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      // No stack trace in the transcript; a non-zero exit is all the controller
      // needs, and it reads the code from the pod state anyway.
      process.exitCode = EXIT_PLAN_FAILED;
    });
}
