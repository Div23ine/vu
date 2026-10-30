import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { MfaMethod } from '@vunvault/contracts';
import type { SupabaseSession } from '../../../lib/supabase-admin.js';

/**
 * The MFA challenge store.
 *
 * Between the password check and the second factor there is a partially
 * authenticated state. It is held server-side in Redis under a random 32-byte
 * handle, for five minutes, and the only thing the browser gets is the handle in
 * an HttpOnly `vv_mfa` cookie.
 *
 * The aal1 Supabase session inside that record is encrypted with AES-256-GCM under
 * a key derived by HKDF-SHA256 from the service-role secret: a Redis compromise
 * must not hand an attacker a usable session.
 */

export const MFA_CHALLENGE_PREFIX = 'mfa:';
export const MFA_CHALLENGE_TTL_SECONDS = 300;
export const MFA_MAX_ATTEMPTS = 5;
export const CHALLENGE_HANDLE_BYTES = 32;
export const HKDF_INFO = 'vv-mfa-challenge';

export const EMAIL_OTP_PREFIX = 'emailotp:';
export const EMAIL_OTP_TTL_SECONDS = 600;
export const EMAIL_OTP_RESEND_SECONDS = 60;
export const EMAIL_OTP_LENGTH = 6;

/**
 * Phase 2: a challenge opened for FORCED first-sign-in MFA setup carries this
 * marker. `deadlineEpochMs` is the close of the administrator's visible 5:00
 * window; `null` means "no deadline" (unenrolled clients are routed to
 * enrolment but never blocked). Absent on ordinary verify challenges.
 */
export interface MfaSetupMarker {
  required: true;
  deadlineEpochMs: number | null;
}

export interface MfaChallenge {
  userId: string;
  email: string;
  remember: boolean;
  attempts: number;
  methods: MfaMethod[];
  /** AES-256-GCM ciphertext of the aal1 session, base64. */
  sessionEnc: string;
  /** Present only on forced-setup challenges (Phase 2). */
  setup?: MfaSetupMarker;
  /**
   * Exponential-backoff lock (Phase 4): until this instant (epoch ms) the
   * challenge refuses verification with 429 + Retry-After instead of burning
   * another attempt. Set from the 2nd failure on: 2s, 4s, 8s…
   */
  lockedUntilEpochMs?: number;
}

/**
 * Backoff seconds after a given failure count: none on the 1st, then
 * 2^(attempts-1) capped at 16s. The 5th failure destroys the challenge
 * outright (`MFA_MAX_ATTEMPTS`), so the cap only shapes attempts 2–4.
 */
export function mfaBackoffSeconds(attempts: number): number {
  if (attempts < 2) return 0;
  return Math.min(16, 2 ** (attempts - 1));
}

/** The narrow Redis surface these stores need. */
export interface KvStore {
  get(key: string): Promise<string | null>;
  /**
   * `nx: 'NX'` makes the write conditional — it resolves `'OK'` only when the
   * key did NOT exist (and was not set), `null` otherwise. This is exactly
   * ioredis' `SET key value EX seconds NX` call shape, so a live Redis satisfies
   * the interface unchanged; `memoryKvStore` implements the same semantics.
   */
  set(key: string, value: string, mode: 'EX', seconds: number, nx?: 'NX'): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface MemoryKvStore extends KvStore {
  entries: Map<string, { value: string; expiresAt: number }>;
}

/** In-memory store for tests and for `NODE_ENV=test`. */
export function memoryKvStore(now: () => number = () => Date.now()): MemoryKvStore {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  return {
    entries,
    async get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, _mode, seconds, nx) {
      if (nx === 'NX') {
        const existing = entries.get(key);
        if (existing !== undefined && existing.expiresAt > now()) return null;
      }
      entries.set(key, { value, expiresAt: now() + seconds * 1000 });
      return 'OK';
    },
    async del(key) {
      entries.delete(key);
      return 1;
    },
  };
}

/** HKDF-SHA256(serviceRoleKey, info = "vv-mfa-challenge") → 32-byte AES key. */
export function deriveChallengeKey(serviceRoleKey: string, salt = ''): Buffer {
  return Buffer.from(hkdfSync('sha256', serviceRoleKey, salt, HKDF_INFO, 32));
}

const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedPayload {
  /** nonce ‖ ciphertext ‖ tag, base64. */
  encoded: string;
}

export function encryptJson(key: Buffer, value: unknown): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]).toString('base64');
}

