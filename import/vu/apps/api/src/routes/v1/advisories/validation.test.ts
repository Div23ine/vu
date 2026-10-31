import { describe, expect, it } from 'vitest';
import {
  ADVISORY_SCOPE_MESSAGE,
  ADVISORY_TITLE_MESSAGE,
  SEVERITY_CVSS_MISMATCH_MESSAGE,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import {
  assertBroadcastable,
  messageFor,
  missingBroadcastFields,
  severityFromCvss,
  statusAllows,
  type BroadcastableInput,
} from './validation.js';

/** The bands the platform publishes, and the gate every broadcast passes through. */

function input(overrides: Partial<BroadcastableInput> = {}): BroadcastableInput {
  return {
    status: 'draft',
    title: 'Apache Struts remote code execution',
    severity: 'critical',
    summary: 'A deserialisation flaw allows unauthenticated remote code execution.',
    remediation: 'Upgrade to Struts 2.5.33 or apply the vendor workaround.',
    scope: [{ label: 'Web & API · Struts 2.0.0 – 2.5.32', category: 'web_api' }],
    cvss: 9.8,
    ...overrides,
  };
}

describe('severityFromCvss', () => {
  const cases: Array<[number | null, string | null]> = [
    [10, 'critical'],
    [9.8, 'critical'],
    [9.0, 'critical'],
    [8.9, 'high'],
    [7.0, 'high'],
    [6.9, 'medium'],
    [4.0, 'medium'],
    [3.9, 'low'],
    [0.1, 'low'],
    [0, null],
    [null, null],
  ];
  for (const [cvss, severity] of cases) {
    it(`maps ${String(cvss)} → ${String(severity)}`, () => {
      expect(severityFromCvss(cvss)).toBe(severity);
    });
  }
});

describe('assertBroadcastable', () => {
  it('accepts a complete draft', () => {
    expect(() => assertBroadcastable(input(), 'initial')).not.toThrow();
  });

  it('lists every missing field, scope included', () => {
    const error = (() => {
      try {
        assertBroadcastable(input({ scope: [] }), 'initial');
        return null;
      } catch (caught) {
        return caught as HttpError;
      }
    })();
    expect(error).toBeInstanceOf(HttpError);
    expect(error?.status).toBe(422);
    expect(error?.code).toBe('advisory_incomplete');
    const paths = (error?.details ?? []).map((entry) => (entry as { path: string[] }).path);
    expect(paths).toEqual([['scope']]);
    expect((error?.details?.[0] as { message: string }).message).toBe(ADVISORY_SCOPE_MESSAGE);
  });

  it('reports all of the problems at once, in the editor’s field order', () => {
    const problems = missingBroadcastFields(
      input({ title: null, severity: null, summary: null, remediation: null, scope: [] }),
    );
    expect(problems.map((problem) => problem.path[0])).toEqual([
      'title',
      'severity',
      'scope',
      'summary',
      'remediation',
    ]);
  });

  it('refuses a severity that contradicts its own CVSS', () => {
    const problems = missingBroadcastFields(input({ severity: 'low', cvss: 9.8 }));
    expect(problems.map((problem) => problem.message)).toContain(SEVERITY_CVSS_MISMATCH_MESSAGE);
    expect(() => assertBroadcastable(input({ severity: 'low', cvss: 9.8 }), 'initial')).toThrow(
      HttpError,
    );
  });

  it('allows a severity with no CVSS at all', () => {
    expect(() => assertBroadcastable(input({ cvss: null }), 'initial')).not.toThrow();
  });

  it('separates the first broadcast from a re-broadcast', () => {
    expect(statusAllows('draft', 'initial')).toBe(true);
    expect(statusAllows('published', 'initial')).toBe(false);
    expect(statusAllows('published', 'rebroadcast')).toBe(true);
    expect(statusAllows('draft', 'rebroadcast')).toBe(false);
    expect(statusAllows('retracted', 'rebroadcast')).toBe(false);

    const error = (() => {
      try {
        assertBroadcastable(input({ status: 'published' }), 'initial');
        return null;
      } catch (caught) {
        return caught as HttpError;
      }
    })();
    expect(error?.code).toBe('advisory_incomplete');
    expect((error?.details?.[0] as { path: string[] }).path).toEqual(['status']);
  });

  it('uses the editor’s own copy for every field', () => {
    expect(messageFor('title')).toBe(ADVISORY_TITLE_MESSAGE);
    expect(messageFor('scope')).toBe(ADVISORY_SCOPE_MESSAGE);
    expect(messageFor('severity')).not.toBe('');
    expect(messageFor('summary')).not.toBe('');
    expect(messageFor('remediation')).not.toBe('');
  });
});
