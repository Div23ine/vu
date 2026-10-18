import type { MfaMethod } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { isStaff } from '../../../lib/staff.js';
import { codeChallengeFor, generateCodeVerifier, generateState } from '../../../lib/pkce.js';
import type { OAuthUser, SupabaseAdmin } from '../../../lib/supabase-admin.js';
import { actorLabelFor } from '../../../audit/audited.js';
import type { AuditAppendInput } from '../../../audit/service.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import { newSessionId, type KvStore, type MfaChallengeStore } from './challenge.js';
import { deviceLabel, geoCity, geoCountry, type GeoHeaders } from './device.js';
import type { AuthProfileRow, AuthRepo } from './repo.js';
import { splitName } from './service.js';

/**
 * OAuth sign-in (Task 40e): Google, GitHub and Microsoft through Supabase PKCE.
 *
 * The flow in one paragraph: `start` mints a `state` that is simultaneously the
 * CSRF token, the Redis key and the envelope carrying the PKCE verifier and the
 * post-login destination; the browser is redirected to Supabase's authorize URL
 * with the S256 challenge. The provider comes back to `callback`, which consumes
 * the state atomically, trades the code plus verifier for a real Supabase
 * session, and then makes exactly three decisions: is the mailbox verified, does
 * a profile exist (and is it staff), and does the account hold a second factor.
 * A first-time sign-in creates a CLIENT account — never a staff one; staff are
 * refused and redirected to password + MFA. Nothing is ever auto-linked: an
 * OAuth identity whose email belongs to a different profile id is refused.
 *
 * No token appears in a URL, a JSON body or a redirect target: the session
 * travels in HttpOnly cookies exactly as it does for password login, and an MFA
 * user gets the same `vv_mfa` challenge handle login would have issued.
 */

