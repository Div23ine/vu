import { z } from 'zod';

/**
 * Broadcast-worker environment (Task 89).
 *
 * Validated once at boot with Zod so a missing or malformed variable fails the
 * process at startup rather than halfway through a SEV-1 delivery. Every name
 * here is listed (without a value) in `apps/api/.env.example`.
 *
 * Unlike the scan controller (which holds NO database credentials — that is its
 * isolation model), the broadcast worker runs inside the trusted OKE zone and
 * reads the audience straight from Postgres. Its secrets are the delivery
 * providers' keys and nothing else.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Redis for BullMQ (the `broadcast` queue) and the progress Pub/Sub. */
  REDIS_URL: z.string().url(),

  /** Supavisor transaction pooler; the worker runs no DDL. */
  DATABASE_URL: z.string().url(),

  /** Delivery providers — the same clients the API uses. */
  RESEND_API_KEY: z.string().min(1),
  AFRICASTALKING_USERNAME: z.string().min(1),
  AFRICASTALKING_API_KEY: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  /** Configuration, not a secret: the Twilio sender id. */
  TWILIO_FROM: z.string().default(''),

  /** How many broadcast jobs may deliver at once. */
  BROADCAST_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),

  /** Progress frames are published at most this often (the final one always is). */
  PROGRESS_THROTTLE_MS: z.coerce.number().int().min(250).default(2000),

  /** Counter deltas are flushed to the row every N deliveries (and at the end). */
  COUNTER_FLUSH_EVERY: z.coerce.number().int().min(1).default(25),

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
 * offending key, which is what an operator needs when a broadcast is stuck.
 */
export function loadEnv(options: LoadEnvOptions = {}): Env {
  return EnvSchema.parse(options.source ?? process.env);
}

/** pino redaction paths — a delivery key must never reach a log sink. */
export const LOG_REDACT_PATHS = [
  'RESEND_API_KEY',
  'AFRICASTALKING_API_KEY',
  'TWILIO_AUTH_TOKEN',
  'REDIS_URL',
  'DATABASE_URL',
  '*.secret',
  '*.token',
  '*.password',
  '*.key',
  '*.url',
] as const;
