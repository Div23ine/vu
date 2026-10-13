import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Memory-hard hashing for the onboarding recovery answer.
 *
 * The answer is a short, human-chosen secret ("Nairobi"), so a fast hash would be
 * brute-forceable from a database dump. scrypt with N = 2^15 costs roughly 32 MB
 * of memory per attempt, which makes an offline attack expensive while staying
 * well under a second for the single verification a user performs.
 *
 * Encoded form: `scrypt$N$r$p$<hex salt>$<hex hash>`.
 */

export const SCRYPT_N = 2 ** 15;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const KEY_LENGTH = 64;
export const SALT_LENGTH = 16;
export const ALGORITHM = 'scrypt';

export interface SecretHashOptions {
  N?: number;
  r?: number;
  p?: number;
  keyLength?: number;
  /** Test seam: a fixed salt keeps hashes reproducible. */
  salt?: Buffer;
}

export interface ParsedSecretHash {
  algorithm: string;
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/**
 * The answer is compared case-insensitively and with surrounding whitespace
 * removed: `"Nairobi"` and `" nairobi "` are the same secret to the person who
 * typed it, and neither should lock them out.
 */
export function normaliseAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

export function hashSecret(secret: string, options: SecretHashOptions = {}): string {
  const N = options.N ?? SCRYPT_N;
  const r = options.r ?? SCRYPT_R;
  const p = options.p ?? SCRYPT_P;
  const keyLength = options.keyLength ?? KEY_LENGTH;
  const salt = options.salt ?? randomBytes(SALT_LENGTH);

  const hash = scryptSync(normaliseAnswer(secret), salt, keyLength, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  });
  return [ALGORITHM, N, r, p, salt.toString('hex'), hash.toString('hex')].join('$');
}

export function parseSecretHash(encoded: string): ParsedSecretHash | null {
  const parts = encoded.split('$');
  if (parts.length !== 6) return null;
  const [algorithm, nText, rText, pText, saltHex, hashHex] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (algorithm !== ALGORITHM) return null;
  const N = Number(nText);
  const r = Number(rText);
  const p = Number(pText);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (N <= 1 || r <= 0 || p <= 0) return null;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return null;

  return {
    algorithm,
    N,
    r,
    p,
    salt: Buffer.from(saltHex, 'hex'),
    hash: Buffer.from(hashHex, 'hex'),
  };
}

export function isSecretHash(value: string): boolean {
  return parseSecretHash(value) !== null;
}

/**
 * Constant-time comparison. A malformed or foreign-format hash never matches and
 * never throws: the caller gets `false`, not a 500.
 */
export function verifySecret(secret: string, encoded: string): boolean {
  const parsed = parseSecretHash(encoded);
  if (parsed === null) return false;

  const candidate = scryptSync(normaliseAnswer(secret), parsed.salt, parsed.hash.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: 128 * parsed.N * parsed.r * 2,
  });
  if (candidate.length !== parsed.hash.length) return false;
  return timingSafeEqual(candidate, parsed.hash);
}
