import type { Redis } from 'ioredis';

/**
 * In-process stand-in for Redis (Revision 2 addendum, A3 — Redis offline mode).
 *
 * WHY THIS EXISTS
 * ---------------
 * Redis is temporarily disabled in some environments. The catalogs make Redis
 * mandatory (Task 22: `new Redis(await app.secrets.get("UPSTASH_REDIS_URL"))`,
 * with a `SecretProvider` that *throws* on a missing secret), so without a
 * fallback the API cannot even boot. This module supplies the narrow command
 * surface the auth-critical paths actually use, so the API boots and stays
 * correct with Redis absent, and re-enabling Redis requires **zero code
 * changes** — only `UPSTASH_REDIS_URL` plus a restart.
 *
 * WHAT IT BACKS (addendum A3.2 — every Redis-backed feature used by auth)
 * ----------------------------------------------------------------------
 *   · magic-link single-use tokens   `ml:token:<jti>`, `ml:pointer:<email>`
 *   · signup-invite cooldown         `ml:invite:<sha256(email)>`
 *   · MFA challenge + replay cache   `mfa:<handle>`, `emailotp:<userId>`
 *   · signup email OTP               `signup:otp:<sha256(email)>`
 *   · login lockout / attempt count  `rl:*` counters
 *   · session registry               `sess:<sessionId>`
 *   · anti-bot counters              `rl:*` / abuse-guard keys
 *
 * THE SINGLE-INSTANCE CAVEAT (addendum A3.3 — read this before deploying)
 * -----------------------------------------------------------------------
 * State lives in THIS process's heap. It is correct only for a single API
 * instance: two replicas would each hold their own tokens, counters and session
 * cache, so a magic link issued by one could not be redeemed on another, a
 * single-use token could be replayed once per replica, and rate-limit windows
 * would be per-replica rather than global. Never run more than one instance in
 * offline mode. Nothing here is persisted: a restart clears every token,
 * challenge and counter (fail-safe — outstanding links simply die).
 *
 * `publish()` reaches no subscriber, because subscribers would need a real
 * connection; SSE fan-out is degraded to the instance's own clients.
 */

/** One stored key. `expiresAt === null` means "no expiry". */
interface Entry {
  value: string;
  expiresAt: number | null;
}

export interface MemoryRedisOptions {
  /** Injectable clock, so TTL behaviour is testable without waiting. */
  now?: () => number;
}

/**
 * `SET` modifier parsing, mirroring the ioredis variadic call shape
 * `set(key, value, 'EX', seconds, 'NX')` that the stores in this repo use.
 */
interface SetModifiers {
  ttlMs: number | null;
  nx: boolean;
  xx: boolean;
}

function parseSetModifiers(args: unknown[]): SetModifiers {
  const modifiers: SetModifiers = { ttlMs: null, nx: false, xx: false };
  for (let index = 0; index < args.length; index += 1) {
    const flag = String(args[index]).toUpperCase();
    const next = args[index + 1];
    if (flag === 'EX' && next !== undefined) {
      modifiers.ttlMs = Number(next) * 1000;
      index += 1;
    } else if (flag === 'PX' && next !== undefined) {
      modifiers.ttlMs = Number(next);
      index += 1;
    } else if (flag === 'NX') {
      modifiers.nx = true;
    } else if (flag === 'XX') {
      modifiers.xx = true;
    }
  }
  return modifiers;
}

export class MemoryRedis {
  /** Exposed for tests and for the shutdown sweep — mirrors `FLUSHDB`. */
  readonly entries = new Map<string, Entry>();
  /** Exposed for tests: mirrors `FLUSHDB` on a single database. */
  readonly lists = new Map<string, string[]>();

  /** ioredis reports `status`; a few callers branch on it. Always "ready". */
  readonly status = 'ready';

  private readonly now: () => number;

