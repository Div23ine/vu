import { describe, expect, it } from 'vitest';
import { classifyLine } from './classify.js';
import { FindingCollector, MAX_FINDINGS_PER_JOB } from './findings.js';
import { LineBuffer, MAX_TAIL_BYTES } from './line-buffer.js';
import type { ProtocolFinding } from './protocol.js';
import {
  MAX_LINE_BYTES,
  TRUNCATION_SUFFIX,
  capBytes,
  collapseCarriageReturns,
  sanitiseLine,
  stripAnsi,
} from './sanitise.js';

/**
 * Output-pipeline tests (Task 85).
 *
 * The assertions here are the isolation model's last line of defence on the
 * output side: nothing a scanned target prints may reach an operator's terminal
 * as a control sequence, nothing may exceed the byte cap, and a newline-free
 * stream may not exhaust the controller's memory.
 */

describe('sanitiseLine — terminal escapes', () => {
  it('removes ANSI colour codes', () => {
    const raw = '\x1b[31mCRITICAL\x1b[0m: missing header';
    expect(sanitiseLine(raw)).toBe('CRITICAL: missing header');
  });

  it('removes cursor movement', () => {
    const raw = 'scan\x1b[2K\x1b[1A\x1b[10;20Hdone';
    const output = sanitiseLine(raw);
    expect(output).not.toBeNull();
    expect(output).not.toContain('\x1b');
    expect(output).toContain('scan');
    expect(output).toContain('done');
  });

  it('removes an OSC hyperlink (BEL and ST terminators)', () => {
    const bel = '\x1b]8;;https://evil.test\x07click here\x1b]8;;\x07';
    expect(sanitiseLine(bel)).toBe('click here');

    const st = '\x1b]8;;https://evil.test\x1b\\click here';
    expect(sanitiseLine(st)).toBe('click here');
  });

  it('removes an OSC clipboard-write attempt', () => {
    // OSC 52 would let a target write to the operator's clipboard.
    const raw = '\x1b]52;c;ZXZpbA==\x07normal output';
    const output = sanitiseLine(raw);
    expect(output).not.toContain('\x1b');
    expect(output).not.toContain('ZXZpbA');
    expect(output).toContain('normal output');
  });

  it('no ESC byte can survive, however truncated the sequence', () => {
    for (const raw of ['\x1b', '\x1b[', '\x1b]unterminated', 'a\x1bZb', '\x1b\x1b\x1b[31m']) {
      const output = sanitiseLine(raw);
      if (output === null) continue;
      expect(output, raw).not.toContain('\x1b');
    }
  });

  it('strips control characters but keeps tabs', () => {
    expect(sanitiseLine('col1\tcol2\x00\x08\x7f')).toBe('col1\tcol2');
    expect(sanitiseLine('a\tb')).toBe('a\tb');
  });

  it('a lone ESC swallows up to 8 following bytes (fail closed)', () => {
    // The spec's rule: any other ESC-initiated sequence up to 8 bytes goes.
    // That is deliberately greedy — a truncated escape whose terminator never
    // arrived must not leave attacker-chosen text behind it.
    expect(sanitiseLine('before\x1bafter')).toBe('before');
    expect(sanitiseLine('before\x1b')).toBe('before');
    // Beyond 8 bytes, the remainder survives.
    expect(sanitiseLine('A\x1b123456789TAIL')).toContain('TAIL');
  });

  it('strips C1 controls', () => {
    const output = sanitiseLine('before\u0090after\u009f');
    expect(output).toBe('beforeafter');
  });

  it('drops a whitespace-only line', () => {
    expect(sanitiseLine('   ')).toBeNull();
    expect(sanitiseLine('\t\t')).toBeNull();
    // A line that was ONLY an escape sequence is dropped too.
    expect(sanitiseLine('\x1b[31m\x1b[0m')).toBeNull();
  });
});

describe('sanitiseLine — carriage returns', () => {
  it('collapses a progress-bar rewrite to its last frame', () => {
    const raw = '[=>    ] 10%\r[===>  ] 45%\r[====>] 90%\r[=====>] 100%';
    expect(collapseCarriageReturns(raw)).toBe('[=====>] 100%');
    expect(sanitiseLine(raw)).toBe('[=====>] 100%');
  });

  it('keeps the last non-empty frame when the stream ends with \\r', () => {
    expect(collapseCarriageReturns('a\rb\r')).toBe('b');
  });

  it('leaves a line with no \\r alone', () => {
    expect(collapseCarriageReturns('plain line')).toBe('plain line');
  });
});

