import type { MfaMethod } from '@vunvault/contracts';
import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../../lib/http-error.js';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { EmailOtpStore, MfaChallenge, MfaChallengeStore } from './challenge.js';

/**
 * Second-factor verifiers.
 *
 * A registry rather than a switch, because the factors are not all ours: TOTP and
 * email OTP go through Supabase or our own store, WebAuthn needs a ceremony, and a
 * recovery code is a one-shot digest comparison. Task 27 replaces the `webauthn`
 * and `recovery` stubs with real verifiers; nothing else changes.
 */

export type VerifierMethod = MfaMethod | 'recovery';

export interface MfaVerifierContext {
  challenge: MfaChallenge;
  body: unknown;
  req: FastifyRequest;
}

export interface MfaVerifierResult {
  session: SupabaseSession | null;
  method: VerifierMethod;
}

export interface MfaVerifier {
  verify(context: MfaVerifierContext): Promise<MfaVerifierResult>;
}

export class MfaVerifierRegistry {
  private readonly verifiers = new Map<VerifierMethod, MfaVerifier>();

  register(method: VerifierMethod, verifier: MfaVerifier): this {
    this.verifiers.set(method, verifier);
    return this;
  }

  get(method: VerifierMethod): MfaVerifier | undefined {
    return this.verifiers.get(method);
  }

  methods(): VerifierMethod[] {
    return [...this.verifiers.keys()];
  }
}

/** A verifier that refuses until the real implementation lands. */
export function notImplemented(method: VerifierMethod): MfaVerifier {
  return {
    async verify(): Promise<MfaVerifierResult> {
      throw new HttpError(501, 'not_implemented', `${method} verification is not available yet`);
    },
  };
}

export interface MfaRegistryDeps {
  supabase: SupabaseAdmin;
  challenges: MfaChallengeStore;
  otp: EmailOtpStore;
  /**
   * Task 27 supplies these; without them the `webauthn` and `recovery` verifiers
   * stay 501 stubs.
   */
  webauthn?: {
    verify(handle: string, response: unknown): Promise<{ userId: string; credentialId: string }>;
  };
  recovery?: {
    consume(userId: string, code: string): Promise<boolean>;
    unenrollTotp(accessToken: string, userId: string): Promise<void>;
  };
}

/** The `vv_mfa` cookie carries the handle the WebAuthn challenge is stored under. */
function mfaHandle(req: FastifyRequest): string {
  const cookie = req.headers.cookie ?? '';
  const match = /(?:^|;\s*)vv_mfa=([^;]+)/.exec(cookie);
  return match?.[1] ?? '';
}

function readRecoveryCode(body: unknown): string {
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code !== 'string' || code.trim() === '') {
    throw HttpError.badRequest('validation_failed', [
      { path: ['code'], message: 'Enter a recovery code' },
    ]);
  }
  return code;
}

/** Reads the 6-digit code out of a verify body without trusting its shape. */
export function readCode(body: unknown): string {
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['code'], message: 'Enter the 6-digit code' },
    ]);
  }
  return code;
}

export function createMfaVerifierRegistry(deps: MfaRegistryDeps): MfaVerifierRegistry {
  const registry = new MfaVerifierRegistry();

  registry.register('totp', {
    async verify({ challenge, body }) {
      const code = readCode(body);
      // Supabase cannot raise AAL without the aal1 session that the challenge holds.
      const session = deps.challenges.decryptSession(challenge);
      const factors = await deps.supabase.mfa.listFactors(challenge.userId);
      const factor = factors.find((candidate) => candidate.verified);
      if (factor === undefined) throw HttpError.unauthorized('mfa_failed');
      const verified = await deps.supabase.mfa.challengeAndVerify(
        session.accessToken,
        factor.id,
        code,
      );
      return { session: verified, method: 'totp' };
    },
  });

  registry.register('email_otp', {
    async verify({ challenge, body }) {
      const code = readCode(body);
      const ok = await deps.otp.verify(challenge.userId, code);
      if (!ok) throw HttpError.unauthorized('mfa_failed');
      await deps.otp.clear(challenge.userId);
      // The aal1 session is reused; the second factor is recorded on our own
      // `user_sessions.mfa_method`, which the session registry honours as AAL2.
      const session = deps.challenges.decryptSession(challenge);
      return { session, method: 'email_otp' };
    },
  });

  if (deps.webauthn === undefined) {
    registry.register('webauthn', notImplemented('webauthn'));
  } else {
    const webauthn = deps.webauthn;
    registry.register('webauthn', {
      async verify({ challenge, body, req }) {
        const assertion = (body as { assertion?: unknown }).assertion;
        // Throws `counter_regression` when the authenticator counter did not
        // increase — a cloned key is refused, not warned about.
        const result = await webauthn.verify(mfaHandle(req), assertion);
        if (result.userId !== challenge.userId) {
          throw new HttpError(401, 'mfa_failed', 'That security key belongs to another account');
        }
        // Supabase cannot raise AAL for an in-house ceremony, so the aal1 session
        // is reused and `mfa_method = 'webauthn'` on the session row is what makes
        // the request AAL2.
        return { session: deps.challenges.decryptSession(challenge), method: 'webauthn' };
      },
    });
  }

  if (deps.recovery === undefined) {
    registry.register('recovery', notImplemented('recovery'));
  } else {
    const recovery = deps.recovery;
    registry.register('recovery', {
      async verify({ challenge, body }) {
        const code = readRecoveryCode(body);
        const consumed = await recovery.consume(challenge.userId, code);
        if (!consumed) throw new HttpError(401, 'mfa_failed', 'That recovery code is not valid');

        const session = deps.challenges.decryptSession(challenge);
        // Supabase cannot raise AAL from a recovery code, so the TOTP factors are
        // unenrolled: a staff account must re-enrol before `requireStaff` passes.
        // WebAuthn keys are kept — they are not what was bypassed.
        await recovery.unenrollTotp(session.accessToken, challenge.userId);
        return { session: { ...session, aal: 'aal1' }, method: 'recovery' };
      },
    });
  }

  return registry;
}

/** Constant-time digest comparison, exported for the recovery-code verifier. */
export function digestsMatch(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}
