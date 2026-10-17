import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  ForgotPasswordBody,
  LoginBody,
  LoginResponse,
  MfaVerifyBody,
  RecoveryCodeBody,
  ResetPasswordBody,
  SessionUser,
  SignupBody,
  SignupResendBody,
  SignupStartResponse,
  SignupVerifyBody,
} from '@vunvault/contracts';
import { z } from 'zod';
import { actorLabelFor, AUDITED, audited, auditFailure } from '../../../audit/audited';
import type { SqlExecutor } from '../../../audit/repo';
import { asExecutor } from '../../../audit/repo';
import type { Tx } from '../../../plugins/db';
import { HttpError } from '../../../lib/http-error';
import { HibpBreachCheck, type BreachCheck } from '../../../lib/breach';
import {
  clearSessionCookies,
  readSessionCookies,
  setSessionCookies,
} from '../../../lib/session-cookies';
// CHANGED: value import of SupabaseError, plus the type-only SupabaseAdmin.
import { SupabaseError, type SupabaseAdmin } from '../../../lib/supabase-admin';
import { COOKIE_NAMES } from '../../../plugins/cookies';
import {
  deriveChallengeKey,
  EmailOtpStore,
  memoryKvStore,
  MfaChallengeStore,
  type KvStore,
} from './challenge';
import { SignupOtpStore } from './email-otp';
import { PasswordResetStore } from './password-reset';
import oauthRoutes from './oauth';
import type { OnboardingRepo } from './oauth-service';
import { createMfaVerifierRegistry, type MfaVerifierRegistry } from './mfa-registry';
import { AccountSecurityService } from '../account-security/service';
import { SqlAccountSecurityRepo } from '../account-security/repo';
import { SimpleWebauthnService } from '../account-security/webauthn';
import { SqlAuthRepo, type AuthRepo } from './repo';
import { AuthService, type RequestMeta } from './service';

/**
 * Session lifecycle routes.
 *
 * Public: signup (verified flow, Task 40d), signup verify/resend, login, MFA
 * verify, MFA email-otp send, forgot/reset password, refresh.
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

  const challengeKey = deriveChallengeKey(
    app.hasDecorator('secrets')
      ? await app.secrets.get('SUPABASE_SERVICE_ROLE_KEY').catch(() => 'development-only-key')
      : 'development-only-key',
  );
  const challenges = new MfaChallengeStore({ store: kv, key: challengeKey });
  const otp = new EmailOtpStore(kv);
  const signupOtp = new SignupOtpStore(kv);
  const resets = new PasswordResetStore(kv);
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
      resets,
      verifiers,
      breach,
      email: app.email,
      notify: app.hasDecorator('queues')
        ? async (input) => {
            await app.queues.notify.add(input.template, { channel: 'email', ...input });
          }
        : undefined,
      webOrigin: app.env.WEB_ORIGIN,
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

  // ------------------------------------------------------- forgot-password
  /**
   * Always `202 {}` with an identical body and similar timing for known and
   * unknown addresses. Nothing is audited at request time (only a `debug` log
   * lives in the service path); the audit entry is written on the reset itself.
   */
  const forgotHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ForgotPasswordBody.parse(request.body);
    await pooled().forgotPassword(body.email);
    return reply.status(202).send({});
  };
  (forgotHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/forgot-password', {
    config: { rateLimitPolicy: 'public_form' },
    schema: { body: ForgotPasswordBody, response: { 202: z.object({}) } },
    handler: forgotHandler,
  });

  // -------------------------------------------------------- reset-password
  /**
   * Consumes the single-use token, rotates the credential and revokes every
   * session, all in one transaction with its `PASSWORD_CHANGED` entry. MFA is
   * NOT bypassed: the next login still challenges.
   */
  const resetHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ResetPasswordBody.parse(request.body);
    const meta = requestMeta(request);

    await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const result = await serviceFor(executor).resetPassword(body);
      await app.audit.append(executor, {
        eventType: 'PASSWORD_CHANGED',
        actor: { id: result.userId, label: actorLabelFor(result.email) },
        subject: result.email,
        message: `Password reset for ${result.email} · ${result.revokedSessions} sessions revoked`,
        // Never the passwords, never the token: only the fact and the fallout.
        details: { via: 'reset', revokedSessions: result.revokedSessions },
        ip: meta.ip,
      });
    });

    return reply.status(204).send();
  };
  (resetHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/reset-password', {
    config: { rateLimitPolicy: 'login' },
    schema: { body: ResetPasswordBody, response: { 204: z.null() } },
    handler: resetHandler,
  });

  // ----------------------------------------------------------------- login
  const loginHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = LoginBody.parse(request.body);
    const meta = requestMeta(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const txService = serviceFor(executor);
      let outcome;
      try {
        outcome = await txService.login(body, meta);
      } catch (error) {
        if (error instanceof HttpError && error.status === 429) {
          reply.header('retry-after', String(900));
          await auditFailure(
            app,
            {
              eventType: 'AUTH_RATE_LIMIT',
              subject: body.email,
              message: error.message,
            },
            request,
          );
        } else if (error instanceof HttpError && error.status === 401) {
          await auditFailure(
            app,
            {
              eventType: 'AUTH_FAILURE',
              subject: body.email,
              message: `Login attempt against ${body.email} was refused`,
              details: { reason: 'invalid_credentials' },
            },
            request,
          );
        }
        throw error;
      }

      if (outcome.kind === 'challenge') return outcome;

      // A session was issued: record it in the same transaction.
      await app.audit.append(executor, {
        eventType: 'AUTH_SUCCESS',
        actor: { id: outcome.session.user.id, label: outcome.session.user.email },
        subject: outcome.session.user.email,
        message: `${outcome.session.user.email} signed in from ${meta.ip}`,
        ip: meta.ip,
      });
      return outcome;
    });

    if (result.kind === 'challenge') {
      reply.setCookie(COOKIE_NAMES.mfaChallenge, result.handle, {
        ...app.cookieOptions(COOKIE_NAMES.mfaChallenge),
      });
      return LoginResponse.parse({
        data: { user: null, mfaRequired: true, mfaMethods: result.mfaMethods },
      });
    }

    setSessionCookies(reply, result.session.tokens, {
      remember: body.remember ?? false,
      ...cookieContext(request, reply),
    });
    return LoginResponse.parse({
      data: { user: result.session.user, mfaRequired: false, mfaMethods: [] },
    });
  };
  // Login audits conditionally (a challenge is not a successful authentication),
  // inside the same transaction as the session write.
  (loginHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/auth/login', {
    config: { rateLimitPolicy: 'login' },
    schema: { body: LoginBody, response: { 200: LoginResponse } },
    handler: loginHandler,
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
