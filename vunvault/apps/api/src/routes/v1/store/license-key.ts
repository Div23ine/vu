import { randomInt } from 'node:crypto';
import { LICENSE_KEY_PATTERN } from '@vunvault/contracts';

/**
 * Licence keys.
 *
 * `VV-XXXX-XXXX-XXXX-XXXX` in Crockford base32: the alphabet drops I, L, O and U so
 * a key read aloud over a support call cannot be mistaken for 1, 1, 0 or V. Every
 * character comes from `crypto.randomInt`, which is uniform and CSPRNG-backed — a
 * key is a bearer credential for a paid download, so it is generated like one.
 *
 * 32^16 keys means a collision is not a design concern, but the database has a
 * UNIQUE constraint anyway and the caller retries, because "almost never" is not a
 * property you want to discover in production.
 */

/** Crockford base32: 0-9 and A-Z without I, L, O, U. */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const LICENSE_KEY_GROUPS = 4;
export const LICENSE_KEY_GROUP_LENGTH = 4;
export const LICENSE_KEY_PREFIX = 'VV';
/** Retries before giving up on a collision that should not happen. */
export const LICENSE_KEY_MAX_ATTEMPTS = 5;

function randomCharacter(): string {
  const index = randomInt(0, CROCKFORD_ALPHABET.length);
  return CROCKFORD_ALPHABET[index] ?? '0';
}

function randomGroup(): string {
  let group = '';
  for (let character = 0; character < LICENSE_KEY_GROUP_LENGTH; character += 1) {
    group += randomCharacter();
  }
  return group;
}

/** One key, e.g. `VV-2B7Q-XK4M-9RTH-3WD6`. */
export function generateLicenseKey(): string {
  const groups: string[] = [];
  for (let group = 0; group < LICENSE_KEY_GROUPS; group += 1) groups.push(randomGroup());
  return `${LICENSE_KEY_PREFIX}-${groups.join('-')}`;
}

/**
 * A key that is not already taken.
 *
 * `isTaken` is awaited between attempts so the check runs against the same
 * transaction that will insert the row.
 */
export async function generateUniqueLicenseKey(
  isTaken: (key: string) => Promise<boolean>,
  maxAttempts: number = LICENSE_KEY_MAX_ATTEMPTS,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const key = generateLicenseKey();
    if (!(await isTaken(key))) return key;
  }
  throw new Error('could not generate a unique licence key');
}

export function isLicenseKey(value: string): boolean {
  return LICENSE_KEY_PATTERN.test(value);
}
