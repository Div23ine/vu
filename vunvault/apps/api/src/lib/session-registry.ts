import type { Db } from '@vunvault/db';

/**
 * Session and account state lookups, cached in Redis.
 *
 * A JWT is valid for an hour, but a suspension, a soft delete or a revoked device
 * session must take effect immediately. So every authenticated request checks this
 * registry: a 30-second Redis cache keeps the cost at one round trip per session
 * per half minute, and a miss reads the two authoritative rows
 * (`user_sessions`, `profiles`).
 */

/** Cache lifetime. Long enough to matter, short enough that a suspension lands. */
export const SESSION_CACHE_TTL_SECONDS = 30;

/** `last_seen_at` is written at most once per minute per session. */
export const LAST_SEEN_THROTTLE_SECONDS = 60;

export interface SessionRecord {
  sessionId: string;
  userId: string;
  revokedAt: string | null;
  /** In-house WebAuthn / email-OTP verifications are recorded here, not in Supabase. */
  mfaMethod: string | null;
  accountStatus: string;
  deletedAt: string | null;
}

/** The narrow Redis surface the registry needs — trivially fakeable in tests. */
export interface CacheLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/** The narrow driver surface, so the API needs no direct `drizzle-orm` import. */
interface SqlClient {
  unsafe: <T = unknown>(query: string, params?: unknown[]) => Promise<T>;
}

export type SessionLookup = (sessionId: string) => Promise<SessionRecord | null>;

interface SessionRow {
  session_id: string;
  user_id: string;
  revoked_at: Date | string | null;
  mfa_method: string | null;
  account_status: string;
  deleted_at: Date | string | null;
}

const LOOKUP_SQL = `
  select s.id::text          as session_id,
         s.user_id::text     as user_id,
         s.revoked_at,
         s.mfa_method,
         p.account_status,
         p.deleted_at
    from user_sessions s
    join profiles p on p.id = s.user_id
   where s.id = $1::uuid
   limit 1
`;

/** Read the authoritative rows straight from the driver. */
export function createDbSessionLookup(db: Db): SessionLookup {
  const client = (db as { $client?: SqlClient }).$client;
  if (client === undefined) throw new Error('database client is not available');

  return async (sessionId) => {
    const rows = await client.unsafe<SessionRow[]>(LOOKUP_SQL, [sessionId]);
    const row = rows[0];
    if (row === undefined) return null;
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
      mfaMethod: row.mfa_method,
      accountStatus: row.account_status,
      deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at).toISOString(),
    };
  };
}

export interface SessionRegistryOptions {
  lookup: SessionLookup;
  cache?: CacheLike;
  ttlSeconds?: number;
  now?: () => number;
  /** Writes `user_sessions.last_seen_at`; omitted in tests. */
  touch?: (sessionId: string, at: Date) => Promise<void>;
}

export class SessionRegistry {
  private readonly lookup: SessionLookup;
  private readonly cache?: CacheLike;
  private readonly ttlSeconds: number;
  private readonly now: () => number;
  private readonly touch?: (sessionId: string, at: Date) => Promise<void>;
  private readonly lastSeenAt = new Map<string, number>();

  constructor(options: SessionRegistryOptions) {
    this.lookup = options.lookup;
    this.cache = options.cache;
    this.ttlSeconds = options.ttlSeconds ?? SESSION_CACHE_TTL_SECONDS;
    this.now = options.now ?? (() => Date.now());
    this.touch = options.touch;
  }

  static key(sessionId: string): string {
    return `sess:${sessionId}`;
  }

  async get(sessionId: string): Promise<SessionRecord | null> {
    const key = SessionRegistry.key(sessionId);

    if (this.cache !== undefined) {
      const cached = await this.cache.get(key);
      if (cached !== null) {
        try {
          return JSON.parse(cached) as SessionRecord;
        } catch {
          await this.cache.del(key);
        }
      }
    }

    const record = await this.lookup(sessionId);
    if (record !== null && this.cache !== undefined) {
      await this.cache.set(key, JSON.stringify(record), 'EX', this.ttlSeconds);
    }
    return record;
  }

  /** Drop a cached record so a revocation takes effect on the next request. */
  async invalidate(sessionId: string): Promise<void> {
    this.lastSeenAt.delete(sessionId);
    if (this.cache === undefined) return;
    await this.cache.del(SessionRegistry.key(sessionId));
  }

  /**
   * Fire-and-forget `last_seen_at` update, at most once per minute per session.
   * A roster screen reads this; it must never slow a request down or fail one.
   */
  noteActivity(sessionId: string): void {
    if (this.touch === undefined) return;
    const now = this.now();
    const previous = this.lastSeenAt.get(sessionId);
    if (previous !== undefined && now - previous < LAST_SEEN_THROTTLE_SECONDS * 1000) return;
    this.lastSeenAt.set(sessionId, now);
    void this.touch(sessionId, new Date(now)).catch(() => undefined);
  }
}
