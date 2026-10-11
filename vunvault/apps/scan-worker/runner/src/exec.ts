import { spawn } from 'node:child_process';

/**
 * Tool execution (Task 87).
 *
 * The runner has no shell and never builds one. `spawn(bin, argv, { shell:
 * false })` passes an argv array straight to `execve`, so a target containing
 * `;`, `|`, `$( )` or a backtick is just a string the tool receives — there is
 * no interpreter to convince.
 *
 * Three defences live here rather than in the caller:
 *
 *  1. **The binary comes from a fixed table of absolute paths.** A tool name
 *     from a plan cannot be redirected by `PATH`, and the environment handed to
 *     the child is constructed fresh (PATH, HOME, LANG and nothing else) so the
 *     pod's own variables never reach a scanning tool.
 *  2. **Every argument is re-validated.** A value that starts with `-` is
 *     refused outright, because in an argv array position is the only thing
 *     separating data from a flag — `-oN /tmp/x` as a "hostname" would redirect
 *     nmap's output. The target grammar (hostname / IPv4 / CIDR ≥ /24) is
 *     checked again here even though the controller and `env.ts` already did.
 *  3. **Output is bounded.** stdout is capped at 20 MB and the process is killed
 *     beyond it; stderr goes to a 64 KB ring buffer that is surfaced only as a
 *     single muted line on a non-zero exit, so a tool's diagnostics cannot flood
 *     the transcript or leak a command line.
 *
 * Timeouts kill the whole process GROUP: nmap and nuclei both fork, and killing
 * only the parent would leave children running against the target after the scan
 * was reported finished.
 */

/** The only binaries the runner may execute. */
export const ALLOWED_BINARIES: readonly string[] = [
  '/usr/bin/nmap',
  '/usr/local/bin/nuclei',
  '/usr/local/bin/httpx',
  '/opt/testssl/testssl.sh',
] as const;

/** Hard cap on captured stdout before the tool is killed. */
export const MAX_STDOUT_BYTES = 20 * 1024 * 1024;

/** stderr is kept only for a one-line diagnostic. */
export const STDERR_RING_BYTES = 64 * 1024;

/** Grace period between SIGTERM and SIGKILL. */
export const KILL_GRACE_MS = 3_000;

/** The minimal, constructed child environment. */
export const CHILD_ENV: Record<string, string> = {
  PATH: '/usr/local/bin:/usr/bin',
  HOME: '/tmp',
  LANG: 'C.UTF-8',
};

export type ToolOutcome =
  | { kind: 'exited'; exitCode: number; stderrTail: string }
  | { kind: 'timeout' }
  | { kind: 'output_limit' }
  | { kind: 'rejected'; reason: string };

export interface RunToolSpec {
  bin: string;
  argv: string[];
  timeoutMs: number;
  maxStdoutBytes?: number;
  onStdoutLine(line: string): void;
  /** Extra values that must satisfy the target grammar (defence in depth). */
  targets?: string[];
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

function isCidr(value: string): boolean {
  const [address, prefix] = value.split('/');
  if (address === undefined || prefix === undefined) return false;
  if (!isIpv4(address) || !/^\d{1,2}$/.test(prefix)) return false;
  const bits = Number(prefix);
  return bits >= 24 && bits <= 32;
}

/**
 * Validate one target value.
 *
 * A leading `-` is refused before the grammar is even considered: it is the
 * option-injection vector, and no legitimate hostname, address or range starts
 * with one.
 */
export function validateTargetArgument(value: string): boolean {
  if (value === '' || value.length > 253) return false;
  if (value.startsWith('-')) return false;
  if (value.includes(' ') || /[\n\r\t;]/.test(value)) return false;
  if (isCidr(value)) return true;
  if (isIpv4(value)) return true;
  return HOSTNAME.test(value.toLowerCase());
}

/** A fixed ring buffer: bounded memory regardless of how chatty a tool is. */
class RingBuffer {
  private chunks: string[] = [];
  private bytes = 0;

  constructor(private readonly limit: number) {}

