import { describe, expect, it } from 'vitest';
import {
  ALGORITHM,
  KEY_LENGTH,
  SCRYPT_N,
  SCRYPT_P,
  SCRYPT_R,
  hashSecret,
  isSecretHash,
  normaliseAnswer,
  parseSecretHash,
  verifySecret,
} from './secret-hash';

/** A small N keeps the test suite fast; the defaults are asserted separately. */
const FAST = { N: 1024, r: 8, p: 1 };
const FIXED_SALT = Buffer.alloc(16, 7);

describe('scrypt parameters', () => {
  it('uses N = 2^15, r = 8, p = 1 by default', () => {
    expect(SCRYPT_N).toBe(32768);
    expect(SCRYPT_R).toBe(8);
    expect(SCRYPT_P).toBe(1);
    expect(KEY_LENGTH).toBe(64);
    expect(ALGORITHM).toBe('scrypt');
  });
});

describe('normaliseAnswer', () => {
  it('trims and lower-cases', () => {
    expect(normaliseAnswer('  Nairobi ')).toBe('nairobi');
    expect(normaliseAnswer('NAIROBI')).toBe('nairobi');
    expect(normaliseAnswer('nairobi')).toBe('nairobi');
  });
});

describe('hashSecret', () => {
  it('produces the documented encoded form', () => {
    const encoded = hashSecret('Nairobi', { ...FAST, salt: FIXED_SALT });
    expect(encoded).toMatch(/^scrypt\$1024\$8\$1\$[0-9a-f]{32}\$/);
    expect(encoded.split('$')).toHaveLength(6);
    expect(isSecretHash(encoded)).toBe(true);

    const parsed = parseSecretHash(encoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.N).toBe(1024);
    expect(parsed?.salt.equals(FIXED_SALT)).toBe(true);
    expect(parsed?.hash).toHaveLength(KEY_LENGTH);
  });

  it('never stores the answer in plaintext', () => {
    const encoded = hashSecret('Nairobi', FAST);
    expect(encoded).not.toContain('Nairobi');
    expect(encoded).not.toContain('nairobi');
    expect(encoded.toLowerCase()).not.toContain(Buffer.from('nairobi').toString('hex'));
  });

  it('salted output differs between calls for the same answer', () => {
    expect(hashSecret('Nairobi', FAST)).not.toBe(hashSecret('Nairobi', FAST));
  });
});

describe('verifySecret', () => {
  const encoded = hashSecret('Nairobi', FAST);

  it('accepts the same answer in any case or spacing', () => {
    expect(verifySecret('Nairobi', encoded)).toBe(true);
    expect(verifySecret('nairobi', encoded)).toBe(true);
    expect(verifySecret('  nairobi ', encoded)).toBe(true);
    expect(verifySecret('NAIROBI', encoded)).toBe(true);
  });

  it('rejects a different answer', () => {
    expect(verifySecret('Mombasa', encoded)).toBe(false);
    expect(verifySecret('', encoded)).toBe(false);
    expect(verifySecret('Nairobii', encoded)).toBe(false);
  });

  it('rejects malformed or foreign encodings without throwing', () => {
    expect(verifySecret('Nairobi', 'not-a-hash')).toBe(false);
    expect(verifySecret('Nairobi', 'bcrypt$12$aa$bb')).toBe(false);
    expect(verifySecret('Nairobi', 'scrypt$1024$8$1$zz$yy')).toBe(false);
    expect(verifySecret('Nairobi', 'scrypt$1024$8$1')).toBe(false);
    expect(parseSecretHash('scrypt$0$8$1$ab$cd')).toBeNull();
    expect(parseSecretHash('scrypt$1024$x$1$ab$cd')).toBeNull();
  });
});
