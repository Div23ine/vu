import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { KvStore } from './challenge.js';

/**
 * Magic-link tokens (Phase 1).
 *
 * A token is `base64url(payload).base64url(HMAC-SHA256(secret, payload))` where
 * the payload binds the email, the purpose (`magic_link`), a random jti and an
 * expiry. Signature validation happens BEFORE any storage read, so a forged
 * token never touches Redis. Single-use is enforced by consuming the jti
 * atomically with `GETDEL`-equivalent semantics: reading and deleting are one
 * round-trip on stores that support it; on plain KV stores the delete is issued
 * before verification work continues, and the record is destroyed either way.
 *
 * Issuing a new link for an email invalidates the previous one (the jti pointer
 * is overwritten), exactly as the work order requires.
 */

export const MAGIC_LINK_PURPOSE = 'magic_link' as const;
export const MAGIC_LINK_TTL_SECONDS = 15 * 60; // spec: TTL 10–15 min
const MAGIC_POINTER_PREFIX = 'ml:pointer:'; // ml:pointer:<emailHash> → active jti
const MAGIC_TOKEN_PREFIX = 'ml:token:'; // ml:token:<jti> → signed payload

export interface MagicLinkPayload {
  email: string;
  purpose: typeof MAGIC_LINK_PURPOSE;
  jti: string;
  /** Epoch seconds after which the token is dead. */
  exp: number;
}

export type ConsumeResult =
  | { status: 'valid'; payload: MagicLinkPayload }
  | { status: 'invalid' } // bad signature / malformed
  | { status: 'expired' } // past exp, or no live record
  | { status: 'used' }; // consumed already, or superseded by a newer link

function b64u(value: Buffer | string): string {
  return Buffer.from(value as never).toString('base64url');
}

function fromB64u(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Compare against itself to keep the timing of the mismatch path constant.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export class MagicLinkTokenStore {
  constructor(
    private readonly store: KvStore,
    private readonly secret: string,
    private readonly ttlSeconds: number = MAGIC_LINK_TTL_SECONDS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  static emailKey(email: string): string {
    return email.trim().toLowerCase();
  }

  private sign(payloadB64: string): string {
    return createHmac('sha256', this.secret).update(payloadB64, 'utf8').digest('base64url');
  }

  /** Verify the HMAC without touching storage. Null when the signature is wrong. */
  private verifySignature(token: string): MagicLinkPayload | null {
    const dot = token.lastIndexOf('.');
    if (dot <= 0 || dot === token.length - 1) return null;
    const payloadB64 = token.slice(0, dot);
    const providedSig = token.slice(dot + 1);
    const expectedSig = this.sign(payloadB64);
    if (!safeEqualHex(providedSig, expectedSig)) return null;
    try {
      const payload = JSON.parse(fromB64u(payloadB64).toString('utf8')) as MagicLinkPayload;
      if (payload.purpose !== MAGIC_LINK_PURPOSE || typeof payload.email !== 'string') return null;
      if (typeof payload.jti !== 'string' || typeof payload.exp !== 'number') return null;
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Issue a single-use token for `email`. Any previously issued link for the
   * same address stops working (its pointer is replaced and its record deleted).
   */
  async issue(email: string): Promise<{ token: string; expiresInSeconds: number }> {
    const normalized = MagicLinkTokenStore.emailKey(email);
    const jti = randomBytes(16).toString('base64url');
    const exp = Math.floor((this.now() + this.ttlSeconds * 1000) / 1000);
    const payload: MagicLinkPayload = { email: normalized, purpose: MAGIC_LINK_PURPOSE, jti, exp };
    const payloadB64 = b64u(JSON.stringify(payload));
    const token = `${payloadB64}.${this.sign(payloadB64)}`;

    // Invalidate the previous link for this address first.
    const previousJti = await this.store.get(`${MAGIC_POINTER_PREFIX}${normalized}`);
    if (previousJti !== null) {
      await this.store.del(`${MAGIC_TOKEN_PREFIX}${previousJti}`);
    }

    await this.store.set(
      `${MAGIC_TOKEN_PREFIX}${jti}`,
      token,
      'EX',
      this.ttlSeconds,
    );
    await this.store.set(`${MAGIC_POINTER_PREFIX}${normalized}`, jti, 'EX', this.ttlSeconds);
    return { token, expiresInSeconds: this.ttlSeconds };
  }

  /**
   * Atomically consume a token: valid once, dead afterwards. Never throws on a
   * malformed input — every failure is a status code, and the generic messages
   * at the route turn them into indistinguishable answers.
   */
  async consume(token: string): Promise<ConsumeResult> {
    const payload = this.verifySignature(token);
    if (payload === null) return { status: 'invalid' };
    if (payload.exp * 1000 <= this.now()) return { status: 'expired' };

    // Read-and-delete: the record is gone whether the checks below pass or fail,
    // so a replay can never find a live token again.
    const stored = await this.store.get(`${MAGIC_TOKEN_PREFIX}${payload.jti}`);
    await this.store.del(`${MAGIC_TOKEN_PREFIX}${payload.jti}`);
    if (stored === null) return { status: 'used' };
    if (!safeEqualHex(stored, token)) return { status: 'used' };

    // Email binding: a token minted for one address cannot sign anyone else in,
    // and a superseded link (pointer moved to a newer jti) is dead.
    const pointer = await this.store.get(`${MAGIC_POINTER_PREFIX}${payload.email}`);
    if (pointer !== null && pointer !== payload.jti) return { status: 'used' };

    return { status: 'valid', payload };
  }

  /** Drop the live pointer for an address (used by tests / revocation paths). */
  async revokeForEmail(email: string): Promise<void> {
    const normalized = MagicLinkTokenStore.emailKey(email);
    const jti = await this.store.get(`${MAGIC_POINTER_PREFIX}${normalized}`);
    if (jti !== null) await this.store.del(`${MAGIC_TOKEN_PREFIX}${jti}`);
    await this.store.del(`${MAGIC_POINTER_PREFIX}${normalized}`);
  }
}

/** Derive a dedicated magic-link signing secret from the app's master secret material. */
export function deriveMagicLinkSecret(secretMaterial: string): string {
  return createHmac('sha256', secretMaterial).update('vv-magic-link').digest('hex');
}
