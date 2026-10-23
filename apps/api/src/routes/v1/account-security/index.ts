import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  RecoveryCodesResponse,
  SecurityResponse,
  TotpEnrollStart,
  TotpVerifyBody,
  WebauthnKey,
  WebauthnRegisterVerifyBody,
  ChangePasswordBody,
} from '@vunvault/contracts';
import { z } from 'zod';
import { audited, auditFailure } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import { NO_BREACH_CHECK, type BreachCheck } from '../../../lib/breach';
import { readSessionCookies } from '../../../lib/session-cookies';
import type { SupabaseAdmin } from '../../../lib/supabase-admin';
import { COOKIE_NAMES } from '../../../plugins/cookies';
import { memoryKvStore, type KvStore } from '../auth/challenge';
import { SqlAccountSecurityRepo, type AccountSecurityRepo } from './repo';
import { AccountSecurityService, type WebauthnKeyView } from './service';
import { SimpleWebauthnService, type WebauthnService } from './webauthn';

/**
 * Password Manager and Profile Settings security routes.
 *
 * Every route acts on `request.user.id` only — no route accepts a user id from the
 * client — and every route carries the `sensitive` rate policy.
 */

export interface AccountSecurityRoutesOptions {
  /** Test seams. */
  service?: AccountSecurityService;
  repo?: AccountSecurityRepo;
  webauthn?: WebauthnService;
  breach?: BreachCheck;
  kv?: KvStore;
  supabase?: SupabaseAdmin;
}

const SENSITIVE = { rateLimitPolicy: 'sensitive' } as const;

