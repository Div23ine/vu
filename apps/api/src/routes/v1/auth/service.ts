import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ROLE_PERMISSIONS,
  type AccountStatus,
  type MfaMethod,
  type Permission,
  type UserRole,
} from '@vunvault/contracts';
import type { BreachCheck } from '../../../lib/breach.js';
import { HttpError } from '../../../lib/http-error.js';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import type { EmailProvider } from '../../../providers/email.js';
import { isStaff } from '../../../lib/staff.js';
import { validatePassword } from '../account-security/password-policy.js';
import {
  EmailOtpStore,
  generateOtpCode,
  MfaChallengeStore,
  newSessionId,
  type MfaChallenge,
} from './challenge.js';
import { deviceLabel, geoCity, geoCountry, type GeoHeaders } from './device.js';
import { generateResetToken, resetTokenHash, type PasswordResetStore } from './password-reset.js';
import type { SignupOtpStore } from './email-otp.js';
import type { AuthProfileRow, AuthRepo } from './repo.js';
import { emailHash } from './repo.js';
import type { MfaVerifierRegistry, VerifierMethod } from './mfa-registry.js';
import type { FastifyRequest } from 'fastify';

/**
 * Session lifecycle: signup, login, the MFA challenge, refresh, logout and the
 * session read.
 *
 * Invariants this service exists to protect:
 *  - a token never appears in a response body;
 *  - every credential failure looks identical from the outside;
 *  - a login that has a second factor available never issues a session cookie
 *    until that factor passes;
 *  - a state change and its audit entry commit together (the route wraps calls in
 *    `audited()`, and this service writes through the transaction it is given).
 */

export interface SessionUserView {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  orgId: string | null;
  permissions: Permission[];
  mfaEnrolled: boolean;
}

export interface RequestMeta {
  ip: string;
  userAgent?: string | null;
  headers?: GeoHeaders;
}

export interface IssuedSession {
  user: SessionUserView;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  sessionId: string;
  mfaMethod: MfaMethod | null;
}

export interface LoginOutcome {
  kind: 'session';
  session: IssuedSession;
  mfaMethods: MfaMethod[];
}

export interface MfaChallengeOutcome {
  kind: 'challenge';
  handle: string;
  mfaMethods: MfaMethod[];
}

export type LoginResult = LoginOutcome | MfaChallengeOutcome;

export interface SignupInput {
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  accountType: 'individual' | 'company';
  password: string;
  description?: string;
}

/** Magic-link step 1 input: possession of the mailbox is the credential. */
export interface MagicLinkInput {
  email: string;
}

/** Lockout thresholds: 5 per address per 15 minutes, 20 per IP per 15 minutes. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_EMAIL = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;
export const LOGIN_RETRY_AFTER_SECONDS = 900;

/** A fixed digest compared on every failure so timing does not leak existence. */
const DUMMY_DIGEST = createHash('sha256').update('vv-timing-equaliser').digest();

function equaliseTiming(password: string): void {
  const digest = createHash('sha256').update(password).digest();
  timingSafeEqual(digest, DUMMY_DIGEST);
}

/** `Dr. Evelyn Reed` → `{ first: 'Dr.', last: 'Evelyn Reed' }`? No: split on the FIRST space. */
export function splitName(fullName: string): { firstName: string | null; lastName: string | null } {
  const trimmed = fullName.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed === '' ? null : trimmed, lastName: null };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

