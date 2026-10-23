import { randomBytes } from 'node:crypto';
import type { MfaMethod } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import { isStaff } from '../../../lib/staff';
import type { BreachCheck } from '../../../lib/breach';
import type { EmailProvider } from '../../../providers/email';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin';
import type { QueueRegistry } from '../../../queues/index';
import { computePosture } from './posture';
import { validatePassword } from './password-policy';
import {
  generateRecoveryBatch,
  hashRecoveryCode,
  isValidRecoveryCode,
  newBatchId,
  normalise,
  RECOVERY_BATCH_SIZE,
} from './recovery-codes';
import type { AccountSecurityRepo, SecurityProfileRow, WebauthnKeyRow } from './repo';
import type { WebauthnService } from './webauthn';
import type { KvStore } from '../auth/challenge';

/**
 * Password Manager: password change, TOTP, WebAuthn, recovery codes and the
 * security posture summary.
 *
 * Every method acts on one user id supplied by the caller — always `req.user.id`,
 * never a value from the request body. No method here hashes a password: Supabase
 * Auth owns that.
 */

export const WEBAUTHN_CHALLENGE_TTL_SECONDS = 300;
export const WEBAUTHN_REGISTRATION_PREFIX = 'wa:reg:';
export const WEBAUTHN_AUTHENTICATION_PREFIX = 'wa:auth:';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordContext {
  userId: string;
  email: string;
  role: string;
  accessToken: string;
  sessionId: string | null;
}

export interface ChangePasswordResult {
  revokedSessions: number;
}

export interface WebauthnKeyView {
  id: string;
  deviceName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface MfaStatusView {
  totp: { enabled: boolean; factorId: string | null };
  webauthn: { keys: WebauthnKeyView[] };
  recovery: { generated: boolean; remaining: number; total: number; generatedAt: string | null };
  require2fa: boolean;
  lastFactorChangeAt: string | null;
}

export interface AccountSecurityServiceDeps {
  repo: AccountSecurityRepo;
  supabase: SupabaseAdmin;
  webauthn: WebauthnService;
  breach: BreachCheck;
  kv: KvStore;
  email?: EmailProvider;
  queues?: QueueRegistry;
  now?: () => Date;
}

export class AccountSecurityService {
  private readonly deps: AccountSecurityServiceDeps;
  private readonly now: () => Date;

