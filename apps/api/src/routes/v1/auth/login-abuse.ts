import { createHash } from 'node:crypto';
import type { KvStore } from './challenge.js';
import { MagicLinkTokenStore } from './magic-link.js';

/**
 * Login-surface abuse controls (Phase 4).
 *
 * Three layers sit under the hard per-IP plugin limit (`public_form`,
 * 5/10min → 429):
 *
 * 1. **Per-address issuance window** — at most `MAGIC_LINK_EMAIL_MAX`
 *    magic-link issuances per address per 15 minutes. Beyond it the request
 *    is SUPPRESSED: the HTTP response stays the identical generic 200, no
 *    email goes out. This is what stops the endpoint being used to mail-bomb
 *    a single mailbox (the invitation leg has its own cooldown for the same
 *    reason).
 * 2. **Per-IP soft limit** — after `SOFT_LIMIT_MAX` requests in 15 minutes
 *    the caller must solve a Turnstile challenge (when server-side
 *    enforcement is on). The response gains `captchaRequired: true`; this
 *    flag depends ONLY on the IP, never on registration status, so the
 *    registered/unregistered bodies remain byte-identical for the same IP.
 * 3. **Bot signals** (honeypot + form timing) are evaluated in the service
 *    before any counter is touched — a dropped bot never consumes budget.
 *
 * Counters are best-effort read-modify-writes over the narrow `KvStore`
 * surface (get/set-EX/del — no INCR): a race can under-count by one, which
 * is acceptable because the plugin hard limit and the per-address window
 * both fail closed on the email side. Keys store only digests, so the KV
 * never becomes a directory of probed addresses or a plaintext IP log.
 */

/** Per-address magic-link issuance budget… */
export const MAGIC_LINK_EMAIL_MAX = 3;
/** …per 15 minutes (the magic-link TTL). */
export const MAGIC_LINK_EMAIL_WINDOW_SECONDS = 15 * 60;

/** Per-IP requests before a Turnstile token is demanded. */
export const SOFT_LIMIT_MAX = 3;
export const SOFT_LIMIT_WINDOW_SECONDS = 15 * 60;

/**
 * Minimum plausible human fill time (form render → submit). Submissions
 * faster than this are dropped silently; a `formTs` in the future beyond
 * `FORM_TS_FUTURE_SKEW_MS` is treated as clock skew and ignored (the signal
 * must never lock a human out because their clock is wrong).
 */
export const MIN_HUMAN_FILL_MS = 1_500;
export const FORM_TS_FUTURE_SKEW_MS = 5 * 60 * 1000;

export const MAGIC_LINK_EMAIL_WINDOW_PREFIX = 'ml:win:';
export const MAGIC_LINK_SOFT_LIMIT_PREFIX = 'ml:soft:';

interface WindowRecord {
  count: number;
  resetAtEpochMs: number;
}

function digestKey(prefix: string, value: string): string {
  return `${prefix}${createHash('sha256').update(value).digest('hex')}`;
}

export interface WindowClaim {
  allowed: boolean;
  /** Seconds until the window resets (Retry-After material). */
  retryAfterSeconds: number;
}

export class LoginAbuseGuard {
  constructor(
    private readonly store: KvStore,
    private readonly now: () => number = () => Date.now(),
  ) {}

  static emailKeyFor(email: string): string {
    // Same normalisation as the token store: trim + lowercase.
    return digestKey(MAGIC_LINK_EMAIL_WINDOW_PREFIX, MagicLinkTokenStore.emailKey(email));
  }

  static ipKeyFor(ip: string): string {
    return digestKey(MAGIC_LINK_SOFT_LIMIT_PREFIX, ip.trim().toLowerCase());
  }

  /** `true` when the form-timing signal says "not a human". */
  static isTooFast(formTs: number | null | undefined, nowMs: number): boolean {
    if (formTs === null || formTs === undefined || !Number.isFinite(formTs)) return false;
    const elapsed = nowMs - formTs;
    // Future beyond sane clock skew → ignore the signal entirely.
    if (elapsed < -FORM_TS_FUTURE_SKEW_MS) return false;
    return elapsed < MIN_HUMAN_FILL_MS;
  }

  /** Consume one unit of the address's issuance budget. */
  emailWindowClaim(email: string): Promise<WindowClaim> {
    return this.claim(
      LoginAbuseGuard.emailKeyFor(email),
      MAGIC_LINK_EMAIL_MAX,
      MAGIC_LINK_EMAIL_WINDOW_SECONDS,
    );
  }

  /** Consume one unit of the IP's soft budget; `true` = over the limit. */
  async softLimitHit(ip: string): Promise<boolean> {
    const claim = await this.claim(
      LoginAbuseGuard.ipKeyFor(ip),
      SOFT_LIMIT_MAX,
      SOFT_LIMIT_WINDOW_SECONDS,
    );
    return !claim.allowed;
  }

  private async claim(key: string, max: number, windowSeconds: number): Promise<WindowClaim> {
    const nowMs = this.now();
    const raw = await this.store.get(key);
    let record: WindowRecord | null = null;
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as WindowRecord;
        if (
          typeof parsed.count === 'number' &&
          typeof parsed.resetAtEpochMs === 'number' &&
          parsed.resetAtEpochMs > nowMs
        ) {
          record = parsed;
        }
      } catch {
        record = null;
      }
    }
    const next: WindowRecord =
      record === null
        ? { count: 1, resetAtEpochMs: nowMs + windowSeconds * 1000 }
        : { count: record.count + 1, resetAtEpochMs: record.resetAtEpochMs };
    const retryAfterSeconds = Math.max(1, Math.ceil((next.resetAtEpochMs - nowMs) / 1000));
    await this.store.set(key, JSON.stringify(next), 'EX', retryAfterSeconds);
    return { allowed: next.count <= max, retryAfterSeconds };
  }
}