const accountSecurityRoutes: FastifyPluginAsync<AccountSecurityRoutesOptions> = async (
  app,
  options,
) => {
  const kv =
    options.kv ?? (app.redis === undefined ? memoryKvStore() : (app.redis as never as KvStore));
  const supabase = options.supabase ?? app.supabase;

  let pooled: AccountSecurityService | undefined;
  function serviceFor(executor?: SqlExecutor): AccountSecurityService {
    if (options.service !== undefined) return options.service;
    if (executor === undefined) {
      pooled ??= build();
      return pooled;
    }
    return build(executor);
  }

  function build(executor?: SqlExecutor): AccountSecurityService {
    return new AccountSecurityService({
      repo: options.repo ?? new SqlAccountSecurityRepo(executor ?? app.db),
      supabase,
      webauthn:
        options.webauthn ??
        new SimpleWebauthnService({
          rpID: app.env.WEBAUTHN_RP_ID,
          rpName: app.env.WEBAUTHN_RP_NAME,
          origin: app.env.WEB_ORIGIN,
        }),
      breach: options.breach ?? NO_BREACH_CHECK,
      kv,
      email: app.email,
      queues: app.queues,
      now: () => new Date(),
    });
  }

  /** The caller's own access token, needed for every Supabase MFA call. */
  function accessToken(request: FastifyRequest): string {
    const { at } = readSessionCookies(request);
    if (at === undefined || at === '') throw HttpError.unauthorized();
    return at;
  }

  function self(request: FastifyRequest) {
    const user = request.user;
    if (user === undefined) throw HttpError.unauthorized();
    return user;
  }

  // --------------------------------------------------------------- password
  app.post(
    '/account/password',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { body: ChangePasswordBody, response: { 204: z.null() } },
    },
    audited<FastifyRequest, void>(
      {
        eventType: 'PASSWORD_CHANGED',
        subject: (req) => self(req).email,
        message: (req, res) =>
          `Password changed for ${self(req).email}${
            res === undefined
              ? ''
              : ` · ${String((res as { revokedSessions?: number }).revokedSessions ?? 0)} other sessions revoked`
          }`,
        // Never the passwords: only the count of sessions that were signed out.
        details: (_req, res) => ({
          revokedSessions: (res as { revokedSessions?: number } | undefined)?.revokedSessions ?? 0,
        }),
      },
      async (request, reply, ctx) => {
        const body = ChangePasswordBody.parse(request.body);
        const user = self(request);

        try {
          await serviceFor(asExecutor(ctx.tx)).changePassword(body, {
            userId: user.id,
            email: user.email,
            role: user.role,
            accessToken: accessToken(request),
            sessionId: user.sessionId,
          });
        } catch (error) {
          if (error instanceof HttpError && error.code === 'invalid_credentials') {
            await auditFailure(
              app,
              {
                eventType: 'AUTH_FAILURE',
                subject: user.email,
                message: `Password change refused for ${user.email}: the current password was wrong`,
              },
              request,
              error,
            );
          }
          throw error;
        }

        return reply.status(204).send();
      },
    ),
  );

  // --------------------------------------------------------------- security
  app.get(
    '/account/security',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { response: { 200: SecurityResponse } },
    },
    async (request) => {
      const user = self(request);
      const status = await serviceFor().status(user.id);
      return SecurityResponse.parse({ data: { ...status.mfa, posture: status.posture } });
    },
  );

  // ------------------------------------------------------------------- TOTP
  app.post(
    '/account/mfa/totp/enroll',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { response: { 201: TotpEnrollStart } },
    },
    async (request, reply) => {
      const enrollment = await serviceFor().enrollTotp(accessToken(request));
      reply.status(201);
      return TotpEnrollStart.parse({
        data: {
          factorId: enrollment.factorId,
          qrCodeSvg: enrollment.qrSvg,
          secret: enrollment.secret,
          uri: enrollment.uri,
        },
      });
    },
  );

  app.post(
    '/account/mfa/totp/verify',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { body: TotpVerifyBody, response: { 204: z.null() } },
    },
    audited<FastifyRequest, void>(
      {
        eventType: 'MFA_ENABLED',
        subject: (req) => self(req).email,
        message: (req) => `Authenticator app registered for ${self(req).email}`,
        details: () => ({ factor: 'totp' }),
      },
      async (request, reply, ctx) => {
        const body = TotpVerifyBody.parse(request.body);
        const user = self(request);
        await serviceFor(asExecutor(ctx.tx)).verifyTotp(
          accessToken(request),
          user.id,
          body.factorId,
          body.code,
        );

        // The verified session is AAL2: replace the cookies so the guard sees it.
        const { at } = readSessionCookies(request);
        void at;
        return reply.status(204).send();
      },
    ),
  );

  app.delete(
    '/account/mfa/totp',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { response: { 204: z.null() } },
    },
    audited<FastifyRequest, void>(
      {
        eventType: 'MFA_DISABLED',
        subject: (req) => self(req).email,
        message: (req) => `Authenticator app removed for ${self(req).email}`,
        details: () => ({ factor: 'totp' }),
      },
      async (request, reply, ctx) => {
        await serviceFor(asExecutor(ctx.tx)).disableTotp(accessToken(request), self(request).id);
        return reply.status(204).send();
      },
    ),
  );

  // --------------------------------------------------------------- WebAuthn
  app.post(
    '/account/mfa/webauthn/register/options',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { response: { 200: z.object({ data: z.unknown() }) } },
    },
    async (request) => {
      const user = self(request);
      const options_ = await serviceFor().startWebauthnRegistration({
        id: user.id,
        email: user.email,
        displayName: user.email,
      });
      return { data: options_ };
    },
  );

  app.post(
    '/account/mfa/webauthn/register/verify',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: {
        body: WebauthnRegisterVerifyBody,
        response: { 201: z.object({ data: WebauthnKey }) },
      },
    },
    audited<FastifyRequest, { data: WebauthnKeyView }>(
      {
        eventType: 'MFA_ENABLED',
        subject: (req) => self(req).email,
        message: (req, res) =>
          `Security key registered for ${self(req).email}${
            res.data.deviceName === null ? '' : ` (${res.data.deviceName})`
          }`,
        details: () => ({ factor: 'webauthn' }),
      },
      async (request, reply, ctx) => {
        const body = WebauthnRegisterVerifyBody.parse(request.body);
        const key = await serviceFor(asExecutor(ctx.tx)).finishWebauthnRegistration(
          self(request).id,
          body.deviceName,
          body.credential,
        );
        reply.status(201);
        return { data: key };
      },
    ),
  );

  app.delete(
    '/account/mfa/webauthn/:id',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 204: z.null() },
      },
    },
    audited<FastifyRequest, void>(
      {
        eventType: 'MFA_DISABLED',
        subject: (req) => self(req).email,
        message: (req) => `Security key removed for ${self(req).email}`,
        details: () => ({ factor: 'webauthn' }),
      },
      async (request, reply, ctx) => {
        const params = request.params as { id: string };
        await serviceFor(asExecutor(ctx.tx)).deleteWebauthnKey(self(request).id, params.id);
        return reply.status(204).send();
      },
    ),
  );

  // --------------------------------------------------------- recovery codes
  const recoveryCodesSpec = {
    eventType: 'RECOVERY_CODES_GENERATED',
    subject: (req: FastifyRequest) => self(req).email,
    message: (req: FastifyRequest) => `Recovery codes generated for ${self(req).email}`,
    // Only the batch id. The codes themselves are shown once and never recorded.
    details: (_req: FastifyRequest, res: { data: { batchId: string } }) => ({
      batchId: res.data.batchId,
    }),
  } as const;

  app.post(
    '/account/recovery-codes',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { response: { 201: RecoveryCodesResponse } },
    },
    audited<FastifyRequest, { data: { codes: string[]; batchId: string; generatedAt: string } }>(
      recoveryCodesSpec,
      async (request, reply, ctx) => {
        const batch = await serviceFor(asExecutor(ctx.tx)).createRecoveryCodes(self(request).id);
        reply.status(201).header('cache-control', 'no-store');
        return { data: batch };
      },
    ),
  );

  app.post(
    '/account/recovery-codes/regenerate',
    {
      preHandler: [app.authenticate],
      config: SENSITIVE,
      schema: { response: { 201: RecoveryCodesResponse } },
    },
    audited<FastifyRequest, { data: { codes: string[]; batchId: string; generatedAt: string } }>(
      recoveryCodesSpec,
      async (request, reply, ctx) => {
        const batch = await serviceFor(asExecutor(ctx.tx)).regenerateRecoveryCodes(
          self(request).id,
        );
        reply.status(201).header('cache-control', 'no-store');
        return { data: batch };
      },
    ),
  );

  // The MFA cookie path is needed by the login-time WebAuthn ceremony.
  void COOKIE_NAMES;
};

export default fp(accountSecurityRoutes, { name: 'account-security' });
