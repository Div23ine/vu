import { createHash } from 'node:crypto';

/**
 * Have I Been Pwned password check, k-anonymous.
 *
 * Only the first five hex characters of the SHA-1 digest ever leave the process;
 * the suffix is compared locally. On a timeout or a 5xx the check FAILS OPEN — a
 * third-party outage must not lock every user out of signup — and the failure is
 * logged so the gap is visible.
 */

export const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
export const BREACH_TIMEOUT_MS = 3000;
export const BREACH_PREFIX_LENGTH = 5;

export interface BreachCheck {
  isBreached(password: string): Promise<boolean>;
}

export interface BreachCheckOptions {
  fetchImpl?: typeof fetch;
  warn?: (message: string, error?: unknown) => void;
  timeoutMs?: number;
}

export function sha1Hex(value: string): string {
  return createHash('sha1').update(value, 'utf8').digest('hex');
}

export class HibpBreachCheck implements BreachCheck {
  private readonly fetchImpl: typeof fetch;
  private readonly warn: (message: string, error?: unknown) => void;
  private readonly timeoutMs: number;

  constructor(options: BreachCheckOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.warn = options.warn ?? (() => undefined);
    this.timeoutMs = options.timeoutMs ?? BREACH_TIMEOUT_MS;
  }

  async isBreached(password: string): Promise<boolean> {
    const digest = sha1Hex(password).toUpperCase();
    const prefix = digest.slice(0, BREACH_PREFIX_LENGTH);
    const suffix = digest.slice(BREACH_PREFIX_LENGTH);

    let response: Response;
    try {
      response = await this.fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.warn('password breach check unavailable; failing open', error);
      return false;
    }

    if (!response.ok) {
      this.warn(`password breach check returned ${response.status}; failing open`);
      return false;
    }

    const body = await response.text().catch(() => '');
    return body.split(/\r?\n/).some((line) => line.toUpperCase().startsWith(`${suffix}:`));
  }
}

/** Development/test double: nothing is ever breached. */
export const NO_BREACH_CHECK: BreachCheck = { isBreached: async () => false };
