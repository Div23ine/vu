/**
 * Runner output (Task 87).
 *
 * Two writers, one stream. Human lines go out as plain text; machine events go
 * out with the `@@VV@@ ` prefix and a single JSON object, exactly the protocol
 * Task 85's `parseProtocolLine` reads. Keeping both in one module means the
 * prefix and the JSON encoding can never drift from the parser.
 *
 * Nothing here ever prints the environment, a full command line, or a stack
 * trace: the transcript is shown to the customer who ordered the scan.
 */

/** The protocol prefix. Must match Task 85's `PROTOCOL_PREFIX` exactly. */
export const PROTOCOL_PREFIX = '@@VV@@ ';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface FindingEvent {
  t: 'finding';
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
  cvss?: number;
  cwe?: string;
  remediation?: string;
}

export interface ProgressEvent {
  t: 'progress';
  pct: number;
  etaSec?: number | null;
}

export interface PhaseEvent {
  t: 'phase';
  name: string;
}

export interface DoneEvent {
  t: 'done';
  exit: number;
}

export type ProtocolEvent = FindingEvent | ProgressEvent | PhaseEvent | DoneEvent;

export interface Writer {
  write(chunk: string): void;
}

/** Injectable so tests capture output instead of writing to stdout. */
export interface EmitDeps {
  out?: Writer;
}

const stdoutWriter: Writer = {
  write: (chunk) => {
    process.stdout.write(chunk);
  },
};

/** The narrative prefixes the front end colours. */
export const PREFIX = {
  info: '[*]',
  ok: '[+]',
  warn: '[!]',
  crit: '[!!]',
  muted: '[~]',
} as const;

export function createEmitter(deps: EmitDeps = {}) {
  const out = deps.out ?? stdoutWriter;

  /** A human line. A trailing newline is added if the caller forgot one. */
  const say = (line: string): void => {
    out.write(line.endsWith('\n') ? line : `${line}\n`);
  };

  /** A machine event. Never rendered to a terminal. */
  const event = (payload: ProtocolEvent): void => {
    out.write(`${PROTOCOL_PREFIX}${JSON.stringify(payload)}\n`);
  };

  return {
    say,
    event,
    phase: (name: string): void => {
      say(`${PREFIX.info} Phase: ${name}`);
      event({ t: 'phase', name });
    },
    progress: (pct: number, etaSec: number | null): void => {
      event({ t: 'progress', pct: Math.max(0, Math.min(99, Math.round(pct))), etaSec });
    },
    finding: (finding: Omit<FindingEvent, 't'>): void => {
      // Medium and above are narrated as they are found; every finding is
      // emitted as an event so the controller can persist it.
      if (finding.severity === 'critical') {
        say(`${PREFIX.crit} ${finding.title} (critical)`);
      } else if (finding.severity === 'high' || finding.severity === 'medium') {
        say(`${PREFIX.warn} ${finding.title} (${finding.severity})`);
      }
      event({ t: 'finding', ...finding });
    },
    done: (exit: number): void => {
      event({ t: 'done', exit });
    },
  };
}

export type Emitter = ReturnType<typeof createEmitter>;
