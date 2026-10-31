import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CookieSerializeOptions } from '../../../plugins/cookies.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { setSessionCookies } from '../../../lib/session-cookies.js';
import type { SupabaseAdmin } from '../../../lib/supabase-admin.js';
import { COOKIE_NAMES } from '../../../plugins/cookies.js';
import { deriveChallengeKey, memoryKvStore, MfaChallengeStore, type KvStore } from './challenge.js';
import { SqlAuthRepo, type AuthRepo } from './repo.js';
import {
  OAuthStateStore,
  OAUTH_COOKIE_NAME,
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_TTL_SECONDS,
  SqlOnboardingRepo,
  OAuthService,
  type OnboardingRepo,
} from './oauth-service.js';

/**
 * OAuth sign-in routes (Task 40e): `start` redirects the browser to Supabase's
 * authorize URL with a PKCE challenge and parks the verifier in Redis under a
 * `state` that is also set as the HttpOnly `vv_oauth` cookie; `callback`
 * consumes that state atomically and finishes the sign-in.
 *
 * Both are GETs, both are public, and neither ever puts a token in a URL, a body
 * or a redirect target: the session rides in the standard HttpOnly cookies and
 * every refusal is a plain `/login?error=…` redirect.
 *
 * The providers themselves (Google, GitHub, Microsoft/azure) are enabled in the
 * Supabase dashboard — an operator step; nothing here holds a client secret.
 */

export interface OAuthRoutesOptions {
  /** Test seams. */
  repo?: AuthRepo;
  onboarding?: OnboardingRepo;
  supabase?: SupabaseAdmin;
  kv?: KvStore;
  challenges?: MfaChallengeStore;
}

const ProviderParams = z.object({ provider: z.string().min(1).max(40) });
const StartQuery = z.object({ next: z.string().max(300).optional() });
const CallbackQuery = z.object({
  code: z.string().max(4096).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(100).optional(),
  error_description: z.string().max(500).optional(),
});

function oauthCookieOptions(request: FastifyRequest): CookieSerializeOptions {
  const env = request.server.env;
  return {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_STATE_TTL_SECONDS,
    ...(env.COOKIE_DOMAIN === '' ? {} : { domain: env.COOKIE_DOMAIN }),
  };
}

function clearOauthCookieOptions(request: FastifyRequest): CookieSerializeOptions {
  const env = request.server.env;
  return {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    ...(env.COOKIE_DOMAIN === '' ? {} : { domain: env.COOKIE_DOMAIN }),
  };
}

const oauthRoutes: FastifyPluginAsync<OAuthRoutesOptions> = async (app, options) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const kv =
    options.kv ?? (app.redis === undefined ? memoryKvStore() : (app.redis as never as KvStore));
  const supabase = options.supabase ?? app.supabase;
  const states = new OAuthStateStore(kv);
  const challenges =
    options.challenges ??
    new MfaChallengeStore({
      store: kv,
      key: deriveChallengeKey(
        app.hasDecorator('secrets')
          ? await app.secrets.get('SUPABASE_SERVICE_ROLE_KEY').catch(() => 'development-only-key')
          : 'development-only-key',
      ),
    });

  /** A service bound to one executor: the pool, or the callback's transaction. */
  function serviceFor(executor?: SqlExecutor): OAuthService {
    return new OAuthService({
      repo: options.repo ?? new SqlAuthRepo(executor ?? app.db),
      onboarding: options.onboarding ?? new SqlOnboardingRepo(executor ?? app.db),
      supabase,
      states,
      challenges,
      audit: app.audit,
      webOrigin: app.env.WEB_ORIGIN,
      log: app.log,
    });
  }

  // ------------------------------------------------------------------ start
  typed.get(
    '/auth/oauth/:provider/start',
    {
      config: { rateLimitPolicy: 'public_form' },
      schema: { params: ProviderParams, querystring: StartQuery },
    },
    async (request, reply) => {
      const { provider } = ProviderParams.parse(request.params);
      const { next } = StartQuery.parse(request.query);
      const redirectTo = `${app.env.API_PUBLIC_URL}/api/v1/auth/oauth/callback`;

      const started = await serviceFor().start(provider, next, redirectTo);

      reply.setCookie(OAUTH_COOKIE_NAME, started.state, oauthCookieOptions(request));
      return reply.redirect(started.location);
    },
  );

  // --------------------------------------------------------------- callback
  typed.get(
    '/auth/oauth/callback',
    { schema: { querystring: CallbackQuery } },
    async (request, reply) => {
      const query = CallbackQuery.parse(request.query);
      const userAgent = request.headers['user-agent'];

      const result = await app.withTx((tx: Tx) => {
        const executor = asExecutor(tx);
        return serviceFor(executor).callback(
          {
            code: query.code,
            state: query.state,
            error: query.error,
            cookieState: request.cookies[OAUTH_COOKIE_NAME],
            ip: request.clientIp === '' ? request.ip : request.clientIp,
            userAgent: typeof userAgent === 'string' ? userAgent : null,
            headers: request.headers as never,
          },
          executor,
        );
      });

      // Always: the state cookie has served its purpose, win or lose.
      reply.clearCookie(OAUTH_COOKIE_NAME, clearOauthCookieOptions(request));

      if (result.kind === 'mfa') {
        // The same challenge handle login would have issued: `/auth/mfa/verify`
        // completes the sign-in and replaces the cookies with an aal2 session.
        reply.setCookie(COOKIE_NAMES.mfaChallenge, result.handle, {
          ...app.cookieOptions(COOKIE_NAMES.mfaChallenge),
        });
      } else if (result.kind === 'session') {
        setSessionCookies(reply, result.tokens, {
          remember: false,
          secure: app.env.NODE_ENV !== 'development',
          domain: app.env.COOKIE_DOMAIN || undefined,
        });
      }

      return reply.redirect(result.location);
    },
  );
};

export default fp(oauthRoutes, { name: 'oauth-routes' });
