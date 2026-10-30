import {
  ROLE_PERMISSIONS,
  type MfaMethod,
  type Permission,
  type UserRole,
} from '@vunvault/contracts';
import type { BreachCheck } from '../../../lib/breach.js';
import { HttpError } from '../../../lib/http-error.js';
import { SupabaseError } from '../../../lib/supabase-admin.js';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import type { EmailProvider } from '../../../providers/email.js';
import type { MfaSetupStore } from './challenge.js';
import {
  EmailOtpStore,
  generateOtpCode,
  MfaChallengeStore,
  newSessionId,
  type MfaChallenge,
  type MfaSetupRecord,
} from './challenge.js';
import { ADMINISTRATOR_ROLES } from '../../../lib/staff.js';
import {
  ADMIN_MFA_SETUP_WINDOW_SECONDS,
  isAdminEmail,
  isMfaSetupExempt,
  rosterSlotFor,
} from '../../../lib/admin-roster.js';
import { deviceLabel, geoCity, geoCountry, type GeoHeaders } from './device.js';
import type { SignupOtpStore } from './email-otp.js';
import type { MagicLinkTokenStore, SignupInviteCooldown } from './magic-link.js';
import { LoginAbuseGuard } from './login-abuse.js';
import { ALWAYS_HUMAN, type TurnstileVerifier } from '../public/turnstile.js';
import type { AuthProfileRow, AuthRepo } from './repo.js';
import { emailHash } from './repo.js';
import type { MfaVerifierRegistry, VerifierMethod } from './mfa-registry.js';
import type { FastifyRequest } from 'fastify';

/**
 * Session lifecycle: signup, magic-link login, the MFA challenge, refresh,
 * logout and the session read.
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

/** What `POST /auth/magic-link` actually did — the route audits from this; the HTTP answer never differs. */
export type MagicLinkRequestOutcome =
  | { sent: 'link'; email: string } // registered: a single-use verify link went out
  | { sent: 'invite'; email: string } // unregistered: a signup invitation went out (Phase 3)
  | { sent: 'suppressed'; email: string } // unregistered, inside the invite cooldown: nothing sent
  // Phase 4 anti-abuse outcomes — all still answer the identical generic 200:
  | { sent: 'bot_dropped'; email: string; reason: 'honeypot' | 'timing' }
  | { sent: 'window_suppressed'; email: string; retryAfterSeconds: number }
  | { sent: 'captcha_required'; email: string };

/**
 * Why a verify leg failed. These codes only ever reach the browser that proved
 * mailbox possession (or presented a token at all), rendered on the web app's
 * own login screen — they are never an answer to an unauthenticated probe, so
 * they leak nothing an enumerator could use.
 */
export type MagicLinkErrorCode =
  | 'magic_link_invalid'
  | 'magic_link_expired'
  | 'magic_link_used'
  | 'account_inactive'
  | 'account_blocked'
  | 'sign_in_unavailable';

export type MagicLinkVerifyResult =
  | {
      kind: 'challenge';
      handle: string;
      methods: MfaMethod[];
      email: string;
      userId: string;
      /** Absolute `${WEB_ORIGIN}` URL the route 302s to (the MFA step). */
      redirectTo: string;
    }
  | {
      /**
       * Phase 2: the EXEMPT super admin (roster window `null`) never faces a
       * setup gate — an unenrolled exempt sign-in gets the full session here,
       * straight from the verify leg.
       */
      kind: 'session';
      issued: IssuedSession;
      email: string;
      userId: string;
      redirectTo: string;
    }
  | {
      /**
       * Phase 2: a timed administrator setup window closed without enrolment
       * (or the visitor abandoned it) — the account is now `blocked_mfa_setup`
       * and stays that way until a super admin unblocks it.
       */
      kind: 'setup_blocked';
      email: string;
      userId: string;
      reason: 'window_expired' | 'abandoned';
    }
  | { kind: 'error'; code: MagicLinkErrorCode; email: string | null };

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
  /** Sanitised same-origin path the user returns to after the MFA step. */
  next?: string | null;
  /** Honeypot field (Phase 4) — any non-empty value silently drops the request. */
  website?: string | null;
  /** Epoch ms when the login form rendered (Phase 4 timing signal). */
  formTs?: number | null;
  /** Turnstile token (Phase 4) — demanded once the IP trips the soft limit. */
  captchaToken?: string | null;
}

