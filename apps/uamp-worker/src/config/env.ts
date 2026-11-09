import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  LOG_LEVEL: z.string().default('info'),
  /** Max concurrent check jobs this worker process handles. */
  UAMP_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  /** Default User-Agent for outbound checks. */
  UAMP_USER_AGENT: z.string().default('UAMP-Monitor/1.0 (+https://uptimehq.vunvault.com)'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}

export const LOG_REDACT_PATHS = ['headers.authorization', 'headers.cookie'] as const;