  push(chunk: string): void {
    this.chunks.push(chunk);
    this.bytes += Buffer.byteLength(chunk, 'utf8');
    while (this.bytes > this.limit && this.chunks.length > 1) {
      const dropped = this.chunks.shift();
      if (dropped === undefined) break;
      this.bytes -= Buffer.byteLength(dropped, 'utf8');
    }
  }

  tail(): string {
    return this.chunks.join('').slice(-this.limit).trim();
  }
}

export interface RunToolDeps {
  /** Test seam: replace `spawn` and the clock. */
  spawnImpl?: typeof spawn;
  now?: () => number;
}

/**
 * Run one tool to completion.
 *
 * Resolves with an outcome rather than throwing: a tool that times out, is
 * killed for producing too much output, or exits non-zero are all normal scan
 * events, and the caller reports them as partial results rather than as a
 * controller failure.
 */
export async function runTool(
  spec: RunToolSpec,
  deps: RunToolDeps = {},
): Promise<ToolOutcome> {
  if (!ALLOWED_BINARIES.includes(spec.bin)) {
    return { kind: 'rejected', reason: 'binary_not_allowed' };
  }
  for (const argument of spec.argv) {
    // An argument may legitimately be a flag the PLAN chose; what must never
    // happen is a target-derived value arriving in flag position. Those are
    // validated separately below.
    if (argument.includes('\n') || argument.includes('\r')) {
      return { kind: 'rejected', reason: 'argument_contains_newline' };
    }
  }
  for (const target of spec.targets ?? []) {
    if (!validateTargetArgument(target)) {
      return { kind: 'rejected', reason: 'invalid_target_argument' };
    }
  }

  const spawnImpl = deps.spawnImpl ?? spawn;
  const maxStdout = spec.maxStdoutBytes ?? MAX_STDOUT_BYTES;
  const stderrRing = new RingBuffer(STDERR_RING_BYTES);

  return await new Promise<ToolOutcome>((resolve) => {
    // `detached: true` gives the child its own process group, so one
    // `kill(-pid)` reaches nmap's and nuclei's forks too.
    const child = spawnImpl(spec.bin, spec.argv, {
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: CHILD_ENV,
    });

    let stdoutBytes = 0;
    let partial = Buffer.alloc(0);
    let settled = false;
    let timedOut = false;
    let outputLimited = false;

    const killGroup = (signal: NodeJS.Signals): void => {
      const pid = child.pid;
      if (pid === undefined) return;
      try {
        process.kill(-pid, signal);
      } catch {
        // Already gone — the exit handler settles the outcome.
        try {
          child.kill(signal);
        } catch {
          /* nothing left to do */
        }
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup('SIGTERM');
      setTimeout(() => {
        if (!settled) killGroup('SIGKILL');
      }, KILL_GRACE_MS);
    }, spec.timeoutMs);
    // The timer must not hold the event loop open after the tool exits.
    timer.unref?.();

    const finish = (outcome: ToolOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > maxStdout) {
        outputLimited = true;
        killGroup('SIGTERM');
        setTimeout(() => {
          if (!settled) killGroup('SIGKILL');
        }, KILL_GRACE_MS);
        return;
      }
      partial = Buffer.concat([partial, chunk]);
      let newline = partial.indexOf(0x0a);
      while (newline !== -1) {
        const line = partial.subarray(0, newline).toString('utf8');
        partial = partial.subarray(newline + 1);
        spec.onStdoutLine(line);
        newline = partial.indexOf(0x0a);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderrRing.push(chunk.toString('utf8'));
    });

    child.on('error', () => {
      finish({ kind: 'rejected', reason: 'spawn_failed' });
    });

    child.on('close', (code) => {
      // Flush a final line that carried no newline.
      if (partial.byteLength > 0) {
        spec.onStdoutLine(partial.toString('utf8'));
        partial = Buffer.alloc(0);
      }
      if (outputLimited) {
        finish({ kind: 'output_limit' });
        return;
      }
      if (timedOut) {
        finish({ kind: 'timeout' });
        return;
      }
      finish({ kind: 'exited', exitCode: code ?? -1, stderrTail: stderrRing.tail() });
    });
  });
}
