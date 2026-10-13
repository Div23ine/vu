import { describe, expect, it } from 'vitest';
import {
  formatClientCode,
  formatInvoiceNumber,
  formatJobCode,
  formatPentestRef,
  parseClientCode,
  parseInvoiceNumber,
  parseJobCode,
  parsePentestRef,
} from './ids';

describe('job codes', () => {
  it('pads to at least four digits', () => {
    expect(formatJobCode(4471)).toBe('JOB-4471');
    expect(formatJobCode(7)).toBe('JOB-0007');
    expect(formatJobCode(123456)).toBe('JOB-123456');
  });

  it('round-trips and rejects malformed input', () => {
    expect(parseJobCode('JOB-4471')).toBe(4471);
    expect(parseJobCode('nope')).toBeNull();
    expect(parseJobCode('JOB-471')).toBeNull();
    expect(parseJobCode('job-4471')).toBeNull();
    expect(formatJobCode(parseJobCode('JOB-4471') ?? 0)).toBe('JOB-4471');
  });
});

describe('invoice numbers', () => {
  it('pads the sequence to four digits', () => {
    expect(formatInvoiceNumber(2026, 841)).toBe('VV-INV-2026-0841');
    expect(formatInvoiceNumber(2026, 1)).toBe('VV-INV-2026-0001');
  });

  it('round-trips and rejects malformed input', () => {
    expect(parseInvoiceNumber('VV-INV-2026-0841')).toEqual({ year: 2026, n: 841 });
    expect(parseInvoiceNumber('VV-INV-26-0841')).toBeNull();
    expect(parseInvoiceNumber('VV-INV-2026-84')).toBeNull();
    expect(parseInvoiceNumber('INV-2026-0841')).toBeNull();
  });
});

describe('pen-test references', () => {
  it('pads to six digits', () => {
    expect(formatPentestRef(0)).toBe('VV-PT-000000');
    expect(formatPentestRef(123)).toBe('VV-PT-000123');
  });

  it('round-trips and rejects malformed input', () => {
    expect(parsePentestRef('VV-PT-000123')).toBe(123);
    expect(parsePentestRef('VV-PT-123')).toBeNull();
    expect(parsePentestRef('')).toBeNull();
  });
});

describe('client codes', () => {
  it('pads to five digits', () => {
    expect(formatClientCode(48210)).toBe('VV-CL-48210');
    expect(formatClientCode(7)).toBe('VV-CL-00007');
  });

  it('round-trips and rejects malformed input', () => {
    expect(parseClientCode('VV-CL-48210')).toBe(48210);
    expect(parseClientCode('VV-CL-4821')).toBeNull();
    expect(parseClientCode('VV-CL-abcde')).toBeNull();
  });
});
