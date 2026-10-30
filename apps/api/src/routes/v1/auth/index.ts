import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  MAGIC_LINK_ACK_MESSAGE,
  MagicLinkRequestBody,
  MagicLinkRequestResponse,
  MagicLinkVerifyQuery,
  MfaSetupAbandonResponse,
  MfaSetupOptionsResponse,
  MfaSetupVerifyBody,
  MfaVerifyBody,
  RecoveryCodeBody,
  SessionUser,
  SignupBody,
  SignupResendBody,
  SignupStartResponse,
  SignupVerifyBody,
} from '@vunvault/contracts';
import { z } from 'zod';
import { AUDITED, audited, auditFailure } from '../../../audit/audited.js';
import type { SqlExecutor } from '../../../audit/repo.js';
import { asExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { HibpBreachCheck, type BreachCheck } from '../../../lib/breach.js';
import {
  clearSessionCookies,
  readSessionCookies,
  setSessionCookies,
} from '../../../lib/session-cookies.js';
// CHANGED: value import of SupabaseError, plus the type-only SupabaseAdmin.
import { SupabaseError, type SupabaseAdmin } from '../../../lib/supabase-admin.js';
import { COOKIE_NAMES } from '../../../plugins/cookies.js';
import {
  deriveChallengeKey,
  EmailOtpStore,
  memoryKvStore,
  MfaChallengeStore,
  MfaSetupStore,
  type KvStore,
} from './challenge.js';
import { SignupOtpStore } from './email-otp.js';
import { deriveMagicLinkSecret, MagicLinkTokenStore, SignupInviteCooldown } from './magic-link.js';
import { LoginAbuseGuard } from './login-abuse.js';
import {
  HttpTurnstileVerifier,
  turnstileEnforced,
  type TurnstileVerifier,
} from '../public/turnstile.js';
import oauthRoutes from './oauth.js';
import type { OnboardingRepo } from './oauth-service.js';
import { createMfaVerifierRegistry, type MfaVerifierRegistry } from './mfa-registry.js';
import { AccountSecurityService } from '../account-security/service.js';
import { SqlAccountSecurityRepo } from '../account-security/repo.js';
import { SimpleWebauthnService } from '../account-security/webauthn.js';
import { SqlAuthRepo, type AuthRepo } from './repo.js';
import {
  AuthService,
  primaryWebOrigin,
  sanitizeNextPath,
  type MagicLinkRequestOutcome,
  type RequestMeta,
} from './service.js';

/**
 * Session lifecycle routes.
 *
 * Public: signup (verified flow, Task 40d), signup verify/resend, magic-link
 * login (Phase 1), MFA verify, MFA email-otp send, refresh. There is NO
 * password-login route — and, since Phase 5, no forgot/reset-password route
 * either: the mailbox is the credential and the stored password is vestigial.
 * Authenticated: logout, session.
 *
 * No route returns a token in its body — tokens exist only inside HttpOnly cookies.
 */

export interface AuthRoutesOptions {
  /** Test seams: in-memory fakes instead of the live database, Redis and network. */
  service?: AuthService;
  repo?: AuthRepo;
  breach?: BreachCheck;
  kv?: KvStore;
  supabase?: SupabaseAdmin;
  verifiers?: MfaVerifierRegistry;
  onboarding?: OnboardingRepo;
  /** Phase 4 test seams: the captcha verifier and its enforcement switch. */
  turnstile?: TurnstileVerifier;
  turnstileEnforced?: boolean;
}

function requestMeta(request: FastifyRequest): RequestMeta {
  const userAgent = request.headers['user-agent'];
  return {
    ip: request.clientIp === '' ? request.ip : request.clientIp,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
    headers: request.headers as never,
  };
}

function cookieContext(request: FastifyRequest, reply: FastifyReply) {
  const env = request.server.env;
  void reply;
  return { secure: env.NODE_ENV !== 'development', domain: env.COOKIE_DOMAIN || undefined };
}

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const kv =
    options.kv ?? (app.redis === undefined ? memoryKvStore() : (app.redis as never as KvStore));
  const supabase = options.supabase ?? app.supabase;

  /** Built lazily so the plugin can register before any infrastructure exists. */
  function repoFor(executor?: SqlExecutor): AuthRepo {
    return options.repo ?? new SqlAuthRepo(executor ?? app.db);
  }

  const secretMaterial = app.hasDecorator('secrets')
    ? await app.secrets.get('SUPABASE_SERVICE_ROLE_KEY').catch(() => 'development-only-key')
    : 'development-only-key';
  const challengeKey = deriveChallengeKey(secretMaterial);
  const challenges = new MfaChallengeStore({ store: kv, key: challengeKey });
  const otp = new EmailOtpStore(kv);
  // Phase 2: the forced-setup ledger (timed administrator windows only).
  const setups = new MfaSetupStore(kv);
  const signupOtp = new SignupOtpStore(kv);
  // Phase 1: single-use HMAC magic-link tokens + the Phase 3 invitation cooldown.
  const magicLinks = new MagicLinkTokenStore(kv, deriveMagicLinkSecret(secretMaterial));
  const invites = new SignupInviteCooldown(kv);
  // Phase 4: login-surface abuse controls — the per-address issuance window
  // and the per-IP soft limit that demands a Turnstile token.
  const abuse = new LoginAbuseGuard(kv);
  // Phase 4: same switch and secret as the public contact form; when
  // enforcement is off the captcha leg is inert (dev/test posture).
  const captchaEnforced = options.turnstileEnforced ?? turnstileEnforced();
  const turnstile =
    options.turnstile ??
    new HttpTurnstileVerifier({
      enforced: captchaEnforced,
      secretKey: app.hasDecorator('secrets')
        ? await app.secrets.get('TURNSTILE_SECRET_KEY').catch(() => undefined)
        : undefined,
      log: app.log,
    });
  const breach =
    options.breach ?? new HibpBreachCheck({ warn: (m, e) => app.log.warn({ err: e }, m) });

  /**
   * Task 27's capabilities, built lazily: registering the group must not require a
   * live database. Without them the webauthn/recovery verifiers stay 501 stubs.
   */
  let security: AccountSecurityService | undefined;
  function securityService(): AccountSecurityService | undefined {
    if (!app.hasDecorator('db')) return undefined;
    security ??= new AccountSecurityService({
      repo: new SqlAccountSecurityRepo(app.db),
      supabase,
      webauthn: new SimpleWebauthnService({
        rpID: app.env.WEBAUTHN_RP_ID,
        rpName: app.env.WEBAUTHN_RP_NAME,
        origin: app.env.WEB_ORIGIN,
      }),
      breach,
      kv,
      email: app.email,
      queues: app.queues,
    });
    return security;
  }

  const securityDeps = securityService();
  const verifiers =
    options.verifiers ??
    createMfaVerifierRegistry({
      supabase,
      challenges,
      otp,
      webauthn:
        securityDeps === undefined
          ? undefined
          : {
              verify: (handle, response) => securityDeps.verifyWebauthnAssertion(handle, response),
            },
      recovery:
        securityDeps === undefined
          ? undefined
          : {
              consume: (userId, code) => securityDeps.consumeRecoveryCode(userId, code),
              unenrollTotp: async (accessToken, userId) => {
                const factors = await supabase.mfa.listFactors(userId);
                for (const factor of factors.filter((f) => f.type === 'totp')) {
                  await supabase.mfa.unenroll(accessToken, factor.id).catch(() => undefined);
                }
              },
            },
    });

  app.decorate('mfaVerifiers', verifiers);

  /** A service bound to one executor: the pool, or the route's transaction. */
  function serviceFor(executor?: SqlExecutor): AuthService {
    if (options.service !== undefined) return options.service;
    return new AuthService({
      repo: repoFor(executor),
      supabase,
      challenges,
      otp,
      signupOtp,
      magicLinks,
      invites,
      abuse,
      turnstile,
      turnstileEnforced: captchaEnforced,
      setups,
      verifiers,
      breach,
      email: app.email,
      webOrigin: app.env.WEB_ORIGIN,
      apiPublicUrl: app.env.API_PUBLIC_URL,
      nodeEnv: app.env.NODE_ENV,
      now: () => new Date(),
      log: app.log,
    });
  }

  /**
   * Built on first use: registering the group must not require a live database,
   * so nothing here touches `app.db` until a request actually needs it.
   */
  let pooledService: AuthService | undefined;
  function pooled(): AuthService {
    if (options.service !== undefined) return options.service;
    pooledService ??= serviceFor();
    return pooledService;
  }

  // ---------------------------------------------------------------- signup
  /**
   * Step 1 of the verified flow (Task 40d): `202` and an emailed OTP, no cookies.
   * The session opens at `/auth/signup/verify-email`; the authenticator enrolment
   * (Task 27) completes step 3 in the web app.
   *
   * CHANGED: a Supabase `email_taken` failure is converted to HTTP 409 here, so
   * the route does not surface as a bare 500. Anything else re-throws unchanged.
   */
  app.post(
    '/auth/signup',
    {
      config: { rateLimitPolicy: 'public_form' },
      schema: { body: SignupBody, response: { 202: SignupStartResponse } },
    },
    audited<FastifyRequest, { data: { email: string } }>(
      {
        eventType: 'ACCOUNT_REGISTERED',
        subject: (req) => (req.body as { email?: string }).email,
        message: (_req, res) => `Signup started for ${res.data.email}`,
        details: () => ({ stage: 'started' }),
        actor: () => ({ id: null, label: 'external' }),
      },
      async (request, reply, ctx) => {
        const body = SignupBody.parse(request.body);

        let email: string;
        try {
          ({ email } = await serviceFor(asExecutor(ctx.tx)).signup(body));
        } catch (error) {
          if (error instanceof SupabaseError && error.code === 'email_taken') {
            throw new HttpError(
              409,
              'email_taken',
              'A user with this email address has already been registered',
            );
          }
          throw error;
        }

        reply.status(202);
        return SignupStartResponse.parse({
          data: {
            email,
            verificationRequired: true,
            resendAfterSeconds: 30,
            expiresInSeconds: 600,
          },
        });
      },
    ),
  );

  // ------------------------------------------------- signup / verify-email
  /**
   * Step 2: the mailbox OTP. Audited by hand inside the transaction — the actor
   * is the activated account, which only exists once the service has run.
   */
  const verifyEmailHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = SignupVerifyBody.parse(request.body);
    const meta = requestMeta(request);

    const issued = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const session = await serviceFor(executor).verifySignupEmail(body, meta);
      await app.audit.append(executor, {
        eventType: 'ACCOUNT_REGISTERED',
        actor: { id: session.user.id, label: session.user.email },
        subject: session.user.email,
        message: `${session.user.email} verified their mailbox and activated the account`,
        details: { stage: 'email_verified' },
        ip: meta.ip,
      });
      return session;
    });

    setSessionCookies(reply, issued.tokens, {
      remember: false,
      ...cookieContext(request, reply),
    });
    return { data: issued.user };
  };
  (verifyEmailHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/signup/verify-email', {
    config: { rateLimitPolicy: 'login' },
    schema: {
      body: SignupVerifyBody,
      response: { 200: z.object({ data: SessionUser }) },
    },
    handler: verifyEmailHandler,
  });

  // ------------------------------------------------------- signup / resend
  /**
   * Always `202 {}`: whether the address has a pending signup, and whether the
   * 30-second cooldown allowed a send, are not public information. The send
   * itself is not audited — the verification is (see AUDIT_EXEMPT).
   */
  const resendHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = SignupResendBody.parse(request.body);
    await pooled().resendSignupCode(body.email);
    return reply.status(202).send({});
  };
  (resendHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/signup/resend', {
    config: { rateLimitPolicy: 'public_form' },
    schema: { body: SignupResendBody, response: { 202: z.object({}) } },
    handler: resendHandler,
  });

  // ------------------------------------------------------- magic-link login
  /**
   * Phase 1, step 1: the ONLY login entry point. Body is `{ email; next? }` —
   * a password field is rejected outright (the schema is `.strict()`). The
   * acknowledgement is ONE literal for registered and unregistered addresses
   * alike; which email actually went out (a sign-in link vs. a signup
   * invitation) lives in the mailbox, never in this response, so the endpoint
   * cannot be used to enumerate accounts. The rate limit is `public_form`
   * (5 / 10 min / IP) and the invitation leg has its own per-address cooldown,
   * so it cannot be weaponised as an email bomb either.
   */
  const magicLinkHandler = async (request: FastifyRequest) => {
    const body = MagicLinkRequestBody.parse(request.body);
    const meta = requestMeta(request);

    let outcome: MagicLinkRequestOutcome;
    try {
      outcome = await app.withTx(async (tx: Tx) => {
        const executor = asExecutor(tx);
        const sent = await serviceFor(executor).requestMagicLink(
          {
            email: body.email,
            next: sanitizeNextPath(body.next),
            website: body.website,
            formTs: body.formTs,
            captchaToken: body.captchaToken,
          },
          meta,
        );
        // Record WHICH email went out. Never the token (work order §7): the chain
        // is a fact log, not a credential store. A suppressed invite is not a fact
        // about a person and is left unrecorded (like the resend posture).
        if (sent.sent === 'link') {
          await app.audit.append(executor, {
            eventType: 'MAGIC_LINK_ISSUED',
            actor: { id: null, label: 'external' },
            subject: sent.email,
            message: `Magic-link sign-in requested for ${sent.email}`,
            details: { channel: 'email' },
            ip: meta.ip,
          });
        } else if (sent.sent === 'invite') {
          await app.audit.append(executor, {
            eventType: 'SIGNUP_INVITE_SENT',
            actor: { id: null, label: 'external' },
            subject: sent.email,
            message: `Sign-in requested for unregistered ${sent.email} · signup invitation sent`,
            details: { channel: 'email' },
            ip: meta.ip,
          });
        } else if (sent.sent === 'bot_dropped') {
          // Phase 4: the honeypot/timing drop IS a security fact — record which
          // signal fired (never any token; there is none).
          await app.audit.append(executor, {
            eventType: 'AUTH_BOT_REJECTED',
            actor: { id: null, label: 'external' },
            subject: sent.email,
            message: `Magic-link request dropped · bot signal: ${sent.reason}`,
            details: { reason: sent.reason },
            ip: meta.ip,
          });
        } else if (sent.sent === 'window_suppressed') {
          await app.audit.append(executor, {
            eventType: 'AUTH_RATE_LIMIT',
            actor: { id: null, label: 'external' },
            subject: sent.email,
            message: `Magic-link issuance suppressed for ${sent.email} · per-address window`,
            details: {
              scope: 'magic_link_email_window',
              retryAfterSeconds: sent.retryAfterSeconds,
            },
            ip: meta.ip,
          });
        }
        return sent;
      });
    } catch (error) {
      if (error instanceof HttpError && error.code === 'captcha_failed') {
        // Fail-closed captcha refusal: audited as a bot rejection, answered
        // with the verifier's single generic 400.
        await auditFailure(
          app,
          {
            eventType: 'AUTH_BOT_REJECTED',
            subject: meta.ip,
            message: 'Magic-link captcha verification failed',
            details: { scope: 'magic_link_captcha' },
          },
          request,
          error,
        );
      }
      throw error;
    }

    // Byte-identical for every ADDRESS: a single literal message. The only
    // variation is the IP-keyed captcha flag (Phase 4) — registration status
    // still cannot be read from the response.
    if (outcome.sent === 'captcha_required') {
      return MagicLinkRequestResponse.parse({
        message: MAGIC_LINK_ACK_MESSAGE,
        captchaRequired: true,
      });
    }
    return MagicLinkRequestResponse.parse({ message: MAGIC_LINK_ACK_MESSAGE });
  };
  (magicLinkHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/magic-link', {
    config: { rateLimitPolicy: 'public_form' },
    schema: { body: MagicLinkRequestBody, response: { 200: MagicLinkRequestResponse } },
    handler: magicLinkHandler,
  });

  // -------------------------------------------------- magic-link / verify
  /**
   * Phase 1, step 2: the emailed link lands here. The token is consumed
   * atomically — signature first, then TTL, single-use and the email binding —
   * so a replay, a forgery and an expiry all end the same way: a redirect to
   * the web login screen with an error code and NO cookie set. On success the
   * aal1 session is minted server-side and stored encrypted inside the pre-MFA
   * challenge; the browser gets only the `vv_mfa` handle. `vv_at`/`vv_rt` are
   * NOT set — no protected route is reachable until `POST /auth/mfa/verify`
   * accepts the six-digit code and rotates the cookies.
   *
   * This is a bare 302 (NO_JSON_RESPONSE in the manifest): the pre-MFA state
   * travels in the HttpOnly cookie, never in a URL or a JSON body.
   */
  const magicLinkVerifyHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = MagicLinkVerifyQuery.parse(request.query);
    const meta = requestMeta(request);
    const next = sanitizeNextPath(query.next);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const outcome = await serviceFor(executor).verifyMagicLink(query.token, next, meta);
      if (outcome.kind === 'challenge') {
        await app.audit.append(executor, {
          eventType: 'MAGIC_LINK_VERIFIED',
          actor: { id: outcome.userId, label: outcome.email },
          subject: outcome.email,
          message: `${outcome.email} passed the magic link · MFA challenge opened`,
          details: {
            methods: outcome.methods,
            setup: outcome.redirectTo.includes('/login/mfa/setup'),
          },
          ip: meta.ip,
        });
      } else if (outcome.kind === 'session') {
        // Phase 2: the EXEMPT super admin signs straight in (MFA optional).
        await app.audit.append(executor, {
          eventType: 'AUTH_SUCCESS',
          actor: { id: outcome.userId, label: outcome.email },
          subject: outcome.email,
          message: `${outcome.email} signed in via magic link · MFA-exempt super admin`,
          details: { exempt: true },
          ip: meta.ip,
        });
      } else if (outcome.kind === 'setup_blocked') {
        await app.audit.append(executor, {
          eventType: 'MFA_SETUP_BLOCKED',
          actor: { id: outcome.userId, label: outcome.email },
          subject: outcome.email,
          message: `${outcome.email} missed the MFA setup window (${outcome.reason}) · account blocked`,
          details: { reason: outcome.reason },
          ip: meta.ip,
        });
      } else {
        await auditFailure(
          app,
          {
            eventType: 'AUTH_FAILURE',
            subject: outcome.email ?? meta.ip,
            message: `Magic-link verification refused (${outcome.code})`,
            details: { reason: outcome.code },
          },
          request,
        );
      }
      return outcome;
    });

    const origin = primaryWebOrigin(app.env.WEB_ORIGIN);
    if (result.kind === 'error') {
      return reply.redirect(`${origin}/login?error=${result.code}`);
    }
    if (result.kind === 'setup_blocked') {
      // The block itself is the answer; the login screen toasts the reason.
      return reply.redirect(`${origin}/login?error=account_blocked`);
    }
    if (result.kind === 'session') {
      // Exempt super admin: full session cookies straight from the verify leg.
      setSessionCookies(reply, result.issued.tokens, {
        remember: false,
        ...cookieContext(request, reply),
      });
      return reply.redirect(result.redirectTo);
    }

    reply.setCookie(COOKIE_NAMES.mfaChallenge, result.handle, {
      ...app.cookieOptions(COOKIE_NAMES.mfaChallenge),
    });
    return reply.redirect(result.redirectTo);
  };
  (magicLinkVerifyHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.get('/auth/magic-link/verify', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: { querystring: MagicLinkVerifyQuery },
    handler: magicLinkVerifyHandler,
  });

  // ---------------------------------------------------------- mfa / verify
  // Audited inside the transaction rather than through `audited()`: the actor is
  // only known once the second factor has been verified.
  const verifyHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = MfaVerifyBody.parse(request.body);
    const handle = readSessionCookies(request).mfa;
    const method =
      body.method === 'webauthn' ? 'webauthn' : body.method === 'totp' ? 'totp' : 'email_otp';

    const issued = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      let session;
      try {
        session = await serviceFor(executor).verifyMfa(
          handle,
          method,
          body,
          requestMeta(request),
          request,
        );
      } catch (error) {
        if (error instanceof HttpError && error.code === 'mfa_failed') {
          await auditFailure(
            app,
            {
              eventType: 'AUTH_MFA_FAILURE',
              subject: requestMeta(request).ip,
              message: `MFA verification failed for ${body.method}`,
              details: { method: body.method },
            },
            request,
            error,
          );
        }
        throw error;
      }

      await app.audit.append(executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: session.user.id, label: session.user.email },
        subject: session.user.email,
        message: `${session.user.email} completed multi-factor authentication`,
        details: { mfa: method },
        ip: requestMeta(request).ip,
      });
      return session;
    });

    reply.clearCookie(COOKIE_NAMES.mfaChallenge, app.cookieOptions(COOKIE_NAMES.mfaChallenge));
    setSessionCookies(reply, issued.tokens, {
      remember: false,
      ...cookieContext(request, reply),
    });
    return { data: issued.user };
  };
  (verifyHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/mfa/verify', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: { body: MfaVerifyBody, response: { 200: z.object({ data: SessionUser }) } },
    handler: verifyHandler,
  });

  // ------------------------------------------------------- mfa / email-otp
  app.post(
    '/auth/mfa/email-otp',
    { schema: { response: { 202: z.object({}) } } },
    async (request, reply) => {
      const { mfa } = readSessionCookies(request);
      await pooled().sendEmailOtp(mfa);
      return reply.status(202).send({});
    },
  );

  // --------------------------------------------- mfa / webauthn options
  app.post('/auth/mfa/webauthn/options', async (request) => {
    const { mfa } = readSessionCookies(request);
    if (mfa === undefined || mfa === '') throw new HttpError(410, 'challenge_expired');
    const challenge = await challenges.read(mfa);
    if (challenge === null) throw new HttpError(410, 'challenge_expired');

    const securityServiceInstance = securityService();
    if (securityServiceInstance === undefined) {
      throw new HttpError(501, 'not_implemented', 'WebAuthn is not available');
    }
    // The challenge is stored under the vv_mfa handle: that is the handle the
    // verify request will carry back.
    const options_ = await securityServiceInstance.startWebauthnAuthenticationFor(
      challenge.userId,
      mfa,
    );
    return { data: options_ };
  });

  // ------------------------------------------------------- mfa / recovery
  // Audited inside the transaction: a recovery login writes TWO entries — the
  // successful authentication and the forced removal of the TOTP factor.
  const recoveryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = RecoveryCodeBody.parse(request.body);
    const handle = readSessionCookies(request).mfa;
    const meta = requestMeta(request);

    const issued = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      let session;
      try {
        session = await serviceFor(executor).verifyMfa(handle, 'recovery', body, meta, request);
      } catch (error) {
        if (error instanceof HttpError && error.code === 'mfa_failed') {
          await auditFailure(
            app,
            {
              eventType: 'AUTH_MFA_FAILURE',
              subject: meta.ip,
              message: 'Recovery code rejected',
            },
            request,
            error,
          );
        }
        throw error;
      }

      await app.audit.append(executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: session.user.id, label: session.user.email },
        subject: session.user.email,
        message: `${session.user.email} signed in with a recovery code`,
        details: { mfa: 'recovery' },
        ip: meta.ip,
      });
      // Supabase cannot raise AAL from a recovery code, so TOTP was dropped and
      // staff must re-enrol. That removal is itself an audited event.
      await app.audit.append(executor, {
        eventType: 'MFA_DISABLED',
        actor: { id: session.user.id, label: session.user.email },
        subject: session.user.email,
        message: `Authenticator app removed for ${session.user.email} after a recovery-code login`,
        details: { reason: 'recovery_code_used' },
        ip: meta.ip,
      });
      return session;
    });

    reply.clearCookie(COOKIE_NAMES.mfaChallenge, app.cookieOptions(COOKIE_NAMES.mfaChallenge));
    setSessionCookies(reply, issued.tokens, {
      remember: false,
      ...cookieContext(request, reply),
    });
    return { data: issued.user };
  };
  (recoveryHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/mfa/recovery', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: { body: RecoveryCodeBody, response: { 200: z.object({ data: SessionUser }) } },
    handler: recoveryHandler,
  });

  // ---------------------------------------------------- mfa / setup (Phase 2)
  /**
   * Forced first-sign-in MFA setup. All three legs are guarded by the same
   * HttpOnly `vv_mfa` challenge cookie as the verify siblings, and the
   * challenge MUST carry the setup marker (an ordinary verify challenge gets
   * 403 here). `options` starts a TOTP enrolment against the pre-MFA session;
   * `verify` accepts the first correct code, flips `mfa_enrolled` and opens
   * the FULL session (cookies rotate exactly like `/auth/mfa/verify`);
   * `abandon` ends the window — for an administrator inside a TIMED window
   * that means `blocked_mfa_setup` until a super admin unblocks the account.
   * A dead handle whose ledgered window has closed blocks lazily and answers
   * 410 `setup_expired`, which is what makes walking away detectable.
   */
  const setupOptionsHandler = async (request: FastifyRequest) => {
    const { mfa } = readSessionCookies(request);
    const meta = requestMeta(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const outcome = await serviceFor(executor).setupOptions(mfa);
      if (outcome.kind === 'blocked') {
        await app.audit.append(executor, {
          eventType: 'MFA_SETUP_BLOCKED',
          actor: { id: outcome.userId, label: outcome.email },
          subject: outcome.email,
          message: `${outcome.email} missed the MFA setup window (${outcome.reason}) · account blocked`,
          details: { reason: outcome.reason },
          ip: meta.ip,
        });
      }
      return outcome;
    });

    if (result.kind === 'blocked') {
      throw new HttpError(410, 'setup_expired', 'The MFA setup window has closed');
    }
    return {
      data: {
        factorId: result.factorId,
        qrCodeSvg: result.qrCodeSvg,
        secret: result.secret,
        uri: result.uri,
        deadlineEpochMs: result.deadlineEpochMs,
      },
    };
  };
  (setupOptionsHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/mfa/setup/options', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: { response: { 200: MfaSetupOptionsResponse } },
    handler: setupOptionsHandler,
  });

  const setupVerifyHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = MfaSetupVerifyBody.parse(request.body);
    const { mfa } = readSessionCookies(request);
    const meta = requestMeta(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      let outcome;
      try {
        outcome = await serviceFor(executor).setupVerify(mfa, body, meta);
      } catch (error) {
        if (error instanceof HttpError && error.code === 'mfa_failed') {
          await auditFailure(
            app,
            {
              eventType: 'AUTH_MFA_FAILURE',
              subject: meta.ip,
              message: 'MFA setup code rejected',
              details: { flow: 'first_signin_setup' },
            },
            request,
            error,
          );
        }
        throw error;
      }
      if (outcome.kind === 'blocked') {
        await app.audit.append(executor, {
          eventType: 'MFA_SETUP_BLOCKED',
          actor: { id: outcome.userId, label: outcome.email },
          subject: outcome.email,
          message: `${outcome.email} missed the MFA setup window (${outcome.reason}) · account blocked`,
          details: { reason: outcome.reason },
          ip: meta.ip,
        });
        return outcome;
      }
      const user = outcome.issued.user;
      await app.audit.append(executor, {
        eventType: 'MFA_ENABLED',
        actor: { id: user.id, label: user.email },
        subject: user.email,
        message: `Authenticator app enrolled for ${user.email} during first-sign-in setup`,
        details: { factor: 'totp', flow: 'first_signin_setup' },
        ip: meta.ip,
      });
      await app.audit.append(executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: user.id, label: user.email },
        subject: user.email,
        message: `${user.email} completed forced MFA setup and signed in`,
        details: { mfa: 'totp', flow: 'first_signin_setup' },
        ip: meta.ip,
      });
      return outcome;
    });

    if (result.kind === 'blocked') {
      throw new HttpError(410, 'setup_expired', 'The MFA setup window has closed');
    }
    reply.clearCookie(COOKIE_NAMES.mfaChallenge, app.cookieOptions(COOKIE_NAMES.mfaChallenge));
    setSessionCookies(reply, result.issued.tokens, {
      remember: false,
      ...cookieContext(request, reply),
    });
    return { data: result.issued.user };
  };
  (setupVerifyHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/mfa/setup/verify', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: { body: MfaSetupVerifyBody, response: { 200: z.object({ data: SessionUser }) } },
    handler: setupVerifyHandler,
  });

  const setupAbandonHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { mfa } = readSessionCookies(request);
    const meta = requestMeta(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const outcome = await serviceFor(executor).setupAbandon(mfa);
      if (outcome.blocked && outcome.email !== null && outcome.userId !== null) {
        await app.audit.append(executor, {
          eventType: 'MFA_SETUP_BLOCKED',
          actor: { id: outcome.userId, label: outcome.email },
          subject: outcome.email,
          message: `${outcome.email} abandoned the MFA setup window · account blocked`,
          details: { reason: 'abandoned' },
          ip: meta.ip,
        });
      }
      return outcome;
    });

    // Abandoning always ends the challenge; a client may simply start over.
    reply.clearCookie(COOKIE_NAMES.mfaChallenge, app.cookieOptions(COOKIE_NAMES.mfaChallenge));
    return { data: { blocked: result.blocked } };
  };
  (setupAbandonHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/mfa/setup/abandon', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: { response: { 200: MfaSetupAbandonResponse } },
    handler: setupAbandonHandler,
  });

  // ------------------------------------------------------------- refresh
  app.post('/auth/refresh', async (request, reply) => {
    const { rt } = readSessionCookies(request);
    const session = await pooled().refresh(rt);

    setSessionCookies(
      reply,
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
      cookieContext(request, reply),
    );

    if (session.sessionId !== '') {
      await repoFor().touchSession(session.sessionId, new Date());
    }
    return reply.status(204).send();
  });

  // -------------------------------------------------------------- logout
  app.post(
    '/auth/logout',
    { preHandler: [app.authenticate], schema: { response: { 204: z.null() } } },
    audited<FastifyRequest, void>(
      {
        eventType: 'AUTH_LOGOUT',
        message: (req) => `${req.user?.email ?? 'unknown'} signed out`,
        subject: (req) => req.user?.email,
      },
      async (request, reply, ctx) => {
        const { at } = readSessionCookies(request);
        const user = request.user;
        if (user === undefined) throw HttpError.unauthorized();

        await serviceFor(asExecutor(ctx.tx)).logout(at, user.sessionId);
        clearSessionCookies(reply, cookieContext(request, reply));
        return reply.status(204).send();
      },
    ),
  );

  // ------------------------------------------------------------- session
  app.get(
    '/auth/session',
    {
      preHandler: [app.authenticate],
      schema: { response: { 200: z.object({ data: SessionUser }) } },
    },
    async (request) => {
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      const profile = await repoFor().findProfileById(user.id);
      if (profile === null) throw HttpError.unauthorized();
      return { data: await pooled().session(profile) };
    },
  );

  // ---------------------------------------------------------------- oauth
  // Task 40e: Google / GitHub / Microsoft sign-in via Supabase PKCE. Shares
  // this group's infrastructure: the same kv, the same Supabase admin and the
  // same MFA challenge store, so an OAuth sign-in that meets an enrolled second
  // factor issues exactly the challenge a password login would.
  await app.register(oauthRoutes, {
    repo: options.repo,
    onboarding: options.onboarding,
    supabase,
    kv,
    challenges,
  });
};

export default fp(authRoutes, { name: 'auth-routes' });
