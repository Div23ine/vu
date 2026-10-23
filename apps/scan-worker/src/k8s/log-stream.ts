import type { Logger } from '../ports';
import type { RunHooks } from '../ports';
import { LineBuffer } from '../output/line-buffer';
import { classifyLine } from '../output/classify';
import { isProtocolLine, parseProtocolLine } from '../output/protocol';
import { sanitiseLine } from '../output/sanitise';
import { Redactor } from '../output/redact';

/**
 * Log stream (Task 86) — pod stdout to sanitised, classified terminal lines.
 *
 * This is where untrusted tool output becomes something safe to show an
 * operator, and it does three things in a fixed order:
 *
 *  1. **Split into lines** with `LineBuffer`, so a chunk boundary can never
 *     split a multi-byte character or grow memory without bound.
 *  2. **Separate protocol from prose.** A line carrying the `@@VV@@ ` prefix is
 *     parsed as an event and NEVER rendered; a line that claims the prefix but
 *     fails validation is dropped and logged, because a scanned target printing
 *     our marker must not be able to forge controller output.
 *  3. **Sanitise and classify** everything else before it is handed to the
 *     caller for publication.
 *
 * The 5 MB cap is a denial-of-service control, not a quota: a target that emits
 * gigabytes of banner text would otherwise be streamed into Redis, into the
 * API's relay and into a browser. Once the cap is hit the stream STOPS
 * PUBLISHING but keeps counting, so the completion report still records how much
 * output the scan really produced, and one final line tells the operator that
 * the rest was suppressed.
 */

/** Per-scan publication ceiling. */
export const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

/** Emitted exactly once when the ceiling is reached. */
export const OUTPUT_LIMIT_LINE = '[!] Output limit reached — further output suppressed.';

export interface TerminalLine {
  seq: number;
  ts: string;
  kind: ReturnType<typeof classifyLine>;
  msg: string;
}

export interface LogStreamResult {
  lineCount: number;
  bytesStreamed: number;
  /** Lines dropped because the ceiling had already been reached. */
  suppressed: number;
}

export interface LogStreamDeps {
  logger: Logger;
  hooks: RunHooks;
  /** Called for every line that should reach the terminal. */
  onTerminalLine(line: TerminalLine): void;
  maxOutputBytes?: number;
  /** Test seam for the timestamp on each line. */
  now?: () => Date;
}

/**
 * Consume a log stream to exhaustion.
 *
 * The caller owns cancellation (aborting the read when the Job is deleted); this
 * function simply reads until the stream ends.
 */
export async function consumeLogStream(
  stream: NodeJS.ReadableStream,
  deps: LogStreamDeps,
): Promise<LogStreamResult> {
  const buffer = new LineBuffer();
  // Stateful: a PEM private-key body is bare base64 with no keyword on it, so a
  // per-line pass would let it through. The Redactor remembers the block.
  const redactor = new Redactor();
  const ceiling = deps.maxOutputBytes ?? MAX_OUTPUT_BYTES;
  const now = deps.now ?? (() => new Date());

  let seq = 0;
  let lineCount = 0;
  let bytesStreamed = 0;
  let suppressed = 0;
  let limitAnnounced = false;

  const publish = (message: string, at: Date): void => {
    const kind = classifyLine(message);
    deps.onTerminalLine({ seq, ts: at.toISOString(), kind, msg: message });
    deps.hooks.onLine(message);
    seq += 1;
  };

  const handleLine = (line: string): void => {
    lineCount += 1;
    bytesStreamed += Buffer.byteLength(line, 'utf8') + 1;

    // Protocol lines are consumed, never rendered.
    if (isProtocolLine(line)) {
      const parsed = parseProtocolLine(line);
      if (parsed === 'invalid') {
        deps.logger.warn('dropping a malformed protocol line', {
          preview: line.slice(0, 120),
        });
        return;
      }
      if (parsed === null) return;
      switch (parsed.t) {
        case 'progress':
          deps.hooks.onProgress(parsed.pct, parsed.etaSec ?? null);
          return;
        case 'finding':
          deps.hooks.onFinding({
            severity:
              parsed.severity === 'info'
                ? // The collector drops `info` anyway; the contract has no such
                  // severity, so it must never be forwarded as a finding.
                  'low'
                : parsed.severity,
            title: parsed.title,
            description: parsed.description,
            ...(parsed.evidence === undefined ? {} : { evidenceRedacted: parsed.evidence }),
            ...(parsed.cvss === undefined ? {} : { cvss: parsed.cvss }),
            ...(parsed.cwe === undefined ? {} : { cwe: parsed.cwe }),
            ...(parsed.remediation === undefined
              ? {}
              : { remediationGuidance: parsed.remediation }),
          });
          return;
        case 'phase':
        case 'done':
          // Phase and done are the runner's own lifecycle markers; the deadline
          // and exit code are read from the pod, not trusted from stdout.
          return;
      }
    }

    // Redact across lines FIRST (PEM blocks), then sanitise the result.
    const clean = sanitiseLine(redactor.push(line));
    if (clean === null) return;

    if (bytesStreamed > ceiling) {
      suppressed += 1;
      if (!limitAnnounced) {
        limitAnnounced = true;
        publish(OUTPUT_LIMIT_LINE, now());
      }
      return;
    }
    publish(clean, now());
  };

  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
    for (const line of buffer.push(bytes)) handleLine(line);
  }
  for (const line of buffer.end()) handleLine(line);

  return { lineCount, bytesStreamed, suppressed };
}
