import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

/** Transports as the browser reports them, narrowed to the values we persist. */
function asTransports(value: string[] | undefined): AuthenticatorTransportFuture[] | undefined {
  if (value === undefined || value.length === 0) return undefined;
  return value as AuthenticatorTransportFuture[];
}

/**
 * WebAuthn, in-house.
 *
 * Supabase cannot host a passkey ceremony for us, so the platform runs its own:
 * credentials live in `webauthn_credentials`, the challenge lives in Redis for
 * five minutes, and a successful authentication records `mfa_method = 'webauthn'`
 * on the session row — which is what makes `AuthUser.aal` equal `aal2`.
 *
 * The counter is a clone detector: an authenticator signs with a monotonically
 * increasing counter, so a value that does not increase means the key was copied.
 * That is refused, not warned about.
 */

export interface WebauthnUser {
  id: string;
  email: string;
  displayName: string;
}

export interface RegisteredCredential {
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
}

export interface WebauthnService {
  startRegistration(
    user: WebauthnUser,
    existingCredentialIds: string[],
  ): Promise<{
    options: unknown;
    challenge: string;
  }>;
  finishRegistration(credential: unknown, expectedChallenge: string): Promise<RegisteredCredential>;
  startAuthentication(
    credentials: Array<{ credentialId: string; transports: string[] }>,
  ): Promise<{ options: unknown; challenge: string }>;
  finishAuthentication(
    response: unknown,
    expectedChallenge: string,
    credential: RegisteredCredential,
  ): Promise<{ counter: number; verified: boolean }>;
}

export interface SimpleWebauthnOptions {
  rpID: string;
  rpName: string;
  origin: string;
}

interface RegistrationInfo {
  credential?: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: string[];
  };
}

export class SimpleWebauthnService implements WebauthnService {
  constructor(private readonly options: SimpleWebauthnOptions) {}

  async startRegistration(user: WebauthnUser, existingCredentialIds: string[]) {
    const generated = await generateRegistrationOptions({
      rpName: this.options.rpName,
      rpID: this.options.rpID,
      userName: user.email,
      userDisplayName: user.displayName,
      userID: new TextEncoder().encode(user.id),
      excludeCredentials: existingCredentialIds.map((id) => ({ id })),
      // A second factor, not a password replacement: no resident key required.
      authenticatorSelection: { residentKey: 'discouraged', userVerification: 'preferred' },
    });
    return { options: generated, challenge: generated.challenge };
  }

  async finishRegistration(credential: unknown, expectedChallenge: string) {
    const result = await verifyRegistrationResponse({
      // The browser's response shape is defined by the WebAuthn spec, not by us.
      response: credential as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge,
      expectedOrigin: this.options.origin,
      expectedRPID: this.options.rpID,
    });

    const info = (result.registrationInfo ?? {}) as RegistrationInfo;
    const verifiedCredential = info.credential;
    if (!result.verified || verifiedCredential === undefined) {
      throw new Error('webauthn registration could not be verified');
    }

    return {
      credentialId: verifiedCredential.id,
      publicKey: Buffer.from(verifiedCredential.publicKey),
      counter: verifiedCredential.counter,
      transports: (verifiedCredential.transports ?? []) as string[],
    };
  }

  async startAuthentication(credentials: Array<{ credentialId: string; transports: string[] }>) {
    const generated = await generateAuthenticationOptions({
      rpID: this.options.rpID,
      userVerification: 'preferred',
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: asTransports(credential.transports),
      })),
    });
    return { options: generated, challenge: generated.challenge };
  }

  async finishAuthentication(
    response: unknown,
    expectedChallenge: string,
    credential: RegisteredCredential,
  ) {
    const result = await verifyAuthenticationResponse({
      response: response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge,
      expectedOrigin: this.options.origin,
      expectedRPID: this.options.rpID,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        counter: credential.counter,
        transports: asTransports(credential.transports),
      },
    });

    const info = result.authenticationInfo as { newCounter?: number } | undefined;
    return {
      verified: result.verified,
      counter: info?.newCounter ?? credential.counter,
    };
  }
}
