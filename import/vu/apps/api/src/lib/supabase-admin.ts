import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * A thin, testable wrapper over the Supabase admin API.
 *
 * Supabase Auth owns credentials: this module never hashes a password, never sees
 * a recovery code, and never stores a token. Routes depend on the interface, so
 * tests substitute a fake and no test ever talks to Supabase.
 */

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  userId: string;
  aal: 'aal1' | 'aal2';
}

export interface TotpEnrollment {
  factorId: string;
  qrSvg: string;
  secret: string;
  uri: string;
}

export interface SignInResult {
  session: SupabaseSession | null;
  userId: string;
  mfaRequired: boolean;
  factors: Array<{ id: string; type: 'totp' }>;
}

/** The provider's view of the user, as far as an OAuth sign-in cares (Task 40e). */
export interface OAuthUser {
  id: string;
  email: string;
  /** The provider vouched for the mailbox (`email_confirmed_at` is set). */
  emailVerified: boolean;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface SupabaseAdminMfa {
  enrollTotp(accessToken: string, friendlyName: string): Promise<TotpEnrollment>;
  challengeAndVerify(accessToken: string, factorId: string, code: string): Promise<SupabaseSession>;
  unenroll(accessToken: string, factorId: string): Promise<void>;
  listFactors(userId: string): Promise<Array<{ id: string; type: 'totp'; verified: boolean }>>;
}

export interface SupabaseAdmin {
  createUser(input: {
    email: string;
    password: string;
    emailConfirm?: boolean;
    userMetadata?: Record<string, unknown>;
  }): Promise<{ id: string }>;
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  refresh(refreshToken: string): Promise<SupabaseSession>;
  signOut(accessToken: string, scope: 'global' | 'local' | 'others'): Promise<void>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  /** Task 40d: mark the mailbox as confirmed once the signup OTP passes. */
  confirmEmail(userId: string): Promise<void>;
  /**
   * Task 40d: mint an aal1 session for a confirmed address without its password —
   * a magic link generated and redeemed entirely server-side.
   */
  issueSession(email: string): Promise<SupabaseSession>;
  /** Task 40d: remove an unverified (or stale pending) auth user. */
  deleteUser(userId: string): Promise<void>;
  /**
   * Locate the GoTrue auth user owning an email address (paginated admin scan;
   * `null` when nobody owns it). Signup and roster provisioning use it to
   * detect ORPHANED auth users — rows GoTrue wrote for a transaction that
   * later rolled back, which GoTrue cannot roll back with it. An unconfirmed
   * orphan with no profile behind it poisons the address for every future
   * signup (`email_taken`), so the flows reclaim it instead of failing.
   */
  findAuthUserByEmail(email: string): Promise<{ id: string; emailConfirmedAt: boolean } | null>;
  /**
   * Task 40e: the Supabase `/auth/v1/authorize` URL the browser is redirected to
   * to start an OAuth PKCE flow.
   */
  buildAuthorizeUrl(input: {
    provider: string;
    redirectTo: string;
    codeChallenge: string;
    state: string;
  }): string;
  /** Task 40e: trade the provider's authorization code plus our PKCE verifier for a session. */
  exchangeCodeForSession(
    authCode: string,
    codeVerifier: string,
  ): Promise<{ session: SupabaseSession; user: OAuthUser }>;
  mfa: SupabaseAdminMfa;
}

/** A Supabase error, normalised to something a route can branch on. */
export class SupabaseError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'SupabaseError';
    this.code = code;
    this.status = status;
  }
}

/**
 * CHANGED: recognise "email already registered". The SDK returns
 * `code: "user_already_exists"` on GoTrue 422s, but some versions only
 * populate the message — so we check the code first, then fall back to a
 * case-insensitive message match. Both paths produce `email_taken`, which
 * the signup route converts to HTTP 409.
 */
function fail(
  error: {
    message?: string;
    status?: number;
    name?: string;
    code?: string;
  } | null,
): never {
  const status = error?.status ?? 400;
  const message = error?.message ?? 'Supabase request failed';
  const rawCode = error?.code;
  const lower = message.toLowerCase();

  let code: string;
  if (rawCode === 'user_already_exists' || rawCode === 'email_exists') {
    code = 'email_taken';
  } else if (
    lower.includes('already been registered') ||
    lower.includes('already registered') ||
    lower.includes('user already exists')
  ) {
    code = 'email_taken';
  } else if (error?.name === 'AuthApiError' && status === 400) {
    code = 'invalid_credentials';
  } else {
    code = 'supabase_error';
  }

  throw new SupabaseError(code, message, status);
}

