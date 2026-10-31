import type { FindingSeverity } from '@vunvault/contracts';
import {
  ADVISORY_REMEDIATION_MESSAGE,
  ADVISORY_SCOPE_MESSAGE,
  ADVISORY_SEVERITY_MESSAGE,
  ADVISORY_SUMMARY_MESSAGE,
  ADVISORY_TITLE_MESSAGE,
  CVSS_BANDS,
  SEVERITY_CVSS_MISMATCH_MESSAGE,
  severityMatchesCvss,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';

/**
 * Broadcast preconditions, as pure functions.
 *
 * An emergency broadcast pages clients at two in the morning. Everything that can
 * be checked before one is sent is checked here, in one place, with the same
 * messages the editor shows — so an operator fixing a draft sees the same words
 * the API refused them with.
 */

/** The fields an advisory must carry before it may be broadcast. */
export const REQUIRED_FOR_BROADCAST = [
  'title',
  'severity',
  'summary',
  'remediation',
  'scope',
] as const;

export type RequiredBroadcastField = (typeof REQUIRED_FOR_BROADCAST)[number];

export interface BroadcastableInput {
  status: string;
  title: string | null;
  severity: FindingSeverity | null;
  summary: string | null;
  remediation: string | null;
  scope: ReadonlyArray<unknown>;
  cvss: number | null;
}

/** The message for one missing field, matching the editor's own copy. */
export function messageFor(field: RequiredBroadcastField): string {
  switch (field) {
    case 'title':
      return ADVISORY_TITLE_MESSAGE;
    case 'severity':
      return ADVISORY_SEVERITY_MESSAGE;
    case 'summary':
      return ADVISORY_SUMMARY_MESSAGE;
    case 'remediation':
      return ADVISORY_REMEDIATION_MESSAGE;
    case 'scope':
      return ADVISORY_SCOPE_MESSAGE;
  }
}

/**
 * CVSS v3.1 base score → severity band.
 *
 * critical ≥ 9.0 · high ≥ 7.0 · medium ≥ 4.0 · low > 0 · otherwise no severity.
 * The bands come from the contracts package so the API, the editor and the tests
 * cannot disagree about where a boundary falls.
 */
export function severityFromCvss(cvss: number | null | undefined): FindingSeverity | null {
  if (cvss === null || cvss === undefined || !Number.isFinite(cvss)) return null;
  // Ordered worst first; `low` starts at 0.1, so a score of exactly 0 has no band.
  const order: FindingSeverity[] = ['critical', 'high', 'medium', 'low'];
  for (const severity of order) {
    const [lower] = CVSS_BANDS[severity];
    if (cvss >= lower) return severity;
  }
  return null;
}

/** Every field that would stop a broadcast, in the editor's display order. */
export function missingBroadcastFields(input: BroadcastableInput): Array<{
  path: string[];
  message: string;
}> {
  const missing: Array<{ path: string[]; message: string }> = [];

  if (input.title === null || input.title.trim() === '') {
    missing.push({ path: ['title'], message: messageFor('title') });
  }
  if (input.severity === null) {
    missing.push({ path: ['severity'], message: messageFor('severity') });
  }
  if (input.scope.length < 1) {
    missing.push({ path: ['scope'], message: messageFor('scope') });
  }
  if (input.summary === null || input.summary.trim() === '') {
    missing.push({ path: ['summary'], message: messageFor('summary') });
  }
  if (input.remediation === null || input.remediation.trim() === '') {
    missing.push({ path: ['remediation'], message: messageFor('remediation') });
  }
  if (
    input.cvss !== null &&
    input.severity !== null &&
    !severityMatchesCvss(input.severity, input.cvss)
  ) {
    missing.push({ path: ['severity'], message: SEVERITY_CVSS_MISMATCH_MESSAGE });
  }
  return missing;
}

/** Only a draft may be broadcast for the first time; only a published one again. */
export function statusAllows(status: string, kind: 'initial' | 'rebroadcast'): boolean {
  return kind === 'initial' ? status === 'draft' : status === 'published';
}

/**
 * Throw `422 advisory_incomplete` listing every reason the advisory cannot go out.
 *
 * The details are returned as one entry per problem, in the editor's field order,
 * so the UI can highlight all of them at once rather than one round trip at a time.
 */
export function assertBroadcastable(
  input: BroadcastableInput,
  kind: 'initial' | 'rebroadcast',
): void {
  const problems = missingBroadcastFields(input);
  if (!statusAllows(input.status, kind)) {
    problems.unshift({
      path: ['status'],
      message:
        kind === 'initial'
          ? 'Only a draft can be broadcast for the first time'
          : 'Only a published advisory can be re-broadcast',
    });
  }
  if (problems.length > 0) {
    throw new HttpError(
      422,
      'advisory_incomplete',
      'This advisory is not ready to broadcast',
      problems,
    );
  }
}