/** Lockout thresholds: 5 per address per 15 minutes, 20 per IP per 15 minutes. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_EMAIL = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;
export const LOGIN_RETRY_AFTER_SECONDS = 900;

/**
 * Open-redirect guard for the `next` parameter (server-side twin of the web
 * app's `safeNextPath`): a usable `next` must start with a single `/` —
 * protocol-relative (`//evil.com`), backslash-trick (`/\\evil.com`) and absolute
 * URLs are rejected. Invalid or absent → `null` (fall back to the role's home).
 */
export function sanitizeNextPath(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

/**
 * Display mask for the MFA screen's "code sent to re••@…" copy. Masked
 * SERVER-side: the full address never appears in a redirect URL (browsers,
 * proxies and logs see only the mask).
 */
export function maskEmailForRedirect(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return email;
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const head = name.slice(0, Math.min(2, name.length));
  return head + '\u2022'.repeat(Math.max(1, name.length - 2)) + domain;
}

/** `WEB_ORIGIN` may be a comma-separated list; redirects use the first entry. */
export function primaryWebOrigin(webOrigin: string): string {
  const first = webOrigin.split(',')[0]?.trim();
  return first === undefined || first === '' ? webOrigin : first;
}

// ——— Phase 2: forced-setup policy helpers ———

/**
 * Who faces a forced first-sign-in setup gate when unenrolled: administrators
 * (timed 5:00 window, blockable) and clients (untimed enrolment routing — the
 * work order's "blocked + routed to enrolment": they cannot reach a session
 * without enrolling, but they are never `blocked_mfa_setup`).
 */
export function needsForcedSetup(role: UserRole): boolean {
  return (ADMINISTRATOR_ROLES as readonly string[]).includes(role) || role === 'client';
}

/**
 * The setup window in seconds for an unenrolled profile: the roster slot's
 * window when the address is on the roster (`null` = EXEMPT — the super
 * admin), the standard 5:00 for any other administrator-role account, and
 * `null` (untimed enrolment) for clients.
 */
export function setupWindowSecondsFor(profile: { email: string; role: UserRole }): number | null {
  const slot = rosterSlotFor(profile.email);
  if (slot !== null) return slot.mfaSetupWindowSeconds;
  return (ADMINISTRATOR_ROLES as readonly string[]).includes(profile.role)
    ? ADMIN_MFA_SETUP_WINDOW_SECONDS
    : null;
}

/**
 * Post-sign-in landing per role — mirrors the web app's `homeFor`
 * (`apps/web/src/lib/permissions.ts`). Only used where the API itself 302s a
 * browser (the exempt super admin's full-session leg); every JSON leg lets
 * the web app route itself.
 */
export function homeForRole(role: UserRole): '/admin' | '/admin/profile' | '/portal' {
  if (role === 'client') return '/portal';
  if (role === 'support_engineer') return '/admin/profile';
  return '/admin';
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
  /** Phase 1: single-use HMAC magic-link tokens. */
  magicLinks: MagicLinkTokenStore;
  /** Phase 3: one signup invitation per address per cooldown window. */
  invites: SignupInviteCooldown;
  /**
   * Phase 4 anti-abuse: per-address issuance window + per-IP soft limit.
   * Optional so test harnesses that predate Phase 4 keep constructing; when
   * absent the checks are skipped (the plugin hard limit still applies).
   */
  abuse?: LoginAbuseGuard;
  /** Phase 4: Turnstile verification for soft-limited IPs. */
  turnstile?: TurnstileVerifier;
  /** Phase 4: whether captcha enforcement is switched on (`TURNSTILE_ENFORCE`). */
  turnstileEnforced?: boolean;
  /** Phase 2: forced-setup ledger — timed administrator windows only. */
  setups: MfaSetupStore;
  verifiers: MfaVerifierRegistry;
  breach: BreachCheck;
  email?: EmailProvider;
  /** `${WEB_ORIGIN}`: the reset link points at the web app, not the API. */
  webOrigin: string;
  /** `${API_PUBLIC_URL}`: the magic link points at THIS API's verify leg. */
  apiPublicUrl: string;
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
    // Phase 1: EVERY magic-link login continues at a six-digit code, so the
    // emailed OTP is always an available method — for staff as a fallback next
    // to TOTP/WebAuthn, and for clients as the standard second factor. The
    // mailbox just proved itself at the link leg; the code leg is what raises
    // the session to aal2.
    methods.push('email_otp');
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
    // Phase 4 guard: the admin roster is provisioned by super admins (work
    // order §1.4), never self-registered. All populated roster slots are
    // refused with the spec's exact copy BEFORE any other signup work — no
    // breach check, no repo read — so the guard cannot be probed as an
    // oracle for the other validation rules either. Placeholder slots carry
    // no email and can never match; filling one extends the guard for free.
    if (isAdminEmail(input.email)) {
      throw HttpError.unprocessable('signup_not_allowed', 'This email is not eligible for signup.');
    }

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
    const authUser = {
      email,
      password: input.password,
      emailConfirm: false,
      userMetadata: { fullName: input.fullName },
    };
    let created: { id: string };
    try {
      created = await this.deps.supabase.createUser(authUser);
    } catch (error) {
      // Self-heal: no profile row exists at this point (checked above), so an
      // auth user owning the address can only be debris from an earlier signup
      // whose transaction rolled back AFTER GoTrue had written — an unconfirmed
      // orphan that would otherwise poison the address for every future attempt
      // (`email_taken` → 409 forever). Reclaim it and retry, ONCE. A CONFIRMED
      // auth user without a profile is genuine drift, not debris: fail closed
      // and let an operator look — a confirmed identity is never deleted here.
      if (!(error instanceof SupabaseError) || error.code !== 'email_taken') throw error;
      const orphan = await this.deps.supabase.findAuthUserByEmail(email).catch(() => null);
      if (orphan === null || orphan.emailConfirmedAt) throw error;
      this.warn(`reclaiming orphaned unconfirmed auth user for ${email}`);
      await this.deps.supabase.deleteUser(orphan.id);
      created = await this.deps.supabase.createUser(authUser);
    }

    // Everything below runs inside the route's PG transaction, which GoTrue
    // cannot join: if ANY step fails (org/profile write, OTP issue, or the
    // email provider being down), the transaction rolls back but the auth user
    // above survives — an unconfirmed orphan that both violates the workflow
    // (an account exists without the signup having completed) and blocks the
    // address for the next attempt. Compensate by deleting it before rethrowing.
    try {
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
    } catch (error) {
      await this.deps.supabase.deleteUser(created.id).catch((cleanupError: unknown) => {
        this.warn('signup rolled back; could not delete the unverified auth user', cleanupError);
      });
      throw error;
    }
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

  /**
   * Magic-link step 1 (Phase 1): `POST /auth/magic-link`.
   *
   * The HTTP answer is ONE generic acknowledgement whether the address holds an
   * account or not — enumeration is impossible. What differs is only the email:
   * a registered, live profile receives a single-use verify link (any previous
   * link for the address dies when the new one is minted); an unregistered
   * address receives a signup invitation instead (Phase 3), at most one per
   * cooldown window so the endpoint cannot be weaponised as an email bomb.
   *
   * A missing email provider is a warning, not a failure — the posture the
   * login surface has always had (a provider outage must never change the
   * generic HTTP answer).
   */
  async requestMagicLink(
    input: MagicLinkInput,
    meta: RequestMeta,
  ): Promise<MagicLinkRequestOutcome> {
    const email = input.email.trim().toLowerCase();
    const next = sanitizeNextPath(input.next);

    // ——— Phase 4: bot signals first — a dropped bot consumes no budget and
    // never reaches the repo, so it cannot probe registration status either.
    // The HTTP answer is the identical generic 200 (the route composes it).
    if ((input.website ?? '').trim() !== '') {
      return { sent: 'bot_dropped', email, reason: 'honeypot' };
    }
    if (LoginAbuseGuard.isTooFast(input.formTs, this.now().getTime())) {
      return { sent: 'bot_dropped', email, reason: 'timing' };
    }

    // ——— Phase 4: per-IP soft limit → Turnstile (only when enforcement is
    // on; the flag depends on the IP alone, never on registration status).
    const abuse = this.deps.abuse;
    if (abuse !== undefined && (await abuse.softLimitHit(meta.ip))) {
      if (this.deps.turnstileEnforced === true) {
        const token = input.captchaToken?.trim();
        if (token === undefined || token === '') {
          return { sent: 'captcha_required', email };
        }
        // Throws 400 `captcha_failed` (one generic refusal, fail-closed).
        await (this.deps.turnstile ?? ALWAYS_HUMAN).assertHuman(token);
      }
    }

    const profile = await this.deps.repo.findProfileByEmail(email);
    const registered = profile !== null && profile.deletedAt === null;

    // ——— Phase 4: per-address issuance window — beyond it the request is
    // suppressed with the identical 200; no link, no invite, no enumeration.
    if (abuse !== undefined) {
      const window = await abuse.emailWindowClaim(email);
      if (!window.allowed) {
        return {
          sent: 'window_suppressed',
          email,
          retryAfterSeconds: window.retryAfterSeconds,
        };
      }
    }

    if (!registered) {
      // Phase 3: the invitation is the ONLY signal, and it goes to the address
      // itself — never to the HTTP response.
      if (!(await this.deps.invites.claim(email))) {
        return { sent: 'suppressed', email };
      }
      const signupLink = `${primaryWebOrigin(this.deps.webOrigin)}/signup`;
      if (this.deps.email === undefined) {
        this.warn('signup invitation requested but no email provider is configured');
        return { sent: 'suppressed', email };
      }
      await this.deps.email.send({
        to: email,
        subject: 'No VUNVAULT account found for this email',
        html: `<p>We received a sign-in request for <strong>${email}</strong>, but no VUNVAULT account is registered for this address.</p><p>If you would like an account, sign up here: <a href="${signupLink}">${signupLink}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
        text: `We received a sign-in request for ${email}, but no VUNVAULT account is registered for this address.\n\nIf you would like an account, sign up here: ${signupLink}\n\nIf you did not request this, you can safely ignore this email.`,
      });
      void meta;
      return { sent: 'invite', email };
    }

    const { token } = await this.deps.magicLinks.issue(email);
    const verifyUrl = new URL('/api/v1/auth/magic-link/verify', this.deps.apiPublicUrl);
    verifyUrl.searchParams.set('token', token);
    if (next !== null) verifyUrl.searchParams.set('next', next);
    const link = verifyUrl.toString();

    if (this.deps.email !== undefined) {
      await this.deps.email.send({
        to: email,
        subject: 'Your VUNVAULT sign-in link',
        html: `<p>Click the link below to sign in to VUNVAULT:</p><p><a href="${link}">${link}</a></p><p>The link expires in 15 minutes and works exactly once. Signing in continues with a six-digit verification code. If you did not request this, you can safely ignore this email — nothing changes on your account.</p>`,
        text: `Click the link below to sign in to VUNVAULT:\n\n${link}\n\nThe link expires in 15 minutes and works exactly once. Signing in continues with a six-digit verification code. If you did not request this, you can safely ignore this email — nothing changes on your account.`,
      });
    } else {
      this.warn('magic link requested but no email provider is configured');
    }
    // The token itself is never logged, at any level (work order §7).
    return { sent: 'link', email };
  }

  /**
   * Magic-link step 2 (Phase 1): `GET /auth/magic-link/verify?token=…`.
   *
   * Consumes the token atomically — signature first (a forgery never touches
   * storage), then TTL, then single-use, then the email binding. On success the
   * aal1 Supabase session is minted server-side (`issueSession`: the link never
   * leaves this process) and stored ENCRYPTED inside the pre-MFA challenge. The
   * browser gets only the challenge handle in the HttpOnly `vv_mfa` cookie —
   * never `vv_at`/`vv_rt` — so no protected route is reachable until
   * `POST /auth/mfa/verify` accepts the six-digit code and rotates the cookies.
   *
   * Every failure is a code the route turns into a redirect to the web login
   * screen; nothing here throws for an expected outcome.
   */
  async verifyMagicLink(
    token: string,
    next: string | null,
    meta: RequestMeta,
  ): Promise<MagicLinkVerifyResult> {
    const consumed = await this.deps.magicLinks.consume(token);
    if (consumed.status === 'invalid')
      return { kind: 'error', code: 'magic_link_invalid', email: null };
    if (consumed.status === 'expired')
      return { kind: 'error', code: 'magic_link_expired', email: null };
    if (consumed.status === 'used') return { kind: 'error', code: 'magic_link_used', email: null };

    const email = consumed.payload.email;
    const profile = await this.deps.repo.findProfileByEmail(email);
    if (profile === null || profile.deletedAt !== null) {
      // The address was live when the link was minted and is not now.
      return { kind: 'error', code: 'magic_link_invalid', email };
    }
    if (profile.accountStatus === 'blocked_mfa_setup' || profile.accountStatus === 'suspended') {
      return { kind: 'error', code: 'account_blocked', email };
    }
    if (profile.accountStatus !== 'active') {
      return { kind: 'error', code: 'account_inactive', email };
    }

    let supabaseSession: SupabaseSession;
    try {
      supabaseSession = await this.deps.supabase.issueSession(email);
    } catch (error) {
      this.warn('magic-link session issuance failed', error);
      return { kind: 'error', code: 'sign_in_unavailable', email };
    }

    await this.deps.repo.recordLoginAttempt({
      emailHash: emailHash(email),
      ip: meta.ip,
      succeeded: true,
      reason: null,
    });

    const methods = await this.availableMethods(profile);
    const origin = primaryWebOrigin(this.deps.webOrigin);

    // ——— Phase 2: forced first-sign-in MFA setup ———
    const enrolled = await this.mfaEnrolledFor(profile.id, profile.mfaEnrolled);
    if (!enrolled && needsForcedSetup(profile.role)) {
      // Lazy expiry first: a timed administrator window that closed without
      // enrolment blocks the account the next time it surfaces here.
      const stale = await this.deps.setups.forUser(profile.id);
      if (stale !== null && stale.deadlineEpochMs <= this.now().getTime()) {
        await this.blockSetupWindow(stale);
        return {
          kind: 'setup_blocked',
          email: profile.email,
          userId: profile.id,
          reason: 'window_expired',
        };
      }

      // The EXEMPT super admin (roster window `null` — divine@vunvault.com):
      // no setup gate, no timer, no block — MFA is optional, so an unenrolled
      // exempt sign-in gets the FULL session straight from this leg.
      if (isMfaSetupExempt(profile.email)) {
        const issued = await this.issueSession(supabaseSession, profile, {
          meta,
          mfaMethod: null,
        });
        return {
          kind: 'session',
          issued,
          email: profile.email,
          userId: profile.id,
          redirectTo: `${origin}${homeForRole(profile.role)}`,
        };
      }

      const windowSeconds = setupWindowSecondsFor(profile);
      const deadlineEpochMs =
        windowSeconds !== null ? this.now().getTime() + windowSeconds * 1000 : null;
      const setupHandle = (
        await this.deps.challenges.create({
          userId: profile.id,
          email: profile.email,
          remember: false,
          methods,
          session: supabaseSession,
          setup: { required: true, deadlineEpochMs },
        })
      ).handle;
      if (deadlineEpochMs !== null) {
        // Only TIMED windows are ledgered: the record outlives the challenge
        // so a missed window is detected lazily and turns into a block.
        await this.deps.setups.open({
          handle: setupHandle,
          userId: profile.id,
          email: profile.email,
          deadlineEpochMs,
          createdAtEpochMs: this.now().getTime(),
        });
      }
      const setupParams = new URLSearchParams({ to: maskEmailForRedirect(profile.email) });
      if (deadlineEpochMs !== null) setupParams.set('deadline', String(deadlineEpochMs));
      if (next !== null) setupParams.set('next', next);
      return {
        kind: 'challenge',
        handle: setupHandle,
        methods,
        email: profile.email,
        userId: profile.id,
        redirectTo: `${origin}/login/mfa/setup?${setupParams.toString()}`,
      };
    }

    const { handle } = await this.deps.challenges.create({
      userId: profile.id,
      email: profile.email,
      remember: false,
      methods,
      session: supabaseSession,
    });

    const params = new URLSearchParams({
      methods: methods.join(','),
      to: maskEmailForRedirect(profile.email),
    });
    if (next !== null) params.set('next', next);
    const redirectTo = `${origin}/login/mfa?${params.toString()}`;
    return {
      kind: 'challenge',
      handle,
      methods,
      email: profile.email,
      userId: profile.id,
      redirectTo,
    };
  }

  // ——— Phase 2: forced-setup legs (all guarded by the vv_mfa challenge) ———

  /**
   * Setup leg 1: start a TOTP enrolment against the pre-MFA session held in
   * the challenge. A dead handle whose ledger window has closed blocks the
   * administrator lazily (that is what makes walking away detectable).
   */
  async setupOptions(handle: string | undefined): Promise<
    | {
        kind: 'options';
        factorId: string;
        qrCodeSvg: string;
        secret: string;
        uri: string;
        deadlineEpochMs: number | null;
      }
    | { kind: 'blocked'; email: string; userId: string; reason: 'window_expired' }
  > {
    const challenge = await this.readSetupChallenge(handle);
    if (challenge === null) {
      const record = await this.blockIfWindowExpired(handle);
      if (record !== null) {
        return {
          kind: 'blocked',
          email: record.email,
          userId: record.userId,
          reason: 'window_expired',
        };
      }
      throw new HttpError(410, 'challenge_expired');
    }
    const session = this.deps.challenges.decryptSession(challenge);
    const enrollment = await this.deps.supabase.mfa.enrollTotp(
      session.accessToken,
      'Authenticator app',
    );
    return {
      kind: 'options',
      factorId: enrollment.factorId,
      qrCodeSvg: enrollment.qrSvg,
      secret: enrollment.secret,
      uri: enrollment.uri,
      deadlineEpochMs: challenge.setup?.deadlineEpochMs ?? null,
    };
  }

  /**
   * Setup leg 2: the first correct code verifies the factor AND opens the
   * full session (aal2). Wrong codes count against the challenge's attempt
   * budget; an exhausted budget destroys the challenge — and an administrator
   * whose window is ledgered is blocked immediately (brute-force defence).
   */
  async setupVerify(
    handle: string | undefined,
    body: { factorId: string; code: string },
    meta: RequestMeta,
  ): Promise<
    | { kind: 'session'; issued: IssuedSession }
    | { kind: 'blocked'; email: string; userId: string; reason: 'window_expired' }
  > {
    const challenge = await this.readSetupChallenge(handle);
    if (challenge === null) {
      const record = await this.blockIfWindowExpired(handle);
      if (record !== null) {
        return {
          kind: 'blocked',
          email: record.email,
          userId: record.userId,
          reason: 'window_expired',
        };
      }
      throw new HttpError(410, 'challenge_expired');
    }
    const safeHandle = handle as string; // readSetupChallenge proved it non-empty

    // Phase 4: the setup leg honours the same exponential-backoff lock.
    this.assertNotLocked(challenge);

    const aal1 = this.deps.challenges.decryptSession(challenge);
    let aal2: SupabaseSession;
    try {
      aal2 = await this.deps.supabase.mfa.challengeAndVerify(
        aal1.accessToken,
        body.factorId,
        body.code,
      );
    } catch (error) {
      // The attempt budget is the brute-force defence: at the fifth failure the
      // challenge dies. For an administrator the ledgered window then expires
      // on its own and the LAZY block fires on the next touch — blocking here
      // instead would punish typos inside the window with no audit trail.
      const { exhausted } = await this.deps.challenges.recordFailure(
        safeHandle,
        this.now().getTime(),
      );
      if (exhausted) await this.deps.challenges.delete(safeHandle);
      if (error instanceof HttpError) throw error;
      throw new HttpError(401, 'mfa_failed', 'That code was not accepted');
    }

    await this.deps.repo.setMfaEnrolled(challenge.userId, true);
    await this.deps.challenges.delete(safeHandle);
    const record = await this.deps.setups.forUser(challenge.userId);
    if (record !== null) await this.deps.setups.clear(record);

    const profile = await this.deps.repo.findProfileById(challenge.userId);
    if (profile === null || profile.accountStatus !== 'active' || profile.deletedAt !== null) {
      throw HttpError.unauthorized();
    }
    const issued = await this.issueSession(aal2, profile, {
      meta,
      mfaMethod: 'totp',
      remember: challenge.remember,
    });
    return { kind: 'session', issued };
  }

  /**
   * Setup leg 3: explicit abandonment. An administrator inside a TIMED window
   * is blocked (that is the work order's abandonment rule); an unenrolled
   * client simply loses the challenge and may request a fresh magic link.
   */
  async setupAbandon(handle: string | undefined): Promise<{
    blocked: boolean;
    email: string | null;
    userId: string | null;
  }> {
    const challenge = await this.readSetupChallenge(handle);
    if (challenge === null) {
      const record = await this.blockIfWindowExpired(handle);
      return {
        blocked: record !== null,
        email: record?.email ?? null,
        userId: record?.userId ?? null,
      };
    }
    const record = await this.deps.setups.forUser(challenge.userId);
    await this.deps.challenges.delete(handle as string);
    if (record === null) {
      // Untimed window (client enrolment): nothing to block.
      return { blocked: false, email: challenge.email, userId: challenge.userId };
    }
    const profile = await this.deps.repo.findProfileById(challenge.userId);
    if (profile !== null && profile.accountStatus === 'active' && profile.deletedAt === null) {
      const enrolled = await this.mfaEnrolledFor(profile.id, profile.mfaEnrolled);
      if (!enrolled) {
        await this.deps.repo.setAccountStatus(profile.id, 'blocked_mfa_setup');
        await this.deps.setups.clear(record);
        return { blocked: true, email: profile.email, userId: profile.id };
      }
    }
    await this.deps.setups.clear(record);
    return { blocked: false, email: challenge.email, userId: challenge.userId };
  }

  /** The challenge behind a setup call — and it MUST be a setup challenge. */
  private async readSetupChallenge(handle: string | undefined): Promise<MfaChallenge | null> {
    if (handle === undefined || handle === '') return null;
    const challenge = await this.deps.challenges.read(handle);
    if (challenge === null) return null;
    if (challenge.setup === undefined) throw HttpError.forbidden();
    return challenge;
  }

  /**
   * Dead handle → is there a ledgered window that closed? If so, block and
   * return the record (for the route's audit); otherwise null (plain 410).
   */
  private async blockIfWindowExpired(handle: string | undefined): Promise<MfaSetupRecord | null> {
    if (handle === undefined || handle === '') return null;
    const record = await this.deps.setups.forHandle(handle);
    if (record === null || record.handle !== handle) return null;
    if (record.deadlineEpochMs > this.now().getTime()) return null; // window still open (challenge evicted): plain 410
    await this.blockSetupWindow(record);
    return record;
  }

  /** Flip an unenrolled, still-active administrator to `blocked_mfa_setup`. */
  private async blockSetupWindow(record: MfaSetupRecord): Promise<void> {
    await this.deps.setups.clear(record);
    const profile = await this.deps.repo.findProfileById(record.userId);
    if (profile === null || profile.deletedAt !== null || profile.accountStatus !== 'active')
      return;
    if (await this.mfaEnrolledFor(profile.id, profile.mfaEnrolled)) return;
    await this.deps.repo.setAccountStatus(profile.id, 'blocked_mfa_setup');
  }

  /**
   * Phase 4: refuse while the previous failure's exponential-backoff lock is
   * running (2s → 4s → 8s from the 2nd failure; the 5th destroys the
   * challenge). 429 + Retry-After, one generic message, and — importantly —
   * no attempt consumed, so a locked client cannot burn its own budget.
   */
  private assertNotLocked(challenge: MfaChallenge): void {
    const lockedUntil = challenge.lockedUntilEpochMs;
    if (lockedUntil === undefined) return;
    const nowMs = this.now().getTime();
    if (lockedUntil <= nowMs) return;
    const retryAfter = Math.max(1, Math.ceil((lockedUntil - nowMs) / 1000));
    throw new HttpError(
      429,
      'rate_limited',
      `Too many incorrect codes. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
      undefined,
      { 'retry-after': retryAfter },
    );
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

    // Phase 4: a challenge in its exponential-backoff lock refuses outright —
    // 429 + Retry-After, and the attempt budget is NOT consumed while locked.
    this.assertNotLocked(challenge);

    const verifier = this.deps.verifiers.get(method);
    if (verifier === undefined) {
      throw new HttpError(501, 'not_implemented', `${method} verification is not available yet`);
    }

    let result;
    try {
      result = await verifier.verify({ challenge, body, req });
    } catch (error) {
      const { exhausted } = await this.deps.challenges.recordFailure(handle, this.now().getTime());
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