export interface SupabaseAdminOptions {
  url: string;
  serviceRoleKey: string;
  /** Test seam: supply a pre-built client. */
  client?: SupabaseClient;
  /** Test seam: supply per-user clients instead of building them from a token. */
  userClient?: (accessToken: string) => SupabaseClient;
}

/**
 * GoTrue exposes the session id ONLY as a JWT claim — its REST responses carry
 * no session-id field. Decoding (not verifying; the signature is verified by
 * the auth plugin's `resolveUser`) restores the correspondence the fail-closed
 * session registry depends on: the `user_sessions` row created from this object
 * must carry the same id as the access token's `session_id` claim, or every
 * authenticated request 401s at the registry lookup.
 */
export function sessionIdFromAccessToken(accessToken: string): string {
  try {
    const part = accessToken.split('.')[1];
    if (part === undefined || part === '') return '';
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as {
      session_id?: unknown;
    };
    return typeof claims.session_id === 'string' ? claims.session_id : '';
  } catch {
    return '';
  }
}

function toSession(
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string };
  },
  aal: 'aal1' | 'aal2',
): SupabaseSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    sessionId: sessionIdFromAccessToken(session.access_token),
    userId: session.user.id,
    aal,
  };
}

export function createSupabaseAdmin(options: SupabaseAdminOptions): SupabaseAdmin {
  // Strip a trailing slash so paths like `/auth/v1/...` don't become `//auth/v1/...`.
  const baseUrl = options.url.replace(/\/+$/, '');

  const admin =
    options.client ??
    createClient(baseUrl, options.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  /**
   * MFA operations act on a *user's* session, not on the service role. The SDK
   * keeps no session (persistSession: false), so each call gets a client that
   * presents the user's access token.
   */
  const asUser =
    options.userClient ??
    ((accessToken: string): SupabaseClient =>
      createClient(baseUrl, options.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      }));

  return {
    async createUser(input) {
      const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: input.emailConfirm ?? true,
        user_metadata: input.userMetadata,
      });
      if (error !== null || data.user === null) fail(error);
      return { id: data.user.id };
    },

    async signInWithPassword(email, password) {
      const { data, error } = await admin.auth.signInWithPassword({ email, password });
      if (error !== null) fail(error);

      const factors = (data.user?.factors ?? [])
        .filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
        .map((factor) => ({ id: factor.id, type: 'totp' as const }));

      if (data.session === null) {
        // A verified factor exists: Supabase withholds the session until MFA passes.
        return { session: null, userId: data.user?.id ?? '', mfaRequired: true, factors };
      }

      return {
        session: toSession(data.session, 'aal1'),
        userId: data.user?.id ?? data.session.user.id,
        mfaRequired: false,
        factors,
      };
    },

    async refresh(refreshToken) {
      const { data, error } = await admin.auth.refreshSession({ refresh_token: refreshToken });
      if (error !== null || data.session === null) fail(error);
      return toSession(data.session, 'aal1');
    },

    async signOut(accessToken, scope) {
      const { error } = await admin.auth.admin.signOut(accessToken, scope);
      if (error !== null) fail(error);
    },

    async updatePassword(userId, newPassword) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (error !== null) fail(error);
    },

    async confirmEmail(userId) {
      const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error !== null) fail(error);
    },

    /**
     * Generate a magic link for the address and redeem its hashed token in the
     * same breath, server-side: the link never leaves this process, but the
     * session it mints is a real aal1 Supabase session.
     */
    async issueSession(email) {
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      if (error !== null) fail(error);
      const tokenHash = data.properties.hashed_token;
      const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      if (verifyError !== null || verified.session === null) fail(verifyError);
      return toSession(verified.session, 'aal1');
    },

    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error !== null) fail(error);
    },

    async findAuthUserByEmail(email) {
      const wanted = email.trim().toLowerCase();
      const perPage = 50;
      // Loop to the first EMPTY page rather than trusting `length < perPage`:
      // a server that clamps per_page lower than requested would otherwise end
      // the scan early and miss the user. 200 pages = 10 000 users of cover.
      for (let page = 1; page <= 200; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error !== null) fail(error);
        const users = data.users ?? [];
        for (const user of users) {
          if ((user.email ?? '').trim().toLowerCase() === wanted) {
            return { id: user.id, emailConfirmedAt: user.email_confirmed_at !== null };
          }
        }
        if (users.length === 0) return null;
      }
      return null;
    },

    buildAuthorizeUrl({ provider, redirectTo, codeChallenge, state }) {
      const params = new URLSearchParams({
        provider,
        redirect_to: redirectTo,
        code_challenge: codeChallenge,
        code_challenge_method: 's256',
        state,
      });
      return `${baseUrl}/auth/v1/authorize?${params.toString()}`;
    },

    /**
     * Server-side PKCE exchange. The SDK's own `exchangeCodeForSession` reads the
     * verifier from the client's storage (it expects `signInWithOAuth` to have
     * put it there); ours lives in Redis between the two legs of the flow, so
     * this posts to the GoTrue token endpoint directly — the exact request the
     * SDK would send: `grant_type=pkce` with the auth code and OUR verifier.
     */
    async exchangeCodeForSession(authCode, codeVerifier) {
      const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: options.serviceRoleKey,
          Authorization: `Bearer ${options.serviceRoleKey}`,
        },
        body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
      });
      const payload = (await response.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        user?: {
          id: string;
          email?: string;
          email_confirmed_at?: string | null;
          user_metadata?: Record<string, unknown> | null;
        };
        error?: string;
        error_description?: string;
        msg?: string;
      } | null;

      const user = payload?.user;
      if (
        !response.ok ||
        payload === null ||
        user === undefined ||
        typeof payload.access_token !== 'string' ||
        typeof payload.refresh_token !== 'string'
      ) {
        fail({
          message:
            payload?.error_description ??
            payload?.error ??
            payload?.msg ??
            'OAuth code exchange failed',
          status: response.status,
          name: 'AuthApiError',
        });
      }

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const pick = (...keys: string[]): string | null => {
        for (const key of keys) {
          const value = metadata[key];
          if (typeof value === 'string' && value !== '') return value;
        }
        return null;
      };
      return {
        session: toSession(
          {
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            expires_in: payload.expires_in ?? 3600,
            user: { id: user.id },
          },
          'aal1',
        ),
        user: {
          id: user.id,
          email: user.email ?? '',
          emailVerified: user.email_confirmed_at !== null && user.email_confirmed_at !== undefined,
          fullName: pick('full_name', 'name'),
          avatarUrl: pick('avatar_url', 'picture'),
        },
      };
    },

    /**
     * Best-effort revocation at Supabase. The authoritative revocation is our own
     * `user_sessions.revoked_at` row, which the session registry checks on every
     * request; the SDK exposes no delete-by-session-id call, so this posts to the
     * admin endpoint directly and tolerates a 404.
     */
    async deleteSession(sessionId) {
      const response = await fetch(
        `${baseUrl}/auth/v1/admin/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: options.serviceRoleKey,
            Authorization: `Bearer ${options.serviceRoleKey}`,
          },
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new SupabaseError(
          'supabase_error',
          'Could not revoke the Supabase session',
          response.status,
        );
      }
    },

    mfa: {
      async enrollTotp(accessToken, friendlyName) {
        const { data, error } = await asUser(accessToken).auth.mfa.enroll({
          factorType: 'totp',
          friendlyName,
        });
        if (error !== null || data.totp === undefined) fail(error);
        return {
          factorId: data.id,
          qrSvg: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        };
      },

      async challengeAndVerify(accessToken, factorId, code) {
        const client = asUser(accessToken);
        const challenge = await client.auth.mfa.challenge({ factorId });
        if (challenge.error !== null) fail(challenge.error);
        const verified = await client.auth.mfa.verify({
          factorId,
          challengeId: challenge.data.id,
          code,
        });
        if (verified.error !== null) fail(verified.error);
        // A successful verification upgrades the session to AAL2.
        return {
          accessToken: verified.data.access_token,
          refreshToken: verified.data.refresh_token,
          expiresIn: verified.data.expires_in,
          sessionId: sessionIdFromAccessToken(verified.data.access_token),
          userId: verified.data.user.id,
          aal: 'aal2',
        };
      },

      async unenroll(accessToken, factorId) {
        const { error } = await asUser(accessToken).auth.mfa.unenroll({ factorId });
        if (error !== null) fail(error);
      },

      async listFactors(userId) {
        // The admin API exposes factors on the user record, not as a list call.
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error !== null) fail(error);
        const factors = data.user?.factors ?? [];
        return factors
          .filter((factor: { factor_type: string }) => factor.factor_type === 'totp')
          .map((factor: { id: string; status: string }) => ({
            id: factor.id,
            type: 'totp' as const,
            verified: factor.status === 'verified',
          }));
      },
    },
  };
}
