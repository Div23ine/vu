import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Audit cryptography.
 *
 *   payload   = canonicalJson({ category, event_type, severity, actor_label,
 *                               subject, message, details, created_at })
 *   hash      = sha256_hex(prev_hash + payload)
 *   signature = hmac_sha256_hex(hmacKey(key_id), hash)
 *
 * The hash links each entry to its predecessor, so rewriting history is
 * detectable. The HMAC proves the entry was written by a holder of the audit key,
 * so an attacker with database write access cannot forge a plausible chain.
 * Sensitive fields are sealed with AES-256-GCM, authenticated by the entry's own
 * uuid as additional data, so a sealed blob cannot be moved between entries.
 */

/** The `prev_hash` of the genesis entry. */
export const ZERO_HASH = '0'.repeat(64);

export const AES_KEY_BYTES = 32;
export const NONCE_BYTES = 12;
export const GCM_TAG_BYTES = 16;

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computeHash(prevHash: string, payload: string): string {
  return sha256Hex(prevHash + payload);
}

export function hmacSha256Hex(key: Buffer, input: string): string {
  return createHmac('sha256', key).update(input, 'utf8').digest('hex');
}

export function computeSignature(key: Buffer, hash: string): string {
  return hmacSha256Hex(key, hash);
}

/** Constant-time comparison of two hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** A fresh 12-byte nonce. Never reused: one per sealed entry. */
export function randomNonce(): Buffer {
  return randomBytes(NONCE_BYTES);
}

export interface AuditKeyRing {
  /** The key id new entries are signed and sealed with. */
  readonly currentKeyId: string;
  /** Look up a key by id, so entries written before a rotation still verify. */
  key(keyId: string): Buffer | undefined;
  keyIds(): string[];
}

interface KeyRingFile {
  current?: string;
  keys?: Record<string, string>;
}

function decodeKey(encoded: string, purpose: string): Buffer {
  const key = Buffer.from(encoded.trim(), 'base64');
  if (key.length !== AES_KEY_BYTES) {
    throw new Error(`${purpose} key must be 32 bytes of base64, got ${key.length}`);
  }
  return key;
}

/**
 * Parse a key-ring secret.
 *
 * Either a JSON map `{ "current": "<key_id>", "keys": { "<key_id>": "<base64>" } }`
 * or a bare base64 key, which is treated as the ring's only key under `keyId`.
 */
export function parseKeyRing(
  raw: string,
  purpose: 'AUDIT_HMAC_KEY' | 'AUDIT_AES_KEY',
  singleKeyId = 'v1',
): AuditKeyRing {
  const trimmed = raw.trim();
  const keys = new Map<string, Buffer>();
  let currentKeyId = singleKeyId;

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as KeyRingFile;
    for (const [keyId, encoded] of Object.entries(parsed.keys ?? {})) {
      keys.set(keyId, decodeKey(encoded, purpose));
    }
    if (parsed.current !== undefined) currentKeyId = parsed.current;
    if (!keys.has(currentKeyId)) {
      throw new Error(`${purpose} names current key "${currentKeyId}" that is not in the ring`);
    }
  } else {
    keys.set(singleKeyId, decodeKey(trimmed, purpose));
  }

  return {
    currentKeyId,
    key: (keyId) => keys.get(keyId),
    keyIds: () => [...keys.keys()],
  };
}

export interface SealedBlob {
  /** ciphertext ‖ 16-byte GCM tag. */
  sealed: Buffer;
  nonce: Buffer;
}

/** AES-256-GCM with `aad` bound to the entry's own uuid. */
export function sealWith(key: Buffer, plaintext: unknown, aad: string): SealedBlob {
  const nonce = randomNonce();
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final(),
  ]);
  return { sealed: Buffer.concat([ciphertext, cipher.getAuthTag()]), nonce };
}

/** Throws when the ciphertext, the tag or the bound entry id has been altered. */
export function openWith(key: Buffer, sealed: Buffer, nonce: Buffer, aad: string): unknown {
  if (sealed.length < GCM_TAG_BYTES) throw new Error('sealed payload is truncated');
  const ciphertext = sealed.subarray(0, sealed.length - GCM_TAG_BYTES);
  const tag = sealed.subarray(sealed.length - GCM_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as unknown;
}

/** Base64 helpers for the wire format of the key-ring secrets. */
export function encodeKey(key: Buffer): string {
  return key.toString('base64');
}
