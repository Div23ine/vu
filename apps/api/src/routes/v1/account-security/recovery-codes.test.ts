import { describe, expect, it } from 'vitest';
import {
  generateRecoveryBatch,
  generateRecoveryCode,
  hashRecoveryCode,
  isValidRecoveryCode,
  normalise,
  RECOVERY_ALPHABET,
  RECOVERY_BATCH_SIZE,
  RECOVERY_CODE_PATTERN,
} from './recovery-codes';

describe('recovery code generation', () => {
  it('produces ten unique codes in the display format', () => {
    const batch = generateRecoveryBatch();
    expect(batch).toHaveLength(RECOVERY_BATCH_SIZE);
    expect(new Set(batch).size).toBe(RECOVERY_BATCH_SIZE);
    for (const code of batch) {
      expect(code).toMatch(RECOVERY_CODE_PATTERN);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(code).toHaveLength(14);
    }
  });

  it('uses the Crockford alphabet without I, L, O or U', () => {
    expect(RECOVERY_ALPHABET).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
    expect(RECOVERY_ALPHABET).toHaveLength(32);
    for (const forbidden of ['I', 'L', 'O', 'U']) {
      expect(RECOVERY_ALPHABET).not.toContain(forbidden);
    }
    for (let index = 0; index < 200; index += 1) {
      const code = generateRecoveryCode();
      for (const character of code.replace(/-/g, '')) {
        expect(RECOVERY_ALPHABET, character).toContain(character);
      }
    }
  });

  it('generates distinct codes across batches', () => {
    const seen = new Set<string>();
    for (const code of [...generateRecoveryBatch(), ...generateRecoveryBatch()]) seen.add(code);
    expect(seen.size).toBe(20);
  });
});

describe('normalise', () => {
  it('accepts the documented messy input', () => {
    expect(normalise('4f7a 9c2e d018')).toBe('4F7A-9C2E-D018');
    expect(isValidRecoveryCode('4f7a 9c2e d018')).toBe(true);
  });

  it('maps the omitted look-alike characters', () => {
    expect(normalise('OLIO-OLIO-OLIO')).toBe('0110-0110-0110');
    // Dashes are separators, not characters: the letters are mapped first.
    expect(normalise('o-l-i-o')).toBe('0110');
  });

  it('strips dashes and spaces, then re-groups in fours', () => {
    expect(normalise('4F7A9C2ED018')).toBe('4F7A-9C2E-D018');
    expect(normalise('4F7A-9C2E-D018')).toBe('4F7A-9C2E-D018');
    expect(normalise('  4f7a  9c2e  d018  ')).toBe('4F7A-9C2E-D018');
  });

  it('rejects anything that is not twelve characters', () => {
    expect(isValidRecoveryCode('4F7A-9C2E')).toBe(false);
    expect(isValidRecoveryCode('')).toBe(false);
    expect(isValidRecoveryCode('4F7A-9C2E-D0189')).toBe(false);
  });
});

describe('hashRecoveryCode', () => {
  it('is stable across formatting differences and hides the code', () => {
    const a = hashRecoveryCode('4F7A-9C2E-D018');
    expect(hashRecoveryCode('4f7a 9c2e d018')).toBe(a);
    expect(hashRecoveryCode('4F7A9C2ED018')).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('4F7A');
    expect(hashRecoveryCode('4F7A-9C2E-D019')).not.toBe(a);
  });
});
