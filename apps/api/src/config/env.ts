import { z } from 'zod';

/**
 * Runtime configuration.
 *
 * Everything the process needs that is NOT a secret lives here and is validated
 * once, at boot, by `loadEnv()`. When `SECRETS_PROVIDER=oci-vault` the secret
 * *names* are resolved from `OCI_SECRET_MAP`; the secret values are fetched by the
 * secrets plugin (Task 22) and never appear in this schema.
 */

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

export const SECRETS_PROVIDER_MESSAGE =
  'SECRETS_PROVIDER must be "oci-vault" when NODE_ENV is "production"';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

    /** Exact origin of the web app, e.g. `https://www.vunvault.com`. */
    WEB_ORIGIN: z.string().refine(
      (val) => {
        return val.split(',').every((url) => {
          try {
            const parsed = new URL(url.trim());
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        });
      },
      { message: 'Must be a comma-separated list of valid URLs' },
    ),

    /** e.g. `.vunvault.com`. Empty is allowed in development. */
    COOKIE_DOMAIN: z.string().default(''),
    /** Public base URL of this API, used as the OpenAPI server. */
    API_PUBLIC_URL: z.string().url(),

    SECRETS_PROVIDER: z.enum(['env', 'oci-vault']).default('env'),

    SUPABASE_URL: z.string().url(),

    /** WebAuthn relying party, e.g. `vunvault.com`. Never a URL, never localhost. */
    WEBAUTHN_RP_ID: z.string().min(1),
    /** Relying-party name shown in the browser's passkey prompt. */
    WEBAUTHN_RP_NAME: z.string().default('VUNVAULT'),
    SENTRY_DSN: z.string().url().optional(),
    /**
     * `false` disables the Task 99 edge origin lock even in production —
     * an escape hatch for running the API without the Cloudflare edge
     * (cluster-internal consumers). Absent/anything else = enforce.
     */
    ORIGIN_VERIFY_ENFORCE: z.enum(['true', 'false']).optional(),
    /** JSON object mapping a secret name to its OCI Vault OCID. */
    OCI_SECRET_MAP: z.string().optional(),

    // Object storage (Cloudflare R2, S3-compatible). Credentials are secrets.
    R2_ACCOUNT_ID: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    /** Public base URL the CDN serves avatar objects from. */
    R2_PUBLIC_BASE_URL: z.string().url(),

    /**
     * FX rate feed for display-only quotes (Task 33).
     */
    FX_API_URL: z.string().url().optional(),
    /** Lifetime of a locked display rate, and of the cached rate payload. */
    FX_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().optional(),

    /**
     * Comma-separated CIDR allow-list for the internal scan-controller
     * callbacks (Task 40g). Empty/absent = no IP restriction.
     */
    SCAN_CONTROLLER_CIDRS: z.string().optional(),
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.SECRETS_PROVIDER === 'env'), {
    path: ['SECRETS_PROVIDER'],
    message: SECRETS_PROVIDER_MESSAGE,
  });

export type Env = z.infer<typeof EnvSchema>;

/** Default FX rate feed: the open exchange-rate API, quoted against USD. */
export const FX_API_URL_DEFAULT = 'https://open.er-api.com/v6/latest/USD';

/** A locked display rate lives for 15 minutes, and so does the cached payload. */
export const FX_QUOTE_TTL_SECONDS_DEFAULT = 900;

export interface FxConfig {
  url: string;
  ttlSeconds: number;
}

/**
 * The rate-feed configuration with its defaults applied.
 */
export function resolveFxConfig(env: Env): FxConfig {
  return {
    url: env.FX_API_URL ?? FX_API_URL_DEFAULT,
    ttlSeconds: env.FX_QUOTE_TTL_SECONDS ?? FX_QUOTE_TTL_SECONDS_DEFAULT,
  };
}

/** Render every problem as one readable line — a boot failure must be actionable. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/** Parse and validate an arbitrary env-shaped object. Throws on the first run. */
export function parseEnv(input: unknown): Env {
  const result = EnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(result.error)}`);
  }
  return result.data;
}

/** Read `process.env`, validate it and fail fast before anything binds a port. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return parseEnv(source);
}
