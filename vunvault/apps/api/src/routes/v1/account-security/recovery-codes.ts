import { createHash, randomInt, randomUUID } from 'node:crypto';

/**
 * Recovery codes.
 *
 * Crockford base32 without I, L, O and U, so a code read aloud over the phone
 * cannot be mistyped into a different valid code. Twelve characters, shown as
 * `XXXX-XXXX-XXXX`, ten per batch.
 *
 * Only `sha256(normalised)` is ever stored. The plaintext exists for the few
 * seconds between generation and the response, and is never logged, never audited
 * and never written to `details`.
 */

export const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_CODE_LENGTH = 12;
export const RECOVERY_GROUP_LENGTH = 4;
export const RECOVERY_BATCH_SIZE = 10;
export const RECOVERY_CODE_PATTERN =
  /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** `O→0`, `I`/`L→1`: the characters the alphabet deliberately omits. */
const LOOKALIKES: Record<string, string> = { O: '0', I: '1', L: '1' };

/** Strip every separator, then re-insert the dashes in groups of four. */
export function normalise(code: string): string {
  const cleaned = code
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .split('')
    .map((character) => LOOKALIKES[character] ?? character)
    .join('');

  const groups: string[] = [];
  for (let index = 0; index < cleaned.length; index += RECOVERY_GROUP_LENGTH) {
    groups.push(cleaned.slice(index, index + RECOVERY_GROUP_LENGTH));
  }
  return groups.join('-');
}

export function isValidRecoveryCode(code: string): boolean {
  return RECOVERY_CODE_PATTERN.test(normalise(code));
}

/** One code, from `crypto.randomInt` — never `Math.random`. */
export function generateRecoveryCode(): string {
  let raw = '';
  for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
    raw += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  }
  return normalise(raw);
}

/** A batch of distinct codes. */
export function generateRecoveryBatch(size = RECOVERY_BATCH_SIZE): string[] {
  const codes = new Set<string>();
  // Bounded: a collision costs one extra draw, not an infinite loop.
  for (let attempt = 0; codes.size < size && attempt < size * 100; attempt += 1) {
    codes.add(generateRecoveryCode());
  }
  if (codes.size < size) throw new Error('could not generate a unique recovery-code batch');
  return [...codes];
}

/** The only form of a code that touches the database. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalise(code), 'utf8').digest('hex');
}

export function newBatchId(): string {
  return randomUUID();
}
