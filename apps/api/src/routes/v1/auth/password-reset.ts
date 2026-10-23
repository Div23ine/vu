import { createHash, randomBytes } from 'node:crypto';
import type { KvStore } from './challenge';

/**
 * The password-reset token store (Task 40d).
 *
 * A reset token is 32 random bytes, base64url — 43 characters of unguessable —
 * and only its SHA-256 is kept, under `pwreset:<sha256(token)>`, for thirty
 * minutes. Consumption is atomic: the lookup DELETES the record in the same step
 * (Redis `GETDEL` where the client offers it, get-then-delete otherwise), so a
 * token is single-use even against two concurrent requests.
 *
 * A user may hold at most three live tokens: requesting a fourth evicts the
 * oldest, which keeps "I clicked forgot-password three times" working while
 * bounding how many live links one mailbox can accumulate. The per-user index
 * lives beside the tokens under `pwreset:idx:<userId>` with the same TTL.
 */

export const PWRESET_PREFIX = 'pwreset:';
export const PWRESET_INDEX_PREFIX = 'pwreset:idx:';
export const PWRESET_TTL_SECONDS = 1800;
export const PWRESET_MAX_LIVE_TOKENS = 3;
export const PWRESET_TOKEN_BYTES = 32;

/** The narrow Redis surface, extended with the atomic read-and-delete. */
export interface ResetKvStore extends KvStore {
  /** Redis `GETDEL`. Optional: the fallback is `get` then `del`. */
  getDel?(key: string): Promise<string | null>;
}

export function resetTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateResetToken(): string {
  return randomBytes(PWRESET_TOKEN_BYTES).toString('base64url');
}

interface IndexEntry {
  hash: string;
  at: number;
}

export interface PasswordResetStoreOptions {
  ttlSeconds?: number;
  /** Test seam: a deterministic token. */
  randomToken?: () => string;
  /** Test seam: the clock the index and pruning are computed from. */
  now?: () => number;
}

export class PasswordResetStore {
  private readonly store: ResetKvStore;
  private readonly options: PasswordResetStoreOptions;

  constructor(store: ResetKvStore, options: PasswordResetStoreOptions = {}) {
    this.store = store;
    this.options = options;
  }

  private ttl(): number {
    return this.options.ttlSeconds ?? PWRESET_TTL_SECONDS;
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  /** Mint a token for the user, pruning dead entries and evicting the oldest beyond three. */
  async issue(userId: string): Promise<{ token: string }> {
    const token = (this.options.randomToken ?? generateResetToken)();
    const hash = resetTokenHash(token);
    const indexKey = `${PWRESET_INDEX_PREFIX}${userId}`;
    const at = this.now();

    const raw = await this.store.get(indexKey);
    let entries: IndexEntry[] = [];
    if (raw !== null) {
      try {
        entries = JSON.parse(raw) as IndexEntry[];
      } catch {
        entries = [];
      }
    }

    const cutoff = at - this.ttl() * 1000;
    const live = entries.filter((entry) => entry.at > cutoff);
    for (const dead of entries.filter((entry) => entry.at <= cutoff)) {
      await this.store.del(`${PWRESET_PREFIX}${dead.hash}`);
    }
    while (live.length >= PWRESET_MAX_LIVE_TOKENS) {
      const oldest = live.shift();
      if (oldest !== undefined) await this.store.del(`${PWRESET_PREFIX}${oldest.hash}`);
    }
    live.push({ hash, at });

    await this.store.set(`${PWRESET_PREFIX}${hash}`, JSON.stringify({ userId }), 'EX', this.ttl());
    await this.store.set(indexKey, JSON.stringify(live), 'EX', this.ttl());
    return { token };
  }

  /**
   * Look the token up and destroy it in one atomic step. `null` covers every
   * failure the caller must not distinguish: unknown, already used, expired.
   */
  async consume(token: string): Promise<{ userId: string } | null> {
    const key = `${PWRESET_PREFIX}${resetTokenHash(token)}`;
    const raw =
      this.store.getDel !== undefined ? await this.store.getDel(key) : await this.getThenDel(key);
    if (raw === null) return null;
    try {
      const record = JSON.parse(raw) as { userId: string };
      return typeof record.userId === 'string' && record.userId !== '' ? record : null;
    } catch {
      return null;
    }
  }

  private async getThenDel(key: string): Promise<string | null> {
    const raw = await this.store.get(key);
    if (raw !== null) await this.store.del(key);
    return raw;
  }
}
