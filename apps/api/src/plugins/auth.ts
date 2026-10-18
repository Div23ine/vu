import fp from 'fastify-plugin';
import type { Permission, UserRole } from '@vunvault/contracts';
import type { FastifyPluginAsync, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { HttpError } from '../lib/http-error.js';
import { tokenIssuer, verifyAccessToken } from '../lib/jwt.js';
import {
  SessionRegistry,
  createDbSessionLookup,
  type CacheLike,
  type SessionRegistryOptions,
} from '../lib/session-registry.js';
import { isStaff, STAFF_ROLES } from '../lib/staff.js';
import { createSupabaseAdmin, SupabaseError, type SupabaseAdmin } from '../lib/supabase-admin.js';
import { COOKIE_NAMES } from './cookies.js';

/**
 * Request authentication and authorisation.
 *
 * The access token comes from the HttpOnly `vv_at` cookie only. A valid signature
 * is necessary but not sufficient: every request also consults the session
 * registry, so a suspension, a soft delete or a revoked device session takes
 * effect within the registry's cache TTL instead of when the token expires.
 */

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  orgId: string | null;
  permissions: Permission[];
  aal: 'aal1' | 'aal2';
  sessionId: string;
}

export interface AuthPluginOptions {
  /** Test seam: the HS256 secret instead of reading it from `app.secrets`. */
  secret?: string;
  /** Test seam: an injected registry. */
  registry?: SessionRegistry;
  /** Test seam: an injected Supabase admin client. */
  supabase?: SupabaseAdmin;
  /** Test seam: registry wiring. */
  cache?: CacheLike;
  registryOptions?: Partial<Omit<SessionRegistryOptions, 'lookup' | 'cache'>>;
}

/** Every method throws: used when no service-role key is configured. */
function unavailableSupabase(): SupabaseAdmin {
  const fail = (): never => {
    throw new SupabaseError('supabase_unavailable', 'Supabase admin is not configured', 503);
  };
  return {
    createUser: fail,
    signInWithPassword: fail,
    refresh: fail,
    signOut: fail,
    updatePassword: fail,
    deleteSession: fail,
    confirmEmail: fail,
    issueSession: fail,
    deleteUser: fail,
    buildAuthorizeUrl: fail,
    exchangeCodeForSession: fail,
    mfa: { enrollTotp: fail, challengeAndVerify: fail, unenroll: fail, listFactors: fail },
  };
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  const hasSecrets = app.hasDecorator('secrets');
  const secret =
    options.secret ?? (hasSecrets ? await app.secrets.get('SUPABASE_JWT_SECRET') : undefined);
  const issuer = tokenIssuer(app.env.SUPABASE_URL);

  if (secret === undefined) {
    app.log.warn('SUPABASE_JWT_SECRET is unavailable: every authenticated request will 401');
  }

  const registry =
    options.registry ??
    (hasSecrets
      ? new SessionRegistry({
          lookup: createDbSessionLookup(app.db),
          cache: app.redis as unknown as CacheLike,
          touch: async (sessionId, at) => {
            const client = (
              app.db as { $client?: { unsafe: (q: string, p?: unknown[]) => unknown } }
            ).$client;
            if (client === undefined) return;
            await client.unsafe('update user_sessions set last_seen_at = $2 where id = $1::uuid', [
              sessionId,
              at,
            ]);
          },
          ...options.registryOptions,
        })
      : undefined);

  const supabase =
    options.supabase ??
    (hasSecrets
      ? createSupabaseAdmin({
          url: app.env.SUPABASE_URL,
          serviceRoleKey: await app.secrets.get('SUPABASE_SERVICE_ROLE_KEY'),
        })
      : unavailableSupabase());

  app.decorate('supabase', supabase);

  /** Read, verify and cross-check the session. Throws 401 on any problem. */
  async function resolveUser(request: FastifyRequest): Promise<AuthUser> {
    const token = request.cookies[COOKIE_NAMES.accessToken];
    if (token === undefined || token === '' || secret === undefined) {
      throw HttpError.unauthorized();
    }

    const { payload } = await verifyAccessToken(token, { secret, issuer });
    const record = await registry?.get(payload.session_id);

    // Fail closed: no session row means nothing can vouch for this token.
    if (record === undefined || record === null) throw HttpError.unauthorized();
    if (record.revokedAt !== null) throw HttpError.unauthorized();
    if (record.accountStatus !== 'active') throw HttpError.unauthorized();
    if (record.deletedAt !== null) throw HttpError.unauthorized();
    if (record.userId !== payload.sub) throw HttpError.unauthorized();

    // In-house WebAuthn and email-OTP verifications cannot raise Supabase's own
    // AAL, so they are recorded on the session row and honoured here.
    const aal = payload.aal === 'aal2' || record.mfaMethod !== null ? 'aal2' : 'aal1';

    registry?.noteActivity(payload.session_id);

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.org_id,
      permissions: payload.permissions,
      aal,
      sessionId: payload.session_id,
    };
  }

  const authenticate: preHandlerHookHandler = async (request) => {
    request.user = await resolveUser(request);
  };

  const optionalAuth: preHandlerHookHandler = async (request) => {
    try {
      request.user = await resolveUser(request);
    } catch {
      // A public route with an optional identity: an absent or stale cookie is fine.
      request.user = undefined;
    }
  };

  const requirePermission =
    (...permissions: Permission[]): preHandlerHookHandler =>
    async (request) => {
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      const granted = new Set(user.permissions);
      for (const permission of permissions) {
        if (!granted.has(permission)) throw HttpError.forbidden();
      }
    };

  const requireAnyPermission =
    (...permissions: Permission[]): preHandlerHookHandler =>
    async (request) => {
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      const granted = new Set(user.permissions);
      if (!permissions.some((permission) => granted.has(permission))) {
        throw HttpError.forbidden();
      }
    };

  const requireRole =
    (...roles: UserRole[]): preHandlerHookHandler =>
    async (request) => {
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      if (!roles.includes(user.role)) throw HttpError.forbidden();
    };

  const requireStaff: preHandlerHookHandler = async (request) => {
    const user = request.user;
    if (user === undefined) throw HttpError.unauthorized();
    if (!isStaff(user.role)) throw HttpError.forbidden();
    // Staff act on other people's data: a second factor is not optional.
    if (user.aal !== 'aal2') {
      throw HttpError.forbidden('mfa_required', 'Complete MFA to continue');
    }
  };

  app.decorate('authenticate', authenticate);
  app.decorate('optionalAuth', optionalAuth);
  app.decorate('requirePermission', requirePermission);
  app.decorate('requireAnyPermission', requireAnyPermission);
  app.decorate('requireRole', requireRole);
  app.decorate('requireStaff', requireStaff);
};

export default fp(authPlugin, { name: 'auth', dependencies: ['cookies'] });

export { STAFF_ROLES };
