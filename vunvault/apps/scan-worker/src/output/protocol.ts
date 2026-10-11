import { z } from 'zod';
import { redact } from './redact';

/**
 * Pod → controller event protocol (Task 85).
 *
 * The runner prints human lines to stdout as usual. Machine events share the
 * same stream, distinguished by the exact prefix `@@VV@@ ` followed by ONE JSON
 * object. Multiplexing over stdout is deliberate: the pod has no network, no
 * Redis and no API credentials, so stdout is the only channel out.
 *
 * `parseProtocolLine` has three answers, and the third is the important one:
 *  - `null`      — an ordinary human line, forward it to the terminal.
 *  - an event    — a validated machine event, never shown to a human.
 *  - `"invalid"` — the line CLAIMED to be an event but failed validation.
 *
 * A protocol line is NEVER forwarded to the terminal, valid or not. That is what
 * stops a scanned target from injecting text that looks like controller output:
 * if a tool echoes `@@VV@@ {"t":"done","exit":0}` inside a banner, the operator
 * must not see a line that reads like our own event stream. Dropping it silently
 * would hide a possible injection attempt, so `"invalid"` is logged by the caller.
 *
 * Forgery is bounded by the schemas: only these four shapes parse, and every
 * string field is length-capped and (for evidence) redacted before it leaves
 * this module.
 */

/** The exact prefix. A line must start with it to be considered an event. */
export const PROTOCOL_PREFIX = '@@VV@@ ';

export const FINDING_TITLE_MAX = 200;
export const FINDING_DESCRIPTION_MAX = 4_000;
export const FINDING_EVIDENCE_MAX = 2_000;
export const PHASE_NAME_MAX = 40;

/** Severity as the pod reports it — `info` is legal input and dropped later. */
export const ProtocolSeverity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type ProtocolSeverity = z.infer<typeof ProtocolSeverity>;

const ProgressEvent = z.object({
  t: z.literal('progress'),
  pct: z.number().int().min(0).max(99),
  etaSec: z.number().int().nullable().optional(),
});

const FindingEvent = z.object({
  t: z.literal('finding'),
  severity: ProtocolSeverity,
  title: z.string().min(1).max(FINDING_TITLE_MAX),
  description: z.string().min(1).max(FINDING_DESCRIPTION_MAX),
  evidence: z.string().max(FINDING_EVIDENCE_MAX).optional(),
  cvss: z.number().min(0).max(10).optional(),
  cwe: z.string().regex(/^CWE-\d+$/).optional(),
  remediation: z.string().max(2_000).optional(),
});

const PhaseEvent = z.object({
  t: z.literal('phase'),
  name: z.string().min(1).max(PHASE_NAME_MAX),
});

const DoneEvent = z.object({
  t: z.literal('done'),
  exit: z.number().int(),
});

export const ProtocolEvent = z.discriminatedUnion('t', [
  ProgressEvent,
  FindingEvent,
  PhaseEvent,
  DoneEvent,
]);
export type ProtocolEvent = z.infer<typeof ProtocolEvent>;
export type ProtocolFinding = z.infer<typeof FindingEvent>;

export type ParseProtocolResult = ProtocolEvent | null | 'invalid';

/**
 * Parse one stdout line.
 *
 * Evidence is redacted here, not downstream: a finding's evidence is the most
 * likely place for a tool to have printed a credential it found, and it must
 * never reach the API unfiltered.
 */
export function parseProtocolLine(line: string): ParseProtocolResult {
  if (!line.startsWith(PROTOCOL_PREFIX)) return null;

  const payload = line.slice(PROTOCOL_PREFIX.length).trim();
  if (payload === '') return 'invalid';

  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    // Claimed the prefix but is not JSON: log and drop, never forward.
    return 'invalid';
  }

  const parsed = ProtocolEvent.safeParse(json);
  if (!parsed.success) return 'invalid';

  if (parsed.data.t !== 'finding') return parsed.data;
  const finding = parsed.data;
  return {
    ...finding,
    ...(finding.evidence === undefined ? {} : { evidence: redact(finding.evidence) }),
  };
}

/** True when a line is a protocol line, valid or not — never render these. */
export function isProtocolLine(line: string): boolean {
  return line.startsWith(PROTOCOL_PREFIX);
}
