'use client';

/**
 * Browser WebAuthn helpers .
 *
 * The API speaks the JSON (base64url) encoding of the WebAuthn types; the
 * browser speaks ArrayBuffers. These helpers bridge the two for
 * `navigator.credentials.get()` and encode the assertion back for
 * `POST /api/v1/auth/mfa/verify { method: "webauthn", assertion }`.
 *
 * A user cancel surfaces as a `NotAllowedError` rejection; the dialog catches
 * it and shows `Security key request was cancelled.` without leaving the
 * overlay.
 */

// TODO(backend-contract): POST /api/v1/auth/mfa/webauthn/options → 200 { data: PublicKeyCredentialRequestOptionsJSON }

/** The subset of `PublicKeyCredentialRequestOptionsJSON` the dialog consumes. */
export interface WebAuthnRequestOptionsJson {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  allowCredentials?: { id: string; type: 'public-key'; transports?: string[] }[];
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The JSON-encoded assertion the verify endpoint expects. */
export interface WebAuthnAssertionJson {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}

export async function requestWebAuthnAssertion(
  optionsJson: WebAuthnRequestOptionsJson,
): Promise<WebAuthnAssertionJson> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64UrlToBuffer(optionsJson.challenge),
    rpId: optionsJson.rpId,
    timeout: optionsJson.timeout,
    userVerification: optionsJson.userVerification,
    allowCredentials: optionsJson.allowCredentials?.map((credential) => ({
      id: base64UrlToBuffer(credential.id),
      type: 'public-key' as const,
      transports: credential.transports as AuthenticatorTransport[] | undefined,
    })),
  };

  const credential = await navigator.credentials.get({ publicKey });
  if (credential === null) throw new Error('webauthn_unavailable');
  const assertion = credential as PublicKeyCredential & {
    response: AuthenticatorAssertionResponse;
  };

  return {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64Url(assertion.response.clientDataJSON),
      authenticatorData: bufferToBase64Url(assertion.response.authenticatorData),
      signature: bufferToBase64Url(assertion.response.signature),
      userHandle:
        assertion.response.userHandle === null
          ? null
          : bufferToBase64Url(assertion.response.userHandle),
    },
  };
}

/** True when `navigator.credentials.get()` rejected because the user backed out. */
export function isWebAuthnCancel(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'NotAllowedError'
  );
}