export function decryptJson<T>(key: Buffer, encoded: string): T {
  const blob = Buffer.from(encoded, 'base64');
  if (blob.length < NONCE_BYTES + TAG_BYTES) throw new Error('encrypted payload is truncated');
  const nonce = blob.subarray(0, NONCE_BYTES);
  const tag = blob.subarray(blob.length - TAG_BYTES);
  const ciphertext = blob.subarray(NONCE_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
}

export interface MfaChallengeStoreOptions {
  store: KvStore;
  key: Buffer;
  ttlSeconds?: number;
  /** Injectable so a test can assert on the handle format. */
  randomHandle?: () => string;
}

export class MfaChallengeStore {
  private readonly store: KvStore;
  private readonly key: Buffer;
  private readonly ttlSeconds: number;
  private readonly randomHandle: () => string;

  constructor(options: MfaChallengeStoreOptions) {
    this.store = options.store;
    this.key = options.key;
    this.ttlSeconds = options.ttlSeconds ?? MFA_CHALLENGE_TTL_SECONDS;
    this.randomHandle =
      options.randomHandle ?? (() => randomBytes(CHALLENGE_HANDLE_BYTES).toString('base64url'));
  }

  static keyFor(handle: string): string {
    return `${MFA_CHALLENGE_PREFIX}${handle}`;
  }

  async create(input: {
    userId: string;
    email: string;
    remember: boolean;
    methods: MfaMethod[];
    session: SupabaseSession;
    setup?: MfaSetupMarker;
  }): Promise<{ handle: string }> {
    const handle = this.randomHandle();
    const challenge: MfaChallenge = {
      userId: input.userId,
      email: input.email,
      remember: input.remember,
      attempts: 0,
      methods: input.methods,
      sessionEnc: encryptJson(this.key, input.session),
      ...(input.setup !== undefined ? { setup: input.setup } : {}),
    };
    await this.store.set(
      MfaChallengeStore.keyFor(handle),
      JSON.stringify(challenge),
      'EX',
      this.ttlSeconds,
    );
    return { handle };
  }

  async read(handle: string): Promise<MfaChallenge | null> {
    const raw = await this.store.get(MfaChallengeStore.keyFor(handle));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as MfaChallenge;
    } catch {
      await this.store.del(MfaChallengeStore.keyFor(handle));
      return null;
    }
  }

  /**
   * Count a failed attempt. From the 2nd failure on, the challenge is also
   * LOCKED for an exponential backoff (`mfaBackoffSeconds`) — verification
   * before the lock expires answers 429 + Retry-After without burning an
   * attempt. At the fifth failure the challenge is destroyed, so a stolen
   * handle cannot be brute-forced for longer than five tries.
   */
  async recordFailure(
    handle: string,
    nowMs: number = Date.now(),
  ): Promise<{ challenge: MfaChallenge | null; exhausted: boolean }> {
    const challenge = await this.read(handle);
    if (challenge === null) return { challenge: null, exhausted: false };

    const attempts = challenge.attempts + 1;
    if (attempts >= MFA_MAX_ATTEMPTS) {
      await this.delete(handle);
      return { challenge: { ...challenge, attempts }, exhausted: true };
    }
    const backoff = mfaBackoffSeconds(attempts);
    const next: MfaChallenge = {
      ...challenge,
      attempts,
      ...(backoff > 0 ? { lockedUntilEpochMs: nowMs + backoff * 1000 } : {}),
    };
    await this.store.set(
      MfaChallengeStore.keyFor(handle),
      JSON.stringify(next),
      'EX',
      this.ttlSeconds,
    );
    return { challenge: next, exhausted: false };
  }

  async delete(handle: string): Promise<void> {
    await this.store.del(MfaChallengeStore.keyFor(handle));
  }

  /** The aal1 session, decrypted. Throws when the payload has been tampered with. */
  decryptSession(challenge: MfaChallenge): SupabaseSession {
    return decryptJson<SupabaseSession>(this.key, challenge.sessionEnc);
  }
}

export const MFA_SETUP_USER_PREFIX = 'mfasetup:u:';
export const MFA_SETUP_HANDLE_PREFIX = 'mfasetup:h:';
/** Long enough for lazy expiry detection; the window itself is 5 minutes. */
export const MFA_SETUP_RECORD_TTL_SECONDS = 24 * 60 * 60;

