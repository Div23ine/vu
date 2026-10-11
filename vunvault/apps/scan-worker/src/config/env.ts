import { z } from 'zod';

/**
 * Scan-controller environment (Task 84).
 *
 * Validated once at boot with Zod so a missing or malformed variable fails the
 * process at startup rather than halfway through a scan. Every name here is
 * listed (without a value) in `.env.example`.
 *
 * The controller holds NO database credentials — that is the whole point of the
 * isolation model (Task 40g). Its only secret is the HMAC key that signs its
 * callbacks, and its only stores are Redis (queue, control pub/sub, slot
 * semaphore) and the API itself.
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Redis for BullMQ, the `scan:ctl:*` pub/sub and the slot semaphore. */
  REDIS_URL: z.string().url(),

  /** Base URL of the API's internal routes, e.g. `https://api.internal`. */
  API_INTERNAL_URL: z.string().url(),

  /**
   * HMAC-SHA256 key for the signed callbacks. The API reads the same secret
   * (`SCAN_CONTROLLER_HMAC_KEY`); it is base64-encoded at rest and used as the
   * raw key string here, exactly as Task 40g's signer does.
   */
  SCAN_CONTROLLER_HMAC_KEY: z.string().min(32),

  /** Worker slots = BullMQ concurrency = the semaphore's ceiling. */
  WORKER_SLOTS_TOTAL: z.coerce.number().int().positive().max(64).default(4),

  /** Prefix for every Redis key this controller owns. */
  REDIS_KEY_PREFIX: z.string().min(1).default('vv'),

  /** Request timeout for a signed callback, in milliseconds. */
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
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
 * offending key, which is what an operator needs at 3 a.m.
 */
export function loadEnv(options: LoadEnvOptions = {}): Env {
  return EnvSchema.parse(options.source ?? process.env);
}