describe('sanitiseLine — the byte cap', () => {
  it('caps a 20 KB line and appends the marker', () => {
    const long = 'A'.repeat(20 * 1024);
    const output = sanitiseLine(long);
    expect(output).not.toBeNull();
    if (output === null) return;
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(output.endsWith(TRUNCATION_SUFFIX)).toBe(true);
  });

  it('leaves a line under the cap untouched', () => {
    const short = 'B'.repeat(100);
    expect(sanitiseLine(short)).toBe(short);
  });

  it('never splits a code point when the cut falls mid-emoji', () => {
    // 4-byte characters: the cut lands inside one of them.
    const emojis = '😀'.repeat(4_000);
    const output = capBytes(emojis, MAX_LINE_BYTES);
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(MAX_LINE_BYTES);
    expect(output.endsWith(TRUNCATION_SUFFIX)).toBe(true);

    const body = output.slice(0, -TRUNCATION_SUFFIX.length);
    // No lone surrogate: re-encoding round-trips and no U+FFFD appears.
    expect(body).not.toContain('\uFFFD');
    expect(Buffer.from(body, 'utf8').toString('utf8')).toBe(body);
    for (const codePoint of body) expect(codePoint).toBe('😀');
  });

  it('keeps a mixed-script line valid UTF-8 after truncation', () => {
    const mixed = 'naïve 日本語 🇰🇪 emoji'.repeat(600);
    const output = capBytes(mixed, MAX_LINE_BYTES);
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(MAX_LINE_BYTES);
    const body = output.slice(0, -TRUNCATION_SUFFIX.length);
    expect(Buffer.from(body, 'utf8').toString('utf8')).toBe(body);
  });

  it('trims trailing whitespace', () => {
    expect(sanitiseLine('value   ')).toBe('value');
    expect(sanitiseLine('value\t\n'.replace('\n', ''))).toBe('value');
  });
});

describe('sanitiseLine — idempotence', () => {
  const SAMPLES = [
    '\x1b[31m[!] warning\x1b[0m',
    'Authorization: Bearer abc123def456',
    'a\rb\rc',
    'A'.repeat(20_000),
    '😀'.repeat(4_000),
    '   ',
    'plain line',
    'password=hunter2 \x1b[0m\t',
  ];

  it('a second pass changes nothing', () => {
    for (const sample of SAMPLES) {
      const once = sanitiseLine(sample);
      const twice = once === null ? null : sanitiseLine(once);
      expect(twice, sample.slice(0, 40)).toBe(once);
    }
  });
});

describe('sanitiseLine — redaction is applied', () => {
  it('redacts a credential before the line leaves the worker', () => {
    const output = sanitiseLine('[*] found password = Sup3rS3cretValue');
    expect(output).not.toContain('Sup3rS3cretValue');
    expect(output).toContain('[REDACTED]');
  });
});

describe('classifyLine', () => {
  it('maps the scanner conventions', () => {
    expect(classifyLine('[*] Open port 443')).toBe('ok');
    expect(classifyLine('[+] Added to report')).toBe('info');
    expect(classifyLine('[!] Weak cipher')).toBe('warn');
    expect(classifyLine('[!!] Remote code execution')).toBe('crit');
    expect(classifyLine('[~] skipped')).toBe('muted');
    expect(classifyLine('[-] filtered')).toBe('muted');
    expect(classifyLine('$ nmap -sV target')).toBe('sys');
    expect(classifyLine('# comment from the tool')).toBe('sys');
    expect(classifyLine('some ordinary output')).toBe('info');
  });

  it('treats [!!] as critical, not as a warning', () => {
    // `[!]` is a prefix of `[!!]`, so order decides; this is the regression.
    expect(classifyLine('[!!] exploited')).toBe('crit');
  });

  it('escalates a line containing CRITICAL without a marker', () => {
    expect(classifyLine('nuclei: CRITICAL template matched')).toBe('crit');
  });

  it('tolerates leading whitespace before a marker', () => {
    expect(classifyLine('   [!] indented warning')).toBe('warn');
  });
});

