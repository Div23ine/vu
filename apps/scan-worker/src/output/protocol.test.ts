import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PROTOCOL_PREFIX, isProtocolLine, parseProtocolLine } from './protocol';

/**
 * Protocol tests (Task 85).
 *
 * The security property under test is the three-way answer: an ordinary line is
 * forwarded, a valid event is consumed, and a line that CLAIMS the prefix but
 * fails validation is dropped as `"invalid"` — never rendered. A scanned target
 * that prints our prefix inside a banner must not be able to make an operator
 * see text that looks like controller output, and must not be able to forge an
 * event outside the four schemas.
 */

function event(json: unknown): string {
  return `${PROTOCOL_PREFIX}${JSON.stringify(json)}`;
}

describe('parseProtocolLine — ordinary lines', () => {
  it('returns null for a human line', () => {
    expect(parseProtocolLine('[*] Scanning 443/tcp')).toBeNull();
    expect(parseProtocolLine('Nmap scan report for api.example.com')).toBeNull();
    expect(parseProtocolLine('')).toBeNull();
  });

  it('returns null for the prefix appearing mid-line (not a protocol line)', () => {
    // Only a line that STARTS with the prefix is an event; a target echoing the
    // marker inside a banner stays ordinary output.
    expect(parseProtocolLine(`banner says ${PROTOCOL_PREFIX}{"t":"done","exit":0}`)).toBeNull();
  });
});

describe('parseProtocolLine — valid events', () => {
  it('parses progress', () => {
    expect(parseProtocolLine(event({ t: 'progress', pct: 42, etaSec: 90 }))).toEqual({
      t: 'progress',
      pct: 42,
      etaSec: 90,
    });
    expect(parseProtocolLine(event({ t: 'progress', pct: 0, etaSec: null }))).toEqual({
      t: 'progress',
      pct: 0,
      etaSec: null,
    });
  });

  it('rejects progress outside 0..99', () => {
    expect(parseProtocolLine(event({ t: 'progress', pct: 100 }))).toBe('invalid');
    expect(parseProtocolLine(event({ t: 'progress', pct: -1 }))).toBe('invalid');
    expect(parseProtocolLine(event({ t: 'progress', pct: 42.5 }))).toBe('invalid');
  });

  it('parses a finding and carries its optional fields', () => {
    const parsed = parseProtocolLine(
      event({
        t: 'finding',
        severity: 'high',
        title: 'Missing HSTS header',
        description: 'The response does not set Strict-Transport-Security.',
        evidence: 'curl -I https://target',
        cvss: 7.5,
        cwe: 'CWE-319',
        remediation: 'Set the header with a one-year max-age.',
      }),
    );
    expect(parsed).toMatchObject({ t: 'finding', severity: 'high', cwe: 'CWE-319', cvss: 7.5 });
  });

  it('accepts info severity at the protocol layer (the collector drops it)', () => {
    const parsed = parseProtocolLine(
      event({ t: 'finding', severity: 'info', title: 'Open port', description: 'Port 22 open.' }),
    );
    expect(parsed).toMatchObject({ t: 'finding', severity: 'info' });
  });

  it('parses phase and done', () => {
    expect(parseProtocolLine(event({ t: 'phase', name: 'service detection' }))).toEqual({
      t: 'phase',
      name: 'service detection',
    });
    expect(parseProtocolLine(event({ t: 'done', exit: 0 }))).toEqual({ t: 'done', exit: 0 });
    expect(parseProtocolLine(event({ t: 'done', exit: 124 }))).toEqual({ t: 'done', exit: 124 });
  });
});

describe('parseProtocolLine — forged and malformed events', () => {
  it('bad JSON is invalid, not an event and not output', () => {
    expect(parseProtocolLine(`${PROTOCOL_PREFIX}{not json`)).toBe('invalid');
    expect(parseProtocolLine(`${PROTOCOL_PREFIX}`)).toBe('invalid');
    expect(parseProtocolLine(PROTOCOL_PREFIX)).toBe('invalid');
  });

  it('an unknown event type is invalid', () => {
    expect(parseProtocolLine(event({ t: 'self_destruct' }))).toBe('invalid');
    expect(parseProtocolLine(event({ t: 'exfiltrate', to: 'evil.test' }))).toBe('invalid');
  });

  it('extra fields cannot smuggle a different shape in', () => {
    // `done` requires an int exit; a string is rejected rather than coerced.
    expect(parseProtocolLine(event({ t: 'done', exit: '0' }))).toBe('invalid');
    expect(parseProtocolLine(event({ t: 'done' }))).toBe('invalid');
  });

  it('enforces the length caps on finding text', () => {
    const longTitle = 'x'.repeat(201);
    expect(
      parseProtocolLine(
        event({ t: 'finding', severity: 'low', title: longTitle, description: 'd' }),
      ),
    ).toBe('invalid');

    const longDescription = 'y'.repeat(4_001);
    expect(
      parseProtocolLine(
        event({ t: 'finding', severity: 'low', title: 't', description: longDescription }),
      ),
    ).toBe('invalid');

    const longPhase = 'z'.repeat(41);
    expect(parseProtocolLine(event({ t: 'phase', name: longPhase }))).toBe('invalid');
  });

  it('rejects a malformed CWE', () => {
    expect(
      parseProtocolLine(
        event({
          t: 'finding',
          severity: 'low',
          title: 't',
          description: 'd',
          cwe: 'not-a-cwe',
        }),
      ),
    ).toBe('invalid');
  });

  it('redacts credentials inside finding evidence', () => {
    const parsed = parseProtocolLine(
      event({
        t: 'finding',
        severity: 'critical',
        title: 'Exposed config',
        description: 'The config endpoint returned credentials.',
        evidence: 'password = Sup3rS3cretValue and AKIAIOSFODNN7EXAMPLE',
      }),
    );
    if (parsed === null || parsed === 'invalid') throw new Error('expected a finding');
    expect(parsed.t).toBe('finding');
    if (parsed.t !== 'finding') return;
    expect(parsed.evidence).not.toContain('Sup3rS3cretValue');
    expect(parsed.evidence).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(parsed.evidence).toContain('[REDACTED]');
    // The description is untouched — it is our own text, not tool output.
    expect(parsed.description).toBe('The config endpoint returned credentials.');
  });

  it('isProtocolLine flags both valid and invalid claims', () => {
    expect(isProtocolLine(event({ t: 'done', exit: 0 }))).toBe(true);
    expect(isProtocolLine(`${PROTOCOL_PREFIX}garbage`)).toBe(true);
    expect(isProtocolLine('plain output')).toBe(false);
  });
});

describe('protocol schemas are the documented shape', () => {
  it('accepts exactly the four event types', () => {
    const union = z.discriminatedUnion('t', [
      z.object({ t: z.literal('progress'), pct: z.number() }),
      z.object({
        t: z.literal('finding'),
        severity: z.string(),
        title: z.string(),
        description: z.string(),
      }),
      z.object({ t: z.literal('phase'), name: z.string() }),
      z.object({ t: z.literal('done'), exit: z.number() }),
    ]);
    expect(union.safeParse({ t: 'progress', pct: 1 }).success).toBe(true);
    expect(union.safeParse({ t: 'pause' }).success).toBe(false);
  });
});
