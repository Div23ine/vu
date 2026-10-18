import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { KvStore } from './challenge.js';

/**
 * The signup email-OTP store (Task 40d).
 *
 * Signup is a verified flow: `POST /auth/signup` writes a `pending_verification`
 * profile and emails a six-digit code; only `POST /auth/signup/verify-email`
 * activates the account. This module owns the code's whole life:
 *
 *  - the key is `signup:otp:<sha256(lower(email))>` — the address itself is not a
 *    Redis key, matching how every other identifier is stored;
 *  - only `sha256(code)` is kept, never the code;
 *  - the record lives for ten minutes and five wrong codes destroy it, so a code
 *    cannot be brute-forced for longer than five tries;
 *  - a resend is allowed at most once per thirty seconds and rotates the code,
 *    which invalidates the previous email.
 *
 * Deliberately NOT the MFA `EmailOtpStore` in `challenge.ts`: that one is keyed by
 * user id, throttled to 60 s and has no attempt budget. Two stores, two purposes,
 * one file each.
 */

export const SIGNUP_OTP_PREFIX = 'signup:otp:';
export const SIGNUP_OTP_TTL_SECONDS = 600;
export const SIGNUP_OTP_MAX_ATTEMPTS = 5;
export const SIGNUP_OTP_RESEND_SECONDS = 30;
export const SIGNUP_OTP_LENGTH = 6;

export interface SignupOtpRecord {
  codeHash: string;
  attempts: number;
  /** Epoch ms of the last send; drives the 30 s resend cooldown. */
  sentAt: number;
}

export type SignupOtpVerifyResult =
  | { status: 'verified' }
  | { status: 'invalid'; attempts: number }
  | { status: 'exhausted' }
  | { status: 'expired' };

export function signupOtpKey(email: string): string {
  const digest = createHash('sha256').update(email.trim().toLowerCase(), 'utf8').digest('hex');
  return `${SIGNUP_OTP_PREFIX}${digest}`;
}

export function signupCodeHash(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/** Six random digits from `crypto.randomInt` — uniform, never `Math.random`. */
export function generateSignupCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(SIGNUP_OTP_LENGTH, '0');
}

function digestsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export interface SignupOtpStoreOptions {
  ttlSeconds?: number;
  resendSeconds?: number;
  /** Test seam: a deterministic code. */
  randomCode?: () => string;
  /** Test seam: the clock `sentAt` and the remaining TTL are computed from. */
  now?: () => number;
}

export class SignupOtpStore {
  private readonly store: KvStore;
  private readonly options: SignupOtpStoreOptions;

  constructor(store: KvStore, options: SignupOtpStoreOptions = {}) {
    this.store = store;
    this.options = options;
  }

  private ttl(): number {
    return this.options.ttlSeconds ?? SIGNUP_OTP_TTL_SECONDS;
  }

  private resendWindow(): number {
    return this.options.resendSeconds ?? SIGNUP_OTP_RESEND_SECONDS;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  /** Issue (or rotate) the code for an address. The raw code goes ONLY to the caller's email. */
  async issue(email: string): Promise<{ code: string }> {
    const code = this.options.randomCode ?? generateSignupCode;
    const raw = code();
    const record: SignupOtpRecord = {
      codeHash: signupCodeHash(raw),
      attempts: 0,
      sentAt: this.now(),
    };
    await this.store.set(signupOtpKey(email), JSON.stringify(record), 'EX', this.ttl());
    return { code: raw };
  }

  /**
   * Check a submitted code. Wrong codes increment the budget; the fifth destroys
   * the record, so `exhausted` and `expired` are both terminal — only a fresh
   * signup (or a resend) can open a new one.
   */
  async verify(email: string, code: string): Promise<SignupOtpVerifyResult> {
    const key = signupOtpKey(email);
    const raw = await this.store.get(key);
    if (raw === null) return { status: 'expired' };

    let record: SignupOtpRecord;
    try {
      record = JSON.parse(raw) as SignupOtpRecord;
    } catch {
      await this.store.del(key);
      return { status: 'expired' };
    }

    if (digestsMatch(record.codeHash, signupCodeHash(code))) return { status: 'verified' };

    const attempts = record.attempts + 1;
    if (attempts >= SIGNUP_OTP_MAX_ATTEMPTS) {
      await this.store.del(key);
      return { status: 'exhausted' };
    }

    // Counting a failure must not extend the code's life: the remaining TTL is
    // what is left of the original ten minutes, never a fresh window.
    const elapsedSeconds = Math.floor((this.now() - record.sentAt) / 1000);
    const remaining = Math.max(1, this.ttl() - elapsedSeconds);
    await this.store.set(key, JSON.stringify({ ...record, attempts }), 'EX', remaining);
    return { status: 'invalid', attempts };
  }

  /** The 30 s cooldown: false while a code younger than the window is live. */
  async canResend(email: string): Promise<boolean> {
    const raw = await this.store.get(signupOtpKey(email));
    if (raw === null) return true;
    try {
      const record = JSON.parse(raw) as SignupOtpRecord;
      return this.now() - record.sentAt >= this.resendWindow() * 1000;
    } catch {
      return true;
    }
  }

  async clear(email: string): Promise<void> {
    await this.store.del(signupOtpKey(email));
  }
}