export function permissionsFor(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export interface AuthServiceDeps {
  repo: AuthRepo;
  supabase: SupabaseAdmin;
  challenges: MfaChallengeStore;
  otp: EmailOtpStore;
  /** Task 40d: the signup mailbox OTP store. */
  signupOtp: SignupOtpStore;
  /** Task 40d: the password-reset token store. */
  resets: PasswordResetStore;
  verifiers: MfaVerifierRegistry;
  breach: BreachCheck;
  email?: EmailProvider;
  /** Queue-backed notification; falls back to `email` when absent. */
  notify?: (input: { to: string; template: string; vars: Record<string, string> }) => Promise<void>;
  /** `${WEB_ORIGIN}`: the reset link points at the web app, not the API. */
  webOrigin: string;
  /** Development logging of the OTP lives and dies with this. */
  nodeEnv?: string;
  now?: () => Date;
  log?: { warn: (message: string, error?: unknown) => void; debug?: (message: string) => void };
}

export class AuthService {
  private readonly deps: AuthServiceDeps;
  private readonly now: () => Date;
  private readonly warn: (message: string, error?: unknown) => void;
  private readonly debug: (message: string) => void;
  private readonly nodeEnv: string;

  constructor(deps: AuthServiceDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
    this.warn = deps.log?.warn.bind(deps.log) ?? (() => undefined);
    this.debug = deps.log?.debug?.bind(deps.log) ?? (() => undefined);
    this.nodeEnv = deps.nodeEnv ?? 'production';
  }

  /** `mfaEnrolled` = a verified TOTP factor or at least one WebAuthn credential. */
  async mfaEnrolledFor(userId: string, profileMfaEnrolled: boolean): Promise<boolean> {
    if (profileMfaEnrolled) return true;
    const [factors, webauthnCount] = await Promise.all([
      this.deps.supabase.mfa.listFactors(userId).catch(() => []),
      this.deps.repo.countWebauthnCredentials(userId).catch(() => 0),
    ]);
    return factors.some((factor) => factor.verified) || webauthnCount > 0;
  }

  /** Which second factors this account can actually use right now. */
  async availableMethods(profile: AuthProfileRow): Promise<MfaMethod[]> {
    const [factors, webauthnCount] = await Promise.all([
      this.deps.supabase.mfa.listFactors(profile.id).catch(() => []),
      this.deps.repo.countWebauthnCredentials(profile.id).catch(() => 0),
    ]);
    const methods: MfaMethod[] = [];
    if (factors.some((factor) => factor.verified)) methods.push('totp');
    if (webauthnCount > 0) methods.push('webauthn');
    // Email OTP is a staff fallback: a client's mailbox is not a second factor we
    // control, and staff are required to hold MFA anyway.
    if (isStaff(profile.role)) methods.push('email_otp');
    return methods;
  }

  toSessionUser(profile: AuthProfileRow, mfaEnrolled: boolean): SessionUserView {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      orgId: profile.orgId,
      permissions: permissionsFor(profile.role),
      mfaEnrolled,
    };
  }

  /**
   * Public signup, step 1 of 3 (Task 40d): create the identity, the organisation
   * and the profile as `pending_verification`, email a six-digit OTP — and set NO
   * cookies. The session opens only when the mailbox proves itself.
   */
  async signup(input: SignupInput): Promise<{ email: string }> {
    if (await this.deps.breach.isBreached(input.password)) {
      throw new HttpError(422, 'breached_password', 'That password has appeared in a known breach');
    }

    const email = input.email.trim().toLowerCase();
    const existing = await this.deps.repo.findProfileByEmail(email);
    if (existing !== null) {
      if (existing.accountStatus === 'pending_verification' && existing.deletedAt === null) {
        // An abandoned signup is REPLACED: the unverified Supabase user and its
        // rows go, and the flow starts again from a clean slate. Anything else —
        // an active, suspended or deleted account — still owns the address.
        await this.deps.supabase.deleteUser(existing.id).catch((error: unknown) => {
          this.warn('could not delete the unverified auth user; continuing', error);
        });
        await this.deps.repo.deletePendingSignup(existing.id);
      } else {
        throw HttpError.conflict('email_taken', 'An account with that email already exists');
      }
    }

    // Mailbox ownership IS verified (Task 40d replaces the v1 decision): the user
    // is created unconfirmed and Supabase's own mailer stays off — the OTP below
    // is ours.
    const created = await this.deps.supabase.createUser({
      email,
      password: input.password,
      emailConfirm: false,
      userMetadata: { fullName: input.fullName },
    });

    const { firstName, lastName } = splitName(input.fullName);
    const clientCode = await this.deps.repo.nextClientCode();
    const organizationName =
      input.accountType === 'individual'
        ? input.fullName
        : input.description?.trim() || input.fullName;

    const orgId = await this.deps.repo.createOrganization({
      name: organizationName,
      clientCode,
      country: input.country,
    });

    await this.deps.repo.createProfile({
      id: created.id,
      orgId,
      email,
      fullName: input.fullName,
      firstName,
      lastName,
      phone: input.phone ?? null,
      country: input.country,
      accountType: input.accountType,
      role: 'client',
      accountStatus: 'pending_verification',
      require2fa: true,
    });

    const { code } = await this.deps.signupOtp.issue(email);
    await this.sendSignupCode(email, code);
    return { email };
  }

  /**
   * Signup step 2: the mailbox OTP. On success the profile activates, the OTP is
   * destroyed and a real aal1 session opens — minted server-side from a magic
   * link that never leaves this process. Step 3 (the authenticator) is the Task 27
   * TOTP enrolment the web app runs afterwards.
   */
  async verifySignupEmail(
    input: { email: string; code: string },
    meta: RequestMeta,
  ): Promise<IssuedSession> {
    const email = input.email.trim().toLowerCase();
    const result = await this.deps.signupOtp.verify(email, input.code);
    if (result.status === 'expired') {
      throw new HttpError(410, 'otp_expired', 'That verification code has expired');
    }
    if (result.status === 'exhausted') {
      throw new HttpError(401, 'otp_exhausted', 'That verification code was tried too many times');
    }
    if (result.status === 'invalid') {
      throw new HttpError(401, 'otp_invalid', 'That verification code is not correct');
    }

    const profile = await this.deps.repo.findProfileByEmail(email);
    if (
      profile === null ||
      profile.accountStatus !== 'pending_verification' ||
      profile.deletedAt !== null
    ) {
      // A code without a pending signup behind it is a stale code: same answer as
      // an expired one, and it is destroyed either way.
      await this.deps.signupOtp.clear(email);
      throw new HttpError(410, 'otp_expired', 'That verification code has expired');
    }

    await this.deps.supabase.confirmEmail(profile.id);
    const activated = await this.deps.repo.activatePendingSignup(profile.id);
    await this.deps.signupOtp.clear(email);
    if (!activated) {
      throw new HttpError(410, 'otp_expired', 'That verification code has expired');
    }

    const session = await this.deps.supabase.issueSession(email);
    profile.accountStatus = 'active';

    // remember = false, mfaEnrolled = false: the browser holds an aal1 session
    // until the authenticator enrolment replaces these cookies with an aal2 one.
    return this.issueSession(session, profile, { meta, mfaMethod: null, remember: false });
  }

  /**
   * Resend the code, at most once per thirty seconds, only while the signup is
   * still pending. The route answers `202 {}` no matter which branch ran.
   */
  async resendSignupCode(email: string): Promise<void> {
    const address = email.trim().toLowerCase();
    const profile = await this.deps.repo.findProfileByEmail(address);
    if (
      profile === null ||
      profile.accountStatus !== 'pending_verification' ||
      profile.deletedAt !== null
    ) {
      return;
    }
    if (!(await this.deps.signupOtp.canResend(address))) return;
    const { code } = await this.deps.signupOtp.issue(address); // rotates: the old code dies
    await this.sendSignupCode(address, code);
  }

  /**
   * Forgot password: ALWAYS the same `202 {}`. An active profile gets a
   * single-use 30-minute link; an unknown address gets the same answer, the same
   * body and roughly the same work, because which addresses hold accounts is not
   * a question the internet gets to ask. Nothing is audited here — the audit
   * entry is written on the successful reset.
   */
  async forgotPassword(email: string): Promise<void> {
    const address = email.trim().toLowerCase();
    const profile = await this.deps.repo.findProfileByEmail(address);
    if (profile === null || profile.accountStatus !== 'active' || profile.deletedAt !== null) {
      // Equalise the cost: mint and hash a token that goes nowhere.
      void resetTokenHash(generateResetToken());
      return;
    }

    const { token } = await this.deps.resets.issue(profile.id);
    const link = `${this.deps.webOrigin}/reset-password?token=${token}`;
    if (this.deps.email === undefined) {
      this.warn('reset email requested but no email provider is configured');
      return;
    }
    await this.deps.email.send({
      to: address,
      subject: 'Reset your VUNVAULT password',
      html: `<p>We received a request to reset your VUNVAULT password.</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes. If you did not request it, you can safely ignore this email.</p>`,
      text: `We received a request to reset your VUNVAULT password:\n\n${link}\n\nThis link expires in 30 minutes. If you did not request it, you can safely ignore this email.`,
    });
  }

  /**
   * Reset password: consume the single-use token, re-validate the password
   * against the account's role (staff 14, everyone else 12), hand the new secret
   * to Supabase and revoke EVERY session — Supabase's own refresh tokens die with
   * the admin password update, and our `user_sessions` rows die here. MFA is not
   * bypassed: the next login still challenges.
   */
  async resetPassword(input: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ userId: string; email: string; revokedSessions: number }> {
    const record = await this.deps.resets.consume(input.token);
    if (record === null) {
      throw new HttpError(410, 'token_invalid', 'That reset link is no longer valid');
    }
    const profile = await this.deps.repo.findProfileById(record.userId);
    if (profile === null || profile.accountStatus !== 'active' || profile.deletedAt !== null) {
      throw new HttpError(410, 'token_invalid', 'That reset link is no longer valid');
    }

    if (input.newPassword !== input.confirmPassword) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['confirmPassword'], message: 'Both entries must match exactly.' },
      ]);
    }
    const policy = validatePassword(input.newPassword, profile.role);
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
    if (await this.deps.breach.isBreached(input.newPassword)) {
      throw new HttpError(422, 'breached_password', 'That password has appeared in a known breach');
    }

    await this.deps.supabase.updatePassword(profile.id, input.newPassword);
    const revoked = await this.deps.repo.revokeAllSessions(profile.id, this.now());
    await this.deps.repo.setLastPasswordChangeAt(profile.id, this.now());
    // The session registry's Redis cache expires within 30 s, so the revoked
    // rows are authoritative from then on at the latest — the same window the
    // authenticated password change (Task 27) relies on.
    await this.notifyCredentialsChanged(profile.email, profile.id);

    return { userId: profile.id, email: profile.email, revokedSessions: revoked.length };
  }

  /** The six-digit signup code. Its ONLY destinations are the email and, in development, the log. */
  private async sendSignupCode(email: string, code: string): Promise<void> {
    if (this.deps.email !== undefined) {
      await this.deps.email.send({
        to: email,
        subject: 'Your VUNVAULT verification code',
        html: `<p>Your VUNVAULT verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not start a signup, you can ignore this email.</p>`,
        text: `Your VUNVAULT verification code is ${code}. It expires in 10 minutes. If you did not start a signup, you can ignore this email.`,
      });
    }
    // The prototype showed a "Test mode" banner with the code. This log line is
    // the whole concession: development only, `debug` level, never production.
    if (this.nodeEnv === 'development') {
      this.debug(`signup verification code for ${email}: ${code}`);
    }
  }

  /** Best-effort notice: a failed email must not fail a password reset. */
  private async notifyCredentialsChanged(to: string, userId: string): Promise<void> {
    try {
      if (this.deps.notify !== undefined) {
        await this.deps.notify({ to, template: 'credentials_changed', vars: { userId } });
        return;
      }
      await this.deps.email?.send({
        to,
        subject: 'Your VUNVAULT credentials changed',
        html: '<p>Your password was changed. If this was not you, contact support immediately.</p>',
        text: 'Your password was changed. If this was not you, contact support immediately.',
      });
    } catch (error) {
      this.warn('credentials-changed notice failed', error);
    }
  }

  /** Password login. Returns a session, or a challenge handle when MFA is required. */
  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
    const email = input.email.trim().toLowerCase();
    const hash = emailHash(email);
    const since = new Date(this.now().getTime() - LOGIN_WINDOW_MS);

    const [byEmail, byIp] = await Promise.all([
      this.deps.repo.countRecentFailuresByEmail(hash, since),
      this.deps.repo.countRecentFailuresByIp(meta.ip, since),
    ]);

    if (byEmail >= LOGIN_MAX_FAILURES_PER_EMAIL || byIp >= LOGIN_MAX_FAILURES_PER_IP) {
      throw new HttpError(
        429,
        'rate_limited',
        `${byEmail} failed attempts in 15 min from ${meta.ip} targeting ${email} · source IP temporarily blocked for 15 min`,
        undefined,
      );
    }

    // Always talk to Supabase, even for an unknown address, so the two failures are
    // indistinguishable from the outside.
    const signedIn = await this.deps.supabase
      .signInWithPassword(email, input.password)
      .catch(() => null);
    const profile = await this.deps.repo.findProfileByEmail(email);
    equaliseTiming(input.password);

    const usable =
      signedIn !== null &&
      signedIn.session !== null &&
      profile !== null &&
      profile.accountStatus === 'active' &&
      profile.deletedAt === null;

    if (!usable || signedIn === null || profile === null || signedIn.session === null) {
      const reason =
        profile === null
          ? 'unknown_email'
          : profile.accountStatus !== 'active'
            ? `account_${profile.accountStatus as AccountStatus}`
            : profile.deletedAt !== null
              ? 'account_deleted'
              : 'invalid_credentials';

      await this.deps.repo.recordLoginAttempt({
        emailHash: hash,
        ip: meta.ip,
        succeeded: false,
        reason,
      });

      throw new HttpError(401, 'invalid_credentials', 'Those credentials were not recognised');
    }

    await this.deps.repo.recordLoginAttempt({
      emailHash: hash,
      ip: meta.ip,
      succeeded: true,
      reason: null,
    });

    const methods = await this.availableMethods(profile);
    const remember = input.remember ?? false;

    if (methods.length === 0) {
      const session = await this.issueSession(signedIn.session, profile, {
        meta,
        mfaMethod: null,
        remember,
      });
      return { kind: 'session', session, mfaMethods: [] };
    }

    // Do NOT set vv_at / vv_rt: the challenge handle in vv_mfa is all the browser
    // gets until a second factor passes.
    const { handle } = await this.deps.challenges.create({
      userId: profile.id,
      email: profile.email,
      remember,
      methods,
      session: signedIn.session,
    });

    return { kind: 'challenge', handle, mfaMethods: methods };
  }

  /** Second-factor verification against a live challenge. */
  async verifyMfa(
    handle: string | undefined,
    method: VerifierMethod,
    body: unknown,
    meta: RequestMeta,
    req: FastifyRequest,
  ): Promise<IssuedSession> {
    if (handle === undefined || handle === '') throw new HttpError(410, 'challenge_expired');

    const challenge = await this.deps.challenges.read(handle);
    if (challenge === null) throw new HttpError(410, 'challenge_expired');

    const verifier = this.deps.verifiers.get(method);
    if (verifier === undefined) {
      throw new HttpError(501, 'not_implemented', `${method} verification is not available yet`);
    }

    let result;
    try {
      result = await verifier.verify({ challenge, body, req });
    } catch (error) {
      const { exhausted } = await this.deps.challenges.recordFailure(handle);
      if (exhausted) await this.deps.challenges.delete(handle);
      if (error instanceof HttpError && error.status === 501) throw error;
      throw new HttpError(401, 'mfa_failed', 'Multi-factor verification failed');
    }

    if (result.session === null) {
      throw new HttpError(401, 'mfa_failed', 'Multi-factor verification failed');
    }

    await this.deps.challenges.delete(handle);

    const profile = await this.deps.repo.findProfileById(challenge.userId);
    if (profile === null || profile.accountStatus !== 'active' || profile.deletedAt !== null) {
      throw HttpError.unauthorized();
    }

    const mfaMethod: MfaMethod | null =
      result.method === 'recovery' ? null : (result.method as MfaMethod);

    return this.issueSession(result.session, profile, {
      meta,
      mfaMethod,
      remember: challenge.remember,
    });
  }

  /** Send a six-digit code. One send per minute per user; only the digest is stored. */
  async sendEmailOtp(handle: string | undefined): Promise<void> {
    if (handle === undefined || handle === '') throw new HttpError(410, 'challenge_expired');
    const challenge: MfaChallenge | null = await this.deps.challenges.read(handle);
    if (challenge === null) throw new HttpError(410, 'challenge_expired');
    if (!challenge.methods.includes('email_otp')) throw HttpError.forbidden();

    if (!(await this.deps.otp.canSend(challenge.userId))) {
      throw HttpError.tooManyRequests('Wait 60 seconds before requesting another code');
    }
    if (this.deps.email === undefined) {
      throw new HttpError(503, 'email_unavailable', 'Email delivery is not configured');
    }

    const code = generateOtpCode();
    await this.deps.otp.issue(challenge.userId, code);
    await this.deps.email.send({
      to: challenge.email,
      subject: 'Your VUNVAULT sign-in code',
      html: `<p>Your VUNVAULT sign-in code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
      text: `Your VUNVAULT sign-in code is ${code}. It expires in 10 minutes.`,
    });
  }

  /** Rotate both cookies from the refresh token. */
  async refresh(refreshToken: string | undefined): Promise<SupabaseSession> {
    if (refreshToken === undefined || refreshToken === '') throw HttpError.unauthorized();
    try {
      return await this.deps.supabase.refresh(refreshToken);
    } catch {
      throw HttpError.unauthorized();
    }
  }

  /** Sign the Supabase session out and revoke our own session row. */
  async logout(accessToken: string | undefined, sessionId: string): Promise<void> {
    if (accessToken !== undefined && accessToken !== '') {
      await this.deps.supabase.signOut(accessToken, 'local').catch((error: unknown) => {
        this.warn('supabase sign-out failed; the local session is revoked anyway', error);
      });
    }
    await this.deps.repo.revokeSession(sessionId, this.now());
  }

  /** The current session as the web app sees it. */
  async session(profile: AuthProfileRow): Promise<SessionUserView> {
    return this.toSessionUser(profile, await this.mfaEnrolledFor(profile.id, profile.mfaEnrolled));
  }

  /**
   * Issue cookies' worth of session state: persist the device row and return the
   * tokens. The route is the only thing that writes a cookie.
   */
  private async issueSession(
    supabaseSession: SupabaseSession,
    profile: AuthProfileRow,
    options: { meta: RequestMeta; mfaMethod: MfaMethod | null; remember?: boolean },
  ): Promise<IssuedSession> {
    const sessionId = supabaseSession.sessionId === '' ? newSessionId() : supabaseSession.sessionId;
    const headers = options.meta.headers ?? {};

    await this.deps.repo.createSession({
      id: sessionId,
      userId: profile.id,
      deviceLabel: deviceLabel(options.meta.userAgent ?? null),
      userAgent: options.meta.userAgent ?? null,
      ip: options.meta.ip,
      geoCity: geoCity(headers),
      geoCountry: geoCountry(headers),
      mfaMethod: options.mfaMethod,
    });
    await this.deps.repo.touchProfileLastActive(profile.id, this.now());

    return {
      user: this.toSessionUser(
        profile,
        await this.mfaEnrolledFor(profile.id, profile.mfaEnrolled || options.mfaMethod !== null),
      ),
      tokens: {
        accessToken: supabaseSession.accessToken,
        refreshToken: supabaseSession.refreshToken,
        expiresIn: supabaseSession.expiresIn,
      },
      sessionId,
      mfaMethod: options.mfaMethod,
    };
  }
}

export { generateOtpCode, EmailOtpStore, MfaChallengeStore };