export const OAUTH_PROVIDERS = ['google', 'github', 'microsoft'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/** Supabase's provider ids: `microsoft` is `azure` on the Supabase side. */
export const SUPABASE_PROVIDER_NAMES: Record<OAuthProvider, string> = {
  google: 'google',
  github: 'github',
  microsoft: 'azure',
};

export const OAUTH_STATE_PREFIX = 'oauth:state:';
export const OAUTH_STATE_TTL_SECONDS = 600;
export const OAUTH_COOKIE_NAME = 'vv_oauth';
export const OAUTH_COOKIE_PATH = '/api/v1/auth';
/** Where `next` lands when it is missing or untrustworthy. */
export const OAUTH_DEFAULT_NEXT = '/portal';

export interface OAuthState {
  provider: OAuthProvider;
  verifier: string;
  next: string;
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * A usable `next` is a relative path beginning with a single `/`: not `//` (a
 * protocol-relative URL is an open redirect), not anything containing `\`
 * (browsers normalise backslashes, attackers know this). Everything else is
 * ignored and the portal becomes the destination.
 */
export function sanitizeNext(next: string | undefined): string {
  if (next === undefined || next === '') return OAUTH_DEFAULT_NEXT;
  if (!next.startsWith('/')) return OAUTH_DEFAULT_NEXT;
  if (next.startsWith('//')) return OAUTH_DEFAULT_NEXT;
  if (next.includes('\\')) return OAUTH_DEFAULT_NEXT;
  return next;
}

/** The narrow Redis surface, extended with the atomic read-and-delete. */
export interface OAuthKvStore extends KvStore {
  /** Redis `GETDEL`. Optional: the fallback is `get` then `del`. */
  getDel?(key: string): Promise<string | null>;
}

export interface OAuthStateStoreOptions {
  ttlSeconds?: number;
  /** Test seams. */
  randomState?: () => string;
  randomVerifier?: () => string;
}

/**
 * The state record: `{ provider, verifier, next }` under `oauth:state:<state>`,
 * for ten minutes, consumed exactly once — a replayed callback finds nothing.
 */
export class OAuthStateStore {
  private readonly store: OAuthKvStore;
  private readonly options: OAuthStateStoreOptions;

  constructor(store: OAuthKvStore, options: OAuthStateStoreOptions = {}) {
    this.store = store;
    this.options = options;
  }

  static keyFor(state: string): string {
    return `${OAUTH_STATE_PREFIX}${state}`;
  }

  async create(state: OAuthState): Promise<string> {
    const token = (this.options.randomState ?? generateState)();
    await this.store.set(
      OAuthStateStore.keyFor(token),
      JSON.stringify(state),
      'EX',
      this.options.ttlSeconds ?? OAUTH_STATE_TTL_SECONDS,
    );
    return token;
  }

  async consume(state: string): Promise<OAuthState | null> {
    const key = OAuthStateStore.keyFor(state);
    const raw =
      this.store.getDel !== undefined ? await this.store.getDel(key) : await this.getThenDel(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as OAuthState;
    } catch {
      return null;
    }
  }

  private async getThenDel(key: string): Promise<string | null> {
    const raw = await this.store.get(key);
    if (raw !== null) await this.store.del(key);
    return raw;
  }
}

/**
 * Onboarding lives in its own table and the auth repo (owned by earlier tasks)
 * does not expose it, so the OAuth flow keeps this one-query repo to itself.
 */
export interface OnboardingRepo {
  hasCompletedOnboarding(userId: string): Promise<boolean>;
}

export class SqlOnboardingRepo implements OnboardingRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ completed_at: Date | string | null }>>(
      'select completed_at from onboarding_profiles where user_id = $1::uuid limit 1',
      [userId],
    );
    const completedAt = rows[0]?.completed_at;
    return completedAt !== null && completedAt !== undefined;
  }
}

export interface OAuthStartResult {
  state: string;
  /** The Supabase authorize URL; the route turns it into a 302. */
  location: string;
}

export interface OAuthSessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type OAuthCallbackResult =
  /** Something was refused: the browser goes to `/login?error=…`, no cookies. */
  | { kind: 'error'; location: string }
  /** A second factor is enrolled: the browser goes to `/login?mfa=1` with `vv_mfa`. */
  | { kind: 'mfa'; handle: string; location: string }
  /** A full aal1 session: the route sets the three cookies and redirects. */
  | { kind: 'session'; tokens: OAuthSessionTokens; location: string };

export interface OAuthCallbackInput {
  code?: string;
  state?: string;
  /** The provider's own `error` query parameter, e.g. `access_denied`. */
  error?: string;
  cookieState?: string;
  ip: string;
  userAgent?: string | null;
  headers?: GeoHeaders;
}

export interface OAuthServiceDeps {
  repo: AuthRepo;
  onboarding: OnboardingRepo;
  supabase: SupabaseAdmin;
  states: OAuthStateStore;
  challenges: MfaChallengeStore;
  audit: { append(executor: SqlExecutor, input: AuditAppendInput): Promise<unknown> };
  /** `${WEB_ORIGIN}`: every callback redirect points at the web app. */
  webOrigin: string;
  now?: () => Date;
  log?: { warn: (message: string, error?: unknown) => void };
}

export class OAuthService {
  private readonly deps: OAuthServiceDeps;
  private readonly now: () => Date;
  private readonly warn: (message: string, error?: unknown) => void;

  constructor(deps: OAuthServiceDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
    this.warn = deps.log?.warn.bind(deps.log) ?? (() => undefined);
  }

  /**
   * Leg one: validate the provider, sanitise `next`, mint state + verifier and
   * build the authorize URL. The operators enable the providers themselves in the
   * Supabase dashboard — this route only starts flows for the three it knows.
   */
  async start(
    provider: string,
    next: string | undefined,
    redirectTo: string,
  ): Promise<OAuthStartResult> {
    if (!isOAuthProvider(provider)) {
      throw HttpError.notFound();
    }
    const verifier = generateCodeVerifier();
    const state = await this.deps.states.create({
      provider,
      verifier,
      next: sanitizeNext(next),
    });
    const location = this.deps.supabase.buildAuthorizeUrl({
      provider: SUPABASE_PROVIDER_NAMES[provider],
      redirectTo,
      codeChallenge: codeChallengeFor(verifier),
      state,
    });
    return { state, location };
  }

  /** Leg two: consume the state, exchange the code, and decide what the browser gets. */
  async callback(input: OAuthCallbackInput, executor: SqlExecutor): Promise<OAuthCallbackResult> {
    const refused = (error: string): OAuthCallbackResult => ({
      kind: 'error',
      location: `${this.deps.webOrigin}/login?error=${error}`,
    });

    // The state check comes first: without it nothing else about this request is
    // trustworthy. Query state must equal the cookie AND exist in Redis.
    const state = input.state;
    if (state === undefined || state === '' || state !== input.cookieState) {
      return refused('oauth_state');
    }
    const stored = await this.deps.states.consume(state);
    if (stored === null) return refused('oauth_state');

    // The provider itself refused (the user clicked "cancel", or a scope was denied).
    if (input.error !== undefined && input.error !== '') return refused('oauth_denied');

    const code = input.code;
    if (code === undefined || code === '') return refused('oauth_denied');

    let session;
    let user: OAuthUser;
    try {
      const exchanged = await this.deps.supabase.exchangeCodeForSession(code, stored.verifier);
      session = exchanged.session;
      user = exchanged.user;
    } catch (error) {
      this.warn('oauth code exchange failed', error);
      return refused('oauth_state');
    }

    const existing = await this.deps.repo.findProfileById(user.id);

    // An unverified mailbox is not an identity. If this attempt is what created
    // the Supabase user — no profile ever existed for it — the user goes too.
    if (!user.emailVerified) {
      if (existing === null) {
        await this.deps.supabase.deleteUser(user.id).catch((error: unknown) => {
          this.warn('could not delete the unverified oauth user', error);
        });
      }
      return refused('oauth_email_unverified');
    }

    let profile: AuthProfileRow;
    if (existing === null) {
      // An account already owns this email under a DIFFERENT id: the identities
      // are not linked, and linking is never automatic — a provider account with
      // a matching email is exactly how an account takeover would arrive.
      const byEmail = await this.deps.repo.findProfileByEmail(user.email);
      if (byEmail !== null) return refused('oauth_email_in_use');
      profile = await this.createClientAccount(user, stored.provider, executor, input.ip);
    } else if (isStaff(existing.role)) {
      // Staff sign in with a password and MFA, full stop. The session this
      // exchange just minted is destroyed at Supabase before the redirect.
      await this.deps.supabase.signOut(session.accessToken, 'global').catch((error: unknown) => {
        this.warn('could not destroy the refused staff oauth session', error);
      });
      await this.deps.audit.append(executor, {
        eventType: 'AUTH_FAILURE',
        actor: { id: existing.id, label: actorLabelFor(existing.email) },
        subject: existing.email,
        message: `OAuth sign-in with ${stored.provider} was refused for a staff account`,
        details: { provider: stored.provider, reason: 'staff_oauth_blocked' },
        ip: input.ip,
      });
      return refused('oauth_not_allowed');
    } else {
      profile = existing;
    }

    // A second factor is enrolled: the login flow's challenge, verbatim — the
    // browser gets the `vv_mfa` handle and `/login?mfa=1`, never a session.
    const methods = await this.mfaMethodsFor(profile);
    if (methods.length > 0) {
      const { handle } = await this.deps.challenges.create({
        userId: profile.id,
        email: profile.email,
        remember: false,
        methods,
        session,
      });
      return {
        kind: 'mfa',
        handle,
        location: `${this.deps.webOrigin}/login?mfa=1&next=${encodeURIComponent(stored.next)}`,
      };
    }

    // A full session: our own session row, the last-active touch and the audit
    // entry commit in the caller's transaction.
    const sessionId = session.sessionId === '' ? newSessionId() : session.sessionId;
    const headers = input.headers ?? {};
    await this.deps.repo.createSession({
      id: sessionId,
      userId: profile.id,
      deviceLabel: deviceLabel(input.userAgent ?? null),
      userAgent: input.userAgent ?? null,
      ip: input.ip,
      geoCity: geoCity(headers),
      geoCountry: geoCountry(headers),
      mfaMethod: null,
    });
    await this.deps.repo.touchProfileLastActive(profile.id, this.now());
    await this.deps.audit.append(executor, {
      eventType: 'AUTH_SUCCESS',
      actor: { id: profile.id, label: profile.email },
      subject: profile.email,
      message: `${profile.email} signed in with ${stored.provider}`,
      details: { provider: stored.provider },
      ip: input.ip,
    });

    // A client who has not finished onboarding goes to the wizard, whatever
    // `next` said: the portal is useless to somebody the platform has not met.
    const onboarded = await this.deps.onboarding.hasCompletedOnboarding(profile.id);
    const location = onboarded
      ? `${this.deps.webOrigin}${stored.next}`
      : `${this.deps.webOrigin}/onboarding`;

    return {
      kind: 'session',
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
      location,
    };
  }

  /** First sign-in: a CLIENT account, created and audited in one transaction. */
  private async createClientAccount(
    user: OAuthUser,
    provider: OAuthProvider,
    executor: SqlExecutor,
    ip: string,
  ): Promise<AuthProfileRow> {
    const email = user.email.trim().toLowerCase();
    const fullName = user.fullName?.trim() || email.split('@')[0] || 'Client';
    const { firstName, lastName } = splitName(fullName);

    const clientCode = await this.deps.repo.nextClientCode();
    const orgId = await this.deps.repo.createOrganization({
      name: fullName,
      clientCode,
      country: null,
    });
    await this.deps.repo.createProfile({
      id: user.id,
      orgId,
      email,
      fullName,
      firstName,
      lastName,
      phone: null,
      country: null,
      accountType: 'individual',
      role: 'client',
      accountStatus: 'active',
      require2fa: false,
    });
    await this.deps.audit.append(executor, {
      eventType: 'ACCOUNT_REGISTERED',
      actor: { id: user.id, label: email },
      subject: email,
      message: `Account registered for ${email} via ${provider} OAuth`,
      details: { provider },
      ip,
    });

    return {
      id: user.id,
      email,
      fullName,
      firstName,
      lastName,
      role: 'client',
      orgId,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    };
  }

  /** A verified TOTP factor or a WebAuthn key — the same bar login holds. */
  private async mfaMethodsFor(profile: AuthProfileRow): Promise<MfaMethod[]> {
    const [factors, webauthnCount] = await Promise.all([
      this.deps.supabase.mfa.listFactors(profile.id).catch(() => []),
      this.deps.repo.countWebauthnCredentials(profile.id).catch(() => 0),
    ]);
    const methods: MfaMethod[] = [];
    if (factors.some((factor) => factor.verified)) methods.push('totp');
    if (webauthnCount > 0) methods.push('webauthn');
    return methods;
  }
}