describe('FindingCollector', () => {
  function finding(overrides: Partial<ProtocolFinding> = {}): ProtocolFinding {
    return {
      t: 'finding',
      severity: 'high',
      title: 'Missing security header',
      description: 'The response omits a security header.',
      ...overrides,
    };
  }

  it('drops info-severity findings', () => {
    const collector = new FindingCollector();
    expect(collector.add(finding({ severity: 'info' }))).toBe(false);
    expect(collector.size).toBe(0);
    expect(collector.ignoredInfo).toBe(1);
    expect(collector.counts()).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it('dedupes on lower-cased title plus CWE', () => {
    const collector = new FindingCollector();
    expect(collector.add(finding({ title: 'Missing HSTS', cwe: 'CWE-319' }))).toBe(true);
    expect(collector.add(finding({ title: 'missing hsts', cwe: 'CWE-319' }))).toBe(false);
    expect(collector.add(finding({ title: 'MISSING HSTS', cwe: 'CWE-319' }))).toBe(false);
    // A different CWE is a different finding.
    expect(collector.add(finding({ title: 'Missing HSTS', cwe: 'CWE-614' }))).toBe(true);
    expect(collector.size).toBe(2);
    expect(collector.duplicates).toBe(2);
  });

  it('keeps findings without a CWE distinct from those with one', () => {
    const collector = new FindingCollector();
    collector.add(finding({ title: 'Same title' }));
    collector.add(finding({ title: 'Same title', cwe: 'CWE-79' }));
    expect(collector.size).toBe(2);
  });

  it('counts the 501st finding as dropped', () => {
    const collector = new FindingCollector();
    for (let index = 0; index < MAX_FINDINGS_PER_JOB; index += 1) {
      expect(collector.add(finding({ title: `finding ${index}` }))).toBe(true);
    }
    expect(collector.size).toBe(MAX_FINDINGS_PER_JOB);

    expect(collector.add(finding({ title: 'one too many' }))).toBe(false);
    expect(collector.add(finding({ title: 'and another' }))).toBe(false);
    expect(collector.size).toBe(MAX_FINDINGS_PER_JOB);
    expect(collector.dropped).toBe(2);
  });

  it('drains in batches of at most 100 by default', () => {
    const collector = new FindingCollector();
    for (let index = 0; index < 250; index += 1) {
      collector.add(finding({ title: `finding ${index}` }));
    }
    expect(collector.drain()).toHaveLength(100);
    expect(collector.drain()).toHaveLength(100);
    expect(collector.drain()).toHaveLength(50);
    expect(collector.drain()).toHaveLength(0);
  });

  it('counts() survives a drain', () => {
    const collector = new FindingCollector();
    collector.add(finding({ severity: 'critical', title: 'a' }));
    collector.add(finding({ severity: 'high', title: 'b' }));
    collector.add(finding({ severity: 'low', title: 'c' }));

    collector.drain(2);
    expect(collector.counts()).toEqual({ critical: 1, high: 1, medium: 0, low: 1 });
  });

  it('maps protocol fields onto the contract shape', () => {
    const collector = new FindingCollector();
    collector.add(
      finding({
        severity: 'critical',
        title: 'SQL injection',
        description: 'Parameter is not escaped.',
        evidence: 'sqlmap output',
        cvss: 9.8,
        cwe: 'CWE-89',
        remediation: 'Use parameterised queries.',
      }),
    );
    const [first] = collector.drain();
    expect(first).toEqual({
      severity: 'critical',
      title: 'SQL injection',
      description: 'Parameter is not escaped.',
      evidenceRedacted: 'sqlmap output',
      cvss: 9.8,
      cwe: 'CWE-89',
      remediationGuidance: 'Use parameterised queries.',
    });
  });
});

describe('LineBuffer', () => {
  it('splits complete lines and keeps a partial tail', () => {
    const buffer = new LineBuffer();
    expect(buffer.push(Buffer.from('one\ntwo\nthr'))).toEqual(['one', 'two']);
    expect(buffer.bufferedBytes).toBe(3);
    expect(buffer.push(Buffer.from('ee\nfour'))).toEqual(['three']);
    expect(buffer.end()).toEqual(['four']);
  });

  it('returns nothing for a chunk with no newline', () => {
    const buffer = new LineBuffer();
    expect(buffer.push(Buffer.from('partial'))).toEqual([]);
    expect(buffer.end()).toEqual(['partial']);
    expect(buffer.end()).toEqual([]);
  });

  it('decodes a multi-byte character split across chunks', () => {
    const buffer = new LineBuffer();
    const encoded = Buffer.from('日本語\n', 'utf8');
    // Split inside the second character.
    expect(buffer.push(encoded.subarray(0, 4))).toEqual([]);
    expect(buffer.push(encoded.subarray(4))).toEqual(['日本語']);
  });

  it('flushes an endless line at the cap so memory cannot be exhausted', () => {
    const buffer = new LineBuffer();
    const chunk = Buffer.from('x'.repeat(16 * 1024));

    // 64 KB of newline-free output: the tail must be flushed, not accumulated.
    expect(buffer.push(chunk)).toEqual([]);
    expect(buffer.push(chunk)).toEqual([]);
    expect(buffer.push(chunk)).toEqual([]);
    expect(buffer.bufferedBytes).toBe(48 * 1024);

    // The fourth chunk reaches the 64 KB cap and is flushed as one line.
    const flushed = buffer.push(chunk);
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(MAX_TAIL_BYTES);
    expect(buffer.bufferedBytes).toBe(0);
    expect(buffer.overflowFlushes).toBe(1);
  });

  it('keeps working after an overflow flush', () => {
    const buffer = new LineBuffer(64);
    expect(buffer.push(Buffer.from('y'.repeat(64)))).toHaveLength(1);
    expect(buffer.push(Buffer.from('real\n'))).toEqual(['real']);
  });
});

describe('stripAnsi', () => {
  it('is exported for the archive path and removes every escape', () => {
    expect(stripAnsi('\x1b[1;31mbold red\x1b[0m')).toBe('bold red');
    expect(stripAnsi('no escapes here')).toBe('no escapes here');
  });
});
