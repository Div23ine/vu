import {
  base64UrlToBuffer,
  bufferToBase64Url,
  isWebAuthnCancel,
} from '../../../../(auth)/login/_lib/webauthn-client';
import type { WebAuthnCreationOptionsJson } from '../_hooks/use-security';

/**
 * WebAuthn REGISTRATION bridge — the sign-in assertion bridge is
 * an earlier iteration's `(auth)/login/_lib/webauthn-client.ts`; its base64url codecs and
 * cancel detector are reused, and this module adds the `navigator.credentials
 * .create` half: JSON options in (challenge/user.id/excludeCredentials as
 * base64url), a JSON-serialisable attestation out — exactly the
 * `WebauthnRegisterVerifyBody.credential` shape the API expects.
 *
 * No `innerHTML`, no storage: the credential lives in the platform
 * authenticator, the API only ever sees the attestation object.
 */

export { isWebAuthnCancel };

/** The JSON-serialisable public-key credential handed to the verify route. */
export interface WebAuthnAttestationJson {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
}

function creationOptionsFromJson(
  options: WebAuthnCreationOptionsJson,
): PublicKeyCredentialCreationOptions {
  return {
    challenge: base64UrlToBuffer(options.challenge),
    rp: options.rp,
    user: {
      id: base64UrlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    pubKeyCredParams: options.pubKeyCredParams,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    ...(options.attestation !== undefined
      ? { attestation: options.attestation as AttestationConveyancePreference }
      : {}),
    ...(options.authenticatorSelection !== undefined
      ? {
          authenticatorSelection: {
            ...(options.authenticatorSelection.authenticatorAttachment !== undefined
              ? {
                  authenticatorAttachment: options.authenticatorSelection
                    .authenticatorAttachment as AuthenticatorAttachment,
                }
              : {}),
            ...(options.authenticatorSelection.requireResidentKey !== undefined
              ? { requireResidentKey: options.authenticatorSelection.requireResidentKey }
              : {}),
            ...(options.authenticatorSelection.residentKey !== undefined
              ? {
                  residentKey: options.authenticatorSelection.residentKey as ResidentKeyRequirement,
                }
              : {}),
            ...(options.authenticatorSelection.userVerification !== undefined
              ? {
                  userVerification: options.authenticatorSelection
                    .userVerification as UserVerificationRequirement,
                }
              : {}),
          },
        }
      : {}),
    ...(options.excludeCredentials !== undefined
      ? {
          excludeCredentials: options.excludeCredentials.map((credential) => ({
            type: credential.type,
            id: base64UrlToBuffer(credential.id),
            ...(credential.transports !== undefined
              ? { transports: credential.transports as AuthenticatorTransport[] }
              : {}),
          })),
        }
      : {}),
  };
}

/**
 * Runs the platform registration ceremony. Rejects with the original DOM
 * exception (`isWebAuthnCancel` recognises the user-cancel case); resolves
 * with the JSON attestation ready for `POST …/register/verify`.
 */
export async function registerSecurityKey(
  options: WebAuthnCreationOptionsJson,
): Promise<WebAuthnAttestationJson> {
  if (typeof navigator === 'undefined' || navigator.credentials === undefined) {
    throw new Error('WebAuthn is not available in this browser.');
  }
  const credential = (await navigator.credentials.create({
    publicKey: creationOptionsFromJson(options),
  })) as PublicKeyCredential | null;
  if (credential === null) {
    throw new Error('WebAuthn registration produced no credential.');
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
    },
  };
}
