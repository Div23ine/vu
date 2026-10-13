import { z } from 'zod';

/**
 * Maintenance-worker environment (Tasks 91–92).
 *
 * Validated once at boot with Zod. Every name here is listed (without a value)
 * in `apps/api/.env.example`. The worker runs in the trusted OKE zone: it holds
 * the pooled database URL, the R2 write credentials for the daily audit
 * snapshot, and the audit HMAC key it needs to VERIFY the chain (verification
 * only — appends stay in the API under its advisory lock).
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Redis for BullMQ (the `maintenance` queue + the scheduler). */
  REDIS_URL: z.string().url(),

  /** Supavisor transaction pooler; the worker runs no DDL. */
  DATABASE_URL: z.string().url(),

  MAINTENANCE_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),

  /** A node is stale after this long without a heartbeat (3 × the API's 30 s skew). */
  HEARTBEAT_STALE_MS: z.coerce.number().int().positive().default(90_000),
  /** Consecutive stale sweeps before a node is marked offline. */
  HEARTBEAT_MISS_LIMIT: z.coerce.number().int().min(1).default(3),

  /** Task 92 windows. */
  LOGIN_ATTEMPT_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  INVITATION_GRACE_HOURS: z.coerce.number().int().min(0).default(0),
  DORMANT_AFTER_DAYS: z.coerce.number().int().min(1).default(90),
  SIGNUP_STALE_DAYS: z.coerce.number().int().min(1).default(7),
  OUTBOX_STUCK_MINUTES: z.coerce.number().int().min(1).default(2),

  /** R2 — the daily audit snapshot (Task 92). */
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),

  /** Audit chain verification key (Task 92) — the same pair the API signs with. */
  AUDIT_HMAC_KEY_ID: z.string().min(1),
  AUDIT_HMAC_KEY: z.string().min(32),
  /** When set, a chain mismatch e-mails this address (template `chain_broken`). */
  AUDIT_ALERT_EMAIL: z.string().email().optional(),

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

/** pino redaction paths — a verification or storage key must never reach a log sink. */
export const LOG_REDACT_PATHS = [
  'AUDIT_HMAC_KEY',
  'R2_SECRET_ACCESS_KEY',
  'REDIS_URL',
  'DATABASE_URL',
  '*.secret',
  '*.token',
  '*.password',
  '*.key',
  '*.url',
] as const;
