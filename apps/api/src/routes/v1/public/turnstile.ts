import { HttpError } from '../../../lib/http-error.js';

/**
 * Cloudflare Turnstile verification for the public contact form.
 *
 * The form is the one place on the platform where an anonymous stranger can make
 * the API write a row and send an email, so it is the one place a bot check earns
 * its keep. It is switched by `TURNSTILE_ENFORCE`: when enforcement is off the
 * token is ignored, which is what development and the test suite need, and what a
 * staging environment without a Turnstile site key needs.
 *
 * Verification FAILS CLOSED when it is on: an unreachable Cloudflare endpoint
 * refuses the submission rather than waving it through, because the alternative is
 * that taking Cloudflare down takes the platform's spam defence down with it.
 */

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TIMEOUT_MS = 5_000;

/** Set to `true` to require a valid token on the public form. */
export function turnstileEnforced(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.TURNSTILE_ENFORCE?.toLowerCase() === 'true';
}

export interface TurnstileVerifier {
  /** Throws `400 captcha_failed` when enforcement is on and the token is bad. */
  assertHuman(token: string | undefined): Promise<void>;
}

export interface HttpTurnstileOptions {
  secretKey?: string;
  /** Test seam. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  enforced?: boolean;
  log?: { warn: (message: string, error?: unknown) => void };
}

interface SiteVerifyResponse {
  success?: boolean;
  'error-codes'?: string[];
}

export class HttpTurnstileVerifier implements TurnstileVerifier {
  private readonly secretKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly enforced: boolean;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(options: HttpTurnstileOptions = {}) {
    this.secretKey = options.secretKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? TURNSTILE_TIMEOUT_MS;
    this.enforced = options.enforced ?? false;
    this.warn = options.log?.warn.bind(options.log) ?? ((): undefined => undefined);
  }

  async assertHuman(token: string | undefined): Promise<void> {
    if (!this.enforced) return;
    if (token === undefined || token === '') throw captchaFailed('missing token');
    if (this.secretKey === undefined || this.secretKey === '') {
      // Enforced with no secret is a misconfiguration, not a visitor's problem —
      // but it must not silently accept everything either.
      this.warn('Turnstile is enforced with no secret key configured');
      throw captchaFailed('verifier misconfigured');
    }

    let response: Response;
    try {
      response = await this.fetchImpl(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: this.secretKey, response: token }).toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      this.warn('Turnstile verification unreachable', error);
      throw captchaFailed('unreachable');
    }
    if (!response.ok) {
      this.warn(`Turnstile answered ${response.status}`);
      throw captchaFailed(`upstream ${response.status}`);
    }

    const body = (await response.json().catch(() => null)) as SiteVerifyResponse | null;
    if (body?.success !== true) {
      throw captchaFailed((body?.['error-codes'] ?? []).join(',') || 'rejected');
    }
  }
}

/** A verifier for tests and development: everybody is human. */
export const ALWAYS_HUMAN: TurnstileVerifier = { assertHuman: async () => undefined };

/**
 * One refusal for every verification failure. The reason is for the log, never for
 * the response: telling a bot which check it failed is an invitation to try the
 * next one.
 */
export function captchaFailed(reason: string): HttpError {
  void reason;
  return new HttpError(400, 'captcha_failed', 'The human-verification check did not pass');
}
