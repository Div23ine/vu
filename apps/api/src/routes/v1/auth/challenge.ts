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

export interface MfaChallenge {
  userId: string;
  email: string;
  remember: boolean;
  attempts: number;
  methods: MfaMethod[];
  /** AES-256-GCM ciphertext of the aal1 session, base64. */
  sessionEnc: string;
}

/** The narrow Redis surface these stores need. */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
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
    async set(key, value, _mode, seconds) {
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
  }): Promise<{ handle: string }> {
    const handle = this.randomHandle();
    const challenge: MfaChallenge = {
      userId: input.userId,
      email: input.email,
      remember: input.remember,
      attempts: 0,
      methods: input.methods,
      sessionEnc: encryptJson(this.key, input.session),
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
   * Count a failed attempt. At the fifth failure the challenge is destroyed, so a
   * stolen handle cannot be brute-forced for longer than five tries.
   */
  async recordFailure(
    handle: string,
  ): Promise<{ challenge: MfaChallenge | null; exhausted: boolean }> {
    const challenge = await this.read(handle);
    if (challenge === null) return { challenge: null, exhausted: false };

    const attempts = challenge.attempts + 1;
    if (attempts >= MFA_MAX_ATTEMPTS) {
      await this.delete(handle);
      return { challenge: { ...challenge, attempts }, exhausted: true };
    }
    await this.store.set(
      MfaChallengeStore.keyFor(handle),
      JSON.stringify({ ...challenge, attempts }),
      'EX',
      this.ttlSeconds,
    );
    return { challenge: { ...challenge, attempts }, exhausted: false };
  }

  async delete(handle: string): Promise<void> {
    await this.store.del(MfaChallengeStore.keyFor(handle));
  }

  /** The aal1 session, decrypted. Throws when the payload has been tampered with. */
  decryptSession(challenge: MfaChallenge): SupabaseSession {
    return decryptJson<SupabaseSession>(this.key, challenge.sessionEnc);
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
