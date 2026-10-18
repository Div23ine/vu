import type { InternalFinding } from '@vunvault/contracts';
import type { ProtocolFinding } from './protocol.js';

/**
 * Finding collector (Task 85).
 *
 * A scan of one host can emit thousands of findings, most of them the same issue
 * on a different port. This collector is the pressure valve between the pod and
 * the API, and it enforces three limits that are also enforced server-side —
 * because a controller that forwarded everything would be a denial-of-service
 * against its own API:
 *
 *  - **`info` is dropped.** The contract's `InternalFinding.severity` is
 *    `FindingSeverity` (critical/high/medium/low); `info` is legal on the pod
 *    protocol and has nowhere to go, so it is discarded here rather than
 *    silently coerced into `low`.
 *  - **Duplicates collapse** on `(lower-cased title, cwe)`. The same scanner
 *    finding the same missing header on 200 responses is one finding, not 200.
 *  - **At most 500 findings** are kept — the contract's
 *    `INTERNAL_FINDINGS_MAX_PER_JOB` — and everything beyond that is COUNTED in
 *    `dropped`, so the report can say findings were withheld instead of implying
 *    the scan was quiet.
 *
 * `drain(max)` hands back batches sized for `INTERNAL_FINDINGS_MAX_PER_CALL`
 * without discarding what it returns: the caller posts a batch, and only a
 * successful post removes it.
 */

/** The contract's per-job ceiling. */
export const MAX_FINDINGS_PER_JOB = 500;

/** The contract's per-call ceiling — the default batch size. */
export const MAX_FINDINGS_PER_CALL = 100;

export type FindingSeverity = InternalFinding['severity'];

export interface FindingCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** The pod's `info` severity has no contract equivalent and is dropped. */
function normaliseSeverity(severity: ProtocolFinding['severity']): FindingSeverity | null {
  switch (severity) {
    case 'critical':
    case 'high':
    case 'medium':
    case 'low':
      return severity;
    case 'info':
      return null;
  }
}

export class FindingCollector {
  private readonly kept: InternalFinding[] = [];
  /** Findings already handed to a caller, so `counts()` survives a drain. */
  private readonly reported: InternalFinding[] = [];
  private readonly seen = new Set<string>();
  private droppedCount = 0;
  private duplicateCount = 0;
  private infoCount = 0;

  /** Number of findings held back because the per-job ceiling was reached. */
  get dropped(): number {
    return this.droppedCount;
  }

  get duplicates(): number {
    return this.duplicateCount;
  }

  get ignoredInfo(): number {
    return this.infoCount;
  }

  get size(): number {
    return this.kept.length;
  }

  /** The dedupe key: lower-cased title plus the CWE when there is one. */
  private static keyOf(title: string, cwe: string | undefined): string {
    return `${title.trim().toLowerCase()}\u0000${cwe ?? ''}`;
  }

  /**
   * Add one finding event. Returns true when it was kept.
   *
   * Rejection is silent by design — a scan emitting 10 000 duplicates must not
   * produce 10 000 log lines — but every rejection is counted.
   */
  add(event: ProtocolFinding): boolean {
    const severity = normaliseSeverity(event.severity);
    if (severity === null) {
      this.infoCount += 1;
      return false;
    }

    const key = FindingCollector.keyOf(event.title, event.cwe);
    if (this.seen.has(key)) {
      this.duplicateCount += 1;
      return false;
    }

    if (this.kept.length >= MAX_FINDINGS_PER_JOB) {
      this.droppedCount += 1;
      // Still record the key: a later duplicate must not be counted as dropped
      // twice for the same finding.
      this.seen.add(key);
      return false;
    }

    this.seen.add(key);
    this.kept.push({
      severity,
      title: event.title,
      description: event.description,
      ...(event.evidence === undefined ? {} : { evidenceRedacted: event.evidence }),
      ...(event.cvss === undefined ? {} : { cvss: event.cvss }),
      ...(event.cwe === undefined ? {} : { cwe: event.cwe }),
      ...(event.remediation === undefined ? {} : { remediationGuidance: event.remediation }),
    });
    return true;
  }

  /**
   * Take up to `max` findings for one API call, removing them from the buffer.
   *
   * Called repeatedly until it returns an empty array. What is handed over is
   * remembered in `reported` so `counts()` still describes the whole scan
   * after every batch has been posted.
   */
  drain(max: number = MAX_FINDINGS_PER_CALL): InternalFinding[] {
    if (max <= 0) return [];
    const batch = this.kept.splice(0, max);
    this.reported.push(...batch);
    return batch;
  }

  /** Peek without consuming — the findings not yet posted. */
  all(): readonly InternalFinding[] {
    return this.kept;
  }

  /** Severity totals over the WHOLE scan, including what was already drained. */
  counts(): FindingCounts {
    const totals: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const finding of this.kept) totals[finding.severity] += 1;
    for (const finding of this.reported) totals[finding.severity] += 1;
    return totals;
  }
}