  constructor(deps: AccountSecurityServiceDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  private async profile(userId: string): Promise<SecurityProfileRow> {
    const profile = await this.deps.repo.getSecurityProfile(userId);
    if (profile === null) throw HttpError.unauthorized();
    return profile;
  }

  // ------------------------------------------------------------- password

  async changePassword(
    input: ChangePasswordInput,
    context: ChangePasswordContext,
  ): Promise<ChangePasswordResult> {
    if (input.newPassword !== input.confirmPassword) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['confirmPassword'], message: 'Both entries must match exactly.' },
      ]);
    }

    const policy = validatePassword(input.newPassword, context.role, input.currentPassword);
    if (!policy.valid) {
      throw HttpError.badRequest(
        'validation_failed',
        policy.issues.map((issue) => ({
          path: ['newPassword'],
          rule: issue.rule,
          message: issue.message,
        })),
      );
    }

    // Prove ownership of the account before changing its credentials.
    await this.deps.supabase.signInWithPassword(context.email, input.currentPassword).catch(() => {
      throw new HttpError(401, 'invalid_credentials', 'Those credentials were not recognised');
    });

    if (await this.deps.breach.isBreached(input.newPassword)) {
      throw new HttpError(422, 'breached_password', 'That password has appeared in a known breach');
    }

    await this.deps.supabase.updatePassword(context.userId, input.newPassword);

    // Every other device is signed out: a password change is how a user responds
    // to a suspected compromise.
    await this.deps.supabase.signOut(context.accessToken, 'others').catch(() => undefined);
    const revokedSessions = await this.deps.repo.revokeOtherSessions(
      context.userId,
      context.sessionId,
      this.now(),
    );
    await this.deps.repo.setLastPasswordChangeAt(context.userId, this.now());

    await this.notify(context.userId, context.email, 'credentials_changed');

    return { revokedSessions };
  }

  /** Best-effort notification: a failed email must not fail a password change. */
  private async notify(userId: string, email: string, template: string): Promise<void> {
    const payload = { channel: 'email', to: email, template, vars: { userId } } as const;
    try {
      if (this.deps.queues !== undefined) {
        await this.deps.queues.notify.add(template, payload);
        return;
      }
      await this.deps.email?.send({
        to: email,
        subject: 'Your VUNVAULT credentials changed',
        html: '<p>Your password was changed. If this was not you, contact support immediately.</p>',
        text: 'Your password was changed. If this was not you, contact support immediately.',
      });
    } catch {
      /* the audit entry is the record; the email is a courtesy */
    }
  }

  // ----------------------------------------------------------------- TOTP

  /** The friendly name is fixed product copy, shown in the authenticator app. */
  async enrollTotp(accessToken: string) {
    return this.deps.supabase.mfa.enrollTotp(accessToken, 'Authenticator app');
  }

  async verifyTotp(
    accessToken: string,
    userId: string,
    factorId: string,
    code: string,
  ): Promise<SupabaseSession> {
    let session: SupabaseSession;
    try {
      session = await this.deps.supabase.mfa.challengeAndVerify(accessToken, factorId, code);
    } catch {
      throw new HttpError(401, 'mfa_failed', 'That code was not accepted');
    }

    const profile = await this.profile(userId);
    const methods = profile.mfaMethods.includes('totp')
      ? profile.mfaMethods
      : ([...profile.mfaMethods, 'totp'] as MfaMethod[]);
    await this.deps.repo.setMfaState(userId, true, methods);
    await this.deps.repo.setLastFactorChangeAt(userId, this.now());
    return session;
  }

  async disableTotp(accessToken: string, userId: string): Promise<void> {
    const profile = await this.profile(userId);
    const factors = await this.deps.supabase.mfa.listFactors(userId);
    const totpFactors = factors.filter((factor) => factor.type === 'totp');

    if (isStaff(profile.role)) {
      const webauthnKeys = await this.deps.repo.listWebauthnCredentials(userId);
      if (webauthnKeys.length === 0) {
        throw new HttpError(
          422,
          'last_factor',
          'Staff accounts must keep at least one second factor',
        );
      }
    }

    for (const factor of totpFactors) {
      await this.deps.supabase.mfa.unenroll(accessToken, factor.id);
    }

    // Recompute the factor list from what is actually left, not from what the
    // profile claimed: a hardware key that was registered out of band still counts.
    const remainingKeys = await this.deps.repo.listWebauthnCredentials(userId);
    const methods: MfaMethod[] = profile.mfaMethods.filter((method) => method !== 'totp');
    if (remainingKeys.length > 0 && !methods.includes('webauthn')) methods.push('webauthn');
    await this.deps.repo.setMfaState(userId, methods.length > 0, methods);
    await this.deps.repo.setLastFactorChangeAt(userId, this.now());
  }

  // -------------------------------------------------------------- WebAuthn

  async startWebauthnRegistration(user: { id: string; email: string; displayName: string }) {
    const existing = await this.deps.repo.listWebauthnCredentials(user.id);
    const { options, challenge } = await this.deps.webauthn.startRegistration(
      user,
      existing.map((credential) => credential.credentialId),
    );
    await this.deps.kv.set(
      `${WEBAUTHN_REGISTRATION_PREFIX}${user.id}`,
      challenge,
      'EX',
      WEBAUTHN_CHALLENGE_TTL_SECONDS,
    );
    return options;
  }

  async finishWebauthnRegistration(
    userId: string,
    deviceName: string | undefined,
    credential: unknown,
  ): Promise<WebauthnKeyView> {
    const challengeKey = `${WEBAUTHN_REGISTRATION_PREFIX}${userId}`;
    const challenge = await this.deps.kv.get(challengeKey);
    if (challenge === null) throw new HttpError(410, 'challenge_expired');

    let registered;
    try {
      registered = await this.deps.webauthn.finishRegistration(credential, challenge);
    } catch {
      throw HttpError.badRequest('webauthn_failed', [{ path: ['credential'] }]);
    }
    await this.deps.kv.del(challengeKey);

    const row = await this.deps.repo.insertWebauthnCredential({
      userId,
      credentialId: registered.credentialId,
      publicKey: registered.publicKey,
      counter: registered.counter,
      transports: registered.transports,
      deviceName: deviceName ?? null,
    });

    const profile = await this.profile(userId);
    const methods = profile.mfaMethods.includes('webauthn')
      ? profile.mfaMethods
      : ([...profile.mfaMethods, 'webauthn'] as MfaMethod[]);
    await this.deps.repo.setMfaState(userId, true, methods);
    await this.deps.repo.setLastFactorChangeAt(userId, this.now());

    return toKeyView(row);
  }

  async deleteWebauthnKey(userId: string, id: string): Promise<void> {
    const profile = await this.profile(userId);
    const keys = await this.deps.repo.listWebauthnCredentials(userId);
    const target = keys.find((key) => key.id === id);
    if (target === undefined) throw HttpError.notFound('No such security key');

    if (isStaff(profile.role)) {
      const totpFactors = await this.deps.supabase.mfa.listFactors(userId);
      const remainingTotp = totpFactors.filter((factor) => factor.verified).length;
      if (keys.length <= 1 && remainingTotp === 0) {
        throw new HttpError(
          422,
          'last_factor',
          'Staff accounts must keep at least one second factor',
        );
      }
    }

    await this.deps.repo.deleteWebauthnCredential(id, userId);
    const remaining = await this.deps.repo.listWebauthnCredentials(userId);
    if (remaining.length === 0) {
      const methods = profile.mfaMethods.filter((method) => method !== 'webauthn');
      await this.deps.repo.setMfaState(userId, methods.length > 0, methods);
    }
    await this.deps.repo.setLastFactorChangeAt(userId, this.now());
  }

  /**
   * Login-time assertion options. The challenge is stored under the caller's
   * `vv_mfa` handle, because that handle — not a new one — is what the verify
   * request will carry.
   */
  async startWebauthnAuthenticationFor(userId: string, handle: string): Promise<unknown> {
    const { options, challenge } = await this.beginAuthentication(userId);
    await this.deps.kv.set(
      `${WEBAUTHN_AUTHENTICATION_PREFIX}${handle}`,
      JSON.stringify({ userId, challenge }),
      'EX',
      WEBAUTHN_CHALLENGE_TTL_SECONDS,
    );
    return options;
  }

  async startWebauthnAuthentication(userId: string): Promise<{ handle: string; options: unknown }> {
    const credentials = await this.deps.repo.listWebauthnCredentials(userId);
    if (credentials.length === 0) {
      throw new HttpError(422, 'no_webauthn_key', 'No security key is registered on this account');
    }
    const { options, challenge } = await this.beginAuthentication(userId);
    const handle = randomBytes(24).toString('base64url');
    await this.deps.kv.set(
      `${WEBAUTHN_AUTHENTICATION_PREFIX}${handle}`,
      JSON.stringify({ userId, challenge }),
      'EX',
      WEBAUTHN_CHALLENGE_TTL_SECONDS,
    );
    return { handle, options };
  }

  private async beginAuthentication(userId: string) {
    const credentials = await this.deps.repo.listWebauthnCredentials(userId);
    if (credentials.length === 0) {
      throw new HttpError(422, 'no_webauthn_key', 'No security key is registered on this account');
    }
    return this.deps.webauthn.startAuthentication(
      credentials.map((credential) => ({
        credentialId: credential.credentialId,
        transports: credential.transports,
      })),
    );
  }

  /**
   * Verify a login assertion. A counter that does not increase means the key was
   * cloned: refuse, and let the caller record `AUTH_MFA_FAILURE`.
   */
  async verifyWebauthnAssertion(
    handle: string,
    response: unknown,
  ): Promise<{ userId: string; credentialId: string }> {
    const raw = await this.deps.kv.get(`${WEBAUTHN_AUTHENTICATION_PREFIX}${handle}`);
    if (raw === null) throw new HttpError(410, 'challenge_expired');
    const stored = JSON.parse(raw) as { userId: string; challenge: string };

    const credentialId = String((response as { id?: unknown }).id ?? '');
    const credential = await this.deps.repo.findWebauthnCredential(credentialId);
    if (credential === null || credential.userId !== stored.userId) {
      throw new HttpError(401, 'mfa_failed', 'That security key is not registered on this account');
    }

    const result = await this.deps.webauthn
      .finishAuthentication(response, stored.challenge, credential)
      .catch(() => {
        throw new HttpError(401, 'mfa_failed', 'The assertion could not be verified');
      });

    if (!result.verified)
      throw new HttpError(401, 'mfa_failed', 'The assertion could not be verified');
    if (result.counter <= credential.counter) {
      // Clone detection: the authenticator counter must always move forward.
      throw new HttpError(401, 'counter_regression', 'Security key counter did not increase');
    }

    await this.deps.repo.updateCredentialCounter(credential.id, result.counter, this.now());
    await this.deps.kv.del(`${WEBAUTHN_AUTHENTICATION_PREFIX}${handle}`);
    return { userId: stored.userId, credentialId };
  }

  // -------------------------------------------------------- recovery codes

  async createRecoveryCodes(
    userId: string,
  ): Promise<{ codes: string[]; batchId: string; generatedAt: string }> {
    const batches = await this.deps.repo.listRecoveryBatches(userId);
    if (batches.length > 0) {
      throw HttpError.conflict(
        'already_generated',
        'Recovery codes already exist for this account',
      );
    }
    return this.issueBatch(userId);
  }

  async regenerateRecoveryCodes(userId: string) {
    // Every unused code of the previous batch dies here; a leaked old sheet stops
    // working the moment a new one is issued.
    await this.deps.repo.markUnusedCodesUsed(userId, this.now());
    return this.issueBatch(userId);
  }

  private async issueBatch(userId: string) {
    const codes = generateRecoveryBatch();
    const batchId = newBatchId();
    const generatedAt = this.now();
    // Only digests are stored.
    await this.deps.repo.insertRecoveryCodes(
      userId,
      batchId,
      codes.map((code) => hashRecoveryCode(code)),
    );
    return { codes, batchId, generatedAt: generatedAt.toISOString() };
  }

  /** Consume one code. Returns false when it is unknown or already used. */
  async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    if (!isValidRecoveryCode(code)) return false;
    return this.deps.repo.consumeRecoveryCode(
      userId,
      hashRecoveryCode(normalise(code)),
      this.now(),
    );
  }

  // ---------------------------------------------------------------- status

  async status(
    userId: string,
  ): Promise<{ mfa: MfaStatusView; posture: ReturnType<typeof computePosture> }> {
    const profile = await this.profile(userId);
    const [keys, batches, factors] = await Promise.all([
      this.deps.repo.listWebauthnCredentials(userId),
      this.deps.repo.listRecoveryBatches(userId),
      this.deps.supabase.mfa.listFactors(userId).catch(() => []),
    ]);

    const verifiedTotp = factors.find((factor) => factor.type === 'totp' && factor.verified);
    const latest = batches[0];

    const mfa: MfaStatusView = {
      totp: { enabled: verifiedTotp !== undefined, factorId: verifiedTotp?.id ?? null },
      webauthn: { keys: keys.map(toKeyView) },
      recovery: {
        generated: latest !== undefined,
        remaining: latest?.unused ?? 0,
        total: RECOVERY_BATCH_SIZE,
        generatedAt: latest?.generatedAt.toISOString() ?? null,
      },
      require2fa: profile.require2fa,
      lastFactorChangeAt: profile.lastFactorChangeAt?.toISOString() ?? null,
    };

    const posture = computePosture({
      webauthnKeyCount: keys.length,
      recoveryBatchExists: latest !== undefined,
      lastPasswordChangeAt: profile.lastPasswordChangeAt,
      now: this.now(),
    });

    return { mfa, posture };
  }
}

export function toKeyView(row: WebauthnKeyRow): WebauthnKeyView {
  return {
    id: row.id,
    deviceName: row.deviceName,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}
