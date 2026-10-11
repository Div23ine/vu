/** Moved to `@vunvault/lib/audit-chain` in Task 92; this file keeps every existing import path working. */
export {
  AES_KEY_BYTES,
  computeHash,
  computeSignature,
  digestsEqual,
  encodeKey,
  GCM_TAG_BYTES,
  hmacSha256Hex,
  NONCE_BYTES,
  openWith,
  parseKeyRing,
  randomNonce,
  sealWith,
  sha256Hex,
  ZERO_HASH,
  type AuditKeyRing,
  type SealedBlob,
} from '@vunvault/lib/audit-chain';
