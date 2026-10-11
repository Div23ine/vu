import { z } from 'zod';

/**
 * Notify-worker environment (Task 90).
 *
 * Validated once at boot with Zod so a missing or malformed variable fails the
 * process at startup rather than halfway through somebody's password-reset
 * e-mail. Every name here is listed (without a value) in `apps/api/.env.example`.
 *
 * The worker runs in the trusted OKE zone: it holds the delivery-provider keys,
 * the R2 write credentials for rendered PDFs, and the pooled database URL for
 * the inbox and receipt writes.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Redis for BullMQ (the `notify` and `pdf` queues). */
  REDIS_URL: z.string().url(),

  /** Supavisor transaction pooler; the worker runs no DDL. */
  DATABASE_URL: z.string().url(),

  /** E-mail and SMS providers — the same clients the API uses. */
  RESEND_API_KEY: z.string().min(1),
  AFRICASTALKING_USERNAME: z.string().min(1),
  AFRICASTALKING_API_KEY: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  /** Configuration, not a secret: the Twilio sender id. */
  TWILIO_FROM: z.string().default(''),

  /** R2, for rendered invoice/report PDFs. */
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),

  /** Absolute links inside e-mails point at the web app. */
  WEB_ORIGIN: z.string().url(),

  NOTIFY_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(8),
  PDF_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),

  /** Prefix for every Redis key this worker owns. */
  REDIS_KEY_PREFIX: z.string().min(1).default('vv'),
});

export type Env = z.infer<typeof EnvSchema>;

export interface LoadEnvOptions {
  /** Test seam: pass a literal record instead of reading `process.env`. */
  source?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

/**
 * Read and validate the environment.
 *
 * Throws a `ZodError` on the first invalid configuration; the message names the
 * offending key.
 */
export function loadEnv(options: LoadEnvOptions = {}): Env {
  return EnvSchema.parse(options.source ?? process.env);
}

/** pino redaction paths — a delivery key must never reach a log sink. */
export const LOG_REDACT_PATHS = [
  'RESEND_API_KEY',
  'AFRICASTALKING_API_KEY',
  'TWILIO_AUTH_TOKEN',
  'R2_SECRET_ACCESS_KEY',
  'REDIS_URL',
  'DATABASE_URL',
  '*.secret',
  '*.token',
  '*.password',
  '*.key',
  '*.url',
] as const;
