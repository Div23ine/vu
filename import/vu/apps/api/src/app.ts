import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyServerOptions,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { loadEnv, parseEnv, type Env } from './config/env.js';
import type { DbPluginOptions } from './plugins/db.js';
import type { ProvidersPluginOptions } from './plugins/providers.js';
import type { RedisPluginOptions } from './plugins/redis.js';
import type { SecretsPluginOptions } from './plugins/secrets.js';
import errorHandler from './plugins/error-handler.js';
import dbPlugin, { pingDb } from './plugins/db.js';
import openApi from './plugins/openapi.js';
import providersPlugin from './plugins/providers.js';
import redisPlugin from './plugins/redis.js';
import { resolveRequestId } from './plugins/request-context.js';
import requestContext from './plugins/request-context.js';
import cookiesPlugin from './plugins/cookies.js';
import corsPlugin from './plugins/cors.js';
import originVerifyPlugin, { type OriginVerifyOptions } from './plugins/origin-verify.js';
import csrfPlugin from './plugins/csrf.js';
import rawBodyPlugin from './plugins/raw-body.js';
import rateLimitPlugin, { type RateLimitPluginOptions } from './plugins/rate-limit.js';
import auditPlugin, { type AuditPluginOptions } from './plugins/audit.js';
import authPlugin, { type AuthPluginOptions } from './plugins/auth.js';
import secretsPlugin from './plugins/secrets.js';
import securityHeadersPlugin from './plugins/security-headers.js';
import sentryPlugin, { type SentryPluginOptions } from './plugins/sentry.js';
import queuesPlugin from './queues/index.js';
import healthRoutes from './routes/health.js';
import v1Routes from './routes/v1/index.js';

/** The application instance every route module and plugin receives. */
export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

/** Never logged, whatever the level. */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
] as const;

/** 1 MiB — JSON payloads only; file uploads go straight to object storage. */
export const BODY_LIMIT_BYTES = 1_048_576;

export interface BuildAppOptions {
  /** A complete or partial environment; `process.env` is used when omitted. */
  env?: Partial<Env>;
  /** Fastify server options merged last — tests pass `{ logger: false }`. */
  overrides?: FastifyServerOptions;
  /** Test seams forwarded to the infrastructure plugins. */
  secretsOptions?: SecretsPluginOptions;
  dbOptions?: DbPluginOptions;
  redisOptions?: RedisPluginOptions;
  providersOptions?: ProvidersPluginOptions;
  sentryOptions?: SentryPluginOptions;
  authOptions?: AuthPluginOptions;
  auditOptions?: AuditPluginOptions;
  /** Register the audit chain. Defaults to the value of `infra`. */
  audit?: boolean;
  /** Register the auth guards. Defaults to `true`. */
  auth?: boolean;
  rateLimitOptions?: RateLimitPluginOptions;
  originVerifyOptions?: OriginVerifyOptions;
  /**
   * Skip the infrastructure plugins. Tests that only exercise the error model,
   * health or OpenAPI wiring pass `{ infra: false }` and connect to nothing.
   */
  infra?: boolean;
}

/**
 * Build a fully configured API instance WITHOUT listening.
 *
 * Keeping construction and binding apart is what makes the whole surface testable
 * with `app.inject()`: no port, no sockets, no background timers.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<App> {
  const env = options.env === undefined ? loadEnv() : parseEnv(options.env);

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: { paths: [...REDACT_PATHS], censor: '[Redacted]' },
    },
    genReqId: (request) => resolveRequestId(request.headers),
    trustProxy: true,
    bodyLimit: BODY_LIMIT_BYTES,
    ...options.overrides,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod schemas are the validation AND the OpenAPI source of truth.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('env', env);
  app.decorate('readiness', new Map<string, () => Promise<void>>());

  await app.register(requestContext);
  await app.register(errorHandler);
  await app.register(sentryPlugin, options.sentryOptions ?? {});
  await app.register(openApi, { env });
  await app.register(healthRoutes);

  if (options.infra !== false) {
    // Order matters: every plugin below asks `app.secrets` for a connection string.
    await app.register(secretsPlugin, options.secretsOptions ?? {});
    await app.register(dbPlugin, options.dbOptions ?? {});
    await app.register(redisPlugin, options.redisOptions ?? {});
    await app.register(queuesPlugin);
    await app.register(providersPlugin, options.providersOptions ?? {});

    app.readiness.set('db', async () => {
      await pingDb(app.db);
    });
    // A3: the redis probe is registered ONLY while a real Redis backs the app.
    // Offline, the in-memory shim always answers PONG, so keeping the probe would
    // advertise a dependency that is deliberately absent; making it fail would be
    // worse — the orchestrator would pull traffic from a pod that is serving
    // correctly (Task 21's own reasoning for why `/healthz` answers from the
    // process alone). `/health` is where the degraded mode is reported instead.
    if (app.redisMode.store === 'redis') {
      app.readiness.set('redis', async () => {
        const pong = await app.redis.ping();
        if (pong !== 'PONG') throw new Error(`redis replied ${pong}`);
      });
    }
  }

  // Cross-cutting HTTP security, registered before any route.
  await app.register(securityHeadersPlugin);
  await app.register(corsPlugin);
  await app.register(cookiesPlugin);
  await app.register(rawBodyPlugin);
  // The origin lock runs BEFORE rate limiting: an unverified request must not
  // be able to pick its own `cf-connecting-ip` bucket (Task 99).
  await app.register(originVerifyPlugin, options.originVerifyOptions ?? {});
  await app.register(rateLimitPlugin, options.rateLimitOptions ?? {});
  await app.register(csrfPlugin);

  // Guards are registered after CSRF so a forged mutating request never reaches one.
  // Auth guards are always registered: route groups reference `app.authenticate`
  // at registration time, and the plugin degrades safely (every request 401s) when
  // no JWT secret is available.
  if (options.auth !== false) {
    await app.register(authPlugin, options.authOptions ?? {});
  }

  // After auth: an audit entry names its actor.
  if (options.audit ?? options.infra !== false) {
    await app.register(auditPlugin, options.auditOptions ?? {});
  }

  await app.register(v1Routes, { prefix: '/api/v1' });

  return app;
}