  constructor(options: MemoryRedisOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  /** Drop every expired key. Called lazily on read, like Redis does. */
  private sweep(): void {
    const currentTime = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= currentTime) this.entries.delete(key);
    }
  }

  private read(key: string): Entry | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    return this.read(key)?.value ?? null;
  }

  /** `GETDEL` — the single-use consumption primitive (magic link, pw reset). */
  async getdel(key: string): Promise<string | null> {
    const entry = this.read(key);
    this.entries.delete(key);
    return entry?.value ?? null;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK' | null> {
    const { ttlMs, nx, xx } = parseSetModifiers(args);
    const existing = this.read(key);
    if (nx && existing !== null) return null;
    if (xx && existing === null) return null;
    this.entries.set(key, {
      value: String(value),
      expiresAt: ttlMs === null ? null : this.now() + ttlMs,
    });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.entries.set(key, { value: String(value), expiresAt: this.now() + seconds * 1000 });
    return 'OK';
  }

  /** Variadic like ioredis: `del('a', 'b')` and `del(['a','b'])` both work. */
  async del(...keys: (string | string[])[]): Promise<number> {
    const flat = keys.flat();
    let removed = 0;
    for (const key of flat) {
      if (this.entries.delete(key)) removed += 1;
      if (this.lists.delete(key)) removed += 1;
    }
    return removed;
  }

  async exists(...keys: (string | string[])[]): Promise<number> {
    return keys.flat().filter((key) => this.read(key) !== null).length;
  }

  private bump(key: string, delta: number): Promise<number> {
    const current = this.read(key);
    const next = (current === null ? 0 : Number(current.value)) + delta;
    // An existing TTL is preserved exactly as INCR does — only the value changes.
    this.entries.set(key, {
      value: String(Number.isFinite(next) ? next : delta),
      expiresAt: current?.expiresAt ?? null,
    });
    return Promise.resolve(Number.isFinite(next) ? next : delta);
  }

  async incr(key: string): Promise<number> {
    return this.bump(key, 1);
  }

  async incrby(key: string, amount: number): Promise<number> {
    return this.bump(key, amount);
  }

  async decr(key: string): Promise<number> {
    return this.bump(key, -1);
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.read(key);
    if (entry === null) return 0;
    this.entries.set(key, { value: entry.value, expiresAt: this.now() + seconds * 1000 });
    return 1;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    const entry = this.read(key);
    if (entry === null) return 0;
    this.entries.set(key, { value: entry.value, expiresAt: this.now() + ms });
    return 1;
  }

  /** Remaining seconds; `-2` when the key is absent, `-1` when it never expires. */
  async ttl(key: string): Promise<number> {
    const entry = this.read(key);
    if (entry === null) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - this.now()) / 1000));
  }

  async pttl(key: string): Promise<number> {
    const entry = this.read(key);
    if (entry === null) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, entry.expiresAt - this.now());
  }

  async lpush(key: string, ...values: (string | string[])[]): Promise<number> {
    const list = this.lists.get(key) ?? [];
    list.unshift(...values.flat());
    this.lists.set(key, list);
    return list.length;
  }

  async rpush(key: string, ...values: (string | string[])[]): Promise<number> {
    const list = this.lists.get(key) ?? [];
    list.push(...values.flat());
    this.lists.set(key, list);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    const from = start < 0 ? Math.max(0, list.length + start) : start;
    const to = stop < 0 ? list.length + stop : Math.min(stop, list.length - 1);
    return from > to ? [] : list.slice(from, to + 1);
  }

  async llen(key: string): Promise<number> {
    return (this.lists.get(key) ?? []).length;
  }

  /**
   * No subscriber can be reached in offline mode, so this always reports zero
   * recipients. Callers treat the return value as a delivery count, never as a
   * success flag, so nothing silently "succeeds" here.
   */
  async publish(): Promise<number> {
    return 0;
  }

  async keys(pattern: string): Promise<string[]> {
    this.sweep();
    const expression = new RegExp(
      `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    );
    return [...this.entries.keys()].filter((key) => expression.test(key));
  }

  async flushdb(): Promise<'OK'> {
    this.entries.clear();
    this.lists.clear();
    return 'OK';
  }

  /** Event-emitter no-ops: callers attach `error`/`end` handlers defensively. */
  on(): this {
    return this;
  }

  off(): this {
    return this;
  }

  once(): this {
    return this;
  }

  removeAllListeners(): this {
    return this;
  }

  duplicate(): MemoryRedis {
    // A subscriber connection in offline mode is another view of the same heap.
    return this;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  disconnect(): void {
    // Nothing to tear down: no socket was ever opened.
  }
}

/**
 * The shim typed as an ioredis `Redis`, so `app.redis` keeps one type whether
 * Redis is up or offline and no consumer needs an `undefined` branch.
 *
 * Only the commands above exist. Anything else a future feature reaches for
 * will throw `TypeError: … is not a function` at the call site — loud, immediate
 * and pointing at the exact gap, which is the intended failure mode: it is far
 * safer than a shim that pretends to be a complete Redis.
 */
export function memoryRedis(options: MemoryRedisOptions = {}): Redis {
  return new MemoryRedis(options) as unknown as Redis;
}

/** The single-instance warning every offline boot must log (addendum A3.3). */
export const MEMORY_STORE_CAVEAT =
  'Redis is offline: auth state (magic-link tokens, MFA challenges, OTPs, lockout ' +
  'counters, session registry) is held in this process heap. This is correct ONLY ' +
  'for a single API instance — run exactly one replica, and expect every token and ' +
  'counter to be lost on restart. Set UPSTASH_REDIS_URL and restart to go online.';
