import type { Db } from '@vunvault/db';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import type { SecretProvider } from '../lib/secrets/provider.js';
import type { Tx } from '../plugins/db.js';
import type { QueueRegistry } from '../queues/index.js';
import type { EmailProvider } from '../providers/email.js';
import type { SmsProvider } from '../providers/sms.js';
import type { ObjectStorage } from '../lib/object-storage.js';
import type { NotificationDispatcher } from '../lib/notify.js';
import type { PaymentProviders } from '../billing/providers/index.js';
import type { CookieOptionsResolver } from '../plugins/cookies.js';
import type { CaptureError } from '../plugins/sentry.js';
import type { RatePolicy } from '../plugins/rate-limit.js';
import type { preHandlerHookHandler } from 'fastify';
import type { Permission, UserRole } from '@vunvault/contracts';
import type { AuthUser } from '../plugins/auth.js';
import type { SupabaseAdmin } from '../lib/supabase-admin.js';
import type { MfaVerifierRegistry } from '../routes/v1/auth/mfa-registry.js';
import type { AuditService } from '../audit/service.js';
import type { AuditSpec, AuditedHandler, AuditedRouteHandler } from '../audit/audited.js';

/**
 * Instance and request decorations.
 *
 * Later tasks extend these interfaces in place — the database, Redis, queues and
 * the authenticated user all hang off `FastifyInstance` / `FastifyRequest`.
 */
declare module 'fastify' {
  interface FastifyInstance {
    /** Validated runtime configuration. */
    env: Env;
    /** Named readiness probes run by `GET /readyz`. */
    readiness: Map<string, () => Promise<void>>;
    /** Secrets: OCI Vault in production, the environment elsewhere. */
    secrets: SecretProvider;
    /** Drizzle over the Supavisor transaction pooler. */
    db: Db;
    /** Run `work` inside one database transaction. */
    withTx: <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;
    /** Shared Redis command connection. Never used for pub/sub or blocking calls. */
    redis: Redis;
    /** A NEW Redis connection, for subscribers and BullMQ workers. */
    createRedis: () => Redis;
    /** One BullMQ producer per queue name. */
    queues: QueueRegistry;
    email: EmailProvider;
    sms: SmsProvider;
    /** Cloudflare R2 (S3-compatible) for avatars and generated PDFs. */
    storage: ObjectStorage;
    /** Resolves preferences + quiet hours and enqueues `notify` jobs. */
    notify: NotificationDispatcher;
    /** Stripe and Paystack REST clients, built from secrets. */
    payments: PaymentProviders;
    /** Cookie attributes for a named cookie, bound to this environment. */
    cookieOptions: CookieOptionsResolver;
    /** Report a server fault; a no-op when Sentry is not configured. */
    captureError: CaptureError;
    /** Supabase admin (service role). Never exposed to a client. */
    supabase: SupabaseAdmin;
    /** Require a valid session cookie. */
    authenticate: preHandlerHookHandler;
    /** Attach `request.user` when a valid cookie exists; never rejects. */
    optionalAuth: preHandlerHookHandler;
    /** Require every listed permission. */
    requirePermission: (...permissions: Permission[]) => preHandlerHookHandler;
    /** Require at least one of the listed permissions. */
    requireAnyPermission: (...permissions: Permission[]) => preHandlerHookHandler;
    /** Require one of the listed roles. */
    requireRole: (...roles: UserRole[]) => preHandlerHookHandler;
    /** Require a staff role AND a second factor (AAL2). */
    requireStaff: preHandlerHookHandler;
    /** The append-only audit chain service. */
    audit: AuditService;
    /** Second-factor verifiers; Task 27 replaces the webauthn/recovery stubs. */
    mfaVerifiers: MfaVerifierRegistry;
    /** Wrap a mutating handler so its write and its audit entry commit together. */
    audited: <Req extends FastifyRequest, Res>(
      spec: AuditSpec<Req, Res>,
      handler: AuditedHandler<Req, Res>,
    ) => AuditedRouteHandler<Req, Res>;
  }

  interface FastifyRequest {
    /** Inbound `x-request-id` when well formed, otherwise a generated UUID. */
    requestId: string;
    /** Exact bytes of the body, for routes that opt into `config.rawBody`. */
    rawBody?: Buffer;
    /** Resolved client IP: `CF-Connecting-IP` behind a trusted peer, else `ip`. */
    clientIp: string;
    /** The authenticated principal, when a guard has run. */
    user?: AuthUser;
  }

  interface FastifyContextConfig {
    /** Set `true` to keep a route out of the OpenAPI document. */
    hidden?: boolean;
    /** Consumed by `@fastify/rate-limit`; `false` exempts the route. */
    rateLimit?: boolean | { max: number; timeWindow: string };
    /** Named rate-limit policy applied on top of the global limit. */
    rateLimitPolicy?: RatePolicy;
    /** Set `false` to exempt a route from the CSRF double-submit check. */
    csrf?: boolean;
    /** Set `true` to capture the exact request bytes as `request.rawBody`. */
    rawBody?: boolean;
  }
}