/**
 * The forced-setup ledger (Phase 2).
 *
 * The setup WINDOW is the challenge TTL (5 minutes); this record OUTLIVES the
 * challenge so a missed window can still be detected lazily — on the next
 * setup call with the dead handle, or on the next magic-link request — and
 * turned into `blocked_mfa_setup`. Two keys per open window (by user and by
 * handle) so either side can find the record; blocking or completing deletes
 * both, which is also what makes a super-admin unblock safe without KV access
 * (a blocked account never has a live record left behind it).
 *
 * Only TIMED windows (administrators) are recorded: a client enrolment has no
 * deadline and no block, so it needs no ledger.
 */
export interface MfaSetupRecord {
  handle: string;
  userId: string;
  email: string;
  deadlineEpochMs: number;
  createdAtEpochMs: number;
}

export class MfaSetupStore {
  constructor(private readonly store: KvStore) {}

  /** Open (or replace) the timed setup window for an administrator. */
  async open(record: MfaSetupRecord): Promise<void> {
    const encoded = JSON.stringify(record);
    await this.store.set(
      `${MFA_SETUP_USER_PREFIX}${record.userId}`,
      encoded,
      'EX',
      MFA_SETUP_RECORD_TTL_SECONDS,
    );
    await this.store.set(
      `${MFA_SETUP_HANDLE_PREFIX}${record.handle}`,
      encoded,
      'EX',
      MFA_SETUP_RECORD_TTL_SECONDS,
    );
  }

  async forUser(userId: string): Promise<MfaSetupRecord | null> {
    return this.read(`${MFA_SETUP_USER_PREFIX}${userId}`);
  }

  async forHandle(handle: string): Promise<MfaSetupRecord | null> {
    return this.read(`${MFA_SETUP_HANDLE_PREFIX}${handle}`);
  }

  /** Delete both keys. Safe to call with a stale/unknown record. */
  async clear(record: Pick<MfaSetupRecord, 'userId' | 'handle'>): Promise<void> {
    await this.store.del(`${MFA_SETUP_USER_PREFIX}${record.userId}`);
    await this.store.del(`${MFA_SETUP_HANDLE_PREFIX}${record.handle}`);
  }

  private async read(key: string): Promise<MfaSetupRecord | null> {
    const raw = await this.store.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as MfaSetupRecord;
    } catch {
      await this.store.del(key);
      return null;
    }
  }
}

/** Six-digit email OTP: only the SHA-256 digest is stored. */
export class EmailOtpStore {
  constructor(
    private readonly store: KvStore,
    private readonly options: { ttlSeconds?: number; resendSeconds?: number } = {},
  ) {}

  private ttl(): number {
    return this.options.ttlSeconds ?? EMAIL_OTP_TTL_SECONDS;
  }

  private resendWindow(): number {
    return this.options.resendSeconds ?? EMAIL_OTP_RESEND_SECONDS;
  }

  static codeHash(code: string): string {
    return digest(code);
  }

  async issue(userId: string, code: string): Promise<void> {
    await this.store.set(
      `${EMAIL_OTP_PREFIX}${userId}`,
      JSON.stringify({ hash: EmailOtpStore.codeHash(code), sentAt: Date.now() }),
      'EX',
      this.ttl(),
    );
  }

  async verify(userId: string, code: string): Promise<boolean> {
    const raw = await this.store.get(`${EMAIL_OTP_PREFIX}${userId}`);
    if (raw === null) return false;
    const stored = JSON.parse(raw) as { hash: string; sentAt: number };
    const candidate = Buffer.from(EmailOtpStore.codeHash(code));
    const expected = Buffer.from(stored.hash);
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  }

  /** At most one send per minute per user. */
  async canSend(userId: string): Promise<boolean> {
    const raw = await this.store.get(`${EMAIL_OTP_PREFIX}${userId}`);
    if (raw === null) return true;
    const stored = JSON.parse(raw) as { sentAt: number };
    return Date.now() - stored.sentAt >= this.resendWindow() * 1000;
  }

  async clear(userId: string): Promise<void> {
    await this.store.del(`${EMAIL_OTP_PREFIX}${userId}`);
  }
}

function digest(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/** A cryptographically random six-digit code, never `000000`-biased. */
export function generateOtpCode(): string {
  const value = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(value).padStart(EMAIL_OTP_LENGTH, '0');
}

/** Session ids are ours, not Supabase's, so a revoked row can be found locally. */
export function newSessionId(): string {
  return randomUUID();
}
